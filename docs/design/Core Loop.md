# Core Loop

1. **Draft** up to 3 nemeses from your collection.
2. **Survive.** Movement only; aim is automatic. Kill, collect gems, level up, pick 1 of 3 upgrades.
3. **Die, or win.**
   - Die: the enemy type that landed the killing blow becomes a *named* nemesis.
   - Win: kill your true nemesis, the boss that arrives at 5:00. Your party ranks up (+0.25 quality).

## Recruits
- **Earned.** Quality = 0.3 + seconds/140 + level × 0.03 (+0.3 if the boss killed you), capped at 3.
  Runt < 0.7 ≤ Soldier < 1.3 ≤ Veteran < 2 ≤ Champion. Dying at 0:05 earns a runt.
- **Inherits your build.** Up to 3 each of: Sharper, Trigger Happy, Swift, Thick Skin, Split Shot, Piercing, Regrowth.
  A melee nemesis with Split Shot or Piercing also shoots. Its title comes from its strongest perk.
- **Collection cap:** 3 per enemy type. A new recruit replaces your weakest of that type only if it is stronger; otherwise it is turned away.

## Allies in a run
- 3 lives each (Bombers 6). Out of lives means gone for the run. The Second Wind card brings them back.
- Bats come as a pack of 3.
- Ally cards: Rally, Pack Tactics, Second Wind.

## Boss
A giant version of the enemy type that has killed you most. Chases you, summons its kind, fires bullet rings. 3500 HP.

## Pacing
- Enemies start arriving within the first second; spawn gap shrinks from 0.85s to 0.42s.
- New enemy types at 0:10 (Slime), 0:25 (Archer), 0:45 (Brute), 1:10 (Bomber), 1:35 (Wisp).
- Every enemy is slower than the player (fastest is the Bat at 140 vs your 200) and gets up to 15% faster over a run. Hits do 25% more than base.
- Enemies steer at 3 radians per second instead of snapping onto you, so a sharp turn shakes them off. Within 90 units they turn freely.
- **Enemies hunt the player.** They only turn on a nemesis within 110 units, so allies help but do not hide you.
- **Surge** every 20s: a wave closes in from one side (3 groups, +1 every 50s), with a red arc warning.
- A stronger party draws a slightly bigger swarm (+1.5% spawns per point of total quality; was 3%), on top of a base 1.3x. At most 240 enemies are alive at once.

## Nemesis jobs, growth and evolutions (Phase 4)
Every nemesis has a job that works at any rank, so even a Runt changes a run (`JOB` in `src/data.js`, rules in `src/sim.js`):
- **Bat**: fetches gems; any gem a bat passes flies to you, and idle bats go looking for gems.
- **Slime**: draws walking enemies within 150 units onto itself and takes 40% less damage.
- **Archer**: its shots slow enemies to 55% speed for 2s.
- **Brute**: each hit knocks the enemy back and stuns it for 0.6s.
- **Bomber**: blows itself up, then returns in 3s without losing a life (being killed still costs one).
- **Wisp**: burns up enemy shots that come near it (not the boss's).

Ally strength: health x(3.4 + 1.6q), damage x(0.9 + 1.5q), where q is quality; they move at 1.2x, attack every 0.45s and go for enemies within 460. **A nemesis is never gone for good**: it returns 5s after falling, 3s longer each fall, at most 20s (the old three-lives rule left most of the party dead by mid-run: the Archer and Slime were alive about a quarter of the time). Second Wind brings everyone back at once and halves return times. The party HUD shows each nemesis's health, kills this run and return countdown.

**Growth.** A nemesis is credited with its own kills. After each run it gains quality: 0.006 per kill (at most 0.3 a run), plus 0.25 for a win (`growParty` in `src/save.js`). Its lifetime kills, runs and wins are saved.

**Evolutions.** At Champion (q of 2 or more) a nemesis picks one of two evolutions on the roster screen, once and for good (`EVOS` in `src/data.js`): Bat Brood/Vampire, Slime Mother/Bulwark, Archer Volley/Frost, Brute Quake/Juggernaut, Bomber Cluster/Short Fuse, Wisp Storm/Ward.

## Maps
- Three fixed layouts, one picked per run from the seed (`LAYOUTS` in `src/sim.js`): **Pillars** (four pillars round the centre, clusters in corners), **Corridors** (two broken walls), **Ring** (a ring of rocks with four gaps).
- **The world** (Phase 24) is 4800x3000, about five screens across. The run's Crypt layout (Pillars, Corridors or Ring) sits in the middle as it always did; the rest is scattered with rock clusters from the seed (`buildWorld` in `src/sim.js`, about 70 rocks, always a 34-unit path between them). Rocks sit in a 160-unit grid (`rocksNear`) so collision only checks nearby ones.
- **Walls** (Phase 24 step 2): between the rock clusters stand ruins: a single wall, a corner, or a small room with two to four 84-wide doorways (about 40-60 wall pieces per world). Walls block like rocks (you, walkers, allies, enemy shots); flyers and your shots pass over. Walking enemies and allies follow a **flow field** (40-unit grid, filled outward from you every 0.25s) only when a rock or wall blocks the straight line, so open-ground fights play as before. The bot scores walls like rocks.
- **Biomes** (Phase 24 step 3) in rings round the Crypt, about a third of the world each (400-unit cells, `biomeAt`): **Bone Fields** (dusty brown floor, bones, bleached boulders), **Sunken Halls** (cold blue stone, mossy boulders, more ruins, water pools 50-90 across), **Ember Pits** at the edges and corners (scorched floor, glowing cracks, basalt, lava pools 40-72). Rocks and ruins keep clear of pools.
- **Water** slows walking enemies to 55%. **Lava** burns walking enemies for 3 + 8% of their health every 0.5s. Neither touches you or your nemeses: the world never steals a death, because whatever kills you has to be something that can join you. Lure the swarm through lava; keep water between you and it.
- **Landmarks** (Phase 24 step 4, `buildWorld` places them, `landmarks` runs them):
  - **Lairs** (4, Halls and Ember Pits, at least 700 apart): a red ring while something sleeps there. Come within 380 and a named elite of the lair's type wakes (10x health + 80, 1.3x damage); it goes home if you get more than 700 from its lair. Dying to it is a prize recruit (+0.5 quality) that keeps its name. The bot lets sleeping lairs lie.
  - **Shrines** (4, Bone Fields and Halls): a cyan ring when ready. Step in for a power-up; then it rests 60s.
  - **Vaults** (2-3 ruined rooms): gold-edged floor. At 1:00 a chest appears in the middle; come within 190 and walkers burst in round it (4, plus one per 45s, up to 10). Open from the start, vaults killed bots at 0:30.
  - **Boss mark**: at 4:30 a blinking red mark on the map and minimap ("Your nemesis rises soon"): the Crypt if you are over 700 from it, otherwise open ground 900 away. The boss rises there at 5:00 and comes to you.
- **Minimap fog** (Phase 24 step 5): the world is dark on the minimap until the camera has been there (200-unit cells, `explore`/`seenAt` in `src/sim.js`). Lairs, shrines, chests and enemies show only where you have been; the boss mark always shows.
- Boss health also grows 4.5% per player level (was 2%, then 3%): vault chests and wider builds (Phase 27) push levels high.
- **Gems left behind:** a gem more than 900 from you flies to you. Without it parties levelled to 14 instead of 21 and the middle tiers died at about 2:15.
- **No walking away.** New enemies spawn on an oval just off camera (530 wide, 350 tall, plus up to 70), half of them ahead of you while you move. An enemy left more than 1100 behind is moved back in ahead of you. The boss moves 1.45x beyond 250 and 1.7x beyond 450, so open ground never lets you circle it. Base swarm 1.3x (was 1.14x in the old box, where the walls pushed spawns close). Without these the bot lived the full 15:00 with no party.
- Rocks block the player, walking enemies, allies and enemy bullets, so they are cover from Archers and the boss's rings. Your side's shots pass over them.
- Bats and Wisps fly over rocks (`fly: true` in the enemy table). The boss ignores them.
- A minimap in the bottom-left shows rocks, enemies (red), elites and chests (gold), allies (green), the boss and the camera view.

## Enemy tells and counter-play (Phase 5)
Each enemy shows what it is about to do, and has an answer:
- **Brute**: plants its feet for 0.7s with a red lane, then charges straight. Dodge sideways; a Brute that hits a rock stuns itself for 1.5s.
- **Archer**: shows a yellow aim line for 0.5s, then fires along it. Step off the line or put a rock between you.
- **Bat**: circles you, flashes a red ring, then dives in a straight line.
- **Bomber**: lights its fuse when close (the blast circle shows), slows, and explodes 0.6s later. Run out of the circle.
- **Slime** splits; **Wisp** blinks (unchanged).

## The boss
A giant of the type that has killed you most. It moves at 150 or more (you move at 200), so you cannot just walk away. It summons its kind every 5s, fires a ring of 18 shots every 3.5s, and between rings fires aimed bursts of 3 every 1.3s. Its shots do 22. Regular enemies keep spawning during the fight at 80% of the normal rate. Every 5s it winds up for 0.85s with a tell and uses its type's move:
- Brute and Bat: a long charge, ending in a shockwave ring. Slime: leaps onto where you stood and scatters small slimes. Archer: a wide fan of arrows. Bomber: a huge blast around itself. Wisp: blinks beside you and fires two offset rings.
- **Enrage** below half health: 25% faster, specials every 3.2s, rings of 26, aimed bursts of 5 every 0.8s.
- Health is 14000 x (1 + 1.3 x the square root of total party quality) x (1 + 0.02 x your level), so a stronger party and build face a tougher nemesis, but less than they gain (was 1 + 0.6 x quality: three champions faced 6x health and veterans never won). (0.05 per level was tried: a 139,000-health boss and a fight of over two minutes that champions lost.)

## Elites, chests and upgrades (Phase 5)
- Once a minute an **elite** arrives (gold ring, 8x health). It drops a **chest**: a level-up choice whose pick is applied twice.
- Six new upgrades: Orbiting Blade, Chain Shot, Nova, Lucky Shot, and for nemeses Blood Bond and Iron Guard. A choice never offers more than one nemesis upgrade.

## Level-up rarities (Phase 14)
Every level-up still offers three cards, but each card has a rarity (`RARITY` in `src/data.js`), rolled per card:

| Rarity | Chance | Strength |
|---|---|---|
| Common | 64% | 0.65x |
| Rare | 25% | 1.05x |
| Epic | 9% | 1.6x |
| Legendary | 2% | 2.5x |

- Strength scales the upgrade (`f(g, s)`, text from `d(s)`): Sharper is +20% damage as a Common and +75% as a Legendary. Upgrades that add a whole thing (projectile, blade, pierce, chain) add 1, 1, 2 or 3.
- The pool is 31 upgrades: the original 17, nine added for variety (Plating, Scholar, Focus, Frostbite, Wildfire, Executioner, Evasion, Soul Harvest, Leech), and five **Legendary-only** powers offered at most once per run (Thunderstorm, Phoenix, Midas Touch, Titan, Twin Soul). A Legendary roll is one of those 70% of the time while any are left.
- Chests never roll Common (Rare 50%, Epic 38%, Legendary 12%). The Shrine's Fortune raises Rare-and-better odds 12% a rank.
- The best rarity on offer colours the level-up beam, sets how big the moment is, and picks the sound when the cards land.
- The base swarm was raised 14% to offset the stronger upgrades.

## Feel and reward loops (Phase 14)
Built on a few well-established findings about why games are satisfying; each is used to reward playing, none to punish stopping.
- **Immediate feedback (game feel).** Enemies pop in, squash when hit, and die with a white flash and a spark; gems sparkle when collected; a dash leaves afterimages; the health bar shows what you just lost as a white chunk that drains; bars ease instead of jumping; numbers bump when they change.
- **Escalation and variable reward.** Kill streaks (lapse after 2.5s) grow on the HUD and call out at 10/25/50/100/150/200/300 with bonus souls; about 1 spawn in 30 is a golden enemy that pays out; rarities and chests vary each level-up.
- **Goal gradient: effort rises near a goal.** The experience bar pulses in its last 15%; the title screen shows the nearest unlock with a bar; the end screen says "so close" when a goal is over halfway.
- **Short goals always open.** Three missions at a time (`MISSIONS` in `src/data.js`), each paying 20-35 souls, replaced as they finish.
- **End on a gain (peak-end).** Dying still shows souls counting up, mastery, missions and anything unlocked, with confetti for records and unlocks.
- **A reason to come back, without a penalty for not.** The first run of each UTC day pays a bonus (20 souls, +15% per consecutive day up to a week). Missing a day only resets the bonus to its base.
- **Sharing.** "Copy result" puts a one-line summary on the clipboard; the daily run is the same for everyone, so results compare.
- Deliberately left out: timers that lock play, lives or energy, fake scarcity, and anything that takes away what you earned.

## The hook, built (Phases 17-19)
- **Recruits inherit your build** (Phase 17): perks for the newer upgrades, a trait from your weapon, and any Legendary powers you held (`LEG_TRAIT`). Death opens on the recruitment scene; souls and missions come second.
- **Choosing your killer** (Phase 18): a four-step rank bar under the clock shows the rank a recruit would have now. Below 35% health a panel names the nearest enemy and whether it would join, replace your weakest nemesis of that kind, or be too weak. Dying to an elite adds half a rank (+0.5 quality), to a golden enemy +0.35; a golden nemesis in the party adds 15% souls.
- **A nemesis with a grudge** (Phase 19): the boss (whatever killed you most) gets a name, shows how often it has killed you, and carries up to two Legendary powers you held when you died, newest first. Its versions: Thunderstorm marks where you stand and strikes 0.9s later (24 damage, radius 46); Phoenix rises once at 40%; Titan +35% health; Twin Soul doubles its summons; Midas makes a quarter of its summons golden. Beating it wipes what it learned. Not yet measured by the bot (balance runs pass no grudge).
- **Hook missions**: fall to an elite or golden enemy, recruit a Veteran or better, your nemeses kill N in one run, slay your nemesis.

## Level-ups (Phases 20-22)
- **Ranks and slots.** Each upgrade goes to rank 5 (`MAX_RANK`). A run holds six different upgrades (`UP_SLOTS`); Legendaries don't count. With all six filled, only those are offered; when every one is maxed or banished, fillers (Hearty Meal, Soul Purse, Spark) fill the cards.
- **Weights.** Held upgrades x2.2, upgrades your weapon reads differently x1.5. Banish (1 a run, +1 per Shrine rank of Cast Out) removes a card for the run and deals a new one in its place. Four level-ups in a row with nothing Rare or better make one card Rare.
- **Evolutions** (`WEAPON_EVOS`): Blaster + Trigger Happy = Gatling; Greatsword + Thick Skin = Kingsblade (heals 1 per enemy cut, up to 6 a swing); Boomerang + Swift = Moonblade; Flamewalker + Regrowth = Hellfire Trail; Storm Rod + Lucky Shot = Tempest; Totem + Magnet = Watchtower. Needs the partner at rank 5; the next chest after 3:00 offers it as a Legendary card.
- **Pairs** (`PAIRS`): Frostbite + Wildfire = Steam (+40% damage to slowed, burning enemies); Leech + Regrowth = Bloodthirst; Lucky Shot + Executioner = Killing Edge; Thick Skin + Plating = Juggernaut; Rally + Pack Tactics = Warband; Scholar + Focus = Arcane Engine.
- **Pace.** Experience needed starts at 5 and grows x1.22 (+3) a level, but never by more than 26 (`XP_START`, `XP_STEP`), so level-ups no longer dry up after 3:00. A linear curve (12, +14) cut early levels and cost most classes 30-40 seconds; a cap of +18 made Knight 7:42 and Ranger 5:56.
- **Solo by class after Phases 20-22, retuned** (10 seeds, the balance bot's picks): Knight 3:28, Ranger 3:44, Necromancer 2:56, Berserker 3:56, Engineer 2:22, Warden 3:14 (before the retune: Ranger 5:45, Warden 5:40, Necromancer 1:59, Engineer 1:39). Changes: Ranger +10% speed, power shot every 7th attack, no attack-speed bonus (its speed is a cliff: +8% gave 1:46, +10% gave 4:11); Warden regen 0.1, ultimate heals 6%; Necromancer raises every 9th kill, up to 6, bone blast 65% of your damage; Engineer flies two Drones that hit for at least 80% of your damage and shock away what crowds you every 3s (radius 90, 0.6s stun); Steam +20% (was 40%), Killing Edge makes Executioner count half again (was double plus crit). Lesson: the Engineer's weakness was defence, not damage or power-ups.
- **The Knight** always fights with the Greatsword (`CLASSES.knight.weapon`). Solo with the sword: 2:59, as before.

## Progression (Phase 13)
What carries over between runs, and why there is always something to work toward:
- **Souls.** Every run pays souls, win or lose: 0.12 per kill + 0.2 per second + 4 per chest + 15 for reaching the boss + 60 for a win, then +25% per Nemesis+ tier and +10% per rank of Greed (`soulsFor` in `src/save.js`).
- **The Shrine** (`META` in `src/data.js`; key U): eight permanent upgrades bought with souls. Vitality +8 health, Might +5% damage, Quickness +4% attack speed, Swiftness +3% move speed, Wisdom +8% experience, Greed +10% souls, Kinship +8% nemesis and minion strength (five ranks each, 30-380 souls a rank), and Second Thoughts: +1 reroll of your level-up choices per run (three ranks, 80/200/400).
- **Locked classes.** Three of the six classes are locked: Berserker (kill 1,000 enemies in total), Engineer (open 8 chests in total), Warden (slay your nemesis once). The class screen shows progress toward each.
- **Class mastery.** Time survived as a class (plus 120s for a win) raises its mastery, levels 1-5 at 240/720/1500/3000 seconds. Each level makes that class's minion 15% stronger and you 2% stronger.
- **Nemesis+ ladder.** Five tiers instead of on/off. Each tier: +14% swarm, +10% enemy health, +6% enemy damage, +25% souls. Winning at your highest tier unlocks the next. (Old saves: a win opens tier 1, an old Nemesis+ win opens tier 2.)
- **Completion %** on the title screen: classes, gear, feats, Shrine ranks and tiers.
- Already there from earlier phases: nemeses that rank up and evolve, gear found and kept, feats and boons, the daily run.
- Save version 9. The balance table runs with no Shrine ranks, mastery or tier.
- **Save slots.** Three independent saves (`SLOTS` in `src/save.js`), reached from the SAVE button on the hub: switch, start fresh, or delete. Slot 1 is the original storage key, so older saves load as slot 1.

## Class ultimates and signature passives (Phase 15)
Classes were passive bonuses and felt flat, so each now has an **ultimate** and a passive you can see working.
- **Charge**: every kill fills the meter (an elite counts five). The first costs 38 kills, each later one 10 more, up to 98. Press E (or the ULT touch button) when it is full. No class, no meter.

| Class | Ultimate | Signature passive |
|---|---|---|
| Knight | **Bulwark** (5s): cannot be hurt; opens with a blast, then cuts and throws back everything within 80 | shield blocks one hit outright every 8s (an arc over your head shows it is ready) |
| Ranger | **Arrow Storm** (4s): an arrow lands on a random enemy within 500, 14 a second, 1.5x damage each | every fifth Blaster volley is a power shot: triple damage, passes through everything |
| Necromancer | **Army of the Dead**: ten Skeletons at once, for 14s | every 6th kill rises as a Skeleton (up to 8); a Skeleton that falls explodes for 1.6x damage within 64 |
| Berserker | **Blood Rage** (6s): double damage, double attack speed, +2 health per kill | (unchanged) up to +60% damage as health falls |
| Engineer | **Orbital Laser** (3.6s): a beam's foot circles you at 150, 2.2x damage ten times a second within 52 | (unchanged) more and longer power-ups |
| Warden | **Wrath of the Wild**: 2x damage to every enemy within 540, roots them 4s (not the boss), heals a third of your health | (unchanged) regeneration |

**Projectiles** each have their own animated sprite, turned to face their flight, with a short trail and a spark where they land: Blaster bolt, golden lance for Lucky Shots and power shots, lightning for Chain Shot and the Drone, crystal shard (Lodestone), fireball (Imp), arrows, pulsing orbs for other creatures, spiked turning orbs for the boss.

## Classes and minions (Phase 12)
You pick one of three classes on the title screen (`CLASSES` in `src/data.js`; saved as `cls`, default Knight). A class is a passive bonus plus a starter minion with its own ability; weapon, ability and charm stay a free choice. Minions are not nemeses: no rank, no perks, and they return 8s after they fall.

| Class | Bonus | Minion |
|---|---|---|
| Knight | +30 health; 15% less damage taken | **Squire**: stays within 120 of you; his shield destroys enemy shots within 30; every 4s bashes the nearest enemy in reach (2.5x damage, knockback, 1.4s stun) |
| Ranger | +10% move speed; +8% attack speed | **Hawk**: cannot be targeted; dives at the toughest enemy within 520 every 2.6s and marks it for 5s; marked enemies take 20% more damage |
| Necromancer | every 12th kill rises as a **Skeleton** for 15s (up to 5) | **Imp**: ranged; its fireballs set enemies burning for 3s (45% of the hit, twice a second) |
| Berserker (locked) | up to +60% damage as your health falls | **Wolf**: fast melee; every 9s its howl gives you a 2.5s frenzy (attacks twice as fast) |
| Engineer (locked) | power-ups drop 2.4x as often; Frenzy and Giant last 50% longer | **Drone**: cannot be targeted; circles you and shoots the nearest enemy |
| Warden (locked) | regenerate 0.5 health a second | **Golem**: stays within 130 of you; every 6s slams the ground, stunning everything within 95 for 1s, and for 2.5s walkers nearby go for it instead of you |

Solo survival by class (`node tests/balance.js --classes`, 10 seeds, Blaster + Dash): no class 1:44, Knight 2:16, Ranger 2:40, Necromancer 2:08, Berserker 2:08, Engineer 2:28, Warden 2:08. A minion that roams into the swarm and kills freely breaks the game (a roaming Golem gave 5:20 even with 5 damage; kept beside the player with a stun-only slam it is 2:08), so keep tanky minions leashed. The main balance table is run with no class, so real runs are about 25-50% longer than its solo row. The Ranger was 5:15 before the Hawk was toned down and is still the strongest. After trimming Berserker and Warden healing: Berserker 3:35, Warden 3:12.

**Level-up moment.** Levelling up (or opening a chest) freezes the game for 0.75s: a beam of light on the player, two rings, a shower of sparks and LEVEL UP! in large text; then the cards are dealt (they drop in edge-on and flip open). The chosen card flashes and the others fall away before play resumes, and a banner names what you took.

## Weapons, abilities and gear (Phase 8)
You equip one **weapon** and one **ability** on the loadout screen (`WEAPONS`, `ABILITIES` in `src/data.js`; rules in `fireWeapon` and `useAbility` in `src/sim.js`).

| Weapon | How it attacks | Split Shot | Piercing |
|---|---|---|---|
| Blaster | Auto-aimed shots | +1 shot | pass through +1 |
| Greatsword | Sweeps a 143-degree arc (reach 96) at the nearest enemy; 2.1x damage and knockback | sweep behind too, then all around | longer reach |
| Boomerang | Flies out 0.55s and returns, 1.35x damage each way; catching it cuts the wait | +1 boomerang | larger blade |
| Flamewalker | Leaves fire where you walk (2.2s); 0.62x damage per tick | wider trail | fire lasts longer |
| Storm Rod | Instant bolt, 1.5x damage, arcs to 2 more at 70% each | +2 arcs | arcs jump further |
| Totem | Drops a totem every 3.8s (2 at once) that shoots like a Blaster | +1 totem | totems last longer |

Lucky Shot works with every weapon. Chain Shot works with all but Flamewalker (it is not offered there).

| Ability (Space / touch button) | Cooldown | Effect |
|---|---|---|
| Dash | 4s | 0.18s burst along your facing; cannot be hit; 2x damage to what you pass through |
| Shockwave | 10s | 1.5x damage, big knockback and 1.2s stun within 170; clears enemy shots |
| Time Slow | 18s | enemies and their shots at 30% speed for 3s |
| Decoy | 20s | enemies within 260 chase it for 2.5s, then it explodes (1.5x damage within 90) |
| Rally | 20s | nemeses jump to you, heal 40%, attack 50% faster for 5s |

**Found and kept.** New saves own Blaster and Dash. The boss always drops one piece of gear you do not own; an elite's chest holds gear instead of an upgrade 30% of the time. Gear found is kept even if you die (`addGear` in `src/save.js`, save version 6). The sim only drops gear when it is told what you own, so tests and the balance bot are unaffected.

Solo survival by weapon (`node tests/balance.js --weapons`, 10 seeds, with Dash): Blaster 1:48, Greatsword 1:44, Boomerang 1:45, Flamewalker 1:53, Storm Rod 1:44, Totem 1:48. By ability (with Blaster): Dash 1:48, Shockwave 2:02, Time Slow 1:43, Decoy 2:25, Rally 2:02 (no party to rally).

## Power-ups and charms (Phase 9)
**Power-ups** lie on the ground for 12s (they blink for the last 3); walk over one to use it. Every elite drops one; any other enemy has a 0.5% chance, but not while the boss is alive (`POWERUPS` in `src/data.js`, `usePowerup` in `src/sim.js`).
- **Frenzy**: every weapon timer runs twice as fast for 8s. **Bubble**: absorbs the next 3 hits. **Freeze**: every enemy but the boss frozen 2s. **Bomb**: 4x damage + 20 to everything within 600 and clears enemy shots. **Vortex**: every gem flies to you. **Giant** (only drops if you have a party): nemeses grow, heal half, hit 50% harder for 6s.

**Charms** are the third, optional loadout slot, found and kept like other gear (`CHARMS` in `src/data.js`):
- Thorn Mail (an enemy that hits you takes 2.5x damage and is thrown back), Ember Heart (0.5x damage every 0.4s within 72), Lodestone (each gem fires a 0.6x shard), Vampire Fang (heal 5 per 25 kills), Hourglass (once per run, death rewinds to 30% health with a shockwave), Afterimage (being hit leaves a 1.5s decoy, at most every 6s), Pack Banner (nemeses return twice as fast), Lucky Coin (elites every 30s instead of 60s).
- Charms are not in the balance table.

## Reasons to return (Phase 6)
- **Nemesis+**: unlocked by a first win, toggled on the title screen. Swarm x1.35, enemy health x1.25, enemy damage x1.15. Keeps its own best time and win count.
- **Daily run**: one seed per UTC day (the date as a number), so the map and spawns are the same for everyone. You bring your own party. One best time per day; a quit run does not count.
- **Feats**: 13 one-time goals (`FEATS` in `src/data.js`). Each unlocks a **boon**: an upgrade you can choose on the title screen to start every run with. One boon at a time.
- **Nemesis history**: roster cards show each nemesis's runs, kills and wins.
- Saved in save version 5 (`src/save.js`); older saves load with these fields empty.

## Difficulty targets
Tuned by simulation against a bot that plays like a skilled person (`smart` in `tests/bot.js`): it dodges, avoids walls and collects gems.
- Alone: die around 1:30–2:00, first hit before 0:30.
- Each party tier lasts clearly longer than the one below.
- A top party reaches the boss most runs and wins about half.
- Even weak recruits matter: 3 runts last at least 20s longer than solo, 3 soldiers at least 40s.

## Balance (20 seeds, `node tests/balance.js --seeds 20`)
| Party | Median survival | Reached boss | Wins | First hit |
|---|---|---|---|---|
| None | 1:54 | 1/20 | 0 | 0:21 |
| 3 runts (bat, slime, bat) | 2:26 | 3/20 | 2 | 1:30 |
| 3 soldiers (bat, slime, bat) | 5:38 | 10/20 | 4 | 1:41 |
| 3 veterans with perks (brute, archer, wisp) | 3:38 | 9/20 | 7 | 1:55 |
| 3 champions with perks (brute, archer, bomber) | 6:16 | 17/20 | 11 | 3:59 |

Phase 23. Boss health and swarm now scale by the square root of party quality (before: veterans 0 wins, champions 4 of 10). Ally jobs grow with rank (`jobK` in `src/sim.js`: 0.6 + 0.4 x quality, so runt 0.76, champion 1.72): Bat gem reach, Slime pull radius, Archer slow time, Brute knockback and stun, Wisp shot-burning radius. Before jobs scaled, veterans reached the boss 6 of 20 and won 5. Options: `--seeds N`, `--cls`, `--grudge storm,phoenix`, `--mix` (creatures swapped between ranks).

Known gaps (Phase 23): wins now rise with every tier (2, 4, 7, 11 of 20) and runts add 32s over solo. Survival is bimodal (ranges 1:20-12:00), so medians jump; read boss and wins first. Open: bat/slime/bat at rank 1.7 does worse than at rank 1 (2:30, 5 boss against 5:38, 10 boss); at 2:00 both are level 13 with the same health, so the gap opens later. Not yet run with a class or grudge powers.

**Open world (Phase 24 step 1, 20 seeds):** none 4:26 (6 boss, 0 wins); runts 3:31 (6, 2); soldiers 3:30 (6, 2); veterans 2:57 (4, 2); champions 6:18 (15, 9). Champions are on target, but solo now outlasts small parties (on time, not wins), and soldiers and veterans are harder than in the old box. Left untuned on purpose: walls and the flow field (step 2) will move it all again. Re-tune after step 2.

**With walls and the gem pull (Phase 24 step 2, 20 seeds):**

| Party | Median survival | Reached boss | Wins | Level |
|---|---|---|---|---|
| None | 2:12 | 3/20 | 3 | 14 |
| 3 runts | 2:28 | 5/20 | 5 | 20 |
| 3 soldiers | 3:09 | 7/20 | 4 | 21 |
| 3 veterans with perks | 6:45 | 13/20 | 7 | 29 |
| 3 champions with perks | 5:54 | 14/20 | 11 | 29 |

Reaching the boss now rises with every tier. A solo run that reaches the boss wins it (boss health grows only with the party), which may be too generous. Levels near 29 are higher than the old 21; watch the XP curve.

**With biomes, water and lava (Phase 24 step 3, 20 seeds):** none 2:34 (6 boss, 3 wins); runts 3:01 (8, 5); soldiers 3:25 (6, 4); veterans 6:11 (13, 8); champions 6:00 (12, 11). About where step 2 left it; solo slightly more generous, since pools only help you.

**With landmarks (Phase 24 step 4, 20 seeds):**

| Party | Median survival | Reached boss | Wins | Level |
|---|---|---|---|---|
| None | 2:32 | 3/20 | 3 | 15 |
| 3 runts | 2:11 | 3/20 | 2 | 17 |
| 3 soldiers | 3:37 | 9/20 | 7 | 24 |
| 3 veterans with perks | 6:07 | 12/20 | 5 | 27 |
| 3 champions with perks | 7:09 | 16/20 | 12 | 33 |

Reaching the boss rises with every tier; champions win 60%. Runts no longer beat solo on time. The bot never wakes a lair on purpose, so lair fights are not in these numbers.

## First runs (Phase 25)
New players meet the game a piece at a time (`UNLOCK` in `src/ui.js`, counted in runs played):
- **Run 1:** the hub is the scene, your hero and PLAY, with one tab (Home). No souls counter, no daily, no banish, no pair or evolution hints on cards.
- **After 1 run:** Hero and Roster appear: you have a recruit now, and the roster is where the hook lives.
- **After 2 runs:** Shrine and Missions.
- **After 3 runs:** Feats, the daily run, Banish, and the PAIRS WITH / COMPLETES / EVOLVES tags on cards.
- Nemesis+ already waits for a first win; the charm column waits until you own a charm.
- A tab that has just appeared carries a NEW badge until you open it (`save.seen.tabs`). Saves that had played before see nothing new except those badges never appearing.
The systems themselves still run from the start (pairs switch on, evolutions are offered); only what is shown waits.

