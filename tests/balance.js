// Balance report: `node tests/balance.js`. Simulated runs with a bot that plays like a skilled person.
import { createGame, step, pick } from '../src/sim.js';
import { smart } from './bot.js';

const nem = (id, type, q, perks = {}) => ({ id, type, q, perks, name: 'N' + id, title: '' });
const PREF = ['dmg', 'haste', 'shots', 'chain', 'pierce', 'blade', 'crit', 'tough', 'nova', 'regen', 'rally', 'guard', 'bond', 'pack', 'wind', 'spd', 'magnet'];
const choose = g => { let b = 0; g.choices.forEach((u, i) => { if (PREF.indexOf(u.id) < PREF.indexOf(g.choices[b].id)) b = i; }); return b; };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

function run(seed, party, loadout = {}) {
  const g = createGame({ seed, party, loadout });
  let n = 0, firstHit = null, hp45 = null;
  while (g.state !== 'dead' && g.state !== 'won' && n++ < 900 * 60) {
    if (g.state === 'lvl') { pick(g, choose(g)); continue; }
    const before = g.P.hp;
    step(g, 1 / 60, smart(g));
    if (firstHit === null && g.P.hp < before - 1) firstHit = g.t;
    if (hp45 === null && g.t >= 45) hp45 = g.P.hp / g.P.maxhp;
  }
  return { g, firstHit: firstHit ?? g.t, hp45: hp45 ?? 0 };
}

const ROWS = (process.argv[process.argv.indexOf('--rows') + 1] || '').split(',').filter(Boolean);   // e.g. --rows champions,veterans
function report(label, party = [], loadout = {}) {
  if (process.argv.includes('--rows') && !ROWS.some(r => label.includes(r))) return;
  const rs = SEEDS.map(s => run(s, party, loadout));
  const ts = rs.map(r => r.g.t).sort((a, b) => a - b), mid = ts[Math.floor(ts.length / 2)];
  const avg = f => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  console.log(label.padEnd(22), 'median', fmt(mid), ' range', fmt(ts[0]) + '-' + fmt(ts[ts.length - 1]),
    ' boss', rs.filter(r => r.g.bossAt).length + '/' + rs.length, ' wins', rs.filter(r => r.g.state === 'won').length,
    ' firstHit', fmt(avg(r => r.firstHit)), ' hp@0:45', Math.round(avg(r => r.hp45) * 100) + '%', ' lvl', Math.round(avg(r => r.g.P.lvl)));
}

// `node tests/balance.js --weapons`: solo survival per weapon and per ability, to keep them close to the Blaster and Dash.
if (process.argv.includes('--weapons')) {
  const only = (process.argv[process.argv.indexOf('--only') + 1] || '').split(',').filter(Boolean), want = id => !only.length || only.includes(id);
  for (const w of ['blaster', 'sword', 'rang', 'flame', 'rod', 'totem']) if (want(w)) report('solo ' + w, [], { weapon: w });
  for (const a of ['shock', 'slow', 'decoy', 'rally']) if (want(a)) report('solo blaster+' + a, [], { ability: a });
  process.exit(0);
}
report('no party');
report('3 runts', [nem(1, 'bat', 0.4), nem(2, 'slime', 0.4), nem(3, 'bat', 0.4)]);
report('3 soldiers', [nem(1, 'bat', 1), nem(2, 'slime', 1), nem(3, 'bat', 1)]); // same mix as the runts, so only rank differs
report('3 veterans + perks', [nem(1, 'brute', 1.7, { shots: 2, pierce: 1 }), nem(2, 'archer', 1.7, { dmg: 2, haste: 2 }), nem(3, 'wisp', 1.7, { dmg: 2 })]);
report('3 champions + perks', [nem(1, 'brute', 2.8, { shots: 3, pierce: 2, dmg: 3 }), nem(2, 'archer', 2.8, { dmg: 3, haste: 3, shots: 3 }), nem(3, 'bomber', 2.8, { dmg: 3 })]);
