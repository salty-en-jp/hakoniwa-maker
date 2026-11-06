// 再生中のゲーム世界。ロジックアセットを動かし、物理と接触を進める
//
// 画面への表示は ui に任せる。ui は次の関数を持つオブジェクト:
//   log(text, isError)  message(text, seconds)  hideMessage()
//   setScore(n)         setHud(label, text)     showEnd(won, text, score, seconds)
//
// 合図(メッセージ): ロジックどうしが直接お互いを知らなくても連携できる仕組み
//   self.on('damage', (data, from) => { ... })  合図を受け取る
//   other.send('damage', 1, self)               相手に合図を送る
//   game.broadcast('alarm', data, 'enemy')       全員(またはタグの全員)に送る
// 共通語(よく使う合図の名前と中身)は docs/messages.md にまとめている
//
// 親子: 子のメッシュは親のメッシュにぶら下がる。self.parent / self.children で行き来できる

import * as THREE from 'three';
import { BODIES, isEmptyShape } from './defs.js';
import { findAsset, countAssetUsage } from './project.js';
import { findPrefabByName } from './prefab.js';
import { rootsOf } from './tree.js';
import { createMesh, disposeMesh } from './mesh.js';
import { stepPhysics, detectContacts, worldPos } from './physics.js';

const PHASE_LABEL = { start: 'start', update: 'update', onCollide: 'onCollide', setup: '準備' };

/** 合図が合図を呼び続けて止まらなくなるのを防ぐ上限 */
const MAX_MESSAGE_DEPTH = 32;

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
    this.messageDepth = 0;
    this.currentAsset = null; // いま動いているロジックの名前(エラー表示用)

    this.compiled = new Map();
    for (const a of project.assets) {
      try {
        this.compiled.set(a.id, compileAsset(a.code));
      } catch (err) {
        if (countAssetUsage(project, a.id)) ui.log(`「${a.name}」のコードに書き間違いがあります: ${err.message}`, true);
      }
    }

    this.game = this.createGameApi();
    const spawned = [];
    for (const root of rootsOf(project.objects)) spawned.push(...this.spawnTree(project.objects, root, null));
    spawned.forEach(e => this.callHook(e, 'start'));
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
      hud(label, text) { rt.ui.setHud(String(label), text === undefined || text === null ? null : String(text)); },
      win(text) { rt.end(true, text); },
      lose(text) { rt.end(false, text); },
      find(name) {
        const e = rt.ents.find(x => !x.dead && x.name === name);
        return e ? e.api : null;
      },
      findAll(tag) { return rt.ents.filter(x => !x.dead && x.tag === tag).map(x => x.api); },
      broadcast(name, data, tag) {
        for (const e of rt.ents.slice()) {
          if (e.dead || (tag !== undefined && e.tag !== tag)) continue;
          rt.deliver(e, name, data, undefined);
        }
      },
      /**
       * 名前で出す。プレハブの名前でも、シーンのオブジェクトの名前でもよい(子もまとめて出る)
       * pos を省くと元の位置。出したもののルートの self を返す
       */
      spawn(name, pos) {
        const prefab = findPrefabByName(rt.project, name);
        let list, root;
        if (prefab) { list = prefab.objects; root = prefab.objects[0]; }
        else {
          list = rt.project.objects;
          root = list.find(o => o.name === name);
        }
        if (!root) { rt.ui.log(`spawn: 「${name}」という名前のプレハブやオブジェクトがありません`, true); return null; }
        const made = rt.spawnTree(list, root, null, pos);
        if (prefab) made[0].name = prefab.name;
        made.forEach(e => rt.callHook(e, 'start'));
        return made[0].api;
      },
      log(...args) {
        rt.ui.log(args.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' '));
      }
    };
  }

  /**
   * オブジェクトとその子孫をまとめて出す。全員のメッシュと親子を作ってから、ロジックを準備する
   * (準備の時点で self.children が揃っているように)
   * @returns {object[]} 出したエンティティ(ルートが先頭)
   */
  spawnTree(list, rootData, parentEnt, pos) {
    const made = [];
    const build = (data, parent) => {
      const e = this.createEntity(data, parent);
      made.push(e);
      for (const c of list) if (c.parent === data.id) build(c, e);
    };
    build(rootData, parentEnt);
    if (pos) {
      const m = made[0].mesh;
      m.position.set(pos.x ?? m.position.x, pos.y ?? m.position.y, pos.z ?? m.position.z);
      made[0].start.copy(m.position);
      made.forEach(e => { e.mesh.updateWorldMatrix(true, false); worldPos(e, e.prevWorld); });
    }
    made.forEach(e => this.attachBehaviors(e));
    return made;
  }

  /** エンティティ(再生中の1つのオブジェクト)を作る。ロジックはまだ付けない */
  createEntity(data, parent) {
    const mesh = createMesh(data, 'play');
    (parent ? parent.mesh : this.group).add(mesh);
    mesh.updateWorldMatrix(true, false);

    const e = {
      uid: ++this.uid, data, name: data.name, tag: data.tag,
      body: isEmptyShape(data.shape) ? 'none' : data.body,
      mesh, parent, children: [],
      velocity: new THREE.Vector3(), grounded: false, ground: null,
      prevWorld: mesh.getWorldPosition(new THREE.Vector3()), start: mesh.position.clone(),
      dead: false, hooks: [],
      handlers: new Map() // 合図の名前 → [{ fn, asset }]
    };
    if (parent) parent.children.push(e);
    const rt = this;

    // ロジックから見える self
    e.api = {
      get name() { return e.name; },
      get tag() { return e.tag; }, set tag(v) { e.tag = String(v); },
      position: mesh.position, rotation: mesh.rotation, scale: mesh.scale, velocity: e.velocity,
      get grounded() { return e.grounded; },
      get startPosition() { return e.start.clone(); },
      get alive() { return !e.dead; },
      object3d: mesh,
      get body() { return e.body; }, set body(v) { if (BODIES[v] && !isEmptyShape(data.shape)) e.body = v; },
      /** 親の self(なければ null) */
      get parent() { return e.parent && !e.parent.dead ? e.parent.api : null; },
      /** 子の self の配列 */
      get children() { return e.children.filter(c => !c.dead).map(c => c.api); },
      /** 子孫から名前で探す */
      findChild(name) {
        const stack = [...e.children];
        while (stack.length) {
          const c = stack.shift();
          if (!c.dead && c.name === name) return c.api;
          stack.push(...c.children);
        }
        return null;
      },
      /** ワールド座標での位置(親子の影響を全部足した位置) */
      worldPosition(target = new THREE.Vector3()) { return mesh.getWorldPosition(target); },
      setColor(c) { if (mesh.material) mesh.material.color.set(c); },
      /** 消える。子も一緒に消える */
      destroy() { rt.kill(e); },
      /** 合図を受け取る。同じ名前を何度登録してもよい */
      on(name, fn) {
        if (typeof fn !== 'function') return;
        if (!e.handlers.has(name)) e.handlers.set(name, []);
        e.handlers.get(name).push({ fn, asset: rt.currentAsset || '?' });
      },
      /** このオブジェクトに合図を送る(他のロジックからは other.send(...) として使う) */
      send(name, data, from) { rt.deliver(e, String(name), data, from); }
    };
    this.ents.push(e);
    return e;
  }

  /** オブジェクトに付いているロジックを準備する */
  attachBehaviors(e) {
    for (const b of e.data.behaviors) {
      const asset = findAsset(this.project, b.asset);
      if (!asset) continue;
      const fn = this.compiled.get(asset.id);
      if (!fn) continue;
      const params = {};
      asset.params.forEach(p => { params[p.key] = b.params[p.key] !== undefined ? b.params[p.key] : p.def; });
      const prev = this.currentAsset;
      this.currentAsset = asset.name;
      try {
        const hooks = fn(e.api, params, this.game, THREE);
        if (hooks && typeof hooks === 'object') e.hooks.push({ h: hooks, name: asset.name });
      } catch (err) {
        this.logError(asset.name, 'setup', err);
      } finally {
        this.currentAsset = prev;
      }
    }
  }

  kill(e) {
    e.dead = true;
    e.children.forEach(c => this.kill(c));
  }

  /** start / update / onCollide を呼ぶ。一度エラーを出したロジックは止める */
  callHook(e, name, ...args) {
    for (const k of e.hooks) {
      if (k.broken || (e.dead && name !== 'onCollide')) continue;
      const f = k.h[name];
      if (typeof f !== 'function') continue;
      const prev = this.currentAsset;
      this.currentAsset = k.name;
      try { f.apply(k.h, args); } catch (err) { k.broken = true; this.logError(k.name, name, err); }
      finally { this.currentAsset = prev; }
    }
  }

  /** 合図を届ける。受け取り手のエラーは記録して、他の受け取り手には届け続ける */
  deliver(e, name, data, from) {
    if (e.dead || this.ended) return;
    const list = e.handlers.get(name);
    if (!list || !list.length) return;
    if (this.messageDepth >= MAX_MESSAGE_DEPTH) {
      this.ui.log(`合図「${name}」が合図を呼び続けているので止めました(${MAX_MESSAGE_DEPTH}段まで)`, true);
      return;
    }
    this.messageDepth++;
    try {
      for (const h of list.slice()) {
        const prev = this.currentAsset;
        this.currentAsset = h.asset;
        try { h.fn(data, from); } catch (err) { this.ui.log(`「${h.asset}」が合図「${name}」を受け取ったときにエラー: ${err && err.message ? err.message : err}`, true); }
        finally { this.currentAsset = prev; }
        if (e.dead || this.ended) break;
      }
    } finally {
      this.messageDepth--;
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

    this.group.updateMatrixWorld(true);
    for (const e of this.ents) worldPos(e, e.prevWorld);
    for (const e of this.ents.slice()) if (!e.dead) this.callHook(e, 'update', dt);
    if (this.ended) { this.input.endFrame(); return; }

    stepPhysics(this.ents, this.project.settings.gravity, dt);

    const { contacts, entered } = detectContacts(this.ents, this.contacts);
    for (const [a, b] of entered) {
      this.callHook(a, 'onCollide', b.api);
      this.callHook(b, 'onCollide', a.api);
    }
    this.contacts = contacts;

    for (const e of this.ents) {
      if (!e.dead) continue;
      e.mesh.removeFromParent();
      disposeMesh(e.mesh);
      if (e.parent) e.parent.children = e.parent.children.filter(c => c !== e);
    }
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
