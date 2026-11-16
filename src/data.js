// Game data only. No logic that touches the DOM.
export const T = {
  bat:    { name: 'Bat',    color: '#b06cff', r: 7,  hp: 6,   spd: 140, dmg: 6,  unlock: 0,   w: 5,   xp: 1, shape: 'tri', pack: 3, fly: true },
  slime:  { name: 'Slime',  color: '#4cff8a', r: 13, hp: 30,  spd: 75,  dmg: 10, unlock: 10,  w: 3,   xp: 2, shape: 'blob', split: true },
  archer: { name: 'Archer', color: '#ffd23f', r: 10, hp: 16,  spd: 85,  dmg: 9,  unlock: 25,  w: 2.5, xp: 2, shape: 'diamond', ranged: true },
  brute:  { name: 'Brute',  color: '#ff7a2f', r: 20, hp: 120, spd: 65,  dmg: 25, unlock: 45,  w: 1.2, xp: 6, shape: 'square' },
  bomber: { name: 'Bomber', color: '#ff3b5c', r: 10, hp: 10,  spd: 120, dmg: 35, unlock: 70, w: 2,   xp: 2, shape: 'circle', explode: true },
  wisp:   { name: 'Wisp',   color: '#4cd9ff', r: 8,  hp: 14,  spd: 120, dmg: 6,  unlock: 95, w: 2,   xp: 3, shape: 'star', blink: true, fly: true },
  // Minions: they come with a class or are raised by it. `unlock: Infinity` keeps them out of the enemy spawn pool.
  squire:   { name: 'Squire',   color: '#2ce8f5', r: 9, hp: 70, spd: 165, dmg: 8,  unlock: Infinity, w: 0, xp: 0, shape: 'circle', minion: true },
  hawk:     { name: 'Hawk',     color: '#feae34', r: 7, hp: 30, spd: 300, dmg: 9,  unlock: Infinity, w: 0, xp: 0, shape: 'tri', fly: true, minion: true },
  imp:      { name: 'Imp',      color: '#e43b44', r: 8, hp: 30, spd: 150, dmg: 6,  unlock: Infinity, w: 0, xp: 0, shape: 'circle', ranged: true, minion: true },
  skeleton: { name: 'Skeleton', color: '#f4f1e8', r: 8, hp: 14, spd: 150, dmg: 5,  unlock: Infinity, w: 0, xp: 0, shape: 'circle', minion: true },
  wolf:     { name: 'Wolf',     color: '#8b8696', r: 9, hp: 46, spd: 235, dmg: 9,  unlock: Infinity, w: 0, xp: 0, shape: 'tri', minion: true },
  drone:    { name: 'Drone',    color: '#2ce8f5', r: 6, hp: 30, spd: 280, dmg: 6,  unlock: Infinity, w: 0, xp: 0, shape: 'circle', fly: true, minion: true },
  golem:    { name: 'Golem',    color: '#8b8696', r: 16, hp: 110, spd: 120, dmg: 6, unlock: Infinity, w: 0, xp: 0, shape: 'square', minion: true },
};

export const ALLY_LINE = {
  bat: 'The Bat swarm now hunts for you.',
  slime: 'The Slime now shields you, and splits when it falls.',
  archer: 'The Archer now covers you from range.',
  brute: 'The Brute now smashes for you.',
  bomber: 'The Bomber now throws itself at your enemies.',
  wisp: 'The Wisp now orbits you, burning anything it touches.',
};

// ---------- upgrades ----------
// Every level-up offers three of these, each at a rarity. Rarity sets the strength `s` passed to f(g, s) and d(s):
// a Common is a little weaker than the old flat upgrade, a Legendary about three times as strong.
// Upgrades that add a whole thing (a projectile, a blade) add k(s) of them: 1, 1, 2 or 3.
// `id` is what a recruit inherits as a perk. `ic` names the icon when it is not i_<id>.
export const RARITY = {
  common: { n: 'Common', s: 0.65, w: 64 },
  rare: { n: 'Rare', s: 1.05, w: 25 },
  epic: { n: 'Epic', s: 1.6, w: 9 },
  legendary: { n: 'Legendary', s: 2.5, w: 2 },
};
export const RARITIES = Object.keys(RARITY);
const pc = v => Math.round(v * 100) + '%', k = s => Math.max(1, Math.round(s)), plus = (s, one, many) => `+${k(s)} ${k(s) > 1 ? many : one}`;
export const UP = [
  { id: 'dmg', n: 'Sharper', d: s => `+${pc(0.3 * s)} damage`, f: (g, s = 1) => g.P.dmg *= 1 + 0.3 * s },
  { id: 'haste', n: 'Trigger Happy', d: s => `+${pc(0.22 * s)} attack speed`, f: (g, s = 1) => g.P.fire /= 1 + 0.22 * s },
  { id: 'spd', n: 'Swift', d: s => `+${pc(0.12 * s)} move speed`, f: (g, s = 1) => g.P.spd *= 1 + 0.12 * s },
  { id: 'tough', n: 'Thick Skin', d: s => `+${Math.round(25 * s)} max health, and heal that much`, f: (g, s = 1) => { const v = Math.round(25 * s); g.P.maxhp += v; g.P.hp = Math.min(g.P.maxhp, g.P.hp + v); } },
  { id: 'shots', n: 'Split Shot', d: s => plus(s, 'projectile', 'projectiles'), f: (g, s = 1) => g.P.multi += k(s) },
  { id: 'pierce', n: 'Piercing', d: s => `Shots pass through +${k(s)} ${k(s) > 1 ? 'enemies' : 'enemy'}`, f: (g, s = 1) => g.P.pierce += k(s) },
  { id: 'magnet', n: 'Magnet', d: s => `+${pc(0.6 * s)} pickup range`, f: (g, s = 1) => g.P.magnet *= 1 + 0.6 * s },
  { id: 'regen', n: 'Regrowth', d: s => `+${(1.5 * s).toFixed(1)} health per second`, f: (g, s = 1) => g.P.regen += 1.5 * s },
  { id: 'rally', n: 'Rally', d: s => `Your nemeses and minions get +${pc(0.25 * s)} damage and health`, ally: true, f: (g, s = 1) => {
    const m = 1 + 0.25 * s; g.allyBuff *= m;
    for (const e of g.ents) if (e.team === 'ally') { e.dmg *= m; e.hp *= m; e.maxhp *= m; }
  } },
  { id: 'pack', n: 'Pack Tactics', d: s => `Your nemeses and minions attack ${pc(0.2 * s)} faster`, ally: true, f: (g, s = 1) => {
    const m = 1 + 0.2 * s; g.allyHaste *= m;
    for (const e of g.ents) if (e.team === 'ally') e.haste *= m;
  } },
  { id: 'wind', n: 'Second Wind', d: () => 'Fallen nemeses return at once, and from now on they return twice as fast', ally: true, fixed: 'rare', f: g => g.secondWind = true },
  { id: 'blade', n: 'Orbiting Blade', d: s => `${plus(s, 'blade', 'blades')} circling you`, f: (g, s = 1) => g.P.blades += k(s) },
  { id: 'chain', n: 'Chain Shot', d: s => `Hits jump to +${k(s)} more ${k(s) > 1 ? 'enemies' : 'enemy'} nearby`, f: (g, s = 1) => g.P.chain += k(s) },
  { id: 'nova', n: 'Nova', d: s => `A blast around you throws enemies back${k(s) > 1 ? ', ' + k(s) + ' times as often' : ''}`, f: (g, s = 1) => g.P.nova += k(s) },
  { id: 'crit', n: 'Lucky Shot', d: s => `+${15 * k(s)}% chance to hit three times as hard`, f: (g, s = 1) => g.P.crit += k(s) },
  { id: 'bond', n: 'Blood Bond', d: s => `Your nemeses and minions heal ${(3 * s).toFixed(1)}% of their health a second`, ally: true, f: (g, s = 1) => g.allyRegen += 0.03 * s },
  { id: 'guard', n: 'Iron Guard', d: s => `Your nemeses and minions take ${pc(1 - 0.75 ** s)} less damage`, ally: true, f: (g, s = 1) => g.allyArmor *= 0.75 ** s },
  // Added with rarities, for variety.
  { id: 'armor', n: 'Plating', d: s => `Take ${pc(1 - 0.9 ** s)} less damage`, f: (g, s = 1) => g.armor *= 0.9 ** s },
  { id: 'scholar', n: 'Scholar', ic: 'i_book', d: s => `+${pc(0.15 * s)} experience from gems`, f: (g, s = 1) => g.xpMul *= 1 + 0.15 * s },
  { id: 'focus', n: 'Focus', ic: 'i_slow', d: s => `Your ability recharges ${pc(1 - 0.85 ** s)} faster`, f: (g, s = 1) => g.P.cdMul *= 0.85 ** s },
  { id: 'frost', n: 'Frostbite', ic: 'i_frost', d: s => `Your hits slow enemies for ${(1.2 + 0.6 * s).toFixed(1)} seconds`, f: (g, s = 1) => g.P.frost += s },
  { id: 'ember', n: 'Wildfire', ic: 'i_flame', d: s => `Your hits set enemies burning for ${pc(0.2 * s)} of the hit`, f: (g, s = 1) => g.P.ember += s },
  { id: 'exec', n: 'Executioner', ic: 'i_skull', d: s => `+${pc(0.35 * s)} damage to enemies below a third of their health`, f: (g, s = 1) => g.P.exec += 0.35 * s },
  { id: 'dodge', n: 'Evasion', ic: 'i_dash', d: s => `${pc(1 - 0.92 ** s)} chance to avoid a hit completely`, f: (g, s = 1) => g.P.dodge = 1 - (1 - g.P.dodge) * 0.92 ** s },
  { id: 'harvest', n: 'Soul Harvest', ic: 'i_soul', d: s => `+${pc(0.2 * s)} souls from this run`, f: (g, s = 1) => g.soulMul *= 1 + 0.2 * s },
  { id: 'leech', n: 'Leech', ic: 'i_fang', d: s => `Heal 1 health every ${Math.max(2, Math.round(10 / s))} kills`, f: (g, s = 1) => g.P.leech += s },
  // Legendary only: one-of-a-kind powers. They can be offered once each per run.
  { id: 'storm', n: 'Thunderstorm', ic: 'i_rod', leg: true, d: () => 'Lightning strikes a random enemy every second', f: g => g.storm = true },
  { id: 'phoenix', n: 'Phoenix', ic: 'i_hour', leg: true, d: () => 'The next time you would die, you rise at half health with a shockwave', f: g => g.phoenix = true },
  { id: 'midas', n: 'Midas Touch', ic: 'i_coin', leg: true, d: () => 'Every gem is worth double', f: g => g.xpMul *= 2 },
  { id: 'titan', n: 'Titan', ic: 'i_tough', leg: true, d: () => 'Double your max health and heal to full', f: g => { g.P.maxhp *= 2; g.P.hp = g.P.maxhp; } },
  { id: 'twin', n: 'Twin Soul', ic: 'i_decoy', leg: true, minion: true, d: () => 'A second copy of your class minion joins you', f: g => g.twin = true },
];
// The text on a card. Some upgrades mean something different for the equipped weapon (see WEAPONS[...].up).
export const upText = (u, s = 1, weaponUp) => (weaponUp && weaponUp[u.id] && k(s) === 1 ? weaponUp[u.id] : weaponUp && weaponUp[u.id] ? weaponUp[u.id] + ' (x' + k(s) + ')' : u.d(s));

// Perks a recruit can inherit from the build you died with, and the title each one earns.
export const PERKS = {
  dmg: { label: 'Sharper', title: 'the Sharp' },
  haste: { label: 'Trigger Happy', title: 'the Frenzied' },
  spd: { label: 'Swift', title: 'the Swift' },
  tough: { label: 'Thick Skin', title: 'the Unbroken' },
  shots: { label: 'Split Shot', title: 'the Splitter' },
  pierce: { label: 'Piercing', title: 'the Piercer' },
  regen: { label: 'Regrowth', title: 'the Undying' },
  // Since Phase 17 a recruit takes the newer upgrades too. Each means something for an ally (see spawnAlly and think).
  crit: { label: 'Lucky Shot', title: 'the Lucky' },
  chain: { label: 'Chain Shot', title: 'the Chained' },
  blade: { label: 'Orbiting Blade', title: 'the Bladed' },
  nova: { label: 'Nova', title: 'the Bursting' },
  armor: { label: 'Plating', title: 'the Plated' },
  frost: { label: 'Frostbite', title: 'the Cold' },
  ember: { label: 'Wildfire', title: 'the Burning' },
};
// What a recruit does with the weapon you died holding, and with a Legendary power you had.
export const WEAPON_TRAIT = {
  blaster: 'Shoots as well as fighting',
  sword: 'Its hits cleave everything close by',
  rang: 'Throws a blade that passes through everything',
  flame: 'Leaves fire where it walks',
  rod: 'Calls down lightning that arcs',
  totem: 'Plants totems that shoot',
};
export const LEG_TRAIT = {
  storm: 'Lightning strikes near it',
  phoenix: 'Rises again at once, the first time it falls',
  midas: 'Its kills drop gems worth double',
  titan: 'Double health',
  twin: 'Comes as two',
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
// A charm is the third loadout slot: one odd passive effect. Optional; you start with none.
export const CHARMS = {
  thorn: { n: 'Thorn Mail', i: '✹', d: 'Enemies that hit you are hurt and thrown back.' },
  ember: { n: 'Ember Heart', i: '♨', d: 'A burning aura hurts enemies that stand near you.' },
  lode: { n: 'Lodestone', i: '◈', d: 'Every gem you collect fires a shard at the nearest enemy.' },
  fang: { n: 'Vampire Fang', i: '♥', d: 'Heal 5 for every 25 kills.' },
  hour: { n: 'Hourglass', i: '⧗', d: 'Once per run, death rewinds you to 30% health with a shockwave.' },
  after: { n: 'Afterimage', i: '☻', d: 'Being hit leaves a decoy behind for enemies to chase.' },
  banner: { n: 'Pack Banner', i: '⚑', d: 'Fallen nemeses return twice as fast.' },
  coin: { n: 'Lucky Coin', i: '◉', d: 'Elites, and their chests, come twice as often.' },
};
// Power-ups lie on the ground for a few seconds. Walk over one to use it.
export const POWERUPS = {
  frenzy: { n: 'Frenzy', i: '⚡', c: '#ffd23f', d: 'Attack twice as fast for 8 seconds.' },
  bubble: { n: 'Bubble', i: '◯', c: '#9fe8ff', d: 'Absorbs the next 3 hits.' },
  freeze: { n: 'Freeze', i: '❄', c: '#4cd9ff', d: 'Every enemy is frozen for 2 seconds.' },
  bomb: { n: 'Bomb', i: '✸', c: '#ff7a2f', d: 'Damages everything on screen.' },
  vortex: { n: 'Vortex', i: '◎', c: '#7dffb0', d: 'Every gem flies to you.' },
  giant: { n: 'Giant', i: '▲', c: '#b06cff', d: 'Your nemeses grow, heal half their health and hit 50% harder for 6 seconds.' },
};
export const START_GEAR = ['blaster', 'dash'];
export const ALL_GEAR = [...Object.keys(WEAPONS), ...Object.keys(ABILITIES), ...Object.keys(CHARMS)];
export const gearOf = id => WEAPONS[id] || ABILITIES[id] || CHARMS[id] || null;

// ---------- classes ----------
// A class is chosen on the title screen. It gives a passive bonus and a starter minion with its own ability.
// Weapons, abilities and charms stay a free choice on the loadout screen.
export const CLASSES = {
  knight: { n: 'Knight', sprite: 'c_knight', d: '+30 health, and you take 15% less damage. Every 10 seconds your shield blocks one hit outright.', ult: { n: 'Bulwark', d: 'For 4 seconds nothing can hurt you, and everything that comes near is cut down and thrown back.' }, minion: 'squire',
    md: 'Squire: stays close, blocks enemy shots with his shield and stuns with a shield bash.' },
  ranger: { n: 'Ranger', sprite: 'c_ranger', d: '+10% move speed and +8% attack speed. Every 5th attack is a power shot: triple damage, and it passes through everything.', ult: { n: 'Arrow Storm', d: 'Arrows rain from the sky for 4 seconds, striking enemies all across the screen.' }, minion: 'hawk',
    md: 'Hawk: cannot be hurt. Dives at the toughest enemy and marks it; marked enemies take 20% more damage.' },
  necro: { n: 'Necromancer', sprite: 'c_necro', d: 'Every 10th kill rises as a Skeleton to fight for you (up to 5). Skeletons explode when they fall.', ult: { n: 'Army of the Dead', d: 'Seven Skeletons claw out of the ground around you at once.' }, minion: 'imp',
    md: 'Imp: throws fireballs that set enemies burning.' },
  // Locked classes. `lock.need(save)` returns [have, want]; unlocked for good once have >= want.
  berserker: { n: 'Berserker', sprite: 'c_berserker', d: 'The lower your health, the harder you hit: up to +60% damage.', ult: { n: 'Blood Rage', d: 'For 4 seconds you deal 25% more damage, attack twice as fast, and kills heal you a little.' }, minion: 'wolf',
    md: 'Wolf: fast and savage. Its howl sends you into a frenzy, attacking twice as fast for a moment.',
    lock: { text: 'Kill 1,000 enemies in total', need: s => [s.stats.kills, 1000] } },
  engineer: { n: 'Engineer', sprite: 'c_engineer', d: 'Power-ups drop more than twice as often, and Frenzy and Giant last half again as long.', ult: { n: 'Orbital Laser', d: 'A beam from the sky spirals around you, burning everything it crosses.' }, minion: 'drone',
    md: 'Drone: cannot be hurt. Circles you, shooting the nearest enemy.',
    lock: { text: 'Open 8 chests in total', need: s => [s.stats.chests, 8] } },
  warden: { n: 'Warden', sprite: 'c_warden', d: 'You slowly regenerate health.', ult: { n: 'Wrath of the Wild', d: 'Roots burst up and hold every enemy on screen for 2 seconds, and you heal a little.' }, minion: 'golem',
    md: 'Golem: a wall of stone. Slams the ground to stun everything close, and for a moment enemies turn on it instead of you.',
    lock: { text: 'Slay your nemesis once', need: s => [Math.min(1, s.wins), 1] } },
};
export const START_CLASSES = ['knight', 'ranger', 'necro'];
// Each class has an ultimate, charged by kills and used with E (or the touch button).
// Class mastery: time survived as a class (plus a bonus for winning) raises its level. Each level makes its
// minion 15% stronger and you 2% stronger. Thresholds in seconds for levels 2..5.
export const MASTERY = [240, 720, 1500, 3000];
export const masteryLevel = xp => MASTERY.filter(v => xp >= v).length;   // 0..4, shown as level 1..5

// ---------- the Shrine: permanent upgrades bought with souls ----------
// Souls are earned by every run, win or lose. cost[i] is the price of rank i + 1.
export const META = [
  { id: 'vit', n: 'Vitality', i: 'i_tough', d: '+8 max health', cost: [30, 60, 110, 180, 280] },
  { id: 'might', n: 'Might', i: 'i_dmg', d: '+5% damage', cost: [40, 80, 140, 220, 340] },
  { id: 'haste', n: 'Quickness', i: 'i_haste', d: '+4% attack speed', cost: [40, 80, 140, 220, 340] },
  { id: 'swift', n: 'Swiftness', i: 'i_spd', d: '+3% move speed', cost: [30, 60, 110, 180, 280] },
  { id: 'wisdom', n: 'Wisdom', i: 'i_magnet', d: '+8% experience from gems', cost: [40, 80, 140, 220, 340] },
  { id: 'greed', n: 'Greed', i: 'i_coin', d: '+10% souls from every run', cost: [50, 100, 170, 260, 380] },
  { id: 'kin', n: 'Kinship', i: 'i_rally', d: '+8% strength for nemeses and minions', cost: [40, 80, 140, 220, 340] },
  { id: 'luck', n: 'Fortune', i: 'i_crit', d: 'Rare, Epic and Legendary upgrades turn up 12% more often', cost: [60, 120, 200, 300, 420] },
  { id: 'reroll', n: 'Second Thoughts', i: 'i_wind', d: '+1 reroll of your level-up choices each run', cost: [80, 200, 400] },
];
// Nemesis+: a ladder of difficulty tiers. Winning at your highest tier unlocks the next.
export const MAX_TIER = 5;


// ---------- missions ----------
// Three are active at a time; finishing one pays souls and deals a new one. `stat` names a number from the run
// (see runStats in src/main.js). sum: progress adds up across runs; otherwise it must be reached in a single run.
// n: targets, growing as you play more.
const mmss = v => Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
export const MISSIONS = [
  { id: 'kills', stat: 'kills', sum: true, n: [150, 250, 400], pay: 25, text: n => `Kill ${n} enemies` },
  { id: 'bats', stat: 'k_bat', sum: true, n: [80, 140], pay: 25, text: n => `Kill ${n} Bats` },
  { id: 'slimes', stat: 'k_slime', sum: true, n: [30, 60], pay: 25, text: n => `Kill ${n} Slimes` },
  { id: 'archers', stat: 'k_archer', sum: true, n: [20, 40], pay: 25, text: n => `Kill ${n} Archers` },
  { id: 'brutes', stat: 'k_brute', sum: true, n: [8, 15], pay: 30, text: n => `Kill ${n} Brutes` },
  { id: 'bombers', stat: 'k_bomber', sum: true, n: [12, 25], pay: 30, text: n => `Kill ${n} Bombers` },
  { id: 'survive', stat: 't', n: [150, 210, 270], pay: 30, text: n => `Survive ${mmss(n)} in one run` },
  { id: 'level', stat: 'lvl', n: [10, 14, 18], pay: 30, text: n => `Reach level ${n} in one run` },
  { id: 'streak', stat: 'streak', n: [25, 50, 100], pay: 35, text: n => `Get a kill streak of ${n}` },
  { id: 'chests', stat: 'opened', sum: true, n: [2, 4], pay: 30, text: n => `Open ${n} chests` },
  { id: 'powerups', stat: 'powerups', sum: true, n: [4, 8], pay: 25, text: n => `Use ${n} power-ups` },
  { id: 'elites', stat: 'elites', sum: true, n: [3, 6], pay: 30, text: n => `Kill ${n} elites` },
  { id: 'ability', stat: 'acts', sum: true, n: [15, 30], pay: 20, text: n => `Use your ability ${n} times` },
  { id: 'epic', stat: 'epics', sum: true, n: [2, 4], pay: 35, text: n => `Pick ${n} Epic or Legendary upgrades` },
];
