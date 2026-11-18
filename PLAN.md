# Solano Bay — build v6 plan (Workflow V2, phases 4–6)

## What this build is

A new, original 2D top-down open-world crime game, "Solano Bay", written
clean-room from the v6 brief. The v6 fix versus the standing entry: a minimap
that draws the real street network (lines over district tints, district
labels, player arrow, objective marker, police blips, POI icons), and a cover
frame staged so no sign is clipped by any HUD panel (≥8 fully readable signs).

## Architecture (one job per file, named for the job)

- `game/index.html` — page shell, canvas, loads the modules in order.
- `game/src/config.js` — world constants, district table, name pools, tunables.
- `game/src/rng.js` — seeded RNG streams (mulberry32 + FNV stream mixing).
- `game/src/city.js` — seeded city generation: road graph (nodes/edges/lanes),
  blocks, buildings with diegetic signs, landmarks, anchors, parked cars, props.
- `game/src/render.js` — world renderer: ground/water, roads, buildings,
  signage, props, sunset grade, entities.
- `game/src/minimap.js` — static map layer rendered once from the road graph
  (district tints under street lines, district labels), dynamic layer per
  frame (player arrow, objective marker, police blips, POI icons).
- `game/src/vehicles.js` — arcade car handling + graph-following traffic AI.
- `game/src/pedestrians.js` — sidewalk crowds with walk/cross/flee states.
- `game/src/wanted.js` — heat model, star ladder, police spawn/pursuit/search.
- `game/src/combat.js` — punching, shooting, health, damage.
- `game/src/missions.js` — 5-mission story arc, dialogue, objectives, rewards.
- `game/src/audio.js` — Web Audio synthesized SFX (no audio files).
- `game/src/save.js` — localStorage save/load (progress, cash, stats).
- `game/src/input.js` — keyboard + mouse state.
- `game/src/main.js` — game loop, camera, HUD, title screen, shot staging.
- `main.ts` (repo root) — copies game/ + screenshots/ to the output dir and
  writes dossier.json via buildDossier from vendor/makefun-game.ts.
- `vendor/makefun-game.ts` — byte-identical cp from the kit starter.

## City design

Seeded perturbed grid (~1,150 × 950 m), six districts with distinct pitch,
palette, heights and signatures: Aurora Heights (downtown), El Mercado
(midtown), Puerto Viejo (old town), Costa Serena (beachfront, south shore on
the bay), Palma Verde (suburbs), Dockside (industrial, east). Water along the
south edge. Landmarks: Torre Alba (downtown tower), Mercado Central hall,
the Puerto Viejo clock tower, Faro Serena lighthouse, Marina Dock cranes,
Palma Verde water tower. Story anchors: Café Alba, Marina Dock, Ferrer
safehouse, Serena pier.

## Story (5 missions, counter MISSION n/5)

Rocco Vale, a new wheelman in Solano Bay, works for fixer Lucía Ferrer.
1. First Wheels — meet Lucía at Café Alba; steal a car; deliver it Dockside.
2. Harbor Run — collect crates at Marina Dock; deliver to El Mercado (heat).
3. The Night Ledger — take the accountant's car in Puerto Viejo; bring it to
   the Ferrer safehouse.
4. Serena Sprint — timed run along Costa Serena to the pier (heat).
5. Bay Farewell — reach the pier boat under a 3-star floor and escape.

## Verification method

- Headless Chromium playtest: page loads with zero console errors; staged
  states reachable via `?shot=` hooks (real game states, no fabrication).
- Cover self-test against the brief: minimap shows (a) street grid,
  (b) ≥1 district label, (c) objective marker, (d) ≥2 police blips,
  (e) player arrow; ≥8 signs fully readable and unclipped in the cover.
- Screenshots: 4 real renders at 1280×800, JPEG ≤256 KiB each, cover first
  by name; cover mean luma target 105–125.
- main.ts run twice with MAKEFUN_OUTPUT_DIR → byte-identical dossier.
- Kit check from the kit dir; transcripts_present expected to fail locally.
- Super-teliti passes before the final report; deficits reported honestly.

## Shot list (criteria order)

1. `1-chase.jpg` — cover: police box-in at the Torre Alba junction, 3 stars,
   MISSION 2/5, rich minimap, objective line, dispatch line, sunset grade.
2. `2-street.jpg` — on-foot mission moment in El Mercado: dialogue with
   Lucía, pedestrians, traffic, named storefronts.
3. `3-drive.jpg` — Costa Serena beachfront drive, golden grade, speed read.
4. `4-start.jpg` — start screen (title + one-line arc pitch) over live city.
