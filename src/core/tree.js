// 親子関係の道具。オブジェクトは平らな配列のまま持ち、各オブジェクトの parent に親の id を入れる
// 位置・回転・大きさは親から見た値(ローカル)。親が動くと子も一緒に動く

const byId = (objects, id) => objects.find(o => o.id === id);

export const childrenOf = (objects, id) => objects.filter(o => o.parent === id);

/** そのオブジェクトと子孫を、親が先になる順(深さ優先)で返す */
export function subtree(objects, rootId) {
  const out = [];
  const walk = id => {
    const o = byId(objects, id);
    if (!o) return;
    out.push(o);
    for (const c of objects) if (c.parent === id) walk(c.id);
  };
  walk(rootId);
  return out;
}

/** id が ancestorId 自身か、その子孫か */
export function isInSubtree(objects, id, ancestorId) {
  let cur = byId(objects, id);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    if (cur.id === ancestorId) return true;
    seen.add(cur.id);
    cur = cur.parent ? byId(objects, cur.parent) : null;
  }
  return false;
}

/** 一番上の親(ルート)たち */
export const rootsOf = objects => objects.filter(o => !o.parent || !byId(objects, o.parent));

/** 一覧表示用: ツリーの順に並べ、深さを付ける */
export function treeOrder(objects) {
  const out = [];
  const walk = (o, depth) => {
    out.push({ obj: o, depth });
    for (const c of objects) if (c.parent === o.id) walk(c, depth + 1);
  };
  rootsOf(objects).forEach(o => walk(o, 0));
  return out;
}

/** 壊れた親子関係(存在しない親、自分が自分の祖先になる輪)を直す */
export function repairParents(objects) {
  for (const o of objects) {
    if (!o.parent) { o.parent = null; continue; }
    if (!byId(objects, o.parent)) { o.parent = null; continue; }
    // 輪になっていないか、親をたどって確かめる
    const seen = new Set([o.id]);
    let cur = byId(objects, o.parent);
    while (cur) {
      if (seen.has(cur.id)) { o.parent = null; break; }
      seen.add(cur.id);
      cur = cur.parent ? byId(objects, cur.parent) : null;
    }
  }
}
