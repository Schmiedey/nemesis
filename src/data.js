// Game data only. No logic that touches the DOM.
export const T = {
  bat:    { name: 'Bat',    color: '#b06cff', r: 7,  hp: 6,   spd: 150, dmg: 6,  unlock: 0,   w: 5,   xp: 1, shape: 'tri' },
  slime:  { name: 'Slime',  color: '#4cff8a', r: 13, hp: 30,  spd: 55,  dmg: 10, unlock: 20,  w: 3,   xp: 2, shape: 'blob', split: true },
  archer: { name: 'Archer', color: '#ffd23f', r: 10, hp: 16,  spd: 70,  dmg: 9,  unlock: 45,  w: 2.5, xp: 2, shape: 'diamond', ranged: true },
  brute:  { name: 'Brute',  color: '#ff7a2f', r: 20, hp: 120, spd: 45,  dmg: 25, unlock: 75,  w: 1.2, xp: 6, shape: 'square' },
  bomber: { name: 'Bomber', color: '#ff3b5c', r: 10, hp: 10,  spd: 115, dmg: 35, unlock: 105, w: 2,   xp: 2, shape: 'circle', explode: true },
  wisp:   { name: 'Wisp',   color: '#4cd9ff', r: 8,  hp: 14,  spd: 120, dmg: 6,  unlock: 140, w: 2,   xp: 3, shape: 'star', blink: true },
};

export const ALLY_LINE = {
  bat: 'The Bat swarm now hunts for you.',
  slime: 'The Slime now shields you, and splits when it falls.',
  archer: 'The Archer now covers you from range.',
  brute: 'The Brute now smashes for you.',
  bomber: 'The Bomber now throws itself at your enemies.',
  wisp: 'The Wisp now orbits you, burning anything it touches.',
};

// Upgrades get the game state `g`.
export const UP = [
  { n: 'Sharper', d: '+30% damage', f: g => g.P.dmg *= 1.3 },
  { n: 'Trigger Happy', d: '+22% fire rate', f: g => g.P.fire *= 0.82 },
  { n: 'Swift', d: '+12% move speed', f: g => g.P.spd *= 1.12 },
  { n: 'Thick Skin', d: '+25 max HP, full heal', f: g => { g.P.maxhp += 25; g.P.hp = g.P.maxhp; } },
  { n: 'Split Shot', d: '+1 projectile', f: g => g.P.multi++ },
  { n: 'Piercing', d: 'Shots pass through +1 enemy', f: g => g.P.pierce++ },
  { n: 'Magnet', d: '+60% pickup range', f: g => g.P.magnet *= 1.6 },
  { n: 'Regrowth', d: '+1.5 HP per second', f: g => g.P.regen += 1.5 },
  { n: 'Rally', d: 'Your nemeses get +25% damage and HP', ally: true, f: g => {
    g.allyBuff *= 1.25;
    for (const e of g.ents) if (e.team === 'ally') { e.dmg *= 1.25; e.hp *= 1.25; e.maxhp *= 1.25; }
  } },
];
