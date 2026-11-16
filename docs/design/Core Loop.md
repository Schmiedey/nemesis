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
- Enemies are near the player's speed and get up to 30% faster over a run. Hits do 25% more than base.
- **Enemies hunt the player.** They only turn on a nemesis within 110 units, so allies help but do not hide you.
- **Surge** every 20s: a wave closes in from one side (3 groups, +1 every 50s), with a red arc warning.
- A stronger party draws a slightly bigger swarm (+3% spawns per point of total quality).
- Boss has 9000 HP.

## Difficulty targets
Tuned by simulation against a bot that plays like a skilled person (`smart` in `tests/bot.js`): it dodges, avoids walls and collects gems.
- Alone: die around 1:30–2:00, first hit before 0:30.
- Each party tier lasts clearly longer than the one below.
- A top party reaches the boss most runs and wins about half.

## Balance (10 seeds, `node tests/balance.js`)
| Party | Median survival | Reached boss | Wins | First hit |
|---|---|---|---|---|
| None | 1:45 | 1/10 | 1 | 0:26 |
| 3 runts | 2:16 | 1/10 | 0 | 0:25 |
| 3 soldiers | 2:36 | 1/10 | 1 | 1:01 |
| 3 veterans with perks | 3:05 | 3/10 | 3 | 1:21 |
| 3 champions with perks | 5:27 | 8/10 | 6 | 2:14 |

Known gap: a champion party is not hit until about 2:14, so its opening is still safe.
