// main.ts — Solano Bay, entrypoint for the gta6-01 bounty.
//
// What the scorer expects: an /output directory holding game/ (the
// playable static build), screenshots/ (the judged renders) and a
// dossier.json produced by the vendored make.fun library from exactly
// those two trees. This program assembles that directory from the copy
// sitting next to it and writes the dossier.
//
// It must be boring: the grader runs it twice and demands identical
// bytes both times. So the output tree is wiped and rebuilt from
// scratch, nothing is timestamped, and buildDossier's canonical
// ordering does the rest. Set MAKEFUN_OUTPUT_DIR to run it locally.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, verbatim. text_max_bytes is the only value that
// shapes the dossier bytes; the others exist so this program refuses
// anything the scorer would refuse — an oversized screenshot, too
// many game files, an over-long path.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  rmSync(join(outDir, name), { recursive: true, force: true });
}
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier.json written: ${dossier.length} bytes`);
