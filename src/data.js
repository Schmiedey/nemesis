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
  { id: 'dmg', n: 'Sharper', d: '+30% damage', f: g => g.P.dmg *= 1.3 },
  { id: 'haste', n: 'Trigger Happy', d: '+22% fire rate', f: g => g.P.fire *= 0.82 },
  { id: 'spd', n: 'Swift', d: '+12% move speed', f: g => g.P.spd *= 1.12 },
  { id: 'tough', n: 'Thick Skin', d: '+25 max HP, heal 25', f: g => { g.P.maxhp += 25; g.P.hp = Math.min(g.P.maxhp, g.P.hp + 25); } },
  { id: 'shots', n: 'Split Shot', d: '+1 projectile', f: g => g.P.multi++ },
  { id: 'pierce', n: 'Piercing', d: 'Shots pass through +1 enemy', f: g => g.P.pierce++ },
  { id: 'magnet', n: 'Magnet', d: '+60% pickup range', f: g => g.P.magnet *= 1.6 },
  { id: 'regen', n: 'Regrowth', d: '+1.5 HP per second', f: g => g.P.regen += 1.5 },
  { id: 'rally', n: 'Rally', d: 'Your nemeses get +25% damage and HP', ally: true, f: g => {
    g.allyBuff *= 1.25;
    for (const e of g.ents) if (e.team === 'ally') { e.dmg *= 1.25; e.hp *= 1.25; e.maxhp *= 1.25; }
  } },
  { id: 'pack', n: 'Pack Tactics', d: 'Your nemeses attack 20% faster', ally: true, f: g => {
    g.allyHaste *= 1.2;
    for (const e of g.ents) if (e.team === 'ally') e.haste *= 1.2;
  } },
  { id: 'wind', n: 'Second Wind', d: 'Fallen nemeses return; all get +1 life', ally: true, f: g => g.secondWind = true },
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

export const rankName = q => q < 0.7 ? 'Runt' : q < 1.3 ? 'Soldier' : q < 2 ? 'Veteran' : 'Champion';
export const BOSS_TIME = 300;
