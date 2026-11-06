// インスペクタ タブ: 選んだオブジェクトの設定と、付いているロジックの調整

import { SHAPES, BODIES } from '../../core/defs.js';
import { findAsset } from '../../core/project.js';
import { treeOrder, isInSubtree } from '../../core/tree.js';
import { instanceRootOf, findPrefab, isModified } from '../../core/prefab.js';
import { esc, confirmTwice } from '../dom.js';
import { state, on, emit, selectedObject } from '../state.js';
import {
  save, objectVisualChanged, duplicateObject, removeObject, openAsset, addObject, setParent, descendantCount,
  makePrefab, applyToPrefab, revertInstance, unpackInstance
} from '../actions.js';

let root;

export function initInspector(container) {
  root = container;
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
  on('selection-changed', render);
  on('assets-changed', render);
  on('transform-changed', o => { syncTransformFields(o); refreshPrefabBox(); });
  on('prefabs-changed', render);
}

/** 「変更あり」の表示だけを描き直す(入力中の欄のフォーカスを失わないように) */
function refreshPrefabBox() {
  const o = selectedObject();
  const box = root && root.querySelector('.prefab-box');
  if (o && box) box.outerHTML = prefabBox(o);
}

/** 親の候補(自分と自分の子孫は除く)。ツリーの順に字下げして並べる */
function parentOptions(o) {
  const objs = state.project.objects;
  const opts = treeOrder(objs)
    .filter(({ obj }) => !isInSubtree(objs, obj.id, o.id))
    .map(({ obj, depth }) => `<option value="${esc(obj.id)}" ${obj.id === o.parent ? 'selected' : ''}>${'　'.repeat(depth)}${SHAPES[obj.shape].glyph} ${esc(obj.name)}</option>`);
  return `<option value="">(なし: 一番上)</option>${opts.join('')}`;
}

function prefabBox(o) {
  const root = instanceRootOf(state.project, o.id);
  const def = root && findPrefab(state.project, root.prefab);
  if (!def) {
    const n = descendantCount(o.id);
    return `<div class="prefab-box"><p>${n ? `このオブジェクトと子 ${n} 個を` : 'このオブジェクトを'}型として保存し、何個でも置けるようにします。</p>
      <div class="actions"><button class="btn" data-act="make-prefab">プレハブにする</button></div></div>`;
  }
  const modified = isModified(state.project, root);
  const where = root.id === o.id ? 'のインスタンスです' : `のインスタンス「${esc(root.name)}」の一部です`;
  return `<div class="prefab-box">
    <p><b>${esc(def.name)}</b> ${where} ${modified ? '<span class="chip mod">変更あり</span>' : ''}</p>
    <p>ここで変えた中身を「反映」すると、同じプレハブの他のものも全部そろいます。インスタンスごとに違ってよいのは、名前・位置・回転・大きさだけです。</p>
    <div class="actions">
      <button class="btn primary" data-act="apply-prefab" data-root="${esc(root.id)}" ${modified ? '' : 'disabled'}>プレハブに反映</button>
      <button class="btn" data-act="revert-prefab" data-root="${esc(root.id)}" ${modified ? '' : 'disabled'}>元に戻す</button>
      <button class="btn" data-act="unpack-prefab" data-root="${esc(root.id)}">つながりを切る</button>
    </div></div>`;
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
  <div class="sec"><h3>親子</h3>
    <label>親<select id="f-parent" data-f="parent">${parentOptions(o)}</select></label>
    <div class="addrow">
      <select id="f-childshape" aria-label="子として足す形">${Object.entries(SHAPES).map(([k, sh]) => `<option value="${k}">${sh.glyph} ${sh.label}</option>`).join('')}</select>
      <button class="btn" data-act="add-child">子を足す</button>
    </div>
  </div>
  <div class="sec"><h3>トランスフォーム${o.parent ? '<span class="sp hint">親から見た値</span>' : ''}</h3>
    ${vecRow('位置', 'pos', o.pos, 0.25)}${vecRow('回転°', 'rot', o.rot, 15)}${vecRow('大きさ', 'scale', o.scale, 0.1)}
  </div>
  <div class="sec"><h3>物理</h3>
    ${o.shape === 'empty'
      ? '<p class="hint">形が「空」のものは当たり判定を持ちません。子をまとめる親として使います。</p>'
      : `<select id="f-body" data-f="body">${Object.entries(BODIES).map(([k, [label]]) =>
      `<option value="${k}" ${k === o.body ? 'selected' : ''}>${label}</option>`).join('')}</select>
    <p class="hint">${BODIES[o.body][1]}${o.parent && o.body === 'dynamic' ? ' 親がいるあいだは親にくっついて動き、重力では落ちません。' : ''}</p>`}
  </div>
  <div class="sec"><h3>ロジック <span class="count">${o.behaviors.length}</span></h3>
    ${o.behaviors.map(behaviorCard).join('') || '<p class="hint">まだロジックがありません。下から追加すると、再生中に動き出します。</p>'}
    <div class="addrow">
      <select id="f-addasset" aria-label="追加するロジック">${state.project.assets.map(a =>
        `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>
      <button class="btn primary" data-act="add-beh">追加</button>
    </div>
  </div>
  <div class="sec"><h3>プレハブ</h3>${prefabBox(o)}</div>
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
  refreshPrefabBox();
}

function onChange(e) {
  const t = e.target, o = selectedObject();
  if (!o) return;
  if (t.dataset.f === 'shape') { o.shape = t.value; objectVisualChanged(o); emit('objects-changed'); render(); }
  if (t.dataset.f === 'parent') setParent(o.id, t.value || null);
  if (t.dataset.f === 'body') { o.body = t.value; save(); render(); }
  refreshPrefabBox();
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
    case 'add-child': addObject(root.querySelector('#f-childshape').value, o.id); break;
    case 'make-prefab': makePrefab(o.id); break;
    case 'apply-prefab': applyToPrefab(b.dataset.root); break;
    case 'revert-prefab': confirmTwice(b, 'もう一度押すと戻す', () => revertInstance(b.dataset.root)); break;
    case 'unpack-prefab': unpackInstance(b.dataset.root); break;
    case 'dup': duplicateObject(o.id); break;
    case 'del': {
      const n = descendantCount(o.id);
      confirmTwice(b, n ? `子 ${n} 個ごと削除` : 'もう一度押すと削除', () => removeObject(o.id));
      break;
    }
  }
}
