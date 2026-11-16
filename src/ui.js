// HTML overlays: title, roster (party draft), death, win, level-up, pause.
import { T, PERKS, JOB, EVOS, FEATS, WEAPONS, ABILITIES, CHARMS, CLASSES, META, MASTERY, MAX_TIER, MISSIONS, RARITY, RARITIES, upText, masteryLevel, gearOf, upName, evoOf, rankName } from './data.js';
import { canEvolve, boonsOf, today, metaCost, completion, nextGoals } from './save.js';
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

export function hideAll() { ['start', 'classes', 'shrine', 'missions', 'roster', 'feats', 'loadout', 'dead', 'won', 'lvl', 'pause'].forEach(hide); }
const gearLines = ids => ids.map(id => `<div class="nem on show gear">${pix('i_' + id, 3)}<div><b>${gearOf(id).n}</b><span>${gearOf(id).d}</span></div><span class="stamp">NEW GEAR</span></div>`).join('');

const featLines = feats => feats.map(f => `<div class="feat got">${pix('i_trophy', 2)}<div><b>FEAT: ${f.n}</b><span>${f.d}. Boon unlocked: ${upName(f.boon)}</span></div></div>`).join('');
const KIND = { hard: 'Nemesis+', daily: 'Daily' };

// Wire every menu button once. h: { play, roster, menu, resume, reset }
export function bindMenus(h) {
  const on = (ids, fn) => ids.forEach(id => { $(id).onclick = e => { e.currentTarget.blur(); fn(); }; });
  on(['bPlay', 'bRosterPlay'], h.play);
  on(['bAgain', 'bWonAgain'], h.again);
  on(['bHome'], h.menu); on(['bMissions'], h.missions); on(['bDaily'], h.daily); on(['bHard'], h.hard); on(['bBoon'], h.boon); on(['bFeats'], h.feats); on(['bLoadout'], h.loadout); on(['bClass'], h.classes); on(['bShrine'], h.shrine); on(['bReroll'], h.reroll);
  on(['bRoster', 'bDeadRoster', 'bWonRoster'], h.roster);
  on(['bShare', 'bWonShare'], h.share);
  on(['bBack', 'bFeatsBack', 'bLoadoutBack', 'bClassBack', 'bShrineBack', 'bDeadMenu', 'bWonMenu', 'bQuit'], h.menu);
  on(['bResume'], h.resume);
  on(['reset'], h.reset);
}

// Title screen: logo, current party, the boss you have earned, lifetime stats.
// The hub: your hero, minion and party in a dungeon scene; one PLAY button; nothing else to read.
export function showStart(save) {
  hideAll();
  const cls = CLASSES[save.cls], lo = save.gear.loadout, party = save.party.map(id => save.nemeses.find(n => n.id === id)).filter(Boolean);
  const actor = (name, k, c = '') => `<div class="actor ${c}">${pix(name, k, true)}</div>`;
  $('hubActors').innerHTML = party.slice(0, 2).map(n => actor('c_' + n.type, n.type === 'brute' ? 4 : 5)).join('') + '<div class="gap"></div>' +
    actor(cls.sprite, 8, 'hero') + actor('c_' + cls.minion, cls.minion === 'golem' ? 4 : 6) + '<div class="gap"></div>' + party.slice(2).map(n => actor('c_' + n.type, n.type === 'brute' ? 4 : 5)).join('');
  // Enemies wander past along the back wall.
  $('hubMarch').innerHTML = ['bat', 'slime', 'archer', 'bomber', 'wisp', 'brute'].map((t, i) => pix('c_' + t, 2, true).replace('style="', `style="animation-duration:.5s,${16 + i * 5}s;animation-delay:0s,${-i * 6.5}s;`)).join('');
  $('hubPlate').innerHTML = `<h3>${cls.n.toUpperCase()}</h3>${stars(masteryLevel(save.mastery[save.cls] || 0))}` +
    `<div class="gearrow">${[lo.weapon, lo.ability, lo.charm].filter(Boolean).map(id => `<span class="gi" title="${gearOf(id).n}">${pix('i_' + id, 2)}</span>`).join('')}</div>`;
  $('hubB1').innerHTML = $('hubB2').innerHTML = pix('i_skull', 2);
  $('hubSouls').innerHTML = pix('i_soul', 2) + save.souls;
  const g = nextGoals(save)[0];
  $('hubGoal').innerHTML = g ? `<span>NEXT: ${g.text.toUpperCase()}</span><b>${Math.floor(g.have / g.want * 100)}%</b>${bar2(0, g.have, g.want)}` : '';
  const d = save.daily.date === today() ? save.daily : null;
  $('bDaily').querySelector('b').textContent = d ? (d.won ? 'WON ' : '') + fmt(d.best) : 'NOT PLAYED';
  $('bHard').classList.toggle('hidden', !save.tierMax); $('bHard').classList.toggle('lit', save.tier > 0);
  $('bHard').querySelector('b').textContent = save.tier ? `TIER ${save.tier} OF ${save.tierMax}` : 'OFF';
  show('start');
}

// The tab bar: which tab is lit, and a badge where something is waiting.
export function showTabs(save, mode) {
  const t = $('tabs'), menus = ['start', 'classes', 'loadout', 'roster', 'shrine', 'missions', 'feats'];
  t.classList.toggle('hidden', !menus.includes(mode));
  if (!menus.includes(mode)) return;
  const icons = { bHome: ['i_skull', 2], bClass: [CLASSES[save.cls].sprite, 1.5], bRoster: ['c_slime', 2], bShrine: ['i_soul', 2], bMissions: ['i_trophy', 2], bFeats: ['i_star', 3] };
  for (const b of t.children) {
    b.classList.toggle('on', b.dataset.m.split(' ').includes(mode));
    const [name, k] = icons[b.id]; if (!b.firstElementChild.firstChild) b.firstElementChild.innerHTML = pix(name, k);
    else if (b.id === 'bClass') b.firstElementChild.innerHTML = pix(name, k);
  }
  const badge = (id, v) => { const e = $(id).querySelector('.badge'); e.classList.toggle('hidden', !v); e.textContent = v === true ? '!' : v || ''; };
  const seen = save.seen || { classes: 3, gear: 2 };
  badge('bShrine', META.filter(m => { const c = metaCost(save, m.id); return c !== null && c <= save.souls; }).length || 0);   // ranks you can afford
  badge('bRoster', save.nemeses.some(canEvolve));                                                                            // a Champion ready to evolve
  badge('bClass', save.classes.length > seen.classes || save.gear.owned.length > seen.gear);                                   // a new class or new gear
  badge('bMissions', save.missions.filter(m => m.have / m.n >= 0.75).length || 0);                                             // missions nearly done
}

// Missions: the three active ones, the daily bonus, and your records.
export function showMissions(save, bossType) {
  hideAll();
  let h = '';
  for (const m of save.missions) { const t = MISSIONS.find(x => x.id === m.id); h += `<div class="qcard"><b>${t.text(m.n).toUpperCase()}</b><span>${m.have} / ${m.n}</span>${bar2(0, m.have, m.n)}${pay(t.pay)}</div>`; }
  const played = save.day.date === today(), next = Math.round(20 * (1 + 0.15 * Math.min(6, played ? save.day.streak : save.day.streak)));
  h += `<div class="qcard day"><b>DAILY BONUS</b><span>${played ? 'Collected today. Come back tomorrow for more.' : 'Finish any run today to collect it.'}</span><span>${save.day.streak > 1 ? save.day.streak + ' days in a row' : 'Play on consecutive days to grow it.'}</span>${pay(played ? 'DONE' : '+' + next)}</div>`;
  $('missionList').innerHTML = h;
  $('startStats').innerHTML = save.runs
    ? stat(fmt(save.best), 'best', 'best') + stat(save.runs, 'runs') + stat(save.wins, 'wins') + (save.bestHard ? stat(fmt(save.bestHard), 'best N+') : '') + stat(save.stats.kills.toLocaleString(), 'kills') + stat(completion(save) + '%', 'complete') : '';
  const b = T[bossType], n = save.deaths[bossType] || 0;
  $('missionBoss').innerHTML = n ? `Your true nemesis: the <b style="color:${b.color}">${b.name}</b>, with ${n} kill${n > 1 ? 's' : ''} on you. It comes at <b>5:00</b>.` : 'Whatever kills you joins your roster. Your nemesis comes at <b>5:00</b>.';
  show('missions');
}

// ---------- little celebrations ----------
// Count a number up from zero, in steps, so a reward lands with some weight.
export function countUp(el, to, ms = 700, prefix = '', suffix = '') {
  const t0 = performance.now();
  const tick = now => { const k = Math.min(1, (now - t0) / ms); el.textContent = prefix + Math.round(to * k) + suffix; if (k < 1 && el.isConnected) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
// A burst of falling coloured squares, for unlocks and records.
export function confetti(n = 46) {
  const cols = ['#fee761', '#63c74d', '#2ce8f5', '#e43b44', '#b06cff', '#f4f1e8', '#feae34'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'); d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw'; d.style.background = cols[i % cols.length];
    d.style.animationDuration = 1.2 + Math.random() * 1.4 + 's'; d.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(d); setTimeout(() => d.remove(), 3400);
  }
}
export function toast(text) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = text;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1600);
}
const bar2 = (before, after, n) => `<span class="bar"><i style="width:${Math.round(before / n * 100)}%"></i><i class="gain" style="left:${Math.round(before / n * 100)}%;width:${Math.round((after - before) / n * 100)}%"></i></span>`;
const pay = v => `<span class="pay">${pix('i_soul', 1)}${v}</span>`;
// Missions and the nearest unlock, on the title screen.
function questList(save) {
  let h = '<h4>MISSIONS</h4>';
  for (const m of save.missions) { const t = MISSIONS.find(x => x.id === m.id); h += `<div class="quest"><span>${t.text(m.n)} <b>${m.have}/${m.n}</b></span>${pay(t.pay)}${bar2(0, m.have, m.n)}</div>`; }
  const g = nextGoals(save)[0];
  if (g) h += `<h4 style="margin-top:4px">NEXT UNLOCK</h4><div class="quest next"><span>${g.text}</span><span class="pay" style="color:var(--y)">${Math.floor(g.have / g.want * 100)}%</span>${bar2(0, g.have, g.want)}</div>`;
  return h;
}

// Mastery: five stars and a bar toward the next level.
const stars = lvl => `<div class="stars">${[0, 1, 2, 3, 4].map(i => pix(i <= lvl ? 'i_star' : 'i_star0', 2)).join('')}</div>`;
const masteryBar = (before, after) => {
  const L = masteryLevel(after), lo = L ? MASTERY[L - 1] : 0, hi = MASTERY[L];
  if (hi === undefined) return '<span class="bar"><i style="width:100%"></i></span>';
  const pct = v => Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100);
  return `<span class="bar"><i style="width:${pct(before)}%"></i><i class="gain" style="left:${pct(before)}%;width:${pct(after) - pct(before)}%"></i></span>`;
};

// After an end screen appears: count the souls up, and throw confetti if anything was unlocked or beaten.
function celebrate(end) {
  for (const el of document.querySelectorAll('.cnt')) countUp(el, Number(el.dataset.to), 900);
  const p = end.prog || {};
  if (end.newBest || (end.gear || []).length || (end.feats || []).length || p.levelUp || p.tierUp || (p.classes || []).length || (p.missions || []).some(m => m.done)) setTimeout(() => confetti(), 500);
}

// What a run earned: souls, class mastery, anything newly unlocked.
function progLines(p, save) {
  if (!p) return '';
  const c = CLASSES[p.cls];
  const total = p.souls + (p.daily || 0) + (p.missionPay || 0), extra = [p.daily ? `daily bonus +${p.daily}${p.dayStreak > 1 ? ' (day ' + p.dayStreak + ' in a row)' : ''}` : '', p.missionPay ? `missions +${p.missionPay}` : ''].filter(Boolean).join(', ');
  let h = `<div class="nem on show gear soul">${pix('i_soul', 3)}<div><b>+<span class="cnt" data-to="${total}">0</span> SOULS</b><span>${extra ? 'Includes ' + extra + '. ' : ''}You now have ${save.souls}.</span></div></div>`;
  for (const m of p.missions || []) if (m.after > m.before) h += `<div class="nem show qrow${m.done ? ' done on' : ''}"><div style="width:100%"><b>${m.text.toUpperCase()}</b><span>${m.after}/${m.n}</span>${bar2(m.before, m.after, m.n)}</div>${m.done ? `<span class="stamp">DONE +${m.pay}</span>` : ''}</div>`;
  if (c) h += `<div class="nem on show grow">${pix(c.sprite, 2, true)}<div><b>${c.n.toUpperCase()} MASTERY ${masteryLevel(p.after) + 1}</b>` +
    `<span>${masteryLevel(p.after) >= 4 ? 'Mastered.' : 'Each level makes your minion 15% stronger.'}</span>${masteryBar(p.before, p.after)}</div>${p.levelUp ? '<span class="stamp">LEVEL UP</span>' : ''}</div>`;
  for (const id of p.classes) h += `<div class="nem on show gear">${pix(CLASSES[id].sprite, 2, true)}<div><b>${CLASSES[id].n.toUpperCase()}</b><span>${CLASSES[id].d}</span></div><span class="stamp">CLASS UNLOCKED</span></div>`;
  // So close: name the nearest unfinished goal when it is most of the way there.
  if (p.next && p.next.have / p.next.want >= 0.5) h += `<div class="nem show qrow"><div style="width:100%"><b class="near">SO CLOSE</b><span>${p.next.text}: ${Math.max(1, Math.round(p.next.want - p.next.have)).toLocaleString()} to go</span>${bar2(0, p.next.have, p.next.want)}</div></div>`;
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
  const lo = save.gear.loadout;
  $('bLoadout').querySelector('b').textContent = WEAPONS[lo.weapon].n + ' + ' + ABILITIES[lo.ability].n;
  $('bBoon').classList.toggle('hidden', !boonsOf(save).length); $('bBoon').querySelector('b').textContent = save.boon ? upName(save.boon) : 'none';
  const el = $('classList'); el.innerHTML = '';
  for (const id in CLASSES) {
    const c = CLASSES[id], card = document.createElement('div'), have = save.classes.includes(id), xp = save.mastery[id] || 0;
    card.className = 'cls' + (id === save.cls ? ' on' : '') + (have ? '' : ' locked');
    const [got, want] = c.lock ? c.lock.need(save) : [1, 1];
    card.innerHTML = `<div class="scene">${pix(c.sprite, 5, true)}${pix('c_' + c.minion, c.minion === 'golem' ? 3 : 4, true)}${id === 'necro' ? pix('c_skeleton', 3, true) : ''}</div>` +
      `<h3>${c.n.toUpperCase()}</h3>` +
      (have ? `${stars(masteryLevel(xp))}${masteryBar(xp, xp)}<p>${c.d}</p><p class="min">${c.md}</p><p class="ult">Ultimate, ${c.ult.n}: ${c.ult.d}</p><span class="pick">${id === save.cls ? 'PLAYING' : 'click to choose'}</span>`
        : `<p>${c.d}</p><p class="min">${c.md}</p><p class="ult">Ultimate, ${c.ult.n}: ${c.ult.d}</p><div class="need">${pix('i_lock', 1)}${c.lock.text.toUpperCase()}</div><span class="bar"><i style="width:${Math.round(Math.min(1, got / want) * 100)}%"></i></span><span class="pick">${Math.min(got, want).toLocaleString()} / ${want.toLocaleString()}</span>`);
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
  show('dead'); celebrate(end);
}

export function showWon(g, save, end) {
  const { growth = [], feats = [], kind } = end;
  $('wProg').innerHTML = progLines(end.prog, save);
  $('wFeats').innerHTML = gearLines(end.gear || []) + featLines(feats);
  $('wStats').innerHTML = stat(fmt(g.t), 'time', 'best') + stat(g.kills, 'kills') + stat(g.P.lvl, 'level') + stat(save.wins, 'wins') + (KIND[kind] ? stat(KIND[kind], 'mode') : '');
  $('wParty').innerHTML = growthCards(growth);
  $('wNote').textContent = growth.length ? 'Your party grew stronger from the victory.' : 'You did it alone.';
  show('won'); confetti(70); celebrate(end);
}

export function showLevel(g, onPick) {
  const el = $('cards'); el.innerHTML = '';
  const top = topRarity(g);
  $('lvlTitle').textContent = top === 'legendary' ? 'LEGENDARY!' : g.chest ? 'CHEST' : 'LEVEL UP';
  $('lvlTitle').className = 't-' + top;
  $('bReroll').classList.toggle('hidden', !(g.rerolls > 0)); $('bReroll').querySelector('b').textContent = g.rerolls || '';
  g.choices.forEach((u, i) => {
    const rar = g.rar[i] || 'common', s = u.leg ? 1 : RARITY[rar].s;
    const c = document.createElement('div'); c.className = 'card r-' + rar + (u.ally ? ' ally' : '');
    const have = g.picks[u.id] || 0;
    const d = upText(u, s, WEAPONS[g.P.weapon].up);          // some upgrades mean something different per weapon
    const sparks = rar === 'legendary' || rar === 'epic' ? `<i class="sp s1">${pix('glint', 2)}</i><i class="sp s2">${pix('glint', 2)}</i><i class="sp s3">${pix('glint', 2)}</i>` : '';
    c.innerHTML = `<i class="rar">${RARITY[rar].n.toUpperCase()}</i>${sparks}${pix(u.ic || 'i_' + u.id, 4)}<b>${u.n}</b><span>${d}</span>` +
      `<em>${u.leg ? 'one of a kind' : u.ally ? 'for your allies' : have ? 'you have ' + have : 'new'}</em><kbd class="key mouse-only">${i + 1}</kbd>`;
    c.onclick = () => onPick(i);
    el.appendChild(c);
  });
  show('lvl');
}

export const hideLevel = () => hide('lvl');
// The best rarity among the three cards on offer.
export const topRarity = g => RARITIES[Math.max(0, ...g.rar.map(r => RARITIES.indexOf(r)))];
// The chosen card flashes and grows; the others drop away.
export function pickCard(i) { [...$('cards').children].forEach((c, k) => c.classList.add(k === i ? 'picked' : 'gone')); }
export const setPause = on => on ? show('pause') : hide('pause');
