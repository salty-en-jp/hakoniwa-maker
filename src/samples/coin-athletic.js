// サンプル: コインを3枚集めてゴールの旗に触れるアスレチック

import { makeObject as obj } from '../core/object.js';
import { clone } from '../core/defs.js';
import { BUILTIN_ASSETS } from '../assets/builtin.js';

export function coinAthletic() {
  return {
    version: 1,
    seq: 100,
    settings: { sky: '#a9cbe6', gravity: 22 },
    assets: BUILTIN_ASSETS.map(a => Object.assign(clone(a), { builtin: true })),
    objects: [
      obj('o1', '地面', 'box', '#7db564', [0, -0.5, 0], [14, 1, 14], 'static'),
      obj('o2', 'プレイヤー', 'box', '#4f8cff', [0, 0.6, 4], [0.8, 1, 0.8], 'dynamic', [['move'], ['camera'], ['fall']], { tag: 'player' }),
      obj('o3', '足場A', 'box', '#c9a26b', [0, 0.75, -9], [3, 0.5, 3], 'static'),
      obj('o4', '動く足場', 'box', '#e2b35a', [0, 1.75, -13], [2.5, 0.5, 2.5], 'static', [['patrol', { axis: 'x', distance: 2.5, speed: 1.2 }]]),
      obj('o5', 'ゴール台', 'box', '#c9a26b', [0, 2.75, -17.5], [4, 0.5, 4], 'static'),
      obj('o6', 'ゴールの旗', 'cylinder', '#ff8a3d', [0, 4, -18.5], [0.6, 2, 0.6], 'trigger', [['goal'], ['spin', { speed: 0.3 }]]),
      obj('o7', 'コイン1', 'ring', '#ffd23f', [-4, 1, 1], [1, 1, 1], 'trigger', [['spin'], ['pickup']]),
      obj('o8', 'コイン2', 'ring', '#ffd23f', [4, 1, -2], [1, 1, 1], 'trigger', [['spin'], ['pickup']]),
      obj('o9', 'コイン3', 'ring', '#ffd23f', [0, 2, -9], [1, 1, 1], 'trigger', [['spin'], ['pickup']]),
      obj('o10', '空のコイン', 'ring', '#ffd23f', [5, 5, 4], [1, 1, 1], 'trigger', [['spin', { speed: 1 }], ['pickup']]),
      obj('o11', 'ジャンプ台', 'cylinder', '#b06cff', [5, 0.1, 4], [1.4, 0.2, 1.4], 'static', [['bounce']]),
      obj('o12', '敵', 'sphere', '#e5484d', [-1, 0.45, -3], [0.9, 0.9, 0.9], 'trigger', [['patrol', { axis: 'x', distance: 4, speed: 1.5 }], ['hazard']])
    ]
  };
}
