// 最初から入っているロジックアセット
//
// 1つのアセットは次の形:
//   id      他から参照するときの名前(変えない)
//   name    表示名
//   desc    説明
//   params  インスペクタで調整できる値 [{ key, type: 'number' | 'text' | 'longtext' | 'bool', def }]
//   code    中身の JavaScript。self / params / game / THREE が使え、
//           { start(), update(dt), onCollide(other) } を返す

export const BUILTIN_ASSETS = [
{id:'move', name:'プレイヤー操作', desc:'矢印キー / WASD で移動、スペースでジャンプ。向いている方向を data.facing に書く。物理は「動く」にします。',
 params:[{key:'speed',type:'number',def:5},{key:'jump',type:'number',def:8},{key:'turn',type:'bool',def:false}],
 code:`// 矢印キー / WASD で移動、スペースでジャンプ
// 向いている方向(ラジアン)を self.data.facing に書く。弾を撃つ部品などが使う
self.data.facing = Math.PI; // 最初は奥(-z)向き
return {
  update(dt) {
    let x = 0, z = 0;
    if (game.key('ArrowLeft')  || game.key('KeyA')) x -= 1;
    if (game.key('ArrowRight') || game.key('KeyD')) x += 1;
    if (game.key('ArrowUp')    || game.key('KeyW')) z -= 1;
    if (game.key('ArrowDown')  || game.key('KeyS')) z += 1;
    const len = Math.hypot(x, z) || 1;
    self.velocity.x = x / len * params.speed;
    self.velocity.z = z / len * params.speed;
    if (x || z) {
      self.data.facing = Math.atan2(x, z);
      if (params.turn) self.rotation.y = self.data.facing; // 見た目も向ける
    }

    if (game.pressed('Space') && self.grounded) {
      self.velocity.y = params.jump;
    }
  }
};`},
{id:'camera', name:'カメラ追従', desc:'カメラがこのオブジェクトを後ろ上から追いかけます。',
 params:[{key:'distance',type:'number',def:8},{key:'height',type:'number',def:5}],
 code:`// カメラが後ろ上からついてくる
const goal = new THREE.Vector3();
return {
  update(dt) {
    goal.set(self.position.x,
             self.position.y + params.height,
             self.position.z + params.distance);
    // なめらかに近づける
    game.camera.position.lerp(goal, 1 - Math.exp(-dt * 5));
    game.camera.lookAt(self.position);
  }
};`},
{id:'spin', name:'回転', desc:'回り続けます。speed は1秒あたりの回転数、axis は回す軸(x / y / z)。',
 params:[{key:'speed',type:'number',def:0.5},{key:'axis',type:'text',def:'y'}],
 code:`// 回り続ける
const axis = ['x', 'y', 'z'].includes(params.axis) ? params.axis : 'y';
return {
  update(dt) {
    self.rotation[axis] += params.speed * Math.PI * 2 * dt;
  }
};`},
{id:'patrol', name:'往復移動', desc:'最初の位置を中心に、軸(x / y / z)に沿って行ったり来たりします。',
 params:[{key:'axis',type:'text',def:'x'},{key:'distance',type:'number',def:3},{key:'speed',type:'number',def:1}],
 code:`// 最初の位置を中心に往復する
const start = self.position.clone();
const axis = ['x', 'y', 'z'].includes(params.axis) ? params.axis : 'x';
let t = 0;
return {
  update(dt) {
    t += dt * params.speed;
    self.position.copy(start);
    self.position[axis] += Math.sin(t) * params.distance;
  }
};`},
{id:'pickup', name:'拾えるアイテム', desc:'target タグのものに触れられたら点数を足して消えます。',
 params:[{key:'points',type:'number',def:1},{key:'target',type:'text',def:'player'}],
 code:`// 触れられたら点数を足して消える
return {
  onCollide(other) {
    if (other.tag === params.target) {
      game.addScore(params.points);
      self.destroy();
    }
  }
};`},
{id:'goal', name:'ゴール', desc:'player が触れたらクリア。needScore 点以上が必要です。',
 params:[{key:'needScore',type:'number',def:3},{key:'message',type:'text',def:'ぜんぶ集めてゴール!'}],
 code:`// プレイヤーが触れたらクリア
return {
  onCollide(other) {
    if (other.tag !== 'player') return;
    if (game.score >= params.needScore) {
      game.win(params.message);
    } else {
      game.message('あと ' + (params.needScore - game.score) + ' 個!');
    }
  }
};`},
{id:'hazard', name:'触れたらアウト', desc:'player が触れるとゲームオーバー。',
 params:[{key:'message',type:'text',def:'敵にぶつかった!'}],
 code:`// プレイヤーが触れたらゲームオーバー
return {
  onCollide(other) {
    if (other.tag === 'player') game.lose(params.message);
  }
};`},
{id:'fall', name:'落下でアウト', desc:'高さ minY より下に落ちるとゲームオーバー。',
 params:[{key:'minY',type:'number',def:-8},{key:'message',type:'text',def:'落っこちた!'}],
 code:`// 下に落ちすぎたらゲームオーバー
return {
  update(dt) {
    if (self.position.y < params.minY) game.lose(params.message);
  }
};`},
{id:'bounce', name:'ジャンプ台', desc:'target タグのものが乗ると上に跳ね飛ばします。',
 params:[{key:'power',type:'number',def:13},{key:'target',type:'text',def:'player'}],
 code:`// 乗ったものを跳ね上げる
return {
  onCollide(other) {
    if (other.tag === params.target) {
      other.velocity.y = params.power;
      game.message('びよーん!', 0.8);
    }
  }
};`},

// ---- ここから下は合図(damage / heal / died)でつながる部品 ----
{id:'hp', name:'HP', desc:'damage の合図で減り、heal で増える。0 になると自分に died を送る。今の値は data.hp / data.maxHp。',
 params:[{key:'max',type:'number',def:3},{key:'invincible',type:'number',def:1},{key:'showHud',type:'bool',def:false},{key:'label',type:'text',def:'HP'}],
 code:`// 体力。damage で減り、heal で増え、0 で died を自分に送る
// damage の data は数値か { amount, pierce }。pierce: true なら無敵時間を無視する(ターン制バトル用)
self.data.maxHp = params.max;
self.data.hp = params.max;
let safe = 0; // 無敵の残り秒

function show() {
  if (params.showHud) {
    const hp = self.data.hp, max = self.data.maxHp;
    game.hud(params.label, max <= 10 ? '♥'.repeat(hp) + '♡'.repeat(Math.max(0, max - hp)) : hp + ' / ' + max);
  }
  self.send('hpChanged', { hp: self.data.hp, max: self.data.maxHp });
}

self.on('damage', (data = 1, from) => {
  const amount = typeof data === 'object' ? (data.amount ?? 1) : data;
  const pierce = typeof data === 'object' && data.pierce;
  if ((safe > 0 && !pierce) || self.data.hp <= 0) return;
  self.data.hp = Math.max(0, self.data.hp - amount);
  if (!pierce) safe = params.invincible;
  show();
  if (self.data.hp === 0) self.send('died', from);
});

self.on('heal', (amount = 1) => {
  if (self.data.hp <= 0) return;
  self.data.hp = Math.min(self.data.maxHp, self.data.hp + amount);
  show();
});

return {
  start() { show(); },
  update(dt) {
    if (safe <= 0) return;
    safe -= dt;
    // 無敵のあいだは点滅する
    self.object3d.visible = safe <= 0 || Math.floor(safe * 12) % 2 === 0;
  }
};`},
{id:'contactDamage', name:'触れたらダメージ', desc:'target に damage を送る。上から踏まれたら逆に自分が damage を受ける。弾なら destroySelf をオンに。',
 params:[{key:'amount',type:'number',def:1},{key:'target',type:'text',def:'player'},{key:'stompable',type:'bool',def:true},{key:'bounce',type:'number',def:9},{key:'knockback',type:'number',def:6},{key:'destroySelf',type:'bool',def:false}],
 code:`// 触れた相手にダメージ。上から踏まれたら自分がダメージを受ける
return {
  onCollide(other) {
    if (other.tag !== params.target) return;

    const fromAbove = other.velocity.y < 0 && other.position.y > self.position.y;
    if (params.stompable && fromAbove) {
      self.send('damage', 1, other);
      other.velocity.y = params.bounce; // 踏んだ側を跳ねさせる
      return;
    }

    other.send('damage', params.amount, self);
    if (params.knockback) other.velocity.y = params.knockback; // 少し跳ね飛ばす
    if (params.destroySelf) self.destroy(); // 弾は当たったら消える
  }
};`},
{id:'healItem', name:'回復アイテム', desc:'target に触れられたら heal を送って消える。',
 params:[{key:'amount',type:'number',def:1},{key:'target',type:'text',def:'player'}],
 code:`// 触れられたら heal を送って消える
return {
  onCollide(other) {
    if (other.tag !== params.target) return;
    other.send('heal', params.amount, self);
    game.message('回復!', 0.8);
    self.destroy();
  }
};`},
{id:'dieDestroy', name:'やられたら消える', desc:'died を受け取ったら点数を足して消える。',
 params:[{key:'points',type:'number',def:0},{key:'message',type:'text',def:'やっつけた!'}],
 code:`// died を受け取ったら消える
self.on('died', () => {
  if (params.points) game.addScore(params.points);
  if (params.message) game.message(params.message, 1);
  self.destroy();
});
return {};`},
{id:'dieLose', name:'やられたらゲームオーバー', desc:'died を受け取ったらゲームオーバー。',
 params:[{key:'message',type:'text',def:'力尽きた…'}],
 code:`// died を受け取ったらゲームオーバー
self.on('died', () => game.lose(params.message));
return {};`},
// ---- ADV / ノベル: 話しかけて会話する ----
{id:'interactor', name:'調べる・話す', desc:'近くの話しかけられるもの(interact を受け取るもの)に、E キーかアクションボタンで interact を送る。プレイヤーに付ける。',
 params:[{key:'radius',type:'number',def:2.2},{key:'key',type:'text',def:'KeyE'}],
 code:`// 近くにある「話しかけられるもの」に interact の合図を送る
return {
  update(dt) {
    const target = game.nearest(self, { listens: 'interact', maxDist: params.radius });
    game.hud('アクション', target && !game.ui.busy ? 'E: ' + target.name : null);
    if (target && (game.pressed(params.key) || game.pressed('Enter'))) {
      target.send('interact', self, self);
    }
  }
};`},
{id:'talk', name:'会話', desc:'interact を受け取ったら会話する。lines は1行に「名前: セリフ」。終わると自分に talked を送る。',
 params:[{key:'lines',type:'longtext',def:'村人: こんにちは!\n村人: E キーで、いろんな人に話しかけてみてね。'},{key:'pause',type:'bool',def:true}],
 code:`// 話しかけられたら、1行ずつ会話する
let talking = false;

self.on('interact', async (from) => {
  if (talking) return;
  talking = true;
  if (params.pause) game.pause(); // 会話中は世界を止める
  for (const line of String(params.lines).split('\\n')) {
    const text = line.trim();
    if (!text) continue;
    const m = text.match(/^(.+?)[:：]\\s*(.*)$/);
    if (m) await game.ui.say(m[1], m[2]);
    else await game.ui.say(text);
  }
  if (params.pause) game.resume();
  talking = false;
  self.send('talked', from);
});
return {};`},

// ---- ターン制 RPG ----
{id:'turnBattle', name:'ターン制バトル', desc:'プレイヤーが触れる(または話しかける)とコマンドバトルが始まる。お互いの HP 部品を使う。',
 params:[{key:'trigger',type:'text',def:'touch'},{key:'attack',type:'number',def:1},{key:'playerAttack',type:'number',def:1},{key:'escape',type:'number',def:0.5},{key:'intro',type:'text',def:'があらわれた!'}],
 code:`// コマンドを選んで戦うバトル。trigger は touch(触れたら)か interact(話しかけたら)
// 自分とプレイヤーの両方に「HP」部品が要る
let fighting = false;

async function battle(player) {
  if (fighting || !player || !self.alive) return;
  fighting = true;
  game.pause();
  const say = text => game.ui.say('', text);
  await say(self.name + ' ' + params.intro);

  while (self.alive && player.alive && self.data.hp > 0 && player.data.hp > 0) {
    const status = self.name + '  HP ' + self.data.hp + '/' + self.data.maxHp +
                   '\\nあなた  HP ' + player.data.hp + '/' + player.data.maxHp;
    const pick = await game.ui.choose(['たたかう', 'まもる', 'くすり', 'にげる'], status);
    let guard = false;

    if (pick === 0) {
      await say(self.name + ' に ' + params.playerAttack + ' のダメージ!');
      self.send('damage', { amount: params.playerAttack, pierce: true }, player);
      if (!self.alive || self.data.hp <= 0) break;
    } else if (pick === 1) {
      guard = true;
      await say('みをまもっている。');
    } else if (pick === 2) {
      player.send('heal', 1, self);
      await say('くすりをのんだ。HP が 1 かいふくした。');
    } else {
      if (Math.random() < params.escape) {
        await say('うまく にげきれた!');
        // 同じ敵にすぐ触れないよう、少し離れる
        const dx = player.position.x - self.position.x, dz = player.position.z - self.position.z;
        const len = Math.hypot(dx, dz) || 1;
        player.position.x += dx / len * 2.5;
        player.position.z += dz / len * 2.5;
        break;
      }
      await say('にげられない!');
    }

    const damage = guard ? Math.max(0, params.attack - 1) : params.attack;
    await say(self.name + ' の こうげき! ' + (damage ? damage + ' のダメージ' : 'ふせいだ!'));
    if (damage) player.send('damage', { amount: damage, pierce: true }, self);
  }
  fighting = false;
  game.resume();
}

if (params.trigger === 'interact' || params.trigger === 'talked') {
  self.on(params.trigger, from => battle(from));
}

return {
  onCollide(other) {
    if (params.trigger === 'touch' && other.tag === 'player') battle(other);
  }
};`},

// ---- シューティング ----
{id:'shooter', name:'弾を撃つ', desc:'キーを押すと、名前で指定したプレハブ(弾)を向いている方向に出す。プレイヤーに付ける。',
 params:[{key:'bullet',type:'text',def:'たま'},{key:'key',type:'text',def:'KeyJ'},{key:'cooldown',type:'number',def:0.25},{key:'height',type:'number',def:0}],
 code:`// 向いている方向(data.facing)に弾を出す。弾の動きは弾のプレハブ側のロジックが決める
let wait = 0;
return {
  update(dt) {
    wait -= dt;
    if (wait > 0 || !game.key(params.key)) return;
    wait = params.cooldown;
    const angle = self.data.facing ?? self.rotation.y;
    const p = self.worldPosition();
    const b = game.spawn(params.bullet, {
      x: p.x + Math.sin(angle) * 0.9,
      y: p.y + params.height,
      z: p.z + Math.cos(angle) * 0.9
    });
    if (b) b.rotation.y = angle;
  }
};`},
{id:'projectile', name:'まっすぐ飛ぶ', desc:'向いている方向(rotation.y)にまっすぐ進む。弾向け。',
 params:[{key:'speed',type:'number',def:14}],
 code:`// 向いている方向にまっすぐ進む
return {
  update(dt) {
    const a = self.rotation.y;
    self.position.x += Math.sin(a) * params.speed * dt;
    self.position.z += Math.cos(a) * params.speed * dt;
  }
};`},
{id:'chase', name:'追いかける', desc:'いちばん近い target タグのものに向かって進む。敵の追跡やホーミングミサイルに。',
 params:[{key:'target',type:'text',def:'player'},{key:'speed',type:'number',def:2.5},{key:'range',type:'number',def:30},{key:'fly',type:'bool',def:false},{key:'turn',type:'bool',def:true}],
 code:`// いちばん近い target に向かって進む。fly がオンなら上下にも動く
return {
  update(dt) {
    const t = game.nearest(self, { tag: params.target, maxDist: params.range });
    if (!t) return;
    const to = t.worldPosition().sub(self.worldPosition());
    if (!params.fly) to.y = 0;
    const len = to.length();
    if (len < 0.05) return;
    self.position.addScaledVector(to, Math.min(len, params.speed * dt) / len);
    if (params.turn) self.rotation.y = Math.atan2(to.x, to.z);
  }
};`},
{id:'lifetime', name:'時間で消える', desc:'出てから seconds 秒たつと消える。弾やエフェクト向け。',
 params:[{key:'seconds',type:'number',def:1.5}],
 code:`// 決まった時間がたったら消える
let left = params.seconds;
return {
  update(dt) {
    left -= dt;
    if (left <= 0) self.destroy();
  }
};`},

// ---- 進行・ルール ----
{id:'spawner', name:'出現装置', desc:'interval 秒ごとに、名前で指定したプレハブを自分の位置に出す。同時に出ている数は max まで。',
 params:[{key:'name',type:'text',def:'おばけ'},{key:'interval',type:'number',def:3},{key:'max',type:'number',def:3},{key:'spread',type:'number',def:1},{key:'delay',type:'number',def:1}],
 code:`// 一定時間ごとにプレハブを出す
let wait = params.delay;
let alive = [];
return {
  update(dt) {
    wait -= dt;
    if (wait > 0) return;
    wait = params.interval;
    alive = alive.filter(a => a.alive);
    if (alive.length >= params.max) return;
    const p = self.worldPosition();
    const r = params.spread;
    const made = game.spawn(params.name, {
      x: p.x + (Math.random() * 2 - 1) * r,
      y: p.y,
      z: p.z + (Math.random() * 2 - 1) * r
    });
    if (made) alive.push(made);
  }
};`},
{id:'timer', name:'制限時間', desc:'残り時間を表示し、0 になったら mode が lose ならゲームオーバー、win ならクリア(生き残り)。',
 params:[{key:'seconds',type:'number',def:60},{key:'mode',type:'text',def:'lose'},{key:'label',type:'text',def:'のこり'},{key:'message',type:'text',def:'時間切れ!'}],
 code:`// 残り時間。win なら生き残ればクリア、lose なら時間切れでアウト
let left = params.seconds;
return {
  update(dt) {
    left -= dt;
    game.hud(params.label, Math.max(0, Math.ceil(left)) + ' 秒');
    if (left > 0) return;
    if (params.mode === 'win') game.win(params.message);
    else game.lose(params.message);
  }
};`},
{id:'clearAll', name:'全滅でクリア', desc:'tag のものが1つもいなくなったらクリア。残りの数も表示する。',
 params:[{key:'tag',type:'text',def:'enemy'},{key:'label',type:'text',def:'のこり'},{key:'message',type:'text',def:'ぜんぶ倒した!'}],
 code:`// tag のものが全部いなくなったらクリア
let checked = 0;
return {
  update(dt) {
    checked += dt;
    const n = game.findAll(params.tag).length;
    game.hud(params.label, n + ' 体');
    if (checked > 0.5 && n === 0) game.win(params.message);
  }
};`}
];

export const BUILTIN_MAP = Object.fromEntries(BUILTIN_ASSETS.map(a => [a.id, a]));

/** 「+ 新しいロジック」で作られるアセットのひな形 */
export const NEW_ASSET_TEMPLATE = {
  name: 'ふわふわ浮く',
  desc: '上下にゆれる(自作ロジックのひな形)',
  params: [{ key: 'height', type: 'number', def: 0.5 }, { key: 'speed', type: 'number', def: 2 }]
};

export const NEW_ASSET_CODE = `// ここにロジックを書きます。
// return の外の変数は、このオブジェクト専用のメモになります。
let elapsed = 0;
const baseY = self.position.y;

return {
  start() {
    // 再生開始時に1回だけ
  },
  update(dt) {
    // 毎フレーム。dt は前のフレームからの秒数
    elapsed += dt;
    self.position.y = baseY + Math.sin(elapsed * params.speed) * params.height;
  },
  onCollide(other) {
    // 何かに触れた瞬間。other.tag で相手を見分ける
  }
};`;

/**
 * 保存済みのプロジェクトに、あとから増えた組み込みアセットを足す
 * 自分で消した組み込みアセット(removedBuiltins に記録)は戻さない
 * @returns {number} 足した数
 */
export function addMissingBuiltins(project) {
  const have = new Set(project.assets.map(a => a.id));
  const removed = new Set(project.removedBuiltins || []);
  let added = 0;
  for (const a of BUILTIN_ASSETS) {
    if (have.has(a.id) || removed.has(a.id)) continue;
    project.assets.push(Object.assign(JSON.parse(JSON.stringify(a)), { builtin: true }));
    added++;
  }
  return added;
}
