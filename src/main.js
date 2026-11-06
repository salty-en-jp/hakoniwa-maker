// 起動: 各部分を組み立てて、毎フレームのループを回す

import * as THREE from 'three';
import { loadSavedProject } from './core/project.js';
import { DEFAULT_SAMPLE } from './samples/index.js';
import { $, $$ } from './editor/dom.js';
import { state, emit } from './editor/state.js';
import { createViewport } from './editor/viewport.js';
import { initActions, loadProject, select, setTransform, setGizmoMode, showTab } from './editor/actions.js';
import { initTabs } from './editor/panels/tabs.js';
import { initScenePanel } from './editor/panels/scene-panel.js';
import { initInspector } from './editor/panels/inspector.js';
import { initLogicPanel } from './editor/panels/logic-panel.js';
import { initPlayMode, stepPlay, getRuntime } from './editor/play-mode.js';
import { bindKeyboard } from './editor/keyboard.js';

const viewport = createViewport($('#viewport'), {
  onPick: id => select(id, { fromView: true }),
  onTransform: setTransform
});

initActions(viewport);
initTabs();
initScenePanel($('#tab-scene'));
initInspector($('#tab-inspect'));
initLogicPanel($('#tab-assets'));
initPlayMode(viewport);
bindKeyboard();

// ギズモの切り替えボタン
$$('.modes button').forEach(b => b.addEventListener('click', () => {
  setGizmoMode(b.dataset.mode);
  $$('.modes button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
}));

// 保存されたものがあれば続きから、なければサンプルで始める
const saved = loadSavedProject();
loadProject(saved || DEFAULT_SAMPLE.create());
state.selectedAssetId = state.project.assets.some(a => a.id === 'move') ? 'move' : state.selectedAssetId;
showTab('inspect');
const player = state.project.objects.find(o => o.tag === 'player');
select(player ? player.id : null);

// ループ
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (state.playing) stepPlay(dt);
  else viewport.updateEditor();
  viewport.render();
}
loop();

// 開発中にコンソールから中身を見られるように
window.hakoniwa = { state, viewport, emit, get runtime() { return getRuntime(); } };
