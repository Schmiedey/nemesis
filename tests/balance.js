// Balance report: `node tests/balance.js`. Simulated runs with a dodging bot.
import { simulate, kiter, still } from './bot.js';

const nem = (id, type, q, perks = {}) => ({ id, type, q, perks, name: 'N' + id, title: '' });
const PREF = ['dmg', 'haste', 'shots', 'pierce', 'tough', 'regen', 'rally', 'pack', 'wind', 'spd', 'magnet'];
const choose = g => { let b = 0; g.choices.forEach((u, i) => { if (PREF.indexOf(u.id) < PREF.indexOf(g.choices[b].id)) b = i; }); return b; };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function report(label, opts) {
  const runs = SEEDS.map(s => simulate(s, { bot: kiter, choose, ...opts }));
  const ts = runs.map(g => g.t).sort((a, b) => a - b);
  const wins = runs.filter(g => g.state === 'won').length;
  const boss = runs.filter(g => g.bossAt).length;
  const killers = {}; runs.forEach(g => { if (g.killer) killers[g.killer] = (killers[g.killer] || 0) + 1; });
  console.log(label.padEnd(26), 'median', ts[4].toFixed(0).padStart(3) + 's', ' min', ts[0].toFixed(0).padStart(3), ' max', ts[7].toFixed(0).padStart(3),
    ' reachedBoss', boss, ' wins', wins, ' lvl', Math.round(runs.reduce((a, g) => a + g.P.lvl, 0) / 8), JSON.stringify(killers));
}

report('still bot, no party', { bot: still });
report('no party', {});
report('3 runts', { party: [nem(1, 'bat', 0.4), nem(2, 'slime', 0.4), nem(3, 'bat', 0.4)] });
report('3 soldiers', { party: [nem(1, 'bat', 1), nem(2, 'slime', 1), nem(3, 'archer', 1)] });
report('3 veterans + perks', { party: [nem(1, 'brute', 1.7, { shots: 2, pierce: 1 }), nem(2, 'archer', 1.7, { dmg: 2, haste: 2 }), nem(3, 'wisp', 1.7, { dmg: 2 })] });
report('3 champions + perks', { party: [nem(1, 'brute', 2.8, { shots: 3, pierce: 2, dmg: 3 }), nem(2, 'archer', 2.8, { dmg: 3, haste: 3, shots: 3 }), nem(3, 'bomber', 2.8, { dmg: 3 })] });
