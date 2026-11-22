// Patrol rectangles a guard can walk AND see out of. Every corner must have two clear tiles in
// each cardinal direction, so a pause-and-sweep never ends aimed into a wall, and every leg must
// be a clear straight line of open floor.
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';

const open = (floor, x, y) => x >= 0 && y >= 0 && x < floor.cols && y < floor.rows && !floor.blocksSight(x, y);

function straightClear(floor, a, b) {
  let x0 = a[0], y0 = a[1];
  const x1 = b[0], y1 = b[1];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (!open(floor, x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/** Clearance: tiles of open floor before a wall, in each cardinal direction. */
function clearance(floor, tx, ty) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return Math.min(...dirs.map(([dx, dy]) => {
    let n = 0;
    for (let d = 1; d < 8; d += 1) {
      if (!open(floor, tx + dx * d, ty + dy * d)) break;
      n = d;
    }
    return n;
  }));
}

function bfsReach(floor, from) {
  const seen = new Set([from.join(',')]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !open(floor, nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

const MIN = Number(process.argv[2] || 3);
const ONLY = process.argv[3] === undefined ? -1 : Number(process.argv[3]);
for (let fi = 0; fi < FLOORS.length; fi += 1) {
  if (ONLY >= 0 && fi !== ONLY) continue;
  const f = FLOORS[fi];
  const floor = new Floor(f);
  const reach = bfsReach(floor, f.start);
  const kc = f.keycards[0];
  const exit = f.exit;

  const rects = [];
  for (let y = 2; y < floor.rows - 3; y += 1) {
    for (let x = 2; x < floor.cols - 3; x += 1) {
      for (const w of [4, 5, 6]) {
        for (const h of [3, 4]) {
          if (x + w > floor.cols - 2 || y + h > floor.rows - 2) continue;
          const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
          if (!corners.every(([cx, cy]) => open(floor, cx, cy) && reach.has(`${cx},${cy}`))) continue;
          if (!corners.every(([cx, cy], i) => straightClear(floor, corners[i], corners[(i + 1) % 4]))) continue;
          if (corners.some(([cx, cy]) => cx >= exit.x - 1 && cx <= exit.x + exit.w && cy >= exit.y - 1 && cy <= exit.y + exit.h)) continue;
          // the guard must have room to sweep: two clear tiles on every side of every corner
          const clear = Math.min(...corners.map(([cx, cy]) => clearance(floor, cx, cy)));
          if (clear < MIN) continue;
          rects.push({ x, y, w, h, clear, corners });
        }
      }
    }
  }

  const chosen = [];
  for (let g = 0; g < f.guards.length; g += 1) {
    let best = null, bestScore = -Infinity;
    for (const r of rects) {
      const ref = chosen.length ? chosen : [{ x: kc[0], y: kc[1] }];
      const minD = Math.min(...ref.map((c) => Math.hypot(r.x - c.x, r.y - c.y)));
      const score = minD * 3 + r.clear * 2;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    chosen.push(best);
  }

  console.log(`\n=== floor${fi} ${f.name}   (${rects.length} rects)`);
  console.log('    guards: [');
  for (const r of chosen) {
    console.log(`      { route: ${JSON.stringify([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])} },  // clearance ${r.clear}`);
  }
  console.log('    ],');
}
