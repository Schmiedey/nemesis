// HTML overlays: title, roster (party draft), death, win, level-up, pause.
import { T, PERKS, JOB, EVOS, FEATS, WEAPONS, ABILITIES, gearOf, upName, evoOf, rankName } from './data.js';
import { canEvolve, boonsOf, today } from './save.js';
import { PARTY_SIZE } from './save.js';
import { fmt } from './render.js';

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const perkText = perks => Object.keys(perks).map(k => `${PERKS[k].label}${perks[k] > 1 ? ' ×' + perks[k] : ''}`).join(', ');

const spr = (type, px = 48) => `<i class="spr" style="--s:${px}px;background-image:url(sprites/${type}.png)"></i>`;
const stat = (v, label, cls = '') => `<div class="stat ${cls}"><b>${v}</b><span>${label}</span></div>`;

function nemCard(n, picked) {
  const d = T[n.type];
  return spr(n.type) + `<div><b style="color:${d.color}">${esc(n.name)} ${esc(n.title)}</b>` +
    `<span>${rankName(n.q)} ${d.name}${evoOf(n) ? ` · <b class="evo">${evoOf(n).n}</b>` : ''}</span>` +
    `<span class="job">${evoOf(n) ? evoOf(n).d + '. ' : ''}${JOB[n.type]}</span>` +
    `<span class="perks">${perkText(n.perks) || 'no inherited powers'}</span>` +
    (n.runs ? `<span class="hist">${n.runs} run${n.runs > 1 ? 's' : ''} · ${n.kills} kill${n.kills === 1 ? '' : 's'}${n.wins ? ' · ' + n.wins + ' win' + (n.wins > 1 ? 's' : '') : ''}</span>` : '') +
    (picked === undefined ? '' : `<span class="pick">${picked ? '✓ IN PARTY' : 'click to add'}</span>`) + '</div>';
}

function slots(save) {
  const party = save.party.map(id => save.nemeses.find(n => n.id === id)).filter(Boolean);
  let h = '';
  for (let i = 0; i < PARTY_SIZE; i++) {
    const n = party[i];
    h += n ? `<div class="slot full">${spr(n.type, 40)}<div><b style="color:${T[n.type].color}">${esc(n.name)}</b><span>${rankName(n.q)} ${T[n.type].name}</span></div></div>`
      : '<div class="slot">empty slot</div>';
  }
  return h;
}

// One row per party member after a run: kills made, growth toward the next rank.
function growthCards(rows) {
  return rows.map(r => {
    const d = T[r.nem.type], pct = q => Math.round(Math.min(1, (q - 0.3) / 2.7) * 100);
    return `<div class="nem on show grow">${spr(r.nem.type)}<div><b style="color:${d.color}">${esc(r.nem.name)} ${esc(r.nem.title)}</b>` +
      `<span>${rankName(r.after)} ${d.name} · ${r.kills} kill${r.kills === 1 ? '' : 's'} this run</span>` +
      `<span class="bar"><i style="width:${pct(r.before)}%"></i><i class="gain" style="left:${pct(r.before)}%;width:${pct(r.after) - pct(r.before)}%"></i></span>` +
      (r.canEvolve ? '<span class="pick" style="color:var(--gold)">Ready to evolve: open the roster</span>' : '') + '</div>' +
      (r.rankUp ? '<span class="stamp">RANK UP</span>' : '') + '</div>';
  }).join('');
}

export function hideAll() { ['start', 'roster', 'feats', 'loadout', 'dead', 'won', 'lvl', 'pause'].forEach(hide); }
const gearLines = ids => ids.map(id => `<div class="nem on show gear"><i class="ico">${gearOf(id).i}</i><div><b>${gearOf(id).n}</b><span>${gearOf(id).d}</span></div><span class="stamp">NEW GEAR</span></div>`).join('');

const featLines = feats => feats.map(f => `<div class="feat got"><b>FEAT: ${f.n}</b><span>${f.d}. Boon unlocked: ${upName(f.boon)}</span></div>`).join('');
const KIND = { hard: 'Nemesis+', daily: 'Daily' };

// Wire every menu button once. h: { play, roster, menu, resume, reset }
export function bindMenus(h) {
  const on = (ids, fn) => ids.forEach(id => { $(id).onclick = e => { e.currentTarget.blur(); fn(); }; });
  on(['bPlay', 'bRosterPlay'], h.play);
  on(['bAgain', 'bWonAgain'], h.again);
  on(['bDaily'], h.daily); on(['bHard'], h.hard); on(['bBoon'], h.boon); on(['bFeats'], h.feats); on(['bLoadout'], h.loadout);
  on(['bRoster', 'bDeadRoster', 'bWonRoster'], h.roster);
  on(['bBack', 'bFeatsBack', 'bLoadoutBack', 'bDeadMenu', 'bWonMenu', 'bQuit'], h.menu);
  on(['bResume'], h.resume);
  on(['reset'], h.reset);
}

// Title screen: logo, current party, the boss you have earned, lifetime stats.
export function showStart(save, bossType) {
  hideAll();
  $('startParty').innerHTML = save.nemeses.length ? slots(save) : '';
  const b = T[bossType], n = save.deaths[bossType] || 0;
  $('startBoss').innerHTML = !save.nemeses.length && !n
    ? 'No nemeses yet. Go die to something. The longer you last, the stronger it joins.'
    : n ? `Your true nemesis: the <b style="color:${b.color}">${b.name}</b>, which has killed you ${n} time${n > 1 ? 's' : ''}. It comes at <b>5:00</b>.`
      : 'Your true nemesis comes at <b>5:00</b>.';
  $('startStats').innerHTML = save.runs
    ? stat(fmt(save.best), 'best', 'best') + stat(save.runs, 'runs') + stat(save.wins, 'wins') + stat(save.nemeses.length, 'nemeses') : '';
  // Ways to play: today's fixed run, the harder mode (after a first win), a starting boon, and feats.
  const d = save.daily.date === today() ? save.daily : null, got = FEATS.filter(f => save.feats[f.id]).length;
  $('bDaily').querySelector('b').textContent = d ? (d.won ? 'won ' : '') + fmt(d.best) : 'not played';
  $('bHard').classList.toggle('hidden', !save.wins);
  $('bHard').classList.toggle('lit', save.hard);
  $('bHard').querySelector('b').textContent = save.hard ? 'ON' : 'OFF';
  $('bBoon').classList.toggle('hidden', !boonsOf(save).length);
  $('bBoon').querySelector('b').textContent = save.boon ? upName(save.boon) : 'none';
  $('bFeats').querySelector('b').textContent = `${got}/${FEATS.length}`;
  $('bLoadout').querySelector('b').textContent = `${WEAPONS[save.gear.loadout.weapon].n} + ${ABILITIES[save.gear.loadout.ability].n}`;
  if (save.bestHard) $('startStats').innerHTML += stat(fmt(save.bestHard), 'best N+');
  show('start');
}

// Loadout: pick one weapon and one ability from the gear you have found.
export function showLoadout(save, onEquip) {
  hideAll();
  const col = (el, table, cur) => {
    el.innerHTML = '';
    for (const id in table) {
      const have = save.gear.owned.includes(id), it = table[id];
      const c = document.createElement('div');
      c.className = 'nem gearcard' + (id === cur ? ' on' : '') + (have ? '' : ' locked');
      c.innerHTML = `<i class="ico">${have ? it.i : '?'}</i><div><b>${have ? it.n : 'Not found yet'}</b><span>${have ? it.d : 'Dropped by your nemesis and by elite chests.'}</span>` +
        (have ? `<span class="pick">${id === cur ? '✓ EQUIPPED' : 'click to equip'}</span>` : '') + '</div>';
      if (have) c.onclick = () => onEquip(id);
      el.appendChild(c);
    }
  };
  col($('loWeapons'), WEAPONS, save.gear.loadout.weapon);
  col($('loAbilities'), ABILITIES, save.gear.loadout.ability);
  show('loadout');
}

// Feats: what each asks for and the boon it unlocks.
export function showFeats(save) {
  hideAll();
  $('featList').innerHTML = FEATS.map(f => {
    const got = save.feats[f.id];
    return `<div class="feat${got ? ' got' : ''}"><b>${got ? '✓ ' : ''}${f.n}</b><span>${f.d}</span><em>Boon: ${upName(f.boon)}</em></div>`;
  }).join('');
  show('feats');
}

// Roster: every nemesis you have earned. Click to move one in or out of the party.
export function showRoster(save, onToggle, onEvo) {
  hideAll();
  const el = $('rosterList'); el.innerHTML = '';
  $('rosterHint').innerHTML = save.nemeses.length
    ? `Pick up to ${PARTY_SIZE} to fight beside you. Party <b>${save.party.length}/${PARTY_SIZE}</b>`
    : 'Empty. Whatever kills you will show up here.';
  $('rosterParty').innerHTML = save.nemeses.length ? slots(save) : '';
  const sorted = [...save.nemeses].sort((a, b) => b.q - a.q);
  for (const n of sorted) {
    const picked = save.party.includes(n.id);
    const c = document.createElement('div');
    c.className = 'nem' + (picked ? ' on' : '');
    c.innerHTML = nemCard(n, picked);
    c.onclick = () => onToggle(n.id);
    if (canEvolve(n)) {
      // A Champion chooses one of two evolutions, once.
      c.classList.add('evolve');
      const box = document.createElement('div'); box.className = 'evos';
      box.innerHTML = '<span class="pick" style="color:var(--gold)">CHAMPION: choose an evolution</span>';
      for (const ev of EVOS[n.type]) {
        const b = document.createElement('button'); b.innerHTML = `<b>${ev.n}</b><span>${ev.d}</span>`;
        b.onclick = e => { e.stopPropagation(); onEvo(n.id, ev.id); };
        box.appendChild(b);
      }
      c.appendChild(box);
    }
    el.appendChild(c);
  }
  $('reset').classList.toggle('hidden', !save.nemeses.length && !save.runs);
  show('roster');
}

export function showDead(g, save, res, end) {
  const { newBest, growth = [], feats = [], best, kind } = end;
  const d = T[g.killer], r = g.recruit;
  $('dKiller').style.setProperty('--c', d.color);
  $('dKiller').innerHTML = spr(g.killer, 112);
  $('dTitle').innerHTML = `KILLED BY THE <span style="color:${d.color}">${d.name.toUpperCase()}</span>`;
  const who = `<b style="color:${d.color}">${esc(r.name)} ${esc(r.title)}</b>, a ${rankName(r.q)} ${d.name}`;
  $('dJoin').innerHTML =
    res.status === 'joined' ? `${who}, joins you.` :
    res.status === 'replaced' ? `${who}, takes the place of ${esc(res.old.name)}.` :
    `${who}, is too weak to earn a place. Survive longer to earn a stronger one.`;
  $('dCard').innerHTML = res.status === 'rejected' ? ''
    : `<div class="nem on show">${nemCard(res.nem)}<span class="stamp">RECRUITED</span></div>`;
  $('dCard').innerHTML += growthCards(growth.filter(r => r.nem !== res.old));
  $('dStats').innerHTML = stat(fmt(g.t), newBest ? 'new best' : 'survived', newBest ? 'best' : '') +
    stat(g.kills, 'kills') + stat(g.P.lvl, 'level') + (newBest ? '' : stat(fmt(best), 'best')) + (KIND[kind] ? stat(KIND[kind], 'mode') : '');
  $('dFeats').innerHTML = gearLines(end.gear || []) + featLines(feats);
  const nxt = Object.values(T).filter(x => x.unlock > g.t).sort((a, b) => a.unlock - b.unlock)[0];
  $('dTease').innerHTML = nxt ? `Something new shows up at <b>${fmt(nxt.unlock)}</b>...`
    : g.bossAt ? 'So close. Your nemesis was right there.' : 'Your true nemesis arrives at <b>5:00</b>.';
  show('dead');
}

export function showWon(g, save, end) {
  const { growth = [], feats = [], kind } = end;
  $('wFeats').innerHTML = gearLines(end.gear || []) + featLines(feats);
  $('wStats').innerHTML = stat(fmt(g.t), 'time', 'best') + stat(g.kills, 'kills') + stat(g.P.lvl, 'level') + stat(save.wins, 'wins') + (KIND[kind] ? stat(KIND[kind], 'mode') : '');
  $('wParty').innerHTML = growthCards(growth);
  $('wNote').textContent = growth.length ? 'Your party grew stronger from the victory.' : 'You did it alone.';
  show('won');
}

export function showLevel(g, onPick) {
  const el = $('cards'); el.innerHTML = '';
  $('lvlTitle').textContent = g.chest ? 'CHEST: DOUBLE STRENGTH' : 'LEVEL UP';
  g.choices.forEach((u, i) => {
    const c = document.createElement('div'); c.className = 'card' + (u.ally ? ' ally' : '') + (g.chest ? ' chest' : '');
    const have = g.picks[u.id] || 0;
    const d = (WEAPONS[g.P.weapon].up || {})[u.id] || u.d;   // some upgrades mean something different per weapon
    c.innerHTML = `<i class="ico">${u.i || '•'}</i><b>${u.n}</b><span>${d}</span>` +
      `<em>${u.ally ? 'for your nemeses' : have ? 'you have ' + have : 'new'}</em><kbd class="key mouse-only">${i + 1}</kbd>`;
    c.onclick = () => onPick(i);
    el.appendChild(c);
  });
  show('lvl');
}

export const hideLevel = () => hide('lvl');
export const setPause = on => on ? show('pause') : hide('pause');
