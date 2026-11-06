// オブジェクトのデータから three.js の表示物を作る
//
// ふつうの形は Mesh。形が「空」のときは、
//   エディタ: 選んだり動かしたりできるよう、小さな八面体の線で表示する
//   再生中:   何も描かない Group(子をまとめるだけ)

import * as THREE from 'three';
import { DEG, isEmptyShape } from './defs.js';

const geometryCache = {};
const GEOMETRY = {
  box:      () => new THREE.BoxGeometry(1, 1, 1),
  sphere:   () => new THREE.SphereGeometry(0.5, 32, 16),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  cone:     () => new THREE.ConeGeometry(0.5, 1, 32),
  ring:     () => new THREE.TorusGeometry(0.36, 0.13, 16, 40),
  empty:    () => new THREE.OctahedronGeometry(0.3)
};

/** 形ごとのジオメトリ。同じ形は使い回す */
export function geometryFor(shape) {
  if (!geometryCache[shape]) {
    const g = (GEOMETRY[shape] || GEOMETRY.box)();
    g.computeBoundingBox();
    geometryCache[shape] = g;
  }
  return geometryCache[shape];
}

/** データの位置・回転(度)・大きさをメッシュに反映する(親から見た値) */
export function applyTransform(obj3d, o) {
  obj3d.position.set(o.pos.x, o.pos.y, o.pos.z);
  obj3d.rotation.set(o.rot.x * DEG, o.rot.y * DEG, o.rot.z * DEG);
  obj3d.scale.set(o.scale.x || 0.01, o.scale.y || 0.01, o.scale.z || 0.01);
}

/**
 * @param {object} o オブジェクトのデータ
 * @param {'editor'|'play'} mode
 */
export function createMesh(o, mode = 'play') {
  let obj3d;
  if (isEmptyShape(o.shape)) {
    obj3d = mode === 'editor'
      ? new THREE.Mesh(geometryFor('empty'), new THREE.MeshBasicMaterial({ color: 0xf4c542, wireframe: true, transparent: true, opacity: 0.8 }))
      : new THREE.Group();
  } else {
    obj3d = new THREE.Mesh(
      geometryFor(o.shape),
      new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.62, metalness: 0.05 })
    );
    obj3d.castShadow = obj3d.receiveShadow = true;
  }
  obj3d.userData.empty = isEmptyShape(o.shape);
  applyTransform(obj3d, o);
  return obj3d;
}

/** 形を変えるときに作り直しが要るか(空 ↔ ふつうの形) */
export const needsRebuild = (obj3d, o) => !!obj3d.userData.empty !== isEmptyShape(o.shape);

/** 形・色・トランスフォームをまとめて更新する(空 ↔ ふつうの形の切り替えは needsRebuild を見て作り直す) */
export function updateMesh(obj3d, o) {
  if (obj3d.isMesh && !obj3d.userData.empty) {
    obj3d.geometry = geometryFor(o.shape);
    obj3d.material.color.set(o.color);
  }
  applyTransform(obj3d, o);
}

export function disposeMesh(obj3d) {
  if (obj3d.material) obj3d.material.dispose(); // ジオメトリは共有なので捨てない
}
