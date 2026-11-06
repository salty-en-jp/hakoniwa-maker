// サンプル: おばけアリーナ(シューター / サバイバル)
// - 四すみの出現装置から、おばけが次々にわいて追いかけてくる(出現装置 + 追いかける)
// - J キーで弾、K キーでホーミングミサイル(弾を撃つ + まっすぐ飛ぶ / 追いかける + 時間で消える)
// - 45 秒生き残ればクリア(制限時間)
// - 最初の説明は、このサンプル専用に書いた「待てるスクリプト」のロジック

import { instantiate } from '../core/prefab.js';
import { obj, part, child, baseProject } from './helpers.js';

const INTRO_ASSET = {
  id: 'arenaIntro',
  name: 'アリーナの説明',
  desc: '始まったときに世界を止めて説明を出す(await の見本)',
  params: [],
  code: `// async にすると、await で「待ちながら」上から順に書ける
return {
  async start() {
    game.pause();
    await game.ui.say('アリーナ', 'おばけが わいてくる! 45 秒 生きのびよう。');
    await game.ui.say('アリーナ', 'J キーで たま、K キーで ホーミングミサイル。\\nスマホは「うつ」「ミサイル」ボタン。');
    const pick = await game.ui.choose(['はじめる', 'もう少し説明して'], 'じゅんびは いい?');
    if (pick === 1) {
      await game.ui.say('アリーナ', 'おばけに ふれると HP が へる。たまは 1、ミサイルは 2 ダメージ。');
      await game.ui.say('アリーナ', 'ミサイルは いちばん近い おばけを 追いかけるよ。');
    }
    game.resume();
    game.message('スタート!', 1.2);
  }
};`
};

function ghostPrefab() {
  const s = [0.9, 0.9, 0.9];
  return {
    id: 'p1', name: 'おばけ', objects: [
      obj('n1', 'おばけ', 'sphere', '#b48cff', [0, 0.5, 0], s, 'trigger', [
        ['chase', { target: 'player', speed: 2.2 }],
        ['contactDamage', { stompable: false, knockback: 4 }],
        ['hp', { max: 2, invincible: 0.15 }],
        ['dieDestroy', { points: 1, message: '' }]
      ], { tag: 'enemy' }),
      part('n2', '左目', 'sphere', '#ffffff', 'n1', s, [-0.17, 0.1, 0.4], [0.18, 0.22, 0.08]),
      part('n3', '右目', 'sphere', '#ffffff', 'n1', s, [0.17, 0.1, 0.4], [0.18, 0.22, 0.08])
    ]
  };
}

function bulletPrefab() {
  return {
    id: 'p2', name: 'たま', objects: [
      obj('n1', 'たま', 'sphere', '#ffe066', [0, 0, 0], [0.28, 0.28, 0.28], 'trigger', [
        ['projectile', { speed: 16 }],
        ['lifetime', { seconds: 0.9 }],
        ['contactDamage', { target: 'enemy', stompable: false, knockback: 0, destroySelf: true }]
      ])
    ]
  };
}

function missilePrefab() {
  const s = [0.32, 0.32, 0.32];
  const nose = part('n2', '先端', 'cone', '#f2efe8', 'n1', s, [0, 0, 0.22], [0.3, 0.45, 0.3]);
  nose.rot.x = 90; // 円錐の先を進む向き(+z)へ
  return {
    id: 'p3', name: 'ミサイル', objects: [
      obj('n1', 'ミサイル', 'sphere', '#ff8a3d', [0, 0, 0], s, 'trigger', [
        ['chase', { target: 'enemy', speed: 9, range: 40 }],
        ['lifetime', { seconds: 3 }],
        ['contactDamage', { target: 'enemy', amount: 2, stompable: false, knockback: 0, destroySelf: true }]
      ]),
      nose
    ]
  };
}

export function arena() {
  const project = Object.assign(baseProject({ sky: '#1f2433' }), {
    prefabs: [ghostPrefab(), bulletPrefab(), missilePrefab()]
  });
  project.assets.push(INTRO_ASSET);
  const wall = '#596079';
  const playerBody = [0.8, 1, 0.8];
  project.objects.push(
    obj('o1', '床', 'box', '#3b4256', [0, -0.5, 0], [22, 1, 22], 'static'),
    obj('o2', '北の壁', 'box', wall, [0, 0.6, -11], [22.6, 1.2, 0.6], 'static'),
    obj('o3', '南の壁', 'box', wall, [0, 0.6, 11], [22.6, 1.2, 0.6], 'static'),
    obj('o4', '西の壁', 'box', wall, [-11, 0.6, 0], [0.6, 1.2, 22.6], 'static'),
    obj('o5', '東の壁', 'box', wall, [11, 0.6, 0], [0.6, 1.2, 22.6], 'static'),

    obj('o10', 'プレイヤー', 'box', '#4f8cff', [0, 0.6, 3], playerBody, 'dynamic', [
      ['move', { speed: 6, turn: true }], ['camera', { distance: 11, height: 10 }],
      ['hp', { max: 5, invincible: 1, showHud: true }], ['dieLose', { message: 'おばけに やられた…' }],
      ['shooter', { bullet: 'たま', key: 'KeyJ', cooldown: 0.2 }],
      ['shooter', { bullet: 'ミサイル', key: 'KeyK', cooldown: 1.2 }]
    ], { tag: 'player' }),
    part('o11', '向き', 'box', '#ffd23f', 'o10', playerBody, [0, 0.15, 0.45], [0.3, 0.2, 0.15]),

    obj('o20', 'ゲームの進行', 'empty', '#ffffff', [0, 0, 0], [1, 1, 1], 'none', [
      ['arenaIntro'],
      ['timer', { seconds: 45, mode: 'win', label: 'のこり', message: '45 秒 生きのびた!' }]
    ])
  );
  [[-8.5, -8.5], [8.5, -8.5], [-8.5, 8.5], [8.5, 8.5]].forEach(([x, z], i) => {
    const id = 'o3' + i;
    project.objects.push(
      obj(id, '出現装置 ' + (i + 1), 'empty', '#ffffff', [x, 0.5, z], [1, 1, 1], 'none', [
        ['spawner', { name: 'おばけ', interval: 3.5, max: 2, spread: 1, delay: 1 + i * 0.8 }]
      ]),
      child(id, id + 'm', '魔法陣', 'cylinder', '#7b4dff', [0, -0.48, 0], [2, 0.04, 2], 'none')
    );
  });
  // 最初から1体だけいる
  project.objects.push(...instantiate(project, project.prefabs[0], { name: 'おばけ', pos: { x: 0, y: 0.5, z: -6 } }));
  return project;
}
