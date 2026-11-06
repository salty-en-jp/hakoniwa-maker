// パネルのタブ切り替えと、スマホでのパネルの拡大

import { $, $$ } from '../dom.js';
import { state, on, isNarrow } from '../state.js';
import { showTab } from '../actions.js';

const TABS = ['scene', 'inspect', 'assets'];

export function initTabs() {
  $$('.tabs [role=tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  on('tab-changed', tab => {
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    TABS.forEach(k => { $('#tab-' + k).hidden = k !== tab; });
  });

  // 何かを選んだら、そのオブジェクトが見えるタブへ移る
  on('selection-changed', ({ fromView, fromList } = {}) => {
    if (!state.selectedId) return;
    if ((fromView || fromList) && state.tab === 'scene') showTab('inspect');
    else if (fromView && state.tab === 'assets' && isNarrow()) showTab('inspect');
  });

  const grow = $('#growBtn');
  grow.addEventListener('click', () => {
    const max = document.body.classList.toggle('panel-max');
    grow.setAttribute('aria-label', max ? 'パネルを戻す' : 'パネルを広げる');
  });
}
