// Pure game simulation: no DOM, no Math.random. Same seed + same inputs = same run.
import { T, UP } from './data.js';

export const ARENA = { w: 1600, h: 1000 };
export const VIEW = { w: 960, h: 600 };

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

export function createGame({ seed = 1, roster = {} } = {}) {
  const g = {
    rand: mulberry32(seed), roster, state: 'play', t: 0, kills: 0, spawnT: 1, allyBuff: 1,
    ents: [], bullets: [], gems: [], respawnQ: [], fx: [], choices: [], killer: null,
    P: { isP: true, x: ARENA.w / 2, y: ARENA.h / 2, r: 11, hp: 100, maxhp: 100, spd: 210, fire: 0.42, fireT: 0,
      dmg: 10, multi: 1, pierce: 0, magnet: 80, regen: 0, lvl: 1, xp: 0, next: 5, inv: 0, flash: 0 },
  };
  for (const k in roster) {
    if (!T[k]) continue;
    const n = roster[k], sp = Math.min(n, 4), boost = 1 + 0.3 * Math.max(0, n - 4);
    for (let i = 0; i < sp; i++) spawnAlly(g, k, boost);
  }
  return g;
}

const rr = (g, a, b) => a + g.rand() * (b - a);
// Visual effects are queued for the renderer; the sim never draws.
const burst = (g, x, y, c, n, sp = 140) => g.fx.push({ k: 'burst', x, y, c, n, sp });
const shake = (g, v) => g.fx.push({ k: 'shake', v });

function mk(g, type, team, x, y, small) {
  const d = T[type], ally = team === 'ally', s = ally ? 1.6 : (1 + g.t / 80);
  const e = {
    type, team, x, y, r: d.r * (small ? 0.65 : 1), hp: d.hp * s * (small ? 0.4 : 1),
    dmg: d.dmg * (ally ? 1.2 : 1 + g.t / 200), spd: d.spd * (ally ? 1.1 : 1) * (small ? 1.3 : 1),
    cd: 0, act: g.rand() * 2, flash: 0, small, dead: false, ang: g.rand() * 6.28, boost: 1,
  };
  e.maxhp = e.hp; g.ents.push(e); return e;
}

function spawnAlly(g, type, boost) {
  const b = boost * g.allyBuff;
  const e = mk(g, type, 'ally', g.P.x + rr(g, -50, 50), g.P.y + rr(g, -50, 50));
  e.hp *= b; e.maxhp = e.hp; e.dmg *= b; e.boost = boost;
  burst(g, e.x, e.y, '#7dffb0', 8);
  return e;
}

function spawnEnemy(g) {
  const pool = Object.keys(T).filter(k => g.t >= T[k].unlock);
  let r = g.rand() * pool.reduce((a, k) => a + T[k].w, 0), type = pool[0];
  for (const k of pool) { r -= T[k].w; if (r <= 0) { type = k; break; } }
  // Spawn on a ring just outside the camera, kept inside the arena.
  const a = g.rand() * 6.28, dist = rr(g, 600, 680);
  const x = clamp(g.P.x + Math.cos(a) * dist, -30, ARENA.w + 30);
  const y = clamp(g.P.y + Math.sin(a) * dist, -30, ARENA.h + 30);
  const n = type === 'bat' ? 3 + Math.floor(g.t / 40) : type === 'slime' && g.t > 90 ? 2 : 1;
  for (let i = 0; i < n; i++) mk(g, type, 'enemy', x + rr(g, -20, 20), y + rr(g, -20, 20));
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

function shoot(g, x, y, a, sp, dmg, team, src, pierce, color) {
  g.bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, team, src, pierce, color, life: 2, hit: new Set() });
}

const targetsOf = (g, team) => team === 'ally'
  ? [g.P, ...g.ents.filter(e => e.team === 'ally' && !e.dead)]
  : g.ents.filter(e => e.team === 'enemy' && !e.dead);

function contact(g, e, foe) {
  if (e.cd > 0) return;
  for (const o of targetsOf(g, foe)) {
    const r = e.r + o.r + 2;
    if (d2(e, o) < r * r) { damage(g, o, e.dmg, e.type); e.cd = 0.6; return; }
  }
}

function think(g, e, dt) {
  const d = T[e.type], foe = e.team === 'enemy' ? 'ally' : 'enemy', ally = e.team === 'ally', P = g.P;
  e.cd -= dt; e.flash -= dt; e.act -= dt;
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
      e.act = ally ? 1.1 : 1.7;
      shoot(g, e.x, e.y, Math.atan2(tg.y - e.y, tg.x - e.x), ally ? 380 : 250, e.dmg, e.team, e.type, 0, d.color);
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

function damage(g, o, amt, src) {
  const P = g.P;
  if (o === P) {
    if (P.inv > 0 || g.state !== 'play') return;
    P.hp -= amt; P.inv = 0.35; P.flash = 0.15; shake(g, 8);
    if (P.hp <= 0) { P.hp = 0; die(g, src); }
    return;
  }
  o.hp -= amt; o.flash = 0.08;
  if (o.hp <= 0 && !o.dead) kill(g, o);
}

function kill(g, e) {
  e.dead = true; burst(g, e.x, e.y, T[e.type].color, e.team === 'enemy' ? 10 : 6);
  if (T[e.type].split && !e.small) for (let i = 0; i < 2; i++) {
    const s = mk(g, 'slime', e.team, e.x + rr(g, -8, 8), e.y + rr(g, -8, 8), true);
    if (e.team === 'ally') { s.hp *= e.boost * g.allyBuff; s.maxhp = s.hp; }
  }
  if (e.team === 'enemy') { g.kills++; g.gems.push({ x: e.x, y: e.y, v: e.small ? 1 : T[e.type].xp }); }
  else if (!e.small) g.respawnQ.push({ type: e.type, boost: e.boost, at: g.t + 6 });
}

function explode(g, e) {
  if (e.dead) return; e.dead = true;
  burst(g, e.x, e.y, '#ff3b5c', 26, 260); burst(g, e.x, e.y, '#ffd23f', 14, 180); shake(g, 10);
  const foe = e.team === 'enemy' ? 'ally' : 'enemy';
  for (const o of targetsOf(g, foe)) { const r = 70 + o.r; if (d2(e, o) < r * r) damage(g, o, e.dmg, 'bomber'); }
  if (e.team === 'ally') g.respawnQ.push({ type: 'bomber', boost: e.boost, at: g.t + 5 });
}

function die(g, src) {
  g.state = 'dead'; g.killer = src;
  burst(g, g.P.x, g.P.y, '#fff', 40, 300); shake(g, 16);
}

function levelUp(g) {
  const P = g.P;
  P.xp -= P.next; P.lvl++; P.next = Math.floor(P.next * 1.35 + 3);
  g.state = 'lvl';
  const pool = UP.filter(u => !u.ally || Object.keys(g.roster).length);
  g.choices = [];
  while (g.choices.length < 3) { const u = pool[Math.floor(g.rand() * pool.length)]; if (!g.choices.includes(u)) g.choices.push(u); }
}

export function pick(g, i) {
  if (g.state !== 'lvl' || !g.choices[i]) return;
  g.choices[i].f(g); g.state = 'play';
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
  g.spawnT -= dt;
  if (g.spawnT <= 0) { spawnEnemy(g); g.spawnT = Math.max(0.22, 1.3 - g.t * 0.009); }
  for (const q of g.respawnQ) if (!q.done && g.t >= q.at) { q.done = true; spawnAlly(g, q.type, q.boost); }
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
        const dl = Math.sqrt(dd), p = (r - dl) / 2, nx = dx / dl, ny = dy / dl;
        a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
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
        damage(g, o, b.dmg, b.src); b.hit.add(o); burst(g, b.x, b.y, b.color, 3, 80);
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
