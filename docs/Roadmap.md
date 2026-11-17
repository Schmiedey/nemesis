# Roadmap

One phase per session. Each ends with a commit and an updated status line here.

**Status:** Phases 1-23 on main. Public repo: https://github.com/Schmiedey/nemesis. Phase 24 (a real map) steps 1-4 done: seeded world, ruins with flow-field pathing, three biomes, landmarks (lairs with named elites, shrines, vaults that open at 1:00, the boss mark). Landmarks not yet looked at in the browser. Next: step 5, minimap fog. Music on hold (`MUSIC_ON` in `src/audio.js`).

## Phase 1: Make it a real game
- [x] git, Vite, code split into modules, fixed arena, safe saves, simulated test runs
- [x] Earned recruits, draft 3 allies, limited ally respawns
- [x] Boss at ~5:00 and a win screen; killer inherits your build
- [ ] Not done: per-type ally evolutions, distinct counter-play per enemy, visible "RECRUITED" moment (stamp on the death screen added in Phase 2)
- Done when: dying early on purpose is a bad strategy and you want to replay.

## Phase 2: Make it look and sound good
- [x] Blender script that renders a creature to a sprite sheet (`art/make_sprites.py`), proven on the Bat
- [x] Slime, Archer, Brute, Bomber, Wisp, player; boss = giant sprite of its type with a red aura
- [x] Menus, roster screen, death screen, logo
- [x] Sound effects made in code
- [ ] Soundtrack: on hold, switched off (two attempts rejected)
- Done when: no placeholder shapes or silent actions remain.

## Phase 3: Ship it
- [x] Map: fixed rocks and pillars, floor art, minimap
- [x] Touch controls: drag-anywhere stick, pause button, phone-size menus, rotate hint in portrait
- [x] Performance: measured 0.8 ms of work per frame with 268 enemies on a Mac, sim step 0.13 ms; pixel ratio capped at 2, particles capped at 500
- [x] Final name: NEMESIS
- [ ] itch.io upload, 10-second clip
- [ ] Steam only if the web version gets traction ($100)
- Done when: a stranger can play it from a link.

## Phase 4: Recruits that matter
- [x] A job for each ally type that works at any rank
- [x] Allies earn XP across runs, rank up, and evolve at Champion
- [x] Ally kills and growth shown on the death and win screens
- Done when: 3 runts last 20s longer than solo and 3 soldiers 40s longer, by `node tests/balance.js`.

## Phase 5: Variety per run
- [x] Counter-play and a visible tell per enemy (Brute charge, Archer aim line, Bat dive, Bomber fuse)
- [x] A real boss per type with a second stage at half health
- [x] About 6 new upgrades; elites that drop a chest; three map layouts
- Done when: two runs in a row feel different.

## Phase 6: Depth, feel, and reasons to return
- [x] Depth in 2D: shadows, light pool, sprites re-rendered tilted in 8 directions, drawn larger
- [x] Feel: tinted hit flash, damage numbers, hit-stop, restyled level-up screen
- [x] Nemesis+ mode, daily run, feats that unlock starting perks, nemesis history on roster cards
- Done when: it looks finished and there is always a next thing to chase.

## Phase 7: Performance
- [x] Canvas at a fixed resolution scaled by CSS; baked light and shadow; adaptive quality; no slow motion; frame counter
- Done when: the frame counter (backquote key) shows a steady 60 fps on the user's machine in a full-screen window.

## Phase 8: Weapons and active abilities
- [x] Six weapons (Blaster, Greatsword, Boomerang, Flamewalker, Storm Rod, Totem)
- [x] Five abilities on a button (Dash, Shockwave, Time Slow, Decoy, Rally)
- [x] Gear is found and kept; loadout screen
- Done when: how you attack is a choice and every weapon is within about 20% of the Blaster in the balance table.

## Phase 9: Power-up pickups and charms
- [x] Six power-ups that drop in the arena
- [x] About 8 charms as a third loadout slot
- Done when: a run has moments of sudden power and the loadout has three meaningful choices.

## Phase 10: Pixel-art overhaul
- [x] One sprite sheet for creatures, bullets, items, effects and icons (`art/make_pixels.mjs`); Blender pipeline retired
- [x] World drawn at 480x300 with hard-edged scaling; HUD on a sharp layer in pixel fonts
- [x] Menus restyled as pixel game UI; sprite icons replace text symbols
- [x] Polish: four-frame creature cycles, faceted boulders, dithered tells with marching outlines, solid weapon effects, pixel touch controls
- Done when: nothing on screen is a plain shape or a default-looking web page.

## Phase 12: Classes, level-up feel, menu structure
- [x] Three classes (Knight, Ranger, Necromancer), each with a starter minion that has its own ability
- [x] Level-up moment: beam, rings, sparks, big text; cards flip in; the picked card flashes
- [x] Shooting sound reduced to a faint tick
- [x] Title screen as a side menu with a stage; class screen; other pages with a header row
- Done when: the user is happy with the menu structure and the feel of levelling up.

## Phase 13: Progression and replay value
- [x] Souls from every run; the Shrine with eight permanent upgrades; rerolls
- [x] Three locked classes (Berserker, Engineer, Warden) with minions and unlock goals
- [x] Class mastery levels; five-tier Nemesis+ ladder; completion %
- Done when: there is always a next unlock in reach and a reason to replay each class.

## Phase 14: Rarities, feel and reward loops
- [x] Level-up cards in four rarities; 31 upgrades including five Legendary-only powers
- [x] Kill streaks with callouts, golden enemies, death pops, squash on hit, eased HUD bars, low-health frame
- [x] Missions, daily bonus and day streak, next-unlock goal, "so close" line, copy result, confetti and count-ups
- Done when: levelling up and ending a run both feel like a payoff, and there is always a short goal in reach.

## Phase 15: Class ultimates and projectile art
- [x] An ultimate per class, charged by kills (E); signature passives for Knight, Ranger and Necromancer
- [x] Animated projectile sprites with trails and impact sparks
- [x] Nemeses never leave for good, hit harder, and show health and kills on the HUD
- Done when: every class has something to look forward to in a run, not just a stat bonus.

## Phase 16: Menu as a hero hub
- [x] Front page: hero, minion and party in a dungeon scene, one PLAY button, almost no text
- [x] Bottom tab bar on every menu page (Home, Hero, Roster, Shrine, Missions, Feats) with badges for things to claim or buy
- [x] Missions, daily bonus and records moved to their own tab; loadout and boon reached from the Hero tab
- Done when: the user is happy with the menu.

## The hook, restated (read this before adding features)
**Whatever kills you, joins you.** Dying is how you build your army: last longer and the recruit is stronger, and it arrives carrying what you died holding. Phases 11-16 added classes, minions, the Shrine, missions, rarities and gear, and the hook got buried: death became a receipt, recruits stopped inheriting most of your build, and nothing told you who would join. Phases 17-19 put it back in the centre. Anything new should make dying to something more interesting, not compete with it.

## Phase 17: The recruit is the reward
- [x] Recruits inherit your whole build: the newer upgrades, Legendary powers, and a trait from your weapon
- [x] Death is a recruitment scene first; souls, missions and the rest come after
- Done when: the first thing you feel on dying is who you just gained and what it took from you.

## Phase 18: Choosing your killer
- [x] At low health the HUD shows who would join if you fell now, and whom it would replace
- [x] Elites and golden enemies are prize recruits
- Done when: going down to a particular enemy is a decision you make on purpose.

## Phase 19: A nemesis with a grudge
- [x] The boss has a name, remembers how often it has killed you, and returns with powers you used
- [x] Missions that point at the hook
- Done when: the boss feels like the thing that has been killing you, not a big enemy.

## Phase 20: Builds you steer
- [x] Upgrade ranks up to 5, six upgrade slots; once full only your own upgrades are offered
- [x] Offers weighted toward what you hold and what suits your weapon; banish (Shrine: Cast Out); pity Rare after 4 dry level-ups
- [x] Cards show rank pips and before -> after numbers
- Done when: by 3:00 a run has a clear build you chose.

## Phase 21: Evolutions and pairs
- [x] Each weapon evolves with a partner upgrade at rank 5, offered by the next chest after 3:00
- [x] Six upgrade pairs that switch on a bonus; cards say PAIRS WITH / COMPLETES
- [x] Loadout shows each weapon's recipe
- Done when: players chase a recipe on purpose.

## Phase 22: Pace and feel
- [x] XP curve tuned with the bot (capped growth; see Core Loop)
- [x] Retune classes after the level-up changes (all six now 2:22-3:56 solo)
- [x] Several levels at once: "+N MORE" and a shorter pause between picks
- [x] Cards tagged WEAPON / PASSIVE / PARTY; deeper frame from rank 3
- [x] Build summary on the death screen, lighting what the recruit took
- Done when: level-ups keep coming at a steady beat to the boss.

## Phase 23: The hook pays
- [x] Re-measure the party table after Phases 20-22; `--cls`, `--grudge` and `--mix` options in the balance script
- [x] Boss health and swarm scale less with party quality (square root), so better recruits pay off
- [x] Each tier wins more than the one below (2, 4, 7, 11 of 20); ally jobs grow with rank (`jobK`)
- [x] Runts add at least 20s over solo (32s)
- [ ] Open: bat/slime/bat at rank 1.7 does worse than at rank 1
- Done when: a better recruit always makes the next run better.

## Phase 24: A real map (plan: `docs/design/Map.md`)
- [x] Bigger seeded world (4800x3000) with a rock grid; one baked floor canvas was fast enough (60 fps); spawns ahead, stragglers recycled, boss catch-up
- [x] Re-tune the party table for the open world: gems left 900 behind fly to you
- [x] Rectangle walls (ruins: wall, corner, room with doorways) and a flow field for walkers; bot avoids walls; test that an enemy gets round a wall
- [x] Three biomes in rings round the Crypt; water slows and lava burns walking enemies (never you)
- [x] Landmarks: lairs (named elites you walk to; the recruit keeps the name), shrines, vaults (ambush, open at 1:00), the boss mark
- [ ] Minimap fog
- Done when: a run is a trip somewhere, and where you die is a choice.

## Usage rules
- New session per phase; start by reading only this file and `CLAUDE.md`.
- Logic before art. Art by script. Balance by simulation.
- No subagents or council re-runs unless asked.
