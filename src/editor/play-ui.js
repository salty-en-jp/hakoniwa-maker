// 再生中に舞台の上へ重ねる表示(HUD、メッセージ、結果、ログ)と、スマホ用の画面ボタン
// createPlayUI() が返すオブジェクトを Runtime の ui として渡す

import { $, $$ } from './dom.js';

export function createPlayUI() {
  const logBox = $('#log');
  const logLines = $('#logLines');
  const toast = $('#toast');

  $('#logClear').addEventListener('click', () => ui.clearLog());

  const ui = {
    log(text, isError = false) {
      const d = document.createElement('div');
      d.textContent = text;
      if (isError) d.className = 'err';
      logLines.appendChild(d);
      while (logLines.children.length > 40) logLines.firstChild.remove();
      logBox.hidden = false;
      logBox.scrollTop = logBox.scrollHeight;
    },
    clearLog() {
      logLines.innerHTML = '';
      logBox.hidden = true;
    },
    message(text) {
      toast.textContent = text;
      toast.hidden = false;
    },
    hideMessage() { toast.hidden = true; },
    setScore(n) { $('#hud').textContent = '★ ' + n; },
    showEnd(won, text, score, seconds) {
      const h = $('#endTitle');
      h.textContent = won ? 'クリア!' : 'ゲームオーバー';
      h.className = won ? '' : 'lose';
      $('#endText').textContent = (text ? text + ' · ' : '') + 'スコア ' + score + ' · ' + seconds.toFixed(1) + '秒';
      $('#endcard').hidden = false;
    },
    /** 再生の終わりややり直しで、重ねた表示を片付ける */
    reset() {
      $('#endcard').hidden = true;
      toast.hidden = true;
    }
  };
  return ui;
}

/** スマホ用の十字ボタンとジャンプボタンを input につなぐ */
export function bindTouchControls(input) {
  const buttons = $$('#touch [data-k]');
  buttons.forEach(btn => {
    const code = btn.dataset.k;
    const press = e => {
      e.preventDefault();
      btn.classList.add('on');
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* 古いブラウザ */ }
      input.press(code);
    };
    const release = () => { btn.classList.remove('on'); input.release(code); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
  return {
    /** 押しっぱなしの表示を消す */
    reset() { buttons.forEach(b => b.classList.remove('on')); }
  };
}
