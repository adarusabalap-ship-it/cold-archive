import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { TILE } from '../game/src/config.js';

// HUD panels, in pixels, from drawHud: pad=18, panels 66 tall (top) / 46 tall (bottom).
const HUD = [
  { x: 18, y: 18, w: 372, h: 66 },
  { x: 1408 - 18 - 250, y: 18, w: 250, h: 66 },
  { x: 18, y: 832 - 18 - 46, w: 268, h: 46 },
  { x: 1408 - 18 - 268, y: 832 - 18 - 46, w: 268, h: 46 },
];
const hitsHud = (x, y, w, h) => HUD.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);

function straightClear(floor, a, b) {
  // Bresenham in tile space, same as the guard's straight walk.
  let x0 = a[0], y0 = a[1];
  const x1 = b[0], y1 = b[1];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (floor.blocksSight(x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

for (let fi = 0; fi < FLOORS.length; fi += 1) {
  const f = FLOORS[fi];
  const floor = new Floor(f);
  console.log(`\n=== floor${fi} ${f.name}`);
  console.log('  exit', JSON.stringify(f.exit), 'hud overlap:', hitsHud(f.exit.x * TILE, f.exit.y * TILE, f.exit.w * TILE, f.exit.h * TILE));

  // Candidate exit spots: a 2x2 of open floor, clear of the HUD, reachable from the keycard.
  const cands = [];
  for (let y = 1; y < floor.rows - 2; y += 1) {
    for (let x = 1; x < floor.cols - 2; x += 1) {
      let ok = true;
      for (let dy = 0; dy < 2 && ok; dy += 1) for (let dx = 0; dx < 2 && ok; dx += 1) if (floor.blocksSight(x + dx, y + dy)) ok = false;
      if (!ok) continue;
      if (hitsHud(x * TILE, y * TILE, 2 * TILE, 2 * TILE)) continue;
      cands.push([x, y]);
    }
  }
  console.log('  clear 2x2 exit candidates:', cands.length, 'e.g.', JSON.stringify(cands.slice(0, 6)));

  // Guard route legs that a straight walk cannot make.
  f.guards.forEach((g, gi) => {
    for (let i = 0; i < g.route.length; i += 1) {
      const a = g.route[i], b = g.route[(i + 1) % g.route.length];
      if (!straightClear(floor, a, b)) console.log(`  guard${gi} straight leg ${a}->${b} BLOCKED`);
    }
  });
}
