// 再生と停止の切り替え。再生中は Runtime がゲームを動かす

import { Runtime } from '../core/runtime.js';
import { input } from '../core/input.js';
import { $, $$ } from './dom.js';
import { state, emit } from './state.js';
import { select } from './actions.js';
import { createPlayUI, bindTouchControls } from './play-ui.js';

let viewport;
let ui;
let touch;
let runtime = null;
let savedCamera = null;

export function initPlayMode(vp) {
  viewport = vp;
  ui = createPlayUI();
  touch = bindTouchControls(input);
  $('#playBtn').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));
  $('#retryBtn').addEventListener('click', restartPlay);
  $('#backBtn').addEventListener('click', stopPlay);
}

function createRuntime() {
  input.reset();
  ui.reset();
  ui.clearLog();
  runtime = new Runtime({ project: state.project, scene: viewport.scene, camera: viewport.camera, input, ui });
}

function disposeRuntime() {
  if (!runtime) return;
  runtime.dispose();
  runtime = null;
  ui.reset();
}

export function startPlay() {
  if (state.playing) return;
  state.playing = true;
  document.body.classList.add('playing');
  document.body.classList.remove('panel-max');
  $('#playBtn').textContent = '■ 停止';
  $$('.modes button').forEach(b => { b.disabled = true; });
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

  savedCamera = viewport.saveCamera();
  viewport.setEditing(false);
  createRuntime();
  emit('play-changed', true);
}

export function restartPlay() {
  if (!state.playing) return;
  disposeRuntime();
  viewport.restoreCamera(savedCamera, { syncOrbit: false });
  createRuntime();
}

export function stopPlay() {
  if (!state.playing) return;
  disposeRuntime();
  state.playing = false;
  document.body.classList.remove('playing');
  $('#playBtn').textContent = '▶ 再生';
  $$('.modes button').forEach(b => { b.disabled = false; });
  viewport.setEditing(true);
  viewport.restoreCamera(savedCamera);
  input.reset();
  touch.reset();
  select(state.selectedId);
  emit('play-changed', false);
}

/** 再生中の Runtime(開発中の確認用) */
export const getRuntime = () => runtime;

/** 毎フレーム呼ぶ。再生中ならゲームを進める */
export function stepPlay(dt) {
  if (state.playing && runtime) runtime.step(dt);
}
