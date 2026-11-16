// Versioned save. A corrupt or old save never crashes the game.
import { T, PERKS } from './data.js';

const KEY = 'nemesis_save';
const OLD_KEY = 'nemesis_v1';
const VERSION = 3;
export const MAX_PER_TYPE = 3;
export const PARTY_SIZE = 3;
const fresh = () => ({ v: VERSION, nemeses: [], party: [], best: 0, runs: 0, wins: 0, deaths: {}, nextId: 1 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function cleanNem(n, id) {
  if (!n || !T[n.type]) return null;
  const perks = {};
  for (const k in PERKS) { const c = Math.floor(Number(n.perks?.[k])); if (c > 0) perks[k] = Math.min(3, c); }
  return {
    id, type: n.type, perks, q: clamp(Number(n.q) || 0.3, 0.3, 3),
    name: typeof n.name === 'string' ? n.name.slice(0, 16) : T[n.type].name,
    title: typeof n.title === 'string' ? n.title.slice(0, 24) : 'the Unproven',
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
      for (let i = 0; i < n && T[k]; i++) s.nemeses.push({ id: s.nextId++, type: k, perks: {}, q: 0.8, name: 'Old ' + T[k].name, title: 'the Remembered' });
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
  return s;
}

// A recruit joins if there is room for its type, or if it beats your weakest of that type.
// Returns { status: 'joined' | 'replaced' | 'rejected', nem?, old? }.
export function addRecruit(save, rec) {
  const same = save.nemeses.filter(n => n.type === rec.type);
  if (same.length < MAX_PER_TYPE) {
    const nem = { id: save.nextId++, ...rec };
    save.nemeses.push(nem);
    if (save.party.length < PARTY_SIZE) save.party.push(nem.id);
    return { status: 'joined', nem };
  }
  const old = same.reduce((a, b) => (b.q < a.q ? b : a));
  if (rec.q <= old.q) return { status: 'rejected', old };
  const nem = { id: old.id, ...rec };
  save.nemeses[save.nemeses.indexOf(old)] = nem;
  return { status: 'replaced', nem, old };
}

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
