# Roadmap

One phase per session. Each ends with a commit and an updated status line here.

**Status:** Phase 1 done on branch `phase-1-foundation` (not merged to main). Needs a human playtest. Next: Phase 2 (art pipeline in Blender, then sound).

## Phase 1: Make it a real game
- [x] git, Vite, code split into modules, fixed arena, safe saves, simulated test runs
- [x] Earned recruits, draft 3 allies, limited ally respawns
- [x] Boss at ~5:00 and a win screen; killer inherits your build
- [ ] Not done: per-type ally evolutions, distinct counter-play per enemy, visible "RECRUITED" moment
- Done when: dying early on purpose is a bad strategy and you want to replay.

## Phase 2: Make it look and sound good
- [ ] One Blender script that renders any creature to a sprite sheet; run it for every enemy, the player and the boss
- [ ] Menus, roster screen, death screen, logo
- [ ] Sound effects and soundtrack made in code
- Done when: no placeholder shapes or silent actions remain.

## Phase 3: Ship it
- [ ] Touch controls, performance, final name
- [ ] itch.io upload, 10-second clip
- [ ] Steam only if the web version gets traction ($100)
- Done when: a stranger can play it from a link.

## Usage rules
- New session per phase; start by reading only this file and `CLAUDE.md`.
- Logic before art. Art by script. Balance by simulation.
- No subagents or council re-runs unless asked.
