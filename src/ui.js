// HTML overlays: title, roster (party draft), death, win, level-up, pause.
import { T, PERKS, rankName } from './data.js';
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
    `<span>${rankName(n.q)} ${d.name}</span>` +
    `<span class="perks">${perkText(n.perks) || 'no inherited powers'}</span>` +
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

export function hideAll() { ['start', 'roster', 'dead', 'won', 'lvl', 'pause'].forEach(hide); }

// Wire every menu button once. h: { play, roster, menu, resume, reset }
export function bindMenus(h) {
  const on = (ids, fn) => ids.forEach(id => { $(id).onclick = e => { e.currentTarget.blur(); fn(); }; });
  on(['bPlay', 'bRosterPlay', 'bAgain', 'bWonAgain'], h.play);
  on(['bRoster', 'bDeadRoster', 'bWonRoster'], h.roster);
  on(['bBack', 'bDeadMenu', 'bWonMenu', 'bQuit'], h.menu);
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
  show('start');
}

// Roster: every nemesis you have earned. Click to move one in or out of the party.
export function showRoster(save, onToggle) {
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
    el.appendChild(c);
  }
  $('reset').classList.toggle('hidden', !save.nemeses.length && !save.runs);
  show('roster');
}

export function showDead(g, save, res, newBest) {
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
  $('dStats').innerHTML = stat(fmt(g.t), newBest ? 'new best' : 'survived', newBest ? 'best' : '') +
    stat(g.kills, 'kills') + stat(g.P.lvl, 'level') + (newBest ? '' : stat(fmt(save.best), 'best'));
  const nxt = Object.values(T).filter(x => x.unlock > g.t).sort((a, b) => a.unlock - b.unlock)[0];
  $('dTease').innerHTML = nxt ? `Something new shows up at <b>${fmt(nxt.unlock)}</b>...`
    : g.bossAt ? 'So close. Your nemesis was right there.' : 'Your true nemesis arrives at <b>5:00</b>.';
  show('dead');
}

export function showWon(g, save, promoted) {
  $('wStats').innerHTML = stat(fmt(g.t), 'time', 'best') + stat(g.kills, 'kills') + stat(g.P.lvl, 'level') + stat(save.wins, 'wins');
  $('wParty').innerHTML = promoted.map(n => `<div class="nem on show">${nemCard(n)}<span class="stamp">STRONGER</span></div>`).join('');
  $('wNote').textContent = promoted.length ? 'Your party grew stronger from the victory.' : 'You did it alone.';
  show('won');
}

export function showLevel(g, onPick) {
  const el = $('cards'); el.innerHTML = '';
  g.choices.forEach((u, i) => {
    const c = document.createElement('div'); c.className = 'card' + (u.ally ? ' ally' : '');
    c.innerHTML = `<b>${i + 1}. ${u.n}</b><span>${u.d}</span>`;
    c.onclick = () => onPick(i);
    el.appendChild(c);
  });
  show('lvl');
}

export const hideLevel = () => hide('lvl');
export const setPause = on => on ? show('pause') : hide('pause');
