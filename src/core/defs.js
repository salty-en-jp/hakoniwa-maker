// エンジン全体で使う定数と小さな道具

export const DEG = Math.PI / 180;

/** 小数第3位で丸める */
export const r3 = n => Math.round(n * 1000) / 1000;

/** JSON で表せるデータの深いコピー */
export const clone = o => JSON.parse(JSON.stringify(o));

/** 置ける形 */
export const SHAPES = {
  box:      { label: '箱',     glyph: '■' },
  sphere:   { label: '球',     glyph: '●' },
  cylinder: { label: '円柱',   glyph: '▮' },
  cone:     { label: '円錐',   glyph: '▲' },
  ring:     { label: 'リング', glyph: '◎' },
  empty:    { label: '空',     glyph: '◇' } // 見えないまとめ役。子をまとめる親に使う
};

/** 形が「空」なら当たり判定を持たない */
export const isEmptyShape = shape => shape === 'empty';

/** 物理の種類: [表示名, 説明] */
export const BODIES = {
  none:    ['なし(飾り)', '見た目だけ。当たり判定もありません。'],
  static:  ['固定(床・壁)', '動かない足場や壁。ロジックで動かすと「動く床」になり、乗っているものを運びます。'],
  dynamic: ['動く(重力あり)', '重力で落ち、固定のものにぶつかって止まります。プレイヤー向け。'],
  trigger: ['すり抜け(判定のみ)', 'ぶつからずに通り抜け、触れた瞬間だけ onCollide が呼ばれます。アイテムや敵向け。']
};

/** 新しく置くオブジェクトの色の候補 */
export const PALETTE = ['#4f8cff', '#ff8a3d', '#5fd38a', '#b06cff', '#ffd23f', '#e5484d', '#3cc8c8', '#c9a26b'];
