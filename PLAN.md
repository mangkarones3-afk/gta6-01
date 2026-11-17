# Solano Bay — build plan (Workflow V2, Phase 4)

## What this is

An original open-world crime game for make.fun bounty gta6-01: a sun-soaked
coastal city explored on foot and by car, with traffic, pedestrians, stealable
cars, a wanted system with responding police, a five-mission story plus side
jobs, combat, a HUD with a populated minimap, a start screen, and local save.
2D top-down canvas, vanilla JS, no libraries, no network. Everything original:
city (Solano Bay), people (Reno Kade, Mara Voss), police (SBPD), places, story.

## Why 2D (Phase 2 evidence)

The Phase 2 top-10 study (475-entry field) found ranks 1–2 are both 2D
top-down; what separates the leaders is framing (~3×3 blocks), saturation
(sunset grade, mean cover brightness ~90–125), legible police confrontation
in the cover, diegetic signage (≥4 named POIs in frame), a minimap with
content, and progression shown numerically. A 3D switch buys only a depth
cue and spends the build budget on a new engine. Decision: punched-up 2D,
with study fixes F1–F7 as hard gates (below).

## Structure (one job per file — criterion 5)

- `main.ts` — repo root: copies `game/` + `screenshots/` to the output dir
  and writes `dossier.json` via `buildDossier` from `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — the kit library, copied byte-identical (`cp`).
- `game/index.html` + `game/css/style.css` — shell and styling.
- `game/src/` — config (world geometry, districts, POIs, tuning), rng
  (seeded streams), city (procedural generation, road graph, collision),
  render (canvas drawing + sunset grade), hud (HUD, minimap, dialogue,
  menus), traffic (road-graph traffic + parked cars), pedestrians, player
  (on-foot + driving), wanted (heat, stars, police AI, roadblocks, pursuit
  phases), combat (weapons, bullets, health), missions (5 story + 3 side,
  dialogue, objectives), audio (generated SFX + music loop), save
  (localStorage), input (keyboard/mouse), shots (deterministic staged
  scenes for the screenshots), main (boot + game loop + state machine).
- `screenshots/` — 4 real renders, 1280×800 JPEG q85, ≤ 256 KiB each:
  `01-cover.jpg` (staged police box-in), `02-park.jpg` (on foot, mission
  4/5), `03-marina.jpg` (pier), `04-chase.jpg` (3-star pursuit).

## Hard gates (from the brief + study)

- F1 cover: hero car centre-frame at an avenue intersection, boxed in by 3
  SBPD cars from three sides (none occluded), striped roadblock with a
  fully visible ROADBLOCK label east, 4 stars lit.
- F2 camera ~3×3 blocks in gameplay shots; one on-foot close frame.
- F3 saturated sunset grade; cover mean luma 105–125 measured with PIL.
- F4 ≥8 readable shop/POI signs in the cover; landmarks (Marina Pier,
  Palmera Park) break the grid.
- F5 minimap populated: district tints + labels, POI dots, objective
  diamond, police blips, player arrow.
- F6 HUD shows MISSION n/5 + objective + live distance; title screen
  carries a one-line arc pitch.
- F7 no clipped HUD labels anywhere in any shot.
- Gate numbers: game/ ≤993 entries, ≤48 MiB; screenshots 3–4, each
  ≤262,144 B, long side ≤1,280, short ≥480; dossier ≤1.5 MiB and
  byte-identical across two `main.ts` runs.
- Wanted model: heat 0–500, star thresholds 40/100/180/280/400, roadblocks
  at 3★+, pursuit → search → cooldown → clear phases, heat decays unseen.
- Story: Reno Kade owes fixer Mara Voss; 5 missions work the debt off;
  mission 1 = steal a marked car and deliver it; mission 3 = pickup that
  steps heat to 3★, escape until clear, then reach the plaza.

## Verification (Phase 6, before calling anything done)

- Headless Chromium/CDP playtest on the final tree: boot with zero page
  errors; exact city counts; walking; mission 1 end-to-end (steal → heat →
  drive → deliver → exact cash); mission 3 end-to-end (3★ step → escape
  through the phase machine → plaza → cash); shooting decrements the
  magazine; save written; building-collision sampling clean.
- Improvement round after the first playtest: revise several files (and
  `main.ts` again) from what the playtest and screenshots show.
- `node main.ts` twice → byte-identical dossier (diff + sha256).
- Kit check from the kit dir; secrets sweep of the whole tree.
- Screenshots measured (bytes, geometry, cover luma) and read against
  F1–F7 one by one.
