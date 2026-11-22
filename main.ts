// Cold Archive — the hand-in for make.fun's "Make the best stealth game" bounty (Node 22, standard
// library only). The game itself is game/: plain static files a desktop browser loads with no
// network request (game/index.html and the ES modules beside it). This program copies game/ and
// screenshots/ to /output and writes /output/dossier.json, the summary the judge reads, with the
// kit's own buildDossier.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with: node serve.ts   (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './game/vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps, as the kit's starter passes them: only text_max_bytes shapes the bytes;
// the rest refuse an entry the scorer would refuse, here rather than after it is sent.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
