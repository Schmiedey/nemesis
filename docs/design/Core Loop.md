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
- Enemies start arriving within the first second; spawn gap shrinks from 0.85s to 0.34s.
- New enemy types at 0:10 (Slime), 0:25 (Archer), 0:45 (Brute), 1:10 (Bomber), 1:35 (Wisp).
- **Surge** every 20s: a wave closes in from one side (4 groups, +1 every 30s), with a red arc warning on that side.

## Balance (simulated, dodging bot, 8 seeds, `node tests/balance.js`)
A human plays better than the bot, so read these as relative, not absolute.

| Party | Median survival | Reached boss | Wins |
|---|---|---|---|
| None | 1:24 | 0/8 | 0 |
| 3 runts | 1:27 | 0/8 | 0 |
| 3 soldiers | 2:04 | 1/8 | 0 |
| 3 veterans with perks | 2:07 | 0/8 | 0 |
| 3 champions with perks | 3:34 | 1/8 | 1 |
