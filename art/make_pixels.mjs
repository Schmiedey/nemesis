// Pixel-art sprites for everything that is not a creature: bullets, gems, chests, pickups, effects and UI icons.
// Run: node art/make_pixels.mjs  →  public/sprites/items.png and src/atlas.js
// Each sprite is drawn with a few primitives on a small grid, then given a 1-pixel dark outline, so they all match.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// One palette for the whole game. Everything here and in the UI uses these colours.
export const PAL = {
  k: '#1a1423', w: '#f4f1e8', g1: '#c9c4b8', g2: '#8b8696', g3: '#5a5568', g4: '#3a3548', g5: '#262234',
  r: '#e43b44', r2: '#a22633', r3: '#ff8a7a', o: '#f77622', o2: '#feae34', y: '#fee761',
  gr: '#63c74d', gr2: '#3e8948', gr3: '#265c42', mint: '#7dffb0',
  c: '#2ce8f5', c2: '#0099db', c3: '#124e89', ice: '#c0f4ff',
  v: '#b06cff', v2: '#6b35c9', p: '#f06292', p2: '#b55088',
  br: '#b86f50', br2: '#733e39', br3: '#3e2731', gold: '#feae34', gold2: '#c9762c',
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const col = c => PAL[c] || c;

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.d[y * this.w + x]; }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c === null ? null : col(c); return this; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); return this; }
  line(x0, y0, x1, y1, c, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (t > 1) this.rect(Math.round(x), Math.round(y), t, t, c); else this.px(x, y, c); }
    return this;
  }
  // A filled circle. ramp = [dark, mid, light]: lit from the top-left.
  disc(cx, cy, r, ramp) {
    const [dk, md, lt] = Array.isArray(ramp) ? ramp : [ramp, ramp, ramp];
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r * r + 0.3) continue;
      const t = -(dx + dy) / (2 * r);
      this.px(x, y, t > 0.3 ? lt : t < -0.28 ? dk : md);
    }
    return this;
  }
  ring(cx, cy, r, c, t = 1) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const q = Math.hypot(x - cx, y - cy); if (q <= r + 0.4 && q > r - t + 0.4) this.px(x, y, c);
    }
    return this;
  }
  poly(pts, c) {                                     // filled polygon, even-odd
    const ys = pts.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + (y + 0.5 - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.px(x, y, c);
    }
    return this;
  }
  outline(c = 'k') {                                 // dark edge around the shape
    const o = col(c), add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.px(x, y, o);
    return this;
  }
  rot90() { const g = new Grid(this.h, this.w); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.d[x * g.w + (this.h - 1 - y)] = this.d[y * this.w + x]; return g; }
  alpha(a) { this.a = a; return this; }
}
const G = (w, h = w) => new Grid(w, h);

// ---------- the sprites ----------
const S = {};                                        // name → [frames]
const add = (name, ...frames) => { S[name] = frames; };

// Bullets: a small glowing orb per colour, and a larger one for the boss.
const ORBS = { fff: ['c2', 'ice', 'w'], ffd23f: ['o', 'y', 'w'], '9fe8ff': ['c2', 'c', 'w'], '7dffb0': ['gr2', 'mint', 'w'],
  b06cff: ['v2', 'v', 'w'], '4cff8a': ['gr2', 'gr', 'w'], ff7a2f: ['r2', 'o', 'y'], ff3b5c: ['r2', 'r', 'r3'], '4cd9ff': ['c3', 'c', 'w'] };
for (const k in ORBS) {
  add('orb_' + k, G(7).disc(3, 3, 2, ORBS[k]).px(2, 2, 'w').outline());
  add('big_' + k, G(11).disc(5, 5, 4, ORBS[k]).px(3, 3, 'w').px(4, 3, 'w').px(3, 4, 'w').outline());
}
add('arrow', G(11, 5).line(1, 2, 8, 2, 'br').px(9, 2, 'g1').px(8, 1, 'g1').px(8, 3, 'g1').px(1, 1, 'r').px(1, 3, 'r').outline());

// Gems (two frames: a glint passes over).
const gem = (s, a, b, c, glint) => { const g = G(s); const m = (s - 1) / 2; g.poly([[m + .5, 0], [s, m + .5], [m + .5, s], [0, m + .5]], b); for (let i = 0; i <= m; i++) g.px(m - i + 1, i + 1 > m ? m : i + 1, c); g.line(m, s - 2, s - 2, m, a); if (glint) g.px(m - 1, m - 1, 'w'); else g.px(m, m - 2, 'w'); return g.outline(); };
add('gem', gem(7, 'gr2', 'gr', 'mint', false), gem(7, 'gr2', 'gr', 'mint', true));
add('gem_big', gem(9, 'o', 'y', 'w', false), gem(9, 'o', 'y', 'w', true));

// Chest.
add('chest', G(16, 14).rect(1, 5, 14, 8, 'br').rect(1, 5, 14, 2, 'br2').rect(1, 1, 14, 4, 'br').rect(2, 1, 12, 1, 'o2').rect(1, 4, 14, 1, 'gold').rect(1, 1, 1, 12, 'gold2').rect(14, 1, 1, 12, 'gold2')
  .rect(7, 4, 2, 4, 'y').px(7, 6, 'k').rect(2, 11, 12, 1, 'br2').outline());

// Totem.
add('totem', G(12, 20).rect(3, 3, 6, 15, 'br').rect(3, 3, 2, 15, 'o2').rect(8, 3, 1, 15, 'br2').rect(2, 1, 8, 3, 'gold').rect(2, 1, 8, 1, 'y').rect(4, 7, 4, 2, 'y').px(5, 8, 'k').px(6, 8, 'k')
  .rect(4, 12, 4, 1, 'br2').rect(1, 17, 10, 2, 'br2').outline());

// Boomerang: one shape, four quarter turns.
{ let b = G(13).line(2, 9, 6, 3, 'ice', 2).line(6, 3, 10, 9, 'g1', 2).px(6, 2, 'w').px(2, 10, 'g2').px(11, 10, 'g2').outline(); const fr = [b]; for (let i = 0; i < 3; i++) fr.push(b = b.rot90()); add('rang', ...fr); }

// Orbiting blade (shuriken), two frames.
add('blade', G(11).line(5, 0, 5, 10, 'g1').line(0, 5, 10, 5, 'g1').disc(5, 5, 2, ['g2', 'g1', 'w']).px(5, 5, 'k').outline(),
  G(11).line(1, 1, 9, 9, 'g1').line(9, 1, 1, 9, 'g1').disc(5, 5, 2, ['g2', 'g1', 'w']).px(5, 5, 'k').outline());

// Fire patch, three frames.
const flame = (a, b) => G(16).disc(8, 10, 5, ['r2', 'o', 'o2']).disc(8, 11, 3, ['o', 'y', 'w']).poly([[4, 8], [6 + a, 1 + b], [9, 7]], 'o').poly([[7, 8], [10 - a, 2], [12, 8]], 'o2').px(8, 11, 'w');
add('fire', flame(0, 0).alpha(0.85), flame(1, 1).alpha(0.85), flame(-1, 2).alpha(0.85));

// Explosion, five frames; hit spark, three.
add('boom',
  G(32).disc(16, 16, 5, ['y', 'w', 'w']).outline('o'),
  G(32).disc(16, 16, 9, ['o', 'y', 'w']).outline('r'),
  G(32).disc(16, 16, 12, ['r', 'o', 'y']).disc(14, 14, 5, 'w').outline('r2'),
  G(32).ring(16, 16, 13, 'o', 3).disc(11, 12, 3, 'g2').disc(21, 19, 3, 'g3').disc(19, 10, 2, 'g2'),
  G(32).ring(16, 16, 14, 'g3', 1).disc(10, 11, 2, 'g3').disc(22, 20, 2, 'g4'));
add('spark', G(9).line(4, 1, 4, 7, 'w').line(1, 4, 7, 4, 'w').px(4, 4, 'y'), G(9).line(2, 2, 6, 6, 'y').line(6, 2, 2, 6, 'y').px(4, 4, 'w'), G(9).px(1, 1, 'y').px(7, 1, 'y').px(1, 7, 'y').px(7, 7, 'y'));

// A chevron for charge lanes: it marches along the lane to show which way the charge goes.
add('chev', G(9, 11).poly([[1, 1], [4, 1], [8, 5.5], [4, 10], [1, 10], [5, 5.5]], 'r3').line(1, 1, 5, 5, 'w').outline('r2'));

// Shadow under creatures.
add('shadow', G(16, 7).disc(8, 3, 3, 'k').rect(2, 2, 12, 3, 'k').rect(4, 1, 8, 5, 'k').alpha(0.4));

// ---------- icons, 16x16 ----------
const I = () => G(16);
const sword = (a = 'g1', b = 'w') => I().line(4, 11, 12, 3, a, 2).line(5, 11, 12, 4, b).line(3, 9, 6, 12, 'gold', 1).line(2, 13, 4, 11, 'br', 2).px(13, 2, b);
const bolt = c => I().poly([[9, 1], [3, 9], [7, 9], [5, 15], [13, 6], [8, 6]], c).line(9, 2, 5, 8, 'w');
const heart = (a, b) => I().disc(5, 6, 3, [a, a, b]).disc(10, 6, 3, [a, a, a]).poly([[2, 7], [14, 7], [8, 14]], a).px(4, 5, 'w');
const flag = (c, c2) => I().rect(4, 2, 1, 13, 'g1').poly([[5, 2], [13, 4], [5, 8]], c).line(5, 7, 12, 4, c2).rect(3, 14, 4, 1, 'g2');
const hourglass = (f, s) => I().rect(3, 2, 10, 2, f).rect(3, 12, 10, 2, f).poly([[4, 4], [12, 4], [8, 8]], s).poly([[8, 8], [12, 12], [4, 12]], 'ice').line(4, 4, 8, 8, f).line(12, 4, 8, 8, f).line(4, 12, 8, 8, f).line(12, 12, 8, 8, f).rect(6, 10, 4, 2, s);
const ghost = c => I().disc(8, 7, 5, [c, c, 'w']).rect(3, 7, 11, 6, c).px(4, 13, c).px(8, 13, c).px(12, 13, c).rect(5, 6, 2, 2, 'k').rect(9, 6, 2, 2, 'k');
const star = c => I().poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 14], [8, 11], [3, 14], [5, 9], [1, 6], [6, 6]], c).px(7, 5, 'w');
const shuriken = () => I().poly([[8, 1], [10, 7], [8, 8], [6, 7]], 'g1').poly([[15, 8], [9, 10], [8, 8], [9, 6]], 'g2').poly([[8, 15], [6, 9], [8, 8], [10, 9]], 'g1').poly([[1, 8], [7, 6], [8, 8], [7, 10]], 'w').px(8, 8, 'k');
const flameIcon = () => I().poly([[8, 1], [12, 7], [13, 11], [10, 15], [6, 15], [3, 11], [5, 6]], 'o').poly([[8, 6], [10, 10], [10, 13], [8, 14], [6, 13], [6, 10]], 'y').px(8, 12, 'w');
const ic = {
  // upgrades
  dmg: sword(), haste: bolt('y'), tough: heart('r', 'r3'), regen: I().rect(6, 2, 4, 12, 'gr').rect(2, 6, 12, 4, 'gr').rect(6, 2, 1, 12, 'mint').rect(2, 6, 12, 1, 'mint'),
  spd: I().poly([[2, 3], [7, 8], [2, 13]], 'c').poly([[8, 3], [13, 8], [8, 13]], 'c').line(2, 4, 6, 8, 'ice').line(8, 4, 12, 8, 'ice'),
  shots: I().disc(4, 4, 2, ['c2', 'c', 'w']).disc(11, 8, 2, ['c2', 'c', 'w']).disc(4, 12, 2, ['c2', 'c', 'w']).line(6, 5, 8, 7, 'g2').line(6, 11, 8, 9, 'g2'),
  pierce: I().line(1, 13, 13, 1, 'g1', 2).poly([[15, 0], [15, 6], [9, 0]], 'w').rect(6, 5, 2, 7, 'r').rect(4, 7, 6, 2, 'r'),
  magnet: I().ring(8, 8, 6, 'r', 3).rect(0, 9, 16, 7, null).rect(2, 9, 3, 4, 'r').rect(11, 9, 3, 4, 'r').rect(2, 12, 3, 2, 'g1').rect(11, 12, 3, 2, 'g1'),
  rally: flag('gr', 'mint'), pack: I().line(3, 2, 5, 13, 'g1', 2).line(7, 2, 9, 13, 'w', 2).line(11, 2, 13, 13, 'g1', 2),
  wind: I().ring(8, 8, 6, 'gr', 2).rect(8, 0, 8, 7, null).poly([[9, 1], [14, 4], [9, 7]], 'mint'),
  blade: shuriken(), chain: I().ring(5, 5, 3, 'c', 2).ring(10, 10, 3, 'ice', 2), nova: I().ring(8, 8, 6, 'o2', 1).ring(8, 8, 3, 'y', 1).px(8, 8, 'w').line(8, 0, 8, 2, 'y').line(8, 13, 8, 15, 'y').line(0, 8, 2, 8, 'y').line(13, 8, 15, 8, 'y'),
  crit: star('y'), bond: heart('gr', 'mint'), guard: I().poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], 'c2').poly([[4, 4], [8, 4], [8, 12], [4, 8]], 'c').line(8, 3, 8, 13, 'ice'),
  // weapons
  blaster: I().rect(2, 6, 10, 4, 'g2').rect(2, 6, 10, 1, 'g1').rect(4, 10, 3, 4, 'br').rect(12, 7, 2, 2, 'g3').disc(14, 7, 1, ['c', 'c', 'w']),
  sword: sword(), rang: I().line(2, 12, 7, 3, 'ice', 2).line(8, 3, 13, 12, 'g1', 2).px(7, 2, 'w'), flame: flameIcon(),
  rod: I().line(3, 14, 9, 5, 'br', 2).disc(11, 4, 2, ['c2', 'c', 'w']).line(13, 1, 14, 0, 'y').line(14, 6, 15, 7, 'y').line(8, 1, 7, 0, 'y'),
  totem: I().rect(5, 3, 6, 11, 'br').rect(5, 3, 2, 11, 'o2').rect(4, 1, 8, 3, 'gold').rect(6, 6, 4, 2, 'y').rect(3, 13, 10, 2, 'br2'),
  // abilities
  dash: I().poly([[1, 3], [7, 8], [1, 13], [4, 8]], 'w').poly([[8, 3], [14, 8], [8, 13], [11, 8]], 'ice'),
  shock: I().ring(8, 8, 7, 'o2', 1).ring(8, 8, 4, 'y', 1).disc(8, 8, 1, 'w'), slow: hourglass('c2', 'c'), decoy: ghost('g1'),
  // charms
  thorn: I().disc(8, 8, 4, ['gr3', 'gr2', 'gr']).line(8, 0, 8, 3, 'w').line(8, 13, 8, 15, 'w').line(0, 8, 3, 8, 'w').line(13, 8, 15, 8, 'w').line(2, 2, 4, 4, 'w').line(12, 2, 11, 4, 'w').line(2, 13, 4, 12, 'w').line(13, 13, 11, 12, 'w'),
  ember: flameIcon(), lode: I().poly([[8, 1], [14, 7], [8, 15], [2, 7]], 'c2').poly([[8, 3], [11, 7], [8, 12]], 'c').line(5, 6, 8, 3, 'ice'),
  fang: I().poly([[3, 2], [13, 2], [11, 8], [8, 15], [5, 8]], 'w').line(4, 3, 7, 12, 'g1').rect(3, 1, 10, 2, 'r'),
  hour: hourglass('gold', 'y'), after: ghost('c'), banner: flag('r', 'r3'), coin: I().disc(8, 8, 6, ['gold2', 'gold', 'y']).rect(7, 4, 2, 8, 'gold2').px(5, 5, 'w'),
  // misc UI
  trophy: I().rect(4, 2, 8, 6, 'gold').rect(4, 2, 2, 6, 'y').rect(1, 3, 3, 3, 'gold2').rect(12, 3, 3, 3, 'gold2').rect(7, 8, 2, 4, 'gold2').rect(4, 12, 8, 2, 'gold'),
  lock: I().ring(8, 6, 4, 'g2', 2).rect(0, 7, 16, 9, null).rect(3, 7, 10, 8, 'g3').rect(3, 7, 10, 1, 'g2').rect(7, 10, 2, 3, 'k'),
  skull: I().disc(8, 7, 6, ['g1', 'w', 'w']).rect(5, 11, 6, 4, 'w').rect(4, 6, 3, 3, 'k').rect(9, 6, 3, 3, 'k').px(8, 10, 'k').rect(6, 13, 1, 2, 'k').rect(9, 13, 1, 2, 'k'),
};
for (const k in ic) add('i_' + k, ic[k].outline());

// Power-ups: a dark badge with a coloured ring and a symbol.
const badge = (ring, draw) => { const g = G(18); g.disc(8.5, 8.5, 8, 'g5').ring(8.5, 8.5, 8, ring, 2); draw(g); return g.outline(); };
add('pu_frenzy', badge('y', g => g.poly([[10, 3], [5, 9], [8, 9], [7, 14], [12, 7], [9, 7]], 'y')));
add('pu_bubble', badge('ice', g => g.ring(8.5, 8.5, 4, 'ice', 1).px(7, 6, 'w')));
add('pu_freeze', badge('c', g => g.line(8, 4, 8, 13, 'ice').line(4, 8, 13, 8, 'ice').line(5, 5, 12, 12, 'c').line(12, 5, 5, 12, 'c')));
add('pu_bomb', badge('o', g => g.disc(8, 10, 3, ['g4', 'g3', 'g2']).line(10, 6, 12, 4, 'br').px(12, 3, 'y').px(13, 4, 'o')));
add('pu_vortex', badge('mint', g => g.ring(8.5, 8.5, 4, 'mint', 1).ring(8.5, 8.5, 2, 'gr', 1).px(12, 5, 'w')));
add('pu_giant', badge('v', g => g.poly([[8.5, 3], [13, 9], [4, 9]], 'v').rect(7, 9, 3, 4, 'v')));

// ---------- creatures: side view, facing right; the game flips them to face left ----------
// Four frames each: two poses, each with a one-pixel bob, so they step and breathe. Drawn larger than the hit circle.
const lift = (g, dy) => { const o = new Grid(g.w, g.h + 1); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) o.d[(y + dy) * o.w + x] = g.d[y * g.w + x]; return o; };
const cycle = (a, b) => [lift(a, 1), lift(a, 0), lift(b, 1), lift(b, 0)];
const bat = pose => { const g = G(16, 13);               // pose 0 wings up, 1 level, 2 down
  const L = [[[6, 7], [0, 1], [1, 8]], [[6, 7], [0, 5], [1, 9]], [[6, 7], [0, 11], [2, 5]]][pose], R = L.map(([x, y]) => [16 - x, y]);
  g.poly(L, 'v2').poly(R, 'v2').line(L[1][0] + 1, L[1][1] + (pose ? 0 : 2), 5, 7, 'v').line(R[1][0] - 2, R[1][1] + (pose ? 0 : 2), 10, 7, 'v');
  g.disc(8, 7, 3, ['v2', 'v', 'v']).px(6, 3, 'v').px(10, 3, 'v').px(6, 4, 'v').px(10, 4, 'v').px(7, 6, 'y').px(9, 6, 'y').px(7, 9, 'w').px(9, 9, 'w'); return g.outline(); };
add('c_bat', lift(bat(0), 1), lift(bat(1), 0), lift(bat(2), 0), lift(bat(1), 1));

const slime = sq => { const g = G(18, 14); const y = sq ? 1 : 0;
  g.disc(9, 7 + y, 6 - y, ['gr2', 'gr', 'mint']).rect(3 - y, 8 + y, 12 + 2 * y, 5 - y, 'gr').rect(3 - y, 12, 12 + 2 * y, 1, 'gr2').rect(13 + y, 8 + y, 2, 4 - y, 'gr2');
  g.rect(7, 6 + y, 1, 2, 'k').rect(11, 6 + y, 1, 2, 'k').px(5, 4 + y, 'w').px(6, 4 + y, 'w').px(5, 5 + y, 'w').rect(8, 9 + y, 3, 1, 'gr3'); return g.outline(); };
add('c_slime', lift(slime(false), 0), lift(slime(false), 1), lift(slime(true), 1), lift(slime(false), 1));

const archer = st => { const g = G(18, 19);
  g.poly([[4, 8], [12, 8], [13, 17], [3, 17]], 'o2').rect(4, 8, 2, 9, 'gold2').rect(8, 9, 1, 8, 'y');                 // cloak
  g.disc(8, 5, 4, ['gold2', 'o2', 'y']).rect(6, 4, 5, 3, 'br3').px(7, 5, 'w').px(9, 5, 'w').px(8, 0, 'o2').px(8, 1, 'o2');   // hood, face in shadow
  g.line(14, 3, 16, 7, 'br').line(16, 7, 16, 10, 'br').line(16, 10, 14, 14, 'br').line(14, 3, 14, 14, 'g1').rect(12, 8, 3, 1, 'g1').px(15, 8, 'w');   // bow and arrow
  g.rect(st ? 4 : 5, 17, 3, 1, 'br2').rect(st ? 10 : 9, 17, 3, 1, 'br2'); return g.outline(); };
add('c_archer', ...cycle(archer(false), archer(true)));

const brute = st => { const g = G(28, 27); const y = st ? 1 : 0;
  g.disc(14, 16, 9, ['r2', 'o', 'o2']).rect(9, 22, 10, 2, 'r2');                                                     // body
  g.disc(3, 15 + y, 3, ['r2', 'o', 'o2']).disc(24, 15 - y, 3, ['r2', 'o', 'o2']).rect(5, 12, 3, 3, 'o').rect(20, 12, 3, 3, 'o');   // arms and fists
  g.rect(9, 3, 10, 9, 'o').rect(9, 3, 3, 9, 'o2').rect(17, 3, 2, 9, 'r2');                                            // head
  g.line(9, 4, 5, 0, 'w', 2).line(18, 4, 22, 0, 'w', 2).px(5, 0, 'g1').px(23, 0, 'g1');                               // horns
  g.rect(11, 6, 2, 2, 'y').rect(15, 6, 2, 2, 'y').px(12, 7, 'k').px(16, 7, 'k').line(10, 5, 13, 5, 'r2').line(15, 5, 18, 5, 'r2');   // eyes, brow
  g.rect(11, 9, 6, 2, 'br3').px(11, 9, 'w').px(13, 9, 'w').px(15, 9, 'w').px(12, 10, 'w').px(14, 10, 'w').px(16, 10, 'w');     // teeth
  g.rect(st ? 8 : 9, 24, 4, 2, 'r2').rect(st ? 16 : 15, 24, 4, 2, 'r2').rect(11, 17, 6, 1, 'r2').rect(11, 19, 6, 1, 'r2'); return g.outline(); };
add('c_brute', ...cycle(brute(false), brute(true)));

const bomber = st => { const g = G(16, 19);
  g.disc(8, 10, 6, ['r2', 'r', 'r3']).rect(4, 13, 9, 1, 'r2');
  g.rect(5, 8, 2, 3, 'w').rect(9, 8, 2, 3, 'w').px(6, 9, 'k').px(10, 9, 'k').px(6, 10, 'k').px(10, 10, 'k').line(4, 6, 7, 8, 'k').line(12, 6, 9, 8, 'k').rect(6, 12, 4, 1, 'k');
  g.rect(6, 3, 4, 2, 'g3').rect(6, 3, 4, 1, 'g2').line(8, 2, 10, 0, 'br');
  if (st) g.px(11, 0, 'y').px(12, 0, 'w').px(11, 1, 'o'); else g.px(11, 0, 'o').px(10, 1, 'y');
  g.rect(st ? 3 : 4, 17, 3, 1, 'r2').rect(st ? 10 : 9, 17, 3, 1, 'r2'); return g.outline(); };
add('c_bomber', ...cycle(bomber(false), bomber(true)));

const wisp = st => { const g = G(14, 17); const t = st ? 5 : 8;
  g.poly([[t, 0], [11, 6], [12, 11], [9, 16], [5, 16], [2, 11], [3, 6]], 'c2').poly([[t, 2], [10, 7], [10, 11], [8, 15], [6, 15], [4, 11], [4, 7]], 'c').poly([[7, 6], [9, 9], [9, 12], [7, 14], [5, 12], [5, 9]], 'ice');
  g.rect(5, 10, 1, 2, 'k').rect(8, 10, 1, 2, 'k').px(7, 8, 'w'); return g.outline(); };
add('c_wisp', ...cycle(wisp(false), wisp(true)));

const hero = st => { const g = G(18, 21);
  g.poly(st ? [[5, 9], [0, 14], [1, 17], [5, 16]] : [[5, 9], [1, 15], [2, 18], [5, 16]], 'r2');                           // cape
  g.rect(5, 9, 7, 7, 'g1').rect(5, 9, 2, 7, 'w').rect(10, 9, 2, 7, 'g2').rect(7, 10, 3, 6, 'r').rect(8, 11, 1, 3, 'y');   // armour and tabard
  g.disc(8, 5, 4, ['g2', 'g1', 'w']).rect(6, 5, 6, 1, 'k').px(10, 5, 'mint').px(9, 5, 'mint').rect(7, 0, 3, 2, 'r').px(8, 0, 'r3');   // helmet, visor, plume
  g.rect(12, 10, 2, 2, 'g2').line(15, 3, 15, 11, 'w').px(15, 2, 'ice').rect(14, 11, 3, 1, 'gold').px(15, 12, 'br');       // sword arm
  g.rect(st ? 5 : 6, 16, 2, st ? 4 : 3, 'g3').rect(st ? 10 : 9, 16, 2, st ? 3 : 4, 'g3'); return g.outline(); };
add('c_player', ...cycle(hero(false), hero(true)));

add('c_knight', ...cycle(hero(false), hero(true)));

// The other two classes.
const ranger = st => { const g = G(18, 21);
  g.poly(st ? [[5, 9], [1, 15], [2, 18], [5, 16]] : [[5, 9], [2, 16], [3, 18], [5, 16]], 'gr3');                         // cloak
  g.rect(5, 9, 7, 7, 'gr2').rect(5, 9, 2, 7, 'gr').rect(10, 9, 2, 7, 'gr3').rect(5, 13, 7, 1, 'br');                      // tunic, belt
  g.disc(8, 5, 4, ['gr3', 'gr2', 'gr']).rect(7, 4, 5, 3, 'br3').px(9, 5, 'w').px(11, 5, 'w').px(6, 1, 'gr2').px(5, 0, 'gr2');   // hood, face in shadow
  g.line(14, 4, 16, 8, 'br').line(16, 8, 16, 11, 'br').line(16, 11, 14, 15, 'br').line(14, 4, 14, 15, 'g1').rect(11, 9, 4, 1, 'g1').px(15, 9, 'w');   // bow, arrow
  g.rect(st ? 5 : 6, 16, 2, st ? 4 : 3, 'br2').rect(st ? 10 : 9, 16, 2, st ? 3 : 4, 'br2'); return g.outline(); };
add('c_ranger', ...cycle(ranger(false), ranger(true)));

const necro = st => { const g = G(18, 21);
  g.poly([[4, 9], [12, 9], [13, 19], [3, 19]], 'v2').rect(4, 9, 2, 10, 'v').rect(8, 10, 1, 9, 'p2').rect(st ? 2 : 3, 19, st ? 12 : 10, 1, 'v2');   // robe, hem sways
  g.disc(8, 5, 4, ['v2', 'v', 'v']).rect(6, 4, 5, 3, 'k').px(7, 5, 'mint').px(9, 5, 'mint').px(8, 0, 'v2');                // hood, glowing eyes
  g.line(15, 4, 15, 19, 'br').disc(15, 2, 2, ['gr2', 'mint', 'w']).px(st ? 13 : 17, st ? 0 : 1, 'mint');                   // staff with a green flame
  g.rect(12, 10, 3, 2, 'v'); return g.outline(); };
add('c_necro', ...cycle(necro(false), necro(true)));

// The three locked classes.
const berserker = st => { const g = G(20, 21);
  g.rect(5, 9, 7, 6, 'br').rect(5, 9, 2, 6, 'o2').rect(10, 9, 2, 6, 'br2').rect(5, 14, 7, 2, 'r2').rect(7, 10, 1, 3, 'br2');        // bare chest, red kilt
  g.disc(8, 5, 4, ['br2', 'br', 'o2']).rect(5, 6, 7, 3, 'o').rect(6, 8, 5, 2, 'o').px(7, 4, 'k').px(10, 4, 'k').rect(5, 1, 7, 2, 'g2').px(4, 0, 'w').px(12, 0, 'w');   // head, big orange beard, horned helm
  g.line(15, 3, 15, 15, 'br').poly([[15, 2], [19, 3], [19, 8], [15, 8]], 'g1').line(18, 3, 18, 8, 'w').rect(12, 10, 3, 2, 'br');          // great axe
  g.rect(st ? 5 : 6, 16, 2, st ? 4 : 3, 'br2').rect(st ? 10 : 9, 16, 2, st ? 3 : 4, 'br2'); return g.outline(); };
add('c_berserker', ...cycle(berserker(false), berserker(true)));

const engineer = st => { const g = G(18, 21);
  g.rect(5, 9, 7, 7, 'o').rect(5, 9, 2, 7, 'o2').rect(10, 9, 2, 7, 'br').rect(6, 11, 5, 4, 'br2').rect(7, 12, 3, 1, 'y');                // overalls, tool belt
  g.disc(8, 5, 4, ['br', 'o2', 'y']).rect(5, 4, 7, 2, 'g3').rect(6, 4, 2, 2, 'c').rect(9, 4, 2, 2, 'c').rect(5, 0, 7, 2, 'y').rect(4, 2, 9, 1, 'gold2');   // goggles, hard hat
  g.line(14, 6, 14, 13, 'g1').rect(13, 4, 3, 2, 'g2').px(14, 4, null).rect(12, 10, 2, 2, 'o2');                                          // wrench
  g.rect(st ? 5 : 6, 16, 2, st ? 4 : 3, 'g3').rect(st ? 10 : 9, 16, 2, st ? 3 : 4, 'g3'); return g.outline(); };
add('c_engineer', ...cycle(engineer(false), engineer(true)));

const warden = st => { const g = G(18, 22);
  g.poly([[4, 10], [12, 10], [13, 20], [3, 20]], 'gr3').rect(4, 10, 2, 10, 'gr2').rect(8, 11, 1, 9, 'br').rect(st ? 2 : 3, 20, st ? 12 : 10, 1, 'gr3');   // moss-green robe
  g.disc(8, 6, 4, ['br2', 'br', 'o2']).rect(6, 7, 5, 3, 'w').px(7, 5, 'k').px(10, 5, 'k');                                               // face, white beard
  g.line(5, 3, 3, 0, 'br').line(4, 1, 2, 1, 'br').line(11, 3, 13, 0, 'br').line(12, 1, 14, 1, 'br');                                     // antlers
  g.line(15, 5, 15, 20, 'br2').disc(15, 3, 2, ['gr2', 'gr', 'mint']).px(16, 6, 'gr').rect(12, 11, 3, 2, 'gr2'); return g.outline(); };   // living staff
add('c_warden', ...cycle(warden(false), warden(true)));

// Starter minions.
const squire = st => { const g = G(16, 17);
  g.rect(4, 7, 6, 6, 'g2').rect(4, 7, 2, 6, 'g1').rect(5, 8, 3, 4, 'c2');                                                // body, tabard
  g.disc(7, 4, 3, ['g2', 'g1', 'w']).rect(6, 4, 4, 1, 'k').px(7, 0, 'c').px(7, 1, 'c');                                    // helmet, plume
  g.rect(10, 5, 4, 9, 'c2').rect(10, 5, 1, 9, 'c').rect(13, 5, 1, 9, 'c3').rect(11, 8, 2, 2, 'y').rect(11, 14, 2, 1, 'c2');   // a shield as big as he is
  g.rect(st ? 4 : 5, 13, 2, st ? 3 : 2, 'g3').rect(st ? 8 : 7, 13, 2, st ? 2 : 3, 'g3'); return g.outline(); };
add('c_squire', ...cycle(squire(false), squire(true)));

const hawk = pose => { const g = G(18, 13), wy = [1, 6, 11][pose];
  g.poly([[6, 6], [2, wy], [11, 6]], 'br').line(3, wy, 8, 6, 'br2');                                                    // wing
  g.rect(4, 6, 8, 3, 'br').rect(4, 6, 8, 1, 'o2').rect(2, 7, 3, 1, 'br2').px(1, 8, 'br2');                               // body, tail
  g.disc(12, 6, 2, ['g1', 'w', 'w']).px(13, 5, 'k').px(15, 6, 'y').px(14, 6, 'y').px(14, 7, 'gold2').px(8, 9, 'y').px(10, 9, 'y');   // head, beak, talons
  return g.outline(); };
add('c_hawk', lift(hawk(0), 1), lift(hawk(1), 0), lift(hawk(2), 0), lift(hawk(1), 1));

const imp = st => { const g = G(16, 16);
  g.disc(7, 10, 4, ['r2', 'r', 'r3']).disc(7, 4, 3, ['r2', 'r', 'r3']);                                                  // body, head
  g.px(4, 0, 'w').px(5, 1, 'w').px(10, 0, 'w').px(9, 1, 'w').px(6, 4, 'y').px(8, 4, 'y').rect(6, 6, 3, 1, 'k');            // horns, eyes, grin
  g.line(3, 12, 0, st ? 9 : 13, 'r2').px(0, st ? 8 : 14, 'r3');                                                          // tail
  g.disc(13, st ? 7 : 8, 2, ['o', 'y', 'w']).px(13, st ? 4 : 5, 'o');                                                    // fireball in hand
  g.rect(st ? 4 : 5, 14, 2, 1, 'r2').rect(st ? 9 : 8, 14, 2, 1, 'r2'); return g.outline(); };
add('c_imp', ...cycle(imp(false), imp(true)));

const skel = st => { const g = G(14, 18);
  g.disc(7, 4, 3, ['g1', 'w', 'w']).rect(5, 4, 2, 2, 'k').rect(8, 4, 2, 2, 'k').rect(6, 7, 3, 1, 'g1').px(7, 7, 'k');       // skull
  g.rect(6, 8, 2, 6, 'w').rect(4, 9, 6, 1, 'g1').rect(4, 11, 6, 1, 'g1').rect(5, 13, 4, 1, 'g1');                          // spine, ribs
  g.line(4, 9, 2, st ? 12 : 13, 'w').line(9, 9, 12, st ? 11 : 10, 'w').line(12, st ? 11 : 10, 12, st ? 6 : 5, 'g1');        // arms; a bone club
  g.line(6, 14, st ? 4 : 5, 17, 'w').line(8, 14, st ? 10 : 9, 17, 'w'); return g.outline(); };
add('c_skeleton', ...cycle(skel(false), skel(true)));

const wolf = st => { const g = G(20, 13);
  g.rect(4, 5, 10, 4, 'g2').rect(4, 5, 10, 1, 'g1').rect(4, 8, 10, 1, 'g3');                                                             // body
  g.poly([[13, 3], [18, 5], [18, 8], [13, 8]], 'g2').px(13, 2, 'g2').px(15, 2, 'g2').px(16, 5, 'y').px(18, 6, 'k').rect(15, 8, 3, 1, 'w');   // head, ears, eye, teeth
  g.line(4, 5, 1, st ? 3 : 6, 'g2').px(0, st ? 2 : 7, 'g1');                                                                             // tail
  g.rect(st ? 4 : 5, 9, 2, 3, 'g3').rect(st ? 8 : 7, 9, 2, 3, 'g3').rect(st ? 11 : 12, 9, 2, 3, 'g3'); return g.outline(); };
add('c_wolf', ...cycle(wolf(false), wolf(true)));

const drone = st => { const g = G(14, 12);
  g.rect(3, 5, 8, 4, 'g2').rect(3, 5, 8, 1, 'g1').rect(3, 8, 8, 1, 'g3').rect(5, 6, 4, 2, 'c').px(6, 6, 'w').rect(6, 9, 2, 2, 'g3');     // body, eye, gun
  g.rect(st ? 0 : 2, 2, st ? 6 : 3, 1, 'ice').rect(st ? 8 : 9, 2, st ? 6 : 3, 1, 'ice').rect(3, 3, 1, 2, 'g3').rect(10, 3, 1, 2, 'g3');   // rotors
  return g.outline(); };
add('c_drone', lift(drone(false), 0), lift(drone(true), 0), lift(drone(false), 1), lift(drone(true), 1));

const golem = st => { const g = G(30, 30);
  g.disc(15, 17, 9, ['g3', 'g2', 'g1']).rect(9, 22, 12, 3, 'g3');                                                                        // boulder body
  g.rect(10, 4, 10, 8, 'g2').rect(10, 4, 3, 8, 'g1').rect(18, 4, 2, 8, 'g3').rect(12, 7, 2, 2, 'c').rect(16, 7, 2, 2, 'c').rect(13, 10, 4, 1, 'k');   // head, glowing eyes
  g.disc(4, 17 + (st ? 1 : 0), 4, ['g3', 'g2', 'g1']).disc(26, 17 - (st ? 1 : 0), 4, ['g3', 'g2', 'g1']);                                // fists
  g.px(11, 15, 'gr2').px(12, 14, 'gr').px(18, 20, 'gr2').px(19, 13, 'gr3').line(13, 16, 16, 19, 'g3').line(17, 14, 19, 16, 'g3');        // moss, cracks
  g.rect(st ? 9 : 10, 25, 5, 3, 'g3').rect(st ? 17 : 16, 25, 5, 3, 'g3'); return g.outline(); };
add('c_golem', ...cycle(golem(false), golem(true)));

// Icons for progression: a soul (the currency) and a mastery star.
add('i_soul', G(16).poly([[8, 1], [12, 6], [13, 10], [10, 14], [6, 14], [3, 10], [4, 6]], 'c').poly([[8, 5], [10, 9], [9, 12], [7, 12], [6, 9]], 'ice').px(7, 9, 'k').px(9, 9, 'k').outline());
add('i_star', G(9).poly([[4.5, 0], [6, 3], [9, 3.5], [6.5, 5.5], [7.5, 9], [4.5, 7], [1.5, 9], [2.5, 5.5], [0, 3.5], [3, 3]], 'y').outline('gold2'));
add('i_star0', G(9).poly([[4.5, 0], [6, 3], [9, 3.5], [6.5, 5.5], [7.5, 9], [4.5, 7], [1.5, 9], [2.5, 5.5], [0, 3.5], [3, 3]], 'g4').outline('g5'));

// Small markers drawn over enemies: the Hawk's mark, and burning.
add('mark', G(9).ring(4, 4, 4, 'r', 1).px(4, 0, null).px(4, 8, null).px(0, 4, null).px(8, 4, null).px(4, 4, 'r3').outline());
add('burn', G(7, 8).poly([[3, 0], [6, 5], [4, 8], [2, 8], [0, 5]], 'o').px(3, 5, 'y').px(3, 6, 'w').outline('r2'), G(7, 8).poly([[4, 0], [6, 5], [4, 8], [2, 8], [1, 5]], 'o2').px(3, 5, 'y').px(3, 6, 'w').outline('r2'));
// Level-up sparkle.
add('glint', G(7).line(3, 0, 3, 6, 'y').line(0, 3, 6, 3, 'y').px(3, 3, 'w'), G(7).line(3, 1, 3, 5, 'w').line(1, 3, 5, 3, 'w'), G(7).px(3, 3, 'y').px(3, 2, 'y').px(2, 3, 'y').px(4, 3, 'y').px(3, 4, 'y'));

// ---------- pack into one sheet ----------
const names = Object.keys(S), atlas = {};
let W = 256, x = 1, y = 1, rowH = 0;
for (const n of names) {
  const fr = S[n], fw = fr[0].w, fh = fr[0].h, w = fw * fr.length;
  if (x + w + 1 > W) { x = 1; y += rowH + 1; rowH = 0; }
  atlas[n] = { x, y, w: fw, h: fh, n: fr.length };
  x += w + 1; rowH = Math.max(rowH, fh);
}
const H = y + rowH + 1, buf = Buffer.alloc(W * H * 4);
for (const n of names) S[n].forEach((g, f) => {
  const a = atlas[n];
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    const c = g.d[j * g.w + i]; if (!c) continue;
    const [r, gg, b] = hex(c), o = ((a.y + j) * W + a.x + f * a.w + i) * 4;
    buf[o] = r; buf[o + 1] = gg; buf[o + 2] = b; buf[o + 3] = Math.round(255 * (g.a ?? 1));
  }
});

// Minimal PNG writer (RGBA, no dependencies).
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
export function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let j = 0; j < h; j++) rgba.copy(raw, j * (w * 4 + 1) + 1, j * w * 4, (j + 1) * w * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(ROOT, 'public/sprites/items.png'), png(W, H, buf));
fs.writeFileSync(path.join(ROOT, 'src/atlas.js'),
  `// Generated by art/make_pixels.mjs. Do not edit by hand.\n// name → { x, y, w, h, n }: n frames side by side in public/sprites/items.png.\nexport const ATLAS_SIZE = { w: ${W}, h: ${H} };\nexport const ATLAS = ${JSON.stringify(atlas)};\nexport const PAL = ${JSON.stringify(PAL)};\n`);
console.log(`items.png ${W}x${H}, ${names.length} sprites`);
