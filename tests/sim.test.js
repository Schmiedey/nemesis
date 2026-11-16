import { describe, it, expect } from 'vitest';
import { createGame, step, pick, recruitQuality, ARENA } from '../src/sim.js';
import { T, BOSS_TIME } from '../src/data.js';
import { sanitize, loadSave, writeSave, addRecruit, bossTypeFor, growParty, evolve } from '../src/save.js';
import { simulate, still } from './bot.js';

const nem = (id, type, q = 1, perks = {}) => ({ id, type, q, perks, name: 'N' + id, title: 'the Test' });

describe('sim', () => {
  it('a run ends in death by a real enemy type, with a recruit', () => {
    const g = simulate(1, { bot: still });
    expect(g.state).toBe('dead');
    expect(T[g.killer]).toBeTruthy();
    expect(g.recruit.type).toBe(g.killer);
  });

  it('is deterministic for a given seed', () => {
    const a = simulate(42), b = simulate(42);
    expect([a.t, a.kills, a.killer, a.recruit.name]).toEqual([b.t, b.kills, b.killer, b.recruit.name]);
  });

  it('dying early earns a weaker recruit than surviving', () => {
    expect(recruitQuality(5, 1)).toBeLessThan(0.7);            // a runt
    expect(recruitQuality(150, 9)).toBeGreaterThan(1.3);        // a veteran
    expect(recruitQuality(300, 15, true)).toBeGreaterThan(2);   // a champion
  });

  it('the killer inherits the build you died with', () => {
    const g = createGame({ seed: 7 });
    g.picks = { pierce: 2, shots: 5, magnet: 4 };
    g.P.hp = 1; g.P.maxhp = 1;
    for (let i = 0; i < 60 * 120 && g.state !== 'dead'; i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, still()); }
    expect(g.recruit.perks).toMatchObject({ pierce: 2, shots: 3 });
    expect(g.recruit.perks.magnet).toBeUndefined();
    expect(g.recruit.title).toBe('the Splitter');
  });

  it('spawns the drafted party; bats come as a pack', () => {
    const g = createGame({ seed: 3, party: [nem(1, 'bat'), nem(2, 'brute'), nem(3, 'bogus'), nem(4, 'wisp')] });
    const allies = g.ents.filter(e => e.team === 'ally');
    expect(allies.filter(e => e.type === 'bat').length).toBe(3);
    expect(allies.filter(e => e.type === 'brute').length).toBe(1);
    expect(allies.length).toBe(5);
  });

  it('a nemesis with inherited shots fires bullets', () => {
    const g = createGame({ seed: 3, party: [nem(1, 'brute', 2, { shots: 2, pierce: 1 })] });
    let allyShots = 0;
    for (let i = 0; i < 60 * 15 && g.state === 'play'; i++) {
      step(g, 1 / 60, still());
      allyShots += g.bullets.filter(b => b.src === 'brute' && b.team === 'ally').length;
    }
    expect(allyShots).toBeGreaterThan(0);
  });

  it('allies run out of lives', () => {
    const g = createGame({ seed: 9, party: [nem(1, 'slime', 0.3)] });
    for (let i = 0; i < 60 * 240 && g.state !== 'dead'; i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; if (g.fallen.length) break; }
    expect(g.fallen.length).toBe(1);
  });

  it('the boss arrives at 5:00 and killing it wins the run', () => {
    const g = createGame({ seed: 5, bossType: 'bat' });
    g.t = BOSS_TIME - 0.05;
    for (let i = 0; i < 90; i++) step(g, 1 / 60, still());
    expect(g.boss?.type).toBe('bat');
    g.boss.hp = 1; g.P.dmg = 999;
    for (let i = 0; i < 60 * 60 && g.state === 'play'; i++) { g.P.hp = g.P.maxhp; step(g, 1 / 60, still()); if (g.state === 'lvl') pick(g, 0); }
    expect(g.state).toBe('won');
  });

  it('keeps the player inside the arena', () => {
    const g = createGame({ seed: 5 });
    for (let i = 0; i < 60 * 20 && g.state !== 'dead'; i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, { mx: 1, my: 1 }); }
    expect(g.P.x).toBeLessThanOrEqual(ARENA.w);
    expect(g.P.y).toBeLessThanOrEqual(ARENA.h);
  });

  it('nemeses are credited with their kills', () => {
    const party = [nem(1, 'brute', 2)];
    const g = createGame({ seed: 4, party });
    for (let i = 0; i < 60 * 40 && g.state !== 'dead'; i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; }
    expect(g.party[0].kills).toBeGreaterThan(0);
  });

  it('jobs: a slime draws walkers, a bomber returns without losing a life, a brood is 5 bats', () => {
    const g = createGame({ seed: 2, party: [nem(1, 'slime', 1)] });
    const slime = g.ents.find(e => e.team === 'ally');
    g.ents.push({ ...slime, team: 'enemy', type: 'brute', x: slime.x + 100, y: slime.y, nem: null, dmg: 0, hp: 1e6, maxhp: 1e6, spd: 60, ang: Math.PI / 2 });
    const brute = g.ents[g.ents.length - 1];
    g.P.x = slime.x + 300; g.P.y = slime.y;                 // the player is on the far side of the brute
    const x0 = brute.x; slime.spd = 0;
    for (let i = 0; i < 90; i++) step(g, 1 / 60, still());
    expect(brute.x).toBeLessThan(x0);                        // it walked toward the slime, away from the player

    const b = createGame({ seed: 2, party: [nem(1, 'bomber', 1)] });
    const lives = b.ents.find(e => e.team === 'ally').lives;
    for (let i = 0; i < 60 * 30 && !b.respawnQ.length; i++) { step(b, 1 / 60, still()); b.P.hp = b.P.maxhp; if (b.state === 'lvl') pick(b, 0); }
    expect(b.respawnQ[0].lives).toBe(lives);

    const br = createGame({ seed: 2, party: [{ ...nem(1, 'bat', 2.5), evo: 'brood' }] });
    expect(br.ents.filter(e => e.team === 'ally').length).toBe(5);
  });

  it('picks one of three maps from the seed; the start is never inside a rock', () => {
    const names = [0, 1, 2].map(seed => createGame({ seed }).layout);
    expect(new Set(names).size).toBe(3);
    for (const seed of [0, 1, 2]) {
      const g = createGame({ seed });
      for (const k of g.rocks) expect(Math.hypot(k.x - g.P.x, k.y - g.P.y)).toBeGreaterThan(k.r + g.P.r);
    }
  });

  it('offers at most one nemesis upgrade per choice; a chest applies the pick twice', () => {
    const g = createGame({ seed: 6, party: [nem(1, 'brute', 1)] });
    for (let i = 0; i < 25; i++) {
      g.P.xp = g.P.next; g.P.hp = g.P.maxhp; step(g, 1 / 60, still());
      expect(g.state).toBe('lvl');
      expect(g.choices.filter(u => u.ally).length).toBeLessThanOrEqual(1);
      expect(new Set(g.choices).size).toBe(3);
      pick(g, 0);
    }
    g.ents.length = 0; g.bullets.length = 0;
    g.chests.push({ x: g.P.x, y: g.P.y });
    step(g, 1 / 60, still());
    expect(g.state).toBe('lvl'); expect(g.chest).toBe(true);
    const id = g.choices[0].id, before = g.picks[id] || 0;
    pick(g, 0);
    expect(g.picks[id]).toBe(before + 2); expect(g.chest).toBe(false);
  });

  it('an enemy brute winds up, then charges in a straight line', () => {
    const g = createGame({ seed: 0 });
    g.ents.length = 0;
    step(g, 1 / 60, still());
    const e = g.ents.find(x => x.team === 'enemy') || null;
    g.ents.length = 0; g.spawnT = 99; g.surgeT = 99;
    const b = { ...(e || {}), type: 'brute', team: 'enemy', x: g.P.x - 200, y: g.P.y, r: 20, hp: 1e6, maxhp: 1e6, dmg: 0, spd: 65, cd: 0, act: 0, flash: 0, ang: 0, haste: 1, dead: false, small: false };
    g.ents.push(b);
    step(g, 1 / 60, still());
    expect(b.wind).toBeGreaterThan(0);
    const x0 = b.x;
    for (let i = 0; i < 80; i++) { step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; }
    expect(b.x - x0).toBeGreaterThan(100);                   // far more than a 1.3s walk at speed 65
  });

  it('the boss enrages below half health', () => {
    const g = createGame({ seed: 1 });
    g.t = BOSS_TIME;
    for (let i = 0; i < 5 && !g.boss; i++) step(g, 1 / 60, still());
    expect(g.boss).toBeTruthy();
    g.boss.hp = g.boss.maxhp * 0.4; g.P.hp = g.P.maxhp;
    step(g, 1 / 60, still());
    expect(g.boss.enraged).toBe(true);
  });
});

describe('save', () => {
  const store = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; };
  const rec = (type, q) => ({ type, q, perks: {}, name: 'R', title: 'the Test' });

  it('survives corrupt data', () => {
    const s = store(); s.setItem('nemesis_save', '{not json');
    expect(loadSave(s).nemeses).toEqual([]);
  });

  it('drops unknown enemies and bad numbers', () => {
    const s = sanitize({ nemeses: [{ id: 5, type: 'bat', q: 99, perks: { pierce: 9, junk: 2 } }, { id: 6, type: 'dragon', q: 1 }], party: [5, 6, 77], best: 'no', runs: 4 });
    expect(s.nemeses.length).toBe(1);
    expect(s.nemeses[0]).toMatchObject({ type: 'bat', q: 3, perks: { pierce: 3 } });
    expect(s.party).toEqual([s.nemeses[0].id]);
    expect(s.best).toBe(0);
  });

  it('migrates old roster saves and round-trips', () => {
    const s = store(); s.setItem('nemesis_v1', JSON.stringify({ roster: { bat: 5, slime: 1 }, best: 30, runs: 2 }));
    const loaded = loadSave(s);
    expect(loaded.nemeses.length).toBe(4);
    expect(loaded.party.length).toBe(3);
    writeSave(loaded, s);
    expect(loadSave(s)).toEqual(loaded);
  });

  it('keeps 3 per type: runts are rejected, stronger recruits replace the weakest', () => {
    const s = sanitize(null);
    for (const q of [1, 1.5, 2]) expect(addRecruit(s, rec('bat', q)).status).toBe('joined');
    expect(addRecruit(s, rec('bat', 0.4)).status).toBe('rejected');
    const r = addRecruit(s, rec('bat', 1.2));
    expect(r.status).toBe('replaced');
    expect(s.nemeses.map(n => n.q).sort()).toEqual([1.2, 1.5, 2]);
    expect(s.party.length).toBe(3);
  });

  it('the boss is whatever has killed you most', () => {
    expect(bossTypeFor({ deaths: {} })).toBe('brute');
    expect(bossTypeFor({ deaths: { bat: 2, wisp: 5 } })).toBe('wisp');
  });

  it('old nemeses gain a record; growth comes from kills and wins; champions evolve once', () => {
    const s = sanitize({ nemeses: [{ id: 7, type: 'bat', q: 0.6, perks: {}, name: 'A', title: 'the B' }], party: [7] });
    const n = s.nemeses[0];
    expect([n.kills, n.runs, n.wins, n.evo]).toEqual([0, 0, 0, null]);
    const rows = growParty(s, [{ id: n.id, kills: 30 }], false);
    expect(n.q).toBeCloseTo(0.78); expect(rows[0].rankUp).toBe(true); expect(n.kills).toBe(30);
    growParty(s, [{ id: n.id, kills: 1000 }], true);
    expect(n.q).toBeCloseTo(0.78 + 0.3 + 0.25); expect(n.wins).toBe(1);
    expect(evolve(s, n.id, 'brood')).toBe(false);          // not a Champion yet
    n.q = 2.2;
    expect(evolve(s, n.id, 'mother')).toBe(false);         // not a Bat evolution
    expect(evolve(s, n.id, 'brood')).toBe(true);
    expect(evolve(s, n.id, 'vampire')).toBe(false);        // only once
    expect(sanitize(JSON.parse(JSON.stringify(s))).nemeses[0].evo).toBe('brood');
  });
});
