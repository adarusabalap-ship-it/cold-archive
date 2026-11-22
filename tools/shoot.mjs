// Capture the game's own renders to screenshots/ with headless Chrome, one per scene.
// Usage: node tools/shoot.mjs [port] [outDir]
//
// Chrome writes a PNG of the whole window, so each scene is shot at 1280x757 — inside the
// gate's cap (long side <= 1280, short side >= 480) — and then converted to JPEG at a quality
// that keeps every file under 256 KiB. The PNGs land in .captures/ so screenshots/ holds only
// the finished files, and nothing under screenshots/ is edited: the JPEG is a straight
// re-encode of the frame the game itself drew.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const port = Number(process.argv[2] || 8099);
const outDir = resolve(process.argv[3] || 'screenshots');
const rawDir = resolve('.captures');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// The first file by name is the cover, so 1- is the frame that best says "stealth game":
// a lit room seen from above, three guards sweeping it, cover between you and the exit.
const SCENES = [
  { file: '1-cold-storage.jpg', shot: 'play', quality: 90 },
  { file: '2-in-cover.jpg', shot: 'cover', quality: 90 },
  { file: '3-spotted.jpg', shot: 'caught', quality: 90 },
  { file: '4-exit.jpg', shot: 'won', quality: 90 },
];

mkdirSync(rawDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

function run(args) {
  return new Promise((res, rej) => {
    const p = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`chrome exit ${code}: ${err.slice(-400)}`))));
  });
}

/** Re-encode one PNG to JPEG at the given quality. */
function toJpeg(png, jpg, quality) {
  const py = [
    'import sys',
    'from PIL import Image',
    "im = Image.open(sys.argv[1]).convert('RGB')",
    "im.save(sys.argv[2], 'JPEG', quality=int(sys.argv[3]), optimize=True, subsampling=0)",
  ].join('\n');
  const r = spawnSync('python', ['-c', py, png, jpg, String(quality)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`jpeg encode failed: ${r.stderr || r.stdout}`);
}

for (const s of SCENES) {
  const png = join(rawDir, `${s.shot}.png`);
  const jpg = join(outDir, s.file);
  const url = `http://127.0.0.1:${port}/?shot=${s.shot}&seed=1`;
  if (existsSync(png)) rmSync(png);
  await run([
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--force-device-scale-factor=1',
    '--window-size=1280,757',
    '--virtual-time-budget=2500',
    `--screenshot=${png}`,
    url,
  ]);
  if (!existsSync(png)) throw new Error(`no capture for ${s.shot}`);
  toJpeg(png, jpg, s.quality);
  const size = spawnSync('python', ['-c', 'import os,sys;print(os.path.getsize(sys.argv[1]))', jpg], { encoding: 'utf8' });
  console.log(`${s.shot} -> ${s.file} (${size.stdout.trim()} bytes)`);
}
