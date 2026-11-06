// キーボード: 再生中はゲームの入力、編集中はショートカット

import { input, GAME_KEYS } from '../core/input.js';
import { isTextField } from './dom.js';
import { state } from './state.js';
import { removeObject, duplicateObject } from './actions.js';
import { stopPlay } from './play-mode.js';

export function bindKeyboard() {
  window.addEventListener('keydown', e => {
    if (state.playing) {
      if (e.code === 'Escape') { stopPlay(); return; }
      if (isTextField(e.target)) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      input.press(e.code);
      return;
    }
    if (isTextField(e.target)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
      e.preventDefault();
      removeObject(state.selectedId);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && state.selectedId) {
      e.preventDefault();
      duplicateObject(state.selectedId);
    }
  });
  window.addEventListener('keyup', e => input.release(e.code));
  window.addEventListener('blur', () => input.reset());
}
