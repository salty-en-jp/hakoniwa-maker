// 画面づくりの小さな道具

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** HTML に埋め込む文字列のエスケープ */
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * 2回押しで実行するボタン(削除などの確認用)
 * 1回目でラベルが label に変わり、3秒以内にもう一度押すと fn を実行する
 */
export function confirmTwice(btn, label, fn) {
  if (btn.dataset.armed) {
    delete btn.dataset.armed;
    btn.classList.remove('armed');
    btn.textContent = btn.dataset.orig;
    fn();
    return;
  }
  btn.dataset.armed = '1';
  btn.dataset.orig = btn.textContent;
  btn.textContent = label;
  btn.classList.add('armed');
  setTimeout(() => {
    if (!btn.dataset.armed) return;
    delete btn.dataset.armed;
    btn.classList.remove('armed');
    btn.textContent = btn.dataset.orig;
  }, 3000);
}

/** 入力中の欄か(キー操作をゲームやショートカットに回さないため) */
export const isTextField = el =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
