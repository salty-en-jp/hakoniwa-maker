// インスペクタ タブ: 選んだオブジェクトの設定と、付いているロジックの調整

import { SHAPES, BODIES } from '../../core/defs.js';
import { findAsset } from '../../core/project.js';
import { esc, confirmTwice } from '../dom.js';
import { state, on, emit, selectedObject } from '../state.js';
import { save, objectVisualChanged, duplicateObject, removeObject, openAsset } from '../actions.js';

let root;

export function initInspector(container) {
  root = container;
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
  on('selection-changed', render);
  on('assets-changed', render);
  on('transform-changed', syncTransformFields);
}

function vecRow(label, key, v, step) {
  return `<div class="vec"><span class="vl">${label}</span>${['x', 'y', 'z'].map(a =>
    `<label class="ax ax-${a}"><span>${a.toUpperCase()}</span><input type="number" step="${step}" id="f-${key}-${a}" data-vec="${key}" data-axis="${a}" value="${v[a]}" aria-label="${label} ${a}"></label>`
  ).join('')}</div>`;
}

/** パラメータ1つ分の入力欄 */
export function paramField(p, value, attrs, id) {
  if (p.type === 'bool') return `<label class="bool"><input type="checkbox" id="${id}" ${attrs} ${value ? 'checked' : ''}>${esc(p.key)}</label>`;
  if (p.type === 'number') return `<label>${esc(p.key)}<input type="number" step="any" id="${id}" ${attrs} value="${esc(value)}"></label>`;
  return `<label>${esc(p.key)}<input type="text" id="${id}" ${attrs} value="${esc(value)}"></label>`;
}

function behaviorCard(b, i) {
  const a = findAsset(state.project, b.asset);
  if (!a) {
    return `<div class="beh"><div class="beh-h"><span class="beh-name">見つからないロジック</span><button class="link" data-act="rm-beh" data-i="${i}">外す</button></div></div>`;
  }
  const fields = a.params.map(p => paramField(
    p, b.params[p.key] !== undefined ? b.params[p.key] : p.def,
    `data-bi="${i}" data-pk="${esc(p.key)}" data-pt="${p.type}"`, `f-b${i}-${esc(p.key)}`
  )).join('');
  return `<div class="beh"><div class="beh-h"><span class="beh-name">${esc(a.name)}</span>
    <button class="link" data-act="open-asset" data-id="${esc(a.id)}">コードを見る</button>
    <button class="link" data-act="rm-beh" data-i="${i}">外す</button></div>
    ${fields ? `<div class="params">${fields}</div>` : '<p class="hint">設定項目はありません。</p>'}</div>`;
}

function render() {
  const o = selectedObject();
  if (!o) {
    root.innerHTML = `<div class="empty"><b>なにも選んでいません</b>舞台のオブジェクトをタップするか、「シーン」タブから選ぶと、形・位置・ロジックをここで編集できます。</div>`;
    return;
  }
  root.innerHTML = `
  <div class="sec">
    <div class="row2">
      <label>名前<input id="f-name" data-f="name" value="${esc(o.name)}"></label>
      <label>タグ<input id="f-tag" data-f="tag" value="${esc(o.tag)}" placeholder="例: player"></label>
    </div>
    <div class="row2">
      <label>形<select id="f-shape" data-f="shape">${Object.entries(SHAPES).map(([k, s]) =>
        `<option value="${k}" ${k === o.shape ? 'selected' : ''}>${s.glyph} ${s.label}</option>`).join('')}</select></label>
      <label>色<input type="color" id="f-color" data-f="color" value="${esc(o.color)}"></label>
    </div>
  </div>
  <div class="sec"><h3>トランスフォーム</h3>
    ${vecRow('位置', 'pos', o.pos, 0.25)}${vecRow('回転°', 'rot', o.rot, 15)}${vecRow('大きさ', 'scale', o.scale, 0.1)}
  </div>
  <div class="sec"><h3>物理</h3>
    <select id="f-body" data-f="body">${Object.entries(BODIES).map(([k, [label]]) =>
      `<option value="${k}" ${k === o.body ? 'selected' : ''}>${label}</option>`).join('')}</select>
    <p class="hint">${BODIES[o.body][1]}</p>
  </div>
  <div class="sec"><h3>ロジック <span class="count">${o.behaviors.length}</span></h3>
    ${o.behaviors.map(behaviorCard).join('') || '<p class="hint">まだロジックがありません。下から追加すると、再生中に動き出します。</p>'}
    <div class="addrow">
      <select id="f-addasset" aria-label="追加するロジック">${state.project.assets.map(a =>
        `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>
      <button class="btn primary" data-act="add-beh">追加</button>
    </div>
  </div>
  <div class="sec"><div class="actions"><button class="btn" data-act="dup">複製</button><button class="btn danger" data-act="del">削除</button></div></div>`;
}

/** ギズモで動かしたとき、入力中でない欄だけ数値を書き換える */
function syncTransformFields(o) {
  if (!o || o.id !== state.selectedId) return;
  for (const k of ['pos', 'rot', 'scale']) for (const a of ['x', 'y', 'z']) {
    const el = document.getElementById(`f-${k}-${a}`);
    if (el && document.activeElement !== el) el.value = o[k][a];
  }
}

function onInput(e) {
  const t = e.target, o = selectedObject();
  if (!o) return;
  if (t.dataset.f === 'name' || t.dataset.f === 'tag') {
    o[t.dataset.f] = t.value;
    save();
    emit('objects-changed');
  } else if (t.dataset.f === 'color') {
    o.color = t.value;
    objectVisualChanged(o);
    emit('objects-changed');
  } else if (t.dataset.vec) {
    let v = parseFloat(t.value);
    if (!isFinite(v)) return;
    if (t.dataset.vec === 'scale' && Math.abs(v) < 0.01) v = 0.01;
    o[t.dataset.vec][t.dataset.axis] = v;
    objectVisualChanged(o);
  } else if (t.dataset.bi !== undefined) {
    const b = o.behaviors[+t.dataset.bi];
    if (!b) return;
    const type = t.dataset.pt;
    const v = type === 'bool' ? t.checked : type === 'number' ? parseFloat(t.value) : t.value;
    if (type === 'number' && !isFinite(v)) return;
    b.params[t.dataset.pk] = v;
    save();
  }
}

function onChange(e) {
  const t = e.target, o = selectedObject();
  if (!o) return;
  if (t.dataset.f === 'shape') { o.shape = t.value; objectVisualChanged(o); emit('objects-changed'); }
  if (t.dataset.f === 'body') { o.body = t.value; save(); render(); }
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const o = selectedObject();
  if (!o) return;
  switch (b.dataset.act) {
    case 'add-beh': {
      const id = root.querySelector('#f-addasset').value;
      if (!id) return;
      o.behaviors.push({ asset: id, params: {} });
      save(); render(); emit('objects-changed');
      break;
    }
    case 'rm-beh':
      o.behaviors.splice(+b.dataset.i, 1);
      save(); render(); emit('objects-changed');
      break;
    case 'open-asset': openAsset(b.dataset.id); break;
    case 'dup': duplicateObject(o.id); break;
    case 'del': confirmTwice(b, 'もう一度押すと削除', () => removeObject(o.id)); break;
  }
}
