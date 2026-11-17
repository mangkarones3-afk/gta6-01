# Solano Bay — Phase 4 plan (Workflow V2.0), gta6-01 rebuild #3

This is the third recorded build of the same game. Build #2 (Solano Bay)
was completed and fully verified — 17/17 headless playtest, kit check
clean, dossier byte-identical across two runs — but its sealed
recording was refused because an unrelated research session straddled
that recorder's start line. Nothing about the game failed. This session
re-authors the identical game, file by file, under recording
01a1ea63-0142-71ed-9612-5f7d5c386ee2. The verified build at
`../gta6-01-ref-sealedbad-01a1ea49/` (HEAD 024f4eb) is a read-only
design reference: every file is written fresh here, never copied (sole
exception: `vendor/makefun-game.ts`, copied byte-identical from the
kit, as the brief requires).

## Architecture call (from the Phase 2 study — settled, not relitigated)

Stay **2D canvas, top-down**. Ranks 1–2 on the live board are both 2D;
what beat the first build was framing, saturation, signage and minimap
content, not a 3D depth cue. Keep the criterion-5 strength: 16
single-job source files under `game/src/`, named for what they do.
City name **Solano Bay**; hero Reno Kade, contact Mara Voss, police
the SBPD.

## Stages

1. Scaffold: `PLAN.md`, `.gitignore`, `LICENSE` (SPDX line 1),
   `.makefun/owner.json`, `vendor/makefun-game.ts` (kit `cp`, `cmp`-verified).
2. World data: `config.js` (sunset palette, districts, POIs, wanted /
   car / weapon numbers), `rng.js` (seeded streams only), `city.js`
   (road graph, blocks, buildings with reserved landmark parcels,
   named POIs pinned to buildings, Marina Pier + boardwalk,
   Palmera Park with pond).
3. Render: `render.js` — saturated sunset grade (measured cover
   brightness ~105–125), world-scaled cars (~14 units) and people,
   POI/landmark sign boards sized from measured text, roadblock drawn
   after buildings so its label can never be overpainted.
4. Systems: `traffic.js` (bicycle model + lane-following AI),
   `pedestrians.js` (witnesses who flee), `player.js` (foot + driving,
   stealing), `wanted.js` (heat → stars, BFS-routed pursuits, foot
   cops, roadblocks at 3★, SEARCH → COOLDOWN escape), `combat.js`
   (3 weapons, enemy crews), `missions.js` (5 story jobs + 3 side
   jobs). Enemies and foot cops collide with buildings via the shared
   `slideMove` helper.
5. Presentation: `hud.js` (MISSION n/5 objective with live distance,
   dispatch ticker, populated minimap — district tints, POI dots,
   objective diamond, police blips, clamped district label),
   `audio.js` (all-synthesized SFX plus a generative music loop),
   `save.js`, `input.js`, `shots.js` (deterministic staging),
   `main.js`, `game/index.html`, `game/css/style.css`.
6. Packaging: `main.ts` (dossier opts identical to the kit's gate
   values; revised again in a later separate message), `README.md`
   with the 3 live make.fun badges verbatim from the brief.
7. Phase 6 loop: headless playtests, screenshots, judge-view sheet,
   fixes, kit check, super-teliti passes (below).

## Per-deliverable quality targets (study codes F1–F7 are hard gates)

- **F1 Cover** — a legible police box-in: 3 cop cars confronting the
  player car centre-frame on the z=4 downtown arterial, 4 stars lit,
  ROADBLOCK label fully visible, dialogue line naming the escape.
- **F2 Camera** — gameplay framing ~3×3 blocks: scale ≈4.6 driving /
  ≈5.6 on foot. One on-foot close frame (Palmera Park) in the shot set.
- **F3 Palette** — saturated sunset/dusk grade: deep navy roads, warm
  terracotta/cream/teal buildings, deep teal water. No washed pastel.
- **F4 Signage** — ≥4 named POIs readable in the cover frame (Solano
  Tower, Banco del Sol, Hotel Paloma, Cine Solano), 10 citywide;
  Marina Pier + Palmera Park break the grid.
- **F5 Minimap** — populated: district tints, water, POI dots,
  objective diamond, police blips, safehouse, player arrow.
- **F6 Progression** — "MISSION n/5" + objective + distance in the
  HUD panel; one-line story-arc pitch on the title screen.
- **F7 No clipped HUD labels** — sign panels sized from measured
  text; minimap district label clamped inside its frame; roadblock
  label drawn last.
- Systems bar (criterion 1, all must exist and run): city on foot +
  by car, traffic, pedestrians, stealable cars, wanted + responding
  police, 5 story missions + 3 side jobs, combat, HUD + minimap,
  start screen, save. **Mission 3's heat step tested end-to-end**
  headlessly (reach 3 stars → break sight → SEARCH → COOLDOWN →
  mission completes, +$1,500).

## Verification method (Phase 6, super-teliti)

- Headless Chromium (Playwright) playtest suite: boot with zero page
  errors; scripted end-to-end runs of missions 1 and 3; steal /
  drive / shoot / save exercised through the real input paths; enemy
  building-collision sampling while chasing.
- Screenshots: 4 real renders at 1280×800 via the game's own
  `?shot=` staging, JPEG ≤ 256 KiB each, then viewed at judge size
  (cover fitted inside 768×480) and read against F1–F7; cover
  brightness measured and compared with the study's table.
- `main.ts` run twice into two output dirs → byte-identical trees.
- Kit check from the kit dir (`transcripts_present` failing locally
  is the expected dry-run artifact; everything else must pass).
- Gate arithmetic two ways: file/size caps counted by hand and by
  the kit check.
- No push, no seal, no submit — the parent runs Phases 7–8.
