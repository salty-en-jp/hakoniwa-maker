// シーン タブ: 形の追加、オブジェクト一覧、シーン設定、保存と読み込み

import { SHAPES } from '../../core/defs.js';
import { parseProject } from '../../core/project.js';
import { treeOrder } from '../../core/tree.js';
import { instancesOf } from '../../core/prefab.js';
import { SAMPLES } from '../../samples/index.js';
import { $, esc, confirmTwice } from '../dom.js';
import { state, on } from '../state.js';
import { addObject, select, loadProject, setSettings, placePrefab, renamePrefab, deletePrefab } from '../actions.js';

let root;

export function initScenePanel(container) {
  root = container;
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  on('project-loaded', render);
  on('objects-changed', () => { renderList(); renderPrefabs(); });
  on('selection-changed', renderList);
  on('prefabs-changed', renderPrefabs);
}

function render() {
  const s = state.project.settings;
  root.innerHTML = `
  <div class="sec"><h3>追加する</h3>
    <div class="shapes">${Object.entries(SHAPES).map(([k, sh]) =>
      `<button class="btn" data-add="${k}"><span class="g">${sh.glyph}</span><span class="t">${sh.label}</span></button>`).join('')}</div>
  </div>
  <div class="sec"><h3>オブジェクト <span class="count" id="objCount"></span></h3><ul id="hier"></ul>
    <p class="hint">親子にするには、子にしたいものを選んでインスペクタの「親」を変えます。</p></div>
  <div class="sec"><h3>プレハブ <span class="count" id="pfCount"></span></h3><div id="pfList"></div></div>
  <div class="sec"><h3>シーン設定</h3>
    <div class="row2">
      <label>空の色<input type="color" id="s-sky" value="${esc(s.sky)}"></label>
      <label>重力<input type="number" id="s-grav" step="1" value="${s.gravity}"></label>
    </div>
  </div>
  <div class="sec"><h3>サンプルを開く</h3>
    <div class="addrow">
      <select id="d-sample" aria-label="サンプル">${SAMPLES.map(x => `<option value="${x.id}">${esc(x.name)}(${esc(x.genre)})</option>`).join('')}</select>
      <button class="btn" id="d-open">開く</button>
    </div>
    <p class="hint">今のシーンは置きかわります。残したいときは、先に下の「JSONをコピー」で控えてください。</p>
  </div>
  <div class="sec"><h3>データ</h3>
    <p class="hint">このブラウザに自動保存しています。別の端末へ移すときは、JSONをコピーして貼り付けてください。</p>
    <div class="actions">
      <button class="btn" id="d-copy">JSONをコピー</button>
      <span class="btn file">ファイルを読み込む<input type="file" id="d-file" accept=".json,application/json"></span>
    </div>
    <textarea id="io" spellcheck="false" placeholder="ここにJSONを貼り付けて「貼り付けを読み込む」"></textarea>
    <div class="actions"><button class="btn" id="d-paste">貼り付けを読み込む</button><span id="d-note" class="hint"></span></div>
  </div>`;
  renderList();
  renderPrefabs();
}

function renderPrefabs() {
  const box = $('#pfList', root);
  if (!box) return;
  const list = state.project.prefabs;
  $('#pfCount', root).textContent = list.length;
  if (!list.length) {
    box.innerHTML = '<p class="hint">まだありません。オブジェクトを選んで、インスペクタの「プレハブにする」を押すと作れます。</p>';
    return;
  }
  box.innerHTML = list.map(f => `<div class="pfrow">
    <input id="pf-name-${esc(f.id)}" data-pfname="${esc(f.id)}" value="${esc(f.name)}" aria-label="プレハブの名前">
    <span class="chip">${instancesOf(state.project, f.id).length} 個 · 部品 ${f.objects.length}</span>
    <button class="btn" data-pfplace="${esc(f.id)}">置く</button>
    <button class="btn danger" data-pfdel="${esc(f.id)}">削除</button>
  </div>`).join('');
}

function renderList() {
  const ul = $('#hier', root);
  if (!ul) return;
  $('#objCount', root).textContent = state.project.objects.length;
  ul.innerHTML = treeOrder(state.project.objects).map(({ obj: o, depth }) => `<li><button data-id="${o.id}" aria-current="${o.id === state.selectedId}" style="padding-left:${8 + depth * 16}px">
    ${depth ? '<span class="branch">└</span>' : ''}<span class="g" style="color:${o.shape === 'empty' ? 'var(--accent)' : esc(o.color)}">${SHAPES[o.shape].glyph}</span>
    <span class="n">${esc(o.name)}</span>
    ${o.prefab ? '<span class="chip pf">プレハブ</span>' : ''}
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
  const place = e.target.closest('[data-pfplace]');
  if (place) return placePrefab(place.dataset.pfplace);
  const del = e.target.closest('[data-pfdel]');
  if (del) {
    const n = instancesOf(state.project, del.dataset.pfdel).length;
    return confirmTwice(del, n ? '置いたものは残して削除' : 'もう一度押すと削除', () => deletePrefab(del.dataset.pfdel));
  }
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
  if (btn.id === 'd-open') {
    const sample = SAMPLES.find(x => x.id === $('#d-sample', root).value);
    if (sample) confirmTwice(btn, '置きかえて開く', () => { loadProject(sample.create()); note(`「${sample.name}」を開きました`); });
  }
}

function onInput(e) {
  if (e.target.dataset.pfname) renamePrefab(e.target.dataset.pfname, e.target.value);
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
