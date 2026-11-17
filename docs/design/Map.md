# The Map (plan, Phase 24)

## Why
The arena is 1600x1000, under two screens wide (view 960x600). The camera barely moves, every run happens in the same box, and the three layouts (`LAYOUTS` in `src/sim.js`) are just patterns of round rocks. There is nothing to go toward and no reason to move except dodging.

## What it should be
A world about **5 screens across** (4800x3000, nine times the area), made from the run's seed, with **places worth walking to**. The hook decides what those places are: the map is where you go to choose your killer.

### Layout: zones on a grid
- The world is cut into a 6x4 grid of zones (800x750 each). The middle zone is the **Crypt**, where you start: open floor, a few pillars, no walls.
- Each other zone gets a **biome**, picked by the seed and kept in rings around the Crypt, so difficulty and look change as you head out:
  - **Bone Fields** (near): open ground, bone piles as low cover.
  - **Sunken Halls** (middle): broken walls and doorways, shallow water that slows walking enemies (not you).
  - **Ember Pits** (far): lava pools that burn walking enemies but never you (built this way so the world never steals a death). More elites: not yet.
- The edge of the world is a cliff or wall drawn in the biome's style, not an invisible line.

### Landmarks (one or two per zone)
- **Lairs**: a named elite that stays put on its lair, marked on the minimap. Dying to it is a prize recruit, so a lair is a choice you walk toward. This is the hook on the map.
- **Shrines**: step in for a power-up, then they go dark for 60s.
- **Vaults**: a chest in the middle of a ruined room. Built as an ambush instead of a gate: from 1:00 the chest is there, and walking up to it springs walkers at the doors.
- **The boss's arena**: at 4:30 the minimap marks where your nemesis will rise. Go there to fight on open ground, or stay put and it comes to you through whatever terrain you're in.

### Getting around
- Walls are rectangles as well as round rocks, so rooms, corridors and doorways are possible.
- Walking enemies follow a **flow field**: a 40-unit grid (120x75 cells) filled outward from the player every 0.25s, so they go round walls instead of piling into them. Flyers keep flying straight.
- Enemies still spawn on a ring just off camera, but only on open floor. In the big map they come from every side instead of from the arena's edges, so the swarm will feel heavier. Re-tune with the bot.
- A **fog-of-war minimap** shows where you've been. Lairs, shrines and the boss mark show once seen (the boss mark always).

## How to build it
1. **Bigger world, same game.** Change `ARENA` to 4800x3000 and generate rocks from the seed instead of the fixed `LAYOUTS`. Put rocks in a spatial grid so collision checks only look at nearby cells. Bake the floor in chunks, or as one 2400x1500 canvas (about 14 MB), and draw only what's on screen. Re-run the balance table; scale spawn rate so the swarm around you matches today.
2. **Walls and the flow field.** Add rectangle walls (collision, bullets, line of sight for Archers). Add the flow field for walking enemies and teach the `smart` bot to path round walls (`tests/bot.js` only avoids round rocks today). Test that nothing gets stuck (headless runs: no enemy stays in one place for 10s).
3. **Biomes and art.** Floor, wall, water and lava tiles for three biomes in `art/make_pixels.mjs`, from `PAL` with hard edges. Water is a `dither()` fill. Regenerate the sheet and look at it enlarged first.
4. **Landmarks.** Lairs, shrines, vaults, the boss mark, with minimap icons from the sheet.
5. **Minimap fog**, then the docs (Core Loop, Roadmap) and a full balance run.

Each step is its own commit and leaves the game playable. Step 1 alone already ends "the little square".

## Risks
- **Balance moves a lot.** Spawning from every side and the time spent walking both change survival. Steps 1 and 2 each need a full table run.
- **Performance:** 240 enemies with flow-field lookups is cheap (one grid read each). The risk is the floor bake on phones; chunking fixes it.
- **Bot:** the balance numbers are only as good as the bot's pathing, so step 2 has to come with bot work.

## Decisions for the user
- World size: 4800x3000 recommended (smaller feels like today; much bigger and the swarm thins out).
- Open field with walls (recommended for a survivors-like) or true rooms and corridors.
