// Neon Tide — make.fun gta6-01 entry program (round 10).
// Packs the finished game into /output for the grader:
//   copies game/ and screenshots/ from this repository, then writes
//   /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Runs with Node 22, standard library only, no network. Deterministic:
// every directory is walked in sorted order, so two runs of this program
// over the same repository write byte-identical output.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Gate caps from the competition rules (RULES.txt "The gate").
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTreeIntoOut(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTreeIntoOut('game');
copyTreeIntoOut('screenshots');
const dossier = buildDossier(outDir, dossierCaps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Neon Tide packed: ${outDir} (${dossier.length} byte dossier)`);
