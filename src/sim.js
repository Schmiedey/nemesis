// Pure game simulation: no DOM, no Math.random. Same seed + same inputs = same run.
import { T, UP, PERKS, BOSS_TIME } from './data.js';

export const ARENA = { w: 1600, h: 1000 };
export const VIEW = { w: 960, h: 600 };
// The maps: three fixed layouts of rocks, one picked per run from the seed. Circles: { x, y, r }.
// Rocks block walkers and enemy bullets (your side's shots pass over). Flyers (Bat, Wisp) and the boss ignore them.
export const LAYOUTS = [
  { name: 'Pillars', rocks: [
    { x: 560, y: 330, r: 34 }, { x: 1040, y: 330, r: 34 }, { x: 560, y: 670, r: 34 }, { x: 1040, y: 670, r: 34 },
    { x: 300, y: 500, r: 48 }, { x: 1300, y: 500, r: 48 }, { x: 800, y: 190, r: 42 }, { x: 800, y: 810, r: 42 },
    { x: 220, y: 200, r: 30 }, { x: 272, y: 252, r: 22 }, { x: 1380, y: 200, r: 30 }, { x: 1328, y: 252, r: 22 },
    { x: 220, y: 800, r: 30 }, { x: 272, y: 748, r: 22 }, { x: 1380, y: 800, r: 30 }, { x: 1328, y: 748, r: 22 },
  ] },
  { name: 'Corridors', rocks: [
    ...[250, 330, 410, 490, 1110, 1190, 1270, 1350].flatMap(x => [{ x, y: 320, r: 27 }, { x, y: 680, r: 27 }]),
    { x: 800, y: 300, r: 38 }, { x: 800, y: 700, r: 38 }, { x: 560, y: 500, r: 30 }, { x: 1040, y: 500, r: 30 },
  ] },
  { name: 'Ring', rocks: [
    ...[0,1,2,3,4,5,6,7,8,9,10,11].filter(i => i % 3).map(i => ({ x: 800 + Math.round(Math.cos(i * Math.PI / 6) * 300), y: 500 + Math.round(Math.sin(i * Math.PI / 6) * 300), r: 30 })),
    { x: 250, y: 200, r: 44 }, { x: 1350, y: 200, r: 44 }, { x: 250, y: 800, r: 44 }, { x: 1350, y: 800, r: 44 },
  ] },
];
// Push a circle body out of any rock it overlaps.
function unstick(g, o) {
  for (const k of g.rocks) {
    const dx = o.x - k.x, dy = o.y - k.y, r = k.r + o.r, dd = dx * dx + dy * dy;
    if (dd < r * r) { const l = Math.sqrt(dd) || 0.01; o.x = k.x + dx / l * r; o.y = k.y + dy / l * r; }
  }
}
export const BOSS_HP = 11500;
const ALLY_LIVES = 3, BOMBER_LIVES = 6;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// How good a recruit is. Dying early earns a runt; surviving longer earns a champion.
export function recruitQuality(t, lvl, byBoss = false) {
  return clamp(0.3 + t / 140 + lvl * 0.03 + (byBoss ? 0.3 : 0), 0.3, 3);
}

// party: up to 3 nemeses { id, type, name, title, q, perks }. bossType: enemy type of the 5:00 boss.
export function createGame({ seed = 1, party = [], bossType = 'brute', layout = seed % LAYOUTS.length } = {}) {
  const g = {
    rand: mulberry32(seed), party: party.filter(n => T[n.type]).slice(0, 3), bossType: T[bossType] ? bossType : 'brute',
    state: 'play', t: 0, kills: 0, spawnT: 0.2, surgeT: 20, allyBuff: 1, allyHaste: 1, secondWind: false,
    ents: [], bullets: [], gems: [], respawnQ: [], fallen: [], fx: [], choices: [], picks: {},
    killer: null, recruit: null, boss: null, bossAt: 0,
    layout: LAYOUTS[layout % LAYOUTS.length].name, rocks: LAYOUTS[layout % LAYOUTS.length].rocks,
    chests: [], chest: false, eliteT: 60, allyRegen: 0, allyArmor: 1, novaT: 0, vacT: 0,
    P: { isP: true, x: ARENA.w / 2, y: ARENA.h / 2, r: 11, hp: 100, maxhp: 100, spd: 200, fire: 0.42, fireT: 0,
      dmg: 10, multi: 1, pierce: 0, magnet: 80, regen: 0, blades: 0, chain: 0, nova: 0, crit: 0, lvl: 1, xp: 0, next: 5, inv: 0, flash: 0 },
  };
  // A stronger party draws a bigger swarm, so the opening is never a walkover.
  g.heat = 1 + 0.045 * g.party.reduce((a, n) => a + n.q, 0);
  for (const nem of g.party) {
    const lives = nem.type === 'bomber' ? BOMBER_LIVES : ALLY_LIVES;
    const n = nem.evo === 'brood' ? 5 : nem.evo === 'storm' ? 2 : T[nem.type].pack || 1;
    nem.kills = 0;
    for (let i = 0; i < n; i++) spawnAlly(g, nem, lives);
  }
  return g;
}

const rr = (g, a, b) => a + g.rand() * (b - a);
// Visual effects are queued for the renderer; the sim never draws.
const burst = (g, x, y, c, n, sp = 140) => g.fx.push({ k: 'burst', x, y, c, n, sp });
const shake = (g, v) => g.fx.push({ k: 'shake', v });
const snd = (g, n) => g.fx.push({ k: 'snd', n }); // sound cue, played by main.js

function mk(g, type, team, x, y, { small = false, hpMul = 1, dmgMul = 1, spdMul = 1 } = {}) {
  const d = T[type];
  const e = {
    type, team, x, y, r: d.r * (small ? 0.65 : 1), hp: d.hp * hpMul * (small ? 0.4 : 1),
    dmg: d.dmg * dmgMul, spd: d.spd * spdMul * (small ? 1.3 : 1), hpMul, dmgMul,
    cd: 0, act: g.rand() * 2, flash: 0, small, dead: false, ang: g.rand() * 6.28, haste: 1,
  };
  e.maxhp = e.hp; g.ents.push(e); return e;
}

const mkEnemy = (g, type, x, y, small) => mk(g, type, 'enemy', x, y, { small, hpMul: 1 + g.t / 160, dmgMul: 1.25 + g.t / 320, spdMul: Math.min(1.15, 1 + g.t / 1400) });

function spawnAlly(g, nem, lives) {
  const pk = nem.perks || {};
  const e = mk(g, nem.type, 'ally', g.P.x + rr(g, -50, 50), g.P.y + rr(g, -50, 50), {
    hpMul: (2.6 + 1.3 * nem.q) * (1 + 0.25 * (pk.tough || 0)) * g.allyBuff * (1 + g.t / 150) * (nem.evo === 'juggernaut' ? 2 : 1),
    dmgMul: (0.7 + 1.3 * nem.q) * (1 + 0.2 * (pk.dmg || 0)) * g.allyBuff * (1 + g.t / 150),
    spdMul: 1.1 * (1 + 0.08 * (pk.spd || 0)),
  });
  e.nem = nem; e.pk = pk; e.lives = lives; e.shotT = 1;
  e.haste = (1 + 0.2 * (pk.haste || 0)) * g.allyHaste * (nem.evo === 'ward' ? 1.5 : 1);
  e.evo = nem.evo || null;
  burst(g, e.x, e.y, '#7dffb0', 8);
  return e;
}

// Once a minute an elite arrives: big, tough, glowing. It drops a chest: a double-strength upgrade.
function spawnElite(g) {
  const pool = Object.keys(T).filter(k => g.t >= T[k].unlock), type = pool[Math.floor(g.rand() * pool.length)];
  const a = g.rand() * 6.28;
  const e = mkEnemy(g, type, clamp(g.P.x + Math.cos(a) * 620, 0, ARENA.w), clamp(g.P.y + Math.sin(a) * 620, 0, ARENA.h));
  e.elite = true; e.r *= 1.5; e.hp = e.maxhp = e.hp * 8 + 60; e.dmg *= 1.3;
  snd(g, 'surge');
}

function spawnEnemy(g, ang) {
  const pool = Object.keys(T).filter(k => g.t >= T[k].unlock);
  let r = g.rand() * pool.reduce((a, k) => a + T[k].w, 0), type = pool[0];
  for (const k of pool) { r -= T[k].w; if (r <= 0) { type = k; break; } }
  // Spawn on a ring just outside the camera, kept inside the arena.
  const a = ang ?? g.rand() * 6.28, dist = rr(g, 600, 680);
  const x = clamp(g.P.x + Math.cos(a) * dist, -30, ARENA.w + 30);
  const y = clamp(g.P.y + Math.sin(a) * dist, -30, ARENA.h + 30);
  const n = type === 'bat' ? 4 + Math.floor(g.t / 100) : type === 'slime' && g.t > 90 ? 2 : 1;
  for (let i = 0; i < n; i++) mkEnemy(g, type, x + rr(g, -20, 20), y + rr(g, -20, 20));
}

// The boss is a giant version of the enemy type that has killed you most.
function spawnBoss(g) {
  const d = T[g.bossType], a = g.rand() * 6.28;
  const e = mk(g, g.bossType, 'enemy', clamp(g.P.x + Math.cos(a) * 520, 60, ARENA.w - 60), clamp(g.P.y + Math.sin(a) * 520, 60, ARENA.h - 60));
  e.boss = true; e.spT = 5; e.r = d.r * 2.5 + 20; e.hp = e.maxhp = BOSS_HP * (1 + 0.6 * g.party.reduce((a, n) => a + n.q, 0)); // a stronger party faces a tougher nemesis e.dmg = 30;
  e.spd = clamp(d.spd * 0.8, 70, 115); e.summonT = 3; e.ringT = 5;
  g.boss = e; g.bossAt = g.t; shake(g, 14); snd(g, 'boss'); burst(g, e.x, e.y, d.color, 40, 300);
}

const ring = (g, e, n, sp, off = g.rand() * 6.28) => {
  for (let i = 0; i < n; i++) shoot(g, e.x, e.y, off + i * 6.283 / n, sp, 14, 'enemy', e.type, 0, T[e.type].color, true);
};

// The boss walks you down, summons its kind and fires rings. Every few seconds it winds up (a visible tell)
// and uses the special move of its type. Below half health it enrages: faster, and specials come sooner.
function bossThink(g, e, dt) {
  const P = g.P;
  e.cd -= dt; e.flash -= dt; e.summonT -= dt; e.ringT -= dt;
  if (!e.enraged && e.hp < e.maxhp * 0.5) {
    e.enraged = true; e.spd *= 1.25; shake(g, 14); burst(g, e.x, e.y, '#ff3b5c', 50, 360); snd(g, 'boss');
  }
  if (e.dash > 0) {                                   // Brute and Bat: a straight charge, then a shockwave
    e.dash -= dt; e.x = clamp(e.x + Math.cos(e.ang) * e.spd * 4.2 * dt, 0, ARENA.w); e.y = clamp(e.y + Math.sin(e.ang) * e.spd * 4.2 * dt, 0, ARENA.h);
    contact(g, e, 'ally');
    if (e.dash <= 0) { ring(g, e, e.enraged ? 18 : 12, 230); shake(g, 8); snd(g, 'ring'); }
    return;
  }
  if (e.wind > 0) {                                   // winding up: stands still, the tell is drawn by render.js
    e.wind -= dt;
    if (e.wind <= 0) bossSpecial(g, e);
    return;
  }
  e.spT -= dt;
  if (e.spT <= 0 && d2(e, P) < 560 * 560) {
    e.spT = e.enraged ? 4 : 6.5; e.wind = 0.85; e.ang = Math.atan2(P.y - e.y, P.x - e.x); e.jx = P.x; e.jy = P.y; snd(g, 'windup');
    return;
  }
  moveTo(e, P.x, P.y, dt, e.r);
  contact(g, e, 'ally');
  if (e.summonT <= 0) {
    e.summonT = 5;
    for (let i = 0; i < (e.type === 'bat' ? 6 : 3); i++) mkEnemy(g, e.type, e.x + rr(g, -60, 60), e.y + rr(g, -60, 60));
  }
  if (e.ringT <= 0) { e.ringT = 4; snd(g, 'ring'); ring(g, e, e.enraged ? 16 : 12, e.enraged ? 230 : 200); }
}

export const BOSS_BLAST = 170; // Bomber boss blast radius, also drawn as its tell
function bossSpecial(g, e) {
  const P = g.P, c = T[e.type].color;
  if (e.type === 'brute' || e.type === 'bat') { e.dash = e.type === 'bat' ? 0.5 : 0.65; return; }
  if (e.type === 'slime') {                           // leaps onto where you stood, scattering small slimes
    e.x = clamp(e.jx, e.r, ARENA.w - e.r); e.y = clamp(e.jy, e.r, ARENA.h - e.r);
    for (let i = 0; i < 4; i++) mkEnemy(g, 'slime', e.x + rr(g, -50, 50), e.y + rr(g, -50, 50), true);
    ring(g, e, 10, 210); shake(g, 12); burst(g, e.x, e.y, c, 30, 260); snd(g, 'boom');
  } else if (e.type === 'archer') {                   // a wide fan of arrows along the aim line
    for (let i = -4; i <= 4; i++) shoot(g, e.x, e.y, e.ang + i * 0.11, 340, 14, 'enemy', e.type, 0, c, true);
    snd(g, 'ring');
  } else if (e.type === 'bomber') {                   // a huge blast around itself
    for (const o of targetsOf(g, 'ally')) if (d2(e, o) < (BOSS_BLAST + o.r) ** 2) damage(g, o, 35, e.type, true);
    burst(g, e.x, e.y, '#ff3b5c', 60, 420); burst(g, e.x, e.y, '#ffd23f', 30, 300); shake(g, 16); snd(g, 'boom');
  } else {                                            // wisp: blinks beside you and fires two offset rings
    const a = g.rand() * 6.28;
    burst(g, e.x, e.y, c, 20, 200);
    e.x = clamp(P.x + Math.cos(a) * 150, e.r, ARENA.w - e.r); e.y = clamp(P.y + Math.sin(a) * 150, e.r, ARENA.h - e.r);
    burst(g, e.x, e.y, c, 20, 200); ring(g, e, 12, 180, 0); ring(g, e, 12, 250, 0.26); snd(g, 'ring');
  }
}

function nearest(g, o, team, maxd = 1e9) {
  let best = null, bd = maxd * maxd;
  if (team === 'ally') { const d = d2(o, g.P); if (d < bd) { bd = d; best = g.P; } }
  for (const e of g.ents) {
    if (e.dead || e.team !== team || e === o) continue;
    const d = d2(o, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const TURN = 3; // enemy turn rate, radians per second
function moveTo(e, x, y, dt, stop = 0) {
  const dx = x - e.x, dy = y - e.y, l = Math.hypot(dx, dy);
  if (l <= stop || l <= 0.1) return;
  const want = Math.atan2(dy, dx);
  // Enemies steer instead of snapping onto you, so a sharp turn shakes them off. Up close they turn freely.
  if (e.team === 'enemy' && !e.boss && l > 90) {
    const diff = Math.atan2(Math.sin(want - e.ang), Math.cos(want - e.ang));
    e.ang += clamp(diff, -TURN * dt, TURN * dt);
  } else e.ang = want;
  const spd = e.spd * (e.slowT > 0 ? e.slowK : 1);
  e.x += Math.cos(e.ang) * spd * dt; e.y += Math.sin(e.ang) * spd * dt;
}

function shoot(g, x, y, a, sp, dmg, team, src, pierce, color, boss = false) {
  const b = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, team, src, pierce, color, boss, life: 2.5, hit: new Set() };
  g.bullets.push(b); return b;
}

function volley(g, e, tg, n, sp, dmg, pierce) {
  const a = Math.atan2(tg.y - e.y, tg.x - e.x);
  for (let i = 0; i < n; i++) {
    const b = shoot(g, e.x, e.y, a + (i - (n - 1) / 2) * 0.18, sp, dmg, e.team, e.type, pierce, T[e.type].color);
    b.nem = e.nem;
    // Job: an Archer nemesis slows whatever it hits.
    if (e.team === 'ally' && e.type === 'archer') { b.slowT = e.evo === 'frost' ? 4 : 2; b.slowK = e.evo === 'frost' ? 0.3 : 0.55; }
  }
}

const targetsOf = (g, team) => team === 'ally'
  ? [g.P, ...g.ents.filter(e => e.team === 'ally' && !e.dead)]
  : g.ents.filter(e => e.team === 'enemy' && !e.dead);

function contact(g, e, foe) {
  if (e.cd > 0) return;
  for (const o of targetsOf(g, foe)) {
    const r = e.r + o.r + 2;
    if (d2(e, o) < r * r) {
      damage(g, o, e.dmg, e.type, e.boss, e.nem); e.cd = 0.6 / e.haste;
      if (e.team === 'ally' && e.type === 'brute') {
        // Job: a Brute nemesis knocks enemies back and stuns them. Quake hits everything close by.
        shove(e, o);
        if (e.evo === 'quake') for (const q of targetsOf(g, foe)) if (q !== o && !q.dead && d2(e, q) < (80 + q.r) ** 2) { damage(g, q, e.dmg * 0.5, e.type, false, e.nem); shove(e, q); }
        burst(g, o.x, o.y, '#ff7a2f', 5, 120);
      }
      if (e.evo === 'vampire') g.P.hp = Math.min(g.P.maxhp, g.P.hp + 1);
      return;
    }
  }
}

export const BLADE_R = 62, NOVA_R = 120;
function shove(e, o) {
  if (o.boss || o.dead) return;
  const dx = o.x - e.x, dy = o.y - e.y, l = Math.hypot(dx, dy) || 1;
  o.x += dx / l * 46; o.y += dy / l * 46; o.stun = 0.6;
}

// Job: a Slime nemesis draws walking enemies onto itself.
function taunter(g, e) {
  if (T[e.type].fly || T[e.type].ranged) return null;
  for (const o of g.ents) if (o.team === 'ally' && o.type === 'slime' && !o.small && !o.dead && d2(e, o) < 150 * 150) return o;
  return null;
}

function think(g, e, dt) {
  if (e.boss) return bossThink(g, e, dt);
  const d = T[e.type], foe = e.team === 'enemy' ? 'ally' : 'enemy', ally = e.team === 'ally', P = g.P;
  e.cd -= dt; e.flash -= dt; e.act -= dt;
  if (e.slowT > 0) e.slowT -= dt;
  if (e.stun > 0) { e.stun -= dt; return; }
  // Job: Bat nemeses fetch gems. Any gem they pass flies to you.
  if (ally && e.type === 'bat') for (const gem of g.gems) if (!gem.pull && d2(e, gem) < 80 * 80) gem.pull = true;
  const pk = ally ? e.pk || {} : null;
  if (pk) {
    if (g.allyRegen) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * g.allyRegen * dt);
    if (pk.regen) e.hp = Math.min(e.maxhp, e.hp + pk.regen * dt);
    // Inherited shots: a melee nemesis that took your Split Shot or Piercing also shoots.
    if (!d.ranged && (pk.shots || pk.pierce)) {
      e.shotT -= dt;
      if (e.shotT <= 0) {
        const st = nearest(g, e, 'enemy', 380);
        if (st) { e.shotT = 1.5 / e.haste; volley(g, e, st, Math.max(1, pk.shots || 0), 380, e.dmg * 0.6, pk.pierce || 0); }
      }
    }
  }
  if (ally && e.type === 'wisp') {
    e.ang += dt * 2.6;
    const tx = P.x + Math.cos(e.ang) * 75, ty = P.y + Math.sin(e.ang) * 75;
    e.x += (tx - e.x) * Math.min(1, dt * 8); e.y += (ty - e.y) * Math.min(1, dt * 8);
    contact(g, e, foe); return;
  }
  // Enemies hunt the player; they only turn on a nemesis that gets in their way.
  const tg = ally ? nearest(g, e, foe, 380) : (taunter(g, e) || nearest(g, e, foe, 110) || P);
  if (!tg) {
    if (!ally) return;
    let gem = null, gd = 500 * 500;
    if (e.type === 'bat') for (const x of g.gems) { const q = d2(e, x); if (!x.pull && q < gd) { gd = q; gem = x; } }
    if (gem) moveTo(e, gem.x, gem.y, dt); else moveTo(e, P.x, P.y, dt, 70);
    return;
  }
  const dist = Math.sqrt(d2(e, tg));
  if (d.ranged) {
    if (ally && Math.sqrt(d2(e, P)) > 190) moveTo(e, P.x, P.y, dt);
    else if (dist > 230) moveTo(e, tg.x, tg.y, dt);
    else if (dist < 170) moveTo(e, 2 * e.x - tg.x, 2 * e.y - tg.y, dt);
    if (ally) {
      if (e.act <= 0 && dist < 400) {
        e.act = 1.1 / e.haste;
        volley(g, e, tg, 1 + (pk?.shots || 0) + (e.evo === 'volley' ? 2 : 0), 380, e.dmg, pk?.pierce || 0);
      }
    } else if (e.aim > 0) {
      // Tell: an enemy Archer shows its aim line for half a second, then fires along it. Step off the line.
      e.aim -= dt;
      if (e.aim <= 0) { shoot(g, e.x, e.y, e.aimAng, 300, e.dmg, 'enemy', e.type, 0, d.color); e.act = 1.3; }
    } else if (e.act <= 0 && dist < 400) { e.aim = 0.5; e.aimAng = Math.atan2(tg.y - e.y, tg.x - e.x); }
    e.x = clamp(e.x, -40, ARENA.w + 40); e.y = clamp(e.y, -40, ARENA.h + 40);
    return;
  }
  if (!ally && e.type === 'brute') {
    // Tell: an enemy Brute plants its feet (a red lane shows where), then charges straight. Dodge sideways;
    // a Brute that runs into a rock stuns itself.
    if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) e.dash = 0.55; return; }
    if (e.dash > 0) {
      e.dash -= dt; e.x += Math.cos(e.ang) * e.spd * 4.2 * dt; e.y += Math.sin(e.ang) * e.spd * 4.2 * dt;
      for (const k of g.rocks) if (d2(e, k) < (k.r + e.r) ** 2) { e.dash = 0; e.stun = 1.5; burst(g, e.x, e.y, '#8a8aa0', 10, 160); shake(g, 5); snd(g, 'thud'); break; }
      contact(g, e, foe);
      if (e.dash <= 0) e.act = 3 + g.rand() * 2;
      return;
    }
    if (e.act <= 0 && dist < 260 && dist > 60) { e.wind = 0.7; e.ang = Math.atan2(tg.y - e.y, tg.x - e.x); snd(g, 'windup'); return; }
  }
  if (!ally && e.type === 'bat' && tg === P) {
    // Tell: enemy Bats circle you, flash, then dive in a straight line.
    if (e.dive > 0) {
      e.dive -= dt; e.x += Math.cos(e.ang) * e.spd * 2.4 * dt; e.y += Math.sin(e.ang) * e.spd * 2.4 * dt;
      contact(g, e, foe);
      if (e.dive <= 0) e.act = 1.6 + g.rand() * 1.6;
      return;
    }
    if (dist < 210) {
      e.warn = e.act < 0.35;
      if (e.act <= 0) { e.warn = false; e.dive = 0.5; e.ang = Math.atan2(P.y - e.y, P.x - e.x); return; }
      const a = Math.atan2(e.y - P.y, e.x - P.x) + 0.7;
      moveTo(e, P.x + Math.cos(a) * 165, P.y + Math.sin(a) * 165, dt);
      return;
    }
    e.warn = false;
  }
  if (d.blink && e.act <= 0 && dist < 350) {
    e.act = 2.2 + g.rand(); burst(g, e.x, e.y, d.color, 6);
    const a = g.rand() * 6.28, r = 50 + g.rand() * 70;
    e.x = clamp(tg.x + Math.cos(a) * r, 10, ARENA.w - 10); e.y = clamp(tg.y + Math.sin(a) * r, 10, ARENA.h - 10);
    burst(g, e.x, e.y, d.color, 6);
  }
  if (d.explode) {
    // Tell: a Bomber that gets close lights its fuse and slows; you have a moment to get out of the blast.
    if (e.fuse > 0) { e.fuse -= dt; e.slowT = 0.1; e.slowK = 0.45; moveTo(e, tg.x, tg.y, dt); if (e.fuse <= 0) explode(g, e); return; }
    if (dist < e.r + tg.r + (ally ? 10 : 55)) { e.fuse = ally ? 0.25 : 0.6; snd(g, 'windup'); return; }
    moveTo(e, tg.x, tg.y, dt); return;
  }
  moveTo(e, tg.x, tg.y, dt);
  contact(g, e, foe);
}

function damage(g, o, amt, src, byBoss = false, by = null) {
  const P = g.P;
  if (o === P) {
    if (P.inv > 0 || g.state !== 'play') return;
    P.hp -= amt; P.inv = 0.25; P.flash = 0.15; shake(g, 8); snd(g, 'hurt');
    if (P.hp <= 0) { P.hp = 0; die(g, src, byBoss); }
    return;
  }
  // Job: a Slime nemesis is a shield. It shrugs off 40% of damage (70% as a Bulwark).
  if (o.team === 'ally') amt *= g.allyArmor;
  if (o.team === 'ally' && o.type === 'slime') amt *= o.evo === 'bulwark' ? 0.3 : 0.6;
  o.hp -= amt; o.flash = 0.08;
  if (o.hp <= 0 && !o.dead) {
    if (by && o.team === 'enemy') by.kills = (by.kills || 0) + 1; // credited to the nemesis; turns into XP after the run
    kill(g, o);
  }
}

// An ally that falls comes back while it has lives left, then is gone for the run.
function allyDown(g, e, delay, free = false) {
  if (e.small) return;
  if (free) g.respawnQ.push({ nem: e.nem, lives: e.lives, at: g.t + delay });
  else if (e.lives > 1) g.respawnQ.push({ nem: e.nem, lives: e.lives - 1, at: g.t + delay });
  else g.fallen.push(e.nem);
}

function kill(g, e) {
  e.dead = true; burst(g, e.x, e.y, T[e.type].color, e.team === 'enemy' ? 10 : 6);
  snd(g, e.boss ? 'win' : e.team === 'enemy' ? 'kill' : 'allyDown');
  if (e.boss) { g.state = 'won'; g.boss = null; burst(g, e.x, e.y, '#fff', 60, 400); shake(g, 20); return; }
  if (T[e.type].split && !e.small) for (let i = 0; i < (e.evo === 'mother' ? 4 : 2); i++) {
    mk(g, 'slime', e.team, e.x + rr(g, -8, 8), e.y + rr(g, -8, 8), { small: true, hpMul: e.hpMul, dmgMul: e.dmgMul });
  }
  if (e.team === 'enemy') { g.kills++; g.gems.push({ x: e.x, y: e.y, v: e.small ? 1 : T[e.type].xp }); if (e.elite) g.chests.push({ x: e.x, y: e.y }); }
  else allyDown(g, e, 6);
}

function explode(g, e) {
  if (e.dead) return; e.dead = true;
  burst(g, e.x, e.y, '#ff3b5c', 26, 260); burst(g, e.x, e.y, '#ffd23f', 14, 180); shake(g, 10); snd(g, 'boom');
  const foe = e.team === 'enemy' ? 'ally' : 'enemy';
  const reach = e.evo === 'cluster' ? 110 : 70;
  for (const o of targetsOf(g, foe)) { const r = reach + o.r; if (d2(e, o) < r * r) damage(g, o, e.dmg, 'bomber', false, e.nem); }
  // Job: a Bomber nemesis that blows itself up comes straight back without losing a life.
  if (e.team === 'ally') allyDown(g, e, e.evo === 'fuse' ? 1.5 : 3, true);
}

const NAME_A = ['Mor', 'Vex', 'Gru', 'Zal', 'Kra', 'Ith', 'Bol', 'Sne', 'Ur', 'Dra', 'Hex', 'Nyx'];
const NAME_B = ['g', 'ok', 'ith', 'ax', 'ul', 'en', 'ash', 'ib', 'oth', 'ek', 'ar', 'us'];

// The killer inherits the build you died with: up to 3 of each perk you had picked.
function makeRecruit(g, type, byBoss) {
  const perks = {};
  let top = null;
  for (const k in PERKS) {
    const n = Math.min(3, g.picks[k] || 0);
    if (n) { perks[k] = n; if (!top || n > perks[top]) top = k; }
  }
  return {
    type, perks, q: recruitQuality(g.t, g.P.lvl, byBoss),
    name: NAME_A[Math.floor(g.rand() * NAME_A.length)] + NAME_B[Math.floor(g.rand() * NAME_B.length)],
    title: top ? PERKS[top].title : 'the Unproven',
  };
}

function die(g, src, byBoss) {
  g.state = 'dead'; g.killer = src; g.recruit = makeRecruit(g, src, byBoss);
  burst(g, g.P.x, g.P.y, '#fff', 40, 300); shake(g, 16); snd(g, 'die');
}

function levelUp(g) {
  const P = g.P;
  P.xp -= P.next; P.lvl++; P.next = Math.floor(P.next * 1.22 + 3);
  g.state = 'lvl'; snd(g, 'level');
  rollChoices(g);
}

// Three different upgrades, at most one of them for your nemeses.
function rollChoices(g) {
  const pool = UP.filter(u => !u.ally || g.party.length);
  g.choices = [];
  while (g.choices.length < 3) {
    const u = pool[Math.floor(g.rand() * pool.length)];
    if (g.choices.includes(u) || (u.ally && g.choices.some(c => c.ally))) continue;
    g.choices.push(u);
  }
}

export function pick(g, i) {
  if (g.state !== 'lvl' || !g.choices[i]) return;
  const u = g.choices[i];
  const times = g.chest ? 2 : 1; g.chest = false;        // a chest applies the pick twice
  for (let k = 0; k < times; k++) { u.f(g); g.picks[u.id] = (g.picks[u.id] || 0) + 1; }
  g.state = 'play';
  if (g.secondWind) {
    g.secondWind = false;
    for (const e of g.ents) if (e.team === 'ally' && !e.small) e.lives++;
    for (const q of g.respawnQ) q.lives++;
    for (const nem of g.fallen) spawnAlly(g, nem, 1);
    g.fallen = [];
  }
  if (g.P.xp >= g.P.next) levelUp(g);
}

// Advance the game by dt seconds. input = { mx, my } in -1..1.
export function step(g, dt, input) {
  g.fx.length = 0;
  if (g.state !== 'play') return;
  const P = g.P;
  g.t += dt;
  const ml = Math.hypot(input.mx, input.my) || 1;
  P.x += input.mx / ml * P.spd * dt; P.y += input.my / ml * P.spd * dt;
  unstick(g, P);
  P.x = clamp(P.x, P.r, ARENA.w - P.r); P.y = clamp(P.y, P.r, ARENA.h - P.r);
  P.inv -= dt; P.flash -= dt; P.hp = Math.min(P.maxhp, P.hp + P.regen * dt);
  P.fireT -= dt;
  if (P.fireT <= 0) {
    const tg = nearest(g, P, 'enemy', 520);
    if (tg) {
      P.fireT = P.fire; const a = Math.atan2(tg.y - P.y, tg.x - P.x); snd(g, 'shoot');
      for (let i = 0; i < P.multi; i++) {
        const crit = P.crit > 0 && g.rand() < 0.15 * P.crit;
        const b = shoot(g, P.x, P.y, a + (i - (P.multi - 1) / 2) * 0.16, 540, P.dmg * (crit ? 3 : 1), 'ally', 'player', P.pierce, crit ? '#ffd23f' : '#fff');
        b.chain = P.chain;
      }
    }
  }
  if (!g.boss && !g.bossAt && g.t >= BOSS_TIME) spawnBoss(g);
  g.spawnT -= dt;
  if (g.spawnT <= 0) { spawnEnemy(g); g.spawnT = Math.max(0.42, 0.85 - g.t * 0.003) * (g.boss ? 2 : 1) / g.heat; }
  // Surge: every 20s a wave closes in from one side, bigger each time.
  g.surgeT -= dt;
  if (g.surgeT <= 0 && !g.boss) {
    g.surgeT = 20; const a = g.rand() * 6.28, n = 3 + Math.floor(g.t / 50);
    for (let i = 0; i < n; i++) spawnEnemy(g, a + rr(g, -0.5, 0.5));
    g.fx.push({ k: 'surge', a }); snd(g, 'surge');
  }
  g.eliteT -= dt;
  if (g.eliteT <= 0 && !g.boss) { g.eliteT = 60; spawnElite(g); }
  for (const q of g.respawnQ) if (!q.done && g.t >= q.at) { q.done = true; spawnAlly(g, q.nem, q.lives); }
  g.respawnQ = g.respawnQ.filter(q => !q.done);
  for (const e of g.ents) if (!e.dead) think(g, e, dt);
  if (g.state !== 'play') return;
  // Orbiting blades cut anything they touch.
  for (let i = 0; i < P.blades; i++) {
    const a = g.t * 3.2 + i * 6.283 / P.blades, bx = P.x + Math.cos(a) * BLADE_R, by = P.y + Math.sin(a) * BLADE_R;
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && (o.bladeT || 0) <= g.t && (o.x - bx) ** 2 + (o.y - by) ** 2 < (o.r + 12) ** 2) {
      o.bladeT = g.t + 0.35; damage(g, o, P.dmg * 0.7, 'player');
    }
  }
  // Nova: a blast around you that hurts and throws enemies back, whenever one is in reach.
  g.novaT -= dt;
  if (P.nova > 0 && g.novaT <= 0) {
    const near = g.ents.filter(o => o.team === 'enemy' && !o.dead && d2(o, P) < (NOVA_R + o.r) ** 2);
    if (near.length) {
      g.novaT = 6 / P.nova; g.fx.push({ k: 'nova', x: P.x, y: P.y, r: NOVA_R }); snd(g, 'ring');
      for (const o of near) { damage(g, o, P.dmg * 2, 'player'); shove(P, o); }
    }
  }
  if (g.state !== 'play') return;

  const ents = g.ents;
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i]; if (a.dead) continue;
    for (let j = i + 1; j < ents.length; j++) {
      const b = ents[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, r = a.r + b.r, dd = dx * dx + dy * dy;
      if (dd < r * r && dd > 0.01) {
        // The boss is never pushed; everything else shares the push.
        const dl = Math.sqrt(dd), nx = dx / dl, ny = dy / dl, o = r - dl;
        const wa = a.boss ? 0 : b.boss ? 1 : 0.5, wb = 1 - wa;
        a.x -= nx * o * wa; a.y -= ny * o * wa; b.x += nx * o * wb; b.y += ny * o * wb;
      }
    }
  }

  for (const e of ents) if (!e.dead && !e.boss && !T[e.type].fly) unstick(g, e);

  for (const b of g.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    // Job: a Wisp nemesis burns up enemy shots that come near it.
    if (b.team === 'enemy' && !b.boss) for (const w of ents) if (w.team === 'ally' && w.type === 'wisp' && !w.dead && d2(b, w) < (w.evo === 'ward' ? 44 * 44 : 24 * 24)) { b.life = 0; burst(g, b.x, b.y, '#4cd9ff', 3, 80); break; }
    if (b.life > 0 && b.team === 'enemy') for (const k of g.rocks) if ((b.x - k.x) ** 2 + (b.y - k.y) ** 2 < k.r * k.r) { b.life = 0; burst(g, b.x, b.y, '#8a8aa0', 2, 60); break; }
    if (b.x < -50 || b.y < -50 || b.x > ARENA.w + 50 || b.y > ARENA.h + 50) b.life = 0;
    if (b.life <= 0) continue;
    for (const o of targetsOf(g, b.team === 'ally' ? 'enemy' : 'ally')) {
      if (b.hit.has(o)) continue;
      const r = o.r + 3;
      if (d2(b, o) < r * r) {
        damage(g, o, b.dmg, b.src, b.boss, b.nem); if (b.slowT && !o.boss && o !== g.P) { o.slowT = b.slowT; o.slowK = b.slowK; } b.hit.add(o); burst(g, b.x, b.y, b.color, 3, 80); if (b.team === 'ally') snd(g, 'hit');
        if (b.chain > 0) {                              // Chain Shot: jump to another enemy close by
          let nx = null, nd = 190 * 190;
          for (const q of g.ents) if (q.team === 'enemy' && !q.dead && !b.hit.has(q)) { const dq = d2(b, q); if (dq < nd) { nd = dq; nx = q; } }
          if (nx) { const c = shoot(g, b.x, b.y, Math.atan2(nx.y - b.y, nx.x - b.x), 540, b.dmg * 0.7, 'ally', 'player', 0, '#9fe8ff'); c.chain = b.chain - 1; c.hit = new Set(b.hit); }
          b.chain = 0;
        }
        if (b.pierce > 0) b.pierce--; else { b.life = 0; break; }
      }
    }
  }
  g.bullets = g.bullets.filter(b => b.life > 0);

  for (const gem of g.gems) {
    const dd = Math.sqrt(d2(gem, P)) || 0.01;
    if (dd < P.magnet || gem.pull) { gem.x += (P.x - gem.x) / dd * 420 * dt; gem.y += (P.y - gem.y) / dd * 420 * dt; }
    if (dd < P.r + 6) { gem.got = true; P.xp += gem.v; snd(g, 'gem'); }
  }
  g.gems = g.gems.filter(x => !x.got);
  for (const c of g.chests) if (!c.got && d2(c, P) < (P.r + 16) ** 2 && g.state === 'play') {
    c.got = true; g.chest = true; g.state = 'lvl'; snd(g, 'level'); rollChoices(g);
  }
  g.chests = g.chests.filter(c => !c.got);
  g.ents = g.ents.filter(e => !e.dead);
  if (P.xp >= P.next && g.state === 'play') levelUp(g);
}
