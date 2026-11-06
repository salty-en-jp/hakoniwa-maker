// 再生中に舞台の上へ重ねる表示(HUD、メッセージ、結果、ログ)と、スマホ用の画面ボタン
// createPlayUI() が返すオブジェクトを Runtime の ui として渡す

import { $, $$ } from './dom.js';

export function createPlayUI() {
  const logBox = $('#log');
  const logLines = $('#logLines');
  const toast = $('#toast');

  $('#logClear').addEventListener('click', () => ui.clearLog());

  // ---- 会話ウィンドウと選択肢 ----
  // modal は今出ているもの。{ type: 'say' | 'choose', resolve, ready, ... }
  // ready: 開いたフレームの入力では進めない(話しかけたキーで1行目が飛ばないように)
  const dialog = $('#dialog'), dialogName = $('#dialogName'), dialogText = $('#dialogText');
  const choiceBox = $('#choice'), choiceTitle = $('#choiceTitle'), choiceOpts = $('#choiceOpts');
  const CHARS_PER_SEC = 40;
  const ADVANCE_KEYS = ['Space', 'Enter', 'KeyE'];
  let modal = null;

  function closeModal() {
    dialog.hidden = true;
    choiceBox.hidden = true;
    modal = null;
  }
  function advanceSay() {
    if (!modal || modal.type !== 'say') return;
    if (modal.shown < modal.text.length) {
      modal.shown = modal.text.length;
      renderSay();
      return;
    }
    const done = modal.resolve;
    closeModal();
    done();
  }
  function renderSay() {
    dialogText.textContent = modal.text.slice(0, Math.floor(modal.shown));
    dialog.classList.toggle('typing', modal.shown < modal.text.length);
  }
  function renderChoice() {
    Array.from(choiceOpts.children).forEach((b, i) => b.setAttribute('aria-selected', String(i === modal.index)));
  }
  function pick(i) {
    if (!modal || modal.type !== 'choose') return;
    const done = modal.resolve;
    closeModal();
    done(i);
  }
  dialog.addEventListener('click', () => advanceSay());
  choiceOpts.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (b) pick(+b.dataset.i);
  });

  const ui = {
    get busy() { return !!modal; },
    say(name, text) {
      return new Promise(resolve => {
        closeModal();
        modal = { type: 'say', text, shown: 0, resolve, ready: false };
        dialogName.textContent = name;
        renderSay();
        dialog.hidden = false;
      });
    },
    choose(options, title) {
      return new Promise(resolve => {
        closeModal();
        modal = { type: 'choose', options, index: 0, resolve, ready: false };
        choiceTitle.textContent = title;
        choiceOpts.innerHTML = '';
        options.forEach((label, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.dataset.i = i;
          b.setAttribute('role', 'option');
          b.textContent = label;
          choiceOpts.appendChild(b);
        });
        renderChoice();
        choiceBox.hidden = false;
      });
    },
    /** 毎フレーム呼ばれる。文字送りと、キーでの送り・選択 */
    update(dt, input) {
      if (!modal) return;
      if (modal.type === 'say' && modal.shown < modal.text.length) {
        modal.shown = Math.min(modal.text.length, modal.shown + dt * CHARS_PER_SEC);
        renderSay();
      }
      if (!modal.ready) { modal.ready = true; return; }
      const pressed = codes => codes.some(c => input.wasPressed(c));
      if (modal.type === 'say') {
        if (pressed(ADVANCE_KEYS)) advanceSay();
      } else {
        const n = modal.options.length;
        if (pressed(['ArrowUp', 'KeyW'])) { modal.index = (modal.index + n - 1) % n; renderChoice(); }
        if (pressed(['ArrowDown', 'KeyS'])) { modal.index = (modal.index + 1) % n; renderChoice(); }
        if (pressed(ADVANCE_KEYS)) pick(modal.index);
      }
    },

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
    setScore(n) { $('#hudScore').textContent = '★ ' + n; },
    /** HUD に1行出す。同じ label なら書き換え、text が null なら消す */
    setHud(label, text) {
      const lines = $('#hudLines');
      let row = Array.from(lines.children).find(r => r.dataset.label === label);
      if (text === null) { if (row) row.remove(); return; }
      if (!row) {
        row = document.createElement('div');
        row.dataset.label = label;
        row.innerHTML = '<span class="lbl"></span><span class="val"></span>';
        row.querySelector('.lbl').textContent = label;
        lines.appendChild(row);
      }
      row.querySelector('.val').textContent = text;
    },
    showEnd(won, text, score, seconds) {
      closeModal();
      const h = $('#endTitle');
      h.textContent = won ? 'クリア!' : 'ゲームオーバー';
      h.className = won ? '' : 'lose';
      $('#endText').textContent = (text ? text + ' · ' : '') + 'スコア ' + score + ' · ' + seconds.toFixed(1) + '秒';
      $('#endcard').hidden = false;
    },
    /** 再生の終わりややり直しで、重ねた表示を片付ける */
    reset() {
      closeModal(); // 待っていた await は終わらないまま捨てられる
      $('#endcard').hidden = true;
      toast.hidden = true;
      $('#hudLines').innerHTML = '';
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
