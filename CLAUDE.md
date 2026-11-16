# NEMESIS

Single-player survivors-like roguelike. Hook: whatever kills you, joins you.

## Layout
- `nemesis.html`: current playable prototype (vanilla JS + canvas, one file)
- `docs/`: Obsidian vault with design docs. Start at `docs/Home.md`. Keep docs in sync when design changes.

## Run
`python3 -m http.server 8791 --bind 127.0.0.1` then open http://localhost:8791/nemesis.html
(port 8765 is taken by another project on this Mac)

## Testing
Headless balance check: in the browser console, loop `update(1/60)` and `pick(0)` on level-ups until `state==='dead'`, then read `t`, `kills`, `save.roster`. Clear `localStorage.nemesis_v1` afterward.

## Working style
Keep usage low: read only needed parts of files, trim output, no subagents unless asked.
