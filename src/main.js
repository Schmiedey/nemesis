// Glue: input, game loop, saves, overlays.
import { createGame, step, pick } from './sim.js';
import { loadSave, writeSave, resetSave, addRecruit, bossTypeFor, partyOf, growParty, evolve, checkFeats, boonsOf, today, dailySeed, PARTY_SIZE } from './save.js';
import { draw, resize, consumeFx, updateFx, resetFx, loadSprites } from './render.js';
import * as ui from './ui.js';
import * as audio from './audio.js';

const cv = document.getElementById('c'), cx = cv.getContext('2d');
addEventListener('resize', () => resize(cv)); resize(cv);

let save = loadSave();
let g = null;
let mode = 'start'; // start | roster | feats | play | lvl | pause | dead | won
let kind = 'normal'; // what the current or last run was: normal | hard | daily
const keys = {};

function toStart() { mode = 'start'; g = null; ui.showStart(save, bossTypeFor(save)); }
function toRoster() { mode = 'roster'; g = null; ui.showRoster(save, toggleParty, pickEvo); }
function pickEvo(id, evoId) { if (evolve(save, id, evoId)) { audio.sfx('level'); checkFeats(save); writeSave(save); } ui.showRoster(save, toggleParty, pickEvo); }
function toFeats() { mode = 'feats'; ui.showFeats(save); }
function flipHard() { if (save.wins > 0) { save.hard = !save.hard; writeSave(save); toStart(); } }
// The boon button steps through: none, then each boon you have unlocked.
function nextBoon() {
  const list = [null, ...boonsOf(save)];
  save.boon = list[(list.indexOf(save.boon) + 1) % list.length]; writeSave(save); toStart();
}
function resume() { if (mode === 'pause') { mode = 'play'; ui.setPause(false); } }

function toggleParty(id) {
  const i = save.party.indexOf(id);
  if (i >= 0) save.party.splice(i, 1);
  else if (save.party.length < PARTY_SIZE) save.party.push(id);
  audio.sfx('ui'); writeSave(save); ui.showRoster(save, toggleParty, pickEvo);
}

// k: 'normal' (or 'hard' if Nemesis+ is switched on), or 'daily' for today's fixed seed.
function begin(k = 'normal') {
  ui.hideAll(); resetFx();
  kind = k === 'daily' ? 'daily' : save.hard && save.wins > 0 ? 'hard' : 'normal';
  g = createGame({
    seed: kind === 'daily' ? dailySeed(today()) : (Math.random() * 2 ** 32) >>> 0,
    party: partyOf(save).map(n => ({ ...n, perks: { ...n.perks } })),
    bossType: bossTypeFor(save), hard: kind === 'hard', boon: save.boon,
  });
  mode = 'play'; audio.sfx('start');
}

function choose(i) {
  if (mode !== 'lvl') return;
  pick(g, i); audio.sfx('pick');
  if (g.state === 'lvl') ui.showLevel(g, choose); else { ui.hideLevel(); mode = 'play'; }
}

// Records the run. Each kind of run keeps its own best time. Returns what the end screen needs.
function endRun(won) {
  save.runs++;
  let prev;
  if (kind === 'daily') {
    if (save.daily.date !== today()) save.daily = { date: today(), best: 0, won: false };
    prev = save.daily.best; save.daily.best = Math.max(prev, g.t); if (won) save.daily.won = true;
  } else if (kind === 'hard') { prev = save.bestHard; save.bestHard = Math.max(prev, g.t); if (won) save.winsHard++; }
  else { prev = save.best; save.best = Math.max(prev, g.t); }
  if (won) save.wins++;
  const growth = growParty(save, g.party, won);
  const run = { t: g.t, kills: g.kills, won, dead: !won, party: g.party.length, runts: g.party.length === 3 && g.party.every(n => n.q < 0.7),
    hard: kind === 'hard', daily: kind === 'daily', opened: g.opened };
  return { newBest: g.t > prev, best: Math.max(prev, g.t), growth, run, kind };
}

function onDeath() {
  mode = 'dead';
  const end = endRun(false);
  save.deaths[g.killer] = (save.deaths[g.killer] || 0) + 1;
  const res = addRecruit(save, g.recruit);
  end.feats = checkFeats(save, end.run);
  writeSave(save);
  const run = g;
  setTimeout(() => { if (g === run && mode === 'dead') { ui.showDead(run, save, res, end); if (res.status !== 'rejected') audio.sfx('stamp', 0.5); } }, 700);
}

function onWin() {
  mode = 'won';
  const end = endRun(true); // a win is worth extra growth for everyone who came
  end.feats = checkFeats(save, end.run);
  writeSave(save);
  const run = g;
  setTimeout(() => { if (g === run && mode === 'won') ui.showWon(run, save, end); }, 900);
}

const muteBtn = document.getElementById('mute');
const showMute = () => { muteBtn.textContent = (audio.isMuted() ? 'sound off' : 'sound on') + (matchMedia('(pointer:coarse)').matches ? '' : ' (M)'); };
const flipMute = () => { audio.toggleMute(); showMute(); };
muteBtn.onclick = () => { muteBtn.blur(); flipMute(); }; showMute();
addEventListener('pointerdown', audio.unlock);
addEventListener('click', e => { if (e.target.closest('button')) audio.sfx('ui'); });

addEventListener('keydown', e => {
  keys[e.code] = true; audio.unlock();
  if (e.code === 'KeyM' && !e.repeat) flipMute();
  const over = mode === 'dead' || mode === 'won';
  const menu = mode === 'start' || mode === 'roster';
  if (e.code === 'Space' && (menu || over)) { e.preventDefault(); begin(over ? kind : 'normal'); }
  else if (e.code === 'KeyD' && mode === 'start') begin('daily');
  else if (e.code === 'KeyF' && mode === 'start') toFeats();
  else if ((e.code === 'KeyR' || e.code === 'KeyC') && (mode === 'start' || over)) toRoster();
  else if (e.code === 'Escape' && (mode === 'roster' || mode === 'feats' || over)) toStart();
  else if (e.code === 'KeyQ' && mode === 'pause') toStart();
  else if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'pause')) {
    mode = mode === 'play' ? 'pause' : 'play'; ui.setPause(mode === 'pause');
  } else if (mode === 'lvl') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0) choose(i); }
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (mode === 'play') { mode = 'pause'; ui.setPause(true); } });
ui.bindMenus({
  play: () => begin('normal'), again: () => begin(kind), daily: () => begin('daily'), hard: flipHard, boon: nextBoon, feats: toFeats,
  roster: toRoster, menu: toStart, resume,
  reset: () => { if (confirm('Forget all your nemeses and stats?')) { save = resetSave(); toRoster(); } },
});

// Touch: a stick appears where the thumb lands on the game; drag to steer. Direction only, speed is always full.
const joyEl = document.getElementById('joy'), knob = joyEl.firstElementChild, pauseBtn = document.getElementById('bPause');
let joy = null; // { id, x0, y0, dx, dy }
const JOY_R = 48, JOY_DEAD = 8;
const endJoy = () => { joy = null; joyEl.classList.add('hidden'); };
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || mode !== 'play' || joy) return;
  joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
  joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
  knob.style.transform = ''; joyEl.classList.remove('hidden');
});
addEventListener('pointermove', e => {
  if (!joy || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.x0, dy = e.clientY - joy.y0; const l = Math.hypot(dx, dy);
  if (l > JOY_R) { dx *= JOY_R / l; dy *= JOY_R / l; }
  joy.dx = dx; joy.dy = dy; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, e => { if (joy && e.pointerId === joy.id) endJoy(); });
addEventListener('contextmenu', e => e.preventDefault());
pauseBtn.onclick = () => { pauseBtn.blur(); if (mode === 'play') { mode = 'pause'; ui.setPause(true); } };

const input = () => {
  if (joy && Math.hypot(joy.dx, joy.dy) > JOY_DEAD) return { mx: joy.dx, my: joy.dy };
  return {
    mx: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
    my: (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0),
  };
};

let last = performance.now(), hitStop = 0;
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (mode === 'play') {
    if (hitStop > 0) hitStop -= dt;                                     // a few frozen frames make a big hit land
    else {
      step(g, dt, input()); consumeFx(g);
      for (const f of g.fx) { if (f.k === 'snd') audio.sfx(f.n); else if (f.k === 'shake' && f.v >= 10) hitStop = 0.05; }
    }
    if (g.state === 'lvl') { mode = 'lvl'; ui.showLevel(g, choose); }
    else if (g.state === 'dead') onDeath();
    else if (g.state === 'won') onWin();
  }
  if (mode === 'play' || mode === 'dead' || mode === 'won') updateFx(dt);
  if (mode !== 'play' && joy) endJoy();
  pauseBtn.classList.toggle('hidden', mode !== 'play');
  audio.scene(mode, g);
  draw(cv, cx, g);
  requestAnimationFrame(loop);
}

loadSprites();
toStart();
requestAnimationFrame(loop);

// Debug hook for automated tests (Playwright).
window.__game = { get g() { return g; }, get mode() { return mode; }, get save() { return save; }, begin, choose, toStart, toRoster, audio };
