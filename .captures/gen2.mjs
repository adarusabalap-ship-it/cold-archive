// Choose patrol rectangles that a guard can walk AND can see out of: every leg is a clear
// straight line, every corner keeps a margin from walls, and from each corner at least half of
// eight directions see four tiles of floor, so a cone never ends up aimed into a wall.
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { TILE } from '../game/src/config.js';

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

/** How many of 8 compass directions see at least `want` tiles of open floor from a tile. */
function openness(floor, tx, ty, want = 4) {
  let n = 0;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    let ok = true;
    for (let d = 1; d <= want; d += 1) {
      if (!open(floor, Math.round(tx + Math.cos(a) * d), Math.round(ty + Math.sin(a) * d))) { ok = false; break; }
    }
    if (ok) n += 1;
  }
  return n;
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

for (let fi = 0; fi < FLOORS.length; fi += 1) {
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
          // no leg may touch the exit pad, so a guard never stands on the goal
          const onExit = corners.some(([cx, cy]) => cx >= exit.x - 1 && cx <= exit.x + exit.w && cy >= exit.y - 1 && cy <= exit.y + exit.h);
          if (onExit) continue;
          const minOpen = Math.min(...corners.map(([cx, cy]) => openness(floor, cx, cy)));
          if (minOpen < 4) continue;
          rects.push({ x, y, w, h, minOpen, corners });
        }
      }
    }
  }

  // spread the guards out: greedy farthest-point from the ones already placed
  const chosen = [];
  for (let g = 0; g < f.guards.length; g += 1) {
    let best = null, bestScore = -Infinity;
    for (const r of rects) {
      const ref = chosen.length ? chosen : [{ x: kc[0], y: kc[1] }];
      const minD = Math.min(...ref.map((c) => Math.hypot(r.x - c.x, r.y - c.y)));
      const score = minD * 3 + r.minOpen;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    chosen.push(best);
  }

  console.log(`\n=== floor${fi} ${f.name}   (${rects.length} candidate rects)`);
  console.log('    guards: [');
  for (const r of chosen) {
    console.log(`      { route: ${JSON.stringify([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])} },  // openness ${r.minOpen}/8`);
  }
  console.log('    ],');
}
