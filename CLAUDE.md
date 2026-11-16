# NEMESIS

Single-player survivors-like roguelike. Hook: whatever kills you, joins you.
Start every session by reading `docs/Roadmap.md` (status line says where we are). Do not read the whole codebase.

## Layout
- `index.html`: page shell and overlays
- `src/sim.js`: all game rules, including the maps (`LAYOUTS`; a run's rocks are `g.rocks`). Pure: no DOM, seeded RNG. `createGame`, `step(g, dt, input)`, `pick(g, i)`
- `src/data.js`: enemy table `T`, upgrades `UP`, text
- `src/render.js`: pixel-art drawing. The world goes on a 480x300 canvas (one art pixel = 2 game units, CSS-stretched with hard edges); the HUD goes on a second sharp canvas (`#hud`). Game coordinates stay 960x600 view, 1600x1000 arena.
- `src/audio.js`: WebAudio synth, no audio files. `sfx(name)` one-shots, `scene(mode, g)` steers the soundtrack. The sim queues cues as `{ k: 'snd', n }` in `g.fx`.
- `src/ui.js`: HTML overlays · `src/save.js`: versioned save · `src/main.js`: loop, input, glue
- `tests/sim.test.js`: headless simulated runs
- `art/make_pixels.mjs`: all art. Draws every sprite (creatures, bullets, items, effects, UI icons) from a few primitives on small grids with one palette (`PAL`) and a 1-pixel outline, then writes `public/sprites/items.png` and `src/atlas.js` (`ATLAS`: name → position). Creatures are `c_<type>` (side view, four frames, flipped in game to face left); icons are `i_<id>` matching upgrade and gear ids.
- `art/make_sprites.py`: retired Blender pipeline, kept for reference; nothing in the game uses its output.
- `public/fonts/`: Silkscreen (titles, HUD) and Pixelify Sans (body), SIL OFL, licence files alongside.
- `prototype/nemesis.html`: original one-file prototype, reference only
- `docs/`: Obsidian vault. Keep docs in sync when design changes.

## Commands
- `npm run dev` → http://localhost:8791 (port 8765 belongs to another project)
- `npm test` → simulated runs and save tests
- `node tests/balance.js --rows "no party,runts,soldiers"` and `--rows veterans,champions` → the main table in two halves. The whole table takes over 10 minutes, so run the halves separately (the second in the background).
- `node tests/balance.js --classes` → solo survival per class against no class (add `--rows ranger` to limit).
- `node tests/balance.js --weapons` → solo survival per weapon and ability (add `--only rod,totem` to limit). Re-run after any weapon change.
- `node tests/balance.js` → survival table by party strength, played by the `smart` bot (over 10 minutes in full; use `--rows`). Targets are in `docs/design/Core Loop.md`; re-run after any rule change.
- `npm run build` → `dist/`
- `node art/make_pixels.mjs` → regenerate the sprite sheet and `src/atlas.js` after changing any art. Look at the sheet enlarged before wiring it in (`ffmpeg -i public/sprites/items.png -vf scale=iw*5:ih*5:flags=neighbor out.png`).

## Testing
- Balance questions: use `simulate(seed, { party, bot, choose })` from `tests/bot.js`; do not play in the browser.
- Performance: the world canvas is always 480x300; never size it to the window. Backquote toggles a frame counter; `window.__game.perf` returns the same numbers.
- Browser checks: `window.__game` exposes `g`, `mode`, `save`, `begin()`, `choose(i)`, `audio` (use `audio.debugState()`; a dynamic `import()` gets a different module copy).

## Working style
Keep usage low: read only needed parts of files, trim output, no subagents unless asked.
Commit at each checkpoint and update the status line in `docs/Roadmap.md`.

## Look
Pixel art throughout: one palette (`PAL` in `art/make_pixels.mjs`, mirrored as CSS variables in `index.html`), two pixel fonts, hard edges. No rounded corners, glows, gradients, emoji or text symbols as icons; use a sprite from the sheet instead. See-through areas (danger zones, auras) are a checkerboard `dither()` fill with a `dashRing()` outline in `src/render.js`, never a soft alpha fade.
