// オブジェクトのデータから three.js のメッシュを作る

import * as THREE from 'three';
import { DEG } from './defs.js';

const geometryCache = {};
const GEOMETRY = {
  box:      () => new THREE.BoxGeometry(1, 1, 1),
  sphere:   () => new THREE.SphereGeometry(0.5, 32, 16),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  cone:     () => new THREE.ConeGeometry(0.5, 1, 32),
  ring:     () => new THREE.TorusGeometry(0.36, 0.13, 16, 40)
};

/** 形ごとのジオメトリ。同じ形は使い回す */
export function geometryFor(shape) {
  if (!geometryCache[shape]) geometryCache[shape] = (GEOMETRY[shape] || GEOMETRY.box)();
  return geometryCache[shape];
}

/** データの位置・回転(度)・大きさをメッシュに反映する */
export function applyTransform(mesh, o) {
  mesh.position.set(o.pos.x, o.pos.y, o.pos.z);
  mesh.rotation.set(o.rot.x * DEG, o.rot.y * DEG, o.rot.z * DEG);
  mesh.scale.set(o.scale.x || 0.01, o.scale.y || 0.01, o.scale.z || 0.01);
}

export function createMesh(o) {
  const mesh = new THREE.Mesh(
    geometryFor(o.shape),
    new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.62, metalness: 0.05 })
  );
  mesh.castShadow = mesh.receiveShadow = true;
  applyTransform(mesh, o);
  return mesh;
}

/** 形・色・トランスフォームをまとめて更新する */
export function updateMesh(mesh, o) {
  mesh.geometry = geometryFor(o.shape);
  mesh.material.color.set(o.color);
  applyTransform(mesh, o);
}

export function disposeMesh(mesh) {
  mesh.material.dispose(); // ジオメトリは共有なので捨てない
}
