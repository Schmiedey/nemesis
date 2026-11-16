// Glue: input, game loop, saves, overlays.
import { createGame, step, pick } from './sim.js';
import { loadSave, writeSave, resetSave, addRecruit, bossTypeFor, partyOf, PARTY_SIZE } from './save.js';
import { draw, resize, consumeFx, updateFx, resetFx, loadSprites } from './render.js';
import * as ui from './ui.js';
import * as audio from './audio.js';

const cv = document.getElementById('c'), cx = cv.getContext('2d');
addEventListener('resize', () => resize(cv)); resize(cv);

let save = loadSave();
let g = null;
let mode = 'start'; // start | roster | play | lvl | pause | dead | won
const keys = {};

function toStart() { mode = 'start'; g = null; ui.showStart(save, bossTypeFor(save)); }
function toRoster() { mode = 'roster'; g = null; ui.showRoster(save, toggleParty); }
function resume() { if (mode === 'pause') { mode = 'play'; ui.setPause(false); } }

function toggleParty(id) {
  const i = save.party.indexOf(id);
  if (i >= 0) save.party.splice(i, 1);
  else if (save.party.length < PARTY_SIZE) save.party.push(id);
  audio.sfx('ui'); writeSave(save); ui.showRoster(save, toggleParty);
}

function begin() {
  ui.hideAll(); resetFx();
  g = createGame({
    seed: (Math.random() * 2 ** 32) >>> 0,
    party: partyOf(save).map(n => ({ ...n, perks: { ...n.perks } })),
    bossType: bossTypeFor(save),
  });
  mode = 'play'; audio.sfx('start');
}

function choose(i) {
  if (mode !== 'lvl') return;
  pick(g, i); audio.sfx('pick');
  if (g.state === 'lvl') ui.showLevel(g, choose); else { ui.hideLevel(); mode = 'play'; }
}

function endRun() {
  save.runs++;
  const newBest = g.t > save.best;
  if (newBest) save.best = g.t;
  return newBest;
}

function onDeath() {
  mode = 'dead';
  const newBest = endRun();
  save.deaths[g.killer] = (save.deaths[g.killer] || 0) + 1;
  const res = addRecruit(save, g.recruit);
  writeSave(save);
  const run = g;
  setTimeout(() => { if (g === run && mode === 'dead') { ui.showDead(run, save, res, newBest); if (res.status !== 'rejected') audio.sfx('stamp', 0.5); } }, 700);
}

function onWin() {
  mode = 'won';
  endRun(); save.wins++;
  const promoted = partyOf(save);
  for (const n of promoted) n.q = Math.min(3, n.q + 0.25); // survivors of a win rank up
  writeSave(save);
  const run = g;
  setTimeout(() => { if (g === run && mode === 'won') ui.showWon(run, save, promoted); }, 900);
}

const muteBtn = document.getElementById('mute');
const showMute = () => { muteBtn.textContent = audio.isMuted() ? 'sound off (M)' : 'sound on (M)'; };
const flipMute = () => { audio.toggleMute(); showMute(); };
muteBtn.onclick = () => { muteBtn.blur(); flipMute(); }; showMute();
addEventListener('pointerdown', audio.unlock);
addEventListener('click', e => { if (e.target.closest('button')) audio.sfx('ui'); });

addEventListener('keydown', e => {
  keys[e.code] = true; audio.unlock();
  if (e.code === 'KeyM' && !e.repeat) flipMute();
  const over = mode === 'dead' || mode === 'won';
  const menu = mode === 'start' || mode === 'roster';
  if (e.code === 'Space' && (menu || over)) { e.preventDefault(); begin(); }
  else if ((e.code === 'KeyR' || e.code === 'KeyC') && (mode === 'start' || over)) toRoster();
  else if (e.code === 'Escape' && (mode === 'roster' || over)) toStart();
  else if (e.code === 'KeyQ' && mode === 'pause') toStart();
  else if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'pause')) {
    mode = mode === 'play' ? 'pause' : 'play'; ui.setPause(mode === 'pause');
  } else if (mode === 'lvl') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0) choose(i); }
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (mode === 'play') { mode = 'pause'; ui.setPause(true); } });
ui.bindMenus({
  play: begin, roster: toRoster, menu: toStart, resume,
  reset: () => { if (confirm('Forget all your nemeses and stats?')) { save = resetSave(); toRoster(); } },
});

const input = () => ({
  mx: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
  my: (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0),
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (mode === 'play') {
    step(g, dt, input()); consumeFx(g);
    for (const f of g.fx) if (f.k === 'snd') audio.sfx(f.n);
    if (g.state === 'lvl') { mode = 'lvl'; ui.showLevel(g, choose); }
    else if (g.state === 'dead') onDeath();
    else if (g.state === 'won') onWin();
  }
  if (mode === 'play' || mode === 'dead' || mode === 'won') updateFx(dt);
  audio.scene(mode, g);
  draw(cv, cx, g);
  requestAnimationFrame(loop);
}

loadSprites();
toStart();
requestAnimationFrame(loop);

// Debug hook for automated tests (Playwright).
window.__game = { get g() { return g; }, get mode() { return mode; }, get save() { return save; }, begin, choose, toStart, toRoster, audio };
