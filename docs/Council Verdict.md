# Council Verdict (2026-11-15, second sitting, Fable 5.2)

Three advisors reviewed the prototype fresh: game designer, technical lead, market advisor. This replaces the first verdict.

## The hook
- It works: the death screen pays out (names the killer, grows the roster, teases the next unlock).
- What is rare is the *specific killer* joining you, which makes death a choice.
- Pitch: **"A survivors-like where whatever kills you fights for you forever, so choose your death."**
- Closest neighbours: Shadow of Mordor (killer is remembered but stays an enemy), Right Click to Necromance / Boneraiser Minions (things you kill join you). None found built on exactly this, but this was from memory, not searched.
- **Rename before going public.** "Nemesis" is unsearchable and invites comparison with WB's patented Nemesis system.

## Where the prototype breaks
1. **Dying is free profit.** A 3-second death pays the same as a 3-minute one, so the best strategy is to suicide into bats.
2. **Stacking is unbounded.** +30% per extra copy, no cap. The game solves itself in ~20 deaths.
3. **Allies are immortal shields.** They respawn forever, so Brutes become a permanent wall.
4. **Content ends at 2:20.** No boss, goal or ending.
5. **Upgrade cards are flat stat bumps.** Only Rally touches the hook; the full heal is always the right panic pick.
6. **Arena = browser window.** Bigger monitor, easier game.

## Design changes for v1 (ranked)
1. **Earned recruits.** Recruit quality scales with how long you survived and your level. A 0:10 death yields a runt.
2. **Draft a capped party.** Pick 3 nemeses before each run; duplicates rank up with diminishing returns.
3. **Goal and escalation.** Boss around 5:00, elites, wave events.
4. **Cards tied to the roster.** Per-type ally cards and evolutions (bomber chain explosions, slime triple split). Cut the full heal.
5. **Losable allies.** Limited respawns per run; fixed arena with a camera.

## Bold idea: the killer inherits your build
A bat that kills your Split Shot + Piercing run becomes a *named* piercing, split-shot bat. The roster becomes a graveyard of your own past runs, and "what do I die to, holding which build" becomes the deepest decision.

## Avoid
- A permanent stat shop with meta-currency. It turns the hook into grind.
- Leaderboards. They need an audience.

## Tech
- Stay vanilla JS + canvas, split into ES modules, Vite as the only build tool. No engine.
- Separate `sim.js` (no DOM, seeded RNG) so the game can be tested headlessly with Vitest.
- Risks: O(n²) separation and per-frame array allocation, unversioned save with no try/catch, keyboard only, no pause.
- The folder is not a git repo. That is the biggest gap.

## MCPs and tools
- **Keep:** Playwright MCP (already installed). Add a `window.__game` debug hook for it.
- **Skip:** Obsidian MCP (vault is plain markdown), GitHub MCP (`git` + `gh` do it), asset and audio generation.
- **Install later, as a CLI:** butler, for one-command itch.io uploads.
- **Sound:** ZzFX or jsfxr, where sound effects are code.
- Every extra MCP costs usage each session, so none were added.

## Money (from memory, approximate)
- Free web build on itch.io as the funnel, then Steam at $3.99–4.99. Skip mobile stores.
- Most no-audience solo games earn under $1–3k lifetime. 1,000 wishlists ≈ 100–200 first-week sales.
- Costs: $100 Steam fee, $100–300 for capsule art.

## Marketing
- Clip: an elite kills the player → "RUN 2" → the same elite shreds a horde beside you. Caption: "It killed me. Now it works for me."
- Post with a playable link: YouTube Shorts, TikTok, r/roguelites, r/WebGames, r/IndieGaming.
- Email 30–50 small survivors-like YouTubers. Steam Next Fest is the biggest free lever and can be used once.
