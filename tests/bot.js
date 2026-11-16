// Bots for simulated runs. Used by tests and by `node tests/balance.js`.
import { createGame, step, pick, ARENA } from '../src/sim.js';

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
