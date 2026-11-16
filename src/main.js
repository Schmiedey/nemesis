// Glue: input, game loop, saves, overlays.
import { createGame, step, pick, reroll, recruitQuality } from './sim.js';
import { loadSave, writeSave, resetSave, setSlot, currentSlot, addRecruit, bossTypeFor, grudgeFor, feedGrudge, partyOf, growParty, evolve, checkFeats, boonsOf, today, dailySeed, addGear, equip, progress, buyMeta, PARTY_SIZE } from './save.js';
import { masteryLevel, LEG_TRAIT } from './data.js';
import { draw, resize, setQuality, QUALITY_STEPS, consumeFx, updateFx, resetFx, loadSprites, levelFx, pickFx } from './render.js';
import * as ui from './ui.js';
import * as audio from './audio.js';

const cv = document.getElementById('c'), cx = cv.getContext('2d');
const hud = document.getElementById('hud'), hx = hud.getContext('2d');   // sharp layer for the HUD, over the pixel-art world
addEventListener('resize', () => resize(cv, hud)); resize(cv, hud);
// Canvas text needs the pixel fonts loaded before it can use them.
if (document.fonts) for (const f of ['16px Silkscreen', 'bold 16px Silkscreen', '16px "Pixelify Sans"']) document.fonts.load(f);

let save = loadSave();
let g = null;
let tabMode = null;   // which screen the tab bar was last drawn for; null forces a redraw
let mode = 'start'; // start | classes | roster | feats | loadout | play | lvl | pause | dead | won
let kind = 'normal'; // what the current or last run was: normal | hard | daily
const keys = {};

function toStart() { tabMode = null; mode = 'start'; g = null; ui.showStart(save); }
// Save slots: switch, start fresh, or delete. Deleting asks first; it cannot be undone.
function toSaves() {
  tabMode = null; mode = 'saves';
  ui.showSaves(
    n => { setSlot(n); save = loadSave(); audio.sfx('pick'); toStart(); },
    n => { if (confirm(`Delete save ${n}? Everything in it is lost for good.`)) { resetSave(undefined, n); if (n === currentSlot()) save = loadSave(); toSaves(); } },
  );
}
function toMissions() { tabMode = null; mode = 'missions'; ui.showMissions(save, bossTypeFor(save)); }
function toRoster() { tabMode = null; mode = 'roster'; g = null; ui.showRoster(save, toggleParty, pickEvo); }
function pickEvo(id, evoId) { if (evolve(save, id, evoId)) { audio.sfx('level'); checkFeats(save); writeSave(save); } ui.showRoster(save, toggleParty, pickEvo); }
function toFeats() { tabMode = null; mode = 'feats'; ui.showFeats(save); }
function toClasses() { tabMode = null; mode = 'classes'; save.seen = { classes: save.classes.length, gear: save.gear.owned.length }; ui.showClasses(save, id => { if (!save.classes.includes(id)) return; save.cls = id; writeSave(save); audio.sfx('pick'); toClasses(); }); }
function toLoadout() { tabMode = null; mode = 'loadout'; save.seen = { classes: save.classes.length, gear: save.gear.owned.length }; ui.showLoadout(save, id => { if (equip(save, id)) writeSave(save); toLoadout(); }); }
// Nemesis+ steps through the tiers you have unlocked: 0 (off), 1, 2 ...
function flipHard() { if (save.tierMax > 0) { save.tier = (save.tier + 1) % (save.tierMax + 1); save.hard = save.tier > 0; writeSave(save); toStart(); } }
function toShrine() { tabMode = null; mode = 'shrine'; ui.showShrine(save, id => { if (buyMeta(save, id)) { audio.sfx('level'); writeSave(save); ui.confetti(14); } toShrine(); }); }
// Copy a one-line result to the clipboard, to send to a friend (the daily run has the same map and spawns for everyone).
let lastResult = '';
function share() {
  if (!lastResult) return;
  const done = () => ui.toast('RESULT COPIED');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lastResult).then(done, () => ui.toast('COULD NOT COPY'));
  else ui.toast('COULD NOT COPY');
}
// The boon button steps through: none, then each boon you have unlocked.
function nextBoon() {
  const list = [null, ...boonsOf(save)];
  save.boon = list[(list.indexOf(save.boon) + 1) % list.length]; writeSave(save); toClasses();
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
  kind = k === 'daily' ? 'daily' : save.tier > 0 ? 'hard' : 'normal';
  g = createGame({
    seed: kind === 'daily' ? dailySeed(today()) : (Math.random() * 2 ** 32) >>> 0,
    party: partyOf(save).map(n => ({ ...n, perks: { ...n.perks } })),
    bossType: bossTypeFor(save), grudge: grudgeFor(save), tier: kind === 'hard' ? save.tier : 0, boon: save.boon, meta: save.meta, mastery: masteryLevel(save.mastery[save.cls] || 0),
    loadout: save.gear.loadout, owned: save.gear.owned, cls: save.cls,
  });
  for (const k in keys) keys[k] = false;                 // a new run never starts with a direction already held
  mode = 'play'; audio.sfx('start');
  if (qStep > 0) applyQuality(qStep - 1);   // a new run tries one step sharper again
}

function doReroll() { if (mode === 'lvl' && lvlWait <= 0 && !picking && reroll(g)) { audio.sfx('ui'); ui.showLevel(g, choose); } }
// Levelling up is a moment: the game freezes, a beam and sparks play, then the cards are dealt.
let lvlWait = 0, picking = false;
function startLevel(wait = 0.75) { mode = 'lvl'; lvlWait = wait; picking = false; ui.hideLevel(); levelFx(g); }
function choose(i) {
  if (mode !== 'lvl' || lvlWait > 0 || picking || !g.choices[i]) return;
  picking = true; ui.pickCard(i); audio.sfx('pick');
  const run = g;
  setTimeout(() => {                                   // let the chosen card flash before the game resumes
    if (g !== run || mode !== 'lvl') return;
    pickFx(g, g.choices[i].n, g.rar[i]); pick(g, i);
    if (g.state === 'lvl') startLevel(0.5); else { ui.hideLevel(); mode = 'play'; picking = false; }
  }, 320);
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
    hard: kind === 'hard', daily: kind === 'daily', opened: g.opened, tier: g.tier, boss: !!g.bossAt, cls: g.cls, bonus: g.bonusSouls, soulMul: g.soulMul, streak: g.bestStreak,
    // the numbers missions are measured against
    ms: { kills: g.kills, t: g.t, lvl: g.P.lvl, opened: g.opened, powerups: g.powerups, elites: g.elites, streak: g.bestStreak, acts: g.acts, epics: g.epics, slay: won ? 1 : 0, nemKills: g.party.reduce((a, n) => a + (n.kills || 0), 0),
      prize: !won && g.recruit?.prize ? 1 : 0, vet: !won && g.recruit?.q >= 1.3 ? 1 : 0,
      ...Object.fromEntries(Object.entries(g.killsBy).map(([k, v]) => ['k_' + k, v])) } };
  const mm = Math.floor(g.t / 60) + ':' + String(Math.floor(g.t % 60)).padStart(2, '0');
  lastResult = `NEMESIS${kind === 'daily' ? ' daily ' + today() : kind === 'hard' ? ' N+' + g.tier : ''} | ${g.cls || 'no class'} | ${won ? 'NEMESIS SLAIN in ' : 'survived '}${mm} | ${g.kills} kills | best streak ${g.bestStreak}`;
  return { newBest: g.t > prev, best: Math.max(prev, g.t), growth, run, kind, gear: addGear(save, g.loot), prog: progress(save, run) };
}

function onDeath() {
  mode = 'dead';
  const end = endRun(false);
  save.deaths[g.killer] = (save.deaths[g.killer] || 0) + 1;
  grudgeFor(save); feedGrudge(save, Object.keys(g.picks).filter(k => LEG_TRAIT[k] && g.picks[k]), false, !!g.bossAt);
  const res = addRecruit(save, g.recruit);
  end.feats = checkFeats(save, end.run);
  writeSave(save);
  const run = g;
  setTimeout(() => { if (g === run && mode === 'dead') { ui.showDead(run, save, res, end); if (res.status !== 'rejected') audio.sfx('stamp', 0.5); } }, 700);
}

function onWin() {
  mode = 'won';
  const end = endRun(true); // a win is worth extra growth for everyone who came
  end.grudge = g.grudge; feedGrudge(save, [], true, true);
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
  if (e.metaKey || e.ctrlKey || e.altKey) { clearKeys(); return; }   // a shortcut, not a move: never let it stick a direction
  keys[e.code] = true; audio.unlock();
  if (e.code === 'KeyM' && !e.repeat) flipMute();
  const over = mode === 'dead' || mode === 'won';
  const menu = mode === 'start' || mode === 'roster';
  if (e.code === 'Space' && mode === 'play') e.preventDefault();
  if (e.code === 'Space' && mode === 'dead' && ui.deadNext()) { e.preventDefault(); return; }   // first Space: from the recruitment to the summary
  if (e.code === 'Space' && (menu || over)) { e.preventDefault(); begin(over ? kind : 'normal'); }
  else if (e.code === 'KeyD' && mode === 'start') begin('daily');
  else if (e.code === 'KeyF' && mode === 'start') toFeats();
  else if (e.code === 'KeyL' && mode === 'start') toLoadout();
  else if (e.code === 'KeyC' && mode === 'start') toClasses();
  else if (e.code === 'KeyU' && mode === 'start') toShrine();
  else if (e.code === 'KeyG' && mode === 'start') toMissions();
  else if (e.code === 'KeyR' && mode === 'lvl') doReroll();
  else if (e.code === 'KeyR' && (mode === 'start' || over)) toRoster();
  else if (e.code === 'Escape' && (mode === 'roster' || mode === 'feats' || mode === 'loadout' || mode === 'classes' || mode === 'shrine' || mode === 'missions' || mode === 'saves' || over)) toStart();
  else if (e.code === 'KeyQ' && mode === 'pause') toStart();
  else if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'pause')) {
    mode = mode === 'play' ? 'pause' : 'play'; ui.setPause(mode === 'pause');
  } else if (mode === 'lvl') { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0) choose(i); }
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  // On a Mac, keys released while Cmd is held never send their keyup, which leaves you walking. When a modifier
  // comes up, forget every held key; you only have to press the direction again.
  if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') clearKeys();
});
const clearKeys = () => { for (const k in keys) keys[k] = false; };
document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); });
addEventListener('pagehide', clearKeys);
addEventListener('contextmenu', clearKeys);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (mode === 'play') { mode = 'pause'; ui.setPause(true); } });
ui.bindMenus({
  play: () => begin('normal'), again: () => begin(kind), daily: () => begin('daily'), hard: flipHard, boon: nextBoon, feats: toFeats, loadout: toLoadout, classes: toClasses, shrine: toShrine, missions: toMissions, saves: toSaves, reroll: () => doReroll(), share,
  roster: toRoster, menu: toStart, resume,
  reset: () => { if (confirm(`Wipe save ${currentSlot()}? Nemeses, souls, unlocks and stats are all lost for good.`)) { save = resetSave(); toRoster(); } },
});

// Touch: a stick appears where the thumb lands on the game; drag to steer. Direction only, speed is always full.
const joyEl = document.getElementById('joy'), knob = joyEl.firstElementChild, pauseBtn = document.getElementById('bPause');
let joy = null; // { id, x0, y0, dx, dy }
const JOY_R = 48, JOY_DEAD = 8;
const endJoy = () => { joy = null; joyEl.classList.add('hidden'); };
// Listens on the page, not just the canvas, so a thumb on the black bars beside the game still steers.
addEventListener('pointerdown', e => {
  if (e.target !== cv && e.target !== hud && e.target !== document.body && e.target !== document.documentElement) return;
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

// The ability: Space, or the round touch button.
const actBtn = document.getElementById('bAct');
let touchAct = false;
actBtn.addEventListener('pointerdown', e => { e.preventDefault(); touchAct = true; });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) actBtn.addEventListener(ev, () => { touchAct = false; });

// The class ultimate: E, or its own touch button.
const ultBtn = document.getElementById('bUlt');
let touchUlt = false;
ultBtn.addEventListener('pointerdown', e => { e.preventDefault(); touchUlt = true; });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) ultBtn.addEventListener(ev, () => { touchUlt = false; });

const input = () => {
  const act = !!keys.Space || touchAct, ult = !!keys.KeyE || touchUlt;
  if (joy && Math.hypot(joy.dx, joy.dy) > JOY_DEAD) return { mx: joy.dx, my: joy.dy, act, ult };
  return {
    act, ult,
    mx: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
    my: (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0),
  };
};

let last = performance.now(), hitStop = 0;

// Performance: if frames stay slow, draw fewer pixels; at the lowest step also drop the lighting and shadows.
let qStep = 0, slowFor = 0, frameMs = 16.7, workMs = 0, showPerf = false;
const perfEl = document.getElementById('perf');
function applyQuality(i) { qStep = Math.max(0, Math.min(QUALITY_STEPS.length - 1, i)); slowFor = 0; setQuality(QUALITY_STEPS[qStep], cv, false, hud); }
const perf = () => ({ fps: Math.round(1000 / frameMs), frameMs: +frameMs.toFixed(1), workMs: +workMs.toFixed(2), canvas: cv.width + 'x' + cv.height, quality: QUALITY_STEPS[qStep], lowDetail: false });
addEventListener('keydown', e => { if (e.code === 'Backquote') { showPerf = !showPerf; perfEl.classList.toggle('hidden', !showPerf); } });
let perfTick = 0;
// One frame. If anything in it throws, the error is logged and the next frame still runs: a drawing bug must
// never freeze the game.
let frameErrors = 0, hintAt = 0;
function loop(now) {
  try { frame(now); } catch (e) { if (frameErrors++ < 5) console.error('frame error', e); }
  requestAnimationFrame(loop);
}
function frame(now) {
  const w0 = performance.now(), gap = now - last; last = now;
  frameMs += (Math.min(gap, 200) - frameMs) * 0.05;
  const total = Math.min(0.1, gap / 1000);                                // real time since the last frame
  if (mode === 'play') {
    slowFor = frameMs > 20 ? slowFor + total : 0;
    if (slowFor > 2 && qStep < QUALITY_STEPS.length - 1) applyQuality(qStep + 1);
    // A slow frame must not slow the game clock: take up to 3 steps to catch up.
    let left = total;
    for (let n = 0; n < 3 && left > 0.0005 && g.state === 'play'; n++) {
      const dt = Math.min(0.033, left); left -= dt;
      if (hitStop > 0) { hitStop -= dt; continue; }                       // a few frozen frames for the biggest hits only
      step(g, dt, input()); consumeFx(g);
      for (const f of g.fx) { if (f.k === 'snd') audio.sfx(f.n); else if (f.k === 'shake' && f.v >= 16) hitStop = 0.05; }
    }
    if (g.state === 'lvl') startLevel();
    else if (g.state === 'dead') onDeath();
    else if (g.state === 'won') onWin();
  }
  if (mode === 'lvl' && lvlWait > 0 && (lvlWait -= total) <= 0) { ui.showLevel(g, choose); const top = ui.topRarity(g); if (top !== 'common') audio.sfx(top, top === 'legendary' ? 0.25 : 0.15); }
  if (mode === 'play' || mode === 'dead' || mode === 'won' || mode === 'lvl') updateFx(total);
  // Who would join if you fell right now: the nearest enemy, at the rank this run has earned so far.
  if (mode === 'play' && now - hintAt > 200) {
    hintAt = now; let near = null, nd = 1e12;
    for (const e of g.ents) if (e.team === 'enemy' && !e.dead) { const d = (e.x - g.P.x) ** 2 + (e.y - g.P.y) ** 2; if (d < nd) { nd = d; near = e; } }
    if (!near) g.hint = null;
    else {
      const prize = near.elite ? 'elite' : near.gold ? 'gold' : null, q = recruitQuality(g.t, g.P.lvl, !!near.boss, prize);
      const same = save.nemeses.filter(n => n.type === near.type), weak = same.length >= 3 ? same.reduce((a, b) => (b.q < a.q ? b : a)) : null;
      g.hint = { type: near.type, q, prize, out: !weak ? 'joins' : q > weak.q ? 'replaces ' + weak.name : 'too weak' };
    }
  }
  if (mode !== 'play' && joy) endJoy();
  pauseBtn.classList.toggle('hidden', mode !== 'play'); actBtn.classList.toggle('hidden', mode !== 'play');
  document.body.classList.toggle('playing', mode === 'play');
  if (mode !== tabMode) { tabMode = mode; ui.showTabs(save, mode); }      // the tab bar follows whatever screen is up
  ultBtn.classList.toggle('hidden', mode !== 'play' || !g || !g.cls); ultBtn.classList.toggle('full', !!g && g.ult >= 1);
  audio.scene(mode, g);
  draw(cv, cx, g, hud, hx);
  workMs += (performance.now() - w0 - workMs) * 0.05;
  if (showPerf && now - perfTick > 400) { perfTick = now; const p = perf(); perfEl.textContent = `${p.fps} fps · ${p.workMs} ms work · ${p.canvas} · quality ${p.quality}${p.lowDetail ? ' low detail' : ''}`; }
}

loadSprites();
toStart();
requestAnimationFrame(loop);

// Debug hook for automated tests (Playwright).
window.__game = { get g() { return g; }, get mode() { return mode; }, get save() { return save; }, begin, choose, toStart, toRoster, audio, get perf() { return perf(); }, applyQuality, get frameErrors() { return frameErrors; } };
