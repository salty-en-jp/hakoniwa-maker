// エディタの操作。データを変え、3Dの舞台に反映し、保存し、合図を出す
// 画面の各パネルはここを呼び、ここが出す合図を聞いて描き直す

import { SHAPES, PALETTE, clone, r3, isEmptyShape } from '../core/defs.js';
import { makeObject } from '../core/object.js';
import { findObject, nextObjectId, saveProject } from '../core/project.js';
import { subtree, isInSubtree } from '../core/tree.js';
import { findPrefab, instancesOf, definitionFromNodes, instantiate } from '../core/prefab.js';
import { addMissingBuiltins } from '../assets/builtin.js';
import { state, emit } from './state.js';

let viewport = null;

/** 起動時に一度だけ呼ぶ */
export function initActions(vp) { viewport = vp; }

export const save = () => saveProject(state.project);

/**
 * オブジェクトを選ぶ。null で選択解除
 * @param {{ fromView?: boolean, fromList?: boolean }} opts どこから選ばれたか(タブの自動切り替えに使う)
 */
export function select(id, opts = {}) {
  state.selectedId = id && findObject(state.project, id) ? id : null;
  if (!state.playing) viewport.attach(state.selectedId);
  emit('selection-changed', opts);
}

/** プロジェクトを丸ごと入れ替える */
export function loadProject(project) {
  addMissingBuiltins(project);
  state.project = project;
  state.selectedId = null;
  state.selectedAssetId = project.assets[0] ? project.assets[0].id : null;
  viewport.applySettings(project.settings);
  viewport.rebuild(project);
  save();
  emit('project-loaded');
  select(null);
}

/** オブジェクトの配列をシーンに足す(親が先に並んでいること) */
function addNodes(nodes) {
  for (const o of nodes) {
    state.project.objects.push(o);
    viewport.addObject(o);
  }
}

/** オブジェクトをシーンから消す(子孫は呼び出し側で含めること) */
function removeNodes(nodes) {
  const ids = new Set(nodes.map(o => o.id));
  // 子から先に消す
  [...nodes].reverse().forEach(o => viewport.removeObject(o.id));
  state.project.objects = state.project.objects.filter(o => !ids.has(o.id));
}

/**
 * 形を指定して新しいオブジェクトを置く
 * 親を指定しないときは視点の中心あたりに、指定したときは親の真上あたりに置く
 */
export function addObject(shape, parentId = null) {
  if (state.playing) return;
  const p = state.project;
  const n = p.objects.filter(o => o.shape === shape).length + 1;
  let pos;
  if (parentId) pos = [0, 1, 0];
  else {
    const at = viewport.focusPoint();
    pos = [Math.round(at.x * 2) / 2, shape === 'ring' ? 1 : isEmptyShape(shape) ? 0 : 0.5, Math.round(at.z * 2) / 2];
  }
  const body = isEmptyShape(shape) ? 'none' : shape === 'ring' ? 'trigger' : parentId ? 'none' : 'static';
  const o = makeObject(nextObjectId(p), `${SHAPES[shape].label} ${n}`, shape, PALETTE[p.seq % PALETTE.length], pos, [1, 1, 1], body);
  o.parent = parentId && findObject(p, parentId) ? parentId : null;
  addNodes([o]);
  save();
  emit('objects-changed');
  select(o.id);
  showTab('inspect');
}

/** 子孫ごと複製する */
export function duplicateObject(id) {
  const src = findObject(state.project, id);
  if (!src || state.playing) return;
  const nodes = subtree(state.project.objects, id);
  const idMap = new Map(nodes.map(o => [o.id, nextObjectId(state.project)]));
  const copies = nodes.map((o, i) => {
    const c = clone(o);
    c.id = idMap.get(o.id);
    c.parent = i === 0 ? o.parent : idMap.get(o.parent);
    return c;
  });
  copies[0].name = src.name + ' のコピー';
  copies[0].pos.x = r3(copies[0].pos.x + 1);
  addNodes(copies);
  save();
  emit('objects-changed');
  select(copies[0].id);
}

/** 子孫ごと消す */
export function removeObject(id) {
  if (state.playing || !findObject(state.project, id)) return;
  removeNodes(subtree(state.project.objects, id));
  save();
  emit('objects-changed');
  select(null);
}

/** 子孫の数(自分は含まない) */
export const descendantCount = id => subtree(state.project.objects, id).length - 1;

/** 親を付け替える。見た目の位置はそのまま */
export function setParent(id, parentId) {
  const p = state.project;
  const o = findObject(p, id);
  if (!o || state.playing) return;
  parentId = parentId || null;
  if (parentId && (!findObject(p, parentId) || isInSubtree(p.objects, parentId, id))) return; // 自分の子孫は親にできない
  const t = viewport.reparent(id, parentId);
  o.parent = parentId;
  if (t) Object.assign(o, t);
  save();
  emit('objects-changed');
  emit('selection-changed', {});
}

/** 見た目(形・色・トランスフォーム)を変えたあとに呼ぶ */
export function objectVisualChanged(o) {
  viewport.updateObject(o);
  save();
}

/** ギズモで動かしたとき */
export function setTransform(id, t) {
  const o = findObject(state.project, id);
  if (!o) return;
  Object.assign(o, t);
  save();
  emit('transform-changed', o);
}

export function setSettings(patch) {
  Object.assign(state.project.settings, patch);
  viewport.applySettings(state.project.settings);
  save();
}

export function setGizmoMode(mode) { viewport.setGizmoMode(mode); }

export function showTab(tab) {
  state.tab = tab;
  emit('tab-changed', tab);
}

/** ロジック タブでアセットを開く */
export function openAsset(assetId) {
  state.selectedAssetId = assetId;
  showTab('assets');
  emit('asset-open', assetId);
}

// ---------------- プレハブ ----------------

function prefabsChanged() {
  save();
  emit('prefabs-changed');
  emit('objects-changed');
  emit('selection-changed', {});
}

/** 選んだオブジェクトと子孫から、新しいプレハブを作る。元のものはそのインスタンスになる */
export function makePrefab(rootId) {
  const p = state.project;
  const root = findObject(p, rootId);
  if (!root || state.playing) return;
  const nodes = subtree(p.objects, rootId);
  nodes.forEach(o => { delete o.prefab; delete o.prefabNode; }); // 中に別のプレハブがあれば、その印は外す
  const def = { id: 'p' + (++p.seq), name: root.name, objects: definitionFromNodes(nodes) };
  def.objects[0].rot = clone(root.rot);
  def.objects[0].scale = clone(root.scale);
  root.prefab = def.id;
  nodes.forEach((o, i) => { o.prefabNode = def.objects[i].id; });
  p.prefabs.push(def);
  prefabsChanged();
}

/** プレハブをシーンに置く */
export function placePrefab(prefabId) {
  const p = state.project;
  const def = findPrefab(p, prefabId);
  if (!def || state.playing) return;
  const at = viewport.focusPoint();
  const count = instancesOf(p, prefabId).length;
  const nodes = instantiate(p, def, {
    name: count ? `${def.name} ${count + 1}` : def.name,
    pos: { x: Math.round(at.x * 2) / 2, y: def.objects[0].pos.y || 0, z: Math.round(at.z * 2) / 2 }
  });
  addNodes(nodes);
  save();
  emit('objects-changed');
  emit('prefabs-changed');
  select(nodes[0].id);
  showTab('inspect');
}

/** インスタンスの中身を型に合わせる。ルートの名前・位置・回転・大きさ・親は残す */
function replaceInstance(root, def) {
  const old = subtree(state.project.objects, root.id);
  removeNodes(old.slice(1));
  const nodes = instantiate(state.project, def, { keepRoot: root });
  // ルートは同じ id のまま中身だけ入れ替える
  const r = nodes[0];
  Object.assign(root, { shape: r.shape, color: r.color, tag: r.tag, body: r.body, behaviors: r.behaviors, prefab: def.id, prefabNode: r.prefabNode });
  viewport.updateObject(root);
  addNodes(nodes.slice(1));
}

/** このインスタンスの今の形で型を上書きし、他のインスタンスにも配る */
export function applyToPrefab(rootId) {
  const p = state.project;
  const root = findObject(p, rootId);
  const def = root && findPrefab(p, root.prefab);
  if (!def || state.playing) return;
  const nodes = subtree(p.objects, rootId);
  const fresh = definitionFromNodes(nodes);
  fresh[0].pos = { x: 0, y: def.objects[0].pos.y || 0, z: 0 };
  fresh[0].name = def.name; // インスタンスの名前は型に持ち込まない
  def.objects = fresh;
  nodes.forEach((o, i) => { o.prefabNode = fresh[i].id; });
  instancesOf(p, def.id).filter(o => o.id !== rootId).forEach(other => replaceInstance(other, def));
  if (state.selectedId && !findObject(p, state.selectedId)) state.selectedId = null;
  viewport.attach(state.selectedId);
  prefabsChanged();
}

/** このインスタンスを型どおりに戻す */
export function revertInstance(rootId) {
  const p = state.project;
  const root = findObject(p, rootId);
  const def = root && findPrefab(p, root.prefab);
  if (!def || state.playing) return;
  const keepSelection = state.selectedId === rootId;
  replaceInstance(root, def);
  state.selectedId = keepSelection || findObject(p, state.selectedId) ? state.selectedId : rootId;
  viewport.attach(state.selectedId);
  prefabsChanged();
}

/** プレハブとのつながりを切って、ふつうのオブジェクトにする */
export function unpackInstance(rootId) {
  const p = state.project;
  if (!findObject(p, rootId)) return;
  subtree(p.objects, rootId).forEach(o => { delete o.prefab; delete o.prefabNode; });
  prefabsChanged();
}

export function renamePrefab(prefabId, name) {
  const def = findPrefab(state.project, prefabId);
  if (!def) return;
  def.name = name;
  save(); // 入力中の欄を描き直さないよう、ここでは合図を出さない
}

/** プレハブを消す。置いてあるものは残し、つながりだけ切る */
export function deletePrefab(prefabId) {
  const p = state.project;
  instancesOf(p, prefabId).forEach(root => subtree(p.objects, root.id).forEach(o => { delete o.prefab; delete o.prefabNode; }));
  p.prefabs = p.prefabs.filter(f => f.id !== prefabId);
  prefabsChanged();
}
