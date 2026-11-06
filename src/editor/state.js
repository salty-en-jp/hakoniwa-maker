// エディタの状態と、画面の各部分をつなぐ合図(イベント)
//
// 合図の一覧:
//   project-loaded     プロジェクトが丸ごと入れ替わった
//   selection-changed  選んでいるオブジェクトが変わった
//   objects-changed    オブジェクトの追加・削除・名前・タグ・ロジック数などが変わった
//   transform-changed  ギズモでオブジェクトが動いた
//   assets-changed     ロジックアセットが追加・削除・改名された
//   asset-open         ロジック タブで特定のアセットを開きたい (assetId)
//   tab-changed        パネルのタブが切り替わった (tab)
//   play-changed       再生と停止が切り替わった (playing)

import { findObject, findAsset } from '../core/project.js';

export const state = {
  project: null,
  selectedId: null,
  selectedAssetId: null,
  tab: 'inspect',
  playing: false
};

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, ...args) {
  const set = listeners.get(event);
  if (set) for (const fn of set) fn(...args);
}

export const selectedObject = () => (state.selectedId ? findObject(state.project, state.selectedId) : null);
export const selectedAsset = () => (state.selectedAssetId ? findAsset(state.project, state.selectedAssetId) : null);

export const isNarrow = () => matchMedia('(max-width:860px)').matches;
