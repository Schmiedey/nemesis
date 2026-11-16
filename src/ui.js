// HTML overlays: start, death, level-up, pause.
import { T, ALLY_LINE } from './data.js';
import { fmt } from './render.js';

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function rosterHTML(roster) {
  const ks = Object.keys(roster);
  if (!ks.length) return '<span class="sub">No allies yet. Go die to something.</span>';
  return ks.map(k => `<span class="chip" style="color:${T[k].color};border-color:${T[k].color}">${T[k].name} ×${roster[k]}</span>`).join('');
}

export function hideAll() { ['start', 'dead', 'lvl', 'pause'].forEach(hide); }

export function showStart(save) {
  hideAll();
  $('startRoster').innerHTML = rosterHTML(save.roster);
  $('startBest').textContent = save.runs ? `Best: ${fmt(save.best)} · Runs: ${save.runs}` : '';
  show('start');
}

export function showDead(g, save, { first, newBest }) {
  const d = T[g.killer];
  $('dTitle').innerHTML = `Killed by the <span style="color:${d.color}">${d.name}</span>`;
  $('dJoin').textContent = first ? ALLY_LINE[g.killer] : `Another ${d.name} joins your side. (×${save.roster[g.killer]})`;
  $('dStats').innerHTML = `Survived ${fmt(g.t)} · ${g.kills} kills · level ${g.P.lvl}` +
    (newBest ? ' · <b style="color:#ffd23f">NEW BEST</b>' : ` · best ${fmt(save.best)}`);
  $('deadRoster').innerHTML = rosterHTML(save.roster);
  const nxt = Object.values(T).filter(x => x.unlock > g.t).sort((a, b) => a.unlock - b.unlock)[0];
  $('dTease').innerHTML = nxt ? `Something new shows up at <b style="color:#fff">${fmt(nxt.unlock)}</b>...` : 'You have met every nemesis. How long can you last?';
  show('dead');
}

export function showLevel(g, onPick) {
  const el = $('cards'); el.innerHTML = '';
  g.choices.forEach((u, i) => {
    const c = document.createElement('div'); c.className = 'card';
    c.innerHTML = `<b>${i + 1}. ${u.n}</b><span>${u.d}</span>`;
    c.onclick = () => onPick(i);
    el.appendChild(c);
  });
  show('lvl');
}

export const hideLevel = () => hide('lvl');
export const setPause = on => on ? show('pause') : hide('pause');
export const onReset = fn => { $('reset').onclick = fn; };
