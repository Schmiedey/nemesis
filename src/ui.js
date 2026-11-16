// HTML overlays: title, roster (party draft), death, win, level-up, pause.
import { pendingLevels } from './sim.js';
import { T, PERKS, JOB, EVOS, FEATS, WEAPONS, ABILITIES, CHARMS, CLASSES, META, MASTERY, MAX_TIER, MISSIONS, RARITY, RARITIES, MAX_RANK, UP_SLOTS, UP_STAT, PAIRS, WEAPON_EVOS, WEAPON_TRAIT, LEG_TRAIT, UP, upText, masteryLevel, gearOf, upName, evoOf, rankName } from './data.js';
import { canEvolve, boonsOf, today, metaCost, completion, nextGoals, slotSummaries, currentSlot } from './save.js';
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

export function hideAll() { ['start', 'classes', 'shrine', 'missions', 'saves', 'roster', 'feats', 'loadout', 'dead', 'won', 'lvl', 'pause'].forEach(hide); }
const gearLines = ids => ids.map(id => `<div class="nem on show gear">${pix('i_' + id, 3)}<div><b>${gearOf(id).n}</b><span>${gearOf(id).d}</span></div><span class="stamp">NEW GEAR</span></div>`).join('');

const featLines = feats => feats.map(f => `<div class="feat got">${pix('i_trophy', 2)}<div><b>FEAT: ${f.n}</b><span>${f.d}. Boon unlocked: ${upName(f.boon)}</span></div></div>`).join('');
const KIND = { hard: 'Nemesis+', daily: 'Daily' };

// Wire every menu button once. h: { play, roster, menu, resume, reset }
export function bindMenus(h) {
  const on = (ids, fn) => ids.forEach(id => { $(id).onclick = e => { e.currentTarget.blur(); fn(); }; });
  on(['bPlay', 'bRosterPlay'], h.play);
  on(['bAgain', 'bWonAgain'], h.again);
  on(['bHome'], h.menu); on(['bMissions'], h.missions); on(['bSaves'], h.saves); on(['bDaily'], h.daily); on(['bHard'], h.hard); on(['bBoon'], h.boon); on(['bFeats'], h.feats); on(['bLoadout'], h.loadout); on(['bClass'], h.classes); on(['bShrine'], h.shrine); on(['bReroll'], h.reroll); on(['bBanish'], h.banish);
  on(['bRoster', 'bDeadRoster', 'bWonRoster'], h.roster);
  on(['bShare', 'bWonShare'], h.share);
  $('bDeadNext').onclick = e => { e.currentTarget.blur(); deadNext(); };
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
  $('bSaves').textContent = 'SAVE ' + currentSlot();
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
  const t = $('tabs'), menus = ['start', 'classes', 'loadout', 'roster', 'shrine', 'missions', 'feats', 'saves'];
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

// Saves: three slots. Switch to one, start a fresh one, or delete one.
export function showSaves(onPick, onDelete) {
  hideAll();
  const el = $('saveList'); el.innerHTML = '';
  for (const s of slotSummaries()) {
    const c = document.createElement('div');
    c.className = 'slotc' + (s.active ? ' on' : '') + (s.empty ? ' empty' : '');
    c.innerHTML = `<div class="scene">${s.empty ? '?' : pix(CLASSES[s.cls].sprite, 5, true)}</div><h3>SAVE ${s.slot}</h3>` +
      (s.empty ? '<p>Empty. A fresh start: no nemeses, no souls, the three starting classes.</p>'
        : `<p>${CLASSES[s.cls].n} &middot; ${s.runs} run${s.runs === 1 ? '' : 's'} &middot; best ${fmt(s.best)}</p><p>${s.souls} souls &middot; ${s.nemeses} nemes${s.nemeses === 1 ? 'is' : 'es'} &middot; ${s.complete}% complete</p>`) +
      (s.active ? '<span class="tag2">PLAYING THIS SAVE</span>' : '');
    if (!s.active) { const b = document.createElement('button'); b.className = 'go'; b.textContent = s.empty ? 'START FRESH' : 'SWITCH TO THIS'; b.onclick = () => onPick(s.slot); c.appendChild(b); }
    if (!s.empty) { const b = document.createElement('button'); b.className = 'quiet'; b.textContent = 'delete this save'; b.onclick = () => onDelete(s.slot); c.appendChild(b); }
    el.appendChild(c);
  }
  show('saves');
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
  const b = T[bossType], n = save.deaths[bossType] || 0, gr = save.grudge?.type === bossType ? save.grudge : null;
  $('missionBoss').innerHTML = n ? `Your true nemesis: <b style="color:${b.color}">${gr ? esc(gr.name) : 'the ' + b.name}</b>, with ${n} kill${n > 1 ? 's' : ''} on you${gr?.beaten ? ', beaten ' + gr.beaten + (gr.beaten > 1 ? ' times' : ' time') : ''}.${gr?.powers.length ? ' It learned ' + gr.powers.map(k => UP.find(u => u.id === k).n).join(' and ') + ' from you.' : ''} It comes at <b>5:00</b>.` : 'Whatever kills you joins your roster. Your nemesis comes at <b>5:00</b>.';
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
  $('bLoadout').querySelector('b').textContent = WEAPONS[CLASSES[save.cls]?.weapon || lo.weapon].n + ' + ' + ABILITIES[lo.ability].n;
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
  const fixed = CLASSES[save.cls]?.weapon;              // a class that brings its own weapon (the Knight's sword)
  const col = (el, table, cur, lock = null) => {
    el.innerHTML = lock ? `<div class="nem gearcard on">${pix('i_' + lock, 3)}<div><b>${table[lock].n}</b><span>The ${CLASSES[save.cls].n} always fights with this. Pick another hero to change weapon.</span></div></div>` : '';
    if (lock) return;
    for (const id in table) {
      const have = save.gear.owned.includes(id), it = table[id];
      const c = document.createElement('div');
      c.className = 'nem gearcard' + (id === cur ? ' on' : '') + (have ? '' : ' locked');
      const evo = table === WEAPONS && WEAPON_EVOS[id] ? `<span class="evo">EVOLVES INTO ${WEAPON_EVOS[id].n.toUpperCase()} WITH ${upName(WEAPON_EVOS[id].need).toUpperCase()} AT RANK ${MAX_RANK}</span>` : '';
      c.innerHTML = `${pix(have ? 'i_' + id : 'i_lock', 3)}<div><b>${have ? it.n : 'Not found yet'}</b><span>${have ? it.d : 'Dropped by your nemesis and by elite chests.'}</span>${have ? evo : ''}` +
        (have ? `<span class="pick">${id === cur ? 'EQUIPPED' : 'click to equip'}</span>` : '') + '</div>';
      if (have) c.onclick = () => onEquip(id);
      el.appendChild(c);
    }
  };
  col($('loWeapons'), WEAPONS, save.gear.loadout.weapon, fixed);
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

// ---------- roster ----------
// Your party stands on a stage at the top; every nemesis is a tile below; the panel on the right describes
// whichever tile is selected and holds the buttons. Keeps text to one nemesis at a time.
let rosterFocus = null;
const RANKS = [[0, 0.7], [0.7, 1.3], [1.3, 2], [2, 3]];                      // Runt, Soldier, Veteran, Champion
const rankOf = q => (q < 0.7 ? 0 : q < 1.3 ? 1 : q < 2 ? 2 : 3);
const pips = q => `<span class="ranks r${rankOf(q) + 1}"><i></i><i></i><i></i><i></i></span>`;
export function showRoster(save, onToggle, onEvo) {
  hideAll();
  const sorted = [...save.nemeses].sort((a, b) => b.q - a.q), party = save.party.map(id => save.nemeses.find(n => n.id === id)).filter(Boolean);
  const redraw = () => showRoster(save, onToggle, onEvo);
  $('reset').classList.toggle('hidden', !save.nemeses.length && !save.runs);
  if (!sorted.length) {
    $('rosterHint').textContent = '';
    $('rosterParty').innerHTML = [0, 1, 2].map(() => '<div class="pslot empty"><i>?</i>EMPTY</div>').join('');
    $('rosterList').innerHTML = '<div class="rempty">Nobody yet. Go and die to something: whatever kills you joins you here, and the longer you last, the stronger it arrives.</div>';
    $('rosterDetail').innerHTML = ''; $('rosterDetail').classList.add('hidden');
    return show('roster');
  }
  if (!sorted.some(n => n.id === rosterFocus)) rosterFocus = (party[0] || sorted[0]).id;
  $('rosterHint').innerHTML = `Party <b>${party.length} / ${PARTY_SIZE}</b>. Pick a nemesis to see what it does.`;

  // The party, large, on the stage. Click one to send it back to the bench.
  const stage = $('rosterParty'); stage.innerHTML = '';
  for (let i = 0; i < PARTY_SIZE; i++) {
    const n = party[i], d = document.createElement('div');
    d.className = 'pslot' + (n ? '' : ' empty');
    d.innerHTML = n ? pix('c_' + n.type, n.type === 'brute' ? 3 : 4, true) + `<span style="color:${T[n.type].color}">${esc(n.name).toUpperCase()}</span>` : '<i>+</i>EMPTY';
    if (n) d.onclick = () => { rosterFocus = n.id; onToggle(n.id); };
    stage.appendChild(d);
  }

  // Everyone, as tiles: sprite, name, rank pips. A badge marks one that is ready to evolve.
  const grid = $('rosterList'); grid.innerHTML = '';
  for (const n of sorted) {
    const t = document.createElement('div');
    t.className = 'rtile' + (save.party.includes(n.id) ? ' in' : '') + (n.id === rosterFocus ? ' focus' : '');
    t.innerHTML = pix('c_' + n.type, n.type === 'brute' ? 2 : 3, n.id === rosterFocus) + `<span style="color:${n.prize ? 'var(--y)' : T[n.type].color}">${esc(n.name).toUpperCase().slice(0, 9)}</span>${pips(n.q)}` + (canEvolve(n) ? '<em class="badge">!</em>' : '');
    t.onclick = () => { rosterFocus = n.id; redraw(); };
    grid.appendChild(t);
  }

  // The selected nemesis in full.
  const n = sorted.find(x => x.id === rosterFocus), d = T[n.type], inParty = save.party.includes(n.id), r = rankOf(n.q), [lo, hi] = RANKS[r];
  const det = $('rosterDetail'); det.classList.remove('hidden');
  det.innerHTML = `<div class="scene">${pix('c_' + n.type, n.type === 'brute' ? 4 : 6, true)}</div>` +
    `<h3 style="color:${d.color}">${esc(n.name).toUpperCase()}<br><span style="color:var(--txt);font-weight:400;font-size:12px">${esc(n.title).toUpperCase()}</span></h3>` +
    `<div class="rank">${pips(n.q)}${n.prize === 'elite' ? 'ELITE ' : n.prize === 'gold' ? 'GOLDEN ' : ''}${rankName(n.q).toUpperCase()} ${d.name.toUpperCase()}${evoOf(n) ? ' &middot; <span style="color:var(--y)">' + evoOf(n).n.toUpperCase() + '</span>' : ''}</div>` +
    (r < 3 ? `<span class="bar"><i style="width:${Math.round((n.q - lo) / (hi - lo) * 100)}%"></i></span>` : '') +
    `<div class="job">${JOB[n.type]}.${evoOf(n) ? ' ' + evoOf(n).d + '.' : ''}</div>` +
    (Object.keys(n.perks).length || n.weapon || (n.legs || []).length ? `<div class="rank">TOOK FROM YOU</div><div class="took" style="justify-content:flex-start;gap:6px">${tookChips(n)}</div>` : '<div class="hist">It took no powers from you.</div>') +
    `<div class="hist">${n.runs ? `${n.runs} run${n.runs > 1 ? 's' : ''} with you &middot; ${n.kills} kill${n.kills === 1 ? '' : 's'}${n.wins ? ' &middot; ' + n.wins + ' win' + (n.wins > 1 ? 's' : '') : ''}` : 'Has not fought for you yet.'}</div>`;
  if (canEvolve(n)) {
    // A Champion chooses one of two evolutions, once.
    const box = document.createElement('div'); box.className = 'evos';
    box.innerHTML = '<span class="rank" style="color:var(--y)">CHAMPION: CHOOSE AN EVOLUTION</span>';
    for (const ev of EVOS[n.type]) {
      const b = document.createElement('button'); b.innerHTML = `<b>${ev.n}</b><span>${ev.d}</span>`;
      b.onclick = () => onEvo(n.id, ev.id);
      box.appendChild(b);
    }
    det.appendChild(box);
  }
  const full = !inParty && party.length >= PARTY_SIZE, b = document.createElement('button');
  b.className = inParty ? '' : 'go'; b.style.fontSize = '16px'; b.style.padding = '9px 12px 13px';
  b.textContent = inParty ? 'REMOVE FROM PARTY' : full ? 'PARTY IS FULL' : 'ADD TO PARTY';
  b.disabled = full; if (full) b.style.opacity = '.45';
  b.onclick = () => onToggle(n.id);
  det.appendChild(b);
  show('roster');
}

// What a nemesis took from you, as chips: its weapon trait, its upgrades, its Legendary powers.
export function tookChips(n, delay0 = 0) {
  const out = [];
  if (n.weapon && WEAPONS[n.weapon]) out.push([pix('i_' + n.weapon, 2), 'YOUR ' + WEAPONS[n.weapon].n.toUpperCase(), WEAPON_TRAIT[n.weapon], '']);
  for (const k in n.perks) out.push([pix((UP.find(u => u.id === k) || {}).ic || 'i_' + k, 2), PERKS[k].label.toUpperCase() + (n.perks[k] > 1 ? ' x' + n.perks[k] : ''), '', '']);
  for (const k of n.legs || []) { const u = UP.find(x => x.id === k); out.push([pix(u.ic || 'i_' + k, 2), u.n.toUpperCase(), LEG_TRAIT[k], ' leg']); }
  return out.map(([ic, name, what, cls], i) => `<span class="tchip${cls}" style="animation-delay:${(delay0 + i * 0.12).toFixed(2)}s">${ic}<span><b>${name}</b>${what}</span></span>`).join('');
}

// Death has two beats. First the recruitment: what killed you turns to your side, named, carrying what it took.
// Then the summary of what the run earned.
let deadEnd = null;
export function showDead(g, save, res, end) {
  const { newBest, growth = [], feats = [], best, kind } = end;
  const d = T[g.killer], r = g.recruit, joined = res.status !== 'rejected', n = joined ? res.nem : r;
  deadEnd = end;
  // --- the recruitment ---
  $('dRecruit').classList.remove('hidden'); $('dSummary').classList.add('hidden');
  $('dRecruit').classList.toggle('no', !joined);
  $('rKilled').textContent = `KILLED BY ${d.name === 'Archer' ? 'AN' : 'A'} ${d.name.toUpperCase()} AT ${fmt(g.t)}`;
  $('dKiller').innerHTML = pix('c_' + g.killer, g.killer === 'brute' ? 5 : 7, true);
  $('rName').innerHTML = `<span style="color:${d.color}">${esc(r.name).toUpperCase()}</span> ${esc(r.title).toUpperCase()}`;
  $('rRank').innerHTML = `${pips(r.q)} ${r.prize === 'elite' ? '<span style="color:var(--y)">ELITE</span> ' : r.prize === 'gold' ? '<span style="color:var(--y)">GOLDEN</span> ' : ''}${rankName(r.q).toUpperCase()} ${d.name.toUpperCase()}` +
    (r.prize ? `<br><span style="color:var(--y)">A PRIZE: ${r.prize === 'elite' ? 'it was an elite, so it joins half a rank stronger' : 'it was golden: stronger, and it earns you 15% more souls while it is in your party'}</span>` : '');
  $('rTook').innerHTML = joined ? `<h4>IT TOOK FROM YOU</h4>` + (tookChips(n, 1.3) || '<span class="tchip" style="animation-delay:1.3s"><span>Nothing. You died with no powers to take.</span></span>') : '';
  $('rVerdict').innerHTML =
    res.status === 'joined' ? `<b style="color:var(--mint)">It joins you.</b> ${JOB[g.killer]}.` :
    res.status === 'replaced' ? `<b style="color:var(--mint)">It joins you</b>, taking the place of ${esc(res.old.name)}. ${JOB[g.killer]}.` :
    `Too weak to earn a place: you already have three stronger ${d.name}s. Last longer and a stronger one will come.`;
  // --- the summary, shown after CONTINUE ---
  $('dTitle').innerHTML = newBest ? 'A NEW BEST' : 'THE RUN';
  $('dBuild').innerHTML = buildRow(g, r);
  $('dCard').innerHTML = growthCards(growth.filter(x => x.nem !== res.old));
  $('dStats').innerHTML = stat(fmt(g.t), newBest ? 'new best' : 'survived', newBest ? 'best' : '') +
    stat(g.kills, 'kills') + stat(g.P.lvl, 'level') + (newBest ? '' : stat(fmt(best), 'best')) + (KIND[kind] ? stat(KIND[kind], 'mode') : '');
  $('dProg').innerHTML = progLines(end.prog, save);
  $('dFeats').innerHTML = gearLines(end.gear || []) + featLines(feats);
  const nxt = Object.values(T).filter(x => !x.minion && x.unlock > g.t).sort((a, b) => a.unlock - b.unlock)[0];
  $('dTease').innerHTML = nxt ? `Something new shows up at <b>${fmt(nxt.unlock)}</b>...`
    : g.bossAt ? 'So close. Your nemesis was right there.' : 'Your true nemesis arrives at <b>5:00</b>.';
  show('dead');
}
// CONTINUE: from the recruitment to the summary. Returns false if the summary is already showing.
export function deadNext() {
  if ($('dRecruit').classList.contains('hidden')) return false;
  $('dRecruit').classList.add('hidden'); $('dSummary').classList.remove('hidden');
  if (deadEnd) celebrate(deadEnd);
  return true;
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

export function showLevel(g, onPick, banishing = false) {
  const el = $('cards'); el.innerHTML = '';
  const top = topRarity(g);
  const more = pendingLevels(g);                      // several levels at once: say how many are queued
  $('lvlTitle').textContent = (top === 'legendary' ? 'LEGENDARY!' : g.chest ? 'CHEST' : 'LEVEL UP') + (more ? '  +' + more + ' MORE' : '');
  $('lvlTitle').className = 't-' + top;
  $('bReroll').classList.toggle('hidden', !(g.rerolls > 0)); $('bReroll').querySelector('b').textContent = g.rerolls || '';
  $('bBanish').classList.toggle('hidden', !(g.banishes > 0)); $('bBanish').querySelector('b').textContent = g.banishes || '';
  $('bBanish').classList.toggle('on', banishing); $('lvl').classList.toggle('banishing', banishing);
  const held = UP.filter(u => !u.leg && g.picks[u.id]).length;
  $('lvlSlots').innerHTML = `<span>UPGRADES ${held} / ${UP_SLOTS}</span>` + (held >= UP_SLOTS ? '<span>ALL SLOTS FULL: ONLY YOURS ARE OFFERED</span>' : '');
  g.choices.forEach((u, i) => {
    const rar = g.rar[i] || 'common', s = u.leg ? 1 : RARITY[rar].s;
    const have = g.picks[u.id] || 0;
    const c = document.createElement('div'); c.className = 'card r-' + rar + (u.ally ? ' ally' : '') + (have >= 3 ? ' deep' : '');
    const d = upText(u, s, WEAPONS[g.P.weapon].up);          // some upgrades mean something different per weapon
    const sparks = rar === 'legendary' || rar === 'epic' ? `<i class="sp s1">${pix('glint', 2)}</i><i class="sp s2">${pix('glint', 2)}</i><i class="sp s3">${pix('glint', 2)}</i>` : '';
    c.innerHTML = `<i class="rar">${RARITY[rar].n.toUpperCase()}</i>${sparks}${pix(u.ic || 'i_' + u.id, 4)}<b>${u.n}</b>${u.filler ? '' : `<i class="kind">${u.evo ? 'EVOLUTION' : u.leg ? 'LEGENDARY POWER' : kindOf(g, u)}</i>`}<span>${d}</span>` +
      preview(g, u, s) + (u.leg || u.filler ? '' : rankPips(have)) +
      pairTag(g, u) + `<em>${u.evo ? 'weapon evolution' : u.leg ? 'one of a kind' : u.filler ? 'nothing left to learn' : u.ally ? 'for your allies' : have ? 'rank ' + have + ' to ' + (have + 1) : 'new'}</em><kbd class="key mouse-only">${i + 1}</kbd>`;
    c.onclick = () => onPick(i);
    el.appendChild(c);
  });
  show('lvl');
}

// Your build at the end: every upgrade with its rank, your evolution and pairs. What the recruit took is lit.
function buildRow(g, r) {
  const took = new Set([...Object.keys(r?.perks || {}), ...(r?.legs || [])]), out = [];
  for (const u of UP) if (g.picks[u.id]) out.push(`<span class="bi${took.has(u.id) ? ' took' : ''}">${pix(u.ic || 'i_' + u.id, 2)}${u.leg ? '' : g.picks[u.id]}</span>`);
  if (g.P.evo) out.push(`<span class="bi evo">${pix('i_' + g.P.weapon, 2)}${WEAPON_EVOS[g.P.weapon].n.toUpperCase()}</span>`);
  for (const p of PAIRS) if (g.pairs[p.id]) out.push(`<span class="bi pair">${p.n.toUpperCase()}</span>`);
  return out.length ? `<h4>YOUR BUILD${took.size ? ': LIT ONES WENT TO YOUR RECRUIT' : ''}</h4>` + out.join('') : '';
}
// What kind of upgrade a card is.
const kindOf = (g, u) => u.ally || u.minion ? 'PARTY' : (WEAPONS[g.P.weapon].up || {})[u.id] || ['shots', 'pierce', 'haste', 'dmg', 'crit', 'chain'].includes(u.id) ? 'WEAPON' : 'PASSIVE';
// A card that would complete a pair, or feeds your weapon's evolution, says so.
function pairTag(g, u) {
  const ev = WEAPON_EVOS[g.P.weapon];
  if (ev && ev.need === u.id && !g.P.evo) return `<i class="tag evo">EVOLVES YOUR ${WEAPONS[g.P.weapon].n.toUpperCase()} AT RANK ${MAX_RANK}</i>`;
  for (const p of PAIRS) { const other = p.a === u.id ? p.b : p.b === u.id ? p.a : null; if (other && !g.pairs[p.id]) return `<i class="tag${g.picks[other] && !g.picks[u.id] ? ' on' : ''}">${g.picks[other] && !g.picks[u.id] ? 'COMPLETES ' + p.n.toUpperCase() : 'PAIRS WITH ' + upName(other).toUpperCase()}</i>`; }
  return '';
}
// Rank pips: filled for what you have, the next one lit.
const rankPips = have => `<i class="rk">${Array.from({ length: MAX_RANK }, (_, k) => `<i class="${k < have ? 'on' : k === have ? 'nx' : ''}"></i>`).join('')}</i>`;
// Before -> after for plain stat upgrades: apply the upgrade to a copy and read the number again.
function preview(g, u, s) {
  const st = UP_STAT[u.id]; if (!st) return '';
  const g2 = { ...g, P: { ...g.P } }; u.f(g2, s);
  const f = v => v.toFixed(st[2]) + (st[3] || '');
  return `<i class="ba">${st[0].toUpperCase()} ${f(st[1](g))} <b>${f(st[1](g2))}</b></i>`;
}
export const hideLevel = () => hide('lvl');
// The best rarity among the three cards on offer.
export const topRarity = g => RARITIES[Math.max(0, ...g.rar.map(r => RARITIES.indexOf(r)))];
// The chosen card flashes and grows; the others drop away.
export function pickCard(i) { [...$('cards').children].forEach((c, k) => c.classList.add(k === i ? 'picked' : 'gone')); }
export const setPause = on => on ? show('pause') : hide('pause');
