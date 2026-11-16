// Draws the game. Fixed 960x600 view scaled to the window, camera follows the player.
import { T, BOSS_TIME, ABILITIES, gearOf } from './data.js';
import { ARENA, VIEW, BOSS_BLAST, BLADE_R } from './sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a); // cosmetic only
export const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

let parts = [], shakeAmt = 0, surge = null;

// Sprite sheets rendered by art/make_sprites.py. Any creature without one falls back to a shape.
const sprites = {};
const offs = new WeakMap(); // per-creature animation offset
const SPRITE_SCALE = 1.3; // creatures are drawn larger than their hit circle so they read at game scale

// Draw one frame. Sheets with `dirs` have a row per facing direction (rendered from a tilted camera), so the
// image is never rotated; older single-row sheets are top-down and get rotated instead.
function blit(cx, sp, ang, frame, size, flash, lift = 0) {
  let row = 0, y = -size / 2;
  if (sp.dirs) { row = ((Math.round(ang / (Math.PI / 4)) % sp.dirs) + sp.dirs) % sp.dirs; y = -size * 0.56 - lift; }
  else cx.rotate(ang);
  cx.drawImage(sp.img, frame * sp.size, row * sp.size, sp.size, sp.size, -size / 2, y, size, size);
  if (flash > 0) { cx.globalAlpha = 0.8; cx.drawImage(sp.white || (sp.white = whiteCopy(sp.img)), frame * sp.size, row * sp.size, sp.size, sp.size, -size / 2, y, size, size); cx.globalAlpha = 1; }
}
// A white copy of a sheet, drawn over a creature for a moment when it is hit. Built the first time it is needed.
function whiteCopy(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const w = c.getContext('2d'); w.drawImage(img, 0, 0); w.globalCompositeOperation = 'source-in'; w.fillStyle = '#fff'; w.fillRect(0, 0, img.width, img.height);
  return c;
}
const shadow = (cx, r, lift = 0) => {
  if (lowDetail) return;
  const w = r * (lift ? 1.7 : 2.3), h = r * (lift ? 0.85 : 1.2);
  cx.drawImage(shadowCv, -w / 2, r * 0.3 - h / 2, w, h);
};

export async function loadSprites() {
  try {
    const manifest = await (await fetch('sprites/sprites.json')).json();
    for (const name in manifest) {
      const img = new Image();
      img.onload = () => {
        sprites[name] = { img, white: null, ...manifest[name] };
      };
      img.src = `sprites/${name}.png`;
    }
  } catch { /* no sprites yet: shapes only */ }
}


let pAng = 0, pPrev = { x: 0, y: 0 };
const MAX_PARTS = 500; // cap so a huge fight cannot flood the screen with particles
let rings = []; // expanding shockwave rings
let nums = [];  // floating damage numbers
let sweeps = [], bolts = [], banner = null; // sword arcs, lightning, and the 'new gear' banner
export function resetFx() { parts = []; rings = []; nums = []; sweeps = []; bolts = []; banner = null; shakeAmt = 0; surge = null; }

// Pull the effects the sim queued this step.
export function consumeFx(g) {
  for (const f of g.fx) {
    if (f.k === 'shake') shakeAmt = Math.max(shakeAmt, f.v);
    else if (f.k === 'surge') surge = { a: f.a, life: 2 };
    else if (f.k === 'snd') continue;
    else if (f.k === 'sweep') sweeps.push({ ...f, life: 0.16 });
    else if (f.k === 'bolt') bolts.push({ pts: f.pts, life: 0.14 });
    else if (f.k === 'gear') banner = { text: 'NEW GEAR: ' + gearOf(f.id).n, life: 3.5 };
    else if (f.k === 'act') continue;
    else if (f.k === 'num') { if (nums.length < 50) nums.push({ x: f.x + rnd(-6, 6), y: f.y - 8, v: Math.round(f.v), life: 0.6 }); }
    else if (f.k === 'nova') rings.push({ x: f.x, y: f.y, r: f.r, life: 0.35 });
    else for (let i = 0; i < f.n; i++) {
      const a = Math.random() * 6.28, s = rnd(30, f.sp);
      if (parts.length >= MAX_PARTS) break;
      parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .7), c: f.c, s: rnd(2, 5.5) });
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
  if (banner && (banner.life -= dt) <= 0) banner = null;
  if (surge && (surge.life -= dt) <= 0) surge = null;
  shakeAmt *= 0.88; if (shakeAmt < .3) shakeAmt = 0;
}

// The canvas is always the 960x600 view at `quality` pixels per unit, and CSS stretches it to fit the window.
// It used to be the whole window at full pixel density (7.5 million pixels full-screen), which made everything slow.
let quality = 2, lowDetail = false;
export const QUALITY_STEPS = [2, 1.5, 1];
export function setQuality(q, cv, low = false) { quality = q; lowDetail = low; resize(cv); }
export function resize(cv) {
  const fit = Math.min(innerWidth / VIEW.w, innerHeight / VIEW.h);
  const q = Math.min(quality, fit * (window.devicePixelRatio || 1));   // never more pixels than the screen can show
  cv.width = Math.round(VIEW.w * q); cv.height = Math.round(VIEW.h * q);
  cv.style.width = Math.floor(VIEW.w * fit) + 'px'; cv.style.height = Math.floor(VIEW.h * fit) + 'px';
}

// Painted once and reused: the pool of light around the player, and the soft shadow under creatures.
let lightCv = null, shadowCv = null;
const LIGHT_R = 1150;
function baked() {
  if (lightCv) return;
  lightCv = document.createElement('canvas'); lightCv.width = lightCv.height = 256;
  let c = lightCv.getContext('2d');
  let gr = c.createRadialGradient(128, 128, 4, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,236,200,.09)'); gr.addColorStop(0.19, 'rgba(0,0,0,0)'); gr.addColorStop(0.54, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
  c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  shadowCv = document.createElement('canvas'); shadowCv.width = 64; shadowCv.height = 32;
  c = shadowCv.getContext('2d'); c.scale(1, 0.5);
  gr = c.createRadialGradient(32, 32, 6, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(0.7, 'rgba(0,0,0,.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
}

function shapePath(cx, s, r) {
  cx.beginPath();
  if (s === 'tri') { cx.moveTo(r * 1.2, 0); cx.lineTo(-r, -r); cx.lineTo(-r * .4, 0); cx.lineTo(-r, r); }
  else if (s === 'diamond') { cx.moveTo(r * 1.2, 0); cx.lineTo(0, -r * .8); cx.lineTo(-r, 0); cx.lineTo(0, r * .8); }
  else if (s === 'square') cx.rect(-r, -r, r * 2, r * 2);
  else if (s === 'star') for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * .45 : r * 1.2; cx.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
  else cx.arc(0, 0, r, 0, 7);
  cx.closePath();
}

function drawEnt(cx, g, e) {
  const d = T[e.type], t = g.t;
  cx.save(); cx.translate(e.x, e.y);
  if (e.boss) {
    // The nemesis: a pulsing red aura so it never reads as just a big enemy.
    const k = 0.5 + 0.5 * Math.sin(t * 5), R = e.r * 1.9;
    const gr = cx.createRadialGradient(0, 0, e.r * 0.6, 0, 0, R);
    gr.addColorStop(0, `rgba(255,59,92,${0.35 + 0.2 * k})`); gr.addColorStop(1, 'rgba(255,59,92,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(0, 0, R, 0, 7); cx.fill();
    cx.strokeStyle = '#ff3b5c'; cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, e.r * (1.25 + 0.08 * k), 0, 7); cx.stroke();
  }
  if (e.elite) {
    const k = 0.5 + 0.5 * Math.sin(t * 6);
    cx.strokeStyle = `rgba(255,210,63,${0.6 + 0.4 * k})`; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(0, 0, e.r * 1.35, 0, 7); cx.stroke();
  }
  // Tells: what an enemy is about to do, drawn before it happens.
  if (e.wind > 0 && !(e.boss && (e.type === 'slime' || e.type === 'bomber' || e.type === 'wisp'))) {
    const len = e.boss ? 620 : 300, w = e.r * 2;                       // charge lane / arrow fan
    cx.save(); cx.rotate(e.ang); cx.fillStyle = `rgba(255,59,92,${0.18 + 0.14 * Math.sin(t * 30)})`;
    if (e.boss && e.type === 'archer') { cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, len, -0.48, 0.48); cx.closePath(); cx.fill(); }
    else cx.fillRect(0, -w / 2, len, w);
    cx.restore();
  }
  if (e.boss && e.wind > 0 && e.type === 'bomber') {
    cx.fillStyle = `rgba(255,59,92,${0.14 + 0.1 * Math.sin(t * 30)})`; cx.beginPath(); cx.arc(0, 0, BOSS_BLAST, 0, 7); cx.fill();
    cx.strokeStyle = '#ff3b5c'; cx.lineWidth = 2; cx.stroke();
  }
  if (e.boss && e.wind > 0 && e.type === 'slime') {
    cx.strokeStyle = '#ff3b5c'; cx.lineWidth = 3; cx.fillStyle = 'rgba(255,59,92,.16)';
    cx.beginPath(); cx.arc(e.jx - e.x, e.jy - e.y, e.r, 0, 7); cx.fill(); cx.stroke();
  }
  if (e.aim > 0) {
    cx.strokeStyle = `rgba(255,210,63,${0.35 + 0.5 * (1 - e.aim / 0.5)})`; cx.lineWidth = 1.5; cx.beginPath();
    cx.moveTo(0, 0); cx.lineTo(Math.cos(e.aimAng) * 420, Math.sin(e.aimAng) * 420); cx.stroke();
  }
  if (e.warn) { cx.strokeStyle = '#ff3b5c'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, e.r + 5, 0, 7); cx.stroke(); }
  if (e.fuse > 0 && e.team === 'enemy') {
    cx.fillStyle = `rgba(255,59,92,${0.12 + 0.12 * Math.sin(t * 40)})`; cx.beginPath(); cx.arc(0, 0, 70, 0, 7); cx.fill();
    cx.strokeStyle = 'rgba(255,59,92,.8)'; cx.lineWidth = 1.5; cx.stroke();
  }
  if (e.team === 'ally') { cx.strokeStyle = 'rgba(125,255,176,.7)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, e.r + 5, 0, 7); cx.stroke(); }
  let r = e.r; if (d.shape === 'blob') r *= 1 + 0.08 * Math.sin(t * 6 + e.x * .1);
  const sp = sprites[e.type];
  if (sp) {
    // Animated sprite facing its direction of travel, on a soft shadow. Flyers hover above theirs.
    if (!offs.has(e)) offs.set(e, Math.floor(Math.random() * sp.frames));
    const size = e.r * sp.draw * SPRITE_SCALE, f = (Math.floor(t * sp.fps) + offs.get(e)) % sp.frames, lift = d.fly ? 9 : 0;
    shadow(cx, e.r, lift);
    blit(cx, sp, e.ang, f, size, e.flash, lift);
    cx.restore(); drawBar(cx, e); return;
  }
  cx.rotate(d.shape === 'star' ? t * 3 : d.shape === 'square' ? 0 : e.ang);
  cx.fillStyle = e.flash > 0 ? '#fff' : d.color; shapePath(cx, d.shape, r); cx.fill();
  if (d.explode && Math.sin(t * 20) > 0) { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(0, -r - 3, 2.5, 0, 7); cx.fill(); }
  cx.restore(); drawBar(cx, e);
}

function drawBar(cx, e) {
  if (e.hp < e.maxhp && !e.boss && (e.team === 'ally' || e.type === 'brute')) {
    cx.fillStyle = '#000a'; cx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 3);
    cx.fillStyle = e.team === 'ally' ? '#7dffb0' : '#ff7a2f';
    cx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * Math.max(0, e.hp / e.maxhp), 3);
  }
}

// The floor, walls and rocks never change, so they are painted once and reused every frame.
let groundCv = null, groundFor = null;
function ground(ROCKS) {
  if (groundCv && groundFor === ROCKS) return groundCv;
  groundFor = ROCKS;
  groundCv = document.createElement('canvas'); groundCv.width = ARENA.w; groundCv.height = ARENA.h;
  const c = groundCv.getContext('2d');
  let seed = 7; const rn = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.fillStyle = '#0e0e16'; c.fillRect(0, 0, ARENA.w, ARENA.h);
  for (let x = 0; x < ARENA.w; x += 80) for (let y = 0; y < ARENA.h; y += 80) {   // flagstones
    c.fillStyle = `rgba(255,255,255,${0.008 + rn() * 0.022})`; c.fillRect(x + 1, y + 1, 78, 78);
  }
  for (let i = 0; i < 900; i++) {                                                  // grit
    c.fillStyle = rn() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.35)';
    c.fillRect(rn() * ARENA.w, rn() * ARENA.h, 1 + rn() * 2, 1 + rn() * 2);
  }
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.5;                             // cracks
  for (let i = 0; i < 26; i++) {
    let x = rn() * ARENA.w, y = rn() * ARENA.h, a = rn() * 6.28; c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 5; k++) { a += (rn() - 0.5) * 1.4; x += Math.cos(a) * 16; y += Math.sin(a) * 16; c.lineTo(x, y); }
    c.stroke();
  }
  const v = c.createRadialGradient(ARENA.w / 2, ARENA.h / 2, 250, ARENA.w / 2, ARENA.h / 2, 950); // darker toward the walls
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = v; c.fillRect(0, 0, ARENA.w, ARENA.h);
  for (const k of ROCKS) {
    c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(k.x + 7, k.y + 9, k.r * 1.02, k.r * 0.95, 0, 0, 7); c.fill(); // shadow
    const pts = []; const n = 9 + Math.floor(rn() * 3), a0 = rn() * 6.28;
    for (let i = 0; i < n; i++) { const a = a0 + i * 6.283 / n, q = k.r * (0.9 + rn() * 0.12); pts.push([k.x + Math.cos(a) * q, k.y + Math.sin(a) * q]); }
    const gr = c.createRadialGradient(k.x - k.r * 0.4, k.y - k.r * 0.45, k.r * 0.1, k.x, k.y, k.r * 1.1);
    gr.addColorStop(0, '#6c6c86'); gr.addColorStop(0.6, '#3a3a4e'); gr.addColorStop(1, '#1c1c28');
    const lift = k.r * 0.32;                                                              // rocks stand up: a dark side face under the top
    c.fillStyle = '#14141d'; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
    c.strokeStyle = '#08080c'; c.lineWidth = 2.5; c.stroke();
    c.save(); c.translate(0, -lift);
    c.fillStyle = gr; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
    c.strokeStyle = '#08080c'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.beginPath();                // facets
    for (let i = 0; i < n; i += 3) { c.moveTo(k.x + (rn() - 0.5) * k.r * 0.5, k.y + (rn() - 0.5) * k.r * 0.5); c.lineTo(pts[i][0], pts[i][1]); }
    c.stroke();
    c.restore();
  }
  c.strokeStyle = '#2a1820'; c.lineWidth = 16; c.strokeRect(0, 0, ARENA.w, ARENA.h);    // wall
  c.strokeStyle = '#ff3b5c88'; c.lineWidth = 2; c.strokeRect(9, 9, ARENA.w - 18, ARENA.h - 18);
  return groundCv;
}

// Corner radar: the whole arena at a glance.
function minimap(cx, g, camX, camY, H) {
  const w = 168, h = w * ARENA.h / ARENA.w, x0 = 14, y0 = H - h - 14, k = w / ARENA.w;
  cx.fillStyle = 'rgba(6,6,10,.72)'; cx.fillRect(x0, y0, w, h);
  cx.fillStyle = '#4a4a60'; for (const r of g.rocks) { cx.beginPath(); cx.arc(x0 + r.x * k, y0 + r.y * k, Math.max(1.5, r.r * k), 0, 7); cx.fill(); }
  for (const e of g.ents) {
    if (e.boss) continue;
    const q = e.elite ? 2 : 1;
    cx.fillStyle = e.team === 'ally' ? '#7dffb0' : e.elite ? '#ffd23f' : '#ff3b5c'; cx.fillRect(x0 + e.x * k - q, y0 + e.y * k - q, q * 2, q * 2);
  }
  cx.fillStyle = '#ffd23f'; for (const c of g.chests) cx.fillRect(x0 + c.x * k - 2, y0 + c.y * k - 2, 4, 4);
  if (g.boss) {
    const p = 4 + Math.sin(g.t * 6);
    cx.fillStyle = '#ff3b5c'; cx.beginPath(); cx.arc(x0 + g.boss.x * k, y0 + g.boss.y * k, p, 0, 7); cx.fill();
    cx.strokeStyle = '#fff'; cx.lineWidth = 1; cx.stroke();
  }
  cx.strokeStyle = 'rgba(255,255,255,.28)'; cx.lineWidth = 1; cx.strokeRect(x0 + camX * k, y0 + camY * k, VIEW.w * k, VIEW.h * k);
  cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x0 + g.P.x * k, y0 + g.P.y * k, 2.5, 0, 7); cx.fill();
  cx.strokeStyle = '#3a3a4c'; cx.strokeRect(x0 + .5, y0 + .5, w, h);
}

export function draw(cv, cx, g) {
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.fillStyle = '#050508'; cx.fillRect(0, 0, cv.width, cv.height);
  if (!g) return;
  const P = g.P;
  baked();
  const sc = cv.width / VIEW.w, ox = 0, oy = 0;   // the canvas is exactly the view
  const camX = clamp(P.x - VIEW.w / 2, 0, ARENA.w - VIEW.w), camY = clamp(P.y - VIEW.h / 2, 0, ARENA.h - VIEW.h);

  cx.save();
  cx.setTransform(sc, 0, 0, sc, ox + rnd(-shakeAmt, shakeAmt) * sc, oy + rnd(-shakeAmt, shakeAmt) * sc);
  cx.translate(-camX, -camY);
  cx.drawImage(ground(g.rocks), camX, camY, VIEW.w, VIEW.h, camX, camY, VIEW.w, VIEW.h);
  // A pool of light around you; the arena falls into dark further out.
  if (!lowDetail) cx.drawImage(lightCv, P.x - LIGHT_R, P.y - LIGHT_R, LIGHT_R * 2, LIGHT_R * 2);

  for (const gem of g.gems) { cx.fillStyle = gem.v >= 5 ? '#ffd23f' : '#7dffb0'; cx.fillRect(gem.x - 3, gem.y - 3, 6, 6); }
  for (const f of g.fires) {                             // Flamewalker trail
    const k = Math.min(1, f.life / 0.6), fl = 0.75 + 0.25 * Math.sin(g.t * 18 + f.x);
    cx.fillStyle = `rgba(255,120,30,${0.3 * k * fl})`; cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 7); cx.fill();
    cx.fillStyle = `rgba(255,220,90,${0.4 * k * fl})`; cx.beginPath(); cx.arc(f.x, f.y, f.r * 0.5, 0, 7); cx.fill();
  }
  for (const t of g.totems) {                            // Totems
    cx.fillStyle = 'rgba(255,210,63,.14)'; cx.beginPath(); cx.arc(t.x, t.y, 20 + Math.sin(g.t * 4) * 2, 0, 7); cx.fill();
    cx.fillStyle = '#5a3b16'; cx.fillRect(t.x - 6, t.y - 20, 12, 24); cx.fillStyle = '#ffd23f'; cx.fillRect(t.x - 6, t.y - 20, 12, 4); cx.fillRect(t.x - 3, t.y - 12, 6, 4);
    cx.strokeStyle = '#2a1a08'; cx.lineWidth = 1.5; cx.strokeRect(t.x - 6, t.y - 20, 12, 24);
    if (t.life < 3) { cx.fillStyle = '#000a'; cx.fillRect(t.x - 8, t.y + 7, 16, 2); cx.fillStyle = '#ffd23f'; cx.fillRect(t.x - 8, t.y + 7, 16 * t.life / 3, 2); }
  }
  if (g.decoy) {                                         // Decoy: a ghost of you with a shrinking fuse ring
    const sp = sprites.player, d = g.decoy;
    cx.save(); cx.translate(d.x, d.y); cx.globalAlpha = 0.55;
    if (sp) blit(cx, sp, pAng, 0, P.r * sp.draw * SPRITE_SCALE, 0); else { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(0, 0, P.r, 0, 7); cx.fill(); }
    cx.globalAlpha = 1; cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, 12 + 98 * (d.life / 2.5), 0, 7); cx.stroke();
    cx.restore();
  }
  for (const c of g.chests) {
    const b = Math.sin(g.t * 5) * 2;
    cx.fillStyle = 'rgba(255,210,63,.18)'; cx.beginPath(); cx.arc(c.x, c.y, 22 + b, 0, 7); cx.fill();
    cx.fillStyle = '#8a5a1c'; cx.fillRect(c.x - 11, c.y - 8, 22, 16);
    cx.fillStyle = '#ffd23f'; cx.fillRect(c.x - 11, c.y - 3, 22, 3); cx.fillRect(c.x - 2, c.y - 5, 4, 7);
    cx.strokeStyle = '#3a2408'; cx.lineWidth = 1.5; cx.strokeRect(c.x - 11, c.y - 8, 22, 16);
  }
  for (const e of g.ents) drawEnt(cx, g, e);
  for (const r of g.rangs) {                             // Boomerangs
    cx.save(); cx.translate(r.x, r.y); cx.rotate(g.t * 22); cx.strokeStyle = '#e8f6ff'; cx.lineWidth = 4; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(-r.r, -r.r * 0.5); cx.lineTo(0, r.r * 0.4); cx.lineTo(r.r, -r.r * 0.5); cx.stroke(); cx.restore();
  }
  for (const s of sweeps) {                              // Greatsword arcs
    const k = s.life / 0.16;
    cx.fillStyle = `rgba(232,246,255,${0.5 * k})`; cx.beginPath(); cx.moveTo(s.x, s.y); cx.arc(s.x, s.y, s.r, s.a - s.half, s.a + s.half); cx.closePath(); cx.fill();
    cx.strokeStyle = `rgba(255,255,255,${k})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(s.x, s.y, s.r, s.a - s.half, s.a + s.half); cx.stroke();
  }
  for (const b of bolts) {                               // Storm Rod lightning: a jagged line through each target
    cx.strokeStyle = `rgba(160,235,255,${b.life / 0.14})`; cx.lineWidth = 3; cx.beginPath();
    b.pts.forEach((p, i) => {
      if (!i) return cx.moveTo(p.x, p.y);
      const q = b.pts[i - 1]; cx.lineTo((p.x + q.x) / 2 + rnd(-10, 10), (p.y + q.y) / 2 + rnd(-10, 10)); cx.lineTo(p.x, p.y);
    });
    cx.stroke();
  }
  for (let i = 0; i < P.blades && g.state !== 'dead'; i++) {
    const a = g.t * 3.2 + i * 6.283 / P.blades, bx = P.x + Math.cos(a) * BLADE_R, by = P.y + Math.sin(a) * BLADE_R;
    cx.save(); cx.translate(bx, by); cx.rotate(g.t * 14);
    cx.fillStyle = '#e8f6ff'; cx.beginPath(); cx.moveTo(12, 0); cx.lineTo(0, 4); cx.lineTo(-12, 0); cx.lineTo(0, -4); cx.closePath(); cx.fill();
    cx.rotate(1.57); cx.beginPath(); cx.moveTo(12, 0); cx.lineTo(0, 4); cx.lineTo(-12, 0); cx.lineTo(0, -4); cx.closePath(); cx.fill();
    cx.restore();
  }
  cx.textAlign = 'center';
  let bigFont = null;                                   // changing the font is slow, so only do it when the size changes
  for (const n of nums) {
    const big = n.v >= 40;
    if (big !== bigFont) { bigFont = big; cx.font = `bold ${big ? 15 : 11}px ui-monospace,Menlo,monospace`; }
    cx.globalAlpha = Math.min(1, n.life * 3);
    cx.fillStyle = '#000'; cx.fillText(n.v, n.x + 1, n.y + 1); cx.fillStyle = big ? '#ffd23f' : '#fff'; cx.fillText(n.v, n.x, n.y);
  }
  cx.globalAlpha = 1;
  for (const r of rings) {
    const k = 1 - r.life / 0.35;
    cx.strokeStyle = `rgba(255,255,255,${1 - k})`; cx.lineWidth = 6 * (1 - k) + 1; cx.beginPath(); cx.arc(r.x, r.y, r.r * (0.3 + 0.7 * k), 0, 7); cx.stroke();
  }
  if (g.state !== 'dead' && !(P.inv > 0 && Math.sin(g.t * 60) > 0)) {
    // Face the way we are moving; the walk cycle only plays while moving.
    const mx = P.x - pPrev.x, my = P.y - pPrev.y, moving = mx * mx + my * my > 0.01;
    if (moving && mx * mx + my * my < 2500) pAng = Math.atan2(my, mx);
    pPrev = { x: P.x, y: P.y };
    const sp = sprites.player;
    if (sp) {
      const size = P.r * sp.draw * SPRITE_SCALE, f = moving ? Math.floor(g.t * sp.fps) % sp.frames : 0;
      cx.save(); cx.translate(P.x, P.y); shadow(cx, P.r); blit(cx, sp, pAng, f, size, P.flash); cx.restore();
    } else { cx.fillStyle = P.flash > 0 ? '#ff3b5c' : '#fff'; cx.beginPath(); cx.arc(P.x, P.y, P.r, 0, 7); cx.fill(); }
    cx.strokeStyle = 'rgba(255,255,255,.15)'; cx.lineWidth = 1; cx.beginPath(); cx.arc(P.x, P.y, P.magnet, 0, 7); cx.stroke();
  }
  for (const b of g.bullets) { cx.fillStyle = b.color; cx.beginPath(); cx.arc(b.x, b.y, b.team === 'enemy' ? 4 : 3, 0, 7); cx.fill(); }
  for (const p of parts) { cx.globalAlpha = Math.max(0, p.life * 1.6); cx.fillStyle = p.c; cx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  cx.globalAlpha = 1;

  // HUD, in view coordinates.
  cx.setTransform(sc, 0, 0, sc, ox, oy);
  const W = VIEW.w, H = VIEW.h, font = 'ui-monospace,Menlo,monospace';
  cx.fillStyle = '#222'; cx.fillRect(0, 0, W, 4); cx.fillStyle = '#7dffb0'; cx.fillRect(0, 0, W * Math.min(1, P.xp / P.next), 4);
  cx.fillStyle = '#fff'; cx.font = 'bold 26px ' + font; cx.textAlign = 'center'; cx.fillText(fmt(g.t), W / 2, 40);
  cx.font = '14px ' + font; cx.textAlign = 'left'; cx.fillStyle = '#aaa'; cx.fillText(`LV ${P.lvl}   KILLS ${g.kills}`, 16, 30);
  const bw = 260; cx.fillStyle = '#222'; cx.fillRect(W / 2 - bw / 2, H - 30, bw, 10);
  cx.fillStyle = '#ff3b5c'; cx.fillRect(W / 2 - bw / 2, H - 30, bw * P.hp / P.maxhp, 10);
  minimap(cx, g, camX, camY, H);
  if (g.slowT > 0) { cx.fillStyle = 'rgba(90,150,255,.10)'; cx.fillRect(0, 0, W, H); }   // Time Slow tint
  // Ability: an icon with a cooldown wipe, bottom-right.
  {
    const ab = ABILITIES[P.ability], ax = W - 44, ay = H - 44, left = Math.max(0, P.actT), ready = left <= 0;
    cx.fillStyle = 'rgba(6,6,10,.72)'; cx.beginPath(); cx.arc(ax, ay, 26, 0, 7); cx.fill();
    if (!ready) { cx.fillStyle = 'rgba(255,255,255,.16)'; cx.beginPath(); cx.moveTo(ax, ay); cx.arc(ax, ay, 26, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - left / (P.actMax || ab.cd))); cx.closePath(); cx.fill(); }
    cx.strokeStyle = ready ? '#7dffb0' : '#555'; cx.lineWidth = 2; cx.beginPath(); cx.arc(ax, ay, 26, 0, 7); cx.stroke();
    cx.textAlign = 'center'; cx.fillStyle = ready ? '#fff' : '#888'; cx.font = '22px ' + font; cx.fillText(ab.i, ax, ay + 8);
    cx.font = '10px ' + font; cx.fillStyle = ready ? '#7dffb0' : '#888'; cx.fillText(ready ? ab.n.toUpperCase() : Math.ceil(left) + 's', ax, ay + 40);
  }
  if (banner) {
    cx.globalAlpha = Math.min(1, banner.life); cx.textAlign = 'center'; cx.font = 'bold 22px ' + font;
    cx.fillStyle = '#000'; cx.fillText(banner.text, W / 2 + 1, 101); cx.fillStyle = '#ffd23f'; cx.fillText(banner.text, W / 2, 100); cx.globalAlpha = 1;
  }
  // Surge warning: a red arc on the side the wave is coming from.
  if (surge) {
    cx.globalAlpha = Math.min(1, surge.life) * (0.5 + 0.5 * Math.sin(g.t * 16));
    cx.strokeStyle = '#ff3b5c'; cx.lineWidth = 6; cx.beginPath();
    cx.arc(W / 2, H / 2, 270, surge.a - 0.45, surge.a + 0.45); cx.stroke(); cx.globalAlpha = 1;
  }
  // Party: one line per nemesis, dimmed once it has fallen for good.
  cx.textAlign = 'right';
  g.party.forEach((n, i) => {
    const alive = g.ents.some(e => e.nem === n) || g.respawnQ.some(q => q.nem === n);
    cx.globalAlpha = alive ? 1 : 0.3; cx.fillStyle = T[n.type].color;
    cx.fillText(`${n.name} ${n.title}`, W - 16, 30 + i * 18);
  });
  cx.globalAlpha = 1; cx.textAlign = 'center';
  if (g.boss) {
    const w = 420; cx.fillStyle = '#222'; cx.fillRect(W / 2 - w / 2, 56, w, 8);
    cx.fillStyle = T[g.boss.type].color; cx.fillRect(W / 2 - w / 2, 56, w * Math.max(0, g.boss.hp / g.boss.maxhp), 8);
    if (g.t - g.bossAt < 3.5) { cx.fillStyle = '#ff3b5c'; cx.font = 'bold 30px ' + font; cx.fillText('YOUR NEMESIS HAS COME', W / 2, H / 2 - 120); }
  } else if (!g.bossAt && g.t > BOSS_TIME - 30) {
    cx.fillStyle = '#ff3b5c'; cx.fillText(`nemesis in ${Math.ceil(BOSS_TIME - g.t)}`, W / 2, 62);
  }
  cx.restore();
}
