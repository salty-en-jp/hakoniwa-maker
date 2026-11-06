// シーン タブ: 形の追加、オブジェクト一覧、シーン設定、保存と読み込み

import { SHAPES } from '../../core/defs.js';
import { parseProject } from '../../core/project.js';
import { coinAthletic } from '../../samples/coin-athletic.js';
import { $, esc, confirmTwice } from '../dom.js';
import { state, on } from '../state.js';
import { addObject, select, loadProject, setSettings } from '../actions.js';

let root;

export function initScenePanel(container) {
  root = container;
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  on('project-loaded', render);
  on('objects-changed', renderList);
  on('selection-changed', renderList);
}

function render() {
  const s = state.project.settings;
  root.innerHTML = `
  <div class="sec"><h3>追加する</h3>
    <div class="shapes">${Object.entries(SHAPES).map(([k, sh]) =>
      `<button class="btn" data-add="${k}"><span class="g">${sh.glyph}</span><span class="t">${sh.label}</span></button>`).join('')}</div>
  </div>
  <div class="sec"><h3>オブジェクト <span class="count" id="objCount"></span></h3><ul id="hier"></ul></div>
  <div class="sec"><h3>シーン設定</h3>
    <div class="row2">
      <label>空の色<input type="color" id="s-sky" value="${esc(s.sky)}"></label>
      <label>重力<input type="number" id="s-grav" step="1" value="${s.gravity}"></label>
    </div>
  </div>
  <div class="sec"><h3>データ</h3>
    <p class="hint">このブラウザに自動保存しています。別の端末へ移すときは、JSONをコピーして貼り付けてください。</p>
    <div class="actions">
      <button class="btn" id="d-copy">JSONをコピー</button>
      <span class="btn file">ファイルを読み込む<input type="file" id="d-file" accept=".json,application/json"></span>
      <button class="btn danger" id="d-reset">サンプルに戻す</button>
    </div>
    <textarea id="io" spellcheck="false" placeholder="ここにJSONを貼り付けて「貼り付けを読み込む」"></textarea>
    <div class="actions"><button class="btn" id="d-paste">貼り付けを読み込む</button><span id="d-note" class="hint"></span></div>
  </div>`;
  renderList();
}

function renderList() {
  const ul = $('#hier', root);
  if (!ul) return;
  $('#objCount', root).textContent = state.project.objects.length;
  ul.innerHTML = state.project.objects.map(o => `<li><button data-id="${o.id}" aria-current="${o.id === state.selectedId}">
    <span class="g" style="color:${esc(o.color)}">${SHAPES[o.shape].glyph}</span>
    <span class="n">${esc(o.name)}</span>
    ${o.tag ? `<span class="chip tag">${esc(o.tag)}</span>` : ''}
    ${o.behaviors.length ? `<span class="chip">ロジック ${o.behaviors.length}</span>` : ''}
  </button></li>`).join('');
}

function note(text, ok = true) {
  const n = $('#d-note', root);
  if (n) { n.textContent = text; n.className = ok ? 'ok-note' : 'hint'; }
}

function importText(text) {
  try {
    loadProject(parseProject(text));
    note('読み込みました');
  } catch (err) {
    note('読み込めませんでした: ' + err.message, false);
  }
}

function onClick(e) {
  const add = e.target.closest('[data-add]');
  if (add) return addObject(add.dataset.add);
  const row = e.target.closest('#hier [data-id]');
  if (row) return select(row.dataset.id, { fromList: true });
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.id === 'd-copy') {
    const text = JSON.stringify(state.project);
    const io = $('#io', root);
    io.value = text;
    const manual = () => { io.select(); note('下の欄を選択しました。手動でコピーしてください'); };
    try { navigator.clipboard.writeText(text).then(() => note('コピーしました'), manual); } catch (err) { manual(); }
  }
  if (btn.id === 'd-paste') importText($('#io', root).value);
  if (btn.id === 'd-reset') confirmTwice(btn, 'もう一度押すと初期化', () => { loadProject(coinAthletic()); note('サンプルに戻しました'); });
}

function onInput(e) {
  if (e.target.id === 's-sky') setSettings({ sky: e.target.value });
  if (e.target.id === 's-grav') {
    const g = parseFloat(e.target.value);
    if (isFinite(g)) setSettings({ gravity: g });
  }
}

function onChange(e) {
  if (e.target.id === 'd-file' && e.target.files[0]) {
    const reader = new FileReader();
    reader.onload = () => importText(String(reader.result));
    reader.readAsText(e.target.files[0]);
    e.target.value = '';
  }
}
