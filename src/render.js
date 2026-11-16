// Draws the game. Fixed 960x600 view scaled to the window, camera follows the player.
import { T } from './data.js';
import { ARENA, VIEW } from './sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a); // cosmetic only
export const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

let parts = [], shakeAmt = 0;

export function resetFx() { parts = []; shakeAmt = 0; }

// Pull the effects the sim queued this step.
export function consumeFx(g) {
  for (const f of g.fx) {
    if (f.k === 'shake') shakeAmt = Math.max(shakeAmt, f.v);
    else for (let i = 0; i < f.n; i++) {
      const a = Math.random() * 6.28, s = rnd(30, f.sp);
      parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .7), c: f.c });
    }
  }
}

export function updateFx(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  shakeAmt *= 0.88; if (shakeAmt < .3) shakeAmt = 0;
}

export function resize(cv) {
  const dpr = window.devicePixelRatio || 1;
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
  if (e.team === 'ally') { cx.strokeStyle = 'rgba(125,255,176,.7)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, e.r + 5, 0, 7); cx.stroke(); }
  let r = e.r; if (d.shape === 'blob') r *= 1 + 0.08 * Math.sin(t * 6 + e.x * .1);
  cx.rotate(d.shape === 'star' ? t * 3 : d.shape === 'square' ? 0 : e.ang);
  cx.fillStyle = e.flash > 0 ? '#fff' : d.color; shapePath(cx, d.shape, r); cx.fill();
  if (d.explode && Math.sin(t * 20) > 0) { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(0, -r - 3, 2.5, 0, 7); cx.fill(); }
  cx.restore();
  if (e.hp < e.maxhp && (e.team === 'ally' || e.type === 'brute')) {
    cx.fillStyle = '#000a'; cx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 3);
    cx.fillStyle = e.team === 'ally' ? '#7dffb0' : '#ff7a2f';
    cx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * Math.max(0, e.hp / e.maxhp), 3);
  }
}

export function draw(cv, cx, g, roster) {
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
  cx.fillStyle = '#0b0b10'; cx.fillRect(0, 0, VIEW.w, VIEW.h);
  cx.translate(-camX, -camY);

  cx.strokeStyle = '#14141d'; cx.lineWidth = 1; cx.beginPath();
  for (let x = 0; x <= ARENA.w; x += 40) { cx.moveTo(x, 0); cx.lineTo(x, ARENA.h); }
  for (let y = 0; y <= ARENA.h; y += 40) { cx.moveTo(0, y); cx.lineTo(ARENA.w, y); }
  cx.stroke();
  cx.strokeStyle = '#ff3b5c55'; cx.lineWidth = 3; cx.strokeRect(0, 0, ARENA.w, ARENA.h);

  for (const gem of g.gems) { cx.fillStyle = gem.v >= 5 ? '#ffd23f' : '#7dffb0'; cx.fillRect(gem.x - 3, gem.y - 3, 6, 6); }
  for (const e of g.ents) drawEnt(cx, g, e);
  if (g.state !== 'dead' && !(P.inv > 0 && Math.sin(g.t * 60) > 0)) {
    cx.fillStyle = P.flash > 0 ? '#ff3b5c' : '#fff'; cx.beginPath(); cx.arc(P.x, P.y, P.r, 0, 7); cx.fill();
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
  let x = W - 16; cx.textAlign = 'right';
  for (const k in roster) { const s = `${T[k].name} ×${roster[k]}`; cx.fillStyle = T[k].color; cx.fillText(s, x, 30); x -= cx.measureText(s).width + 18; }
  cx.restore();
}
