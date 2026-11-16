// Game data only. No logic that touches the DOM.
export const T = {
  bat:    { name: 'Bat',    color: '#b06cff', r: 7,  hp: 6,   spd: 140, dmg: 6,  unlock: 0,   w: 5,   xp: 1, shape: 'tri', pack: 3, fly: true },
  slime:  { name: 'Slime',  color: '#4cff8a', r: 13, hp: 30,  spd: 75,  dmg: 10, unlock: 10,  w: 3,   xp: 2, shape: 'blob', split: true },
  archer: { name: 'Archer', color: '#ffd23f', r: 10, hp: 16,  spd: 85,  dmg: 9,  unlock: 25,  w: 2.5, xp: 2, shape: 'diamond', ranged: true },
  brute:  { name: 'Brute',  color: '#ff7a2f', r: 20, hp: 120, spd: 65,  dmg: 25, unlock: 45,  w: 1.2, xp: 6, shape: 'square' },
  bomber: { name: 'Bomber', color: '#ff3b5c', r: 10, hp: 10,  spd: 120, dmg: 35, unlock: 70, w: 2,   xp: 2, shape: 'circle', explode: true },
  wisp:   { name: 'Wisp',   color: '#4cd9ff', r: 8,  hp: 14,  spd: 120, dmg: 6,  unlock: 95, w: 2,   xp: 3, shape: 'star', blink: true, fly: true },
};

export const ALLY_LINE = {
  bat: 'The Bat swarm now hunts for you.',
  slime: 'The Slime now shields you, and splits when it falls.',
  archer: 'The Archer now covers you from range.',
  brute: 'The Brute now smashes for you.',
  bomber: 'The Bomber now throws itself at your enemies.',
  wisp: 'The Wisp now orbits you, burning anything it touches.',
};

// Upgrades get the game state `g`. `id` is what a recruit inherits as a perk.
export const UP = [
  { id: 'dmg', i: '⚔', n: 'Sharper', d: '+30% damage', f: g => g.P.dmg *= 1.3 },
  { id: 'haste', i: '⚡', n: 'Trigger Happy', d: '+22% fire rate', f: g => g.P.fire *= 0.82 },
  { id: 'spd', i: '➤', n: 'Swift', d: '+12% move speed', f: g => g.P.spd *= 1.12 },
  { id: 'tough', i: '♥', n: 'Thick Skin', d: '+25 max HP, heal 25', f: g => { g.P.maxhp += 25; g.P.hp = Math.min(g.P.maxhp, g.P.hp + 25); } },
  { id: 'shots', i: '⋔', n: 'Split Shot', d: '+1 projectile', f: g => g.P.multi++ },
  { id: 'pierce', i: '➶', n: 'Piercing', d: 'Shots pass through +1 enemy', f: g => g.P.pierce++ },
  { id: 'magnet', i: '◎', n: 'Magnet', d: '+60% pickup range', f: g => g.P.magnet *= 1.6 },
  { id: 'regen', i: '✚', n: 'Regrowth', d: '+1.5 HP per second', f: g => g.P.regen += 1.5 },
  { id: 'rally', i: '⚑', n: 'Rally', d: 'Your nemeses get +25% damage and HP', ally: true, f: g => {
    g.allyBuff *= 1.25;
    for (const e of g.ents) if (e.team === 'ally') { e.dmg *= 1.25; e.hp *= 1.25; e.maxhp *= 1.25; }
  } },
  { id: 'pack', i: '☰', n: 'Pack Tactics', d: 'Your nemeses attack 20% faster', ally: true, f: g => {
    g.allyHaste *= 1.2;
    for (const e of g.ents) if (e.team === 'ally') e.haste *= 1.2;
  } },
  { id: 'blade', i: '✦', n: 'Orbiting Blade', d: '+1 blade circling you that cuts what it touches', f: g => g.P.blades++ },
  { id: 'chain', i: '∞', n: 'Chain Shot', d: 'Shots jump to +1 more enemy nearby', f: g => g.P.chain++ },
  { id: 'nova', i: '✺', n: 'Nova', d: 'A blast around you throws enemies back; more picks, more often', f: g => g.P.nova++ },
  { id: 'crit', i: '★', n: 'Lucky Shot', d: '+15% chance for a shot to hit three times as hard', f: g => g.P.crit++ },
  { id: 'bond', i: '❤', n: 'Blood Bond', d: 'Your nemeses heal 3% of their health each second', ally: true, f: g => g.allyRegen += 0.03 },
  { id: 'guard', i: '⛨', n: 'Iron Guard', d: 'Your nemeses take 25% less damage', ally: true, f: g => g.allyArmor *= 0.75 },
  { id: 'wind', i: '↺', n: 'Second Wind', d: 'Fallen nemeses return; all get +1 life', ally: true, f: g => g.secondWind = true },
];

// Perks a recruit can inherit from the build you died with, and the title each one earns.
export const PERKS = {
  dmg: { label: 'Sharper', title: 'the Sharp' },
  haste: { label: 'Trigger Happy', title: 'the Frenzied' },
  spd: { label: 'Swift', title: 'the Swift' },
  tough: { label: 'Thick Skin', title: 'the Unbroken' },
  shots: { label: 'Split Shot', title: 'the Splitter' },
  pierce: { label: 'Piercing', title: 'the Piercer' },
  regen: { label: 'Regrowth', title: 'the Undying' },
};

// What each nemesis type does for you at any rank, shown on its card.
export const JOB = {
  bat: 'Fetches gems for you',
  slime: 'Draws enemies onto itself; takes 40% less damage',
  archer: 'Its shots slow enemies',
  brute: 'Knocks enemies back and stuns them',
  bomber: 'Blows up, then comes straight back',
  wisp: 'Burns up enemy shots near you',
};

// A Champion picks one of two evolutions, for good. Keys are read by src/sim.js.
export const EVOS = {
  bat: [{ id: 'brood', n: 'Brood', d: 'A pack of 5 instead of 3' }, { id: 'vampire', n: 'Vampire', d: 'Each bite heals you 1 HP' }],
  slime: [{ id: 'mother', n: 'Mother', d: 'Splits into 4 when it falls' }, { id: 'bulwark', n: 'Bulwark', d: 'Takes 70% less damage' }],
  archer: [{ id: 'volley', n: 'Volley', d: 'Fires 2 extra arrows' }, { id: 'frost', n: 'Frost', d: 'Slow is stronger and lasts twice as long' }],
  brute: [{ id: 'quake', n: 'Quake', d: 'Every hit knocks back all enemies nearby' }, { id: 'juggernaut', n: 'Juggernaut', d: 'Double health' }],
  bomber: [{ id: 'cluster', n: 'Cluster', d: 'Much bigger blast' }, { id: 'fuse', n: 'Short Fuse', d: 'Returns twice as fast' }],
  wisp: [{ id: 'storm', n: 'Storm', d: 'Two wisps orbit you' }, { id: 'ward', n: 'Ward', d: 'Burns shots from twice as far; strikes faster' }],
};
export const evoOf = n => (EVOS[n.type] || []).find(e => e.id === n.evo) || null;
export const CHAMPION_Q = 2;

export const rankName = q => q < 0.7 ? 'Runt' : q < 1.3 ? 'Soldier' : q < 2 ? 'Veteran' : 'Champion';
export const BOSS_TIME = 300;

// Feats: one-time goals. Each unlocks a boon, an upgrade (by id in UP) you may start a run with.
// test(save, run): run is {} outside a run, else { t, kills, won, dead, party, runts, hard, daily, opened }.
export const FEATS = [
  { id: 'first', n: 'First Blood', d: 'Die for the first time', boon: 'magnet', test: (s, r) => !!r.dead },
  { id: 'two', n: 'Holding On', d: 'Survive 2:00', boon: 'tough', test: (s, r) => r.t >= 120 },
  { id: 'four', n: 'Hard to Kill', d: 'Survive 4:00', boon: 'regen', test: (s, r) => r.t >= 240 },
  { id: 'slayer', n: 'Slayer', d: 'Kill 300 enemies in one run', boon: 'dmg', test: (s, r) => r.kills >= 300 },
  { id: 'win', n: 'Nemesis Slain', d: 'Win a run', boon: 'shots', test: (s, r) => !!r.won },
  { id: 'alone', n: 'Alone', d: 'Win with no party', boon: 'crit', test: (s, r) => !!r.won && r.party === 0 },
  { id: 'runts', n: 'Underdogs', d: 'Reach 3:00 with a full party of Runts', boon: 'bond', test: (s, r) => r.t >= 180 && !!r.runts },
  { id: 'six', n: 'Collector', d: 'Have 6 nemeses', boon: 'guard', test: s => s.nemeses.length >= 6 },
  { id: 'champ', n: 'Champion', d: 'Raise a nemesis to Champion', boon: 'rally', test: s => s.nemeses.some(n => n.q >= CHAMPION_Q) },
  { id: 'evo', n: 'Evolved', d: 'Evolve a nemesis', boon: 'pack', test: s => s.nemeses.some(n => n.evo) },
  { id: 'chests', n: 'Treasure Hunter', d: 'Open 3 chests in one run', boon: 'chain', test: (s, r) => r.opened >= 3 },
  { id: 'plus', n: 'Nemesis+', d: 'Win on Nemesis+', boon: 'nova', test: (s, r) => !!r.won && !!r.hard },
  { id: 'daily', n: 'Daily Grind', d: 'Survive 3:00 in a daily run', boon: 'blade', test: (s, r) => !!r.daily && r.t >= 180 },
];
export const upName = id => (UP.find(u => u.id === id) || {}).n || id;

// ---------- gear: weapons and abilities (rules in src/sim.js) ----------
// A weapon replaces how you attack. `up` rewrites what Split Shot and Piercing do for it; `no` lists upgrades that do nothing for it.
export const WEAPONS = {
  blaster: { n: 'Blaster', i: '➤', d: 'Fires shots at the nearest enemy.' },
  sword: { n: 'Greatsword', i: '⚔', d: 'Sweeps a wide arc, throwing back everything in reach.',
    up: { shots: 'Sweep behind you too, then all around', pierce: 'Longer reach' } },
  rang: { n: 'Boomerang', i: '☽', d: 'Flies out and returns, cutting both ways. Catch it to throw sooner.',
    up: { shots: '+1 boomerang', pierce: 'Larger blade' } },
  flame: { n: 'Flamewalker', i: '♨', d: 'You leave a burning trail where you walk.',
    up: { shots: 'Wider trail', pierce: 'Fire lasts longer' }, no: ['chain'] },
  rod: { n: 'Storm Rod', i: 'ϟ', d: 'Lightning strikes the nearest enemy and arcs to others.',
    up: { shots: '+2 arcs', pierce: 'Arcs jump further' } },
  totem: { n: 'Totem', i: '♜', d: 'Drops totems that shoot on their own.',
    up: { shots: '+1 totem', pierce: 'Totems last longer' } },
};
// One ability is equipped and used with Space or the touch button. cd: cooldown in seconds.
export const ABILITIES = {
  dash: { n: 'Dash', i: '»', cd: 4, d: 'A burst of speed. Nothing can hit you, and you cut what you pass through.' },
  shock: { n: 'Shockwave', i: '✺', cd: 10, d: 'Throws back and stuns everything near you, and clears enemy shots.' },
  slow: { n: 'Time Slow', i: '⧖', cd: 18, d: 'Enemies and their shots crawl for 3 seconds.' },
  decoy: { n: 'Decoy', i: '☻', cd: 20, d: 'Drops a copy of you that enemies chase. Then it explodes.' },
  rally: { n: 'Rally', i: '⚑', cd: 20, d: 'Your nemeses jump to you, heal, and attack faster for 5 seconds.' },
};
export const START_GEAR = ['blaster', 'dash'];
export const ALL_GEAR = [...Object.keys(WEAPONS), ...Object.keys(ABILITIES)];
export const gearOf = id => WEAPONS[id] || ABILITIES[id] || null;
