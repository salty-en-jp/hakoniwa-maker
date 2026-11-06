// プレハブ: 親子でまとめたオブジェクトの「型」
//
// project.prefabs = [{ id, name, objects }]
//   objects は型の中身。id は型の中だけで通じる 'n1', 'n2'…、先頭が一番上の親(ルート)
//
// シーンに置いたもの(インスタンス)はふつうのオブジェクトのコピーで、次の印が付く
//   ルート: prefab = 型の id
//   全員:   prefabNode = 型の中での id
// インスタンスは自由に編集でき、「プレハブに反映」で型を上書きし、他のインスタンスにも配る
// インスタンスごとに違ってよいのは、ルートの名前・位置・回転・大きさ・親だけ

import { clone } from './defs.js';
import { subtree } from './tree.js';
import { nextObjectId } from './project.js';

export const findPrefab = (project, id) => (project.prefabs || []).find(p => p.id === id);
export const findPrefabByName = (project, name) => (project.prefabs || []).find(p => p.name === name);

/** そのオブジェクトが属するインスタンスのルート(なければ null) */
export function instanceRootOf(project, id) {
  let cur = project.objects.find(o => o.id === id);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    if (cur.prefab) return cur;
    seen.add(cur.id);
    cur = cur.parent ? project.objects.find(o => o.id === cur.parent) : null;
  }
  return null;
}

export const instancesOf = (project, prefabId) => project.objects.filter(o => o.prefab === prefabId);

/** シーンのサブツリー(ルートが先頭)から型の中身を作る */
export function definitionFromNodes(nodes) {
  const idMap = new Map(nodes.map((o, i) => [o.id, 'n' + (i + 1)]));
  return nodes.map((o, i) => {
    const c = clone(o);
    c.id = idMap.get(o.id);
    c.parent = i === 0 ? null : (idMap.get(o.parent) || null);
    delete c.prefab;
    delete c.prefabNode;
    if (i === 0) c.pos = { x: 0, y: 0, z: 0 };
    return c;
  });
}

/**
 * 型からシーン用のオブジェクトを作る(project には足さない)
 * @param {{ parent?: string|null, pos?: {x,y,z}, name?: string, keepRoot?: object }} opts
 *   keepRoot を渡すと、ルートはその id・名前・位置・回転・大きさ・親を引き継ぐ
 * @returns {object[]} ルートが先頭
 */
export function instantiate(project, prefab, opts = {}) {
  const idMap = new Map();
  prefab.objects.forEach(o => idMap.set(o.id, nextObjectId(project)));
  const out = prefab.objects.map((o, i) => {
    const c = clone(o);
    c.id = idMap.get(o.id);
    c.parent = i === 0 ? (opts.parent ?? null) : idMap.get(o.parent) || null;
    c.prefabNode = o.id;
    return c;
  });
  const root = out[0];
  root.prefab = prefab.id;
  root.name = opts.name || prefab.name;
  if (opts.pos) root.pos = clone(opts.pos);
  if (opts.keepRoot) {
    const k = opts.keepRoot;
    Object.assign(root, { id: k.id, name: k.name, pos: clone(k.pos), rot: clone(k.rot), scale: clone(k.scale), parent: k.parent ?? null });
    out.slice(1).forEach(c => { if (c.parent === idMap.get(prefab.objects[0].id)) c.parent = k.id; });
  }
  return out;
}

/** 型とインスタンスを比べるための文字列。ルートの名前・位置・回転・大きさと id は比べない */
export function signature(nodes) {
  const index = new Map(nodes.map((o, i) => [o.id, i]));
  return JSON.stringify(nodes.map((o, i) => ({
    p: i === 0 ? -1 : index.get(o.parent) ?? -1,
    shape: o.shape, color: o.color, tag: o.tag, body: o.body, behaviors: o.behaviors,
    ...(i === 0 ? {} : { name: o.name, pos: o.pos, rot: o.rot, scale: o.scale })
  })));
}

/** インスタンスが型と違っているか */
export function isModified(project, root) {
  const prefab = findPrefab(project, root.prefab);
  if (!prefab) return false;
  return signature(subtree(project.objects, root.id)) !== signature(prefab.objects);
}
