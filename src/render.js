// Draws the game. Fixed 960x600 view scaled to the window, camera follows the player.
import { T, BOSS_TIME } from './data.js';
import { ARENA, VIEW, ROCKS } from './sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a); // cosmetic only
export const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

let parts = [], shakeAmt = 0, surge = null;

// Sprite sheets rendered by art/make_sprites.py. Any creature without one falls back to a shape.
const sprites = {};
const offs = new WeakMap(); // per-creature animation offset
export async function loadSprites() {
  try {
    const manifest = await (await fetch('sprites/sprites.json')).json();
    for (const name in manifest) {
      const img = new Image();
      img.onload = () => { sprites[name] = { img, ...manifest[name] }; };
      img.src = `sprites/${name}.png`;
    }
  } catch { /* no sprites yet: shapes only */ }
}


let pAng = 0, pPrev = { x: 0, y: 0 };
const MAX_PARTS = 500; // cap so a huge fight cannot flood the screen with particles
export function resetFx() { parts = []; shakeAmt = 0; surge = null; }

// Pull the effects the sim queued this step.
export function consumeFx(g) {
  for (const f of g.fx) {
    if (f.k === 'shake') shakeAmt = Math.max(shakeAmt, f.v);
    else if (f.k === 'surge') surge = { a: f.a, life: 2 };
    else if (f.k === 'snd') continue;
    else for (let i = 0; i < f.n; i++) {
      const a = Math.random() * 6.28, s = rnd(30, f.sp);
      if (parts.length >= MAX_PARTS) break;
      parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .7), c: f.c });
    }
  }
}

export function updateFx(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  if (surge && (surge.life -= dt) <= 0) surge = null;
  shakeAmt *= 0.88; if (shakeAmt < .3) shakeAmt = 0;
}

export function resize(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1); // phones report 3 or more; 2 is sharp enough and far cheaper
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
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
  if (e.team === 'ally') { cx.strokeStyle = 'rgba(125,255,176,.7)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, e.r + 5, 0, 7); cx.stroke(); }
  let r = e.r; if (d.shape === 'blob') r *= 1 + 0.08 * Math.sin(t * 6 + e.x * .1);
  const sp = sprites[e.type];
  if (sp && e.flash <= 0) {
    // Animated sprite, facing its direction of travel. Each one starts on a different frame.
    if (!offs.has(e)) offs.set(e, Math.floor(Math.random() * sp.frames));
    const size = e.r * sp.draw, f = (Math.floor(t * sp.fps) + offs.get(e)) % sp.frames;
    cx.rotate(e.ang);
    cx.drawImage(sp.img, f * sp.size, 0, sp.size, sp.size, -size / 2, -size / 2, size, size);
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
let groundCv = null;
function ground() {
  if (groundCv) return groundCv;
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
    c.fillStyle = gr; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
    c.strokeStyle = '#08080c'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.beginPath();                // facets
    for (let i = 0; i < n; i += 3) { c.moveTo(k.x + (rn() - 0.5) * k.r * 0.5, k.y + (rn() - 0.5) * k.r * 0.5); c.lineTo(pts[i][0], pts[i][1]); }
    c.stroke();
  }
  c.strokeStyle = '#2a1820'; c.lineWidth = 16; c.strokeRect(0, 0, ARENA.w, ARENA.h);    // wall
  c.strokeStyle = '#ff3b5c88'; c.lineWidth = 2; c.strokeRect(9, 9, ARENA.w - 18, ARENA.h - 18);
  return groundCv;
}

// Corner radar: the whole arena at a glance.
function minimap(cx, g, camX, camY, H) {
  const w = 168, h = w * ARENA.h / ARENA.w, x0 = 14, y0 = H - h - 14, k = w / ARENA.w;
  cx.fillStyle = 'rgba(6,6,10,.72)'; cx.fillRect(x0, y0, w, h);
  cx.fillStyle = '#4a4a60'; for (const r of ROCKS) { cx.beginPath(); cx.arc(x0 + r.x * k, y0 + r.y * k, Math.max(1.5, r.r * k), 0, 7); cx.fill(); }
  for (const e of g.ents) {
    if (e.boss) continue;
    cx.fillStyle = e.team === 'ally' ? '#7dffb0' : '#ff3b5c'; cx.fillRect(x0 + e.x * k - 1, y0 + e.y * k - 1, 2, 2);
  }
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
  // Letterbox the fixed view into the window.
  const sc = Math.min(cv.width / VIEW.w, cv.height / VIEW.h);
  const ox = (cv.width - VIEW.w * sc) / 2, oy = (cv.height - VIEW.h * sc) / 2;
  const camX = clamp(P.x - VIEW.w / 2, 0, ARENA.w - VIEW.w), camY = clamp(P.y - VIEW.h / 2, 0, ARENA.h - VIEW.h);

  cx.save();
  cx.beginPath(); cx.rect(ox, oy, VIEW.w * sc, VIEW.h * sc); cx.clip();
  cx.setTransform(sc, 0, 0, sc, ox + rnd(-shakeAmt, shakeAmt) * sc, oy + rnd(-shakeAmt, shakeAmt) * sc);
  cx.translate(-camX, -camY);
  cx.drawImage(ground(), camX, camY, VIEW.w, VIEW.h, camX, camY, VIEW.w, VIEW.h);

  for (const gem of g.gems) { cx.fillStyle = gem.v >= 5 ? '#ffd23f' : '#7dffb0'; cx.fillRect(gem.x - 3, gem.y - 3, 6, 6); }
  for (const e of g.ents) drawEnt(cx, g, e);
  if (g.state !== 'dead' && !(P.inv > 0 && Math.sin(g.t * 60) > 0)) {
    // Face the way we are moving; the walk cycle only plays while moving.
    const mx = P.x - pPrev.x, my = P.y - pPrev.y, moving = mx * mx + my * my > 0.01;
    if (moving && mx * mx + my * my < 2500) pAng = Math.atan2(my, mx);
    pPrev = { x: P.x, y: P.y };
    const sp = sprites.player;
    if (sp && P.flash <= 0) {
      const size = P.r * sp.draw, f = moving ? Math.floor(g.t * sp.fps) % sp.frames : 0;
      cx.save(); cx.translate(P.x, P.y); cx.rotate(pAng);
      cx.drawImage(sp.img, f * sp.size, 0, sp.size, sp.size, -size / 2, -size / 2, size, size);
      cx.restore();
    } else { cx.fillStyle = P.flash > 0 ? '#ff3b5c' : '#fff'; cx.beginPath(); cx.arc(P.x, P.y, P.r, 0, 7); cx.fill(); }
    cx.strokeStyle = 'rgba(255,255,255,.15)'; cx.lineWidth = 1; cx.beginPath(); cx.arc(P.x, P.y, P.magnet, 0, 7); cx.stroke();
  }
  for (const b of g.bullets) { cx.fillStyle = b.color; cx.beginPath(); cx.arc(b.x, b.y, b.team === 'enemy' ? 4 : 3, 0, 7); cx.fill(); }
  for (const p of parts) { cx.globalAlpha = Math.max(0, p.life * 1.6); cx.fillStyle = p.c; cx.fillRect(p.x - 2, p.y - 2, 4, 4); }
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
