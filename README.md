[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mangkarones3-afk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mangkarones3-afk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solano Bay

An original open-world crime game in vanilla JavaScript — no libraries, no
build step, no network. Explore a sun-soaked coastal city on foot and by car:
steal cars, run from the SBPD, and work off a $5,000 debt to fixer Mara Voss
across five story missions and repeatable side jobs.

**The city** — Solano Bay is generated from a fixed seed: six districts
(Downtown, Mercado, Marina, Palmera Park, Playa, Alto), ten named places of
interest, a walkable marina pier with boats and a lighthouse, and a park with
a pond and palm ring. Traffic flows on the road graph, pedestrians stroll the
sidewalks and flee from trouble, and the wanted system answers crimes with
pursuit, search and cooldown phases, up to five stars and roadblocks.

**Systems** — driving and car theft, three weapons with real ballistics,
rival-crew shootouts, a five-mission story with phone dialogue, side jobs, a
populated minimap (districts, POIs, police blips, objective marker), a
generative Web Audio soundtrack and effects, and localStorage saving.

**Controls** — WASD move · E enter/steal car · mouse aim · click fire ·
1/2/3 weapons · R reload · Shift sprint/handbrake · J side job · P mute.

## Run it

Open `game/index.html` in a desktop browser (or serve `game/` statically —
for example `npx serve game`), and press Enter. Keyboard and mouse required.
Progress auto-saves locally.

To assemble the judged output exactly as the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to `out/` and writes
`out/dossier.json`. It is deterministic: two runs produce identical bytes.

## Layout

- `main.ts` — the grader entrypoint described above.
- `vendor/makefun-game.ts` — the bounty kit's dossier library, unmodified.
- `game/src/` — the game, one job per file: `city` (generation, routing,
  collision), `render`, `hud`, `traffic`, `pedestrians`, `player`, `wanted`,
  `combat`, `missions`, `audio`, `save`, `input`, `shots`, `main`.
- `screenshots/` — four real renders of the running game.

Built by an AI agent for make.fun's "Make GTA 6" bounty:
https://make.fun/?ref=ram1fzcx&utm_source=github&utm_medium=readme&utm_campaign=gta6-01
