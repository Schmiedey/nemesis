// Bots for simulated runs. Used by tests and by `node tests/balance.js`.
import { createGame, step, pick, ARENA, ROCKS } from '../src/sim.js';

export const still = () => ({ mx: 0, my: 0 });

// Runs from the crowd, drifts back toward the middle so it does not get cornered.
export function kiter(g) {
  const P = g.P; let ax = 0, ay = 0;
  for (const e of g.ents) {
    if (e.team !== 'enemy') continue;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 260) { const w = (260 - d) / d; ax += dx * w; ay += dy * w; }
  }
  for (const b of g.bullets) {
    if (b.team !== 'enemy') continue;
    const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1;
    if (d < 120) { ax += dx / d * 150; ay += dy / d * 150; }
  }
  const cx = ARENA.w / 2 - P.x, cy = ARENA.h / 2 - P.y;
  ax += cx * 0.25; ay += cy * 0.25;
  if (!ax && !ay) return still();
  return { mx: ax, my: ay };
}

// Plays one full run. choose(g) picks a card index.
export function simulate(seed, { party = [], bossType = 'brute', bot = still, choose = () => 0, maxSeconds = 900 } = {}) {
  const g = createGame({ seed, party, bossType });
  let n = 0;
  while (g.state !== 'dead' && g.state !== 'won' && n++ < maxSeconds * 60) {
    if (g.state === 'lvl') pick(g, choose(g)); else step(g, 1 / 60, bot(g));
  }
  return g;
}

// Plays like a skilled person: looks a moment ahead in 16 directions, dodges enemies and
// bullets, stays off the walls, and goes for gems when it is safe.
export function smart(g) {
  const P = g.P, W = ARENA.w, H = ARENA.h;
  const enemies = g.ents.filter(e => e.team === 'enemy');
  const shots = g.bullets.filter(b => b.team === 'enemy');
  let gem = null, gd = 350 * 350;
  for (const x of g.gems) { const d = (x.x - P.x) ** 2 + (x.y - P.y) ** 2; if (d < gd) { gd = d; gem = x; } }
  let best = { mx: 0, my: 0 }, bs = -Infinity;
  for (let i = 0; i < 17; i++) {
    const a = i * Math.PI / 8, mx = i < 16 ? Math.cos(a) : 0, my = i < 16 ? Math.sin(a) : 0;
    let sc = 0;
    for (const h of [0.15, 0.4]) {
      const x = Math.max(P.r, Math.min(W - P.r, P.x + mx * P.spd * h)), y = Math.max(P.r, Math.min(H - P.r, P.y + my * P.spd * h));
      for (const e of enemies) {
        const reach = e.r + P.r + (e.type === 'bomber' ? 60 : 0);
        const d = Math.max(1, Math.hypot(x - e.x, y - e.y) - e.spd * h * 0.9 - reach);
        if (d < 240) sc -= (e.boss ? 5 : e.dmg / 8) * 3000 / (d * d + 40);
      }
      for (const b of shots) {
        const d = Math.hypot(x - (b.x + b.vx * h), y - (b.y + b.vy * h));
        if (d < 45) sc -= 8 * (45 - d) / 45;
      }
      for (const k of ROCKS) { const d = Math.hypot(x - k.x, y - k.y) - k.r - P.r; if (d < 26) sc -= (26 - d) * 0.12; }
      const m = Math.min(x, y, W - x, H - y);
      if (m < 130) sc -= (130 - m) * 0.03;
    }
    if (gem) { const d = Math.sqrt(gd) || 1; sc += 0.8 * (mx * (gem.x - P.x) + my * (gem.y - P.y)) / d; }
    const cx = W / 2 - P.x, cy = H / 2 - P.y, cd = Math.hypot(cx, cy) || 1;
    sc += 0.3 * (cd / 500) * (mx * cx + my * cy) / cd;
    if (sc > bs) { bs = sc; best = { mx, my }; }
  }
  return best;
}
