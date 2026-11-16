// Glue: input, game loop, saves, overlays.
import { createGame, step, pick } from './sim.js';
import { loadSave, writeSave, resetSave } from './save.js';
import { draw, resize, consumeFx, updateFx, resetFx } from './render.js';
import * as ui from './ui.js';

const cv = document.getElementById('c'), cx = cv.getContext('2d');
addEventListener('resize', () => resize(cv)); resize(cv);

let save = loadSave();
let g = null;
let mode = 'start'; // start | play | lvl | pause | dead
const keys = {};

function begin() {
  ui.hideAll(); resetFx();
  g = createGame({ seed: (Math.random() * 2 ** 32) >>> 0, roster: { ...save.roster } });
  mode = 'play';
}

function choose(i) {
  if (mode !== 'lvl') return;
  pick(g, i);
  if (g.state === 'lvl') ui.showLevel(g, choose); else { ui.hideLevel(); mode = 'play'; }
}

function onDeath() {
  mode = 'dead';
  const k = g.killer, first = !save.roster[k], newBest = g.t > save.best;
  save.roster[k] = (save.roster[k] || 0) + 1; save.runs++;
  if (newBest) save.best = g.t;
  writeSave(save);
  const run = g;
  setTimeout(() => { if (g === run && mode === 'dead') ui.showDead(run, save, { first, newBest }); }, 700);
}

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' && (mode === 'start' || mode === 'dead')) { e.preventDefault(); begin(); }
  else if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'pause')) {
    mode = mode === 'play' ? 'pause' : 'play'; ui.setPause(mode === 'pause');
  } else if (mode === 'lvl') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0) choose(i); }
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (mode === 'play') { mode = 'pause'; ui.setPause(true); } });
ui.onReset(() => { if (confirm('Forget all your nemeses?')) { save = resetSave(); ui.showStart(save); } });

const input = () => ({
  mx: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
  my: (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0),
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (mode === 'play') {
    step(g, dt, input()); consumeFx(g);
    if (g.state === 'lvl') { mode = 'lvl'; ui.showLevel(g, choose); }
    else if (g.state === 'dead') onDeath();
  }
  if (mode === 'play' || mode === 'dead') updateFx(dt);
  draw(cv, cx, g, save.roster);
  requestAnimationFrame(loop);
}

ui.showStart(save);
requestAnimationFrame(loop);

// Debug hook for automated tests (Playwright).
window.__game = { get g() { return g; }, get mode() { return mode; }, get save() { return save; }, begin, choose };
