import { describe, it, expect } from 'vitest';
import { createGame, step, pick, reroll, banish, evoReady, recruitQuality, ARENA, rocksNear, gapTo } from '../src/sim.js';
import { T, BOSS_TIME, UP, RARITY } from '../src/data.js';
import { grudgeFor, feedGrudge, sanitize, loadSave, writeSave, resetSave, setSlot, currentSlot, slotSummaries, addRecruit, bossTypeFor, growParty, evolve, checkFeats, boonsOf, today, dailySeed, addGear, equip, soulsFor, progress, buyMeta, metaCost, unlockClasses, completion, nextGoals, dealMissions } from '../src/save.js';
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
    g.P.hp = 1; g.P.maxhp = 1; g.P.next = 1e9;   // no level-ups: the build is exactly what was set
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

  it('a fallen nemesis always comes back, a little slower each time', () => {
    const party = [nem(1, 'slime', 0.3)];
    const g = createGame({ seed: 9, party }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9;
    const fall = () => { const e = g.ents.find(x => x.nem === party[0] && !x.small); e.x = g.P.x + 300; e.y = g.P.y; e.hp = 0.01; g.ents.push({ ...e, team: 'enemy', type: 'brute', nem: null, x: e.x + 4, y: e.y, dmg: 99, hp: 1e6, maxhp: 1e6, cd: 0, act: 99, spd: 0, stun: 0 }); const t0 = g.t;
      for (let i = 0; i < 60 && !g.respawnQ.length; i++) { step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; }
      g.ents = g.ents.filter(x => x.team !== 'enemy'); return g.respawnQ[0].at - g.t; };
    const first = fall();
    expect(first).toBeGreaterThan(4); expect(first).toBeLessThan(5.1); expect(g.fallen.length).toBe(0);
    for (let i = 0; i < 60 * 6; i++) { step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; }
    expect(g.ents.some(x => x.nem === party[0])).toBe(true);                 // it came back
    expect(fall()).toBeGreaterThan(first + 2);                               // and the next return takes longer
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

  it('offers at most one nemesis upgrade per choice; a chest never rolls Common', () => {
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
    expect(g.rar.length).toBe(3); expect(g.rar).not.toContain('common');
    const id = g.choices[0].id, before = g.picks[id] || 0;
    pick(g, 0);
    expect(g.picks[id]).toBe(before + 1); expect(g.chest).toBe(false);
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

  // A dummy enemy that stands still, for testing weapons and abilities.
  const dummy = (g, dx, dy = 0) => {
    const e = { type: 'slime', team: 'enemy', x: g.P.x + dx, y: g.P.y + dy, r: 13, hp: 1e6, maxhp: 1e6, dmg: 0, spd: 0, cd: 9, act: 99, flash: 0, ang: 0, haste: 1, dead: false, small: false, stun: 1e9 };
    g.ents.push(e); return e;
  };
  const quiet = (opts) => { const g = createGame({ seed: 0, ...opts }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9; g.ents.length = 0; return g; };

  it('every weapon damages an enemy in reach', () => {
    for (const weapon of ['blaster', 'sword', 'rang', 'flame', 'rod', 'totem']) {
      const g = quiet({ loadout: { weapon } });
      const e = dummy(g, weapon === 'flame' ? 10 : 70);
      for (let i = 0; i < 120; i++) step(g, 1 / 60, weapon === 'flame' ? { mx: i % 40 < 20 ? 1 : -1, my: 0 } : still());
      expect(e.hp, weapon).toBeLessThan(1e6);
    }
  });

  it('abilities: dash moves and protects, shockwave throws back, slow, decoy, rally, and a cooldown', () => {
    let g = quiet({ loadout: { ability: 'dash' } });
    const x0 = g.P.x;
    step(g, 1 / 60, { mx: 1, my: 0, act: true });
    expect(g.P.actT).toBeGreaterThan(3); expect(g.P.inv).toBeGreaterThan(0.2);
    for (let i = 0; i < 12; i++) step(g, 1 / 60, { mx: 1, my: 0, act: true });
    expect(g.P.x - x0).toBeGreaterThan(120);                 // far more than 13 frames of walking (about 43)
    expect(g.P.actT).toBeLessThan(4);                        // holding the button does not re-trigger it

    g = quiet({ loadout: { ability: 'shock' } });
    let e = dummy(g, 60); e.stun = 0;
    step(g, 1 / 60, { mx: 0, my: 0, act: true });
    expect(e.x - g.P.x).toBeGreaterThan(120); expect(e.stun).toBeGreaterThan(1);

    g = quiet({ loadout: { ability: 'slow' } });
    step(g, 1 / 60, { mx: 0, my: 0, act: true });
    expect(g.slowT).toBeGreaterThan(2.9);

    g = quiet({ loadout: { ability: 'decoy' } });
    step(g, 1 / 60, { mx: 0, my: 0, act: true });
    expect(g.decoy).toBeTruthy();
    e = dummy(g, 40);
    for (let i = 0; i < 60 * 2.7; i++) step(g, 1 / 60, still());
    expect(g.decoy).toBe(null); expect(e.hp).toBeLessThan(1e6);

    g = createGame({ seed: 0, party: [nem(1, 'brute', 1)], loadout: { ability: 'rally' } });
    const ally = g.ents.find(x => x.team === 'ally'); ally.x = 100; ally.y = 100; ally.hp = 1;
    step(g, 1 / 60, { mx: 0, my: 0, act: true });
    expect(Math.hypot(ally.x - g.P.x, ally.y - g.P.y)).toBeLessThan(120); expect(ally.hp).toBeGreaterThan(1);
  });

  it('the boss drops gear you do not own, only when ownership is known', () => {
    const g = createGame({ seed: 1, owned: ['blaster', 'dash'] });
    g.t = BOSS_TIME;
    for (let i = 0; i < 5 && !g.boss; i++) step(g, 1 / 60, still());
    g.boss.hp = 1; g.P.dmg = 1e6; g.P.hp = g.P.maxhp = 1e6;
    for (let i = 0; i < 60 * 20 && (g.state === 'play' || g.state === 'lvl'); i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, still()); }   // it rises at its mark and comes to you
    expect(g.state).toBe('won'); expect(g.loot.length).toBe(1); expect(['blaster', 'dash']).not.toContain(g.loot[0]);
    expect(createGame({ seed: 1 }).owned).toBe(null);
  });

  it('power-ups: each one does its job when you walk over it', () => {
    const use = (k, opts = {}) => { const g = quiet(opts); const e = dummy(g, 200); e.stun = 0; g.pickups.push({ x: g.P.x, y: g.P.y, k, life: 12 }); step(g, 1 / 60, still()); return { g, e }; };
    expect(use('frenzy').g.frenzyT).toBeGreaterThan(7);
    let r = use('bubble'); expect(r.g.P.shield).toBe(3);
    r.g.ents[0].x = r.g.P.x + 5; r.g.ents[0].stun = 0; r.g.ents[0].dmg = 50; r.g.ents[0].cd = 0; r.g.ents[0].act = 99;
    const hp = r.g.P.hp; for (let i = 0; i < 5; i++) step(r.g, 1 / 60, still());
    expect(r.g.P.hp).toBe(hp); expect(r.g.P.shield).toBe(2);
    expect(use('freeze').e.stun).toBeGreaterThan(1.9);
    expect(use('bomb').e.hp).toBeLessThan(1e6);
    r = quiet(); r.gems.push({ x: 100, y: 100, v: 1 }); r.pickups.push({ x: r.P.x, y: r.P.y, k: 'vortex', life: 12 }); step(r, 1 / 60, still());
    expect(r.gems[0].pull).toBe(true);
    const gg = createGame({ seed: 0, party: [nem(1, 'brute', 1)] }); const ally = gg.ents.find(x => x.team === 'ally'), d0 = ally.dmg;
    gg.pickups.push({ x: gg.P.x, y: gg.P.y, k: 'giant', life: 12 }); step(gg, 1 / 60, still());
    expect(ally.dmg).toBeCloseTo(d0 * 1.5); gg.giantT = 0.01; gg.P.hp = gg.P.maxhp = 1e6; step(gg, 1 / 60, still()); step(gg, 1 / 60, still());
    expect(ally.dmg).toBeCloseTo(d0);
    const old = quiet(); old.pickups.push({ x: 50, y: 50, k: 'bomb', life: 0.01 }); step(old, 1 / 60, still()); step(old, 1 / 60, still());
    expect(old.pickups.length).toBe(0);                      // unused power-ups fade away
  });

  it('charms: thorn mail hits back, the hourglass saves you once, lucky coin doubles elites', () => {
    let g = quiet({ loadout: { charm: 'thorn' } });
    let e = dummy(g, 5); e.stun = 0; e.dmg = 5; e.cd = 0;
    for (let i = 0; i < 3; i++) step(g, 1 / 60, still());
    expect(e.hp).toBeLessThan(1e6); expect(Math.hypot(e.x - g.P.x, e.y - g.P.y)).toBeGreaterThan(30);

    g = quiet({ loadout: { charm: 'hour' } });
    e = dummy(g, 5); e.stun = 0; e.dmg = 1e5; e.cd = 0;
    for (let i = 0; i < 3; i++) step(g, 1 / 60, still());
    expect(g.state).toBe('play'); expect(g.hourUsed).toBe(true); expect(g.P.hp).toBeCloseTo(g.P.maxhp * 0.3, 0);
    g.P.inv = 0; e.x = g.P.x + 5; e.y = g.P.y; e.stun = 0; e.cd = 0;
    for (let i = 0; i < 5 && g.state === 'play'; i++) step(g, 1 / 60, still());
    expect(g.state).toBe('dead');                            // only once

    g = quiet({ loadout: { charm: 'coin' } }); g.eliteT = 0; step(g, 1 / 60, still());
    expect(g.eliteT).toBeGreaterThan(29); expect(g.eliteT).toBeLessThan(31);
    expect(g.ents.some(x => x.elite)).toBe(true);
  });

  it('classes: each has a bonus and a minion with its own ability', () => {
    const base = createGame({ seed: 0 });
    expect(base.ents.filter(e => e.team === 'ally').length).toBe(0);         // no class, no minion (the balance baseline)

    let g = quiet({ cls: 'knight' });
    expect(g.P.maxhp).toBe(base.P.maxhp + 30); expect(g.armor).toBeCloseTo(0.85);
    expect(g.P.weapon).toBe('sword'); expect(quiet({ cls: 'knight', loadout: { weapon: 'rod' } }).P.weapon).toBe('sword');   // a sword, whatever the loadout
    g = createGame({ seed: 0, cls: 'knight' }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9;
    const squire = g.ents.find(e => e.type === 'squire');
    expect(squire && squire.team).toBe('ally');
    g.bullets.push({ x: squire.x + 4, y: squire.y, vx: 0, vy: 0, dmg: 50, team: 'enemy', src: 'archer', pierce: 0, color: '#fff', boss: false, life: 2, hit: new Set() });
    step(g, 1 / 60, still());
    expect(g.bullets.length).toBe(0);                                         // the shield ate it
    squire.hp = 0.01; g.ents.push({ ...squire, team: 'enemy', type: 'slime', x: squire.x + 6, y: squire.y, dmg: 50, hp: 1e6, maxhp: 1e6, cd: 0, act: 99, minion: false, stun: 0, spd: 0, nem: null });
    for (let i = 0; i < 30 && g.ents.includes(squire); i++) { g.P.fireT = 99; step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; }   // the Knight's sword would knock the slime away
    expect(g.respawnQ.some(q => q.minion === 'squire')).toBe(true);           // minions come back

    g = createGame({ seed: 0, cls: 'ranger' }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9;
    expect(g.P.spd).toBeCloseTo(base.P.spd * 1.1);
    const hawk = g.ents.find(e => e.type === 'hawk'); expect(hawk.ghost).toBe(true);
    const prey = dummy(g, 120); prey.stun = 1e9; hawk.act = 0;
    for (let i = 0; i < 120 && !(prey.mark > g.t); i++) step(g, 1 / 60, still());
    expect(prey.mark).toBeGreaterThan(g.t);
    const before = prey.hp; g.P.weapon = 'rod'; g.P.fireT = 0; step(g, 1 / 60, still());
    expect(before - prey.hp).toBeCloseTo(g.P.dmg * 1.5 * 1.2, 0);             // marked: 20% more damage

    g = createGame({ seed: 0, cls: 'necro' }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9;
    const imp = g.ents.find(e => e.type === 'imp'); expect(imp).toBeTruthy();
    const victim = dummy(g, 150); victim.stun = 1e9; g.P.fire = 1e9; g.P.fireT = 1e9;
    for (let i = 0; i < 240 && !(victim.fireT > 0); i++) step(g, 1 / 60, still());
    expect(victim.fireT).toBeGreaterThan(0);                                  // the Imp's fireball set it burning
    g.ents.splice(g.ents.indexOf(victim), 1); g.raiseC = 11;
    const weak = dummy(g, 60); weak.hp = 1; weak.stun = 1e9; g.P.fire = 0.2; g.P.fireT = 0;
    for (let i = 0; i < 120 && !g.ents.some(e => e.type === 'skeleton'); i++) step(g, 1 / 60, still());
    const sk = g.ents.find(e => e.type === 'skeleton');
    expect(sk && sk.team).toBe('ally'); expect(sk.ttl).toBeGreaterThan(10);
  });

  it('shrine ranks, mastery, tiers and rerolls change a run', () => {
    const base = createGame({ seed: 1 });
    const g = createGame({ seed: 1, meta: { vit: 2, might: 1, haste: 1, swift: 1, wisdom: 2, reroll: 2, kin: 1 }, mastery: 2, tier: 3 });
    expect(g.P.maxhp).toBe(base.P.maxhp + 16); expect(g.P.hp).toBe(g.P.maxhp);
    expect(g.P.dmg).toBeCloseTo(base.P.dmg * 1.05 * 1.04); expect(g.P.fire).toBeCloseTo(base.P.fire / 1.04);
    expect(g.P.spd).toBeCloseTo(base.P.spd * 1.03); expect(g.xpMul).toBeCloseTo(1.16); expect(g.rerolls).toBe(2);
    expect(g.heat).toBeGreaterThan(base.heat); expect(g.tier).toBe(3); expect(g.hard).toBe(true); expect(g.minionBuff).toBeCloseTo(1.3);
    g.P.xp = g.P.next; step(g, 1 / 60, still());
    expect(g.state).toBe('lvl');
    const first = g.choices.map(u => u.id).join();
    let changed = false; for (let i = 0; i < 2; i++) { expect(reroll(g)).toBe(true); if (g.choices.map(u => u.id).join() !== first) changed = true; }
    expect(changed).toBe(true); expect(reroll(g)).toBe(false);             // only two rerolls were bought
  });

  it('locked classes: berserker hits harder when hurt, the golem draws enemies, the drone shoots and cannot be targeted', () => {
    let g = quiet({ cls: 'berserker' }); g.ents.length = 0;
    let e = dummy(g, 70); g.P.weapon = 'rod';
    g.P.fireT = 0; step(g, 1 / 60, still()); const full = 1e6 - e.hp;
    e.hp = 1e6; g.P.hp = g.P.maxhp * 0.5; g.P.fireT = 0; step(g, 1 / 60, still());
    expect((1e6 - e.hp) / full).toBeCloseTo(1.3, 1);                         // half health: +30%

    g = createGame({ seed: 0, cls: 'warden' }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9;
    expect(g.P.regen).toBeCloseTo(0.1);
    const golem = g.ents.find(x => x.type === 'golem'); golem.spd = 0; golem.tauntT = 1e9; golem.act = 1e9;   // as if it had just slammed
    e = dummy(g, 0); e.x = golem.x + 80; e.y = golem.y; e.type = 'brute'; e.r = 20; e.stun = 0; e.spd = 60; e.ang = Math.PI; e.act = 99;
    g.P.x = e.x + 300; g.P.y = e.y; g.P.fire = 1e9; g.P.fireT = 1e9;
    const x0 = e.x; for (let i = 0; i < 60; i++) step(g, 1 / 60, still());
    expect(e.x).toBeLessThan(x0);                                            // walked toward the golem, away from the player

    g = createGame({ seed: 0, cls: 'engineer' }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9;
    const drone = g.ents.find(x => x.type === 'drone'); expect(drone.ghost).toBe(true);
    e = dummy(g, 150); g.P.fire = 1e9; g.P.fireT = 1e9;
    for (let i = 0; i < 180 && e.hp === 1e6; i++) step(g, 1 / 60, still());
    expect(e.hp).toBeLessThan(1e6);
  });

  it('rarity: a higher rarity is a stronger upgrade; legendary powers are offered once', () => {
    const dmgUp = UP.find(u => u.id === 'dmg');
    const gain = rar => { const g = createGame({ seed: 3 }); g.P.xp = g.P.next; step(g, 1 / 60, still()); g.choices = [dmgUp, dmgUp, dmgUp]; g.rar = [rar, rar, rar]; const d0 = g.P.dmg; pick(g, 0); return g.P.dmg / d0; };
    expect(gain('common')).toBeCloseTo(1.195); expect(gain('rare')).toBeCloseTo(1.315); expect(gain('epic')).toBeCloseTo(1.48); expect(gain('legendary')).toBeCloseTo(1.75);
    expect(dmgUp.d(RARITY.legendary.s)).toBe('+75% damage');

    // Over many level-ups every rarity turns up, Common most, Legendary least; luck shifts it up.
    const tally = luck => { const g = createGame({ seed: 5, meta: { luck } }); const c = { common: 0, rare: 0, epic: 0, legendary: 0 }; const seen = new Set();
      for (let i = 0; i < 300; i++) { g.P.xp = g.P.next = 1; g.P.hp = g.P.maxhp = 1e9; g.state = 'play'; step(g, 1 / 60, still()); for (let j = 0; j < 3; j++) { c[g.rar[j]]++; seen.add(g.choices[j].id); } pick(g, 0); g.state = 'play'; if (i % 20 === 19) g.picks = {}; }   // fresh build now and then, so slots and ranks never run dry
      return { c, seen }; };
    const a = tally(0), b = tally(5);
    expect(a.c.common).toBeGreaterThan(a.c.rare); expect(a.c.rare).toBeGreaterThan(a.c.epic); expect(a.c.epic).toBeGreaterThan(a.c.legendary); expect(a.c.legendary).toBeGreaterThan(0);
    expect(b.c.common).toBeLessThan(a.c.common);
    expect(a.seen.size).toBeGreaterThan(20);                                 // real variety across the pool

    const g = createGame({ seed: 1 }); g.P.xp = g.P.next; step(g, 1 / 60, still());
    const storm = UP.find(u => u.id === 'storm'); g.choices = [storm, dmgUp, dmgUp]; g.rar = ['legendary', 'common', 'common']; pick(g, 0);
    expect(g.storm).toBe(true);
    for (let i = 0; i < 200; i++) { g.P.xp = g.P.next = 1; g.P.hp = g.P.maxhp = 1e9; g.state = 'play'; step(g, 1 / 60, still()); expect(g.choices).not.toContain(storm); pick(g, 1); g.state = 'play'; }
  });

  it('ultimates: charged by kills, one per class, each does its job', () => {
    const ult = { mx: 0, my: 0, ult: true };
    const fresh = cls => { const g = createGame({ seed: 0, cls }); g.spawnT = 1e9; g.surgeT = 1e9; g.eliteT = 1e9; g.ents = g.ents.filter(e => e.team === 'ally'); g.P.fire = 1e9; g.P.fireT = 1e9; return g; };
    // charge: nothing happens until the meter is full; kills fill it; with no class there is no meter
    let g = fresh('knight'); step(g, 1 / 60, ult); expect(g.ultT).toBe(0);
    g.P.fire = 0.1; g.P.fireT = 0; g.P.dmg = 1e6; for (let i = 0; i < 4; i++) dummy(g, 60 + i * 10); g.ents.forEach(e => { if (e.team === 'enemy') e.hp = 1; });
    for (let i = 0; i < 120; i++) step(g, 1 / 60, still());
    expect(g.ult).toBeGreaterThan(0); expect(g.ult).toBeLessThan(1);
    const none = createGame({ seed: 0 }); none.ult = 1; step(none, 1 / 60, ult); expect(none.ultT).toBe(0);

    // Knight: cannot be hurt, and the meter empties
    g = fresh('knight'); g.ult = 1; g.blockT = 99; let e = dummy(g, 6); e.stun = 0; e.dmg = 50; e.cd = 0;
    const hp = g.P.hp; for (let i = 0; i < 30; i++) step(g, 1 / 60, ult);
    expect(g.P.hp).toBe(hp); expect(g.ult).toBe(0); expect(g.ultT).toBeGreaterThan(3); expect(e.hp).toBeLessThan(1e6);

    // Ranger: arrows fall on enemies anywhere near
    g = fresh('ranger'); g.ult = 1; e = dummy(g, 380); for (let i = 0; i < 60; i++) step(g, 1 / 60, ult);
    expect(e.hp).toBeLessThan(1e6);

    // Necromancer: ten skeletons at once; a skeleton that falls explodes
    g = fresh('necro'); g.ult = 1; step(g, 1 / 60, ult);
    const bones = g.ents.filter(x => x.type === 'skeleton'); expect(bones.length).toBe(7);
    e = dummy(g, 0); e.x = bones[0].x + 20; e.y = bones[0].y; bones[0].ttl = 0.01; step(g, 1 / 60, still());
    expect(e.hp).toBeLessThan(1e6);

    // Berserker: double damage while it lasts
    g = fresh('berserker'); e = dummy(g, 70); g.P.weapon = 'rod'; g.P.fire = 0.42;
    g.P.fireT = 0; step(g, 1 / 60, still()); const base = 1e6 - e.hp;
    e.hp = 1e6; g.ult = 1; g.P.fireT = 0; step(g, 1 / 60, ult);
    expect((1e6 - e.hp) / base).toBeCloseTo(1.25, 1);

    // Engineer: the beam burns what it crosses
    g = fresh('engineer'); g.ult = 1; for (let i = 0; i < 12; i++) { const a = i * 0.524; const d = dummy(g, 0); d.x = g.P.x + Math.cos(a) * 150; d.y = g.P.y + Math.sin(a) * 150; }
    for (let i = 0; i < 270; i++) step(g, 1 / 60, ult);
    expect(g.ents.filter(x => x.team === 'enemy' && x.hp < 1e6).length).toBeGreaterThan(6); expect(g.laser).toBe(null);

    // Warden: roots every enemy on screen and heals
    g = fresh('warden'); g.ult = 1; g.P.hp = 10; e = dummy(g, 400); e.stun = 0; step(g, 1 / 60, ult);
    expect(e.stun).toBeGreaterThan(2); expect(e.rootT).toBeGreaterThan(2); expect(g.P.hp).toBeGreaterThan(15);

    // Knight's shield blocks one hit, then needs time; Ranger's fifth volley is a power shot
    g = fresh('knight'); e = dummy(g, 6); e.stun = 0; e.dmg = 20; e.cd = 0;
    const h0 = g.P.hp; for (let i = 0; i < 5; i++) step(g, 1 / 60, still());
    expect(g.P.hp).toBe(h0); expect(g.blockT).toBeGreaterThan(9);
    g = fresh('ranger'); e = dummy(g, 200); g.P.fire = 0.1; g.P.fireT = 0;
    for (let i = 0; i < 40; i++) step(g, 1 / 60, still());
    expect(g.shotN).toBeGreaterThanOrEqual(5);
  });

  it('the hook: a recruit takes your whole build, and uses it', () => {
    // dying: the killer carries your upgrades (old and new), your weapon and your Legendary powers
    const g = createGame({ seed: 7, loadout: { weapon: 'sword' } });
    g.picks = { dmg: 2, frost: 1, crit: 5, storm: 1, titan: 1, magnet: 3 };
    g.P.hp = 1; g.P.maxhp = 1; g.P.next = 1e9;
    for (let i = 0; i < 60 * 120 && g.state !== 'dead'; i++) step(g, 1 / 60, still());
    const r = g.recruit;
    expect(r.perks).toMatchObject({ dmg: 2, frost: 1, crit: 3 }); expect(r.perks.magnet).toBeUndefined();
    expect(r.weapon).toBe('sword'); expect(r.legs.sort()).toEqual(['storm', 'titan']);
    const kept = sanitize({ nemeses: [{ id: 1, ...r }] }).nemeses[0];           // and all of it survives a save
    expect([kept.weapon, kept.legs.sort().join(), kept.perks.frost]).toEqual(['sword', 'storm,titan', 1]);
    expect(sanitize({ nemeses: [{ id: 1, type: 'bat', weapon: 'cannon', legs: ['storm', 'bogus'] }] }).nemeses[0]).toMatchObject({ weapon: null, legs: ['storm'] });

    // fighting beside you, it uses them: Titan doubles its health, Twin Soul brings two
    const plain = createGame({ seed: 1, party: [nem(1, 'brute', 1)] }).ents.find(e => e.team === 'ally');
    const big = createGame({ seed: 1, party: [{ ...nem(1, 'brute', 1), legs: ['titan', 'twin'] }] }).ents.filter(e => e.team === 'ally');
    expect(big.length).toBe(2); expect(big[0].maxhp).toBeCloseTo(plain.maxhp * 2);
    // Frostbite slows what it hits; a Greatsword makes its hits cleave
    const h = createGame({ seed: 1, party: [{ ...nem(1, 'brute', 1, { frost: 1 }), weapon: 'sword' }] }); h.spawnT = 1e9; h.surgeT = 1e9; h.eliteT = 1e9;
    const ally = h.ents.find(e => e.team === 'ally'); ally.x = h.P.x + 300; ally.y = h.P.y;
    const mk = dx => { const e = { type: 'slime', team: 'enemy', x: ally.x + dx, y: ally.y, r: 13, hp: 1e6, maxhp: 1e6, dmg: 0, spd: 0, cd: 9, act: 99, flash: 0, ang: 0, haste: 1, dead: false, small: false, stun: 1e9 }; h.ents.push(e); return e; };
    const a = mk(20), b = mk(-25); h.P.fire = 1e9; h.P.fireT = 1e9;
    for (let i = 0; i < 60; i++) step(h, 1 / 60, still());
    expect(a.hp < 1e6 || b.hp < 1e6).toBe(true); expect(a.hp).toBeLessThan(1e6); expect(b.hp).toBeLessThan(1e6);   // one was hit, the other cleaved
    expect(Math.max(a.slowT || 0, b.slowT || 0)).toBeGreaterThan(0);
    // a nemesis that took your Phoenix rises at once the first time it falls
    const p = createGame({ seed: 1, party: [{ ...nem(1, 'brute', 1), legs: ['phoenix'] }] }); p.spawnT = 1e9; p.surgeT = 1e9; p.eliteT = 1e9;
    const ph = p.ents.find(e => e.team === 'ally'); ph.x = p.P.x + 300; ph.hp = 0.01; ph.cd = 1e9;   // cd: so it does not knock its attacker away first
    p.ents.push({ ...ph, team: 'enemy', type: 'brute', nem: null, pk: null, legs: [], wpn: null, x: ph.x + 4, dmg: 99, hp: 1e6, maxhp: 1e6, cd: 0, act: 99, spd: 0, stun: 0 });
    for (let i = 0; i < 60 && !p.respawnQ.length; i++) { step(p, 1 / 60, still()); p.P.hp = p.P.maxhp; }
    expect(p.respawnQ[0].at - p.t).toBeLessThan(1);
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

  it('feats unlock boons; modes and the daily seed are stable', () => {
    const s = sanitize({});
    expect(boonsOf(s)).toEqual([]);
    const got = checkFeats(s, { t: 130, kills: 20, won: false, dead: true, party: 0, opened: 0 });
    expect(got.map(f => f.id).sort()).toEqual(['first', 'two']);
    expect(checkFeats(s, { t: 130, dead: true }).length).toBe(0);            // only once
    expect(boonsOf(s).sort()).toEqual(['magnet', 'tough']);
    s.boon = 'tough'; s.wins = 1; s.tier = 1; s.daily = { date: '2026-11-15', best: 99, won: false };
    const back = sanitize(JSON.parse(JSON.stringify(s)));
    expect([back.boon, back.hard, back.daily.best, back.feats.two]).toEqual(['tough', true, 99, true]);
    expect(sanitize({ boon: 'nova', hard: true }).boon).toBe(null);          // a boon you have not earned is dropped
    expect(sanitize({ boon: 'nova', hard: true }).hard).toBe(false);         // Nemesis+ needs a win
    expect(dailySeed('2026-11-15')).toBe(20261115);
    expect(today(new Date('2026-11-15T23:59:00Z'))).toBe('2026-11-15');
    const a = createGame({ seed: dailySeed('2026-11-15') }), b = createGame({ seed: dailySeed('2026-11-15') });
    for (let i = 0; i < 300; i++) { step(a, 1 / 60, still()); step(b, 1 / 60, still()); }
    expect(a.ents.length).toBe(b.ents.length); expect(a.layout).toBe(b.layout);
    const hard = createGame({ seed: 1, hard: true, boon: 'tough' }), norm = createGame({ seed: 1 });
    expect(hard.heat).toBeGreaterThan(norm.heat); expect(hard.P.maxhp).toBe(norm.P.maxhp + 25); expect(hard.picks.tough).toBe(1);
  });

  it('gear: old saves start with Blaster and Dash; found gear is kept and can be equipped', () => {
    const s = sanitize({ runs: 3 });
    expect(s.gear.owned).toEqual(['blaster', 'dash']); expect(s.gear.loadout).toEqual({ weapon: 'blaster', ability: 'dash', charm: null });
    expect(addGear(s, ['sword', 'sword', 'bogus', 'shock'])).toEqual(['sword', 'shock']);
    expect(equip(s, 'rod')).toBe(false);                     // not found yet
    expect(equip(s, 'sword')).toBe(true); expect(equip(s, 'shock')).toBe(true);
    const back = sanitize(JSON.parse(JSON.stringify(s)));
    expect(back.gear.loadout).toEqual({ weapon: 'sword', ability: 'shock', charm: null }); expect(back.gear.owned.length).toBe(4);
    addGear(s, ['thorn']);
    expect(equip(s, 'thorn')).toBe(true); expect(s.gear.loadout.charm).toBe('thorn');
    expect(sanitize(JSON.parse(JSON.stringify(s))).gear.loadout.charm).toBe('thorn');
    equip(s, 'thorn'); expect(s.gear.loadout.charm).toBe(null);   // clicking it again takes it off
    expect(sanitize({ gear: { owned: [], loadout: { weapon: 'rod' } } }).gear.loadout.weapon).toBe('blaster');
  });

  it('class: old saves default to Knight; the choice round-trips', () => {
    expect(sanitize({ runs: 1 }).cls).toBe('knight');
    expect(sanitize({ cls: 'necro' }).cls).toBe('necro');
    expect(sanitize({ cls: 'wizard' }).cls).toBe('knight');
  });

  it('progression: souls, shrine purchases, class unlocks, mastery and Nemesis+ tiers', () => {
    const s = sanitize({});
    expect([s.souls, s.tier, s.tierMax]).toEqual([0, 0, 0]); expect(s.classes).toEqual(['knight', 'ranger', 'necro']);
    s.day = { date: today(), streak: 1 };                                    // no daily bonus in this test
    s.missions = [{ id: 'streak', n: 100, have: 0 }, { id: 'epic', n: 4, have: 0 }, { id: 'level', n: 18, have: 0 }];   // none that this run finishes
    const run = { t: 200, kills: 300, opened: 2, boss: false, won: false, tier: 0, cls: 'knight', daily: false };
    expect(soulsFor(run, s)).toBe(Math.floor(300 * 0.12 + 200 * 0.2 + 8));
    expect(soulsFor({ ...run, tier: 2 }, s)).toBe(Math.floor(84 * 1.5));
    let p = progress(s, run);
    expect(s.souls).toBe(84); expect(s.stats.kills).toBe(300); expect(s.mastery.knight).toBe(200); expect(p.classes).toEqual([]);
    expect(metaCost(s, 'vit')).toBe(30); expect(buyMeta(s, 'vit')).toBe(true); expect(s.souls).toBe(54); expect(s.meta.vit).toBe(1);
    expect(buyMeta(s, 'reroll')).toBe(false);                                // cannot afford 80
    p = progress(s, { ...run, kills: 800, opened: 7, t: 100 });
    expect(p.classes.sort()).toEqual(['berserker', 'engineer']); expect(p.levelUp).toBe(true);   // 1,100 kills, 9 chests, 300s as Knight
    s.wins = 1; p = progress(s, { ...run, won: true, boss: true });
    expect(p.tierUp).toBe(1); expect(s.tierMax).toBe(1); expect(p.classes).toEqual(['warden']);
    p = progress(s, { ...run, won: true, boss: true, tier: 0 });
    expect(p.tierUp).toBe(0);                                                // winning below your top tier unlocks nothing
    s.tier = 1; s.cls = 'warden';
    const back = sanitize(JSON.parse(JSON.stringify(s)));
    expect([back.souls, back.meta.vit, back.tier, back.tierMax, back.cls, back.hard]).toEqual([s.souls, 1, 1, 1, 'warden', true]);
    expect(back.classes.length).toBe(6); expect(completion(back)).toBeGreaterThan(0);
    expect(sanitize({ cls: 'warden' }).cls).toBe('knight');                  // a class you have not unlocked is dropped
    const old = sanitize({ wins: 2, winsHard: 1, hard: true, runs: 9 });     // a save from before tiers
    expect([old.tierMax, old.tier, old.classes.includes('warden')]).toEqual([2, 1, true]);
  });

  it('missions pay out and are replaced; the first run of a day pays a bonus that grows with the day streak', () => {
    const s = sanitize({});
    expect(s.missions.length).toBe(3); expect(new Set(s.missions.map(m => m.id)).size).toBe(3);
    s.missions = [{ id: 'kills', n: 150, have: 100 }, { id: 'survive', n: 150, have: 0 }, { id: 'streak', n: 25, have: 0 }];
    const run = { t: 120, kills: 60, opened: 0, won: false, tier: 0, cls: 'knight', bonus: 7, soulMul: 1.2, ms: { kills: 60, t: 120, streak: 30 } };
    const base = soulsFor(run, s);
    expect(base).toBe(Math.floor((60 * 0.12 + 120 * 0.2 + 7) * 1.2));         // streak and golden-enemy souls, Soul Harvest
    const p = progress(s, run, '2026-11-16');
    expect(p.missions.map(m => m.done)).toEqual([true, false, true]);        // 160/150 kills; 120s is short of 150; a 30 streak beats 25
    expect(p.missionPay).toBe(25 + 35); expect(p.daily).toBe(20); expect(p.dayStreak).toBe(1);
    expect(s.souls).toBe(base + 60 + 20);
    expect(s.missions.length).toBe(3); expect(s.missions.some(m => m.id === 'survive' && m.have === 120)).toBe(true);
    expect(progress(s, { ...run, ms: {} }, '2026-11-16').daily).toBe(0);     // only the first run of the day
    expect(progress(s, { ...run, ms: {} }, '2026-11-17').daily).toBe(23);    // next day: streak 2
    expect(progress(s, { ...run, ms: {} }, '2026-11-20').dayStreak).toBe(1); // a missed day starts the streak again
    const goals = nextGoals(s);
    expect(goals.length).toBeGreaterThan(0); expect(goals[0].have / goals[0].want).toBeGreaterThanOrEqual(goals[goals.length - 1].have / goals[goals.length - 1].want);
    const back = sanitize(JSON.parse(JSON.stringify(s)));
    expect(back.missions).toEqual(s.missions); expect(back.day).toEqual(s.day);
  });

  it('save slots are independent; an old save is slot 1; deleting one leaves the others', () => {
    const st = store();
    const a = loadSave(st); a.souls = 50; a.runs = 3; writeSave(a, st);        // written before any slot was chosen
    expect(currentSlot(st)).toBe(1); expect(st.getItem('nemesis_save')).toBeTruthy();
    setSlot(2, st);
    const b = loadSave(st); expect(b.souls).toBe(0);                         // slot 2 starts fresh
    b.souls = 9; b.runs = 1; writeSave(b, st);
    setSlot(1, st); expect(loadSave(st).souls).toBe(50);
    setSlot(7, st); expect(currentSlot(st)).toBe(1);                         // a slot that does not exist is ignored
    const sum = slotSummaries(st);
    expect(sum.map(x => [x.slot, x.empty, x.souls, x.active])).toEqual([[1, false, 50, true], [2, false, 9, false], [3, true, 0, false]]);
    resetSave(st, 2);
    expect(loadSave(st, 2).souls).toBe(0); expect(loadSave(st, 1).souls).toBe(50);
  });

describe('prize recruits', () => {
  it('dying to an elite or a golden enemy gives a stronger, marked recruit', () => {
    expect(recruitQuality(60, 5, false, 'elite')).toBeCloseTo(recruitQuality(60, 5) + 0.5);
    expect(recruitQuality(60, 5, false, 'gold')).toBeCloseTo(recruitQuality(60, 5) + 0.35);
    for (const [flag, prize] of [['elite', 'elite'], ['gold', 'gold'], [null, null]]) {
      const g = createGame({ seed: 3 });
      const e = g.ents.find(x => x.team === 'enemy') || (step(g, 1.5, { mx: 0, my: 0 }), g.ents.find(x => x.team === 'enemy'));
      for (const o of g.ents) if (o !== e && o !== g.P) o.dead = true;
      if (flag) e[flag] = true;
      e.x = g.P.x + 4; e.y = g.P.y; e.dmg = 9999; e.hp = 1e9; g.P.inv = 0;
      for (let i = 0; i < 30 && g.state !== 'dead'; i++) step(g, 1 / 60, { mx: 0, my: 0 });
      expect(g.state).toBe('dead');
      expect(g.recruit.prize).toBe(prize);
      expect(g.recruit.q).toBeCloseTo(recruitQuality(g.t, g.P.lvl, false, prize));
    }
  });
  it('a golden nemesis in the party earns more souls and survives a save', () => {
    const n = { ...nem(1, 'bat'), prize: 'gold' };
    expect(createGame({ seed: 1, party: [n] }).soulMul).toBeCloseTo(createGame({ seed: 1, party: [nem(1, 'bat')] }).soulMul * 1.15);
    const s = sanitize({ v: 10, nemeses: [n, { ...nem(2, 'bat'), prize: 'junk' }], party: [1] });
    expect(s.nemeses.map(x => x.prize)).toEqual(['gold', null]);
  });
});
});

describe('the grudge', () => {
  const bossNow = g => { g.t = BOSS_TIME - 0.01; for (let i = 0; i < 3 && !g.boss; i++) step(g, 1 / 60, { mx: 0, my: 0 }); return g.boss; };
  it('the boss is named after what killed you most, counts it, and learns your Legendary powers', () => {
    const s = sanitize({}); s.deaths = { bat: 4, slime: 1 };
    const gr = grudgeFor(s);
    expect(gr.type).toBe('bat'); expect(gr.kills).toBe(4); expect(gr.name).toMatch(/ the Bat$/);
    feedGrudge(s, ['storm', 'titan', 'midas'], false, true);
    expect(s.grudge.powers).toEqual(['midas', 'titan']);              // newest two
    expect(sanitize(JSON.parse(JSON.stringify(s))).grudge).toEqual(s.grudge);
    feedGrudge(s, [], true, true);
    expect(s.grudge.powers).toEqual([]); expect(s.grudge.beaten).toBe(1);
    s.deaths.slime = 9; expect(grudgeFor(s).type).toBe('slime');   // a new killer takes its place, with a new name
    expect(s.grudge.beaten).toBe(0);
  });
  it('learned powers change the boss: more health, lightning, rising once', () => {
    const plain = bossNow(createGame({ seed: 4, bossType: 'brute' }));
    const g = createGame({ seed: 4, bossType: 'brute', grudge: { name: 'Vesk the Brute', kills: 3, powers: ['titan', 'storm', 'phoenix'] } });
    const b = bossNow(g);
    expect(g.grudge.powers).toEqual(['titan', 'storm']);                 // at most two
    expect(b.name).toBe('Vesk the Brute'); expect(b.maxhp).toBeCloseTo(plain.maxhp * 1.35);
    g.P.inv = 99; for (let i = 0; i < 300 && !g.zaps.length; i++) step(g, 1 / 60, { mx: 0, my: 0 });
    expect(g.zaps.length).toBeGreaterThan(0);
    const g2 = createGame({ seed: 4, bossType: 'brute', grudge: { name: 'X', powers: ['phoenix'] } }), b2 = bossNow(g2);
    b2.hp = 1; b2.inv = 0; g2.P.inv = 99;
    for (let i = 0; i < 600 && b2.rise; i++) step(g2, 1 / 60, { mx: (b2.x - g2.P.x) / 1e3, my: (b2.y - g2.P.y) / 1e3 });
    expect(b2.rise).toBe(false); expect(g2.state).toBe('play'); expect(b2.hp).toBeGreaterThan(b2.maxhp * 0.3);
  });
});

describe('level-ups (Phase 20)', () => {
  const lvl = g => { g.P.xp = g.P.next = 1; g.P.hp = g.P.maxhp = 1e9; g.state = 'play'; step(g, 1 / 60, { mx: 0, my: 0 }); };
  it('ranks cap at 5, six slots narrow the offers, and fillers appear when nothing is left', () => {
    const g = createGame({ seed: 2 });
    for (const id of ['dmg', 'haste', 'spd', 'tough', 'magnet', 'regen']) g.picks[id] = 2;
    g.picks.dmg = 5;
    for (let i = 0; i < 40; i++) { lvl(g); for (const u of g.choices) { expect(u.leg || u.filler || (g.picks[u.id] && u.id !== 'dmg')).toBeTruthy(); } }
    for (const id of ['haste', 'spd', 'tough', 'magnet', 'regen']) g.picks[id] = 5;
    lvl(g); expect(g.choices.filter(u => u.filler).length).toBeGreaterThan(0);
  });
  it('banish removes a card for the run and replaces it in place; pity forces a Rare', () => {
    const g = createGame({ seed: 7 }); lvl(g);
    const gone = g.choices.findIndex(u => !u.leg), id = g.choices[gone].id, others = g.choices.filter((_, i) => i !== gone);
    expect(banish(g, gone)).toBe(true); expect(g.choices.length).toBe(3);
    expect(g.choices.filter((_, i) => i !== gone)).toEqual(others); expect(g.choices[gone].id).not.toBe(id);
    expect(banish(g, 0)).toBe(false);                                         // one banish by default
    for (let i = 0; i < 60; i++) { lvl(g); pick(g, 0); g.picks = {}; expect(g.choices.some(u => u.id === id)).toBe(false); }
    const h = createGame({ seed: 7 }); h.luck = 0; h.dry = 3; lvl(h);
    expect(h.rar).toContain('rare'); expect(h.dry).toBe(0);
  });
});

describe('evolutions and pairs (Phase 21)', () => {
  const chest = g => { g.chest = true; g.state = 'play'; g.P.xp = g.P.next = 1; step(g, 1 / 60, { mx: 0, my: 0 }); };
  it('a rank-5 partner upgrade evolves the weapon at a chest after 3:00, once', () => {
    const g = createGame({ seed: 3, cls: 'knight' }); g.P.hp = g.P.maxhp = 1e9;
    g.picks.tough = 5; expect(evoReady(g)).toBe(true);
    g.t = 100; chest(g); expect(g.choices[0].evo).toBeFalsy();               // too early
    g.t = 200; chest(g); expect(g.choices[0].id).toBe('kingsblade'); expect(g.rar[0]).toBe('legendary');
    const p0 = g.P.pierce; pick(g, 0); expect(g.P.evo).toBe('kingsblade'); expect(g.P.pierce).toBe(p0 + 2);
    expect(evoReady(g)).toBe(false); chest(g); expect(g.choices.some(u => u.evo)).toBe(false);
  });
  it('holding both halves of a pair switches its bonus on', () => {
    const g = createGame({ seed: 3 }); g.P.hp = g.P.maxhp = 1e9;
    const up = id => UP.find(u => u.id === id);
    g.picks.tough = 1; const hp0 = g.P.maxhp;
    g.P.xp = g.P.next; step(g, 1 / 60, { mx: 0, my: 0 }); g.choices = [up('armor'), up('dmg'), up('spd')]; g.rar = ['common', 'common', 'common'];
    pick(g, 0); expect(g.pairs.jugg).toBe(true); expect(g.P.maxhp).toBeCloseTo(hp0 * 1.2, 0);
    expect(g.pairs.steam).toBeFalsy();
  });

  it('the world has walls, and nothing starts inside one', () => {
    for (const seed of [1, 2, 3]) {
      const g = createGame({ seed });
      expect(g.world.walls.length).toBeGreaterThan(10);
      for (const k of rocksNear(g, g.P.x, g.P.y)) expect(gapTo(k, g.P.x, g.P.y)).toBeGreaterThan(g.P.r);
    }
  });

  it('a walking enemy finds its way round a wall to you', () => {
    const g = createGame({ seed: 2 });
    const wall = g.world.walls.filter(k => k.w >= 170 && k.h < 40).sort((a, b) => b.w - a.w)[0];
    expect(wall).toBeTruthy();
    const cx = wall.x + wall.w / 2;
    for (let i = 0; i < 60 * 12; i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; }
    const e = g.ents.find(o => o.team === 'enemy' && !o.dead && !T[o.type].fly && !T[o.type].ranged);
    expect(e).toBeTruthy();
    g.P.x = cx; g.P.y = wall.y + wall.h + 90; g.P.dmg = 0; g.flowT = 0;
    e.x = cx; e.y = wall.y - 60; e.ang = Math.PI / 2;
    for (const o of g.ents) if (o !== e && o.team === 'enemy') o.dead = true;
    let best = 1e9;
    for (let i = 0; i < 60 * 10 && !e.dead; i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; best = Math.min(best, Math.hypot(e.x - g.P.x, e.y - g.P.y)); }
    expect(best).toBeLessThan(60);   // through the wall it would stay over 110 away
  });

  it('lava burns walking enemies but never you; water slows them', () => {
    const g = createGame({ seed: 3 });
    const lava = g.world.pools.find(p => p.kind === 'lava'), water = g.world.pools.find(p => p.kind === 'water');
    expect(lava && water).toBeTruthy();
    for (let i = 0; i < 60 * 12; i++) { if (g.state === 'lvl') pick(g, 0); else step(g, 1 / 60, still()); g.P.hp = g.P.maxhp; }
    const [a, b] = g.ents.filter(o => o.team === 'enemy' && !o.dead && !T[o.type].fly);
    expect(a && b).toBeTruthy();
    for (const o of g.ents) if (o !== a && o !== b && o.team === 'enemy') o.dead = true;
    g.P.x = lava.x; g.P.y = lava.y; g.P.dmg = 0; a.x = lava.x + 10; a.y = lava.y; a.hp = a.maxhp = 1000;
    b.x = water.x; b.y = water.y; b.slowT = 0;
    const hp0 = g.P.hp; step(g, 1 / 60, still()); step(g, 1 / 60, still());
    expect(a.hp).toBeLessThan(1000);
    expect(b.wet).toBe(true);
    expect(g.P.hp).toBe(hp0);
  });

  it('landmarks: a lair wakes a named elite that guards it, a vault springs an ambush, the boss rises at its mark', () => {
    const g = createGame({ seed: 3 });
    step(g, 1 / 60, still());
    expect(g.lairs.length).toBeGreaterThan(0); expect(g.chests.filter(c => c.vault).length).toBe(0);   // vaults open at 1:00
    g.t = 60; step(g, 1 / 60, still()); expect(g.chests.filter(c => c.vault).length).toBe(g.vaults.length);
    const l = g.lairs[0]; g.P.x = l.x + 200; g.P.y = l.y; g.P.hp = g.P.maxhp = 1e6; step(g, 1 / 60, still());
    expect(l.state).toBe('awake'); expect(l.e.elite).toBe(true); expect(l.e.name).toBe(l.name);
    g.P.x = 2400; g.P.y = 1500; l.e.x = l.x + 600; for (let i = 0; i < 60 * 3; i++) step(g, 1 / 60, still());
    expect(Math.hypot(l.e.x - l.x, l.e.y - l.y)).toBeLessThan(600);                         // it went home
    if (g.vaults.length) { const v = g.vaults[0], n = g.ents.length; g.P.x = v.x; g.P.y = v.y + 150; step(g, 1 / 60, still()); expect(v.sprung).toBe(true); expect(g.ents.length).toBeGreaterThan(n); }
    const b = createGame({ seed: 4 }); b.t = BOSS_TIME - 30; b.P.hp = b.P.maxhp = 1e6;
    step(b, 1 / 60, still()); expect(b.bossMark).toBeTruthy();
    b.t = BOSS_TIME; for (let i = 0; i < 3 && !b.boss; i++) step(b, 1 / 60, still());
    expect(Math.hypot(b.boss.x - b.bossMark.x, b.boss.y - b.bossMark.y)).toBeLessThan(40);
  });
});
