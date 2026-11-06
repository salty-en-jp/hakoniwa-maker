// エディタの操作。データを変え、3Dの舞台に反映し、保存し、合図を出す
// 画面の各パネルはここを呼び、ここが出す合図を聞いて描き直す

import { SHAPES, PALETTE, clone, r3 } from '../core/defs.js';
import { makeObject } from '../core/object.js';
import { findObject, nextObjectId, saveProject } from '../core/project.js';
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

/** 形を指定して、視点の中心あたりに新しいオブジェクトを置く */
export function addObject(shape) {
  if (state.playing) return;
  const p = state.project;
  const n = p.objects.filter(o => o.shape === shape).length + 1;
  const at = viewport.focusPoint();
  const o = makeObject(
    nextObjectId(p), `${SHAPES[shape].label} ${n}`, shape, PALETTE[p.seq % PALETTE.length],
    [Math.round(at.x * 2) / 2, shape === 'ring' ? 1 : 0.5, Math.round(at.z * 2) / 2],
    [1, 1, 1], shape === 'ring' ? 'trigger' : 'static'
  );
  p.objects.push(o);
  viewport.addObject(o);
  save();
  emit('objects-changed');
  select(o.id);
  showTab('inspect');
}

export function duplicateObject(id) {
  const src = findObject(state.project, id);
  if (!src || state.playing) return;
  const o = clone(src);
  o.id = nextObjectId(state.project);
  o.name = src.name + ' のコピー';
  o.pos.x = r3(o.pos.x + 1);
  state.project.objects.push(o);
  viewport.addObject(o);
  save();
  emit('objects-changed');
  select(o.id);
}

export function removeObject(id) {
  if (state.playing) return;
  viewport.removeObject(id);
  state.project.objects = state.project.objects.filter(o => o.id !== id);
  save();
  emit('objects-changed');
  select(null);
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
