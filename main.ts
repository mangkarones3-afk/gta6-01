// Solano Bay — make.fun entrypoint.
//
// Run by the grader on Node 22: copies game/ and screenshots/ from this
// repository into the output directory, then writes dossier.json there
// with buildDossier from vendor/makefun-game.ts. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output.
//
// The caps handed to buildDossier are the bounty's own gate caps (the
// kit's competition.yaml names them; the library reads exactly these
// keys). The scorer passes the same values to its own buildDossier, so a
// tree the scorer would refuse fails here first, with the same error,
// instead of failing silently at grading time.
//
// The output is deterministic: the copy is a plain recursive copy of
// files whose bytes never change between runs, and buildDossier is a
// pure function of the copied tree, so two runs write identical bytes.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// The screenshots are half the entry: name their absence plainly rather
// than letting a copy of a missing directory fail with a bare ENOENT.
const screenshotsDir = join(repoRoot, "screenshots");
if (!existsSync(screenshotsDir)) {
  throw new Error(
    "Solano Bay entrypoint: no screenshots/ directory beside main.ts (looked for " +
      screenshotsDir + ") — an entry ships 3 or 4 rendered screenshots next to game/.",
  );
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, "game"), join(outputDir, "game"), { recursive: true });
cpSync(screenshotsDir, join(outputDir, "screenshots"), { recursive: true });

const dossierPath = join(outputDir, "dossier.json");
writeFileSync(dossierPath, buildDossier(outputDir, GATE_CAPS));

// Self-verification: rebuild the dossier from the output tree exactly as
// the scorer will and compare it byte for byte with the file just
// written. A divergence would hand the judge a dossier that is not the
// dossier of the copied game — a hard failure here, not a surprise at
// grading time.
const recomputed = buildDossier(outputDir, GATE_CAPS);
const written = readFileSync(dossierPath);
if (written.length !== recomputed.length || !written.equals(recomputed)) {
  throw new Error(
    "Solano Bay entrypoint: dossier.json mismatch — the written dossier (" +
      written.length + " bytes) differs from a fresh buildDossier of the " +
      "output tree (" + recomputed.length + " bytes); refusing to hand in " +
      "a dossier that does not describe the copied game.",
  );
}
