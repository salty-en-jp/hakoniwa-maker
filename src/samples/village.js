// サンプル: はじまりの村(ADV + ターン制RPG)
// - 村人・長老・看板に E キーで話しかけられる(調べる・話す + 会話)
// - 森のスライムとまおうに触れるとコマンドバトル(ターン制バトル + HP)
// - 敵を全部倒すとクリア(全滅でクリア)

import { instantiate } from '../core/prefab.js';
import { obj, part, child, baseProject } from './helpers.js';

function housePrefab() {
  const walls = [3, 2, 3];
  const root = obj('n1', '家', 'box', '#e9dcc3', [0, 1, 0], walls, 'static');
  return {
    id: 'p1', name: '家', objects: [
      root,
      part('n2', '屋根', 'cone', '#b5533c', 'n1', walls, [0, 1.75, 0], [3.9, 1.5, 3.9]),
      part('n3', 'ドア', 'box', '#7a4b2a', 'n1', walls, [0, -0.4, 1.51], [0.7, 1.2, 0.05]),
      part('n4', '窓', 'box', '#9fd3ff', 'n1', walls, [0.85, 0.25, 1.51], [0.55, 0.55, 0.05])
    ]
  };
}

function treePrefab() {
  const trunk = [0.4, 1.6, 0.4];
  return {
    id: 'p2', name: '木', objects: [
      obj('n1', '木', 'cylinder', '#7a5233', [0, 0.8, 0], trunk, 'static'),
      part('n2', '葉', 'sphere', '#3f9b4b', 'n1', trunk, [0, 1.2, 0], [1.8, 1.6, 1.8])
    ]
  };
}

function slimePrefab() {
  const body = [1, 0.7, 1];
  const root = obj('n1', 'スライム', 'sphere', '#5fd38a', [0, 0.35, 0], body, 'trigger', [
    ['patrol', { axis: 'x', distance: 1.5, speed: 0.8 }],
    ['hp', { max: 2, invincible: 0 }],
    ['turnBattle', { attack: 1, playerAttack: 1 }],
    ['dieDestroy', { message: 'スライムを たおした!' }]
  ], { tag: 'monster' });
  return {
    id: 'p3', name: 'スライム', objects: [
      root,
      part('n2', '左目', 'sphere', '#1d2230', 'n1', body, [-0.18, 0.08, 0.42], [0.12, 0.16, 0.06]),
      part('n3', '右目', 'sphere', '#1d2230', 'n1', body, [0.18, 0.08, 0.42], [0.12, 0.16, 0.06])
    ]
  };
}

/** 話しかけられる人(体は固定なので、ぶつかって止まる) */
function villager(id, name, color, pos, lines) {
  const body = [0.7, 1.1, 0.7];
  return [
    obj(id, name, 'cylinder', color, pos, body, 'static', [['talk', { lines }]]),
    part(id + 'h', '頭', 'sphere', '#f5d3b3', id, body, [0, 0.8, 0], [0.55, 0.55, 0.55])
  ];
}

export function village() {
  const project = Object.assign(baseProject({ sky: '#bfe3ff' }), {
    prefabs: [housePrefab(), treePrefab(), slimePrefab()]
  });
  const [house, tree, slime] = project.prefabs;

  const bossBody = [1.6, 1.8, 1.2];
  project.objects.push(
    obj('o1', '地面', 'box', '#8cc56a', [0, -0.5, -4], [26, 1, 34], 'static'),
    obj('o2', '道', 'box', '#d8c39a', [0, 0.01, -4], [2.4, 0.02, 30], 'none'),
    obj('o3', 'プレイヤー', 'box', '#4f8cff', [0, 0.6, 9], [0.8, 1, 0.8], 'dynamic', [
      ['move', { speed: 5 }], ['camera', { distance: 9, height: 7 }],
      ['hp', { max: 8, invincible: 1, showHud: true }], ['dieLose', { message: '力尽きた…' }],
      ['interactor'], ['fall']
    ], { tag: 'player' }),

    ...villager('o10', '村人', '#5aa2ff', [-3, 0.55, 6],
      '村人: ようこそ、はじまりの村へ!\n村人: 矢印キーで歩いて、E キーで話しかけられるよ。\n村人: スマホなら「はなす」ボタン、会話は「ジャンプ / 決定」で送れるよ。'),
    ...villager('o11', '長老', '#9b6cff', [3, 0.55, 1],
      '長老: よくきたのう、旅の者よ。\n長老: 北の森に スライムと まおうが 住みついてしまったのじゃ。\n長老: ぜんぶ たおしてくれたら、村は平和になる。\n長老: 敵に ふれると バトルが はじまるぞ。たのんだぞ!'),
    obj('o12', '看板', 'box', '#a8794d', [1.8, 0.7, -7], [1.4, 0.8, 0.12], 'static', [['talk', {
      lines: '看板: ↑ この先 北の森\n看板: まおうは とても つよい。ピンクの ハートで 回復してから いどもう。'
    }]]),
    child('o12', 'o13', '看板の柱', 'cylinder', '#7a5233', [0, -0.7, 0], [0.08, 1.2, 1], 'none'),

    obj('o20', 'ハート1', 'sphere', '#ff7eb6', [-5, 0.6, -6], [0.6, 0.6, 0.6], 'trigger', [['healItem', { amount: 2 }]]),
    obj('o21', 'ハート2', 'sphere', '#ff7eb6', [5.5, 0.6, -14], [0.6, 0.6, 0.6], 'trigger', [['healItem', { amount: 2 }]]),

    obj('o30', 'まおう', 'box', '#6b3fa0', [0, 0.9, -18], bossBody, 'trigger', [
      ['hp', { max: 5, invincible: 0 }],
      ['turnBattle', { attack: 2, playerAttack: 2, escape: 0, intro: 'が たちはだかった!' }],
      ['dieDestroy', { message: 'まおうを たおした!' }]
    ], { tag: 'monster' }),
    part('o31', '左のつの', 'cone', '#f2efe8', 'o30', bossBody, [-0.45, 1.15, 0], [0.3, 0.6, 0.3]),
    part('o32', '右のつの', 'cone', '#f2efe8', 'o30', bossBody, [0.45, 1.15, 0], [0.3, 0.6, 0.3]),
    part('o33', '左目', 'sphere', '#ff4040', 'o30', bossBody, [-0.3, 0.4, 0.61], [0.2, 0.14, 0.06]),
    part('o34', '右目', 'sphere', '#ff4040', 'o30', bossBody, [0.3, 0.4, 0.61], [0.2, 0.14, 0.06]),

    obj('o40', 'ゲームの進行', 'empty', '#ffffff', [0, 0, 12], [1, 1, 1], 'none', [
      ['clearAll', { tag: 'monster', label: 'のこりの敵', message: '村に平和が もどった!' }]
    ])
  );

  project.objects.push(
    ...instantiate(project, house, { name: '家', pos: { x: -6.5, y: 1, z: 4 } }),
    ...instantiate(project, house, { name: '長老の家', pos: { x: 6.5, y: 1, z: 2 } }),
    ...instantiate(project, house, { name: '倉庫', pos: { x: -6.5, y: 1, z: -2 } }),
    ...instantiate(project, slime, { name: 'スライム', pos: { x: -4, y: 0.35, z: -10 } }),
    ...instantiate(project, slime, { name: 'スライム', pos: { x: 4, y: 0.35, z: -12 } }),
    ...instantiate(project, slime, { name: 'スライム', pos: { x: -3, y: 0.35, z: -15 } })
  );
  [[-10, 9], [10, 8], [-9, -8], [9, -6], [-8, -16], [8, -18], [-11, -1], [11, -12]].forEach(([x, z], i) => {
    project.objects.push(...instantiate(project, tree, { name: '木 ' + (i + 1), pos: { x, y: 0.8, z } }));
  });
  return project;
}
