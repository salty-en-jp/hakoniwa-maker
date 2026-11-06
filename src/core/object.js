// シーンに置くオブジェクトのデータを作る

/**
 * @param {string} id
 * @param {string} name
 * @param {string} shape  SHAPES のキー
 * @param {string} color  '#rrggbb'
 * @param {number[]} pos   [x, y, z]
 * @param {number[]} scale [x, y, z]
 * @param {string} body   BODIES のキー
 * @param {Array<[string, object?]>} behaviors [アセットID, パラメータ] の並び
 * @param {object} extra  tag など、上書きしたい項目
 */
export function makeObject(id, name, shape, color, pos, scale, body, behaviors = [], extra = {}) {
  return Object.assign({
    id, name, tag: '', shape, color,
    pos: { x: pos[0], y: pos[1], z: pos[2] },
    rot: { x: 0, y: 0, z: 0 },
    scale: { x: scale[0], y: scale[1], z: scale[2] },
    body,
    behaviors: behaviors.map(([asset, params]) => ({ asset, params: params || {} }))
  }, extra);
}
