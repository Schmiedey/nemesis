// Pure game simulation: no DOM, no Math.random. Same seed + same inputs = same run.
import { T, UP, PERKS, BOSS_TIME } from './data.js';

export const ARENA = { w: 1600, h: 1000 };
export const VIEW = { w: 960, h: 600 };
export const BOSS_HP = 3500;
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
export function createGame({ seed = 1, party = [], bossType = 'brute' } = {}) {
  const g = {
    rand: mulberry32(seed), party: party.filter(n => T[n.type]).slice(0, 3), bossType: T[bossType] ? bossType : 'brute',
    state: 'play', t: 0, kills: 0, spawnT: 0.2, surgeT: 20, allyBuff: 1, allyHaste: 1, secondWind: false,
    ents: [], bullets: [], gems: [], respawnQ: [], fallen: [], fx: [], choices: [], picks: {},
    killer: null, recruit: null, boss: null, bossAt: 0,
    P: { isP: true, x: ARENA.w / 2, y: ARENA.h / 2, r: 11, hp: 100, maxhp: 100, spd: 210, fire: 0.42, fireT: 0,
      dmg: 10, multi: 1, pierce: 0, magnet: 80, regen: 0, lvl: 1, xp: 0, next: 5, inv: 0, flash: 0 },
  };
  for (const nem of g.party) {
    const lives = nem.type === 'bomber' ? BOMBER_LIVES : ALLY_LIVES;
    for (let i = 0; i < (T[nem.type].pack || 1); i++) spawnAlly(g, nem, lives);
  }
  return g;
}

const rr = (g, a, b) => a + g.rand() * (b - a);
// Visual effects are queued for the renderer; the sim never draws.
const burst = (g, x, y, c, n, sp = 140) => g.fx.push({ k: 'burst', x, y, c, n, sp });
const shake = (g, v) => g.fx.push({ k: 'shake', v });

function mk(g, type, team, x, y, { small = false, hpMul = 1, dmgMul = 1, spdMul = 1 } = {}) {
  const d = T[type];
  const e = {
    type, team, x, y, r: d.r * (small ? 0.65 : 1), hp: d.hp * hpMul * (small ? 0.4 : 1),
    dmg: d.dmg * dmgMul, spd: d.spd * spdMul * (small ? 1.3 : 1), hpMul, dmgMul,
    cd: 0, act: g.rand() * 2, flash: 0, small, dead: false, ang: g.rand() * 6.28, haste: 1,
  };
  e.maxhp = e.hp; g.ents.push(e); return e;
}

const mkEnemy = (g, type, x, y, small) => mk(g, type, 'enemy', x, y, { small, hpMul: 1 + g.t / 130, dmgMul: 1 + g.t / 260 });

function spawnAlly(g, nem, lives) {
  const pk = nem.perks || {};
  const e = mk(g, nem.type, 'ally', g.P.x + rr(g, -50, 50), g.P.y + rr(g, -50, 50), {
    hpMul: (1 + 1.5 * nem.q) * (1 + 0.25 * (pk.tough || 0)) * g.allyBuff * (1 + g.t / 150),
    dmgMul: (0.6 + 1.2 * nem.q) * (1 + 0.2 * (pk.dmg || 0)) * g.allyBuff * (1 + g.t / 150),
    spdMul: 1.1 * (1 + 0.08 * (pk.spd || 0)),
  });
  e.nem = nem; e.pk = pk; e.lives = lives; e.shotT = 1;
  e.haste = (1 + 0.2 * (pk.haste || 0)) * g.allyHaste;
  burst(g, e.x, e.y, '#7dffb0', 8);
  return e;
}

function spawnEnemy(g, ang) {
  const pool = Object.keys(T).filter(k => g.t >= T[k].unlock);
  let r = g.rand() * pool.reduce((a, k) => a + T[k].w, 0), type = pool[0];
  for (const k of pool) { r -= T[k].w; if (r <= 0) { type = k; break; } }
  // Spawn on a ring just outside the camera, kept inside the arena.
  const a = ang ?? g.rand() * 6.28, dist = rr(g, 600, 680);
  const x = clamp(g.P.x + Math.cos(a) * dist, -30, ARENA.w + 30);
  const y = clamp(g.P.y + Math.sin(a) * dist, -30, ARENA.h + 30);
  const n = type === 'bat' ? 3 + Math.floor(g.t / 70) : type === 'slime' && g.t > 90 ? 2 : 1;
  for (let i = 0; i < n; i++) mkEnemy(g, type, x + rr(g, -20, 20), y + rr(g, -20, 20));
}

// The boss is a giant version of the enemy type that has killed you most.
function spawnBoss(g) {
  const d = T[g.bossType], a = g.rand() * 6.28;
  const e = mk(g, g.bossType, 'enemy', clamp(g.P.x + Math.cos(a) * 520, 60, ARENA.w - 60), clamp(g.P.y + Math.sin(a) * 520, 60, ARENA.h - 60));
  e.boss = true; e.r = d.r * 2.5 + 20; e.hp = e.maxhp = BOSS_HP; e.dmg = 30;
  e.spd = clamp(d.spd * 0.8, 70, 115); e.summonT = 3; e.ringT = 5;
  g.boss = e; g.bossAt = g.t; shake(g, 14); burst(g, e.x, e.y, d.color, 40, 300);
}

function bossThink(g, e, dt) {
  const P = g.P, d = T[e.type];
  e.cd -= dt; e.flash -= dt; e.summonT -= dt; e.ringT -= dt;
  moveTo(e, P.x, P.y, dt, e.r);
  contact(g, e, 'ally');
  if (e.summonT <= 0) {
    e.summonT = 5;
    for (let i = 0; i < (e.type === 'bat' ? 6 : 3); i++) mkEnemy(g, e.type, e.x + rr(g, -60, 60), e.y + rr(g, -60, 60));
  }
  if (e.ringT <= 0) {
    e.ringT = 4; const off = g.rand() * 6.28;
    for (let i = 0; i < 12; i++) shoot(g, e.x, e.y, off + i * Math.PI / 6, 200, 14, 'enemy', e.type, 0, d.color, true);
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

function moveTo(e, x, y, dt, stop = 0) {
  const dx = x - e.x, dy = y - e.y, l = Math.hypot(dx, dy);
  if (l > stop && l > 0.1) { e.x += dx / l * e.spd * dt; e.y += dy / l * e.spd * dt; e.ang = Math.atan2(dy, dx); }
}

function shoot(g, x, y, a, sp, dmg, team, src, pierce, color, boss = false) {
  g.bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, team, src, pierce, color, boss, life: 2.5, hit: new Set() });
}

function volley(g, e, tg, n, sp, dmg, pierce) {
  const a = Math.atan2(tg.y - e.y, tg.x - e.x);
  for (let i = 0; i < n; i++) shoot(g, e.x, e.y, a + (i - (n - 1) / 2) * 0.18, sp, dmg, e.team, e.type, pierce, T[e.type].color);
}

const targetsOf = (g, team) => team === 'ally'
  ? [g.P, ...g.ents.filter(e => e.team === 'ally' && !e.dead)]
  : g.ents.filter(e => e.team === 'enemy' && !e.dead);

function contact(g, e, foe) {
  if (e.cd > 0) return;
  for (const o of targetsOf(g, foe)) {
    const r = e.r + o.r + 2;
    if (d2(e, o) < r * r) { damage(g, o, e.dmg, e.type, e.boss); e.cd = 0.6 / e.haste; return; }
  }
}

function think(g, e, dt) {
  if (e.boss) return bossThink(g, e, dt);
  const d = T[e.type], foe = e.team === 'enemy' ? 'ally' : 'enemy', ally = e.team === 'ally', P = g.P;
  e.cd -= dt; e.flash -= dt; e.act -= dt;
  const pk = ally ? e.pk || {} : null;
  if (pk) {
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
  const tg = nearest(g, e, foe, ally ? 380 : 1e9);
  if (!tg) { if (ally) moveTo(e, P.x, P.y, dt, 70); return; }
  const dist = Math.sqrt(d2(e, tg));
  if (d.ranged) {
    if (ally && Math.sqrt(d2(e, P)) > 190) moveTo(e, P.x, P.y, dt);
    else if (dist > 230) moveTo(e, tg.x, tg.y, dt);
    else if (dist < 170) moveTo(e, 2 * e.x - tg.x, 2 * e.y - tg.y, dt);
    if (e.act <= 0 && dist < 400) {
      e.act = (ally ? 1.1 : 1.7) / e.haste;
      volley(g, e, tg, 1 + (pk?.shots || 0), ally ? 380 : 250, e.dmg, pk?.pierce || 0);
    }
    e.x = clamp(e.x, -40, ARENA.w + 40); e.y = clamp(e.y, -40, ARENA.h + 40);
    return;
  }
  if (d.blink && e.act <= 0 && dist < 350) {
    e.act = 2.2 + g.rand(); burst(g, e.x, e.y, d.color, 6);
    const a = g.rand() * 6.28, r = 50 + g.rand() * 70;
    e.x = clamp(tg.x + Math.cos(a) * r, 10, ARENA.w - 10); e.y = clamp(tg.y + Math.sin(a) * r, 10, ARENA.h - 10);
    burst(g, e.x, e.y, d.color, 6);
  }
  moveTo(e, tg.x, tg.y, dt);
  if (d.explode) { if (dist < e.r + tg.r + 6) explode(g, e); return; }
  contact(g, e, foe);
}

function damage(g, o, amt, src, byBoss = false) {
  const P = g.P;
  if (o === P) {
    if (P.inv > 0 || g.state !== 'play') return;
    P.hp -= amt; P.inv = 0.35; P.flash = 0.15; shake(g, 8);
    if (P.hp <= 0) { P.hp = 0; die(g, src, byBoss); }
    return;
  }
  o.hp -= amt; o.flash = 0.08;
  if (o.hp <= 0 && !o.dead) kill(g, o);
}

// An ally that falls comes back while it has lives left, then is gone for the run.
function allyDown(g, e, delay) {
  if (e.small) return;
  if (e.lives > 1) g.respawnQ.push({ nem: e.nem, lives: e.lives - 1, at: g.t + delay });
  else g.fallen.push(e.nem);
}

function kill(g, e) {
  e.dead = true; burst(g, e.x, e.y, T[e.type].color, e.team === 'enemy' ? 10 : 6);
  if (e.boss) { g.state = 'won'; g.boss = null; burst(g, e.x, e.y, '#fff', 60, 400); shake(g, 20); return; }
  if (T[e.type].split && !e.small) for (let i = 0; i < 2; i++) {
    mk(g, 'slime', e.team, e.x + rr(g, -8, 8), e.y + rr(g, -8, 8), { small: true, hpMul: e.hpMul, dmgMul: e.dmgMul });
  }
  if (e.team === 'enemy') { g.kills++; g.gems.push({ x: e.x, y: e.y, v: e.small ? 1 : T[e.type].xp }); }
  else allyDown(g, e, 6);
}

function explode(g, e) {
  if (e.dead) return; e.dead = true;
  burst(g, e.x, e.y, '#ff3b5c', 26, 260); burst(g, e.x, e.y, '#ffd23f', 14, 180); shake(g, 10);
  const foe = e.team === 'enemy' ? 'ally' : 'enemy';
  for (const o of targetsOf(g, foe)) { const r = 70 + o.r; if (d2(e, o) < r * r) damage(g, o, e.dmg, 'bomber'); }
  if (e.team === 'ally') allyDown(g, e, 5);
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
  burst(g, g.P.x, g.P.y, '#fff', 40, 300); shake(g, 16);
}

function levelUp(g) {
  const P = g.P;
  P.xp -= P.next; P.lvl++; P.next = Math.floor(P.next * 1.22 + 3);
  g.state = 'lvl';
  const pool = UP.filter(u => !u.ally || g.party.length);
  g.choices = [];
  while (g.choices.length < 3) { const u = pool[Math.floor(g.rand() * pool.length)]; if (!g.choices.includes(u)) g.choices.push(u); }
}

export function pick(g, i) {
  if (g.state !== 'lvl' || !g.choices[i]) return;
  const u = g.choices[i];
  u.f(g); g.picks[u.id] = (g.picks[u.id] || 0) + 1; g.state = 'play';
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
  P.x = clamp(P.x + input.mx / ml * P.spd * dt, P.r, ARENA.w - P.r);
  P.y = clamp(P.y + input.my / ml * P.spd * dt, P.r, ARENA.h - P.r);
  P.inv -= dt; P.flash -= dt; P.hp = Math.min(P.maxhp, P.hp + P.regen * dt);
  P.fireT -= dt;
  if (P.fireT <= 0) {
    const tg = nearest(g, P, 'enemy', 520);
    if (tg) {
      P.fireT = P.fire; const a = Math.atan2(tg.y - P.y, tg.x - P.x);
      for (let i = 0; i < P.multi; i++) shoot(g, P.x, P.y, a + (i - (P.multi - 1) / 2) * 0.16, 540, P.dmg, 'ally', 'player', P.pierce, '#fff');
    }
  }
  if (!g.boss && !g.bossAt && g.t >= BOSS_TIME) spawnBoss(g);
  g.spawnT -= dt;
  if (g.spawnT <= 0) { spawnEnemy(g); g.spawnT = Math.max(0.34, 0.85 - g.t * 0.004) * (g.boss ? 2 : 1); }
  // Surge: every 20s a wave closes in from one side, bigger each time.
  g.surgeT -= dt;
  if (g.surgeT <= 0 && !g.boss) {
    g.surgeT = 20; const a = g.rand() * 6.28, n = 4 + Math.floor(g.t / 30);
    for (let i = 0; i < n; i++) spawnEnemy(g, a + rr(g, -0.5, 0.5));
    g.fx.push({ k: 'surge', a });
  }
  for (const q of g.respawnQ) if (!q.done && g.t >= q.at) { q.done = true; spawnAlly(g, q.nem, q.lives); }
  g.respawnQ = g.respawnQ.filter(q => !q.done);
  for (const e of g.ents) if (!e.dead) think(g, e, dt);
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

  for (const b of g.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.x < -50 || b.y < -50 || b.x > ARENA.w + 50 || b.y > ARENA.h + 50) b.life = 0;
    if (b.life <= 0) continue;
    for (const o of targetsOf(g, b.team === 'ally' ? 'enemy' : 'ally')) {
      if (b.hit.has(o)) continue;
      const r = o.r + 3;
      if (d2(b, o) < r * r) {
        damage(g, o, b.dmg, b.src, b.boss); b.hit.add(o); burst(g, b.x, b.y, b.color, 3, 80);
        if (b.pierce > 0) b.pierce--; else { b.life = 0; break; }
      }
    }
  }
  g.bullets = g.bullets.filter(b => b.life > 0);

  for (const gem of g.gems) {
    const dd = Math.sqrt(d2(gem, P)) || 0.01;
    if (dd < P.magnet) { gem.x += (P.x - gem.x) / dd * 420 * dt; gem.y += (P.y - gem.y) / dd * 420 * dt; }
    if (dd < P.r + 6) { gem.got = true; P.xp += gem.v; }
  }
  g.gems = g.gems.filter(x => !x.got);
  g.ents = g.ents.filter(e => !e.dead);
  if (P.xp >= P.next && g.state === 'play') levelUp(g);
}
