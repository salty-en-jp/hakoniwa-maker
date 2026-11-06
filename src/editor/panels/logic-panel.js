// ロジック タブ: ロジックアセットの一覧と、パラメータ・コードの編集

import { clone } from '../../core/defs.js';
import { countAssetUsage } from '../../core/project.js';
import { checkSyntax } from '../../core/runtime.js';
import { BUILTIN_MAP, NEW_ASSET_TEMPLATE, NEW_ASSET_CODE } from '../../assets/builtin.js';
import { $, esc, confirmTwice } from '../dom.js';
import { state, on, emit, selectedAsset } from '../state.js';
import { save } from '../actions.js';

let root;
let checkTimer;

const newAssetId = () => 'u' + Date.now().toString(36);

export function initLogicPanel(container) {
  root = container;
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('keydown', onKeydown);
  root.addEventListener('click', onClick);
  on('tab-changed', tab => { if (tab === 'assets') render(); });
  on('project-loaded', () => { if (state.tab === 'assets') render(); });
}

/** 一覧や名前が変わったことを他のパネルに知らせて、自分も描き直す */
function changed({ rerender = true } = {}) {
  save();
  emit('assets-changed');
  if (rerender) render();
}

const API_HELP = `
<details class="api"><summary>コードで使える命令</summary><dl>
  <h4>しくみ</h4>
  <dt>start()</dt><dd>再生開始時に1回</dd>
  <dt>update(dt)</dt><dd>毎フレーム。dt は経過秒</dd>
  <dt>onCollide(other)</dt><dd>何かに触れた瞬間。other は相手の self</dd>
  <dt>params.○○</dt><dd>上のパラメータの値</dd>
  <h4>self(このオブジェクト)</h4>
  <dt>position / rotation / scale</dt><dd>.x .y .z で読み書き(回転はラジアン)</dd>
  <dt>velocity</dt><dd>速度。物理が「動く」のとき有効</dd>
  <dt>grounded</dt><dd>何かの上に立っているか</dd>
  <dt>name / tag</dt><dd>名前とタグ</dd>
  <dt>startPosition</dt><dd>再生開始時の位置</dd>
  <dt>setColor('#ff0000')</dt><dd>色を変える</dd>
  <dt>destroy()</dt><dd>消える</dd>
  <h4>合図(ロジックどうしの連携)</h4>
  <dt>self.on('名前', (data, from) =&gt; …)</dt><dd>合図を受け取る</dd>
  <dt>other.send('名前', data, self)</dt><dd>相手に合図を送る</dd>
  <dt>game.broadcast('名前', data, 'タグ')</dt><dd>全員(タグ指定ならその全員)に送る</dd>
  <dt>damage / heal / died</dt><dd>共通語。ダメージ量・回復量を data で渡す。died は HP が 0 になったとき自分に届く</dd>
  <h4>game</h4>
  <dt>key('ArrowUp')</dt><dd>押している間 true。KeyA〜KeyZ, Space なども</dd>
  <dt>pressed('Space')</dt><dd>押した瞬間だけ true</dd>
  <dt>score / addScore(n)</dt><dd>点数</dd>
  <dt>message('文字', 秒)</dt><dd>画面に表示</dd>
  <dt>hud('名前', '文字')</dt><dd>左上に1行表示。null で消す</dd>
  <dt>win('文字') / lose('文字')</dt><dd>クリア / ゲームオーバー</dd>
  <dt>find('名前')</dt><dd>名前で他のオブジェクトを探す</dd>
  <dt>findAll('タグ')</dt><dd>タグで全部探す(配列)</dd>
  <dt>spawn('名前', {x,y,z})</dt><dd>そのオブジェクトをコピーして出す</dd>
  <dt>time / camera / log(…)</dt><dd>経過秒、カメラ、ログ表示</dd>
  <dt>THREE</dt><dd>three.js 本体(Vector3 など)</dd>
</dl><p class="hint">スマホの画面ボタンは矢印キーと Space として届きます。</p></details>`;

function statusHtml(code) {
  const err = checkSyntax(code);
  return { cls: 'status ' + (err ? 'bad' : 'ok'), text: err ? '書き間違い: ' + err : '✓ 構文OK' };
}

function paramRow(p, i) {
  const def = p.type === 'bool'
    ? `<input type="checkbox" id="a-pd-${i}" data-pi="${i}" data-pf="def" ${p.def ? 'checked' : ''} aria-label="初期値">`
    : `<input id="a-pd-${i}" data-pi="${i}" data-pf="def" ${p.type === 'number' ? 'type="number" step="any"' : ''} value="${esc(p.def)}" aria-label="初期値">`;
  return `<div class="prow">
    <input id="a-pk-${i}" data-pi="${i}" data-pf="key" value="${esc(p.key)}" aria-label="パラメータ名">
    <select id="a-pt-${i}" data-pi="${i}" data-pf="type" aria-label="種類">
      <option value="number" ${p.type === 'number' ? 'selected' : ''}>数値</option>
      <option value="text" ${p.type === 'text' ? 'selected' : ''}>文字</option>
      <option value="bool" ${p.type === 'bool' ? 'selected' : ''}>ON/OFF</option>
    </select>
    ${def}
    <button class="rm" data-act="rm-param" data-i="${i}" aria-label="削除">×</button></div>`;
}

function render() {
  const p = state.project;
  const a = selectedAsset();
  const list = p.assets.map(x =>
    `<button data-aid="${esc(x.id)}" aria-current="${x.id === state.selectedAssetId}"><span class="an">${esc(x.name)}</span><span class="au">${countAssetUsage(p, x.id)} か所で使用</span></button>`
  ).join('');

  let editor = '<div class="empty">ロジックを選ぶと、コードとパラメータを編集できます。</div>';
  if (a) {
    const st = statusHtml(a.code);
    const used = countAssetUsage(p, a.id);
    editor = `
    <div class="sec">
      <label>名前<input id="a-name" value="${esc(a.name)}"></label>
      <label>説明<input id="a-desc" value="${esc(a.desc)}" placeholder="何をするロジックか"></label>
    </div>
    <div class="sec"><h3>パラメータ<button class="link sp" data-act="add-param">+ 追加</button></h3>
      ${a.params.length
        ? `<div class="prow phead"><span>名前(params.○○)</span><span>種類</span><span>初期値</span><span></span></div>`
        : '<p class="hint">インスペクタで調整できる値です。コードからは params.名前 で読めます。</p>'}
      <div class="ptable">${a.params.map(paramRow).join('')}</div>
    </div>
    <div class="sec"><h3>コード</h3>
      <textarea class="code" id="a-code" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(a.code)}</textarea>
      <div id="a-status" class="${st.cls}">${esc(st.text)}</div>
      ${API_HELP}
    </div>
    <div class="sec"><div class="actions">
      <button class="btn" data-act="dup-asset">複製</button>
      ${BUILTIN_MAP[a.id] ? '<button class="btn" data-act="reset-asset">初期状態に戻す</button>' : ''}
      <button class="btn danger" data-act="del-asset" data-used="${used}">削除</button>
    </div></div>`;
  }
  root.innerHTML = `<div class="sec"><h3>ロジック一覧 <span class="count">${p.assets.length}</span></h3>
    <div class="alist">${list}<button class="new" data-act="new-asset">+ 新しいロジック</button></div></div>${editor}`;
}

function onInput(e) {
  const t = e.target, a = selectedAsset();
  if (!a) return;
  if (t.id === 'a-name') {
    a.name = t.value;
    const label = root.querySelector(`[data-aid="${CSS.escape(a.id)}"] .an`);
    if (label) label.textContent = a.name;
    changed({ rerender: false });
    return;
  }
  if (t.id === 'a-desc') { a.desc = t.value; save(); return; }
  if (t.id === 'a-code') {
    a.code = t.value;
    save();
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      const s = $('#a-status', root);
      if (!s) return;
      const st = statusHtml(a.code);
      s.className = st.cls;
      s.textContent = st.text;
    }, 350);
    return;
  }
  if (t.dataset.pi !== undefined) {
    const p = a.params[+t.dataset.pi];
    if (!p) return;
    if (t.dataset.pf === 'key') {
      // 名前を変えたら、オブジェクト側に保存されている値も付け替える
      const old = p.key;
      p.key = t.value.trim();
      state.project.objects.forEach(o => o.behaviors.forEach(b => {
        if (b.asset === a.id && old in b.params) { b.params[p.key] = b.params[old]; delete b.params[old]; }
      }));
    }
    if (t.dataset.pf === 'def') {
      p.def = p.type === 'bool' ? t.checked : p.type === 'number' ? (parseFloat(t.value) || 0) : t.value;
    }
    changed({ rerender: false });
  }
}

function onChange(e) {
  const t = e.target, a = selectedAsset();
  if (!a || t.dataset.pf !== 'type') return;
  const p = a.params[+t.dataset.pi];
  p.type = t.value;
  p.def = t.value === 'bool' ? false : t.value === 'number' ? 0 : '';
  changed();
}

/** コード欄で Tab を押したら空白2つを入れる */
function onKeydown(e) {
  if (e.target.id !== 'a-code' || e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  const ta = e.target;
  ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function onClick(e) {
  const pick = e.target.closest('[data-aid]');
  if (pick) { state.selectedAssetId = pick.dataset.aid; render(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const p = state.project;
  const a = selectedAsset();

  switch (b.dataset.act) {
    case 'new-asset': {
      const na = Object.assign({ id: newAssetId() }, clone(NEW_ASSET_TEMPLATE), { code: NEW_ASSET_CODE });
      p.assets.push(na);
      state.selectedAssetId = na.id;
      changed();
      const ta = $('#a-code', root);
      if (ta) ta.scrollIntoView({ block: 'nearest' });
      break;
    }
    case 'add-param':
      if (!a) return;
      a.params.push({ key: 'value' + (a.params.length + 1), type: 'number', def: 1 });
      changed();
      break;
    case 'rm-param':
      if (!a) return;
      a.params.splice(+b.dataset.i, 1);
      changed();
      break;
    case 'dup-asset': {
      if (!a) return;
      const c = clone(a);
      c.id = newAssetId();
      c.name = a.name + ' のコピー';
      delete c.builtin;
      p.assets.push(c);
      state.selectedAssetId = c.id;
      changed();
      break;
    }
    case 'reset-asset':
      if (a && BUILTIN_MAP[a.id]) confirmTwice(b, 'もう一度押すと戻す', () => { Object.assign(a, clone(BUILTIN_MAP[a.id])); changed(); });
      break;
    case 'del-asset': {
      if (!a) return;
      const used = +b.dataset.used;
      confirmTwice(b, used ? `使用中の${used}か所からも外して削除` : 'もう一度押すと削除', () => {
        p.assets = p.assets.filter(x => x.id !== a.id);
        // 組み込みを消したことを覚えておき、次に開いたときに戻さない
        if (BUILTIN_MAP[a.id]) p.removedBuiltins = Array.from(new Set([...(p.removedBuiltins || []), a.id]));
        p.objects.forEach(o => { o.behaviors = o.behaviors.filter(x => x.asset !== a.id); });
        state.selectedAssetId = p.assets[0] ? p.assets[0].id : null;
        changed();
        emit('objects-changed');
      });
      break;
    }
  }
}
