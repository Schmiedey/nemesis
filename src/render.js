// Draws the game in pixel art.
// The world is painted on a 480x300 canvas (one art pixel = 2 game units) and stretched with hard edges, so every
// sprite sits on the same pixel grid. The HUD is painted on a second, sharp canvas on top, in the pixel fonts.
import { T, UP, BOSS_TIME, ABILITIES, POWERUPS, RARITIES, CLASSES, gearOf } from './data.js';
import { ARENA, VIEW, BOSS_BLAST, BLADE_R, EMBER_R, ZAP_T, ZAP_R, recruitQuality } from './sim.js';
import { ATLAS, PAL } from './atlas.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a); // cosmetic only
export const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

const PX = 2;                                   // game units per art pixel
const snap = v => Math.round(v / PX) * PX;
const TITLE = '"Silkscreen", monospace', BODY = '"Pixelify Sans", monospace';

// ---------- sprites: one sheet made by art/make_pixels.mjs ----------
let atlasImg = null, atlasWhite = null;
export function loadSprites() {
  const img = new Image();
  img.onload = () => { atlasImg = img; };
  img.src = 'sprites/items.png';
}
// A white copy of the sheet, drawn over a creature for a moment when it is hit. Built the first time it is needed.
function whiteCopy(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const w = c.getContext('2d'); w.drawImage(img, 0, 0); w.globalCompositeOperation = 'source-in'; w.fillStyle = '#fff'; w.fillRect(0, 0, img.width, img.height);
  return c;
}
// Draw sprite `name`, frame f, centred on (x, y). scale 1 = one art pixel per sprite pixel.
function spr(cx, name, x, y, f = 0, scale = 1, flip = false, white = false) {
  const a = ATLAS[name]; if (!a || !atlasImg) return false;
  const w = a.w * PX * scale, h = a.h * PX * scale, sx = a.x + (Math.floor(f) % a.n) * a.w;
  const src = white ? (atlasWhite || (atlasWhite = whiteCopy(atlasImg))) : atlasImg;
  const dx = snap(x - w / 2), dy = snap(y - h / 2);
  if (flip) { cx.save(); cx.translate(dx + w, dy); cx.scale(-1, 1); cx.drawImage(src, sx, a.y, a.w, a.h, 0, 0, w, h); cx.restore(); }
  else cx.drawImage(src, sx, a.y, a.w, a.h, dx, dy, w, h);
  return true;
}
// For the HUD: draw an icon with its top-left at (x, y), k game units per sprite pixel.
function icon(cx, name, x, y, k = 2) {
  const a = ATLAS[name]; if (!a || !atlasImg) return;
  cx.imageSmoothingEnabled = false; cx.drawImage(atlasImg, a.x, a.y, a.w, a.h, x, y, a.w * k, a.h * k);
}

// ---------- effects ----------
let parts = [], shakeAmt = 0, surge = null;
const offs = new WeakMap();                     // per-creature animation offset
let pFlip = false, pPrev = { x: 0, y: 0 };
const MAX_PARTS = 400;
const SWEEP_T = 0.2;
let rings = [], nums = [], sweeps = [], bolts = [], booms = [], banner = null;
let trailTick = 0;
let lvl = null, glints = [];                      // the level-up moment
// Juice: death pops, pickup sparks, dash afterimages, the streak callout, and HUD values that ease toward the truth.
let deaths = [], sparks = [], afters = [], callout = null, strikes = [], ultFx = null, blockFx = 0;
const ULT_COL = { knight: '#2ce8f5', ranger: '#63c74d', necro: '#b06cff', berserker: '#e43b44', engineer: '#feae34', warden: '#7dffb0' };
const born = new WeakMap();                       // when each creature was first drawn, for its pop-in
const hudA = { hp: 1, ghost: 1, xp: 0, kills: 0, bump: 0, lvl: 0, lvlBump: 0, streakBump: 0, streak: 0, at: 0 };
const STREAKS = { 10: 'KILLING SPREE', 25: 'RAMPAGE', 50: 'UNSTOPPABLE', 100: 'MASSACRE', 150: 'GODLIKE', 200: 'LEGENDARY', 300: 'NEMESIS' };
export function resetFx() { parts = []; rings = []; nums = []; sweeps = []; bolts = []; booms = []; glints = []; lvl = null; banner = null; shakeAmt = 0; surge = null; deaths = []; sparks = []; afters = []; callout = null; strikes = []; ultFx = null; blockFx = 0; Object.assign(hudA, { hp: 1, ghost: 1, xp: 0, kills: 0, bump: 0, lvl: 0, lvlBump: 0, streakBump: 0, streak: 0, at: 0 }); }

// Level up (or a chest): a beam of light on the player, two rings, a shower of sparks and big text.
export function levelFx(g) {
  const P = g.P;
  // The best rarity on offer colours the beam and sets how big the moment is.
  const top = Math.max(0, ...(g.rar || []).map(r => RARITIES.indexOf(r)));
  lvl = { t: 0, chest: g.chest, n: P.lvl, top, col: [PAL.y, PAL.c, PAL.v, PAL.o2][top] };
  rings.push({ x: P.x, y: P.y, r: 150, life: 0.35 }, { x: P.x, y: P.y, r: 90, life: 0.5 });
  if (top >= 2) rings.push({ x: P.x, y: P.y, r: 240, life: 0.6 });
  if (top === 3) { rings.push({ x: P.x, y: P.y, r: 340, life: 0.8 }); shakeAmt = Math.max(shakeAmt, 12); }
  for (let i = 0; i < 26 + top * 22; i++) glints.push({ x: P.x + rnd(-70, 70), y: P.y + rnd(-10, 40), vy: -rnd(60, 190), life: rnd(0.5, 1.1), f: Math.floor(rnd(0, 3)) });
  shakeAmt = Math.max(shakeAmt, 5);
}
// After a pick: name what you took, with a green burst.
export function pickFx(g, name, rar = 'common') {
  banner = { text: name, life: 1.5, c: { common: PAL.mint, rare: PAL.c, epic: PAL.v, legendary: PAL.y }[rar] };
  rings.push({ x: g.P.x, y: g.P.y, r: 70, life: 0.35 });
  for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28; parts.push({ x: g.P.x, y: g.P.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.45, c: PAL.mint, s: 2 }); }
}

// Pull the effects the sim queued this step.
export function consumeFx(g) {
  for (const f of g.fx) {
    if (f.k === 'shake') shakeAmt = Math.max(shakeAmt, f.v);
    else if (f.k === 'surge') surge = { a: f.a, life: 2 };
    else if (f.k === 'snd' || f.k === 'act') continue;
    else if (f.k === 'sweep') sweeps.push({ ...f, life: SWEEP_T });
    else if (f.k === 'bolt') bolts.push({ pts: f.pts, life: 0.14 });
    else if (f.k === 'gear') banner = { text: 'NEW GEAR: ' + gearOf(f.id).n, life: 3.5 };
    else if (f.k === 'power') banner = { text: POWERUPS[f.id].n + '!', life: 1.6, c: POWERUPS[f.id].c };
    else if (f.k === 'num') { if (nums.length < 50) nums.push({ x: f.x + rnd(-6, 6), y: f.y - 8, v: Math.round(f.v), life: 0.6 }); }
    else if (f.k === 'nova') rings.push({ x: f.x, y: f.y, r: f.r, life: 0.35 });
    else if (f.k === 'die') { if (deaths.length < 60) deaths.push({ x: f.x, y: f.y, t: f.t, s: f.s, flip: Math.cos(f.a) < 0, life: 0.2 }); }
    else if (f.k === 'gem') { if (sparks.length < 40) sparks.push({ x: f.x, y: f.y, life: 0.18, big: f.big }); }
    else if (f.k === 'streak') { callout = { text: STREAKS[f.n] || 'STREAK', n: f.n, life: 1.6 }; shakeAmt = Math.max(shakeAmt, 4); }
    else if (f.k === 'strike') { if (strikes.length < 40) strikes.push({ x: f.x, y: f.y, life: 0.16 }); }
    else if (f.k === 'ult') { ultFx = { id: f.id, life: 1.5 }; rings.push({ x: g.P.x, y: g.P.y, r: 320, life: 0.5 }, { x: g.P.x, y: g.P.y, r: 200, life: 0.35 }); }
    else if (f.k === 'block') blockFx = 0.3;
    else if (f.k === 'minute') banner = { text: f.n + ':00 survived', life: 1.8, c: PAL.w };
    else if (f.k === 'gold') { booms.push({ x: f.x, y: f.y, life: 0.32, k: 1 }); for (let i = 0; i < 14; i++) glints.push({ x: f.x + rnd(-24, 24), y: f.y + rnd(-10, 20), vy: -rnd(40, 150), life: rnd(0.4, 0.9), f: Math.floor(rnd(0, 3)) }); }
    else {
      if (f.n === 3 && f.sp === 80 && sparks.length < 40) sparks.push({ x: f.x, y: f.y, life: 0.14, big: false });   // a shot landing
      if (f.sp >= 250 && f.n >= 24 && booms.length < 12) booms.push({ x: f.x, y: f.y, life: 0.32, k: f.n >= 40 ? 2 : 1 });
      for (let i = 0; i < f.n; i++) {
        if (parts.length >= MAX_PARTS) break;
        const a = Math.random() * 6.28, s = rnd(30, f.sp);
        parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.25, .6), c: f.c, s: Math.random() < 0.3 ? 4 : 2 });
      }
    }
  }
}

export function updateFx(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  for (const r of rings) r.life -= dt; rings = rings.filter(r => r.life > 0);
  for (const n of nums) { n.life -= dt; n.y -= 34 * dt; } nums = nums.filter(n => n.life > 0);
  for (const s of sweeps) s.life -= dt; sweeps = sweeps.filter(s => s.life > 0);
  for (const b of bolts) b.life -= dt; bolts = bolts.filter(b => b.life > 0);
  for (const b of booms) b.life -= dt; booms = booms.filter(b => b.life > 0);
  for (const d of deaths) d.life -= dt; deaths = deaths.filter(d => d.life > 0);
  for (const d of sparks) d.life -= dt; sparks = sparks.filter(d => d.life > 0);
  for (const d of afters) d.life -= dt; afters = afters.filter(d => d.life > 0);
  if (callout && (callout.life -= dt) <= 0) callout = null;
  for (const d of strikes) d.life -= dt; strikes = strikes.filter(d => d.life > 0);
  if (ultFx && (ultFx.life -= dt) <= 0) ultFx = null;
  blockFx = Math.max(0, blockFx - dt);
  for (const s of glints) { s.life -= dt; s.y += s.vy * dt; s.vy *= 0.97; } glints = glints.filter(s => s.life > 0);
  if (lvl && (lvl.t += dt) > 1.4) lvl = null;
  if (banner && (banner.life -= dt) <= 0) banner = null;
  if (surge && (surge.life -= dt) <= 0) surge = null;
  shakeAmt *= 0.88; if (shakeAmt < .3) shakeAmt = 0;
}

// ---------- canvases ----------
// World: always 480x300, stretched by CSS with hard edges. HUD: the same box at the screen's own resolution.
export const QUALITY_STEPS = [0.5];             // kept for main.js; pixel art has one resolution
export function setQuality(q, cv, low, hud) { resize(cv, hud); }
export function resize(cv, hud) {
  const fit = Math.min(innerWidth / VIEW.w, innerHeight / VIEW.h), cw = Math.floor(VIEW.w * fit), ch = Math.floor(VIEW.h * fit);
  cv.width = VIEW.w / PX; cv.height = VIEW.h / PX;
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  if (hud) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    hud.width = Math.round(cw * dpr); hud.height = Math.round(ch * dpr);
    hud.style.width = cw + 'px'; hud.style.height = ch + 'px';
  }
}

// The pool of light around the player, painted once.
let lightCv = null;
const LIGHT_R = 1150;
function light() {
  if (lightCv) return lightCv;
  lightCv = document.createElement('canvas'); lightCv.width = lightCv.height = 128;
  const c = lightCv.getContext('2d'), gr = c.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,236,200,.10)'); gr.addColorStop(0.19, 'rgba(0,0,0,0)'); gr.addColorStop(0.54, 'rgba(10,6,20,.5)'); gr.addColorStop(1, 'rgba(10,6,20,.5)');
  c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
  return lightCv;
}

// The floor, walls and rocks never change, so they are painted once per map, in art pixels.
let groundCv = null, groundFor = null;
function ground(rocks) {
  if (groundCv && groundFor === rocks) return groundCv;
  groundFor = rocks;
  const W = ARENA.w / PX, H = ARENA.h / PX;
  groundCv = document.createElement('canvas'); groundCv.width = W; groundCv.height = H;
  const c = groundCv.getContext('2d');
  let seed = 11; const rn = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dot = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
  const tones = ['#221e30', '#262234', '#2a2639'];
  for (let ty = 0; ty < H; ty += 16) for (let tx = 0; tx < W; tx += 16) {            // flagstones
    c.fillStyle = tones[Math.floor(rn() * 3)]; c.fillRect(tx, ty, 16, 16);
    c.fillStyle = '#1c1828'; c.fillRect(tx, ty, 16, 1); c.fillRect(tx, ty, 1, 16);
    c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(tx + 1, ty + 1, 15, 1);
    const r = rn();
    if (r < 0.10) { let x = tx + 3 + Math.floor(rn() * 8), y = ty + 3; for (let i = 0; i < 6; i++) { dot(x, y, PAL.k); x += rn() < 0.5 ? 1 : 0; y++; } }   // crack
    else if (r < 0.17) for (let i = 0; i < 3; i++) dot(tx + 2 + Math.floor(rn() * 12), ty + 2 + Math.floor(rn() * 12), PAL.g4);                              // pebbles
    else if (r < 0.21) { const x = tx + 3 + Math.floor(rn() * 9), y = ty + 4 + Math.floor(rn() * 8); dot(x, y, PAL.gr3); dot(x + 1, y, PAL.gr3); dot(x, y - 1, PAL.gr2); dot(x + 2, y + 1, PAL.gr3); }   // moss
  }
  // A filled pixel disc; shade(dx, dy) returns the colour for each pixel.
  const disc = (cx, cy, r, shade) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const q = x * x + y * y; if (q <= r * r + r * 0.6) dot(cx + x, cy + y, shade(x, y, q)); }
  };
  // Boulders: an uneven outline, a dark side face, and a top cut into facets that catch the light from the top-left.
  for (const k of rocks) {
    const x = Math.round(k.x / PX), y = Math.round(k.y / PX), r = Math.round(k.r / PX), up = Math.max(2, Math.round(r * 0.3));
    const n = 7 + Math.floor(rn() * 3), a0 = rn() * 6.283, rad = Array.from({ length: n }, () => 0.86 + rn() * 0.18);
    const sector = a => ((a - a0) % 6.283 + 6.283) % 6.283 / 6.283 * n;
    const edge = a => { const u = sector(a), i = Math.floor(u), f = u - i; return r * (rad[i % n] * (1 - f) + rad[(i + 1) % n] * f); };
    const blob = (ox, oy, grow, shade) => {
      for (let dy = -r - 2; dy <= r + 2; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
        const q = Math.hypot(dx, dy), a = Math.atan2(dy, dx); if (q <= edge(a) + grow) dot(x + dx + ox, y + dy + oy, shade(dx, dy, q, a));
      }
    };
    const tone = [PAL.g3, '#6f6a7d', PAL.g2, PAL.g1];
    c.globalAlpha = 0.45; blob(2, 3, 0, () => '#0c0816'); c.globalAlpha = 1;             // shadow
    blob(0, 0, 1, () => PAL.k); blob(0, 0, 0, (dx) => (dx > r * 0.3 ? PAL.g5 : PAL.g4));  // side face
    blob(0, -up, 1, () => PAL.k);
    blob(0, -up, 0, (dx, dy, q, a) => {
      if (q < r * 0.42) return -(dx + dy) > r * 0.12 ? PAL.g1 : PAL.g2;                 // flat cap
      const u = sector(a), i = Math.floor(u), mid = a0 + (i + 0.5) * 6.283 / n;
      if (u - i < 0.07 * n / 6.283 * 6 / Math.max(3, q)) return PAL.g3;                 // seam between facets
      const lit = -(Math.cos(mid) + Math.sin(mid)) / 1.414;
      return tone[Math.max(0, Math.min(3, Math.round((lit + 1) * 1.4)))];
    });
    if (rn() < 0.45) for (let i = 0; i < 5; i++) dot(x - Math.floor(rn() * r * 0.5), y - up - Math.floor(rn() * r * 0.4), i % 2 ? PAL.gr2 : PAL.gr3);   // moss
  }
  c.fillStyle = PAL.br3; c.fillRect(0, 0, W, 4); c.fillRect(0, H - 4, W, 4); c.fillRect(0, 0, 4, H); c.fillRect(W - 4, 0, 4, H);   // wall
  c.fillStyle = PAL.r2; c.fillRect(4, 4, W - 8, 1); c.fillRect(4, H - 5, W - 8, 1); c.fillRect(4, 4, 1, H - 8); c.fillRect(W - 5, 4, 1, H - 8);
  return groundCv;
}

// A checkerboard fill in one colour: the pixel-art way to draw something see-through.
const dithers = {};
function dither(cx, col) {
  if (!dithers[col]) {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    const d = c.getContext('2d'); d.fillStyle = col; d.fillRect(0, 0, 1, 1); d.fillRect(1, 1, 1, 1);
    const p = cx.createPattern(c, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix().scale(PX));
    dithers[col] = p;
  }
  return dithers[col];
}
// A marching dashed circle: the outline of a danger zone.
function dashRing(cx, x, y, r, col, t, w = 2) {
  cx.strokeStyle = col; cx.lineWidth = w; cx.setLineDash([8, 8]); cx.lineDashOffset = -t * 40;
  cx.beginPath(); cx.arc(x, y, Math.max(0, r), 0, 7); cx.stroke(); cx.setLineDash([]);
}

// ---------- creatures ----------
function shapePath(cx, s, r) {                  // fallback when the sheet has not loaded
  cx.beginPath();
  if (s === 'tri') { cx.moveTo(r * 1.2, 0); cx.lineTo(-r, -r); cx.lineTo(-r * .4, 0); cx.lineTo(-r, r); }
  else if (s === 'square') cx.rect(-r, -r, r * 2, r * 2);
  else cx.arc(0, 0, r, 0, 7);
  cx.closePath();
}

function drawEnt(cx, g, e) {
  const d = T[e.type], t = g.t;
  cx.save(); cx.translate(snap(e.x), snap(e.y));
  if (e.boss) {                                 // the nemesis stands in a red, marching ring
    cx.fillStyle = dither(cx, PAL.r2); cx.beginPath(); cx.arc(0, 0, e.r * 1.5, 0, 7); cx.fill();
    dashRing(cx, 0, 0, e.r * 1.5, e.enraged ? PAL.r3 : PAL.r, t * (e.enraged ? 3 : 1), 4);
  }
  if (e.elite) dashRing(cx, 0, 0, e.r * 1.4, PAL.y, t);
  // Tells: what an enemy is about to do, drawn before it happens. Dithered red zones with marching outlines.
  const blink = Math.sin(t * 24) > 0;
  if (e.wind > 0 && !(e.boss && (e.type === 'slime' || e.type === 'bomber' || e.type === 'wisp'))) {
    const len = e.boss ? 620 : 300, w = e.r * 2;                       // charge lane / arrow fan
    cx.save(); cx.rotate(e.ang); cx.fillStyle = dither(cx, blink ? PAL.r : PAL.r2);
    if (e.boss && e.type === 'archer') {
      cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, len, -0.48, 0.48); cx.closePath(); cx.fill();
      cx.strokeStyle = PAL.r; cx.lineWidth = 2; cx.stroke();
    } else {
      cx.fillRect(0, -w / 2, len, w);
      cx.fillStyle = PAL.r; cx.fillRect(0, -w / 2 - 2, len, 2); cx.fillRect(0, w / 2, len, 2);
      for (let q = (t * 260) % 64 + e.r; q < len - 8; q += 64) spr(cx, 'chev', q, 0, 0, e.boss ? 2 : 1);   // chevrons march the way it will go
    }
    cx.restore();
  }
  if (e.boss && e.wind > 0 && e.type === 'bomber') {
    cx.fillStyle = dither(cx, blink ? PAL.r : PAL.r2); cx.beginPath(); cx.arc(0, 0, BOSS_BLAST, 0, 7); cx.fill();
    dashRing(cx, 0, 0, BOSS_BLAST, PAL.r3, t * 2, 4);
  }
  if (e.boss && e.wind > 0 && e.type === 'slime') {
    const jx = snap(e.jx - e.x), jy = snap(e.jy - e.y);
    cx.fillStyle = dither(cx, blink ? PAL.r : PAL.r2); cx.beginPath(); cx.arc(jx, jy, e.r, 0, 7); cx.fill();
    dashRing(cx, jx, jy, e.r, PAL.r3, t * 2, 4);
  }
  if (e.aim > 0) {                              // an archer's aim: a dashed line that firms up just before the shot
    cx.strokeStyle = e.aim < 0.18 ? PAL.w : PAL.y; cx.lineWidth = 2; cx.setLineDash(e.aim < 0.18 ? [] : [8, 6]); cx.lineDashOffset = -t * 60;
    cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(e.aimAng) * 420, Math.sin(e.aimAng) * 420); cx.stroke(); cx.setLineDash([]);
  }
  if (e.fuse > 0 && e.team === 'enemy') {
    cx.fillStyle = dither(cx, blink ? PAL.r : PAL.r2); cx.beginPath(); cx.arc(0, 0, 70, 0, 7); cx.fill();
    dashRing(cx, 0, 0, 70, PAL.r3, t * 2);
  }
  const name = 'c_' + e.type, a = ATLAS[name];
  if (a && atlasImg) {
    // Side-view sprite, flipped to face the way it is going, standing on a shadow. Flyers hover above theirs.
    if (!offs.has(e)) offs.set(e, Math.floor(Math.random() * 4));
    // Pops in when it first appears; squashes for a moment when hit.
    if (!born.has(e)) born.set(e, t);
    const age = t - born.get(e), pop = age < 0.18 ? 0.35 + 0.65 * age / 0.18 : 1;
    const scale = e.r / d.r * pop, h = a.h * PX * scale, lift = d.fly ? 10 : 0, flip = Math.cos(e.ang) < 0;
    const cy = e.r * 0.8 - h / 2 - lift, f = Math.floor(t * (d.fly ? 12 : 7)) + offs.get(e), hit = e.flash > 0;
    spr(cx, 'shadow', 0, e.r * 0.8, 0, e.r / 8 * (lift ? 0.8 : 1));
    if (hit) { cx.save(); cx.translate(0, e.r * 0.8); cx.scale(1.2, 0.84); cx.translate(0, -e.r * 0.8); }
    spr(cx, name, 0, cy, f, scale, flip);
    if (hit) { cx.globalAlpha = 0.85; spr(cx, name, 0, cy, f, scale, flip, true); cx.globalAlpha = 1; cx.restore(); }
    if (e.gold) for (let i = 0; i < 3; i++) { const q = t * 3 + i * 2.094; spr(cx, 'glint', Math.cos(q) * (e.r + 10), cy + Math.sin(q) * (h * 0.35), t * 8 + i); }
    if (e.rootT > 0) spr(cx, 'root', 0, e.r * 0.8 - 6, 0, Math.max(1, e.r / 9));      // held by the Warden's roots
    if (e.mark > t) spr(cx, 'mark', 0, cy - h / 2 - 12);            // marked by the Hawk
    if (e.fireT > 0) spr(cx, 'burn', e.mark > t ? 14 : 0, cy - h / 2 - 12, t * 10);   // burning
    if (e.warn && blink) {                      // about to dive: a red exclamation mark overhead
      const ty = cy - h / 2 - 18;
      cx.fillStyle = PAL.k; cx.fillRect(-4, ty - 2, 8, 18); cx.fillStyle = PAL.r3; cx.fillRect(-2, ty, 4, 8); cx.fillRect(-2, ty + 10, 4, 4);
    }
    if (e.team === 'ally') {                    // your nemeses carry a small green marker overhead
      cx.fillStyle = PAL.k; cx.fillRect(-4, cy - h / 2 - 12, 8, 8); cx.fillStyle = PAL.mint; cx.fillRect(-2, cy - h / 2 - 10, 4, 4);
    }
  } else {
    cx.fillStyle = e.flash > 0 ? '#fff' : d.color; shapePath(cx, d.shape, e.r); cx.fill();
  }
  cx.restore();
  if (e.hp < e.maxhp && !e.boss && (e.team === 'ally' || e.type === 'brute' || e.elite)) {
    const w = snap(e.r * 2), x = snap(e.x - e.r), y = snap(e.y + e.r) + 4;
    cx.fillStyle = PAL.k; cx.fillRect(x - 2, y - 2, w + 4, 6);
    cx.fillStyle = e.team === 'ally' ? PAL.mint : PAL.o; cx.fillRect(x, y, snap(w * Math.max(0, e.hp / e.maxhp)), 2);
  }
}

function drawPlayer(cx, g) {
  const P = g.P;
  if (g.state === 'dead' || (P.inv > 0 && Math.sin(g.t * 60) > 0)) return;
  // Face the way we are moving; the walk cycle only plays while moving.
  const mx = P.x - pPrev.x, my = P.y - pPrev.y, moving = mx * mx + my * my > 0.01;
  if (moving && Math.abs(mx) > 0.2 && mx * mx + my * my < 2500) pFlip = mx < 0;
  pPrev = { x: P.x, y: P.y };
  const who = g.cls ? 'c_' + g.cls : 'c_player', a = ATLAS[who], x = snap(P.x), y = snap(P.y);
  if (a && atlasImg) {
    const cy = y + P.r * 0.8 - a.h * PX / 2, f = moving ? Math.floor(g.t * 10) : Math.floor(g.t * 2) % 2;   // walk cycle, or a slow breathing bob when standing
    if (P.dashT > 0 && afters.length < 12) afters.push({ x, y: cy, f, flip: pFlip, who, life: 0.22 });
    for (const q of afters) { cx.globalAlpha = q.life / 0.22 * 0.6; spr(cx, q.who, q.x, q.y, q.f, 1, q.flip, true); }
    cx.globalAlpha = 1;
    spr(cx, 'shadow', x, y + P.r * 0.8, 0, 1.3);
    spr(cx, who, x, cy, f, 1, pFlip);
    if (P.flash > 0 || (lvl && lvl.t < 0.3 && Math.sin(lvl.t * 60) > -0.3)) { cx.globalAlpha = 0.85; spr(cx, who, x, cy, f, 1, pFlip, true); cx.globalAlpha = 1; }
  } else { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y, P.r, 0, 7); cx.fill(); }
}

// ---------- HUD pieces ----------
// A framed panel: dark fill, light edge on top and left, dark edge below. Everything on a 2-unit grid.
function panel(cx, x, y, w, h, fill = 'rgba(26,20,35,.88)') {
  cx.fillStyle = PAL.k; cx.fillRect(x - 2, y - 2, w + 4, h + 4);
  cx.fillStyle = fill; cx.fillRect(x, y, w, h);
  cx.fillStyle = PAL.g3; cx.fillRect(x, y, w, 2); cx.fillRect(x, y, 2, h);
  cx.fillStyle = PAL.g5; cx.fillRect(x, y + h - 2, w, 2); cx.fillRect(x + w - 2, y, 2, h);
}
// A bar inside a frame. frac 0..1.
function bar(cx, x, y, w, h, frac, col, dark) {
  cx.fillStyle = PAL.k; cx.fillRect(x - 2, y - 2, w + 4, h + 4);
  cx.fillStyle = PAL.g5; cx.fillRect(x, y, w, h);
  const fw = Math.round(w * clamp(frac, 0, 1) / 2) * 2;
  cx.fillStyle = col; cx.fillRect(x, y, fw, h);
  cx.fillStyle = 'rgba(255,255,255,.28)'; cx.fillRect(x, y, fw, 2);
  cx.fillStyle = dark; cx.fillRect(x, y + h - 2, fw, 2);
}
// Text with a dark drop edge so it reads over anything.
function label(cx, text, x, y, col, font) {
  if (font) cx.font = font;
  cx.fillStyle = PAL.k; cx.fillText(text, x + 2, y + 2); cx.fillStyle = col; cx.fillText(text, x, y);
}

// Corner radar: the whole arena at a glance.
function minimap(cx, g, camX, camY, H) {
  const w = 160, h = w * ARENA.h / ARENA.w, x0 = 16, y0 = H - h - 16, k = w / ARENA.w;
  panel(cx, x0 - 2, y0 - 2, w + 4, h + 4, 'rgba(18,14,26,.9)');
  cx.fillStyle = PAL.g3; for (const r of g.rocks) { const q = Math.max(2, Math.round(r.r * k)); cx.fillRect(Math.round(x0 + r.x * k - q), Math.round(y0 + r.y * k - q), q * 2, q * 2); }
  for (const e of g.ents) {
    if (e.boss) continue;
    const q = e.elite ? 3 : 2;
    cx.fillStyle = e.team === 'ally' ? PAL.mint : e.elite ? PAL.y : PAL.r; cx.fillRect(Math.round(x0 + e.x * k - q / 2), Math.round(y0 + e.y * k - q / 2), q, q);
  }
  cx.fillStyle = PAL.y; for (const c of g.chests) cx.fillRect(Math.round(x0 + c.x * k) - 2, Math.round(y0 + c.y * k) - 2, 4, 4);
  for (const u of g.pickups) { cx.fillStyle = POWERUPS[u.k].c; cx.fillRect(Math.round(x0 + u.x * k) - 2, Math.round(y0 + u.y * k) - 2, 4, 4); }
  if (g.boss) { const p = Math.sin(g.t * 6) > 0 ? 8 : 6; cx.fillStyle = PAL.w; cx.fillRect(Math.round(x0 + g.boss.x * k - p / 2) - 1, Math.round(y0 + g.boss.y * k - p / 2) - 1, p + 2, p + 2); cx.fillStyle = PAL.r; cx.fillRect(Math.round(x0 + g.boss.x * k - p / 2), Math.round(y0 + g.boss.y * k - p / 2), p, p); }
  cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 1; cx.strokeRect(Math.round(x0 + camX * k) + .5, Math.round(y0 + camY * k) + .5, Math.round(VIEW.w * k), Math.round(VIEW.h * k));
  cx.fillStyle = PAL.w; cx.fillRect(Math.round(x0 + g.P.x * k) - 2, Math.round(y0 + g.P.y * k) - 2, 4, 4);
}

// ---------- the frame ----------
export function draw(cv, cx, g, hud, hx) {
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false;
  cx.fillStyle = PAL.k; cx.fillRect(0, 0, cv.width, cv.height);
  if (hx) { hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, hud.width, hud.height); }
  if (!g) return;
  const P = g.P, t = g.t, sc = cv.width / VIEW.w;
  const camX = snap(clamp(P.x - VIEW.w / 2, 0, ARENA.w - VIEW.w)), camY = snap(clamp(P.y - VIEW.h / 2, 0, ARENA.h - VIEW.h));

  cx.save();
  cx.setTransform(sc, 0, 0, sc, snap(rnd(-shakeAmt, shakeAmt)) * sc, snap(rnd(-shakeAmt, shakeAmt)) * sc);
  cx.translate(-camX, -camY);
  cx.drawImage(ground(g.rocks), camX / PX, camY / PX, VIEW.w / PX, VIEW.h / PX, camX, camY, VIEW.w, VIEW.h);
  cx.drawImage(light(), P.x - LIGHT_R, P.y - LIGHT_R, LIGHT_R * 2, LIGHT_R * 2);

  for (const z of g.zaps) {                              // the boss's lightning: marked, then it falls
    cx.fillStyle = dither(cx, Math.sin(t * 30) > 0 ? PAL.y : PAL.r2); cx.beginPath(); cx.arc(snap(z.x), snap(z.y), ZAP_R * (0.4 + 0.6 * (1 - z.t / ZAP_T)), 0, 7); cx.fill();
    dashRing(cx, snap(z.x), snap(z.y), ZAP_R, PAL.y, t * 4, 2);
  }
  for (const f of g.fires) {                             // Flamewalker trail
    if (f.life < 0.5 && Math.sin(t * 30 + f.x) > 0) continue;
    spr(cx, 'fire', f.x, f.y, t * 9 + f.x, f.r / 16);
  }
  if (P.charm === 'ember' && g.state !== 'dead') {       // Ember Heart aura
    cx.fillStyle = dither(cx, PAL.r2); cx.beginPath(); cx.arc(snap(P.x), snap(P.y), EMBER_R, 0, 7); cx.fill();
    dashRing(cx, snap(P.x), snap(P.y), EMBER_R, PAL.o, t);
  }
  for (const gem of g.gems) spr(cx, gem.v >= 5 ? 'gem_big' : 'gem', gem.x, gem.y, t * 3 + gem.x * 0.1);
  for (const c of g.chests) { spr(cx, 'shadow', c.x, c.y + 14, 0, 2); spr(cx, 'chest', c.x, c.y + (Math.sin(t * 5) > 0 ? -2 : 0)); }
  for (const u of g.pickups) {                           // Power-ups blink before they go
    if (u.life < 3 && Math.sin(t * 16) > 0.3) continue;
    spr(cx, 'shadow', u.x, u.y + 18, 0, 1.6); spr(cx, 'pu_' + u.k, u.x, u.y + (Math.sin(t * 4 + u.x) > 0 ? -2 : 2));
  }
  for (const tm of g.totems) { spr(cx, 'shadow', tm.x, tm.y + 8, 0, 1.5); if (!(tm.life < 3 && Math.sin(t * 14) > 0.4)) spr(cx, 'totem', tm.x, tm.y - 12); }
  if (g.decoy) {                                         // Decoy: a ghost of you with a shrinking fuse ring
    const d = g.decoy;
    cx.globalAlpha = 0.6; spr(cx, g.cls ? 'c_' + g.cls : 'c_player', d.x, d.y + P.r * 0.8 - ATLAS.c_player.h, 0, 1, pFlip); cx.globalAlpha = 1;
    dashRing(cx, snap(d.x), snap(d.y), 12 + 98 * Math.min(1, d.life / 2.5), PAL.w, t * 2);
  }

  // Creatures and the player, drawn back to front so nearer ones overlap farther ones.
  const order = g.ents.slice().sort((a, b) => a.y - b.y);
  let i = 0;
  for (; i < order.length && order[i].y < P.y; i++) drawEnt(cx, g, order[i]);
  drawPlayer(cx, g);
  for (; i < order.length; i++) drawEnt(cx, g, order[i]);

  if (P.shield > 0 && g.state !== 'dead') {              // Bubble: one arc per hit it can still absorb
    cx.strokeStyle = PAL.ice; cx.lineWidth = 2;
    for (let k = 0; k < P.shield; k++) { const a = t * 2 + k * 2.094; cx.beginPath(); cx.arc(P.x, P.y - 6, P.r + 14, a, a + 1.6); cx.stroke(); }
  }
  for (const r of g.rangs) spr(cx, 'rang', r.x, r.y, t * 16, r.r / 13 * 2);
  for (let k = 0; k < P.blades && g.state !== 'dead'; k++) {
    const a = t * 3.2 + k * 6.283 / P.blades; spr(cx, 'blade', P.x + Math.cos(a) * BLADE_R, P.y + Math.sin(a) * BLADE_R, t * 12, 1.2);
  }
  for (const s of sweeps) {                              // Greatsword: a blade swung through the arc, close in
    // The blade turns from one side of the arc to the other; behind it, a dithered smear of where it has been.
    const p = clamp(1 - s.life / SWEEP_T, 0, 1), from = s.a - s.half, to = from + 2 * s.half * Math.min(1, p * 1.4), x = snap(s.x), y = snap(s.y);
    cx.fillStyle = dither(cx, PAL.ice); cx.beginPath(); cx.arc(x, y, s.r, from, to); cx.arc(x, y, 16, to, from, true); cx.closePath(); cx.fill();
    cx.strokeStyle = PAL.w; cx.lineWidth = 4; cx.beginPath(); cx.arc(x, y, s.r - 2, Math.max(from, to - 0.9), to); cx.stroke();
    const bx = Math.cos(to), by = Math.sin(to), blade = (w, col, r0, r1) => { cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(x + bx * r0, y + by * r0); cx.lineTo(x + bx * r1, y + by * r1); cx.stroke(); };
    blade(10, PAL.k, 8, s.r + 2); blade(6, PAL.w, 10, s.r); blade(10, PAL.y, 8, 16);   // outline, steel, golden hilt
  }
  for (const b of bolts) {                               // Storm Rod lightning: a jagged line through each target
    // A blue glow with a white core, kinked once between each pair of targets.
    if (!b.kinks) b.kinks = b.pts.map(() => [snap(rnd(-12, 12)), snap(rnd(-12, 12))]);
    for (const [w, col] of [[6, PAL.c2], [2, b.life > 0.06 ? PAL.w : PAL.ice]]) {
      cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath();
      b.pts.forEach((p, k) => {
        if (!k) return cx.moveTo(snap(p.x), snap(p.y));
        const q = b.pts[k - 1]; cx.lineTo(snap((p.x + q.x) / 2) + b.kinks[k][0], snap((p.y + q.y) / 2) + b.kinks[k][1]); cx.lineTo(snap(p.x), snap(p.y));
      });
      cx.stroke();
    }
  }
  for (const r of rings) {
    // A shockwave: a solid white ring that thins, then breaks into dashes as it spreads.
    // k runs 0..1 over the ring's own lifetime. (It used to assume 0.35s; longer rings got a negative radius,
    // which throws and stopped the whole game.)
    if (!r.max) r.max = Math.max(r.life, 0.01);
    const k = clamp(1 - r.life / r.max, 0, 1), rad = Math.max(0, r.r * (0.3 + 0.7 * k));
    if (k < 0.55) { cx.strokeStyle = PAL.w; cx.lineWidth = k < 0.25 ? 6 : 4; cx.beginPath(); cx.arc(snap(r.x), snap(r.y), rad, 0, 7); cx.stroke(); }
    else dashRing(cx, snap(r.x), snap(r.y), rad, PAL.g1, 0);
  }
  // Projectiles: each kind has its own animated sprite, turned to face the way it flies, and leaves a short trail.
  trailTick = (trailTick + 1) % 2;
  for (const b of g.bullets) {
    const key = (b.color || '#fff').slice(1).toLowerCase(), mine = b.team === 'ally' && b.src === 'player';
    let name = null, turn = true, col = b.color || '#fff';
    if (b.burn) { name = 'b_fire'; col = PAL.o; }
    else if (mine && key === 'fff') { name = 'b_bolt'; col = PAL.c; }
    else if (mine && key === 'ffd23f') { name = 'b_crit'; col = PAL.y; }
    else if (mine && key === '9fe8ff') { name = 'b_spark'; col = PAL.ice; }
    else if (mine && key === '7dffb0') { name = 'b_shard'; col = PAL.mint; }
    else if (b.src === 'archer' && !b.boss) name = b.team === 'ally' ? 'arrow_ally' : 'arrow';
    else { name = (b.boss ? 'big_' : 'orb_') + (ATLAS['orb_' + key] ? key : b.boss ? 'ff3b5c' : 'fff'); turn = false; }
    if (trailTick === 0 && parts.length < MAX_PARTS - 60) parts.push({ x: b.x - b.vx * 0.012, y: b.y - b.vy * 0.012, vx: 0, vy: 0, life: b.boss ? 0.22 : 0.13, c: col, s: b.boss ? 4 : 2 });
    if (turn) { cx.save(); cx.translate(snap(b.x), snap(b.y)); cx.rotate(Math.atan2(b.vy, b.vx)); spr(cx, name, 0, 0, t * 14 + b.x * 0.05); cx.restore(); }
    else spr(cx, name, b.x, b.y, t * (b.boss ? 10 : 6) + b.x * 0.05);
  }
  // Ultimates in the world.
  for (const d of strikes) {                             // Arrow Storm: an arrow drops in, then a spark
    const k = 1 - d.life / 0.16;
    if (k < 0.6) spr(cx, 'strike', d.x, d.y - 26 - (0.6 - k) * 260); else spr(cx, 'spark', d.x, d.y - 6, (k - 0.6) * 7, 2);
  }
  if (g.laser) {                                         // Orbital Laser: a beam from the top of the screen to its foot
    const L = g.laser, lx = snap(L.x), w = Math.sin(t * 40) > 0 ? 14 : 10;
    cx.fillStyle = dither(cx, PAL.o); cx.fillRect(lx - w - 6, camY, (w + 6) * 2, snap(L.y) - camY);
    cx.fillStyle = PAL.o2; cx.fillRect(lx - w, camY, w * 2, snap(L.y) - camY);
    cx.fillStyle = PAL.w; cx.fillRect(lx - w / 2, camY, w, snap(L.y) - camY);
    spr(cx, 'boom', L.x, L.y, 1 + (t * 12) % 2, 1.6); dashRing(cx, lx, snap(L.y), 62, PAL.y, t * 3);
  }
  if (g.ultT > 0 && g.cls === 'knight') {                // Bulwark: a turning wall of shields
    dashRing(cx, snap(P.x), snap(P.y), 80, PAL.c, t * 4, 4); dashRing(cx, snap(P.x), snap(P.y), 66, PAL.ice, -t * 4, 2);
  }
  if (blockFx > 0) { cx.strokeStyle = PAL.ice; cx.lineWidth = 4; cx.beginPath(); cx.arc(snap(P.x), snap(P.y) - 6, P.r + 16 + (0.3 - blockFx) * 60, 0, 7); cx.stroke(); }
  if (g.cls === 'knight' && g.blockT <= 0 && g.state !== 'dead') { cx.strokeStyle = PAL.c; cx.lineWidth = 2; cx.beginPath(); cx.arc(snap(P.x), snap(P.y) - 6, P.r + 12, -2.4, -0.7); cx.stroke(); }   // shield ready
  if (g.ultT > 0 && g.cls === 'berserker') { cx.fillStyle = dither(cx, PAL.r2); cx.fillRect(camX, camY, VIEW.w, 12); cx.fillRect(camX, camY + VIEW.h - 12, VIEW.w, 12); cx.fillRect(camX, camY, 12, VIEW.h); cx.fillRect(camX + VIEW.w - 12, camY, 12, VIEW.h); }
  for (const b of booms) spr(cx, 'boom', b.x, b.y, (1 - b.life / 0.32) * 5, b.k);
  for (const d of deaths) {                              // a kill: the creature flashes white and swells, then a spark
    const k = 1 - d.life / 0.2, a = ATLAS['c_' + d.t];
    if (k < 0.5 && a) spr(cx, 'c_' + d.t, d.x, d.y - a.h * d.s * 0.4, 0, d.s * (1 + k * 0.9), d.flip, true);
    else spr(cx, 'spark', d.x, d.y - 6, (k - 0.5) * 6, 1 + d.s);
  }
  for (const d of sparks) spr(cx, 'spark', d.x, d.y - (1 - d.life / 0.18) * 10, (1 - d.life / 0.18) * 3, d.big ? 2 : 1);
  if (lvl && lvl.t < 0.8) {                              // a beam of light that narrows to nothing
    const k = 1 - lvl.t / 0.8, w = snap((56 + lvl.top * 22) * k) + 2, col = lvl.col, bx = snap(P.x);
    cx.fillStyle = dither(cx, col); cx.fillRect(bx - w, camY, w * 2, snap(P.y) + 12 - camY);
    cx.fillStyle = col; cx.fillRect(bx - w / 2, camY, w, snap(P.y) + 12 - camY);
    cx.fillStyle = PAL.w; cx.fillRect(bx - snap(w / 4), camY, snap(w / 2), snap(P.y) + 12 - camY);
  }
  for (const s of glints) if (s.life > 0.2 || Math.sin(s.life * 80) > 0) spr(cx, 'glint', s.x, s.y, s.f + s.life * 6);
  for (const p of parts) { if (p.life < 0.12 && p.s > 2) p.s = 2; cx.fillStyle = p.c; cx.fillRect(snap(p.x), snap(p.y), p.s, p.s); }
  if (g.slowT > 0) { cx.fillStyle = 'rgba(44,232,245,.08)'; cx.fillRect(camX, camY, VIEW.w, VIEW.h); }   // Time Slow tint
  cx.restore();

  if (!hx) return;
  // ---------- HUD, in game units on the sharp canvas ----------
  cx = hx;
  const hs = hud.width / VIEW.w, W = VIEW.w, H = VIEW.h;
  cx.save(); cx.setTransform(hs, 0, 0, hs, 0, 0); cx.imageSmoothingEnabled = false; cx.textBaseline = 'alphabetic';

  // Damage numbers float in the world.
  cx.textAlign = 'center';
  for (const n of nums) {
    const big = n.v >= 40;
    cx.globalAlpha = Math.min(1, n.life * 3);
    label(cx, n.v, n.x - camX, n.y - camY, big ? PAL.y : PAL.w, `${big ? 16 : 12}px ${TITLE}`);
  }
  cx.globalAlpha = 1;

  // HUD values ease toward the real ones, and numbers bump when they change.
  const now = performance.now(), hd = Math.min(0.05, (now - (hudA.at || now)) / 1000); hudA.at = now;
  const hpF = P.hp / P.maxhp, xpF = Math.min(1, P.xp / P.next);
  hudA.hp += (hpF - hudA.hp) * Math.min(1, hd * 14);
  hudA.ghost = hpF >= hudA.ghost ? hpF : Math.max(hpF, hudA.ghost - hd * 0.35);          // the white chunk drains slowly after a hit
  hudA.xp = xpF < hudA.xp - 0.2 ? 0 : hudA.xp + (xpF - hudA.xp) * Math.min(1, hd * 10);  // refills from empty after a level-up
  if (g.kills !== hudA.kills) { hudA.kills = g.kills; hudA.bump = 0.12; }
  if (P.lvl !== hudA.lvl) { hudA.lvl = P.lvl; hudA.lvlBump = 0.5; }
  if (g.streak > hudA.streak) hudA.streakBump = 0.1;
  hudA.streak = g.streak;
  for (const k of ['bump', 'lvlBump', 'streakBump']) hudA[k] = Math.max(0, hudA[k] - hd);

  // Top-left: level, experience, kills.
  panel(cx, 14, 14, 196, 50);
  cx.textAlign = 'left'; label(cx, 'LV ' + P.lvl, 24, 36, hudA.lvlBump > 0 && Math.sin(t * 30) > 0 ? PAL.w : PAL.y, `bold ${hudA.lvlBump > 0.3 ? 20 : 16}px ${TITLE}`);
  icon(cx, 'i_skull', 118, 20, 1.25); label(cx, g.kills, 144, hudA.bump > 0 ? 34 : 36, hudA.bump > 0 ? PAL.y : PAL.w, `${hudA.bump > 0 ? 20 : 16}px ${TITLE}`);
  const near = xpF > 0.85 && Math.sin(t * 14) > 0;                                       // nearly there: the bar pulses
  bar(cx, 24, 46, 176, 8, hudA.xp, near ? PAL.w : PAL.mint, PAL.gr2);
  // Kill streak: grows and changes colour as it builds; the bar under it is the time left to keep it going.
  if (g.streak >= 3) {
    const tier = g.streak >= 100 ? PAL.y : g.streak >= 50 ? PAL.o : g.streak >= 25 ? PAL.r3 : g.streak >= 10 ? PAL.c : PAL.w;
    const size = Math.min(34, 18 + Math.floor(g.streak / 10) * 2) + (hudA.streakBump > 0 ? 6 : 0);
    label(cx, 'x' + g.streak, 18, 98, tier, `bold ${size}px ${TITLE}`);
    label(cx, 'STREAK', 18, 114, PAL.g1, `10px ${TITLE}`);
    cx.fillStyle = PAL.k; cx.fillRect(16, 118, 84, 6); cx.fillStyle = tier; cx.fillRect(18, 120, Math.round(80 * Math.max(0, g.streakT) / 2.5 / 2) * 2, 2);
  }

  // Top centre: the clock, and the boss when it is here.
  panel(cx, W / 2 - 52, 14, 104, 34);
  cx.textAlign = 'center'; label(cx, fmt(t), W / 2, 39, PAL.w, `bold 22px ${TITLE}`);
  // Under the clock: the rank a recruit would have if you died now. Lasting longer raises it.
  if (!g.boss) {
    const q = recruitQuality(t, P.lvl), r = q < 0.7 ? 0 : q < 1.3 ? 1 : q < 2 ? 2 : 3, lo = [0.3, 0.7, 1.3, 2][r], hi = [0.7, 1.3, 2, 3][r];
    const rc = [PAL.g2, PAL.c, PAL.v, PAL.y][r], x0 = W / 2 - 50;
    for (let i = 0; i < 4; i++) { cx.fillStyle = PAL.k; cx.fillRect(x0 + i * 26 - 2, 52, 26, 8); cx.fillStyle = i < r ? rc : PAL.g5; cx.fillRect(x0 + i * 26, 54, 22, 4); if (i === r) { cx.fillStyle = rc; cx.fillRect(x0 + i * 26, 54, Math.round(22 * (q - lo) / (hi - lo) / 2) * 2, 4); } }
  }
  if (g.boss) {
    const bw = 400;
    bar(cx, W / 2 - bw / 2, 64, bw, 12, g.boss.hp / g.boss.maxhp, PAL.r, PAL.r2);
    icon(cx, 'i_skull', W / 2 - bw / 2 - 26, 58, 1.25);
    const gr = g.grudge, bn = gr ? gr.name.toUpperCase() : 'THE ' + T[g.boss.type].name.toUpperCase();
    label(cx, bn + (gr && gr.kills ? '   KILLED YOU ' + gr.kills + 'X' : '') + (g.boss.enraged ? '   ENRAGED' : ''), W / 2, 94, g.boss.enraged ? PAL.r3 : PAL.g1, `12px ${TITLE}`);
    if (t - g.bossAt < 4) {
      if (Math.sin(t * 10) > -0.4) label(cx, gr ? bn + ' REMEMBERS YOU' : 'YOUR NEMESIS HAS COME', W / 2, H / 2 - 120, PAL.r, `bold 30px ${TITLE}`);
      if (gr && gr.powers.length) label(cx, 'IT LEARNED ' + gr.powers.map(k => UP.find(u => u.id === k).n.toUpperCase()).join(' AND ') + ' FROM YOU', W / 2, H / 2 - 92, PAL.y, `14px ${TITLE}`);
    }
  } else if (!g.bossAt && t > BOSS_TIME - 30) {
    label(cx, 'NEMESIS IN ' + Math.ceil(BOSS_TIME - t), W / 2, 68, PAL.r3, `12px ${TITLE}`);
  }

  // Top-right: your party. Each nemesis shows its health and the kills it has made this run; while it is down,
  // a countdown to its return.
  g.party.forEach((n, k) => {
    const mine = g.ents.filter(e => e.nem === n && !e.small && !e.dead), q = g.respawnQ.find(x => x.nem === n), y = 14 + k * 40, up = mine.length > 0;
    panel(cx, W - 186, y, 172, 34);
    cx.globalAlpha = up ? 1 : 0.45;
    const a = ATLAS['c_' + n.type]; if (a) icon(cx, 'c_' + n.type, W - 182 + (14 - Math.min(14, a.w * 0.5)), y + 17 - a.h * 0.5, 1);
    cx.textAlign = 'left'; label(cx, String(n.name).toUpperCase().slice(0, 9), W - 150, y + 16, up ? PAL.mint : PAL.g2, `12px ${TITLE}`);
    cx.globalAlpha = 1;
    if (up) { const hp = mine.reduce((s, e) => s + e.hp, 0) / mine.reduce((s, e) => s + e.maxhp, 0); bar(cx, W - 150, y + 22, 84, 4, hp, PAL.mint, PAL.gr2); }
    else if (q) label(cx, 'BACK IN ' + Math.max(1, Math.ceil(q.at - t)), W - 150, y + 29, PAL.y, `10px ${TITLE}`);
    cx.textAlign = 'right'; icon(cx, 'i_skull', W - 48, y + 8, 0.75); label(cx, n.kills || 0, W - 20, y + 16, PAL.w, `12px ${TITLE}`);
  });

  // When you are close to death: who would join you if you fell now. Dying is a choice of recruit.
  if (g.hint && P.hp / P.maxhp < 0.35 && g.state === 'play' && T[g.hint.type]) {
    const hnt = g.hint, d = T[hnt.type], r = hnt.q < 0.7 ? 'RUNT' : hnt.q < 1.3 ? 'SOLDIER' : hnt.q < 2 ? 'VETERAN' : 'CHAMPION', weak = hnt.out === 'too weak';
    const line = (hnt.prize === 'elite' ? 'ELITE ' : hnt.prize === 'gold' ? 'GOLDEN ' : '') + r + ' ' + d.name.toUpperCase() + (weak ? ': TOO WEAK TO JOIN' : hnt.out === 'joins' ? ' JOINS YOU' : ' ' + hnt.out.toUpperCase());
    cx.font = `12px ${TITLE}`; const w = Math.max(230, cx.measureText(line).width + 64), x = W / 2 - w / 2, y = H - 92;
    panel(cx, x, y, w, 40, weak ? 'rgba(26,20,35,.9)' : hnt.prize ? 'rgba(90,60,10,.92)' : 'rgba(38,92,66,.92)');
    const a = ATLAS['c_' + hnt.type]; if (a) icon(cx, 'c_' + hnt.type, x + 8 + (18 - Math.min(18, a.w * 0.5)), y + 20 - a.h * 0.5, 1);
    cx.textAlign = 'left'; label(cx, 'IF YOU FALL NOW', x + 50, y + 16, PAL.g1, `10px ${TITLE}`);
    label(cx, line, x + 50, y + 32, weak ? PAL.g2 : hnt.prize ? PAL.y : PAL.mint, `12px ${TITLE}`);
  }
  // Bottom centre: health.
  {
    const bw = 280, x = W / 2 - bw / 2, y = H - 34;
    icon(cx, 'i_tough', x - 30, y - 8, 1.5);
    bar(cx, x, y, bw, 14, hudA.ghost, PAL.w, PAL.g1);                                    // what you just lost, in white
    const fw = Math.round(bw * clamp(hudA.hp, 0, 1) / 2) * 2;
    cx.fillStyle = PAL.g5; cx.fillRect(x + fw, y, 0, 14);
    cx.fillStyle = hpF < 0.3 && Math.sin(t * 12) > 0 ? PAL.r3 : PAL.r; cx.fillRect(x, y, fw, 14);
    cx.fillStyle = 'rgba(255,255,255,.28)'; cx.fillRect(x, y, fw, 2); cx.fillStyle = PAL.r2; cx.fillRect(x, y + 12, fw, 2);
    cx.textAlign = 'center'; label(cx, Math.ceil(P.hp) + ' / ' + Math.round(P.maxhp), W / 2, y + 12, PAL.w, `12px ${TITLE}`);
  }
  minimap(cx, g, camX, camY, H);

  // Bottom-right: the class ultimate. It fills with kills; when full the frame flashes and E unleashes it.
  if (g.cls) {
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
    const x = W - (touch ? 222 : 142), y = H - 78, full = g.ult >= 1, col = ULT_COL[g.cls], on = g.ultT > 0;
    panel(cx, x, y, 56, 56, full && Math.sin(t * 10) > 0 ? 'rgba(254,174,52,.9)' : 'rgba(26,20,35,.9)');
    const a = ATLAS[CLASSES[g.cls].sprite]; if (a) { cx.globalAlpha = full || on ? 1 : 0.5; icon(cx, CLASSES[g.cls].sprite, x + 28 - a.w, y + 28 - a.h, 2); cx.globalAlpha = 1; }
    const fh = Math.round(52 * (on ? g.ultT / 5 : 1 - g.ult) / 2) * 2;
    if (!full && !on) { cx.fillStyle = 'rgba(26,20,35,.72)'; cx.fillRect(x + 2, y + 2, 52, fh); }
    cx.fillStyle = PAL.k; cx.fillRect(x, y + 58, 56, 6); cx.fillStyle = col; cx.fillRect(x + 2, y + 60, Math.round(52 * (on ? Math.min(1, g.ultT / 6) : g.ult) / 2) * 2, 2);
    cx.textAlign = 'center'; label(cx, full ? 'E' : on ? CLASSES[g.cls].ult.n.toUpperCase().slice(0, 9) : Math.floor(g.ult * 100) + '%', x + 28, y + 78, full ? PAL.y : PAL.g2, `10px ${TITLE}`);
  }
  if (ultFx) {                                           // the ultimate's name, large, in the class colour
    const k = 1.5 - ultFx.life, size = k < 0.06 ? 64 : k < 0.12 ? 50 : 38, c = CLASSES[ultFx.id];
    if (k < 0.1) { cx.fillStyle = 'rgba(244,241,232,.3)'; cx.fillRect(0, 0, W, H); }
    if (ultFx.life > 0.25 || Math.sin(ultFx.life * 60) > 0) { cx.textAlign = 'center'; label(cx, c.ult.n.toUpperCase() + '!', W / 2, 262, Math.sin(k * 40) > 0 ? ULT_COL[ultFx.id] : PAL.w, `bold ${size}px ${TITLE}`); }
  }
  // Bottom-right: the ability slot, with a cooldown that drains downward.
  {
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;   // on touch, the button sits in the corner
    const ab = ABILITIES[P.ability], x = W - (touch ? 150 : 70), y = H - 78, left = Math.max(0, P.actT), ready = left <= 0;
    panel(cx, x, y, 56, 56, ready ? 'rgba(38,92,66,.9)' : 'rgba(26,20,35,.9)');
    cx.globalAlpha = ready ? 1 : 0.45; icon(cx, 'i_' + P.ability, x + 4, y + 4, 3); cx.globalAlpha = 1;
    if (!ready) {
      const fh = Math.round(52 * left / (P.actMax || ab.cd) / 2) * 2;
      cx.fillStyle = 'rgba(26,20,35,.7)'; cx.fillRect(x + 2, y + 2, 52, fh);
      cx.textAlign = 'center'; label(cx, Math.ceil(left), x + 28, y + 36, PAL.w, `bold 20px ${TITLE}`);
    }
    cx.textAlign = 'center'; label(cx, ready ? (touch ? 'READY' : 'SPACE') : ab.n.toUpperCase(), x + 28, y + 72, ready ? PAL.mint : PAL.g2, `10px ${TITLE}`);
    // Timed effects stack above it.
    const eff = [];
    if (g.frenzyT > 0) eff.push(['pu_frenzy', Math.ceil(g.frenzyT) + 's']);
    if (g.giantT > 0) eff.push(['pu_giant', Math.ceil(g.giantT) + 's']);
    if (P.shield > 0) eff.push(['pu_bubble', 'x' + P.shield]);
    if (g.slowT > 0) eff.push(['i_slow', Math.ceil(g.slowT) + 's']);
    eff.forEach(([ic, tx], k) => { const ey = y - 34 - k * 30; icon(cx, ic, x + 30, ey, 1.4); cx.textAlign = 'right'; label(cx, tx, x + 24, ey + 18, PAL.w, `12px ${TITLE}`); });
  }

  if (lvl) {                                             // LEVEL UP! slams in large, then settles
    const size = lvl.t < 0.07 ? 76 : lvl.t < 0.14 ? 60 : 48, on = lvl.t < 1.1 || Math.sin(lvl.t * 40) > 0;
    if (lvl.t < 0.1) { cx.fillStyle = 'rgba(244,241,232,.35)'; cx.fillRect(0, 0, W, H); }
    if (on) {
      cx.textAlign = 'center';
      label(cx, lvl.chest ? 'CHEST!' : 'LEVEL UP!', W / 2, H / 2 - 132, Math.sin(lvl.t * 30) > 0 ? lvl.col : PAL.w, `bold ${size}px ${TITLE}`);
      if (lvl.t > 0.14) label(cx, lvl.top === 3 ? 'A LEGENDARY AWAITS' : lvl.top === 2 ? 'AN EPIC AWAITS' : lvl.chest ? 'NOTHING COMMON INSIDE' : 'LEVEL ' + lvl.n, W / 2, H / 2 - 104, lvl.top >= 2 ? lvl.col : PAL.mint, `16px ${TITLE}`);
    }
  }
  if (callout) {                                         // RAMPAGE! and friends
    const k = 1.6 - callout.life, size = k < 0.06 ? 56 : k < 0.12 ? 44 : 34, col = callout.n >= 100 ? PAL.y : callout.n >= 50 ? PAL.o : callout.n >= 25 ? PAL.r3 : PAL.c;
    if (callout.life > 0.3 || Math.sin(callout.life * 60) > 0) { cx.textAlign = 'center'; label(cx, callout.text + '!', W / 2, 200, Math.sin(k * 40) > 0 ? col : PAL.w, `bold ${size}px ${TITLE}`); label(cx, 'x' + callout.n + ' KILL STREAK', W / 2, 222, PAL.g1, `12px ${TITLE}`); }
  }
  if (hpF < 0.3 && g.state === 'play') {                 // low health: a red frame beats at the edges
    cx.fillStyle = Math.sin(t * 8) > 0 ? 'rgba(228,59,68,.34)' : 'rgba(228,59,68,.16)';
    cx.fillRect(0, 0, W, 10); cx.fillRect(0, H - 10, W, 10); cx.fillRect(0, 10, 10, H - 20); cx.fillRect(W - 10, 10, 10, H - 20);
  }
  if (banner) {
    cx.globalAlpha = Math.min(1, banner.life * 2); cx.textAlign = 'center';
    const tw = (cx.font = `bold 20px ${TITLE}`, cx.measureText(banner.text.toUpperCase()).width) + 36;
    panel(cx, W / 2 - tw / 2, 110, tw, 36); label(cx, banner.text.toUpperCase(), W / 2, 135, banner.c || PAL.y);
    cx.globalAlpha = 1;
  }
  // Surge warning: flashing chevrons on the side the wave is coming from.
  if (surge && Math.sin(t * 16) > -0.2) {
    cx.globalAlpha = Math.min(1, surge.life);
    const ax = W / 2 + Math.cos(surge.a) * 250, ay = H / 2 + Math.sin(surge.a) * 210;
    cx.save(); cx.translate(ax, ay); cx.rotate(surge.a); cx.fillStyle = PAL.k; cx.fillRect(-18, -18, 36, 36); cx.fillStyle = PAL.r;
    for (const o of [-8, 4]) { cx.beginPath(); cx.moveTo(o, -12); cx.lineTo(o + 10, 0); cx.lineTo(o, 12); cx.lineTo(o - 4, 12); cx.lineTo(o + 6, 0); cx.lineTo(o - 4, -12); cx.closePath(); cx.fill(); }
    cx.restore(); cx.globalAlpha = 1;
  }
  cx.restore();
}
