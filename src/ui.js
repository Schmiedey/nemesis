// HTML overlays: start (draft), death, win, level-up, pause.
import { T, PERKS, rankName } from './data.js';
import { PARTY_SIZE } from './save.js';
import { fmt } from './render.js';

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const perkText = perks => Object.keys(perks).map(k => `${PERKS[k].label}${perks[k] > 1 ? ' ×' + perks[k] : ''}`).join(', ');

function nemCard(n, picked) {
  const d = T[n.type];
  return `<b style="color:${d.color}">${esc(n.name)} ${esc(n.title)}</b>` +
    `<span>${rankName(n.q)} ${d.name}</span>` +
    `<span class="perks">${perkText(n.perks) || 'no inherited powers'}</span>` +
    (picked === undefined ? '' : `<span class="tag">${picked ? 'IN PARTY' : 'click to add'}</span>`);
}

export function hideAll() { ['start', 'dead', 'won', 'lvl', 'pause'].forEach(hide); }

// Draft screen: click nemeses to choose up to 3 for the run.
export function showStart(save, onToggle) {
  hideAll();
  const el = $('startRoster'); el.innerHTML = '';
  if (!save.nemeses.length) el.innerHTML = '<span class="sub">No nemeses yet. Go die to something. The longer you last, the stronger it joins.</span>';
  const sorted = [...save.nemeses].sort((a, b) => b.q - a.q);
  for (const n of sorted) {
    const picked = save.party.includes(n.id);
    const c = document.createElement('div');
    c.className = 'nem' + (picked ? ' on' : '');
    c.innerHTML = nemCard(n, picked);
    c.onclick = () => onToggle(n.id);
    el.appendChild(c);
  }
  $('startParty').textContent = save.nemeses.length ? `Party ${save.party.length}/${PARTY_SIZE}` : '';
  $('startBest').textContent = save.runs ? `Best: ${fmt(save.best)} · Runs: ${save.runs} · Wins: ${save.wins}` : '';
  show('start');
}

export function showDead(g, save, res, newBest) {
  const d = T[g.killer], r = g.recruit;
  $('dTitle').innerHTML = `Killed by the <span style="color:${d.color}">${d.name}</span>`;
  const who = `<b style="color:${d.color}">${esc(r.name)} ${esc(r.title)}</b>, a ${rankName(r.q)} ${d.name}`;
  $('dJoin').innerHTML =
    res.status === 'joined' ? `${who}, joins you.` :
    res.status === 'replaced' ? `${who}, takes the place of ${esc(res.old.name)}.` :
    `${who}, is too weak to earn a place. Survive longer to earn a stronger one.`;
  $('dCard').innerHTML = res.status === 'rejected' ? '' : `<div class="nem on">${nemCard(res.nem)}</div>`;
  $('dStats').innerHTML = `Survived ${fmt(g.t)} · ${g.kills} kills · level ${g.P.lvl}` +
    (newBest ? ' · <b style="color:#ffd23f">NEW BEST</b>' : ` · best ${fmt(save.best)}`);
  const nxt = Object.values(T).filter(x => x.unlock > g.t).sort((a, b) => a.unlock - b.unlock)[0];
  $('dTease').innerHTML = nxt ? `Something new shows up at <b style="color:#fff">${fmt(nxt.unlock)}</b>...`
    : g.bossAt ? 'So close. Your nemesis was right there.' : 'Your true nemesis arrives at <b style="color:#fff">5:00</b>.';
  show('dead');
}

export function showWon(g, save, promoted) {
  $('wStats').innerHTML = `${fmt(g.t)} · ${g.kills} kills · level ${g.P.lvl} · win #${save.wins}`;
  $('wParty').innerHTML = promoted.length
    ? promoted.map(n => `<div class="nem on">${nemCard(n)}</div>`).join('') : '';
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
export const onReset = fn => { $('reset').onclick = fn; };
