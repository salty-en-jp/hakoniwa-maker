// 最初から入っているロジックアセット
//
// 1つのアセットは次の形:
//   id      他から参照するときの名前(変えない)
//   name    表示名
//   desc    説明
//   params  インスペクタで調整できる値 [{ key, type: 'number' | 'text' | 'bool', def }]
//   code    中身の JavaScript。self / params / game / THREE が使え、
//           { start(), update(dt), onCollide(other) } を返す

export const BUILTIN_ASSETS = [
{id:'move', name:'プレイヤー操作', desc:'矢印キー / WASD で移動、スペースでジャンプ。物理は「動く」にします。',
 params:[{key:'speed',type:'number',def:5},{key:'jump',type:'number',def:8}],
 code:`// 矢印キー / WASD で移動、スペースでジャンプ
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
{id:'spin', name:'回転', desc:'回り続けます。speed は1秒あたりの回転数。',
 params:[{key:'speed',type:'number',def:0.5}],
 code:`// 回り続ける
return {
  update(dt) {
    self.rotation.y += params.speed * Math.PI * 2 * dt;
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
{id:'hp', name:'HP', desc:'damage の合図で減り、heal で増える。0 になると自分に died を送る。',
 params:[{key:'max',type:'number',def:3},{key:'invincible',type:'number',def:1},{key:'showHud',type:'bool',def:false},{key:'label',type:'text',def:'HP'}],
 code:`// 体力。damage で減り、heal で増え、0 で died を自分に送る
let hp = params.max;
let safe = 0; // 無敵の残り秒

function show() {
  if (params.showHud) {
    game.hud(params.label, '♥'.repeat(hp) + '♡'.repeat(Math.max(0, params.max - hp)));
  }
}

self.on('damage', (amount = 1, from) => {
  if (safe > 0 || hp <= 0) return;
  hp = Math.max(0, hp - amount);
  safe = params.invincible;
  show();
  if (hp === 0) self.send('died', from);
});

self.on('heal', (amount = 1) => {
  if (hp <= 0) return;
  hp = Math.min(params.max, hp + amount);
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
{id:'contactDamage', name:'触れたらダメージ', desc:'target に damage を送る。上から踏まれたら逆に自分が damage を受ける。',
 params:[{key:'amount',type:'number',def:1},{key:'target',type:'text',def:'player'},{key:'stompable',type:'bool',def:true},{key:'bounce',type:'number',def:9},{key:'knockback',type:'number',def:6}],
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
    other.velocity.y = params.knockback; // 少し跳ね飛ばす
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
return {};`}
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
