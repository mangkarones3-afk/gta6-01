# Solano Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mangkarones3-afk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mangkarones3-afk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for the browser, built for the
[make.fun](https://make.fun/bounty/gta6-01) **gta6-01** bounty. No engine,
no assets, no build step — plain HTML, CSS and JavaScript modules that run
offline from `game/index.html`.

**Five jobs. One debt. Take the bay back.** Reno Kade owes the Bay Rats more
than he has. Working for Mara Voss out of Taller Voss garage, he steals,
robs and shoots his way up from errand boy to the Velero Job — while the
SBPD's heat system tracks every witnessed crime.

## Play

Open `game/index.html` in a desktop browser (or serve the folder statically).
Click or press Enter to start.

- **WASD / arrows** — walk and drive
- **E** — enter, exit, steal cars (parked or moving traffic)
- **Mouse** — aim · **click** — shoot · **1/2/3** — pistol / SMG / shotgun · **R** — reload
- **Shift** — sprint on foot, handbrake in a car · **Space** — jump / brake
- **M** — take the next story job · **J** — side job · **P** — mute · **N** — new game

## What's in the world

- A seeded coastal city: road graph with arterials, a ring road, one-way
  downtown streets and a beachfront boulevard; six districts, a marina
  pier, Palmera Park, and ten signed businesses (Banco del Sol, Hotel
  Paloma, Cine Solano, Club Velero…)
- Driving on an arcade bicycle model, lane-following traffic that yields
  to sirens, stealable parked cars, and pedestrians who flee gunfire —
  and witness crimes
- A heat-driven wanted system: stars from witnessed crimes, BFS-routed
  police pursuits, foot cops, roadblocks at three stars, search and
  cooldown when you break line of sight
- Five story missions plus repeatable side jobs (chop shop, delivery,
  taxi), on-foot combat against rival crews, cash pickups, a generated
  Web Audio soundtrack and effects, and a localStorage save

## Layout

- `game/` — the game itself: `index.html`, `css/`, and sixteen
  single-purpose modules under `src/` (city generation, rendering,
  traffic, wanted, missions, combat, HUD, audio, save…)
- `screenshots/` — four staged renders; the first is the cover
- `main.ts` — assembles `/output` (game + screenshots) and writes the
  submission dossier with the vendored library in `vendor/`

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Deterministic: two runs produce byte-identical `dossier.json`.

## License

MIT — see `LICENSE`.

<sub>Built with Muse on make.fun — [follow the builder](https://make.fun/?ref=ram1fzcx&utm_source=github&utm_medium=readme&utm_campaign=gta6-01).</sub>
