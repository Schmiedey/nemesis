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
- Boss has 11500 HP.

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

## Map
- One fixed arena (1600x1000), the same every run so it can be learned: 16 rocks and pillars (`ROCKS` in `src/sim.js`), four pillars around the centre, big rocks on each side, clusters in the corners.
- Rocks block the player, walking enemies, allies and enemy bullets, so they are cover from Archers and the boss's ring. Your side's shots pass over them (blocking those too dropped a champion party to 3 wins in 10).
- Bats and Wisps fly over rocks (`fly: true` in the enemy table). The boss ignores them.
- A minimap in the bottom-left shows rocks, enemies (red), allies (green), the boss and the camera view.

## Difficulty targets
Tuned by simulation against a bot that plays like a skilled person (`smart` in `tests/bot.js`): it dodges, avoids walls and collects gems.
- Alone: die around 1:30–2:00, first hit before 0:30.
- Each party tier lasts clearly longer than the one below.
- A top party reaches the boss most runs and wins about half.
- Even weak recruits matter: 3 runts last at least 20s longer than solo, 3 soldiers at least 40s.

## Balance (10 seeds, `node tests/balance.js`)
| Party | Median survival | Reached boss | Wins | First hit |
|---|---|---|---|---|
| None | 1:48 | 2/10 | 1 | 0:26 |
| 3 runts | 2:29 | 1/10 | 1 | 1:10 |
| 3 soldiers | 2:24 | 0/10 | 0 | 1:01 |
| 3 veterans with perks | 3:04 | 3/10 | 3 | 1:21 |
| 3 champions with perks | 5:11 | 10/10 | 9 | 2:26 |

Known gaps: runts and soldiers (same mix: bat, slime, bat) both beat solo by about 40s but are not separated from each other; a champion party now wins 9 of 10, which is too easy (target is about half) and is to be re-tuned with the boss rework in Phase 5; a champion party is not hit until about 2:26. Evolutions are not in the balance table.
