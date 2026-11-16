// HTML overlays: title, roster (party draft), death, win, level-up, pause.
import { T, PERKS, JOB, EVOS, FEATS, WEAPONS, ABILITIES, CHARMS, CLASSES, META, MASTERY, MAX_TIER, masteryLevel, gearOf, upName, evoOf, rankName } from './data.js';
import { canEvolve, boonsOf, today, metaCost, completion } from './save.js';
import { ATLAS, ATLAS_SIZE } from './atlas.js';
import { PARTY_SIZE } from './save.js';
import { fmt } from './render.js';

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const perkText = perks => Object.keys(perks).map(k => `${PERKS[k].label}${perks[k] > 1 ? ' ×' + perks[k] : ''}`).join(', ');

// A sprite from the sheet as an HTML element, k screen pixels per art pixel. Two-frame sprites animate.
const pix = (name, k = 3, anim = false) => {
  const a = ATLAS[name]; if (!a) return '';
  return `<i class="px${anim && a.n > 1 ? ' a2' : ''}" style="width:${a.w * k}px;height:${a.h * k}px;background-size:${ATLAS_SIZE.w * k}px ${ATLAS_SIZE.h * k}px;background-position:${-a.x * k}px ${-a.y * k}px;--x1:${-(a.x + a.w * (a.n >= 4 ? 2 : 1)) * k}px"></i>`;
};
const spr = (type, px = 48) => pix('c_' + type, Math.max(2, Math.round(px / 20)), true);
const stat = (v, label, cls = '') => `<div class="stat ${cls}"><b>${v}</b><span>${label}</span></div>`;

function nemCard(n, picked) {
  const d = T[n.type];
  return spr(n.type) + `<div><b style="color:${d.color}">${esc(n.name)} ${esc(n.title)}</b>` +
    `<span>${rankName(n.q)} ${d.name}${evoOf(n) ? ` · <b class="evo">${evoOf(n).n}</b>` : ''}</span>` +
    `<span class="job">${evoOf(n) ? evoOf(n).d + '. ' : ''}${JOB[n.type]}</span>` +
    `<span class="perks">${perkText(n.perks) || 'no inherited powers'}</span>` +
    (n.runs ? `<span class="hist">${n.runs} run${n.runs > 1 ? 's' : ''} · ${n.kills} kill${n.kills === 1 ? '' : 's'}${n.wins ? ' · ' + n.wins + ' win' + (n.wins > 1 ? 's' : '') : ''}</span>` : '') +
    (picked === undefined ? '' : `<span class="pick">${picked ? 'IN PARTY' : 'click to add'}</span>`) + '</div>';
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

export function hideAll() { ['start', 'classes', 'shrine', 'roster', 'feats', 'loadout', 'dead', 'won', 'lvl', 'pause'].forEach(hide); }
const gearLines = ids => ids.map(id => `<div class="nem on show gear">${pix('i_' + id, 3)}<div><b>${gearOf(id).n}</b><span>${gearOf(id).d}</span></div><span class="stamp">NEW GEAR</span></div>`).join('');

const featLines = feats => feats.map(f => `<div class="feat got">${pix('i_trophy', 2)}<div><b>FEAT: ${f.n}</b><span>${f.d}. Boon unlocked: ${upName(f.boon)}</span></div></div>`).join('');
const KIND = { hard: 'Nemesis+', daily: 'Daily' };

// Wire every menu button once. h: { play, roster, menu, resume, reset }
export function bindMenus(h) {
  const on = (ids, fn) => ids.forEach(id => { $(id).onclick = e => { e.currentTarget.blur(); fn(); }; });
  on(['bPlay', 'bRosterPlay'], h.play);
  on(['bAgain', 'bWonAgain'], h.again);
  on(['bDaily'], h.daily); on(['bHard'], h.hard); on(['bBoon'], h.boon); on(['bFeats'], h.feats); on(['bLoadout'], h.loadout); on(['bClass'], h.classes); on(['bShrine'], h.shrine); on(['bReroll'], h.reroll);
  on(['bRoster', 'bDeadRoster', 'bWonRoster'], h.roster);
  on(['bBack', 'bFeatsBack', 'bLoadoutBack', 'bClassBack', 'bShrineBack', 'bDeadMenu', 'bWonMenu', 'bQuit'], h.menu);
  on(['bResume'], h.resume);
  on(['reset'], h.reset);
}

// Title screen: logo, current party, the boss you have earned, lifetime stats.
// Title: the menu list on the left with what each item is set to; your character on the stage on the right.
export function showStart(save, bossType) {
  hideAll();
  const cls = CLASSES[save.cls], lo = save.gear.loadout, party = save.party.map(id => save.nemeses.find(n => n.id === id)).filter(Boolean);
  const chip = id => `<span class="chip">${pix('i_' + id, 1)}${gearOf(id).n}</span>`;
  $('stageScene').innerHTML = `<div class="party">${party.map(n => pix('c_' + n.type, 3, true)).join('')}</div>` + pix(cls.sprite, 6, true) + pix('c_' + cls.minion, 4, true);
  const b = T[bossType], n = save.deaths[bossType] || 0;
  $('stageInfo').innerHTML = `<h3>${cls.n.toUpperCase()}</h3><div>${cls.d}</div><div class="min">${cls.md}</div>` +
    `<div class="chips">${chip(lo.weapon)}${chip(lo.ability)}${lo.charm ? chip(lo.charm) : ''}</div>` +
    `<div class="boss">${n ? `Your true nemesis: the <b style="color:${b.color}">${b.name}</b>, ${n} kill${n > 1 ? 's' : ''} on you. It comes at <b>5:00</b>.` : 'Whatever kills you joins your roster. Your nemesis comes at <b>5:00</b>.'}</div>`;
  const set = (id, text) => { $(id).querySelector('b').textContent = text; };
  const d = save.daily.date === today() ? save.daily : null, got = FEATS.filter(f => save.feats[f.id]).length;
  set('bDaily', d ? (d.won ? 'won ' : '') + fmt(d.best) : 'not played');
  set('bClass', cls.n);
  set('bLoadout', WEAPONS[lo.weapon].n + ' + ' + ABILITIES[lo.ability].n);
  set('bRoster', save.nemeses.length ? `${party.length}/${PARTY_SIZE} of ${save.nemeses.length}` : 'empty');
  set('bFeats', `${got}/${FEATS.length}`);
  $('bHard').classList.toggle('hidden', !save.tierMax); $('bHard').classList.toggle('lit', save.tier > 0); set('bHard', save.tier ? `TIER ${save.tier} OF ${save.tierMax}` : 'OFF');
  set('bShrine', save.souls + ' souls');
  $('bBoon').classList.toggle('hidden', !boonsOf(save).length); set('bBoon', save.boon ? upName(save.boon) : 'none');
  $('startStats').innerHTML = save.runs
    ? stat(fmt(save.best), 'best', 'best') + stat(save.runs, 'runs') + stat(save.wins, 'wins') + (save.bestHard ? stat(fmt(save.bestHard), 'best N+') : '') + stat(completion(save) + '%', 'complete') : '';
  show('start');
}

// Mastery: five stars and a bar toward the next level.
const stars = lvl => `<div class="stars">${[0, 1, 2, 3, 4].map(i => pix(i <= lvl ? 'i_star' : 'i_star0', 2)).join('')}</div>`;
const masteryBar = (before, after) => {
  const L = masteryLevel(after), lo = L ? MASTERY[L - 1] : 0, hi = MASTERY[L];
  if (hi === undefined) return '<span class="bar"><i style="width:100%"></i></span>';
  const pct = v => Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100);
  return `<span class="bar"><i style="width:${pct(before)}%"></i><i class="gain" style="left:${pct(before)}%;width:${pct(after) - pct(before)}%"></i></span>`;
};

// What a run earned: souls, class mastery, anything newly unlocked.
function progLines(p, save) {
  if (!p) return '';
  const c = CLASSES[p.cls];
  let h = `<div class="nem on show gear soul">${pix('i_soul', 3)}<div><b>+${p.souls} SOULS</b><span>You now have ${save.souls}. Spend them at the Shrine.</span></div></div>`;
  if (c) h += `<div class="nem on show grow">${pix(c.sprite, 2, true)}<div><b>${c.n.toUpperCase()} MASTERY ${masteryLevel(p.after) + 1}</b>` +
    `<span>${masteryLevel(p.after) >= 4 ? 'Mastered.' : 'Each level makes your minion 15% stronger.'}</span>${masteryBar(p.before, p.after)}</div>${p.levelUp ? '<span class="stamp">LEVEL UP</span>' : ''}</div>`;
  for (const id of p.classes) h += `<div class="nem on show gear">${pix(CLASSES[id].sprite, 2, true)}<div><b>${CLASSES[id].n.toUpperCase()}</b><span>${CLASSES[id].d}</span></div><span class="stamp">CLASS UNLOCKED</span></div>`;
  if (p.tierUp) h += `<div class="nem on show gear">${pix('i_skull', 3)}<div><b>NEMESIS+ TIER ${p.tierUp}</b><span>A harder run with ${25 * p.tierUp}% more souls. Switch it on from the menu.</span></div><span class="stamp">UNLOCKED</span></div>`;
  return h;
}

// The Shrine: permanent upgrades bought with souls.
export function showShrine(save, onBuy) {
  hideAll();
  $('shrineSouls').innerHTML = pix('i_soul', 2) + save.souls;
  const el = $('shrineList'); el.innerHTML = '';
  for (const m of META) {
    const r = save.meta[m.id] || 0, cost = metaCost(save, m.id), c = document.createElement('div');
    c.className = 'mcard' + (cost === null ? ' max' : '');
    c.innerHTML = `${pix(m.i, 3)}<div><b>${m.n.toUpperCase()}</b><span>${m.d}</span><div class="pips">${m.cost.map((_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const b = document.createElement('button');
    b.innerHTML = cost === null ? 'MAX' : pix('i_soul', 1) + cost;
    b.disabled = cost === null || save.souls < cost;
    b.onclick = () => onBuy(m.id);
    c.appendChild(b); el.appendChild(c);
  }
  show('shrine');
}

// Class: three cards; each shows the hero, its minion and what they do.
export function showClasses(save, onPick) {
  hideAll();
  const el = $('classList'); el.innerHTML = '';
  for (const id in CLASSES) {
    const c = CLASSES[id], card = document.createElement('div'), have = save.classes.includes(id), xp = save.mastery[id] || 0;
    card.className = 'cls' + (id === save.cls ? ' on' : '') + (have ? '' : ' locked');
    const [got, want] = c.lock ? c.lock.need(save) : [1, 1];
    card.innerHTML = `<div class="scene">${pix(c.sprite, 5, true)}${pix('c_' + c.minion, c.minion === 'golem' ? 3 : 4, true)}${id === 'necro' ? pix('c_skeleton', 3, true) : ''}</div>` +
      `<h3>${c.n.toUpperCase()}</h3>` +
      (have ? `${stars(masteryLevel(xp))}${masteryBar(xp, xp)}<p>${c.d}</p><p class="min">${c.md}</p><span class="pick">${id === save.cls ? 'PLAYING' : 'click to choose'}</span>`
        : `<p>${c.d}</p><p class="min">${c.md}</p><div class="need">${pix('i_lock', 1)}${c.lock.text.toUpperCase()}</div><span class="bar"><i style="width:${Math.round(Math.min(1, got / want) * 100)}%"></i></span><span class="pick">${Math.min(got, want).toLocaleString()} / ${want.toLocaleString()}</span>`);
    if (have) card.onclick = () => onPick(id);
    el.appendChild(card);
  }
  show('classes');
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
      c.innerHTML = `${pix(have ? 'i_' + id : 'i_lock', 3)}<div><b>${have ? it.n : 'Not found yet'}</b><span>${have ? it.d : 'Dropped by your nemesis and by elite chests.'}</span>` +
        (have ? `<span class="pick">${id === cur ? 'EQUIPPED' : 'click to equip'}</span>` : '') + '</div>';
      if (have) c.onclick = () => onEquip(id);
      el.appendChild(c);
    }
  };
  col($('loWeapons'), WEAPONS, save.gear.loadout.weapon);
  col($('loAbilities'), ABILITIES, save.gear.loadout.ability);
  col($('loCharms'), CHARMS, save.gear.loadout.charm);
  show('loadout');
}

// Feats: what each asks for and the boon it unlocks.
export function showFeats(save) {
  hideAll();
  $('featList').innerHTML = FEATS.map(f => {
    const got = save.feats[f.id];
    return `<div class="feat${got ? ' got' : ''}">${pix(got ? 'i_trophy' : 'i_lock', 2)}<div><b>${f.n}</b><span>${f.d}</span><em>Boon: ${upName(f.boon)}</em></div></div>`;
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
  $('dProg').innerHTML = progLines(end.prog, save);
  $('dFeats').innerHTML = gearLines(end.gear || []) + featLines(feats);
  const nxt = Object.values(T).filter(x => !x.minion && x.unlock > g.t).sort((a, b) => a.unlock - b.unlock)[0];
  $('dTease').innerHTML = nxt ? `Something new shows up at <b>${fmt(nxt.unlock)}</b>...`
    : g.bossAt ? 'So close. Your nemesis was right there.' : 'Your true nemesis arrives at <b>5:00</b>.';
  show('dead');
}

export function showWon(g, save, end) {
  const { growth = [], feats = [], kind } = end;
  $('wProg').innerHTML = progLines(end.prog, save);
  $('wFeats').innerHTML = gearLines(end.gear || []) + featLines(feats);
  $('wStats').innerHTML = stat(fmt(g.t), 'time', 'best') + stat(g.kills, 'kills') + stat(g.P.lvl, 'level') + stat(save.wins, 'wins') + (KIND[kind] ? stat(KIND[kind], 'mode') : '');
  $('wParty').innerHTML = growthCards(growth);
  $('wNote').textContent = growth.length ? 'Your party grew stronger from the victory.' : 'You did it alone.';
  show('won');
}

export function showLevel(g, onPick) {
  const el = $('cards'); el.innerHTML = '';
  $('lvlTitle').textContent = g.chest ? 'CHEST: DOUBLE STRENGTH' : 'LEVEL UP';
  $('bReroll').classList.toggle('hidden', !(g.rerolls > 0)); $('bReroll').querySelector('b').textContent = g.rerolls || '';
  g.choices.forEach((u, i) => {
    const c = document.createElement('div'); c.className = 'card' + (u.ally ? ' ally' : '') + (g.chest ? ' chest' : '');
    const have = g.picks[u.id] || 0;
    const d = (WEAPONS[g.P.weapon].up || {})[u.id] || u.d;   // some upgrades mean something different per weapon
    c.innerHTML = `${pix('i_' + u.id, 4)}<b>${u.n}</b><span>${d}</span>` +
      `<em>${u.ally ? 'for your nemeses' : have ? 'you have ' + have : 'new'}</em><kbd class="key mouse-only">${i + 1}</kbd>`;
    c.onclick = () => onPick(i);
    el.appendChild(c);
  });
  show('lvl');
}

export const hideLevel = () => hide('lvl');
// The chosen card flashes and grows; the others drop away.
export function pickCard(i) { [...$('cards').children].forEach((c, k) => c.classList.add(k === i ? 'picked' : 'gone')); }
export const setPause = on => on ? show('pause') : hide('pause');
