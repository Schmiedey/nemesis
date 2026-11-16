// Versioned save. A corrupt or old save never crashes the game.
import { T } from './data.js';

const KEY = 'nemesis_save';
const OLD_KEY = 'nemesis_v1';
const VERSION = 2;
const fresh = () => ({ v: VERSION, roster: {}, best: 0, runs: 0 });

// Accepts anything; returns a valid save object.
export function sanitize(raw) {
  const s = fresh();
  if (!raw || typeof raw !== 'object') return s;
  if (raw.roster && typeof raw.roster === 'object') {
    for (const k in raw.roster) {
      const n = Math.floor(Number(raw.roster[k]));
      if (T[k] && n > 0) s.roster[k] = n;
    }
  }
  if (Number.isFinite(raw.best) && raw.best > 0) s.best = raw.best;
  if (Number.isFinite(raw.runs) && raw.runs > 0) s.runs = Math.floor(raw.runs);
  return s;
}

export function loadSave(store = globalThis.localStorage) {
  try {
    const txt = store.getItem(KEY) ?? store.getItem(OLD_KEY); // v1 saves migrate on first load
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
