# Roadmap

One phase per session. Each ends with a commit and an updated status line here.

**Status:** Phase 2 merged to main (music on hold: switched off via `MUSIC_ON` in `src/audio.js`, do not work on it until asked). Phase 3 in progress on branch `phase-3-ship`: map, touch controls and performance done; the build uses relative paths and runs from any folder. Not tried on a real phone. Final name is NEMESIS. Next: itch.io upload (`nemesis-web.zip`, made by zipping `dist/`), 10-second clip.

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

## Usage rules
- New session per phase; start by reading only this file and `CLAUDE.md`.
- Logic before art. Art by script. Balance by simulation.
- No subagents or council re-runs unless asked.
