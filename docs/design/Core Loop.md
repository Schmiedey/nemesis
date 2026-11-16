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
- A stronger party draws a slightly bigger swarm (+4.5% spawns per point of total quality).

## Nemesis jobs, growth and evolutions (Phase 4)
Every nemesis has a job that works at any rank, so even a Runt changes a run (`JOB` in `src/data.js`, rules in `src/sim.js`):
- **Bat**: fetches gems; any gem a bat passes flies to you, and idle bats go looking for gems.
- **Slime**: draws walking enemies within 150 units onto itself and takes 40% less damage.
- **Archer**: its shots slow enemies to 55% speed for 2s.
- **Brute**: each hit knocks the enemy back and stuns it for 0.6s.
- **Bomber**: blows itself up, then returns in 3s without losing a life (being killed still costs one).
- **Wisp**: burns up enemy shots that come near it (not the boss's).

Ally strength: health x(2.6 + 1.3q), damage x(0.7 + 1.3q), where q is quality. The floor is what keeps Runts alive long enough to matter.

**Growth.** A nemesis is credited with its own kills. After each run it gains quality: 0.006 per kill (at most 0.3 a run), plus 0.25 for a win (`growParty` in `src/save.js`). Its lifetime kills, runs and wins are saved.

**Evolutions.** At Champion (q of 2 or more) a nemesis picks one of two evolutions on the roster screen, once and for good (`EVOS` in `src/data.js`): Bat Brood/Vampire, Slime Mother/Bulwark, Archer Volley/Frost, Brute Quake/Juggernaut, Bomber Cluster/Short Fuse, Wisp Storm/Ward.

## Maps
- Three fixed layouts, one picked per run from the seed (`LAYOUTS` in `src/sim.js`): **Pillars** (four pillars round the centre, clusters in corners), **Corridors** (two broken walls), **Ring** (a ring of rocks with four gaps).
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
A giant of the type that has killed you most. It moves at 150 or more (you move at 200), so you cannot just walk away. It summons its kind every 5s, fires a ring of 16 shots every 3.5s, and between rings fires aimed bursts of 3 every 1.6s. Regular enemies keep spawning during the fight at 80% of the normal rate. Every 5s it winds up for 0.85s with a tell and uses its type's move:
- Brute and Bat: a long charge, ending in a shockwave ring. Slime: leaps onto where you stood and scatters small slimes. Archer: a wide fan of arrows. Bomber: a huge blast around itself. Wisp: blinks beside you and fires two offset rings.
- **Enrage** below half health: 25% faster, specials every 3.2s, rings of 22, aimed bursts of 5 every 1.1s.
- Health is 11500 x (1 + 0.6 x total party quality), so a stronger party faces a tougher nemesis.

## Elites, chests and upgrades (Phase 5)
- Once a minute an **elite** arrives (gold ring, 8x health). It drops a **chest**: a level-up choice whose pick is applied twice.
- Six new upgrades: Orbiting Blade, Chain Shot, Nova, Lucky Shot, and for nemeses Blood Bond and Iron Guard. A choice never offers more than one nemesis upgrade.

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

## Balance (10 seeds, `node tests/balance.js`)
| Party | Median survival | Reached boss | Wins | First hit |
|---|---|---|---|---|
| None | 1:48 | 3/10 | 1 | 0:29 |
| 3 runts | 2:32 | 1/10 | 1 | 1:17 |
| 3 soldiers | 2:18 | 3/10 | 1 | 1:16 |
| 3 veterans with perks | 6:25 | 6/10 | 3 | 0:56 |
| 3 champions with perks | 5:50 | 10/10 | 8 | 3:17 |

Known gaps (table uses Blaster + Dash, and the bot presses the ability when crowded): a champion party wins 8 of 10 again now that Dash exists (target about half); more boss health did not help (tried 0.85 scaling: 9 of 10), so the boss needs attacks Dash cannot simply skip. Decoy is the strongest ability (2:25 solo vs 1:48). Small number changes swing weapons wildly (Totem went 1:23 to 5:05 to 1:48), so re-run `--weapons` after any weapon change. Runts and soldiers are not separated. Evolutions, Nemesis+ and boons are not in the table.
