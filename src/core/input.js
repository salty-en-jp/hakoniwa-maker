// 再生中の入力の状態。キーボードも画面ボタンもここに集める

/** ブラウザの既定動作(スクロールなど)を止めるキー */
export const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class Input {
  constructor() {
    this.down = new Set();     // 押している間
    this.pressed = new Set();  // 押した瞬間(1フレームだけ)
  }
  press(code) {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }
  release(code) { this.down.delete(code); }
  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  /** フレームの最後に呼ぶ */
  endFrame() { this.pressed.clear(); }
  reset() { this.down.clear(); this.pressed.clear(); }
}

export const input = new Input();
