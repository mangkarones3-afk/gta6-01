[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mangkarones3-afk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mangkarones3-afk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solano Bay

An original open-world crime game that runs entirely in the browser. Explore
the sun-soaked coastal city of Solano Bay on foot and by car: steal cars, run
with traffic and crowds, draw a wanted level and outrun the SBPD, fight, and
work through a five-mission story arc for fixer Lucía Ferrer — from a first
stolen ride in Aurora Heights to a last boat out of Costa Serena. Full HUD
with a street-accurate minimap (real road graph, district labels, police
blips, objective marker), side jobs, and localStorage saves.

## Run it

Serve the `game/` folder with any static file server and open `index.html`
in desktop Chrome, for example:

```
npx serve game
```

Controls: WASD / arrow keys to walk or drive, E to enter or leave a car,
Shift to sprint, Space or mouse click to punch / shoot, M for the full map
legend, Enter to advance dialogue. Progress saves automatically to
localStorage; the start screen offers Continue when a save exists.

## Layout

- `main.ts` — entrypoint: copies `game/` and `screenshots/` to the output
  directory and writes `dossier.json` with `buildDossier`.
- `game/` — the game itself (plain static files, no build step, no network).
- `game/src/` — one file per job: city generation, rendering, minimap,
  vehicles and traffic, pedestrians, wanted/police, combat, missions,
  audio, saving, input, and the main loop.

https://make.fun/?ref=ram1fzcx&utm_source=github&utm_medium=readme&utm_campaign=gta6-01
