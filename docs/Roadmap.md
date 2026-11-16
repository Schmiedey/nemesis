# Roadmap

One phase per session. Each ends with a commit and an updated status line here.

**Status:** Phases 1-5 merged to main (music on hold: switched off via `MUSIC_ON` in `src/audio.js`, do not work on it until asked; itch.io upload, clip and real-phone test are the user's to do). Phase 6 in progress on branch `phase-6-depth`: depth and feel done (tilted 8-direction sprites, shadows, light pool, hit flash, damage numbers, hit-stop, level-up restyle). Next: reasons to return (Nemesis+, daily run, feats, nemesis history).

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
- [ ] Nemesis+ mode, daily run, feats that unlock starting perks, nemesis history on roster cards
- Done when: it looks finished and there is always a next thing to chase.

## Usage rules
- New session per phase; start by reading only this file and `CLAUDE.md`.
- Logic before art. Art by script. Balance by simulation.
- No subagents or council re-runs unless asked.
