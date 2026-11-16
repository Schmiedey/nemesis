// Versioned save. A corrupt or old save never crashes the game.
import { T, PERKS, EVOS, FEATS, CHAMPION_Q, rankName, WEAPONS, ABILITIES, CHARMS, CLASSES, START_CLASSES, META, MAX_TIER, masteryLevel, START_GEAR, ALL_GEAR } from './data.js';

const KEY = 'nemesis_save';
const OLD_KEY = 'nemesis_v1';
const VERSION = 9;
export const MAX_PER_TYPE = 3;
export const PARTY_SIZE = 3;
// v5 adds: Nemesis+ (hard, bestHard, winsHard), the daily run, feats and the chosen boon.
const fresh = () => ({ v: VERSION, nemeses: [], party: [], best: 0, runs: 0, wins: 0, deaths: {}, nextId: 1,
  hard: false, bestHard: 0, winsHard: 0, daily: { date: '', best: 0, won: false }, feats: {}, boon: null,
  // v6: gear you have found, and what is equipped.
  cls: 'knight',   // v8: the class you play
  // v9: progression. Souls buy Shrine ranks (meta); lifetime stats unlock classes; each class has mastery xp;
  // tier is the Nemesis+ level you play at, tierMax the highest you have unlocked.
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
      for (let i = 0; i < n && T[k]; i++) s.nemeses.push({ id: s.nextId++, type: k, perks: {}, q: 0.8, name: 'Old ' + T[k].name, title: 'the Remembered', kills: 0, runs: 0, wins: 0, evo: null });
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
// ---------- progression ----------
// Souls for a run: you always earn some, more for lasting, killing, opening chests, reaching and slaying the boss.
export function soulsFor(run, save) {
  const base = run.kills * 0.12 + run.t * 0.2 + (run.opened || 0) * 4 + (run.boss ? 15 : 0) + (run.won ? 60 : 0);
  return Math.floor(base * (1 + 0.25 * (run.tier || 0)) * (1 + 0.1 * (save.meta.greed || 0)));
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
export function progress(save, run) {
  const out = { souls: soulsFor(run, save), cls: run.cls, before: save.mastery[run.cls] || 0 };
  save.souls += out.souls;
  save.stats.kills += run.kills; save.stats.chests += run.opened || 0; save.stats.time += Math.floor(run.t); if (run.won) save.stats.bosses++;
  if (CLASSES[run.cls]) save.mastery[run.cls] = out.before + Math.floor(run.t) + (run.won ? 120 : 0);
  out.after = save.mastery[run.cls] || 0;
  out.levelUp = masteryLevel(out.after) > masteryLevel(out.before);
  out.tierUp = run.won && !run.daily && run.tier >= save.tierMax && save.tierMax < MAX_TIER ? ++save.tierMax : 0;
  out.classes = unlockClasses(save);
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

export function loadSave(store = globalThis.localStorage) {
  try {
    const txt = store.getItem(KEY) ?? store.getItem(OLD_KEY);
    return sanitize(txt ? JSON.parse(txt) : null);
  } catch { return fresh(); }
}

export function writeSave(save, store = globalThis.localStorage) {
  try { store.setItem(KEY, JSON.stringify(save)); } catch { /* storage full or blocked */ }
}

export function resetSave(store = globalThis.localStorage) {
  try { store.removeItem(KEY); store.removeItem(OLD_KEY); } catch { /* ignore */ }
  return fresh();
}
