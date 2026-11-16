import { describe, it, expect } from 'vitest';
import { createGame, step, pick, ARENA } from '../src/sim.js';
import { T } from '../src/data.js';
import { sanitize, loadSave, writeSave } from '../src/save.js';

// Plays a full run with a bot that stands still and always takes card 1.
export function simulate(seed, roster = {}, maxSeconds = 600) {
  const g = createGame({ seed, roster });
  let n = 0;
  while (g.state !== 'dead' && n++ < maxSeconds * 60) {
    if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, { mx: 0, my: 0 });
  }
  return g;
}

describe('sim', () => {
  it('a run ends in death by a real enemy type', () => {
    const g = simulate(1);
    expect(g.state).toBe('dead');
    expect(T[g.killer]).toBeTruthy();
    expect(g.t).toBeGreaterThan(5);
  });

  it('is deterministic for a given seed', () => {
    const a = simulate(42), b = simulate(42);
    expect(a.t).toBe(b.t);
    expect(a.kills).toBe(b.kills);
    expect(a.killer).toBe(b.killer);
  });

  it('spawns roster allies, capped at 4 per type', () => {
    const g = createGame({ seed: 3, roster: { bat: 2, brute: 9, bogus: 5 } });
    const allies = g.ents.filter(e => e.team === 'ally');
    expect(allies.filter(e => e.type === 'bat').length).toBe(2);
    expect(allies.filter(e => e.type === 'brute').length).toBe(4);
    expect(allies.length).toBe(6);
  });

  it('keeps the player inside the arena', () => {
    const g = createGame({ seed: 5 });
    for (let i = 0; i < 60 * 20 && g.state !== 'dead'; i++) {
      if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, { mx: 1, my: 1 });
    }
    expect(g.P.x).toBeLessThanOrEqual(ARENA.w);
    expect(g.P.y).toBeLessThanOrEqual(ARENA.h);
  });
});

describe('save', () => {
  const store = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; };

  it('survives corrupt data', () => {
    const s = store(); s.setItem('nemesis_save', '{not json');
    expect(loadSave(s)).toEqual({ v: 2, roster: {}, best: 0, runs: 0 });
  });

  it('drops unknown enemies and bad numbers', () => {
    expect(sanitize({ roster: { bat: 2, dragon: 3, slime: -1, brute: 'x' }, best: 'no', runs: 4 }))
      .toEqual({ v: 2, roster: { bat: 2 }, best: 0, runs: 4 });
  });

  it('migrates a v1 save and round-trips', () => {
    const s = store(); s.setItem('nemesis_v1', JSON.stringify({ roster: { bat: 1 }, best: 30, runs: 2 }));
    const loaded = loadSave(s);
    expect(loaded.roster).toEqual({ bat: 1 });
    writeSave(loaded, s);
    expect(loadSave(s)).toEqual(loaded);
  });
});
