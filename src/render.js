// Draws the game in pixel art.
// The world is painted on a 480x300 canvas (one art pixel = 2 game units) and stretched with hard edges, so every
// sprite sits on the same pixel grid. The HUD is painted on a second, sharp canvas on top, in the pixel fonts.
import { T, BOSS_TIME, ABILITIES, POWERUPS, gearOf } from './data.js';
import { ARENA, VIEW, BOSS_BLAST, BLADE_R, EMBER_R } from './sim.js';
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
let rings = [], nums = [], sweeps = [], bolts = [], booms = [], banner = null;
export function resetFx() { parts = []; rings = []; nums = []; sweeps = []; bolts = []; booms = []; banner = null; shakeAmt = 0; surge = null; }

// Pull the effects the sim queued this step.
export function consumeFx(g) {
  for (const f of g.fx) {
    if (f.k === 'shake') shakeAmt = Math.max(shakeAmt, f.v);
    else if (f.k === 'surge') surge = { a: f.a, life: 2 };
    else if (f.k === 'snd' || f.k === 'act') continue;
    else if (f.k === 'sweep') sweeps.push({ ...f, life: 0.16 });
    else if (f.k === 'bolt') bolts.push({ pts: f.pts, life: 0.14 });
    else if (f.k === 'gear') banner = { text: 'NEW GEAR: ' + gearOf(f.id).n, life: 3.5 };
    else if (f.k === 'power') banner = { text: POWERUPS[f.id].n + '!', life: 1.6, c: POWERUPS[f.id].c };
    else if (f.k === 'num') { if (nums.length < 50) nums.push({ x: f.x + rnd(-6, 6), y: f.y - 8, v: Math.round(f.v), life: 0.6 }); }
    else if (f.k === 'nova') rings.push({ x: f.x, y: f.y, r: f.r, life: 0.35 });
    else {
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
  for (const k of rocks) {
    const x = Math.round(k.x / PX), y = Math.round(k.y / PX), r = Math.round(k.r / PX), lift = Math.max(2, Math.round(r * 0.3));
    c.globalAlpha = 0.45; disc(x + 2, y + 3, r, () => '#0c0816'); c.globalAlpha = 1;       // shadow
    disc(x, y, r + 1, () => PAL.k); disc(x, y, r, () => PAL.g4);                         // side face, outlined
    disc(x, y - lift, r + 1, () => PAL.k);
    disc(x, y - lift, r, (dx, dy) => { const t = -(dx + dy) / (2 * r); return t > 0.32 ? PAL.g1 : t > 0.05 ? PAL.g2 : t > -0.3 ? '#6f6a7d' : PAL.g3; });   // lit top
    for (let i = 0; i < 2 + r / 6; i++) {                                               // cracks
      let px = x + Math.floor((rn() - 0.5) * r), py = y - lift + Math.floor((rn() - 0.5) * r);
      for (let j = 0; j < 3 + r / 5; j++) { if ((px - x) ** 2 + (py - y + lift) ** 2 < (r - 1) ** 2) dot(px, py, PAL.g4); px += rn() < 0.6 ? 1 : 0; py += rn() < 0.6 ? 1 : -1; }
    }
  }
  c.fillStyle = PAL.br3; c.fillRect(0, 0, W, 4); c.fillRect(0, H - 4, W, 4); c.fillRect(0, 0, 4, H); c.fillRect(W - 4, 0, 4, H);   // wall
  c.fillStyle = PAL.r2; c.fillRect(4, 4, W - 8, 1); c.fillRect(4, H - 5, W - 8, 1); c.fillRect(4, 4, 1, H - 8); c.fillRect(W - 5, 4, 1, H - 8);
  return groundCv;
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
  if (e.boss) {
    // The nemesis: a pulsing red aura so it never reads as just a big enemy.
    const k = 0.5 + 0.5 * Math.sin(t * 5), R = e.r * 1.9;
    const gr = cx.createRadialGradient(0, 0, e.r * 0.6, 0, 0, R);
    gr.addColorStop(0, `rgba(228,59,68,${0.35 + 0.2 * k})`); gr.addColorStop(1, 'rgba(228,59,68,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(0, 0, R, 0, 7); cx.fill();
  }
  if (e.elite) { cx.strokeStyle = Math.sin(t * 8) > 0 ? PAL.y : PAL.gold; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, e.r * 1.4, 0, 7); cx.stroke(); }
  // Tells: what an enemy is about to do, drawn before it happens.
  if (e.wind > 0 && !(e.boss && (e.type === 'slime' || e.type === 'bomber' || e.type === 'wisp'))) {
    const len = e.boss ? 620 : 300, w = e.r * 2;                       // charge lane / arrow fan
    cx.save(); cx.rotate(e.ang); cx.fillStyle = `rgba(228,59,68,${0.2 + 0.15 * Math.sin(t * 30)})`;
    if (e.boss && e.type === 'archer') { cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, len, -0.48, 0.48); cx.closePath(); cx.fill(); }
    else cx.fillRect(0, -w / 2, len, w);
    cx.restore();
  }
  if (e.boss && e.wind > 0 && e.type === 'bomber') {
    cx.fillStyle = `rgba(228,59,68,${0.14 + 0.1 * Math.sin(t * 30)})`; cx.beginPath(); cx.arc(0, 0, BOSS_BLAST, 0, 7); cx.fill();
    cx.strokeStyle = PAL.r; cx.lineWidth = 2; cx.stroke();
  }
  if (e.boss && e.wind > 0 && e.type === 'slime') {
    cx.strokeStyle = PAL.r; cx.lineWidth = 2; cx.fillStyle = 'rgba(228,59,68,.16)';
    cx.beginPath(); cx.arc(e.jx - e.x, e.jy - e.y, e.r, 0, 7); cx.fill(); cx.stroke();
  }
  if (e.aim > 0) {
    cx.strokeStyle = `rgba(254,231,97,${0.35 + 0.5 * (1 - e.aim / 0.5)})`; cx.lineWidth = 2; cx.beginPath();
    cx.moveTo(0, 0); cx.lineTo(Math.cos(e.aimAng) * 420, Math.sin(e.aimAng) * 420); cx.stroke();
  }
  if (e.warn) { cx.strokeStyle = PAL.r; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, e.r + 6, 0, 7); cx.stroke(); }
  if (e.fuse > 0 && e.team === 'enemy') {
    cx.fillStyle = `rgba(228,59,68,${0.12 + 0.12 * Math.sin(t * 40)})`; cx.beginPath(); cx.arc(0, 0, 70, 0, 7); cx.fill();
    cx.strokeStyle = PAL.r; cx.lineWidth = 2; cx.stroke();
  }
  const name = 'c_' + e.type, a = ATLAS[name];
  if (a && atlasImg) {
    // Side-view sprite, flipped to face the way it is going, standing on a shadow. Flyers hover above theirs.
    if (!offs.has(e)) offs.set(e, Math.floor(Math.random() * 2));
    const scale = e.r / d.r, h = a.h * PX * scale, lift = d.fly ? 10 : 0, flip = Math.cos(e.ang) < 0;
    const cy = e.r * 0.8 - h / 2 - lift, f = Math.floor(t * (d.fly ? 9 : 5)) + offs.get(e);
    spr(cx, 'shadow', 0, e.r * 0.8, 0, e.r / 8 * (lift ? 0.8 : 1));
    spr(cx, name, 0, cy, f, scale, flip);
    if (e.flash > 0) { cx.globalAlpha = 0.85; spr(cx, name, 0, cy, f, scale, flip, true); cx.globalAlpha = 1; }
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
  const a = ATLAS.c_player, x = snap(P.x), y = snap(P.y);
  if (a && atlasImg) {
    const cy = y + P.r * 0.8 - a.h * PX / 2, f = moving ? Math.floor(g.t * 8) : 0;
    spr(cx, 'shadow', x, y + P.r * 0.8, 0, 1.3);
    spr(cx, 'c_player', x, cy, f, 1, pFlip);
    if (P.flash > 0) { cx.globalAlpha = 0.85; spr(cx, 'c_player', x, cy, f, 1, pFlip, true); cx.globalAlpha = 1; }
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

  for (const f of g.fires) {                             // Flamewalker trail
    if (f.life < 0.5 && Math.sin(t * 30 + f.x) > 0) continue;
    spr(cx, 'fire', f.x, f.y, t * 9 + f.x, f.r / 16);
  }
  if (P.charm === 'ember' && g.state !== 'dead') {       // Ember Heart aura
    cx.fillStyle = `rgba(247,118,34,${0.08 + 0.04 * Math.sin(t * 9)})`; cx.beginPath(); cx.arc(P.x, P.y, EMBER_R, 0, 7); cx.fill();
    cx.strokeStyle = 'rgba(247,118,34,.5)'; cx.lineWidth = 2; cx.stroke();
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
    cx.globalAlpha = 0.6; spr(cx, 'c_player', d.x, d.y + P.r * 0.8 - ATLAS.c_player.h, 0, 1, pFlip); cx.globalAlpha = 1;
    cx.strokeStyle = PAL.w; cx.lineWidth = 2; cx.beginPath(); cx.arc(d.x, d.y, 12 + 98 * Math.min(1, d.life / 2.5), 0, 7); cx.stroke();
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
  for (const s of sweeps) {                              // Greatsword arcs
    const k = s.life / 0.16;
    cx.fillStyle = `rgba(192,244,255,${0.45 * k})`; cx.beginPath(); cx.moveTo(s.x, s.y); cx.arc(s.x, s.y, s.r, s.a - s.half, s.a + s.half); cx.closePath(); cx.fill();
    cx.strokeStyle = `rgba(244,241,232,${k})`; cx.lineWidth = 4; cx.beginPath(); cx.arc(s.x, s.y, s.r, s.a - s.half, s.a + s.half); cx.stroke();
  }
  for (const b of bolts) {                               // Storm Rod lightning: a jagged line through each target
    cx.strokeStyle = b.life > 0.07 ? PAL.w : PAL.c; cx.lineWidth = 2; cx.beginPath();
    b.pts.forEach((p, k) => {
      if (!k) return cx.moveTo(p.x, p.y);
      const q = b.pts[k - 1]; cx.lineTo((p.x + q.x) / 2 + rnd(-10, 10), (p.y + q.y) / 2 + rnd(-10, 10)); cx.lineTo(p.x, p.y);
    });
    cx.stroke();
  }
  for (const r of rings) {
    const k = 1 - r.life / 0.35;
    cx.strokeStyle = `rgba(244,241,232,${1 - k})`; cx.lineWidth = 4; cx.beginPath(); cx.arc(r.x, r.y, r.r * (0.3 + 0.7 * k), 0, 7); cx.stroke();
  }
  for (const b of g.bullets) {
    const key = (b.color || '#fff').slice(1).toLowerCase();
    if (b.team === 'enemy' && b.src === 'archer' && !b.boss) { cx.save(); cx.translate(snap(b.x), snap(b.y)); cx.rotate(Math.atan2(b.vy, b.vx)); spr(cx, 'arrow', 0, 0); cx.restore(); }
    else if (!spr(cx, (b.boss ? 'big_' : 'orb_') + key, b.x, b.y) && !spr(cx, b.boss ? 'big_ff3b5c' : 'orb_fff', b.x, b.y)) { cx.fillStyle = b.color; cx.fillRect(b.x - 2, b.y - 2, 4, 4); }
  }
  for (const b of booms) spr(cx, 'boom', b.x, b.y, (1 - b.life / 0.32) * 5, b.k);
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

  // Top-left: level, experience, kills.
  panel(cx, 14, 14, 196, 50);
  cx.textAlign = 'left'; label(cx, 'LV ' + P.lvl, 24, 36, PAL.y, `bold 16px ${TITLE}`);
  icon(cx, 'i_skull', 118, 20, 1.25); label(cx, g.kills, 144, 36, PAL.w, `16px ${TITLE}`);
  bar(cx, 24, 46, 176, 8, P.xp / P.next, PAL.mint, PAL.gr2);

  // Top centre: the clock, and the boss when it is here.
  panel(cx, W / 2 - 52, 14, 104, 34);
  cx.textAlign = 'center'; label(cx, fmt(t), W / 2, 39, PAL.w, `bold 22px ${TITLE}`);
  if (g.boss) {
    const bw = 400;
    bar(cx, W / 2 - bw / 2, 64, bw, 12, g.boss.hp / g.boss.maxhp, PAL.r, PAL.r2);
    icon(cx, 'i_skull', W / 2 - bw / 2 - 26, 58, 1.25);
    label(cx, 'THE ' + T[g.boss.type].name.toUpperCase() + (g.boss.enraged ? '  ENRAGED' : ''), W / 2, 94, g.boss.enraged ? PAL.r3 : PAL.g1, `12px ${TITLE}`);
    if (t - g.bossAt < 3.5 && Math.sin(t * 10) > -0.4) label(cx, 'YOUR NEMESIS HAS COME', W / 2, H / 2 - 120, PAL.r, `bold 30px ${TITLE}`);
  } else if (!g.bossAt && t > BOSS_TIME - 30) {
    label(cx, 'NEMESIS IN ' + Math.ceil(BOSS_TIME - t), W / 2, 68, PAL.r3, `12px ${TITLE}`);
  }

  // Top-right: your party; a nemesis that has fallen for good is greyed out.
  g.party.forEach((n, k) => {
    const alive = g.ents.some(e => e.nem === n) || g.respawnQ.some(q => q.nem === n), y = 14 + k * 34;
    panel(cx, W - 174, y, 160, 28);
    cx.globalAlpha = alive ? 1 : 0.35;
    const a = ATLAS['c_' + n.type]; if (a) icon(cx, 'c_' + n.type, W - 170 + (14 - Math.min(14, a.w * 0.5)), y + 14 - a.h * 0.5, 1);
    cx.textAlign = 'left'; label(cx, String(n.name).toUpperCase(), W - 138, y + 19, alive ? PAL.mint : PAL.g2, `12px ${TITLE}`);
    cx.globalAlpha = 1;
  });

  // Bottom centre: health.
  {
    const bw = 280, x = W / 2 - bw / 2, y = H - 34;
    icon(cx, 'i_tough', x - 30, y - 8, 1.5);
    bar(cx, x, y, bw, 14, P.hp / P.maxhp, P.hp / P.maxhp < 0.3 && Math.sin(t * 12) > 0 ? PAL.r3 : PAL.r, PAL.r2);
    cx.textAlign = 'center'; label(cx, Math.ceil(P.hp) + ' / ' + Math.round(P.maxhp), W / 2, y + 12, PAL.w, `12px ${TITLE}`);
  }
  minimap(cx, g, camX, camY, H);

  // Bottom-right: the ability slot, with a cooldown that drains downward.
  {
    const ab = ABILITIES[P.ability], x = W - 70, y = H - 78, left = Math.max(0, P.actT), ready = left <= 0;
    panel(cx, x, y, 56, 56, ready ? 'rgba(38,92,66,.9)' : 'rgba(26,20,35,.9)');
    cx.globalAlpha = ready ? 1 : 0.45; icon(cx, 'i_' + P.ability, x + 4, y + 4, 3); cx.globalAlpha = 1;
    if (!ready) {
      const fh = Math.round(52 * left / (P.actMax || ab.cd) / 2) * 2;
      cx.fillStyle = 'rgba(26,20,35,.7)'; cx.fillRect(x + 2, y + 2, 52, fh);
      cx.textAlign = 'center'; label(cx, Math.ceil(left), x + 28, y + 36, PAL.w, `bold 20px ${TITLE}`);
    }
    cx.textAlign = 'center'; label(cx, ready ? 'SPACE' : ab.n.toUpperCase(), x + 28, y + 72, ready ? PAL.mint : PAL.g2, `10px ${TITLE}`);
    // Timed effects stack above it.
    const eff = [];
    if (g.frenzyT > 0) eff.push(['pu_frenzy', Math.ceil(g.frenzyT) + 's']);
    if (g.giantT > 0) eff.push(['pu_giant', Math.ceil(g.giantT) + 's']);
    if (P.shield > 0) eff.push(['pu_bubble', 'x' + P.shield]);
    if (g.slowT > 0) eff.push(['i_slow', Math.ceil(g.slowT) + 's']);
    eff.forEach(([ic, tx], k) => { const ey = y - 34 - k * 30; icon(cx, ic, x + 30, ey, 1.4); cx.textAlign = 'right'; label(cx, tx, x + 24, ey + 18, PAL.w, `12px ${TITLE}`); });
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
