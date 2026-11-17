// Solano Bay — entrypoint for the make.fun gta6-01 grader.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier from the vendored kit library.
// Deterministic: no clocks, no randomness, stable sorted copies — two
// runs over the same tree write identical bytes.

import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The competition's caps, as published in the bounty rules.
const CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function listFiles(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (statSync(p).isDirectory()) out.push(...listFiles(p, rel));
    else out.push(rel);
  }
  return out;
}

mkdirSync(outDir, { recursive: true });
for (const part of ['game', 'screenshots']) {
  const dest = join(outDir, part);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(root, part), dest, { recursive: true });
}

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = listFiles(join(outDir, 'game'), '');
const shots = listFiles(join(outDir, 'screenshots'), '');
let gameBytes = 0;
for (const rel of gameFiles) gameBytes += statSync(join(outDir, 'game', rel)).size;
console.log(`solano-bay: copied ${gameFiles.length} game files (${gameBytes} bytes) and ${shots.length} screenshots to ${outDir}`);
console.log(`solano-bay: dossier.json is ${dossier.length} bytes; output holds ${gameFiles.length + shots.length + 1} entries in all`);
