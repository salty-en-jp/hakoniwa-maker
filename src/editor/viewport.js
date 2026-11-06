// 3Dの舞台: レンダラー、カメラ、ライト、視点操作、ギズモ、編集用メッシュ、クリックでの選択

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { DEG, r3 } from '../core/defs.js';
import { createMesh, updateMesh, disposeMesh } from '../core/mesh.js';

/**
 * @param {HTMLElement} container
 * @param {{ onPick: (id: string|null) => void, onTransform: (id: string, t: {pos, rot, scale}) => void }} handlers
 */
export function createViewport(container, { onPick, onTransform }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  camera.position.set(11, 10, 13);

  // three.js r155 以降の明るさの単位に合わせて、以前の値に π を掛けている
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a5a, 0.7 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85 * Math.PI);
  sun.position.set(8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const grid = new THREE.GridHelper(40, 40, 0x000000, 0x000000);
  grid.material.opacity = 0.12;
  grid.material.transparent = true;
  grid.position.y = 0.002;
  scene.add(grid);

  const editorGroup = new THREE.Group();
  scene.add(editorGroup);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 1, -4);
  orbit.enableDamping = true;
  orbit.update();

  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setSize(matchMedia('(pointer:coarse)').matches ? 1.3 : 1);
  gizmo.setTranslationSnap(0.25);
  gizmo.setRotationSnap(15 * DEG);
  scene.add(gizmo);

  const selectionBox = new THREE.BoxHelper(undefined, 0xf4c542);
  selectionBox.visible = false;
  scene.add(selectionBox);

  /** オブジェクトID → 編集用メッシュ */
  const meshes = new Map();

  // ---- ギズモ ----
  let editing = true;
  gizmo.addEventListener('dragging-changed', e => { orbit.enabled = !e.value && editing; });
  gizmo.addEventListener('objectChange', () => {
    const m = gizmo.object;
    if (!m) return;
    const round1 = v => Math.round(v / DEG * 10) / 10;
    onTransform(m.userData.id, {
      pos: { x: r3(m.position.x), y: r3(m.position.y), z: r3(m.position.z) },
      rot: { x: round1(m.rotation.x), y: round1(m.rotation.y), z: round1(m.rotation.z) },
      scale: { x: r3(m.scale.x), y: r3(m.scale.y), z: r3(m.scale.z) }
    });
  });

  // ---- クリックで選択(ドラッグやギズモ操作は除く) ----
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, gizmo: gizmo.axis !== null || gizmo.dragging };
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || !editing) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    const wasGizmo = down.gizmo;
    down = null;
    if (moved || wasGizmo) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(editorGroup.children, false)[0];
    onPick(hit ? hit.object.userData.id : null);
  });

  // ---- 大きさ ----
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    scene, camera,

    /** 空の色(背景と霧)を反映 */
    applySettings(settings) {
      scene.background = new THREE.Color(settings.sky);
      scene.fog = new THREE.Fog(settings.sky, 45, 130);
      container.style.background = settings.sky;
    },

    /** プロジェクトの全オブジェクトのメッシュを作り直す */
    rebuild(project) {
      gizmo.detach();
      meshes.forEach(m => { editorGroup.remove(m); disposeMesh(m); });
      meshes.clear();
      project.objects.forEach(o => this.addObject(o));
    },
    addObject(o) {
      const m = createMesh(o);
      m.userData.id = o.id;
      editorGroup.add(m);
      meshes.set(o.id, m);
    },
    removeObject(id) {
      const m = meshes.get(id);
      if (!m) return;
      if (gizmo.object === m) gizmo.detach();
      editorGroup.remove(m);
      disposeMesh(m);
      meshes.delete(id);
    },
    updateObject(o) {
      const m = meshes.get(o.id);
      if (m) updateMesh(m, o);
    },

    /** ギズモと選択枠を付ける。null で外す */
    attach(id) {
      const m = id && editing ? meshes.get(id) : null;
      if (m) { gizmo.attach(m); selectionBox.setFromObject(m); selectionBox.visible = true; }
      else { gizmo.detach(); selectionBox.visible = false; }
    },

    setGizmoMode(mode) { gizmo.setMode(mode); },

    /** 中心(視点の注目点)。新しいオブジェクトを置く場所に使う */
    focusPoint() { return orbit.target.clone(); },

    /** 編集モードと再生モードの切り替え */
    setEditing(on) {
      editing = on;
      editorGroup.visible = on;
      orbit.enabled = on;
      if (!on) { gizmo.detach(); selectionBox.visible = false; }
    },
    saveCamera() { return { pos: camera.position.clone(), target: orbit.target.clone() }; },
    restoreCamera(saved, { syncOrbit = true } = {}) {
      if (!saved) return;
      camera.position.copy(saved.pos);
      if (syncOrbit) { orbit.target.copy(saved.target); orbit.update(); }
      else camera.lookAt(saved.target);
    },

    /** 編集中の毎フレームの更新 */
    updateEditor() {
      orbit.update();
      if (selectionBox.visible) selectionBox.update();
    },
    render() { renderer.render(scene, camera); }
  };
}
