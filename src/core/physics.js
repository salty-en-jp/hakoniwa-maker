// 簡易物理: 重力、回転しない箱どうしの押し戻し、動く床、接触の検出
// エンティティは runtime.js の spawn が作るもの
//   { body, mesh, parent, velocity, grounded, ground, prevWorld, dead }
//
// 親子について:
// - 当たり判定は、そのオブジェクト自身の形だけで取る(子は子で別に判定する)
// - 子は親にくっついて動くので、「動く」でも重力では落ちない
// - 形が「空」のものは当たり判定を持たない

import * as THREE from 'three';

const tmp = new THREE.Vector3();
const boxA = new THREE.Box3();
const boxB = new THREE.Box3();

/** 当たり判定を持つか */
export const hasShape = e => !e.dead && e.body !== 'none' && e.mesh.isMesh && !!e.mesh.geometry;

/** そのオブジェクト自身の形を囲む、ワールド座標の箱 */
export function boxOf(e, out) {
  e.mesh.updateWorldMatrix(true, false);
  const g = e.mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  return out.copy(g.boundingBox).applyMatrix4(e.mesh.matrixWorld);
}

/** ワールド座標での位置 */
export const worldPos = (e, out) => e.mesh.getWorldPosition(out);

const overlap = (a, b, eps) =>
  a.max.x > b.min.x + eps && a.min.x < b.max.x - eps &&
  a.max.y > b.min.y + eps && a.min.y < b.max.y - eps &&
  a.max.z > b.min.z + eps && a.min.z < b.max.z - eps;

/** 「動く」エンティティを重力と速度で動かし、固定・動くものから押し戻す */
export function stepPhysics(ents, gravity, dt) {
  const solids = ents.filter(e => hasShape(e) && (e.body === 'static' || e.body === 'dynamic'));
  for (const d of ents) {
    if (d.dead || d.body !== 'dynamic' || d.parent || !hasShape(d)) continue;

    // 乗っている床が動いた分だけ一緒に運ぶ
    if (d.ground && !d.ground.dead) d.mesh.position.add(worldPos(d.ground, tmp).sub(d.ground.prevWorld));

    d.velocity.y = Math.max(d.velocity.y - gravity * dt, -40);
    d.grounded = false;
    d.ground = null;

    // 軸ごとに動かして、めり込んだら戻す
    for (const axis of ['x', 'y', 'z']) {
      const delta = d.velocity[axis] * dt;
      if (!delta) continue;
      d.mesh.position[axis] += delta;
      for (const s of solids) {
        if (s === d) continue;
        boxOf(d, boxA); boxOf(s, boxB);
        if (!overlap(boxA, boxB, 1e-4)) continue;
        if (delta > 0) {
          d.mesh.position[axis] -= boxA.max[axis] - boxB.min[axis];
        } else {
          d.mesh.position[axis] += boxB.max[axis] - boxA.min[axis];
          if (axis === 'y') { d.grounded = true; d.ground = s; }
        }
        d.velocity[axis] = 0;
      }
    }
  }
}

/**
 * 触れ合っている組を調べ、新しく触れた組だけを返す
 * 同じ親子の中どうし(先祖と子孫)は判定しない
 * @param {Set<string>} prevContacts 前のフレームの組
 * @returns {{ contacts: Set<string>, entered: Array<[object, object]> }}
 */
export function detectContacts(ents, prevContacts) {
  const live = ents.filter(hasShape);
  const boxes = live.map(e => boxOf(e, new THREE.Box3()).expandByScalar(0.02));
  const contacts = new Set();
  const entered = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.body === 'static' && b.body === 'static') continue;
      if (isRelated(a, b)) continue;
      if (!boxes[i].intersectsBox(boxes[j])) continue;
      const key = a.uid + ':' + b.uid;
      contacts.add(key);
      if (!prevContacts.has(key)) entered.push([a, b]);
    }
  }
  return { contacts, entered };
}

function isRelated(a, b) {
  for (let p = a.parent; p; p = p.parent) if (p === b) return true;
  for (let p = b.parent; p; p = p.parent) if (p === a) return true;
  return false;
}
