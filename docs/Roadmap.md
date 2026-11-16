# Roadmap

One phase per session. Each ends with a commit and an updated status line here.

**Status:** Phases 1-7 merged to main. Phase 8 built on branch `phase-8-weapons`, not merged: six weapons, five abilities (Space or touch button), gear found and kept, loadout screen. Next: user plays it, merge, Phase 9 (power-ups and charms). Music on hold (`MUSIC_ON` in `src/audio.js`; do not work on it until asked). Still the user's to do: itch.io upload, 10-second clip, real-phone test.

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
- [ ] Six power-ups that drop in the arena
- [ ] About 8 charms as a third loadout slot
- Done when: a run has moments of sudden power and the loadout has three meaningful choices.

## Usage rules
- New session per phase; start by reading only this file and `CLAUDE.md`.
- Logic before art. Art by script. Balance by simulation.
- No subagents or council re-runs unless asked.
