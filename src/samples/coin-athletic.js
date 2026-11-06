// サンプル: コインを3枚集めてゴールの旗に触れるアスレチック
// - 敵に横から触れると HP が減り、上から踏むと倒せる(合図 damage / heal / died の見本)
// - ちびロボと風車はプレハブ(親子でまとめた型)の見本

import { makeObject as obj } from '../core/object.js';
import { clone } from '../core/defs.js';
import { instantiate } from '../core/prefab.js';
import { BUILTIN_ASSETS } from '../assets/builtin.js';

/**
 * 親の大きさを打ち消して、子の位置と大きさを「見た目どおりの値」で書けるようにする
 * (子の値は親から見た値なので、親が横に2倍なら子も横に2倍に見える)
 */
function part(id, name, shape, color, parent, parentScale, offset, size, behaviors = [], extra = {}) {
  const [sx, sy, sz] = parentScale;
  const o = obj(id, name, shape, color,
    [offset[0] / sx, offset[1] / sy, offset[2] / sz],
    [size[0] / sx, size[1] / sy, size[2] / sz], 'none', behaviors, extra);
  o.parent = parent;
  return o;
}

/** 敵のロボ。胴体が当たり判定とロジックを持ち、頭・目・アンテナは飾りの子 */
function robotPrefab() {
  const body = [0.9, 0.8, 0.7];
  const root = obj('n1', 'ちびロボ', 'box', '#8a93a6', [0, 0, 0], body, 'trigger', [
    ['patrol', { axis: 'z', distance: 2.2, speed: 1.1 }],
    ['contactDamage'],
    ['hp', { max: 2, invincible: 0.6 }],
    ['dieDestroy', { points: 0, message: 'ロボを倒した!' }]
  ], { tag: 'enemy' });
  root.pos.y = 0.4;
  return {
    id: 'p1', name: 'ちびロボ', objects: [
      root,
      part('n2', '頭', 'box', '#b3bccd', 'n1', body, [0, 0.67, 0], [0.62, 0.5, 0.56]),
      part('n3', '左目', 'sphere', '#6ff3ff', 'n1', body, [-0.15, 0.72, 0.28], [0.13, 0.13, 0.06]),
      part('n4', '右目', 'sphere', '#6ff3ff', 'n1', body, [0.15, 0.72, 0.28], [0.13, 0.13, 0.06]),
      part('n5', 'アンテナ', 'cylinder', '#5b6375', 'n1', body, [0, 1.05, 0], [0.05, 0.3, 0.05]),
      part('n6', 'アンテナの玉', 'sphere', '#ff5f5f', 'n1', body, [0, 1.25, 0], [0.13, 0.13, 0.13])
    ]
  };
}

/** 風車。ルートは「空」で、柱・屋根・回転軸をまとめる。羽根は回転軸の子なので一緒に回る */
function windmillPrefab() {
  const root = obj('n1', '風車', 'empty', '#ffffff', [0, 0, 0], [1, 1, 1], 'none');
  const pole = obj('n2', '柱', 'cylinder', '#d9d2c3', [0, 2, 0], [0.35, 4, 0.35], 'static');
  const roof = obj('n3', '屋根', 'cone', '#c0504d', [0, 4.25, 0], [0.75, 0.6, 0.75], 'none');
  const hub = obj('n4', '回転軸', 'empty', '#ffffff', [0, 3.8, 0.3], [1, 1, 1], 'none', [['spin', { speed: 0.25, axis: 'z' }]]);
  const blade1 = obj('n5', '羽根1', 'box', '#f2efe8', [0, 0, 0], [0.3, 3.2, 0.06], 'none');
  const blade2 = obj('n6', '羽根2', 'box', '#f2efe8', [0, 0, 0], [3.2, 0.3, 0.06], 'none');
  pole.parent = roof.parent = hub.parent = 'n1';
  blade1.parent = blade2.parent = 'n4';
  return { id: 'p2', name: '風車', objects: [root, pole, roof, hub, blade1, blade2] };
}

export function coinAthletic() {
  const project = {
    version: 1,
    seq: 100,
    removedBuiltins: [],
    settings: { sky: '#a9cbe6', gravity: 22 },
    assets: BUILTIN_ASSETS.map(a => Object.assign(clone(a), { builtin: true })),
    prefabs: [robotPrefab(), windmillPrefab()],
    objects: [
      obj('o1', '地面', 'box', '#7db564', [0, -0.5, 0], [14, 1, 14], 'static'),
      obj('o2', 'プレイヤー', 'box', '#4f8cff', [0, 0.6, 4], [0.8, 1, 0.8], 'dynamic',
        [['move'], ['camera'], ['fall'], ['hp', { max: 3, invincible: 1.2, showHud: true }], ['dieLose']], { tag: 'player' }),
      obj('o3', '足場A', 'box', '#c9a26b', [0, 0.75, -9], [3, 0.5, 3], 'static'),
      obj('o4', '動く足場', 'box', '#e2b35a', [0, 1.75, -13], [2.5, 0.5, 2.5], 'static', [['patrol', { axis: 'x', distance: 2.5, speed: 1.2 }]]),
      obj('o5', 'ゴール台', 'box', '#c9a26b', [0, 2.75, -17.5], [4, 0.5, 4], 'static'),
      obj('o6', 'ゴールの旗', 'cylinder', '#ff8a3d', [0, 4, -18.5], [0.6, 2, 0.6], 'trigger', [['goal'], ['spin', { speed: 0.3 }]]),
      obj('o7', 'コイン1', 'ring', '#ffd23f', [-4, 1, 1], [1, 1, 1], 'trigger', [['spin'], ['pickup']]),
      obj('o8', 'コイン2', 'ring', '#ffd23f', [4, 1, -2], [1, 1, 1], 'trigger', [['spin'], ['pickup']]),
      obj('o9', 'コイン3', 'ring', '#ffd23f', [0, 2, -9], [1, 1, 1], 'trigger', [['spin'], ['pickup']]),
      obj('o10', '空のコイン', 'ring', '#ffd23f', [5, 5, 4], [1, 1, 1], 'trigger', [['spin', { speed: 1 }], ['pickup']]),
      obj('o11', 'ジャンプ台', 'cylinder', '#b06cff', [5, 0.1, 4], [1.4, 0.2, 1.4], 'static', [['bounce']]),
      obj('o12', '敵', 'sphere', '#e5484d', [-1, 0.45, -3], [0.9, 0.9, 0.9], 'trigger',
        [['patrol', { axis: 'x', distance: 4, speed: 1.5 }], ['contactDamage'], ['hp', { max: 1, invincible: 0 }], ['dieDestroy']], { tag: 'enemy' }),
      obj('o14', '回復ハート', 'sphere', '#ff7eb6', [-5.5, 0.6, 2], [0.6, 0.6, 0.6], 'trigger', [['healItem']])
    ]
  };
  const [robot, windmill] = project.prefabs;
  project.objects.push(
    ...instantiate(project, robot, { name: 'ちびロボ', pos: { x: 4.5, y: 0.4, z: -4 } }),
    ...instantiate(project, robot, { name: 'ちびロボ 2', pos: { x: -4.5, y: 0.4, z: -4.5 } }),
    ...instantiate(project, windmill, { name: '風車', pos: { x: -5, y: 0, z: 5 } })
  );
  return project;
}
