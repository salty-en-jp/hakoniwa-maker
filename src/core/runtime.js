// 再生中のゲーム世界。ロジックアセットを動かし、物理と接触を進める
//
// 画面への表示は ui に任せる。ui は次の関数を持つオブジェクト:
//   log(text, isError)  message(text, seconds)  hideMessage()
//   setScore(n)         showEnd(won, text, score, seconds)

import * as THREE from 'three';
import { BODIES } from './defs.js';
import { findAsset, countAssetUsage } from './project.js';
import { createMesh, disposeMesh } from './mesh.js';
import { stepPhysics, detectContacts } from './physics.js';

const PHASE_LABEL = { start: 'start', update: 'update', onCollide: 'onCollide', setup: '準備' };

/** ロジックアセットのコードを関数にする。書き間違いがあれば例外 */
export function compileAsset(code) {
  return new Function('self', 'params', 'game', 'THREE', '"use strict";\n' + code);
}

/** 書き間違いがあればそのメッセージ、なければ null */
export function checkSyntax(code) {
  try { compileAsset(code); return null; } catch (err) { return err.message; }
}

export class Runtime {
  /**
   * @param {{ project: object, scene: THREE.Scene, camera: THREE.Camera, input: import('./input.js').Input, ui: object }} opts
   */
  constructor({ project, scene, camera, input, ui }) {
    this.project = project;
    this.camera = camera;
    this.input = input;
    this.ui = ui;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.scene = scene;

    this.ents = [];
    this.uid = 0;
    this.score = 0;
    this.time = 0;
    this.ended = false;
    this.contacts = new Set();
    this.messageTimer = 0;

    this.compiled = new Map();
    for (const a of project.assets) {
      try {
        this.compiled.set(a.id, compileAsset(a.code));
      } catch (err) {
        if (countAssetUsage(project, a.id)) ui.log(`「${a.name}」のコードに書き間違いがあります: ${err.message}`, true);
      }
    }

    this.game = this.createGameApi();
    project.objects.forEach(d => this.spawn(d));
    this.ents.slice().forEach(e => this.callHook(e, 'start'));
    ui.setScore(this.score);
  }

  /** ロジックから見える game */
  createGameApi() {
    const rt = this;
    return {
      key: c => rt.input.isDown(c),
      pressed: c => rt.input.wasPressed(c),
      get score() { return rt.score; },
      set score(v) { rt.score = Number(v) || 0; rt.ui.setScore(rt.score); },
      addScore(n = 1) { rt.score += Number(n) || 0; rt.ui.setScore(rt.score); },
      get time() { return rt.time; },
      camera: rt.camera,
      message(text, sec = 1.6) { rt.ui.message(String(text)); rt.messageTimer = sec; },
      win(text) { rt.end(true, text); },
      lose(text) { rt.end(false, text); },
      find(name) {
        const e = rt.ents.find(x => !x.dead && x.name === name);
        return e ? e.api : null;
      },
      findAll(tag) { return rt.ents.filter(x => !x.dead && x.tag === tag).map(x => x.api); },
      spawn(name, pos) {
        const data = rt.project.objects.find(o => o.name === name);
        if (!data) { rt.ui.log(`spawn: 「${name}」という名前のオブジェクトがありません`, true); return null; }
        const e = rt.spawn(data, pos);
        rt.callHook(e, 'start');
        return e.api;
      },
      log(...args) {
        rt.ui.log(args.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' '));
      }
    };
  }

  /** オブジェクトのデータからエンティティを作り、付いているロジックを準備する */
  spawn(data, pos) {
    const mesh = createMesh(data);
    if (pos) mesh.position.set(pos.x ?? mesh.position.x, pos.y ?? mesh.position.y, pos.z ?? mesh.position.z);
    this.group.add(mesh);

    const e = {
      uid: ++this.uid, name: data.name, tag: data.tag, body: data.body, mesh,
      velocity: new THREE.Vector3(), grounded: false, ground: null,
      prevPos: mesh.position.clone(), start: mesh.position.clone(), dead: false, hooks: []
    };
    // ロジックから見える self
    e.api = {
      get name() { return e.name; },
      get tag() { return e.tag; }, set tag(v) { e.tag = String(v); },
      position: mesh.position, rotation: mesh.rotation, scale: mesh.scale, velocity: e.velocity,
      get grounded() { return e.grounded; },
      get startPosition() { return e.start.clone(); },
      get alive() { return !e.dead; },
      object3d: mesh,
      get body() { return e.body; }, set body(v) { if (BODIES[v]) e.body = v; },
      setColor(c) { mesh.material.color.set(c); },
      destroy() { e.dead = true; }
    };
    this.ents.push(e);

    for (const b of data.behaviors) {
      const asset = findAsset(this.project, b.asset);
      if (!asset) continue;
      const fn = this.compiled.get(asset.id);
      if (!fn) continue;
      const params = {};
      asset.params.forEach(p => { params[p.key] = b.params[p.key] !== undefined ? b.params[p.key] : p.def; });
      try {
        const hooks = fn(e.api, params, this.game, THREE);
        if (hooks && typeof hooks === 'object') e.hooks.push({ h: hooks, name: asset.name });
      } catch (err) {
        this.logError(asset.name, 'setup', err);
      }
    }
    return e;
  }

  /** start / update / onCollide を呼ぶ。一度エラーを出したロジックは止める */
  callHook(e, name, ...args) {
    for (const k of e.hooks) {
      if (k.broken || (e.dead && name !== 'onCollide')) continue;
      const f = k.h[name];
      if (typeof f !== 'function') continue;
      try { f.apply(k.h, args); } catch (err) { k.broken = true; this.logError(k.name, name, err); }
    }
  }

  logError(assetName, phase, err) {
    this.ui.log(`「${assetName}」の ${PHASE_LABEL[phase] || phase} でエラー: ${err && err.message ? err.message : err}`, true);
  }

  /** 1フレーム進める */
  step(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.ui.hideMessage();
    }
    if (this.ended) { this.input.endFrame(); return; }
    this.time += dt;

    for (const e of this.ents) e.prevPos.copy(e.mesh.position);
    for (const e of this.ents.slice()) if (!e.dead) this.callHook(e, 'update', dt);
    if (this.ended) { this.input.endFrame(); return; }

    stepPhysics(this.ents, this.project.settings.gravity, dt);

    const { contacts, entered } = detectContacts(this.ents, this.contacts);
    for (const [a, b] of entered) {
      this.callHook(a, 'onCollide', b.api);
      this.callHook(b, 'onCollide', a.api);
    }
    this.contacts = contacts;

    for (const e of this.ents) if (e.dead) { this.group.remove(e.mesh); disposeMesh(e.mesh); }
    this.ents = this.ents.filter(e => !e.dead);
    this.input.endFrame();
  }

  end(won, text) {
    if (this.ended) return;
    this.ended = true;
    this.ui.showEnd(won, text, this.score, this.time);
  }

  dispose() {
    this.ents.forEach(e => disposeMesh(e.mesh));
    this.scene.remove(this.group);
  }
}
