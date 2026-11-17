// Pure game simulation: no DOM, no Math.random. Same seed + same inputs = same run.
import { MAX_RANK, UP_SLOTS, FILLERS, EVO_TIME, WEAPON_EVOS, PAIRS, T, UP, PERKS, LEG_TRAIT, BOSS_TIME, WEAPONS, ABILITIES, CHARMS, POWERUPS, ALL_GEAR, CLASSES, MAX_TIER, RARITY, RARITIES } from './data.js';

export const ARENA = { w: 4800, h: 3000 };   // about five screens across
export const VIEW = { w: 960, h: 600 };
// The Crypt: three fixed layouts of rocks at the middle of the world, one picked per run from the seed. Circles: { x, y, r },
// laid out on a 1600x1000 stamp that `buildWorld` centres. The rest of the world is scattered with rock clusters from the seed.
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
// How strong a nemesis's job is: runt 0.76, soldier 1, veteran 1.28, champion 1.72. Minions without a rank count as soldiers.
export const jobK = e => 0.6 + 0.4 * Math.min(e && e.nem ? e.nem.q : 1, 3);
export const CRYPT = { w: 1600, h: 1000 };
const ROCK_CELL = 160, ROCK_PAD = 60;   // the rock grid: each cell lists the rocks within ROCK_PAD of it
export function buildWorld(seed, layout) {
  const ox = (ARENA.w - CRYPT.w) / 2, oy = (ARENA.h - CRYPT.h) / 2;
  const rocks = LAYOUTS[layout].rocks.map(k => ({ x: k.x + ox, y: k.y + oy, r: k.r }));
  let s = (seed * 7919 + 13) % 2147483647 || 1; const rn = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const walls = [];
  const free = (x, y, r) => rocks.every(k => Math.hypot(k.x - x, k.y - y) > k.r + r + 34) && walls.every(k => gapTo(k, x, y) > r + 34);   // always a path
  const apart = (a, b) => Math.hypot(Math.max(a.x - b.x - b.w, b.x - a.x - a.w, 0), Math.max(a.y - b.y - b.h, b.y - a.y - a.h, 0));
  for (let cy = 0; cy < ARENA.h; cy += 400) for (let cx = 0; cx < ARENA.w; cx += 400) {
    if (cx + 400 > ox - 60 && cx < ox + CRYPT.w + 60 && cy + 400 > oy - 60 && cy < oy + CRYPT.h + 60) continue;   // keep the Crypt as it is
    const roll = rn();
    if (roll < 0.25) continue;
    if (roll < 0.55) {                                   // a ruin: a wall, a corner, or a room with doorways
      const mx = cx + 200 + (rn() - 0.5) * 60, my = cy + 200 + (rn() - 0.5) * 60, TH = 22, DOOR = 84, kind = rn(), ruin = [];
      const seg = (x, y, w, h) => { if (w > 8 && h > 8) ruin.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), wall: true }); };
      if (kind < 0.35) { const len = 170 + rn() * 150; if (rn() < 0.5) seg(mx - len / 2, my - TH / 2, len, TH); else seg(mx - TH / 2, my - len / 2, TH, len); }
      else if (kind < 0.65) {
        const a = 140 + rn() * 110, b = 140 + rn() * 110, sx = rn() < 0.5 ? 1 : -1, sy = rn() < 0.5 ? 1 : -1;
        seg(sx > 0 ? mx : mx - a, my, a, TH); seg(mx, sy > 0 ? my + TH : my - b, TH, b);
      } else {
        const sz = 210 + rn() * 80, x0 = mx - sz / 2, y0 = my - sz / 2, half = (sz - DOOR) / 2, inner = sz - 2 * TH, ih = (inner - DOOR) / 2;
        const doors = [0, 1, 2, 3].map(() => rn() < 0.6); if (doors.filter(Boolean).length < 2) { doors[0] = true; doors[2] = true; }
        const side = (door, hx, hy, horiz) => {
          const len = horiz ? sz : inner, part = horiz ? half : ih;
          if (!door) return horiz ? seg(hx, hy, len, TH) : seg(hx, hy, TH, len);
          if (horiz) { seg(hx, hy, part, TH); seg(hx + len - part, hy, part, TH); } else { seg(hx, hy, TH, part); seg(hx, hy + len - part, TH, part); }
        };
        side(doors[0], x0, y0, true); side(doors[2], x0, y0 + sz - TH, true); side(doors[3], x0, y0 + TH, false); side(doors[1], x0 + sz - TH, y0 + TH, false);
      }
      const inside = ruin.every(k => k.x > 60 && k.y > 60 && k.x + k.w < ARENA.w - 60 && k.y + k.h < ARENA.h - 60);
      if (inside && ruin.every(k => rocks.every(o => gapTo(k, o.x, o.y) > o.r + 40) && walls.every(o => apart(k, o) > 40))) walls.push(...ruin);
      continue;
    }
    const mx = cx + 80 + rn() * 240, my = cy + 80 + rn() * 240, n = 1 + Math.floor(rn() * 4);
    for (let i = 0; i < n; i++) {
      const r = Math.round(20 + rn() * 28), a = rn() * 6.283, d = i ? 40 + rn() * 50 : 0;
      const x = Math.round(Math.min(ARENA.w - 60, Math.max(60, mx + Math.cos(a) * d))), y = Math.round(Math.min(ARENA.h - 60, Math.max(60, my + Math.sin(a) * d)));
      if (free(x, y, r)) rocks.push({ x, y, r });
    }
  }
  const gw = Math.ceil(ARENA.w / ROCK_CELL), gh = Math.ceil(ARENA.h / ROCK_CELL), grid = Array.from({ length: gw * gh }, () => []);
  for (const k of [...rocks, ...walls]) {
    const L = k.wall ? k.x : k.x - k.r, R = k.wall ? k.x + k.w : k.x + k.r, U = k.wall ? k.y : k.y - k.r, D = k.wall ? k.y + k.h : k.y + k.r;
    const x0 = Math.max(0, Math.floor((L - ROCK_PAD) / ROCK_CELL)), x1 = Math.min(gw - 1, Math.floor((R + ROCK_PAD) / ROCK_CELL));
    const y0 = Math.max(0, Math.floor((U - ROCK_PAD) / ROCK_CELL)), y1 = Math.min(gh - 1, Math.floor((D + ROCK_PAD) / ROCK_CELL));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * gw + x].push(k);
  }
  return { rocks, walls, grid, gw, gh };
}
const NONE = [];
// Obstacles are rocks (circles { x, y, r }) and walls (rectangles { x, y, w, h, wall: true }). gapTo: distance from a point to its surface (0 inside a wall).
export const gapTo = (k, x, y) => k.wall ? Math.hypot(Math.max(k.x - x, 0, x - k.x - k.w), Math.max(k.y - y, 0, y - k.y - k.h)) : Math.hypot(x - k.x, y - k.y) - k.r;
const obsNear = (W, x, y) => { const cx = Math.floor(x / ROCK_CELL), cy = Math.floor(y / ROCK_CELL); return cx < 0 || cy < 0 || cx >= W.gw || cy >= W.gh ? NONE : W.grid[cy * W.gw + cx]; };
// The rocks and walls that could touch something of radius up to ROCK_PAD at (x, y).
export const rocksNear = (g, x, y) => obsNear(g.world, x, y);

// The flow field: a 40-unit grid filled outward from the player every 0.25s, so walkers go round walls instead of into them.
// Walkers only follow it when a wall or rock stands between them and where they are going.
const FC = 40;
function buildFlow(W) {
  const gw = Math.ceil(ARENA.w / FC), gh = Math.ceil(ARENA.h / FC), block = new Uint8Array(gw * gh);
  for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
    const x = cx * FC + FC / 2, y = cy * FC + FC / 2;
    for (const k of obsNear(W, x, y)) if (gapTo(k, x, y) < 16) { block[cy * gw + cx] = 1; break; }
  }
  return { gw, gh, block, d: new Int32Array(gw * gh).fill(-1), q: new Int32Array(gw * gh), sx: -9999, sy: -9999 };
}
const cellOf = (F, x, y) => Math.min(F.gh - 1, Math.max(0, Math.floor(y / FC))) * F.gw + Math.min(F.gw - 1, Math.max(0, Math.floor(x / FC)));
function flowFrom(F, x, y) {
  const { gw, gh, block, d, q } = F; d.fill(-1);
  let h = 0, t = 0; const c0 = cellOf(F, x, y); d[c0] = 0; q[t++] = c0;
  while (h < t) {
    const c = q[h++], cx = c % gw, cy = (c - cx) / gw, nd = d[c] + 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const n = ny * gw + nx; if (d[n] >= 0 || block[n]) continue;
      if (dx && dy && (block[cy * gw + nx] || block[ny * gw + cx])) continue;   // no cutting corners
      d[n] = nd; q[t++] = n;
    }
  }
  F.sx = x; F.sy = y;
}
// Is the way from (x0, y0) to (x1, y1) free of blocked cells? Checked every half cell.
function clearLine(F, x0, y0, x1, y1) {
  const l = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(l / (FC / 2));
  for (let i = 1; i < n; i++) if (F.block[cellOf(F, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)]) return false;
  return true;
}
// The middle of the next cell on the way to the player, or null when already there or out of reach.
function flowStep(F, x, y) {
  const c = cellOf(F, x, y), dc = F.d[c]; if (dc <= 0) return null;
  const cx = c % F.gw, cy = (c - cx) / F.gw; let best = -1, bd = dc;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, ny = cy + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= F.gw || ny >= F.gh) continue;
    const n = ny * F.gw + nx; if (F.d[n] < 0 || F.d[n] >= bd) continue;
    if (dx && dy && (F.block[cy * F.gw + nx] || F.block[ny * F.gw + cx])) continue;
    bd = F.d[n]; best = n;
  }
  if (best < 0) return null;
  const bx = best % F.gw; return { x: bx * FC + FC / 2, y: (best - bx) / F.gw * FC + FC / 2 };
}
let FLOW = null;   // the field for the step being run (moveTo has no game handle)
// Push a circle body out of any rock it overlaps.
function unstick(g, o) {
  for (const k of rocksNear(g, o.x, o.y)) {
    if (k.wall) {
      const nx = clamp(o.x, k.x, k.x + k.w), ny = clamp(o.y, k.y, k.y + k.h), dx = o.x - nx, dy = o.y - ny, dd = dx * dx + dy * dy;
      if (dd >= o.r * o.r) continue;
      if (dd > 0.0001) { const l = Math.sqrt(dd); o.x = nx + dx / l * o.r; o.y = ny + dy / l * o.r; continue; }
      const L = o.x - k.x, R = k.x + k.w - o.x, U = o.y - k.y, D = k.y + k.h - o.y, m = Math.min(L, R, U, D);   // centre inside: out the shortest way
      if (m === L) o.x = k.x - o.r; else if (m === R) o.x = k.x + k.w + o.r; else if (m === U) o.y = k.y - o.r; else o.y = k.y + k.h + o.r;
      continue;
    }
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
// prize: 'elite' or 'gold' if that is what killed you. Dying to one is worth more: a better recruit.
export const PRIZE_BONUS = { elite: 0.5, gold: 0.35 };
export function recruitQuality(t, lvl, byBoss = false, prize = null) {
  return clamp(0.3 + t / 140 + lvl * 0.03 + (byBoss ? 0.3 : 0) + (PRIZE_BONUS[prize] || 0), 0.3, 3);
}

// party: up to 3 nemeses { id, type, name, title, q, perks }. bossType: enemy type of the 5:00 boss.
// hard: Nemesis+ (bigger swarm, tougher enemies). boon: an upgrade id to start the run with.
// loadout: { weapon, ability } ids from src/data.js. owned: gear ids the player already has; gear only drops when this is given.
export function createGame({ seed = 1, party = [], bossType = 'brute', layout = seed % LAYOUTS.length, hard = false, boon = null, loadout = {}, owned = null, cls = null, tier = 0, meta = {}, mastery = 0, grudge = null } = {}) {
  // tier: Nemesis+ level 0..5 (`hard` means tier 2). meta: Shrine ranks by id. mastery: class level 0..4.
  const tr = clamp(hard ? Math.max(2, tier) : tier, 0, MAX_TIER), mr = id => Math.max(0, meta[id] | 0);
  const g = {
    rand: mulberry32(seed), party: party.filter(n => T[n.type]).slice(0, 3), bossType: T[bossType] ? bossType : 'brute',
    state: 'play', t: 0, kills: 0, spawnT: 0.2, surgeT: 20, allyBuff: 1, allyHaste: 1, secondWind: false,
    ents: [], bullets: [], gems: [], respawnQ: [], fallen: [], fx: [], choices: [], picks: {},
    killer: null, recruit: null, boss: null, bossAt: 0,
    layout: LAYOUTS[layout % LAYOUTS.length].name, world: buildWorld(seed, layout % LAYOUTS.length), get rocks() { return this.world.rocks; },
    // Things the run keeps count of, for the HUD, missions and the end screen.
    streak: 0, streakT: 0, bestStreak: 0, killsBy: {}, elites: 0, acts: 0, epics: 0, bonusSouls: 0, minute: 0,
    rar: [], luck: 1 + 0.12 * mr('luck'), soulMul: 1, storm: false, stormT: 0, phoenix: false, twin: false, leechC: 0,
    respawnMul: 1, hitBy: null, hint: null,
    // Class ultimate: charge 0..1 from kills; ultT is how long the current one has left; ultN how many you have used.
    ult: 0, ultT: 0, ultN: 0, ultTick: 0, laser: null, blockT: 0, shotN: 0,
    cls: CLASSES[cls] ? cls : null, armor: 1, raiseC: 0, tier: tr, xpMul: 1 + 0.08 * mr('wisdom'), rerolls: mr('reroll'), pairs: {}, banishes: 1 + mr('banish'), banned: new Set(), dry: 0, minionBuff: 1 + 0.15 * clamp(mastery, 0, 4),
    pickups: [], frenzyT: 0, giantT: 0, hourUsed: false, afterT: 0, powerups: 0,
    owned: owned ? new Set(owned) : null, loot: [], rangs: [], fires: [], totems: [], decoy: null, slowT: 0, zaps: [],
    // grudge: { name, kills, powers } — the boss is the thing that has been killing you, and it learned from you
    grudge: grudge && T[bossType] ? { name: String(grudge.name || ''), kills: grudge.kills | 0, powers: (grudge.powers || []).filter(k => GRUDGE_POWERS[k]).slice(0, 2) } : null,
    chests: [], chest: false, opened: 0, hard: tr > 0, eliteT: 60, allyRegen: 0, allyArmor: 1, novaT: 0, vacT: 0,
    // The Knight always fights with a sword (CLASSES.knight.weapon); other classes use the loadout.
    P: { isP: true, x: ARENA.w / 2, y: ARENA.h / 2, r: 11, hp: 100, maxhp: 100, spd: 200, fire: 0.42, fireT: 0,
      dmg: 10, multi: 1, pierce: 0, magnet: 80, regen: 0, blades: 0, chain: 0, nova: 0, crit: 0,
      weapon: CLASSES[cls]?.weapon || (WEAPONS[loadout.weapon] ? loadout.weapon : 'blaster'), ability: ABILITIES[loadout.ability] ? loadout.ability : 'dash',
      actT: 0, dashT: 0, fx: 1, fy: 0, trailT: 0, totemT: 0, shield: 0, cdMul: 1, frost: 0, ember: 0, exec: 0, dodge: 0, leech: 0, charm: CHARMS[loadout.charm] ? loadout.charm : null, lvl: 1, xp: 0, next: XP_START, inv: 0, flash: 0 },
  };
  // A stronger party draws a bigger swarm, so the opening is never a walkover.
  g.heat = 1.3 * (1 + 0.015 * g.party.reduce((a, n) => a + n.q, 0)) * (1 + 0.14 * tr);   // 1.14: the swarm grew when rarities made upgrades stronger
  // Shrine upgrades and class mastery.
  const P0 = g.P;
  P0.maxhp += 8 * mr('vit'); P0.hp = P0.maxhp; P0.dmg *= (1 + 0.05 * mr('might')) * (1 + 0.02 * clamp(mastery, 0, 4));
  P0.fire /= 1 + 0.04 * mr('haste'); P0.spd *= 1 + 0.03 * mr('swift'); g.allyBuff *= 1 + 0.08 * mr('kin');
  for (const nem of g.party) {
    const lives = nem.type === 'bomber' ? BOMBER_LIVES : ALLY_LIVES;
    const n = (nem.evo === 'brood' ? 5 : nem.evo === 'storm' ? 2 : T[nem.type].pack || 1) + ((nem.legs || []).includes('twin') ? 1 : 0);
    nem.kills = 0;
    for (let i = 0; i < n; i++) spawnAlly(g, nem, lives);
  }
  // Class: a passive bonus and a starter minion. With no class (tests, the balance bot's baseline) nothing changes.
  if (g.cls === 'knight') { g.P.maxhp += 30; g.P.hp += 30; g.armor = 0.85; }
  else if (g.cls === 'ranger') { g.P.spd *= 1.1; }
  else if (g.cls === 'warden') g.P.regen += 0.1;
  if (g.cls) { spawnMinion(g, CLASSES[g.cls].minion); g.heat *= 1.22; }
  if (g.cls === 'engineer') spawnMinion(g, 'drone');                   // the Engineer flies two Drones
  g.soulMul *= 1 + 0.15 * g.party.filter(n => n.prize === 'gold').length;   // a golden nemesis in the party: +15% souls   // a class is a lot of extra power, so the swarm grows to match
  const b = boon && UP.find(u => u.id === boon);
  if (b) { b.f(g); g.picks[b.id] = 1; }
  checkPairs(g);
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

const mkEnemy = (g, type, x, y, small) => mk(g, type, 'enemy', x, y, { small, hpMul: (1 + g.t / 160) * (1 + 0.1 * g.tier), dmgMul: (1.25 + g.t / 320) * (1 + 0.06 * g.tier), spdMul: Math.min(1.15, 1 + g.t / 1400) });

// What a nemesis does with the build it took from you: the newer upgrades, your weapon's trait, your Legendary powers.
const allyCrit = (g, pk) => (pk && pk.crit && g.rand() < 0.15 * pk.crit ? 3 : 1);
function inherited(g, e, pk, dt) {
  const near = r => g.ents.filter(o => o.team === 'enemy' && !o.dead && d2(o, e) < (r + o.r) ** 2);
  if (pk.blade && (e.tA = (e.tA || 0) - dt) <= 0) { e.tA = 0.4; for (const o of near(34)) damage(g, o, e.dmg * 0.5 * pk.blade, e.type, false, e.nem); }
  if (pk.nova && (e.tN = (e.tN || 0) - dt) <= 0) {
    const hit = near(70);
    if (hit.length) { e.tN = 6 / pk.nova; g.fx.push({ k: 'nova', x: e.x, y: e.y, r: 70 }); for (const o of hit) { damage(g, o, e.dmg, e.type, false, e.nem); shove(e, o); } }
  }
  if (e.legs.includes('storm') && (e.tS = (e.tS || 0) - dt) <= 0) {
    e.tS = 2; const hit = near(300);
    if (hit.length) { const o = hit[Math.floor(g.rand() * hit.length)]; g.fx.push({ k: 'bolt', pts: [{ x: o.x + 30, y: o.y - 320 }, { x: o.x, y: o.y }] }); damage(g, o, e.dmg * 2, e.type, false, e.nem); }
  }
  const w = e.wpn;
  if (w === 'flame') { if ((e.tW = (e.tW || 0) - dt) <= 0) { e.tW = 0.35; g.fires.push({ x: e.x, y: e.y, r: 16, life: 1.6 }); if (g.fires.length > 110) g.fires.shift(); } }
  else if (w === 'rod' || w === 'rang' || w === 'totem') {
    if ((e.tW = (e.tW === undefined ? 1.5 : e.tW) - dt) <= 0) {
      const tg = nearest(g, e, 'enemy', 320);
      if (w === 'totem') { e.tW = 9; if (g.totems.length < 4) g.totems.push({ x: e.x, y: e.y, life: 8, fireT: 0.3 }); }
      else if (!tg) e.tW = 0.3;
      else if (w === 'rang') { e.tW = 3 / e.haste; const b = shoot(g, e.x, e.y, Math.atan2(tg.y - e.y, tg.x - e.x), 420, e.dmg, 'ally', e.type, 99, '#9fe8ff'); b.nem = e.nem; }
      else {                                            // rod: a bolt that arcs to two more
        e.tW = 2.6 / e.haste; const pts = [{ x: e.x, y: e.y }], hit = new Set(); let o = tg, dmg = e.dmg * 1.5;
        for (let i = 0; i < 3 && o; i++) { hit.add(o); pts.push({ x: o.x, y: o.y }); damage(g, o, dmg, e.type, false, e.nem); dmg *= 0.7; let nx = null, nd = 150 * 150; for (const q of g.ents) if (q.team === 'enemy' && !q.dead && !hit.has(q)) { const dq = d2(o, q); if (dq < nd) { nd = dq; nx = q; } } o = nx; }
        g.fx.push({ k: 'bolt', pts });
      }
    }
  }
}

// The Legendary powers you used, as the boss uses them. Kept milder than yours: it has a lot of health already.
export const ZAP_T = 0.9, ZAP_R = 46;
export const GRUDGE_POWERS = {
  storm: e => { e.stormT = 3; },                                 // marks where you stand; lightning follows
  phoenix: e => { e.rise = true; },                              // rises once at 40% health
  midas: e => { e.gilded = true; },                              // some of its kin come golden
  titan: e => { e.hp = e.maxhp = e.maxhp * 1.35; },
  twin: e => { e.twin = true; },                                 // summons twice as many
};

const prizeOf = e => (e.elite ? 'elite' : e.gold ? 'gold' : null);

// A class minion (or a raised Skeleton). Not a nemesis: no rank, no perks. It returns a few seconds after it falls.
function spawnMinion(g, type, x = g.P.x + rr(g, -40, 40), y = g.P.y + rr(g, -40, 40)) {
  const k = g.allyBuff * g.minionBuff * (1 + g.t / 150);
  const e = mk(g, type, 'ally', x, y, { hpMul: 1.6 * k, dmgMul: 1.4 * k });
  e.minion = true; e.pk = {}; e.nem = null; e.shotT = 1; e.haste = g.allyHaste; e.act = 2;
  if (type === 'hawk' || type === 'drone') e.ghost = true;   // nothing can target the Hawk or the Drone
  if (type === 'skeleton') e.ttl = 15;
  if (type === 'golem') e.haste *= 0.45;                 // slow, heavy fists: it holds the line, it does not clear it
  burst(g, e.x, e.y, type === 'skeleton' ? '#f4f1e8' : '#7dffb0', 8);
  return e;
}

function spawnAlly(g, nem, lives) {
  const pk = nem.perks || {};
  const e = mk(g, nem.type, 'ally', g.P.x + rr(g, -50, 50), g.P.y + rr(g, -50, 50), {
    hpMul: (3.4 + 1.6 * nem.q) * (1 + 0.25 * (pk.tough || 0)) * g.allyBuff * (1 + g.t / 150) * (nem.evo === 'juggernaut' ? 2 : 1) * ((nem.legs || []).includes('titan') ? 2 : 1),
    dmgMul: (0.9 + 1.5 * nem.q) * (1 + 0.2 * (pk.dmg || 0)) * g.allyBuff * (1 + g.t / 150),
    spdMul: 1.2 * (1 + 0.08 * (pk.spd || 0)),
  });
  e.nem = nem; e.pk = pk; e.lives = lives; e.shotT = 1;
  e.haste = (1 + 0.2 * (pk.haste || 0)) * g.allyHaste * (nem.evo === 'ward' ? 1.5 : 1);
  e.evo = nem.evo || null;
  e.wpn = nem.weapon || null; e.legs = nem.legs || [];   // what it took from you when it killed you
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

// In the open world you could walk away from everything, so the swarm comes from where you are heading:
// half of new spawns (`share`) land ahead of you while you move, and stragglers left far behind are moved back in ahead.
const RECYCLE = 1100;
// Just off camera: an oval round the screen (wider than tall), so enemies from above and below arrive as soon as those from the sides.
const offCam = (g, a) => 1 / Math.hypot(Math.cos(a) / 530, Math.sin(a) / 350) + rr(g, 0, 70);
function aheadAngle(g, share) {
  const P = g.P;
  return P.mv && g.rand() < share ? Math.atan2(P.fy, P.fx) + rr(g, -1, 1) : g.rand() * 6.28;
}
const MAX_ENEMIES = 240;   // past this the swarm stops growing: it protects the frame rate and adds nothing to the fight
function spawnEnemy(g, ang) {
  if (g.ents.length >= MAX_ENEMIES) return;
  const pool = Object.keys(T).filter(k => g.t >= T[k].unlock);
  let r = g.rand() * pool.reduce((a, k) => a + T[k].w, 0), type = pool[0];
  for (const k of pool) { r -= T[k].w; if (r <= 0) { type = k; break; } }
  // Spawn on a ring just outside the camera, kept inside the arena.
  const a = ang ?? aheadAngle(g, 0.5), dist = offCam(g, a);
  const x = clamp(g.P.x + Math.cos(a) * dist, -30, ARENA.w + 30);
  const y = clamp(g.P.y + Math.sin(a) * dist, -30, ARENA.h + 30);
  const n = type === 'bat' ? 4 + Math.floor(g.t / 100) : type === 'slime' && g.t > 90 ? 2 : 1;
  for (let i = 0; i < n; i++) mkEnemy(g, type, x + rr(g, -20, 20), y + rr(g, -20, 20));
  // Now and then a golden one turns up: twice as tough, and it pays out when it dies.
  if (g.t > 20 && !g.boss && g.rand() < 0.035) { const e = g.ents[g.ents.length - 1]; e.gold = true; e.hp = e.maxhp = e.hp * 2.5; }
}

// The boss is a giant version of the enemy type that has killed you most.
function spawnBoss(g) {
  const d = T[g.bossType], a = g.rand() * 6.28;
  const e = mk(g, g.bossType, 'enemy', clamp(g.P.x + Math.cos(a) * 520, 60, ARENA.w - 60), clamp(g.P.y + Math.sin(a) * 520, 60, ARENA.h - 60));
  e.boss = true; e.spT = 4; e.aimT = 2; e.spd = Math.max(e.spd, 150); // never slow enough to simply walk away from
   e.r = d.r * 2.5 + 20; e.hp = e.maxhp = BOSS_HP * (1 + 1.3 * Math.sqrt(g.party.reduce((a, n) => a + n.q, 0))) * (1 + g.P.lvl * 0.02); // a stronger party faces a tougher nemesis, but by the square root so better recruits still pay off e.dmg = 30;
  e.spd = clamp(d.spd * 0.8, 70, 115); e.summonT = 3; e.ringT = 5;
  if (g.grudge) { e.name = g.grudge.name; e.powers = g.grudge.powers; for (const k of e.powers) GRUDGE_POWERS[k](e); }
  g.boss = e; g.bossAt = g.t; shake(g, 14); snd(g, 'boss'); burst(g, e.x, e.y, d.color, 40, 300);
}

const ring = (g, e, n, sp, off = g.rand() * 6.28) => {
  for (let i = 0; i < n; i++) shoot(g, e.x, e.y, off + i * 6.283 / n, sp, 22, 'enemy', e.type, 0, T[e.type].color, true);
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
  if (e.stormT !== undefined && (e.stormT -= dt) <= 0) { e.stormT = e.enraged ? 2.6 : 3.6; g.zaps.push({ x: P.x, y: P.y, t: ZAP_T }); snd(g, 'windup'); }
  e.spT -= dt;
  if (e.spT <= 0 && d2(e, P) < 560 * 560) {
    e.spT = e.enraged ? 3.2 : 5; e.wind = 0.85; e.ang = Math.atan2(P.y - e.y, P.x - e.x); e.jx = P.x; e.jy = P.y; snd(g, 'windup');
    return;
  }
  moveTo(e, P.x, P.y, dt, e.r);
  contact(g, e, 'ally');
  if (e.summonT <= 0) {
    e.summonT = 5;
    for (let i = 0; i < (e.type === 'bat' ? 6 : 3) * (e.twin ? 2 : 1); i++) {
      mkEnemy(g, e.type, e.x + rr(g, -60, 60), e.y + rr(g, -60, 60));
      const s = g.ents[g.ents.length - 1]; if (e.gilded && g.rand() < 0.25 && !s.gold) { s.gold = true; s.hp = s.maxhp = s.hp * 2.5; }
    }
  }
  if (e.ringT <= 0) { e.ringT = 3.5; snd(g, 'ring'); ring(g, e, e.enraged ? 26 : 18, e.enraged ? 250 : 215); }
  // Between rings it fires aimed bursts, so standing still is never safe.
  e.aimT -= dt;
  if (e.aimT <= 0) {
    e.aimT = e.enraged ? 0.8 : 1.3;
    const a = Math.atan2(P.y - e.y, P.x - e.x), n = e.enraged ? 5 : 3;
    for (let i = 0; i < n; i++) shoot(g, e.x, e.y, a + (i - (n - 1) / 2) * 0.14, 320, 22, 'enemy', e.type, 0, T[e.type].color, true);
  }
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
    if (e.dead || e.team !== team || e === o || e.ghost) continue;
    const d = d2(o, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const TURN = 3; // enemy turn rate, radians per second
function moveTo(e, x, y, dt, stop = 0) {
  if (FLOW && !e.boss && !e.isP && !(T[e.type] && T[e.type].fly) && (x - FLOW.sx) ** 2 + (y - FLOW.sy) ** 2 < 200 * 200
      && (x - e.x) ** 2 + (y - e.y) ** 2 > 60 * 60 && !clearLine(FLOW, e.x, e.y, x, y)) {
    const w = flowStep(FLOW, e.x, e.y); if (w) { x = w.x; y = w.y; stop = 0; }
  }
  const dx = x - e.x, dy = y - e.y, l = Math.hypot(dx, dy);
  if (l <= stop || l <= 0.1) return;
  const want = Math.atan2(dy, dx);
  // Enemies steer instead of snapping onto you, so a sharp turn shakes them off. Up close they turn freely.
  if (e.team === 'enemy' && !e.boss && l > 90) {
    const diff = Math.atan2(Math.sin(want - e.ang), Math.cos(want - e.ang));
    e.ang += clamp(diff, -TURN * dt, TURN * dt);
  } else e.ang = want;
  const spd = e.spd * (e.slowT > 0 ? e.slowK : 1) * (e.boss && e.team === 'enemy' ? (l > 450 ? 1.7 : l > 250 ? 1.45 : 1) : 1);   // the boss closes in: open ground must not let you circle it forever
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
    b.nem = e.nem; if (e.pk && e.pk.chain) b.chain = e.pk.chain;
    if (e.type === 'imp') { b.burn = true; b.color = '#ff7a2f'; }   // the Imp's fireballs set things alight
    // Job: an Archer nemesis slows whatever it hits.
    if (e.team === 'ally' && e.type === 'archer') { b.slowT = (e.evo === 'frost' ? 4 : 2) * jobK(e); b.slowK = e.evo === 'frost' ? 0.3 : 0.55; }
  }
}

const targetsOf = (g, team) => team === 'ally'
  ? [g.P, ...g.ents.filter(e => e.team === 'ally' && !e.dead && !e.ghost)]
  : g.ents.filter(e => e.team === 'enemy' && !e.dead);

function contact(g, e, foe) {
  if (e.cd > 0) return;
  for (const o of targetsOf(g, foe)) {
    const r = e.r + o.r + 2;
    if (d2(e, o) < r * r) {
      const hurtAt = g.P.hurtAt;
      if (o === g.P) g.hitBy = prizeOf(e);
      damage(g, o, e.dmg * (e.nem ? allyCrit(g, e.pk) : 1), e.type, e.boss, e.nem); e.cd = (e.team === 'ally' ? 0.45 : 0.6) / e.haste;
      if (e.wpn === 'sword') for (const q of targetsOf(g, foe)) if (q !== o && !q.dead && d2(e, q) < (46 + q.r) ** 2) damage(g, q, e.dmg * 0.5, e.type, false, e.nem);   // took your Greatsword: it cleaves
      if (o === g.P && g.P.charm === 'thorn' && g.P.hurtAt !== hurtAt && !e.boss) { damage(g, e, g.P.dmg * 2.5, 'player'); shove(g.P, e); }   // Thorn Mail
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
  const k = jobK(e); o.x += dx / l * 46 * k; o.y += dy / l * 46 * k; o.stun = 0.6 * k;
}

// What each class minion does that nothing else does. Returns true when it has handled the whole turn.
function minionThink(g, e, dt) {
  const P = g.P;
  if (e.type === 'squire') {
    // Stays close to you. Every few seconds, bashes the nearest enemy in reach: damage, knockback, stun.
    if (e.act <= 0) {
      const tg = nearest(g, e, 'enemy', 70);
      if (tg) { e.act = 4 / e.haste; damage(g, tg, e.dmg * 2.5, e.type); shove(e, tg); shove(e, tg); tg.stun = Math.max(tg.stun || 0, 1.4); burst(g, tg.x, tg.y, '#2ce8f5', 8, 160); snd(g, 'thud'); }
    }
    if (d2(e, P) > 120 * 120) { moveTo(e, P.x, P.y, dt); return true; }   // never strays far
    return false;                                       // otherwise fights like any melee ally
  }
  if (e.type === 'hawk') {
    // Circles overhead, then dives at the toughest enemy around and marks it for 6 seconds.
    let tg = null, best = 0;
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, P) < 520 * 520) { const v = o.maxhp * (o.mark > g.t ? 0.4 : 1); if (v > best) { best = v; tg = o; } }
    if (tg && e.act <= 0) {
      moveTo(e, tg.x, tg.y, dt);
      if (d2(e, tg) < (e.r + tg.r + 6) ** 2) { damage(g, tg, e.dmg, e.type); if (!tg.dead) tg.mark = g.t + 5; e.act = 2.6 / e.haste; burst(g, tg.x, tg.y, '#feae34', 6, 140); }
    } else {
      e.orb = (e.orb || 0) + dt * 2.4;
      moveTo(e, P.x + Math.cos(e.orb) * 90, P.y + Math.sin(e.orb) * 70 - 20, dt);
    }
    return true;
  }
  if (e.type === 'wolf') {
    // Fights like any melee ally. Every 9 seconds, if enemies are near you, it howls and you go into a short frenzy.
    if (e.act <= 0 && nearest(g, P, 'enemy', 260)) { e.act = 9 / e.haste; g.frenzyT = Math.max(g.frenzyT, 2.5); g.fx.push({ k: 'nova', x: e.x, y: e.y, r: 60 }); burst(g, e.x, e.y, '#c9c4b8', 8, 140); snd(g, 'windup'); }
    return false;
  }
  if (e.type === 'drone') {
    // Circles you and shoots the nearest enemy.
    e.orb = (e.orb || 0) + dt * 2;
    moveTo(e, P.x + Math.cos(e.orb) * 54, P.y + Math.sin(e.orb) * 40 - 16, dt);
    // Every 3s it shocks whatever crowds you: thrown back and stunned for a moment.
    if ((e.zapT = (e.zapT === undefined ? 1.5 + g.ents.indexOf(e) % 2 * 1.5 : e.zapT) - dt) <= 0) {
      const near = g.ents.filter(o => o.team === 'enemy' && !o.dead && !o.boss && d2(o, P) < 90 * 90);
      if (near.length) { e.zapT = 3; g.fx.push({ k: 'nova', x: P.x, y: P.y, r: 90 }); snd(g, 'thud'); for (const o of near) { shove(P, o); o.stun = Math.max(o.stun || 0, 0.6); } } else e.zapT = 0.3;
    }
    if (e.act <= 0) { const tg = nearest(g, e, 'enemy', 360); if (tg) { e.act = 0.65 / e.haste; shoot(g, e.x, e.y, Math.atan2(tg.y - e.y, tg.x - e.x), 480, Math.max(e.dmg, g.P.dmg * 0.8), 'ally', 'player', 0, '#9fe8ff'); } }   // grows with your damage
    return true;
  }
  if (e.type === 'golem') {
    // Every 6 seconds it slams the ground: damage and a stun for everything close, and for 2.5 seconds after,
    // walking enemies nearby go for the Golem instead of you (see taunter).
    if (e.act <= 0 && nearest(g, e, 'enemy', 90)) {
      e.act = 6; e.tauntT = g.t + 2.5; g.fx.push({ k: 'nova', x: e.x, y: e.y, r: 95 }); shake(g, 6); snd(g, 'thud');
      for (const o of g.ents) if (o.team === 'enemy' && !o.dead && !o.boss && d2(o, e) < (95 + o.r) ** 2) o.stun = Math.max(o.stun || 0, 1);
    }
    if (d2(e, P) > 130 * 130) { moveTo(e, P.x, P.y, dt); return true; }   // stays by your side
    return false;
  }
  return false;                                         // imp and skeleton use the normal ranged and melee behaviour
}

// Job: a Slime nemesis draws walking enemies onto itself.
function taunter(g, e) {
  if (T[e.type].fly || T[e.type].ranged) return null;
  for (const o of g.ents) if (o.team === 'ally' && (o.type === 'slime' || (o.type === 'golem' && o.tauntT > g.t)) && !o.small && !o.dead && d2(e, o) < (150 * jobK(o)) ** 2) return o;
  return null;
}

function think(g, e, dt) {
  if (e.boss) return bossThink(g, e, dt);
  const d = T[e.type], foe = e.team === 'enemy' ? 'ally' : 'enemy', ally = e.team === 'ally', P = g.P;
  if (!ally && d2(e, P) > RECYCLE * RECYCLE) {          // left far behind: back in, just off camera, ahead of you
    const a = aheadAngle(g, 1), r = offCam(g, a);
    e.x = clamp(P.x + Math.cos(a) * r, 20, ARENA.w - 20); e.y = clamp(P.y + Math.sin(a) * r, 20, ARENA.h - 20); e.ang = a + Math.PI;
  }
  e.cd -= dt; e.flash -= dt; e.act -= dt;
  if (e.slowT > 0) e.slowT -= dt;
  if (e.rootT > 0) e.rootT -= dt;
  if (e.fireT > 0) {                                    // burning: damage twice a second
    e.fireT -= dt; e.fireTick = (e.fireTick || 0) - dt;
    if (e.fireTick <= 0) { e.fireTick = 0.5; damage(g, e, e.fireD, 'burn'); if (e.dead) return; }
  }
  if (e.ttl > 0 && (e.ttl -= dt) <= 0) { e.dead = true; boneBlast(g, e); return; }   // a raised Skeleton crumbles, and goes off like a bomb
  if (e.minion && minionThink(g, e, dt)) return;
  if (e.stun > 0) { e.stun -= dt; return; }
  // Job: Bat nemeses fetch gems. Any gem they pass flies to you.
  if (ally && e.type === 'bat') { const r = 80 * jobK(e); for (const gem of g.gems) if (!gem.pull && d2(e, gem) < r * r) gem.pull = true; }
  const pk = ally ? e.pk || {} : null;
  if (pk) {
    if (e.rallyT > 0 && (e.rallyT -= dt) <= 0) e.haste /= 1.5;
    if (e.nem) inherited(g, e, pk, dt);
    if (g.allyRegen) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * g.allyRegen * dt);
    if (pk.regen) e.hp = Math.min(e.maxhp, e.hp + pk.regen * dt);
    // Inherited shots: a melee nemesis that took your Split Shot or Piercing also shoots.
    if (!d.ranged && (pk.shots || pk.pierce || e.wpn === 'blaster')) {
      e.shotT -= dt;
      if (e.shotT <= 0) {
        const st = nearest(g, e, 'enemy', 380);
        if (st) { e.shotT = 1.5 / e.haste; volley(g, e, st, Math.max(1, pk.shots || 0), 380, e.dmg * 0.6 * allyCrit(g, pk), pk.pierce || 0); }
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
  const tg = ally ? nearest(g, e, foe, 460) : ((g.decoy && d2(e, g.decoy) < 260 * 260 && g.decoy) || taunter(g, e) || nearest(g, e, foe, 110) || P);
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
      if (e.aim <= 0) { const sb = shoot(g, e.x, e.y, e.aimAng, 300, e.dmg, 'enemy', e.type, 0, d.color); sb.prize = prizeOf(e); e.act = 1.3; }
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
      for (const k of rocksNear(g, e.x, e.y)) if (gapTo(k, e.x, e.y) < e.r) { e.dash = 0; e.stun = 1.5; burst(g, e.x, e.y, '#8a8aa0', 10, 160); shake(g, 5); snd(g, 'thud'); break; }
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
    if (g.ultT > 0 && g.cls === 'knight') return;       // Bulwark: nothing gets through
    if (g.cls === 'knight' && g.blockT <= 0) { g.blockT = 10; P.inv = 0.3; burst(g, P.x, P.y, '#2ce8f5', 10, 180); g.fx.push({ k: 'block' }); snd(g, 'thud'); return; }   // the Knight's shield takes one hit every 8 seconds
    amt *= g.armor;
    if (P.dodge > 0 && g.rand() < P.dodge) { P.inv = 0.25; burst(g, P.x, P.y, '#c0f4ff', 6, 120); return; }   // Evasion
    if (P.shield > 0) { P.shield--; P.inv = 0.4; burst(g, P.x, P.y, '#9fe8ff', 10, 160); snd(g, 'thud'); return; }   // Bubble
    P.hp -= amt; P.inv = 0.25; P.flash = 0.15; shake(g, 8); snd(g, 'hurt'); P.hurtAt = g.t;
    if (P.charm === 'after' && !g.decoy && g.afterT <= g.t) { g.afterT = g.t + 6; g.decoy = { x: P.x, y: P.y, r: P.r, life: 1.5 }; }
    if (P.hp <= 0 && g.phoenix) { g.phoenix = false; P.hp = P.maxhp * 0.5; P.inv = 1.5; blast(g, 220, 3); snd(g, 'level'); return; }   // Phoenix
    if (P.hp <= 0 && P.charm === 'hour' && !g.hourUsed) {      // Hourglass: one rewind per run
      g.hourUsed = true; P.hp = P.maxhp * 0.3; P.inv = 1.5; blast(g, 190, 2); snd(g, 'slowmo'); return;
    }
    if (P.hp <= 0) { P.hp = 0; die(g, src, byBoss); }
    return;
  }
  // Job: a Slime nemesis is a shield. It shrugs off 40% of damage (70% as a Bulwark).
  if (o.team === 'ally') amt *= g.allyArmor * (o.pk && o.pk.armor ? 0.9 ** o.pk.armor : 1);
  if (by && o.team === 'enemy') {                        // a nemesis hitting with powers it took from you
    const k = by.perks || {};
    if (k.frost && !o.boss) { o.slowT = Math.max(o.slowT || 0, 1.2 + 0.6 * k.frost); o.slowK = 0.65; }
    if (k.ember) { o.fireT = 3; o.fireD = Math.max(o.fireD || 0, amt * 0.2 * k.ember / 6); }
    if ((by.legs || []).includes('midas')) o.midas = true;
  }
  if (o.mark > g.t) amt *= 1.2;                          // marked by the Hawk
  if (src === 'player' && g.cls === 'berserker' && g.ultT > 0) amt *= 1.25;                   // Blood Rage
  if (src === 'player' && g.cls === 'berserker') amt *= 1 + 0.6 * (1 - g.P.hp / g.P.maxhp);   // Berserker: hurt means angry
  if (src === 'player' && o.team === 'enemy') {
    const P = g.P;
    if (P.exec && o.hp < o.maxhp * 0.34) amt *= 1 + P.exec * (g.pairs.edge ? 1.5 : 1);          // Executioner (Killing Edge: half again)
    if (g.pairs.steam && o.slowT > 0 && o.fireT > 0) amt *= 1.2;                                // Steam
    if (P.frost && !o.boss) { o.slowT = Math.max(o.slowT || 0, 1.2 + 0.6 * P.frost); o.slowK = 0.65; }   // Frostbite
    if (P.ember) { o.fireT = 3; o.fireD = Math.max(o.fireD || 0, amt * 0.2 * P.ember / 6); }   // Wildfire: a share of the hit, over 6 ticks
  }
  if (o.team === 'ally' && o.type === 'slime') amt *= o.evo === 'bulwark' ? 0.3 : 0.6;
  o.hp -= amt; o.flash = 0.08;
  if (o.team === 'enemy' && amt >= 1) g.fx.push({ k: 'num', x: o.x, y: o.y - o.r, v: amt });
  if (o.hp <= 0 && !o.dead) {
    if (by && o.team === 'enemy') by.kills = (by.kills || 0) + 1; // credited to the nemesis; turns into XP after the run
    kill(g, o);
  }
}

// An ally that falls comes back while it has lives left, then is gone for the run.
// A Skeleton that falls explodes: bones everywhere, damage to every enemy close by.
function boneBlast(g, e) {
  burst(g, e.x, e.y, '#f4f1e8', 26, 260); g.fx.push({ k: 'nova', x: e.x, y: e.y, r: 56 });
  for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, e) < (56 + o.r) ** 2) damage(g, o, g.P.dmg * 0.65, 'player');
}

function allyDown(g, e, delay, free = false) {
  if (e.small) return;
  if (e.type === 'skeleton') boneBlast(g, e);
  if (e.minion) { if (e.type !== 'skeleton') g.respawnQ.push({ minion: e.type, at: g.t + 8 }); return; }
  // A nemesis is never gone for good. Each time it falls it takes a little longer to return (5s, then +3s a fall,
  // at most 20s). A Bomber blowing itself up (free) does not count as a fall.
  const nem = e.nem;
  if (!free && (nem.legs || []).includes('phoenix') && !nem.rose) { nem.rose = true; free = true; delay = 0.6; burst(g, e.x, e.y, '#feae34', 20, 220); }   // took your Phoenix
  if (!free) { delay = Math.min(20, 5 + 3 * (nem.downs || 0)); nem.downs = (nem.downs || 0) + 1; }
  if (g.P.charm === 'banner') delay *= 0.5;
  g.respawnQ.push({ nem, lives: e.lives, at: g.t + delay * g.respawnMul });
}

function kill(g, e) {
  if (e.boss && e.rise) {                            // Phoenix, learned from you: it gets back up once
    e.rise = false; e.hp = e.maxhp * 0.4; ring(g, e, 24, 240); shake(g, 16); burst(g, e.x, e.y, '#ffd34d', 50, 360); snd(g, 'boss'); g.fx.push({ k: 'nova', x: e.x, y: e.y, r: 160 }); return;
  }
  e.dead = true; burst(g, e.x, e.y, T[e.type].color, e.team === 'enemy' ? 10 : 6);
  snd(g, e.boss ? 'win' : e.team === 'enemy' ? 'kill' : 'allyDown');
  if (e.boss) { dropGear(g); g.state = 'won'; g.boss = null; burst(g, e.x, e.y, '#fff', 60, 400); shake(g, 20); return; }
  if (T[e.type].split && !e.small) for (let i = 0; i < (e.evo === 'mother' ? 4 : 2); i++) {
    mk(g, 'slime', e.team, e.x + rr(g, -8, 8), e.y + rr(g, -8, 8), { small: true, hpMul: e.hpMul, dmgMul: e.dmgMul });
  }
  if (e.team === 'enemy') {
    // Kill streak: kills in quick succession build a count; it lapses after 2.5 seconds without one.
    g.streak++; g.streakT = 2.5; if (g.streak > g.bestStreak) g.bestStreak = g.streak;
    if ([10, 25, 50, 100, 150, 200, 300].includes(g.streak)) { g.fx.push({ k: 'streak', n: g.streak }); g.bonusSouls += Math.round(g.streak / 10); snd(g, 'streak'); }
    g.killsBy[e.type] = (g.killsBy[e.type] || 0) + 1; if (e.elite) g.elites++;
    g.fx.push({ k: 'die', x: e.x, y: e.y, t: e.type, s: e.r / T[e.type].r, a: e.ang });
    if (e.gold) { g.bonusSouls += 5; g.fx.push({ k: 'gold', x: e.x, y: e.y }); snd(g, 'power'); for (let i = 0; i < 3; i++) g.gems.push({ x: e.x + rr(g, -14, 14), y: e.y + rr(g, -14, 14), v: 5 }); }
  }
  if (e.team === 'enemy') { g.kills++; g.gems.push({ x: e.x, y: e.y, v: (e.small ? 1 : T[e.type].xp) * (e.midas ? 2 : 1) }); if (e.elite) g.chests.push({ x: e.x, y: e.y });
    // Necromancer: every 12th kill gets back up as a Skeleton, on your side, for a while.
    // Ultimate charge: every kill fills it; each use makes the next one cost a little more.
    if (g.cls && g.ultT <= 0) g.ult = Math.min(1, g.ult + (e.elite ? 5 : 1) / (50 + 12 * Math.min(6, g.ultN)));
    if (g.cls === 'berserker' && g.ultT > 0) g.P.hp = Math.min(g.P.maxhp, g.P.hp + 0.3);   // a little back per kill; a full heal every ultimate made the class unkillable
    if (g.cls === 'necro' && ++g.raiseC >= 9 && g.ents.filter(x => x.type === 'skeleton' && !x.dead).length < 6) { g.raiseC = 0; spawnMinion(g, 'skeleton', e.x, e.y); }
    if (g.P.leech && (g.leechC += g.P.leech) >= 10) { g.leechC -= 10; g.P.hp = Math.min(g.P.maxhp, g.P.hp + 1); }   // Leech
    if (g.P.charm === 'fang' && g.kills % 25 === 0) g.P.hp = Math.min(g.P.maxhp, g.P.hp + 5);
    // Power-ups: always from an elite, rarely from anything else.
    if (e.elite || (!e.small && !g.boss && g.rand() < (g.cls === 'engineer' ? 0.012 : 0.005))) dropPowerup(g, e.x + (e.elite ? 26 : 0), e.y); }
  else allyDown(g, e, 6);
}

function explode(g, e) {
  if (e.dead) return; e.dead = true;
  burst(g, e.x, e.y, '#ff3b5c', 26, 260); burst(g, e.x, e.y, '#ffd23f', 14, 180); shake(g, 10); snd(g, 'boom');
  const foe = e.team === 'enemy' ? 'ally' : 'enemy';
  const reach = e.evo === 'cluster' ? 110 : 70;
  if (e.team === 'enemy') g.hitBy = prizeOf(e);
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
    // It takes the weapon you died holding and any Legendary powers you had, as well as your upgrades.
    weapon: g.P.weapon, legs: Object.keys(LEG_TRAIT).filter(k => g.picks[k]),
    prize: g.hitBy || null,                              // it was an elite or a golden one: a prize recruit
    type, perks, q: recruitQuality(g.t, g.P.lvl, byBoss, g.hitBy),
    name: NAME_A[Math.floor(g.rand() * NAME_A.length)] + NAME_B[Math.floor(g.rand() * NAME_B.length)],
    title: top ? PERKS[top].title : 'the Unproven',
  };
}

function die(g, src, byBoss) {
  g.state = 'dead'; g.killer = src; g.recruit = makeRecruit(g, src, byBoss);
  burst(g, g.P.x, g.P.y, '#fff', 40, 300); shake(g, 16); snd(g, 'die');
}

// Experience needed for the next level, from the current requirement. Phase 22 tunes the pace.
export const XP_START = 5, XP_STEP = 26;               // grows x1.22 early, then never more than +26 a level: a steady beat to the boss
export const nextXp = n => Math.floor(Math.min(n * 1.22 + 3, n + XP_STEP));
// How many more level-ups the experience you hold already covers (shown as "+2 MORE").
export function pendingLevels(g) { let x = g.P.xp, n = g.P.next, c = 0; while (x >= n && c < 9) { x -= n; n = nextXp(n); c++; } return c; }
function levelUp(g) {
  const P = g.P;
  P.xp -= P.next; P.lvl++; P.next = nextXp(P.next);
  g.state = 'lvl'; snd(g, 'level');
  rollChoices(g);
}

// Three different upgrades, at most one of them for your nemeses.
// g.choices[i] is the upgrade, g.rar[i] its rarity. Chests never roll Common and are luckier.
function rollRarity(g) {
  const w = g.chest ? { common: 0, rare: 50, epic: 38, legendary: 12 } : { common: RARITY.common.w, rare: RARITY.rare.w * g.luck, epic: RARITY.epic.w * g.luck, legendary: RARITY.legendary.w * g.luck };
  let r = g.rand() * RARITIES.reduce((a, id) => a + w[id], 0);
  for (const id of RARITIES) { r -= w[id]; if (r <= 0) return id; }
  return 'common';
}
// Phase 20: ranks cap at 5; once six different upgrades are held only those are offered (so a build narrows
// toward what you chose); upgrades you hold and ones your weapon reads differently come up more often;
// banished ones never return this run; four level-ups in a row with nothing Rare or better force a Rare.
// ---------- evolutions and pairs (Phase 21) ----------
const EVO_F = {
  gatling: P => { P.fire /= 1.35; P.multi += 1; }, kingsblade: P => { P.pierce += 2; },
  moonblade: P => { P.multi += 1; P.pierce += 1; P.dmg *= 1.15; }, hellfire: P => { P.multi += 1; P.pierce += 2; P.dmg *= 1.25; },
  tempest: P => { P.multi += 1; P.dmg *= 1.3; }, watchtower: P => { P.multi += 1; P.pierce += 2; P.fire /= 1.25; },
};
// The evolution as a card: always Legendary, one per run.
export const evoCard = w => { const ev = WEAPON_EVOS[w]; return ev && { id: ev.id, n: ev.n, ic: 'i_' + w, evo: true, fixed: 'legendary', d: () => ev.d, f: g => { g.P.evo = ev.id; EVO_F[ev.id](g.P); g.fx.push({ k: 'evo', n: ev.n }); snd(g, 'legendary'); } }; };
export const evoReady = g => { const ev = WEAPON_EVOS[g.P.weapon]; return !!ev && !g.P.evo && (g.picks[ev.need] || 0) >= MAX_RANK; };
const PAIR_F = {
  steam: () => {}, thirst: () => {}, edge: () => {},
  jugg: g => { const v = Math.round(g.P.maxhp * 0.2); g.P.maxhp += v; g.P.hp = Math.min(g.P.maxhp, g.P.hp + v); },
  warband: g => { for (const id of ['rally', 'pack']) UP.find(u => u.id === id).f(g, 1); },
  engine: g => { g.P.cdMul *= 0.8; g.xpMul *= 1.15; },
};
function checkPairs(g) {
  for (const p of PAIRS) if (!g.pairs[p.id] && g.picks[p.a] && g.picks[p.b]) { g.pairs[p.id] = true; PAIR_F[p.id](g); g.fx.push({ k: 'pair', n: p.n }); snd(g, 'rare'); }
}

export const heldCount = g => UP.filter(u => !u.leg && g.picks[u.id]).length;
function rollChoices(g, keep = false) {
  const no = WEAPONS[g.P.weapon].no || [], hasAllies = g.party.length > 0 || !!g.cls, wup = WEAPONS[g.P.weapon].up || {};
  const ok = u => (!u.ally || hasAllies) && (!u.minion || g.cls) && !no.includes(u.id) && !g.banned.has(u.id);
  const full = heldCount(g) >= UP_SLOTS;
  const pool = UP.filter(u => !u.leg && ok(u) && (g.picks[u.id] || 0) < MAX_RANK && (!full || g.picks[u.id])), legs = UP.filter(u => u.leg && ok(u) && !g.picks[u.id]);
  const wt = pool.map(u => (g.picks[u.id] ? 2.2 : 1) * (wup[u.id] ? 1.5 : 1)), sum = wt.reduce((a, b) => a + b, 0);
  const draw = () => { let r = g.rand() * sum; for (let i = 0; i < pool.length; i++) if ((r -= wt[i]) <= 0) return pool[i]; return pool[pool.length - 1]; };
  if (!keep) { g.choices = []; g.rar = []; }
  for (let tries = 0; g.choices.length < 3 && tries < 200; tries++) {
    let rar = rollRarity(g), u;
    // A Legendary roll is usually one of the one-of-a-kind powers, while any are left.
    if (rar === 'legendary' && legs.length && g.rand() < 0.7) u = legs[Math.floor(g.rand() * legs.length)];
    else if (pool.length) u = draw(); else break;
    if (g.choices.includes(u) || (u.ally && g.choices.some(c => c.ally))) continue;
    if (u.fixed) rar = u.fixed;
    g.choices.push(u); g.rar.push(rar);
  }
  for (const f of FILLERS) if (g.choices.length < 3) { g.choices.push(f); g.rar.push('common'); }   // nothing left to offer
  if (keep) return;
  if (g.chest && g.t >= EVO_TIME && evoReady(g)) { g.choices[0] = evoCard(g.P.weapon); g.rar[0] = 'legendary'; }   // the weapon is ready to evolve
  if (g.rar.some(r => r !== 'common')) g.dry = 0;
  else if (++g.dry >= 4) { const i = g.choices.findIndex(u => !u.filler && !u.fixed); if (i >= 0) { g.rar[i] = 'rare'; g.dry = 0; } }
}
// Banish the card at i: it never comes back this run, and a new card takes its place.
export function banish(g, i) {
  const u = g.choices[i];
  if (g.state !== 'lvl' || g.banishes <= 0 || !u || u.filler || u.leg) return false;
  g.banishes--; g.banned.add(u.id); g.choices.splice(i, 1); const rar = g.rar.splice(i, 1);
  rollChoices(g, true);
  g.choices.splice(i, 0, g.choices.pop()); g.rar.splice(i, 0, g.rar.pop());
  return true;
}

// ---------- weapons ----------
const hitDmg = (g, base) => base * (g.P.crit > 0 && g.rand() < 0.15 * g.P.crit ? 3 : 1);
// Chain Shot for weapons without bullets: a spark jumps from (x, y) to the nearest enemy not yet hit.
function spark(g, x, y, hit, dmg, n) {
  if (n <= 0) return;
  let nx = null, nd = 190 * 190;
  for (const q of g.ents) if (q.team === 'enemy' && !q.dead && !hit.has(q)) { const dq = (q.x - x) ** 2 + (q.y - y) ** 2; if (dq < nd) { nd = dq; nx = q; } }
  if (!nx) return;
  const c = shoot(g, x, y, Math.atan2(nx.y - y, nx.x - x), 540, dmg * 0.7, 'ally', 'player', 0, '#9fe8ff'); c.chain = n - 1; c.hit = new Set(hit);
}

function fireWeapon(g, dt) {
  const P = g.P, w = P.weapon;
  if (w === 'flame') {
    // Flamewalker: fire where you walk (and a small patch under you while standing).
    P.trailT -= P.moved > 0.5 ? dt : dt * 0.35;
    if (P.trailT <= 0) {
      P.trailT = 0.085; g.fires.push({ x: P.x, y: P.y, r: 20 + 8 * (P.multi - 1), life: 2.2 + 0.9 * P.pierce });
      if (g.fires.length > 110) g.fires.shift();
    }
  } else if (w === 'totem') {
    // Totem: drop one where you stand every few seconds; each shoots on its own.
    P.totemT -= dt;
    if (P.totemT <= 0 && g.totems.length < 1 + P.multi) { P.totemT = 3.8; g.totems.push({ x: P.x, y: P.y, life: 12 + 5 * P.pierce, fireT: 0.3 }); snd(g, 'thud'); }
    else if (P.totemT <= 0 && g.totems.length) { P.totemT = 3.8; const o = g.totems.reduce((a, b) => (b.life < a.life ? b : a)); o.x = P.x; o.y = P.y; o.life = 12 + 5 * P.pierce; }
  } else if (P.fireT <= 0) {
    if (w === 'sword') {
      const reach = 96 + 20 * P.pierce, tg = nearest(g, P, 'enemy', reach + 30);
      if (tg) {
        P.fireT = P.fire * 1.6; snd(g, 'sweep');
        const a = Math.atan2(tg.y - P.y, tg.x - P.x), half = P.multi >= 3 ? Math.PI : 1.25, hit = new Set();
        for (const back of P.multi === 2 ? [0, Math.PI] : [0]) {
          g.fx.push({ k: 'sweep', x: P.x, y: P.y, a: a + back, r: reach, half, evo: !!P.evo });
          for (const o of g.ents) if (o.team === 'enemy' && !o.dead && !hit.has(o) && d2(o, P) < (reach + o.r) ** 2) {
            const da = Math.atan2(Math.sin(Math.atan2(o.y - P.y, o.x - P.x) - a - back), Math.cos(Math.atan2(o.y - P.y, o.x - P.x) - a - back));
            if (Math.abs(da) <= half) { hit.add(o); damage(g, o, hitDmg(g, P.dmg * 2.1 * (1 + 0.15 * Math.max(0, P.multi - 3))), 'player'); shove(P, o); }
          }
        }
        if (hit.size) spark(g, tg.x, tg.y, hit, P.dmg * 2, P.chain);
        if (P.evo === 'kingsblade') P.hp = Math.min(P.maxhp, P.hp + Math.min(6, hit.size));
      }
    } else if (w === 'rang') {
      const tg = g.rangs.length < P.multi ? nearest(g, P, 'enemy', 440) : null;
      if (tg) {
        P.fireT = P.fire * 1.3; snd(g, 'shoot');
        const a = Math.atan2(tg.y - P.y, tg.x - P.x) + (g.rangs.length - (P.multi - 1) / 2) * 0.35;
        g.rangs.push({ x: P.x, y: P.y, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, out: 0.55, r: 15 + 6 * P.pierce, hit: new Set(), chained: false });
      }
    } else if (w === 'rod') {
      let tg = nearest(g, P, 'enemy', 430);
      if (tg) {
        P.fireT = P.fire * 2.6; snd(g, 'bolt');
        const pts = [{ x: P.x, y: P.y }], hit = new Set(), jump = 150 + 45 * P.pierce;
        let dmg = hitDmg(g, P.dmg * 1.5), arcs = 2 + 2 * (P.multi - 1) + P.chain;
        while (tg) {
          hit.add(tg); pts.push({ x: tg.x, y: tg.y }); damage(g, tg, dmg, 'player'); dmg *= 0.7;
          if (arcs-- <= 0) break;
          let nx = null, nd = jump * jump;
          for (const q of g.ents) if (q.team === 'enemy' && !q.dead && !hit.has(q)) { const dq = d2(tg, q); if (dq < nd) { nd = dq; nx = q; } }
          tg = nx;
        }
        g.fx.push({ k: 'bolt', pts });
      }
    } else {                                            // blaster
      const tg = nearest(g, P, 'enemy', 520);
      if (tg) {
        P.fireT = P.fire; const a = Math.atan2(tg.y - P.y, tg.x - P.x); snd(g, 'shoot');
        const power = g.cls === 'ranger' && ++g.shotN % 7 === 0;      // the Ranger's every seventh volley is a power shot
        if (power) snd(g, 'bolt');
        for (let i = 0; i < P.multi; i++) {
          const crit = power || (P.crit > 0 && g.rand() < 0.15 * P.crit);
          const b = shoot(g, P.x, P.y, a + (i - (P.multi - 1) / 2) * 0.16, power ? 700 : 540, P.dmg * (crit ? 3 : 1), 'ally', 'player', power ? 99 : P.pierce, crit ? '#ffd23f' : '#fff');
          b.chain = P.chain;
        }
      }
    }
  }
  // Things weapons leave in the world.
  const tick = 0.3 * P.fire / 0.42;
  if (g.fires.length) {
    for (const f of g.fires) f.life -= dt;
    g.fires = g.fires.filter(f => f.life > 0);
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && (o.burnT || 0) <= g.t) {
      for (const f of g.fires) if ((o.x - f.x) ** 2 + (o.y - f.y) ** 2 < (f.r + o.r) ** 2) { o.burnT = g.t + tick; damage(g, o, hitDmg(g, P.dmg * 0.62), 'player'); break; }
    }
  }
  for (const r of g.rangs) {
    if (r.out > 0) { r.out -= dt; if (r.out <= 0) r.hit = new Set(); }
    else {                                              // coming back: steer to the player
      const a = Math.atan2(P.y - r.y, P.x - r.x); r.vx = Math.cos(a) * 500; r.vy = Math.sin(a) * 500;
      if (d2(r, P) < 26 * 26) { r.done = true; P.fireT = Math.min(P.fireT, P.fire * 0.45); }
    }
    r.x += r.vx * dt; r.y += r.vy * dt;
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && !r.hit.has(o) && d2(o, r) < (r.r + o.r) ** 2) {
      r.hit.add(o); damage(g, o, hitDmg(g, P.dmg * 1.35), 'player');
      if (!r.chained && P.chain) { r.chained = true; spark(g, o.x, o.y, new Set([o]), P.dmg * 1.35, P.chain); }
    }
  }
  if (g.rangs.length) g.rangs = g.rangs.filter(r => !r.done);
  for (const t of g.totems) {
    t.life -= dt; t.fireT -= dt;
    if (t.fireT <= 0) {
      const tg = nearest(g, t, 'enemy', 400);
      if (tg) { t.fireT = P.fire * 1.0; const b = shoot(g, t.x, t.y, Math.atan2(tg.y - t.y, tg.x - t.x), 520, hitDmg(g, P.dmg), 'ally', 'player', 0, '#ffd23f'); b.chain = P.chain; }
    }
  }
  if (g.totems.length) g.totems = g.totems.filter(t => t.life > 0);
  // The boss's lightning (learned from your Thunderstorm): marked where you stood, strikes a moment later.
  for (const z of g.zaps) if ((z.t -= dt) <= 0) {
    g.fx.push({ k: 'bolt', pts: [{ x: z.x + 30, y: z.y - 320 }, { x: z.x, y: z.y }] }); snd(g, 'ring');
    if (d2(z, P) < (ZAP_R + P.r) ** 2) damage(g, P, 24, g.bossType, true);
  }
  if (g.zaps.length) g.zaps = g.zaps.filter(z => z.t > 0);
}

// ---------- power-ups ----------
export const EMBER_R = 72, PICKUP_LIFE = 12;
function dropPowerup(g, x, y) {
  const kinds = Object.keys(POWERUPS).filter(k => k !== 'giant' || g.party.length);   // Giant needs nemeses
  g.pickups.push({ x: clamp(x, 20, ARENA.w - 20), y: clamp(y, 20, ARENA.h - 20), k: kinds[Math.floor(g.rand() * kinds.length)], life: PICKUP_LIFE });
}
// A blast around the player: damage, knockback, stun.
function blast(g, r, mult) {
  const P = g.P;
  g.fx.push({ k: 'nova', x: P.x, y: P.y, r }); shake(g, 8);
  for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, P) < (r + o.r) ** 2) { damage(g, o, P.dmg * mult, 'player'); shove(P, o); shove(P, o); o.stun = 1.2; }
}
function usePowerup(g, k) {
  const P = g.P;
  g.powerups++; g.fx.push({ k: 'power', id: k }); snd(g, 'power'); burst(g, P.x, P.y, POWERUPS[k].c, 18, 220);
  const long = g.cls === 'engineer' ? 1.5 : 1;
  if (k === 'frenzy') g.frenzyT = 8 * long;
  else if (k === 'bubble') P.shield = 3;
  else if (k === 'freeze') { for (const o of g.ents) if (o.team === 'enemy' && !o.dead && !o.boss) o.stun = Math.max(o.stun || 0, 2); }
  else if (k === 'bomb') {
    g.fx.push({ k: 'nova', x: P.x, y: P.y, r: 560 }); shake(g, 16); snd(g, 'boom');
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, P) < 600 * 600) damage(g, o, P.dmg * 4 + 20, 'player');
    for (const b of g.bullets) if (b.team === 'enemy') b.life = 0;
  } else if (k === 'vortex') { for (const gem of g.gems) gem.pull = true; }
  else {                                                // giant
    for (const e of g.ents) if (e.team === 'ally' && !e.dead) { e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.5); if (!e.giant) { e.giant = true; e.dmg *= 1.5; e.r *= 1.3; } }
    g.giantT = 6 * long;
  }
}

// ---------- class ultimates ----------
export const ULT_TIME = { knight: 4, ranger: 4, necro: 0.6, berserker: 4, engineer: 4.2, warden: 0.6 };
function useUlt(g) {
  const P = g.P, c = g.cls;
  g.ult = 0; g.ultN++; g.ultT = ULT_TIME[c]; g.ultTick = 0;
  g.fx.push({ k: 'ult', id: c }); shake(g, 12); snd(g, 'ult');
  if (c === 'knight') blast(g, 210, 4);
  else if (c === 'necro') { for (let i = 0; i < 7; i++) { const a = i * 0.898; const s = spawnMinion(g, 'skeleton', clamp(P.x + Math.cos(a) * 70, 20, ARENA.w - 20), clamp(P.y + Math.sin(a) * 70, 20, ARENA.h - 20)); s.ttl = 10; } }
  else if (c === 'berserker') g.frenzyT = Math.max(g.frenzyT, 4);
  else if (c === 'engineer') g.laser = { a: g.rand() * 6.28, x: P.x, y: P.y };
  else if (c === 'warden') {
    P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.06); g.fx.push({ k: 'nova', x: P.x, y: P.y, r: 520 });
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, P) < 540 * 540) { damage(g, o, P.dmg * 2, 'player'); if (!o.boss && !o.dead) { o.stun = Math.max(o.stun || 0, 2.2); o.rootT = 2.2; } }
  }
}
// What an ultimate does while it lasts.
function ultStep(g, dt) {
  const P = g.P, c = g.cls;
  g.ultT -= dt; g.ultTick -= dt;
  if (c === 'knight' && g.ultTick <= 0) {               // Bulwark: a grinding ring of steel around you
    g.ultTick = 0.3;
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, P) < (80 + o.r) ** 2) { damage(g, o, P.dmg * 1.5, 'player'); shove(P, o); }
  } else if (c === 'ranger' && g.ultTick <= 0) {        // Arrow Storm: an arrow lands on a random enemy 14 times a second
    g.ultTick = 0.07;
    const near = g.ents.filter(o => o.team === 'enemy' && !o.dead && d2(o, P) < 500 * 500);
    if (near.length) { const o = near[Math.floor(g.rand() * near.length)]; g.fx.push({ k: 'strike', x: o.x, y: o.y }); damage(g, o, P.dmg * 1.5, 'player'); }
  } else if (c === 'engineer' && g.laser) {             // Orbital Laser: the beam's foot runs a circle around you
    // The foot spirals out from you and back, so it sweeps both the enemies on top of you and the ones further off.
    const L = g.laser; L.a += dt * 4.2; const rad = 70 + 80 * Math.abs(Math.sin(L.a * 0.4)); L.x = P.x + Math.cos(L.a) * rad; L.y = P.y + Math.sin(L.a) * rad;
    if (g.ultTick <= 0) { g.ultTick = 0.1; for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, L) < (62 + o.r) ** 2) damage(g, o, P.dmg * 3, 'player'); }
  }
  if (g.ultT <= 0) g.laser = null;
}

// ---------- abilities ----------
function useAbility(g) {
  const P = g.P, a = P.ability;
  P.actT = P.actMax = ABILITIES[a].cd * P.cdMul; g.acts++; g.fx.push({ k: 'act', id: a });
  if (a === 'dash') { P.dashT = 0.18; P.inv = Math.max(P.inv, 0.3); burst(g, P.x, P.y, '#fff', 8, 160); snd(g, 'dash'); }
  else if (a === 'shock') {
    g.fx.push({ k: 'nova', x: P.x, y: P.y, r: 170 }); shake(g, 8); snd(g, 'ring');
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, P) < (170 + o.r) ** 2) { damage(g, o, P.dmg * 1.5, 'player'); shove(P, o); shove(P, o); o.stun = 1.2; }
    for (const b of g.bullets) if (b.team === 'enemy' && d2(b, P) < 170 * 170) b.life = 0;
  } else if (a === 'slow') { g.slowT = 3; snd(g, 'slowmo'); }
  else if (a === 'decoy') { g.decoy = { x: P.x, y: P.y, r: P.r, life: 2.5 }; burst(g, P.x, P.y, '#fff', 10, 140); snd(g, 'thud'); }
  else {                                                // rally
    snd(g, 'level'); burst(g, P.x, P.y, '#7dffb0', 24, 240);
    for (const e of g.ents) if (e.team === 'ally' && !e.dead) {
      e.x = P.x + rr(g, -55, 55); e.y = P.y + rr(g, -55, 55); e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.4);
      if (!(e.rallyT > 0)) e.haste *= 1.5;
      e.rallyT = 5;
    }
  }
}

// Gear you do not own yet can drop from the boss and from elite chests. It is kept after the run.
function dropGear(g) {
  if (!g.owned) return false;
  const left = ALL_GEAR.filter(id => !g.owned.has(id) && !g.loot.includes(id));
  if (!left.length) return false;
  const id = left[Math.floor(g.rand() * left.length)];
  g.loot.push(id); g.fx.push({ k: 'gear', id }); snd(g, 'level');
  return true;
}

// Swap the three level-up choices for new ones, if you have a reroll left (bought at the Shrine).
export function reroll(g) {
  if (g.state !== 'lvl' || g.rerolls <= 0) return false;
  g.rerolls--; rollChoices(g); return true;
}

export function pick(g, i) {
  if (g.state !== 'lvl' || !g.choices[i]) return;
  const u = g.choices[i];
  const rar = g.rar[i] || 'common';
  u.f(g, u.leg ? 1 : RARITY[rar].s); if (!u.filler) g.picks[u.id] = (g.picks[u.id] || 0) + 1; g.chest = false; checkPairs(g);
  g.lastPick = { id: u.id, rar }; if (rar === 'epic' || rar === 'legendary') g.epics++;
  if (g.twin && g.cls) { g.twin = false; spawnMinion(g, CLASSES[g.cls].minion); }   // Twin Soul
  g.state = 'play';
  if (g.secondWind) {
    g.secondWind = false;                               // Second Wind: everyone who is down returns now, and returns are twice as fast from here on
    for (const q of g.respawnQ) q.at = g.t;
    for (const nem of g.party) nem.downs = 0;
    g.respawnMul *= 0.5;
  }
  if (g.P.xp >= g.P.next) levelUp(g);
}

// Advance the game by dt seconds. input = { mx, my } in -1..1.
export function step(g, dt, input) {
  g.fx.length = 0;
  if (g.state !== 'play') return;
  const P = g.P;
  if (!g.flow) g.flow = buildFlow(g.world);
  if ((g.flowT = (g.flowT || 0) - dt) <= 0) { g.flowT = 0.25; flowFrom(g.flow, P.x, P.y); }
  FLOW = g.flow;
  g.t += dt;
  if (g.streakT > 0 && (g.streakT -= dt) <= 0) g.streak = 0;
  if (Math.floor(g.t / 60) > g.minute) { g.minute = Math.floor(g.t / 60); g.fx.push({ k: 'minute', n: g.minute }); }
  const ml = Math.hypot(input.mx, input.my) || 1, moving = input.mx !== 0 || input.my !== 0;
  P.mv = moving; if (moving) { P.fx = input.mx / ml; P.fy = input.my / ml; }
  const x0 = P.x, y0 = P.y;
  if (P.dashT > 0) {                                   // Dash: a burst along your facing that cuts what it passes
    P.dashT -= dt; P.inv = Math.max(P.inv, 0.1); P.x += P.fx * 900 * dt; P.y += P.fy * 900 * dt;
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && (o.dashT || 0) <= g.t && d2(o, P) < (o.r + 22) ** 2) { o.dashT = g.t + 0.4; damage(g, o, hitDmg(g, P.dmg * 2), 'player'); }
  } else { P.x += input.mx / ml * P.spd * dt; P.y += input.my / ml * P.spd * dt; }
  P.moved = Math.hypot(P.x - x0, P.y - y0);
  P.actT -= dt; g.slowT -= dt;
  if (input.act && P.actT <= 0) useAbility(g);
  if (input.ult && g.ult >= 1 && g.cls && g.ultT <= 0) useUlt(g);
  if (g.ultT > 0) ultStep(g, dt);
  if (g.cls === 'knight') g.blockT -= dt;
  unstick(g, P);
  P.x = clamp(P.x, P.r, ARENA.w - P.r); P.y = clamp(P.y, P.r, ARENA.h - P.r);
  P.inv -= dt; P.flash -= dt; P.hp = Math.min(P.maxhp, P.hp + P.regen * (g.pairs.thirst && P.hp < P.maxhp / 2 ? 2 : 1) * dt);
  const wdt = g.frenzyT > 0 ? dt * 2 : dt;              // Frenzy: every weapon timer runs twice as fast
  g.frenzyT -= dt;
  P.fireT -= wdt;
  fireWeapon(g, wdt);
  if (g.storm && (g.stormT -= dt) <= 0) {                // Thunderstorm: a bolt from the sky every second
    g.stormT = 1;
    const near = g.ents.filter(o => o.team === 'enemy' && !o.dead && d2(o, P) < 440 * 440);
    if (near.length) { const o = near[Math.floor(g.rand() * near.length)]; g.fx.push({ k: 'bolt', pts: [{ x: o.x + 30, y: o.y - 320 }, { x: o.x, y: o.y }] }); snd(g, 'bolt'); damage(g, o, P.dmg * 3, 'player'); }
  }
  if (P.charm === 'ember') for (const o of g.ents) if (o.team === 'enemy' && !o.dead && (o.emberT || 0) <= g.t && d2(o, P) < (EMBER_R + o.r) ** 2) { o.emberT = g.t + 0.4; damage(g, o, P.dmg * 0.5, 'player'); }
  if (g.giantT > 0 && (g.giantT -= dt) <= 0) for (const e of g.ents) if (e.giant) { e.giant = false; e.dmg /= 1.5; e.r /= 1.3; }
  if (!g.boss && !g.bossAt && g.t >= BOSS_TIME) spawnBoss(g);
  g.spawnT -= dt;
  if (g.spawnT <= 0) { spawnEnemy(g); g.spawnT = Math.max(0.42, 0.85 - g.t * 0.003) * (g.boss ? 1.25 : 1) / g.heat; }
  // Surge: every 20s a wave closes in from one side, bigger each time.
  g.surgeT -= dt;
  if (g.surgeT <= 0 && !g.boss) {
    g.surgeT = 20; const a = g.rand() * 6.28, n = 3 + Math.floor(g.t / 50);
    for (let i = 0; i < n; i++) spawnEnemy(g, a + rr(g, -0.5, 0.5));
    g.fx.push({ k: 'surge', a }); snd(g, 'surge');
  }
  g.eliteT -= dt;
  if (g.eliteT <= 0 && !g.boss) { g.eliteT = P.charm === 'coin' ? 30 : 60; spawnElite(g); }
  for (const q of g.respawnQ) if (!q.done && g.t >= q.at) { q.done = true; if (q.minion) spawnMinion(g, q.minion); else spawnAlly(g, q.nem, q.lives); }
  g.respawnQ = g.respawnQ.filter(q => !q.done);
  const edt = g.slowT > 0 ? dt * 0.3 : dt;             // Time Slow: enemies and their shots crawl
  for (const e of g.ents) if (!e.dead) think(g, e, e.team === 'enemy' ? edt : dt);
  if (g.decoy && (g.decoy.life -= dt) <= 0) {
    const d = g.decoy; g.decoy = null; burst(g, d.x, d.y, '#fff', 30, 280); shake(g, 8); snd(g, 'boom');
    for (const o of g.ents) if (o.team === 'enemy' && !o.dead && d2(o, d) < (90 + o.r) ** 2) damage(g, o, P.dmg * 1.5, 'player');
  }
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
    const bd = b.team === 'enemy' ? edt : dt;
    b.x += b.vx * bd; b.y += b.vy * bd; b.life -= bd;
    // Job: a Wisp nemesis burns up enemy shots that come near it.
    if (b.team === 'enemy' && !b.boss) for (const w of ents) if (w.team === 'ally' && (w.type === 'wisp' || w.type === 'squire') && !w.dead && d2(b, w) < (w.evo === 'ward' ? 44 * 44 : w.type === 'squire' ? 30 * 30 : (24 * jobK(w)) ** 2)) { b.life = 0; burst(g, b.x, b.y, '#4cd9ff', 3, 80); break; }
    if (b.life > 0 && b.team === 'enemy') for (const k of rocksNear(g, b.x, b.y)) if (gapTo(k, b.x, b.y) <= 0) { b.life = 0; burst(g, b.x, b.y, '#8a8aa0', 2, 60); break; }
    if (b.x < -50 || b.y < -50 || b.x > ARENA.w + 50 || b.y > ARENA.h + 50) b.life = 0;
    if (b.life <= 0) continue;
    for (const o of targetsOf(g, b.team === 'ally' ? 'enemy' : 'ally')) {
      if (b.hit.has(o)) continue;
      const r = o.r + 3;
      if (d2(b, o) < r * r) {
        if (o === P) g.hitBy = b.prize || null;
        damage(g, o, b.dmg, b.src, b.boss, b.nem); if (b.slowT && !o.boss && o !== g.P) { o.slowT = b.slowT; o.slowK = b.slowK; }
        if (b.burn && !o.dead) { o.fireT = 3; o.fireD = b.dmg * 0.45; } b.hit.add(o); burst(g, b.x, b.y, b.color, 3, 80); if (b.team === 'ally') snd(g, 'hit');
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
    if (dd > 900) gem.pull = true;                       // left far behind in the open world: it comes after you
    if (dd < P.magnet || gem.pull) { gem.x += (P.x - gem.x) / dd * 420 * dt; gem.y += (P.y - gem.y) / dd * 420 * dt; }
    if (dd < P.r + 6) { gem.got = true; P.xp += gem.v * g.xpMul; snd(g, 'gem'); g.fx.push({ k: 'gem', x: gem.x, y: gem.y, big: gem.v >= 5 });
      if (P.charm === 'lode') { const tg = nearest(g, P, 'enemy', 420); if (tg) shoot(g, P.x, P.y, Math.atan2(tg.y - P.y, tg.x - P.x), 560, P.dmg * 0.6, 'ally', 'player', 0, '#7dffb0'); }
    }
  }
  g.gems = g.gems.filter(x => !x.got);
  for (const c of g.chests) if (!c.got && d2(c, P) < (P.r + 16) ** 2 && g.state === 'play') {
    c.got = true; g.opened++;
    if (g.owned && g.rand() < 0.3 && dropGear(g)) continue;   // sometimes a chest holds gear instead of an upgrade
    g.chest = true; g.state = 'lvl'; snd(g, 'level'); rollChoices(g);
  }
  g.chests = g.chests.filter(c => !c.got);
  for (const u of g.pickups) {
    u.life -= dt;
    if (d2(u, P) < (P.r + 18) ** 2) { u.life = 0; usePowerup(g, u.k); }
  }
  if (g.pickups.length) g.pickups = g.pickups.filter(u => u.life > 0);
  g.ents = g.ents.filter(e => !e.dead);
  if (P.xp >= P.next && g.state === 'play') levelUp(g);
}
