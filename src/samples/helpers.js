// サンプルづくりの道具

import { makeObject } from '../core/object.js';
import { clone } from '../core/defs.js';
import { BUILTIN_ASSETS } from '../assets/builtin.js';

export const obj = makeObject;

/** 組み込みアセットをすべて入れた配列 */
export const builtinAssets = () => BUILTIN_ASSETS.map(a => Object.assign(clone(a), { builtin: true }));

/** 親を指定してオブジェクトを作る */
export function child(parent, ...args) {
  const o = makeObject(...args);
  o.parent = parent;
  return o;
}

/**
 * 親の大きさを打ち消して、子の位置と大きさを「見た目どおりの値」で書けるようにする
 * (子の値は親から見た値なので、親が横に2倍なら子も横に2倍に見える)
 */
export function part(id, name, shape, color, parent, parentScale, offset, size, behaviors = [], extra = {}) {
  const [sx, sy, sz] = parentScale;
  const o = makeObject(id, name, shape, color,
    [offset[0] / sx, offset[1] / sy, offset[2] / sz],
    [size[0] / sx, size[1] / sy, size[2] / sz], 'none', behaviors, extra);
  o.parent = parent;
  return o;
}

/** 新しいプロジェクトの骨組み */
export function baseProject({ sky = '#a9cbe6', gravity = 22 } = {}) {
  return {
    version: 1,
    seq: 100,
    removedBuiltins: [],
    settings: { sky, gravity },
    assets: builtinAssets(),
    prefabs: [],
    objects: []
  };
}
