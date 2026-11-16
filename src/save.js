// Versioned save. A corrupt or old save never crashes the game.
import { T, PERKS, LEG_TRAIT, EVOS, FEATS, CHAMPION_Q, rankName, WEAPONS, ABILITIES, CHARMS, CLASSES, START_CLASSES, META, MAX_TIER, MASTERY, MISSIONS, masteryLevel, START_GEAR, ALL_GEAR } from './data.js';

const KEY = 'nemesis_save';
const OLD_KEY = 'nemesis_v1';
const VERSION = 10;
export const MAX_PER_TYPE = 3;
export const PARTY_SIZE = 3;
// v5 adds: Nemesis+ (hard, bestHard, winsHard), the daily run, feats and the chosen boon.
const fresh = () => ({ v: VERSION, nemeses: [], party: [], best: 0, runs: 0, wins: 0, deaths: {}, nextId: 1,
  hard: false, bestHard: 0, winsHard: 0, daily: { date: '', best: 0, won: false }, feats: {}, boon: null,
  // v6: gear you have found, and what is equipped.
  cls: 'knight',   // v8: the class you play
  // v9: progression. Souls buy Shrine ranks (meta); lifetime stats unlock classes; each class has mastery xp;
  // tier is the Nemesis+ level you play at, tierMax the highest you have unlocked.
  // v10: three active missions, and the day streak that pays a bonus on the first run of each day.
  missions: [], day: { date: '', streak: 0 }, seen: { classes: 3, gear: 2 },   // seen: what the Hero tab's badge compares against
  souls: 0, meta: {}, stats: { kills: 0, chests: 0, time: 0, bosses: 0 }, classes: [...START_CLASSES], mastery: {}, tier: 0, tierMax: 0,
  gear: { owned: [...START_GEAR], loadout: { weapon: 'blaster', ability: 'dash', charm: null } } });   // v7 adds the charm slot
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const count = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function cleanNem(n, id) {
  if (!n || !T[n.type]) return null;
  const perks = {};
  for (const k in PERKS) { const c = Math.floor(Number(n.perks?.[k])); if (c > 0) perks[k] = Math.min(3, c); }
  return {
    id, type: n.type, perks, q: clamp(Number(n.q) || 0.3, 0.3, 3),
    name: typeof n.name === 'string' ? n.name.slice(0, 16) : T[n.type].name,
    title: typeof n.title === 'string' ? n.title.slice(0, 24) : 'the Unproven',
    // Added in v4: lifetime record and the evolution picked at Champion.
    kills: count(n.kills), runs: count(n.runs), wins: count(n.wins),
    evo: (EVOS[n.type] || []).some(e => e.id === n.evo) ? n.evo : null,
    // Phase 17: the weapon it took from you and any Legendary powers you held.
    weapon: WEAPONS[n.weapon] ? n.weapon : null, legs: Array.isArray(n.legs) ? Object.keys(LEG_TRAIT).filter(k => n.legs.includes(k)) : [],
  };
}

// Accepts anything; returns a valid save object.
export function sanitize(raw) {
  const s = fresh();
  if (!raw || typeof raw !== 'object') return s;
  const idMap = new Map();
  if (Array.isArray(raw.nemeses)) {
    for (const n of raw.nemeses) {
      const c = cleanNem(n, s.nextId);
      if (!c || s.nemeses.filter(x => x.type === c.type).length >= MAX_PER_TYPE) continue;
      idMap.set(n.id, c.id); s.nemeses.push(c); s.nextId++;
    }
  } else if (raw.roster && typeof raw.roster === 'object') {
    // Saves from before named nemeses: each old ally becomes a plain soldier.
    for (const k in raw.roster) {
      const n = Math.min(MAX_PER_TYPE, Math.floor(Number(raw.roster[k])) || 0);
      for (let i = 0; i < n && T[k]; i++) s.nemeses.push({ id: s.nextId++, type: k, perks: {}, q: 0.8, name: 'Old ' + T[k].name, title: 'the Remembered', kills: 0, runs: 0, wins: 0, evo: null, weapon: null, legs: [] });
    }
  }
  if (Array.isArray(raw.party)) for (const id of raw.party) {
    const m = idMap.get(id);
    if (m && !s.party.includes(m) && s.party.length < PARTY_SIZE) s.party.push(m);
  }
  if (!s.party.length) s.party = [...s.nemeses].sort((a, b) => b.q - a.q).slice(0, PARTY_SIZE).map(n => n.id);
  if (raw.deaths && typeof raw.deaths === 'object') for (const k in raw.deaths) {
    const n = Math.floor(Number(raw.deaths[k])); if (T[k] && n > 0) s.deaths[k] = n;
  }
  for (const k of ['runs', 'wins']) if (Number.isFinite(raw[k]) && raw[k] > 0) s[k] = Math.floor(raw[k]);
  if (Number.isFinite(raw.best) && raw.best > 0) s.best = raw.best;
  if (Number.isFinite(raw.bestHard) && raw.bestHard > 0) s.bestHard = raw.bestHard;
  s.winsHard = count(raw.winsHard); s.hard = raw.hard === true && s.wins > 0;
  if (raw.daily && typeof raw.daily.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(raw.daily.date)) {
    s.daily = { date: raw.daily.date, best: Number.isFinite(raw.daily.best) && raw.daily.best > 0 ? raw.daily.best : 0, won: raw.daily.won === true };
  }
  if (raw.feats && typeof raw.feats === 'object') for (const f of FEATS) if (raw.feats[f.id] === true) s.feats[f.id] = true;
  if (FEATS.some(f => f.boon === raw.boon && s.feats[f.id])) s.boon = raw.boon;
  s.souls = count(raw.souls);
  if (raw.meta && typeof raw.meta === 'object') for (const m of META) { const r = Math.min(m.cost.length, count(raw.meta[m.id])); if (r) s.meta[m.id] = r; }
  if (raw.stats && typeof raw.stats === 'object') for (const k in s.stats) s.stats[k] = count(raw.stats[k]);
  if (Array.isArray(raw.classes)) for (const id in CLASSES) if (raw.classes.includes(id) && !s.classes.includes(id)) s.classes.push(id);
  if (raw.mastery && typeof raw.mastery === 'object') for (const id in CLASSES) { const v = count(raw.mastery[id]); if (v) s.mastery[id] = v; }
  // Older saves had Nemesis+ as on/off: a first win opens tier 1, a Nemesis+ win opens tier 2.
  s.tierMax = Math.min(MAX_TIER, Math.max(count(raw.tierMax), s.winsHard > 0 ? 2 : s.wins > 0 ? 1 : 0));
  s.tier = Math.min(s.tierMax, raw.tier === undefined ? (s.hard ? 1 : 0) : count(raw.tier));
  s.hard = s.tier > 0;
  unlockClasses(s);
  if (CLASSES[raw.cls] && s.classes.includes(raw.cls)) s.cls = raw.cls;
  if (raw.seen && typeof raw.seen === 'object') s.seen = { classes: count(raw.seen.classes) || 3, gear: count(raw.seen.gear) || 2 };
  if (raw.day && typeof raw.day.date === 'string') s.day = { date: raw.day.date.slice(0, 10), streak: count(raw.day.streak) };
  if (Array.isArray(raw.missions)) for (const m of raw.missions) {
    const t = m && MISSIONS.find(x => x.id === m.id);
    if (t && t.n.includes(m.n) && s.missions.length < 3 && !s.missions.some(x => x.id === m.id)) s.missions.push({ id: m.id, n: m.n, have: Math.min(m.n, count(m.have)) });
  }
  dealMissions(s);
  if (raw.gear && Array.isArray(raw.gear.owned)) for (const id of ALL_GEAR) if (raw.gear.owned.includes(id) && !s.gear.owned.includes(id)) s.gear.owned.push(id);
  const lo = raw.gear && raw.gear.loadout;
  if (lo && WEAPONS[lo.weapon] && s.gear.owned.includes(lo.weapon)) s.gear.loadout.weapon = lo.weapon;
  if (lo && ABILITIES[lo.ability] && s.gear.owned.includes(lo.ability)) s.gear.loadout.ability = lo.ability;
  if (lo && CHARMS[lo.charm] && s.gear.owned.includes(lo.charm)) s.gear.loadout.charm = lo.charm;
  return s;
}

// A recruit joins if there is room for its type, or if it beats your weakest of that type.
// Returns { status: 'joined' | 'replaced' | 'rejected', nem?, old? }.
export function addRecruit(save, rec) {
  const same = save.nemeses.filter(n => n.type === rec.type);
  if (same.length < MAX_PER_TYPE) {
    const nem = { id: save.nextId++, kills: 0, runs: 0, wins: 0, evo: null, ...rec };
    save.nemeses.push(nem);
    if (save.party.length < PARTY_SIZE) save.party.push(nem.id);
    return { status: 'joined', nem };
  }
  const old = same.reduce((a, b) => (b.q < a.q ? b : a));
  if (rec.q <= old.q) return { status: 'rejected', old };
  const nem = { id: old.id, kills: 0, runs: 0, wins: 0, evo: null, ...rec };
  save.nemeses[save.nemeses.indexOf(old)] = nem;
  return { status: 'replaced', nem, old };
}

// After a run, each party member grows from the kills it made (and from a win).
// runParty: the party objects the sim ran with (they carry .kills). Returns one row per member for the end screen.
export function growParty(save, runParty, won) {
  const rows = [];
  for (const r of runParty) {
    const n = save.nemeses.find(x => x.id === r.id);
    if (!n) continue;
    const kills = count(r.kills), before = n.q;
    n.q = Math.min(3, n.q + Math.min(0.3, kills * 0.006) + (won ? 0.25 : 0));
    n.kills = (n.kills || 0) + kills; n.runs = (n.runs || 0) + 1; if (won) n.wins = (n.wins || 0) + 1;
    rows.push({ nem: n, kills, before, after: n.q, rankUp: rankName(before) !== rankName(n.q), canEvolve: canEvolve(n) });
  }
  return rows;
}

export const canEvolve = n => n.q >= CHAMPION_Q && !n.evo && !!EVOS[n.type];
export function evolve(save, id, evoId) {
  const n = save.nemeses.find(x => x.id === id);
  if (!n || !canEvolve(n) || !EVOS[n.type].some(e => e.id === evoId)) return false;
  n.evo = evoId; return true;
}

// Marks any feat now met and returns the newly earned ones. run: see FEATS in src/data.js; {} outside a run.
export function checkFeats(save, run = {}) {
  const got = [];
  for (const f of FEATS) if (!save.feats[f.id] && f.test(save, run)) { save.feats[f.id] = true; got.push(f); }
  return got;
}
// ---------- missions and the daily bonus ----------
// Keep three missions active. Which one comes next depends only on how much you have played, so it is repeatable.
export function dealMissions(save) {
  let i = save.runs * 7 + save.missions.length * 3 + save.stats.kills;
  while (save.missions.length < 3) {
    const t = MISSIONS[i++ % MISSIONS.length];
    if (save.missions.some(m => m.id === t.id)) continue;
    save.missions.push({ id: t.id, n: t.n[Math.min(t.n.length - 1, Math.floor(save.runs / 8))], have: 0 });
  }
}
// Apply a run's numbers to the missions. Finished ones pay out and are replaced. Returns rows for the end screen.
function runMissions(save, ms) {
  const rows = [];
  for (const m of save.missions) {
    const t = MISSIONS.find(x => x.id === m.id), v = Math.floor(ms[t.stat] || 0), before = m.have;
    m.have = Math.min(m.n, t.sum ? m.have + v : Math.max(m.have, v));
    rows.push({ text: t.text(m.n), before, after: m.have, n: m.n, done: m.have >= m.n, pay: t.pay });
  }
  save.missions = save.missions.filter(m => m.have < m.n);
  return rows;
}
const dayBefore = d => new Date(Date.parse(d + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
// What to chase next: the unfinished goals closest to done, nearest first. { text, have, want }.
export function nextGoals(save) {
  const out = [];
  for (const id in CLASSES) { const c = CLASSES[id]; if (c.lock && !save.classes.includes(id)) { const [have, want] = c.lock.need(save); out.push({ text: 'Unlock the ' + c.n + ': ' + c.lock.text.toLowerCase(), have, want }); } }
  const L = masteryLevel(save.mastery[save.cls] || 0);
  if (L < 4) out.push({ text: `${CLASSES[save.cls].n} mastery ${L + 2}`, have: (save.mastery[save.cls] || 0) - (L ? MASTERY[L - 1] : 0), want: MASTERY[L] - (L ? MASTERY[L - 1] : 0) });
  let cheap = null;
  for (const m of META) { const c = metaCost(save, m.id); if (c !== null && (!cheap || c < cheap.want)) cheap = { text: `${m.n} rank ${(save.meta[m.id] || 0) + 1} at the Shrine`, have: Math.min(save.souls, c), want: c }; }
  if (cheap) out.push(cheap);
  return out.filter(g => g.have < g.want).sort((a, b) => b.have / b.want - a.have / a.want);
}

// ---------- progression ----------
// Souls for a run: you always earn some, more for lasting, killing, opening chests, reaching and slaying the boss.
export function soulsFor(run, save) {
  const base = run.kills * 0.12 + run.t * 0.2 + (run.opened || 0) * 4 + (run.boss ? 15 : 0) + (run.won ? 60 : 0) + (run.bonus || 0);   // bonus: streaks and golden enemies
  return Math.floor(base * (1 + 0.25 * (run.tier || 0)) * (1 + 0.1 * (save.meta.greed || 0)) * (run.soulMul || 1));
}
// Classes whose requirement is now met are unlocked for good. Returns the newly unlocked ids.
export function unlockClasses(save) {
  const got = [];
  for (const id in CLASSES) {
    const c = CLASSES[id];
    if (save.classes.includes(id) || !c.lock) continue;
    const [have, want] = c.lock.need(save);
    if (have >= want) { save.classes.push(id); got.push(id); }
  }
  return got;
}
// Record a finished run: lifetime stats, souls, class mastery, class unlocks, and the next Nemesis+ tier on a win.
export function progress(save, run, date = today()) {
  const out = { souls: soulsFor(run, save), cls: run.cls, before: save.mastery[run.cls] || 0, daily: 0, dayStreak: 0, missions: [] };
  // The first run of each day pays a bonus that grows with how many days in a row you have played (up to a week).
  if (save.day.date !== date) {
    save.day = { date, streak: save.day.date === dayBefore(date) ? save.day.streak + 1 : 1 };
    out.daily = Math.round(20 * (1 + 0.15 * Math.min(6, save.day.streak - 1))); out.dayStreak = save.day.streak;
  }
  out.missions = runMissions(save, run.ms || {});
  out.missionPay = out.missions.reduce((a, m) => a + (m.done ? m.pay : 0), 0);
  out.near = nextGoals(save)[0] || null;               // measured before this run's totals land, for the 'so close' line
  save.souls += out.souls + out.daily + out.missionPay;
  save.stats.kills += run.kills; save.stats.chests += run.opened || 0; save.stats.time += Math.floor(run.t); if (run.won) save.stats.bosses++;
  if (CLASSES[run.cls]) save.mastery[run.cls] = out.before + Math.floor(run.t) + (run.won ? 120 : 0);
  out.after = save.mastery[run.cls] || 0;
  out.levelUp = masteryLevel(out.after) > masteryLevel(out.before);
  out.tierUp = run.won && !run.daily && run.tier >= save.tierMax && save.tierMax < MAX_TIER ? ++save.tierMax : 0;
  out.classes = unlockClasses(save);
  dealMissions(save);
  out.next = nextGoals(save)[0] || null;
  return out;
}
export const metaCost = (save, id) => { const m = META.find(x => x.id === id), r = save.meta[id] || 0; return m && r < m.cost.length ? m.cost[r] : null; };
export function buyMeta(save, id) {
  const c = metaCost(save, id);
  if (c === null || save.souls < c) return false;
  save.souls -= c; save.meta[id] = (save.meta[id] || 0) + 1; return true;
}
// How much of everything you have: classes, gear, feats and Shrine ranks, as a percentage.
export function completion(save) {
  const ranks = META.reduce((a, m) => a + m.cost.length, 0), have = META.reduce((a, m) => a + (save.meta[m.id] || 0), 0);
  const parts = [save.classes.length / Object.keys(CLASSES).length, save.gear.owned.length / ALL_GEAR.length, Object.keys(save.feats).length / FEATS.length, have / ranks, save.tierMax / MAX_TIER];
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
}

// Gear found in a run is kept. Returns the ids that were new.
export function addGear(save, ids) {
  const got = [];
  for (const id of ids) if (ALL_GEAR.includes(id) && !save.gear.owned.includes(id)) { save.gear.owned.push(id); got.push(id); }
  return got;
}
export function equip(save, id) {
  if (!save.gear.owned.includes(id)) return false;
  if (WEAPONS[id]) save.gear.loadout.weapon = id; else if (ABILITIES[id]) save.gear.loadout.ability = id;
  else if (CHARMS[id]) save.gear.loadout.charm = save.gear.loadout.charm === id ? null : id;   // a charm can be taken off again
  else return false;
  return true;
}
export const boonsOf = save => FEATS.filter(f => save.feats[f.id]).map(f => f.boon);
// The daily run: one seed per UTC day, the same for everyone.
export const today = (d = new Date()) => d.toISOString().slice(0, 10);
export const dailySeed = date => Number(date.replaceAll('-', ''));

// The enemy type that has killed you most becomes the boss.
export function bossTypeFor(save) {
  let best = 'brute', n = 0;
  for (const k in save.deaths) if (save.deaths[k] > n) { n = save.deaths[k]; best = k; }
  return best;
}

export const partyOf = save => save.party.map(id => save.nemeses.find(n => n.id === id)).filter(Boolean);

// ---------- save slots ----------
// Three independent saves, so you can start fresh without losing your main one. Slot 1 uses the original
// storage key, so a save from before slots existed is simply slot 1.
export const SLOTS = 3;
const SLOT_KEY = 'nemesis_slot';
const keyOf = n => (n === 1 ? KEY : KEY + '_' + n);
export function currentSlot(store = globalThis.localStorage) {
  try { const n = Number(store.getItem(SLOT_KEY)); return n >= 1 && n <= SLOTS ? n : 1; } catch { return 1; }
}
export function setSlot(n, store = globalThis.localStorage) {
  if (n >= 1 && n <= SLOTS) try { store.setItem(SLOT_KEY, String(n)); } catch { /* storage blocked */ }
}
const rawOf = (store, slot) => store.getItem(keyOf(slot)) ?? (slot === 1 ? store.getItem(OLD_KEY) : null);

export function loadSave(store = globalThis.localStorage, slot = currentSlot(store)) {
  try {
    const txt = rawOf(store, slot);
    return sanitize(txt ? JSON.parse(txt) : null);
  } catch { return fresh(); }
}

export function writeSave(save, store = globalThis.localStorage, slot = currentSlot(store)) {
  try { store.setItem(keyOf(slot), JSON.stringify(save)); } catch { /* storage full or blocked */ }
}

export function resetSave(store = globalThis.localStorage, slot = currentSlot(store)) {
  try { store.removeItem(keyOf(slot)); if (slot === 1) store.removeItem(OLD_KEY); } catch { /* ignore */ }
  return fresh();
}

// One line about each slot, for the saves screen.
export function slotSummaries(store = globalThis.localStorage) {
  const out = [], cur = currentSlot(store);
  for (let n = 1; n <= SLOTS; n++) {
    let empty = true; try { empty = !rawOf(store, n); } catch { /* treat as empty */ }
    const s = loadSave(store, n);
    out.push({ slot: n, active: n === cur, empty: empty || (!s.runs && !s.nemeses.length && !s.souls), cls: s.cls, runs: s.runs, best: s.best, wins: s.wins, souls: s.souls, nemeses: s.nemeses.length, complete: completion(s) });
  }
  return out;
}
