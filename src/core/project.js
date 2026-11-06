// プロジェクト(シーン + アセット)のデータ形式、検証、保存

import { SHAPES, BODIES } from './defs.js';

export const STORAGE_KEY = 'hakoniwa-maker-v1';

export const DEFAULT_SETTINGS = { sky: '#a9cbe6', gravity: 22 };

/** 読み込んだデータの足りない項目を埋め、おかしな値を直す */
export function normalizeProject(p) {
  p.settings = Object.assign({}, DEFAULT_SETTINGS, p.settings || {});
  p.seq = p.seq || 1000;
  p.assets.forEach(a => {
    a.params = Array.isArray(a.params) ? a.params : [];
    a.code = a.code || '';
    a.name = a.name || 'ロジック';
    a.desc = a.desc || '';
  });
  p.objects.forEach(o => {
    o.name = o.name || 'オブジェクト';
    o.tag = o.tag || '';
    o.shape = SHAPES[o.shape] ? o.shape : 'box';
    o.color = o.color || '#cccccc';
    o.pos = o.pos || { x: 0, y: 0, z: 0 };
    o.rot = o.rot || { x: 0, y: 0, z: 0 };
    o.scale = o.scale || { x: 1, y: 1, z: 1 };
    o.body = BODIES[o.body] ? o.body : 'static';
    o.behaviors = (o.behaviors || []).map(b => ({ asset: b.asset, params: b.params || {} }));
  });
  return p;
}

export const isValidProject = p =>
  !!p && typeof p === 'object' && Array.isArray(p.objects) && Array.isArray(p.assets);

/** JSON 文字列からプロジェクトを作る。形が違えば例外を投げる */
export function parseProject(text) {
  const p = JSON.parse(text);
  if (!isValidProject(p)) throw new Error('objects と assets がありません');
  return normalizeProject(p);
}

/** ブラウザに保存されたプロジェクト。なければ null */
export function loadSavedProject() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    return parseProject(s);
  } catch (e) {
    return null;
  }
}

let saveTimer;
/** 少し待ってからまとめて保存する */
export function saveProject(p) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { /* 保存できない環境では何もしない */ }
  }, 300);
}

export const findObject = (p, id) => p.objects.find(o => o.id === id);
export const findAsset = (p, id) => p.assets.find(a => a.id === id);
export const nextObjectId = p => 'o' + (++p.seq);

/** そのアセットが何か所で使われているか */
export const countAssetUsage = (p, assetId) =>
  p.objects.reduce((n, o) => n + o.behaviors.filter(b => b.asset === assetId).length, 0);
