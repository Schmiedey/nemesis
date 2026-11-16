# NEMESIS

Single-player survivors-like roguelike. Hook: whatever kills you, joins you.
Start every session by reading `docs/Roadmap.md` (status line says where we are). Do not read the whole codebase.

## Layout
- `index.html`: page shell and overlays
- `src/sim.js`: all game rules. Pure: no DOM, seeded RNG. `createGame`, `step(g, dt, input)`, `pick(g, i)`
- `src/data.js`: enemy table `T`, upgrades `UP`, text
- `src/render.js`: canvas drawing, camera, particles (fixed 960x600 view, 1600x1000 arena)
- `src/ui.js`: HTML overlays · `src/save.js`: versioned save · `src/main.js`: loop, input, glue
- `tests/sim.test.js`: headless simulated runs
- `prototype/nemesis.html`: original one-file prototype, reference only
- `docs/`: Obsidian vault. Keep docs in sync when design changes.

## Commands
- `npm run dev` → http://localhost:8791 (port 8765 belongs to another project)
- `npm test` → simulated runs and save tests
- `node tests/balance.js` → survival table by party strength, played by the `smart` bot (about 2 minutes). Targets are in `docs/design/Core Loop.md`; re-run after any rule change.
- `npm run build` → `dist/`

## Testing
- Balance questions: use `simulate(seed, { party, bot, choose })` from `tests/bot.js`; do not play in the browser.
- Browser checks: `window.__game` exposes `g`, `mode`, `save`, `begin()`, `choose(i)`.

## Working style
Keep usage low: read only needed parts of files, trim output, no subagents unless asked.
Commit at each checkpoint and update the status line in `docs/Roadmap.md`.
