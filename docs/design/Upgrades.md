# Upgrade variety (Phase 26)

## Problem
Of the 26 regular level-up cards, about 20 are "+X% of a stat" (damage, attack speed, move speed, health, range, regen...). Picking one changes a number, not how you play. Nemeses never change during a run.

## Player: twelve cards that change how you play
Each has ranks like every card (picking it again makes it stronger). All work with every weapon unless marked.

| Card | What it does | Play it changes |
|---|---|---|
| Seeker Rounds | Your shots curve toward enemies (Blaster, Totem) | Spray and trust the shots |
| Corpse Blast | Kills can explode, hurting what is near | Fight in the thick of the swarm |
| Overkill | Damage past a kill carries into the nearest enemy | Big hits clear lines |
| Static Step | Every few steps, a spark arcs to the nearest enemy | Keep moving |
| Stand Fast | Stand still half a second: attack much faster | Plant your feet |
| Glass Cannon | Much more damage, less max health | A real trade-off |
| Adrenaline | Below half health: faster attacks and movement | Live dangerously |
| Momentum | Damage builds every second you go unhit; a hit resets it | Don't get touched |
| Minefield | Drop mines as you go; enemies set them off | Lead the swarm over them |
| Ability Surge | Using your ability also blasts everything near you | Use the button more |
| Mirror Ward | Every few seconds, a ward sends the next enemy shot back | Face the archers |
| Gravity Well | A vortex pulls a crowd together, then bursts | Crowd control |

## Nemeses: upgrades of their own, from their own kills
No extra pop-ups: a nemesis ranks up mid-run from **its own kills** (25, 60 and 120 kills), and picks a trait itself. A banner names it ("GRUOTH: FURY") and the party panel shows its traits as pips. Nothing pauses.

Traits: Fury (+25% attack speed), Giant (bigger, +40% health), Keen (+30% damage), Swift (+25% speed), Bloodthirst (heals 5% per kill), Volatile (its kills explode), Mending (heals 2% a second).

Traits last for the run. A nemesis's lasting growth stays as it is (kills turn into quality after the run).

## Build order
1. Data: twelve cards in `UP` (`src/data.js`), seven traits in `NEM_UPS`.
2. Rules in `src/sim.js`: each card's effect; nemesis ranks from kills.
3. Icons for all twelve cards (`art/make_pixels.mjs`), effects drawn in `src/render.js` (mines, wards, wells).
4. Tests for each card and for nemesis ranks; balance table; browser check.

## Built (Phase 26)
All of the above, with icons, tests (58 in all) and the balance bot taught to take the new cards. First tuning had nemesis ranks at 15/40/80 kills with stronger traits: runts reached the boss 11 of 20 and champions won 15, so ranks were made slower and gentler, and Corpse Blast trimmed (12% a rank, up to 60%).

| Party (20 seeds) | Median | Reached boss | Wins |
|---|---|---|---|
| None | 2:37 | 5 | 4 |
| 3 runts | 2:32 | 7 | 2 |
| 3 soldiers | 3:04 | 8 | 5 |
| 3 veterans | 6:22 | 12 | 7 |
| 3 champions | 6:28 | 18 | 12 |

## Phase 27: the same cards every time
Measured over 10 simulated 5-minute runs: the 6 slots filled by level-up 7-9, and from then on only held cards were offered, so 71% of level-ups were rank-ups of the same six. A run showed 16 of 43 cards; 27% of cards offered were new; the identical hand came up twice in a row 10 times.

Changes:
- **Every hand mixes**: one card you hold (to rank up), one you don't, one wild, shuffled. Cards in the last hand come up at about a third of the weight.
- **8 slots, 3 ranks** (was 6 and 5), each pick worth 1.15x its rarity (`RANK_K`, `cardS` in `src/data.js`). 1.6x let champions win 20 of 20; 1.3x still 19.
- **Sealing**: with every slot full, new cards still come. Taking one seals your lowest-rank card (`sealTarget`): it keeps its effect, stops ranking up, frees its slot, and is never offered again. The card says which it will seal. (A true swap would have to undo a card's effect, which most cards cannot.)
- Boss: base health 14,000 (was 11,500) and +4.5% per player level (was 3%): with wider builds, a solo player who reached the boss nearly always won.

After: 33 of 43 cards seen per run, 66% of offers new, no repeated hands, slots full at level-up 9-16.

| Party (20 seeds) | Median | Reached boss | Wins |
|---|---|---|---|
| None | 3:13 | 7 | 5 |
| 3 runts | 4:39 | 9 | 6 |
| 3 soldiers | 6:40 | 13 | 6 |
| 3 veterans | 6:55 | 15 | 9 |
| 3 champions | 6:08 | 20 | 14 |

Everything rises with tier; a little easier than Phase 26 overall (champions win 70%, target about half).

Next ideas, not built: fusions of two max-rank cards, gamble cards (a downside for a big upside), and cards you took last run coming up less in the next.

