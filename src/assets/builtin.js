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
