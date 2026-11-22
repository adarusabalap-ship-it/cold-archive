// Offline level repair: choose exit pads clear of the HUD and of walls, and build patrol
// routes that a guard can actually walk (every leg a clear straight line of open floor).
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { TILE, GUARD } from '../game/src/config.js';

const HUD = [
  { x: 18, y: 18, w: 372, h: 66 },
  { x: 1408 - 18 - 250, y: 18, w: 250, h: 66 },
  { x: 18, y: 832 - 18 - 46, w: 268, h: 46 },
  { x: 1408 - 18 - 268, y: 832 - 18 - 46, w: 268, h: 46 },
];
const hitsHud = (x, y, w, h) => HUD.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);

function straightClear(floor, a, b) {
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

function bfsReach(floor, from) {
  const seen = new Set([from.join(',')]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= floor.cols || ny >= floor.rows) continue;
      if (floor.blocksSight(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

const open = (floor, x, y) => !floor.blocksSight(x, y);

for (let fi = 0; fi < FLOORS.length; fi += 1) {
  const f = FLOORS[fi];
  const floor = new Floor(f);
  const reachable = bfsReach(floor, f.start);
  const kc = f.keycards[0];

  // --- exit: 2x2 open, HUD-clear, reachable from the keycard, away from the start tile
  const exitCands = [];
  for (let y = 1; y < floor.rows - 2; y += 1) {
    for (let x = 1; x < floor.cols - 2; x += 1) {
      let ok = true;
      for (let dy = 0; dy < 2 && ok; dy += 1) for (let dx = 0; dx < 2 && ok; dx += 1) if (!open(floor, x + dx, y + dy)) ok = false;
      if (!ok || hitsHud(x * TILE, y * TILE, 2 * TILE, 2 * TILE)) continue;
      if (!reachable.has(`${x},${y}`)) continue;
      const dStart = Math.hypot(x - f.start[0], y - f.start[1]);
      const dKey = Math.hypot(x - kc[0], y - kc[1]);
      if (dStart < 6) continue;
      exitCands.push({ x, y, score: dKey + dStart * 0.3 });
    }
  }
  exitCands.sort((a, b) => b.score - a.score);
  const exit = exitCands[0];

  // --- routes: rectangles of clear straight legs, spread apart, not on the exit
  const rects = [];
  for (let y = 2; y < floor.rows - 2; y += 1) {
    for (let x = 2; x < floor.cols - 2; x += 1) {
      for (const w of [4, 5, 6, 7]) {
        for (const h of [3, 4, 5]) {
          if (x + w >= floor.cols - 1 || y + h >= floor.rows - 1) continue;
          const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
          if (!corners.every(([cx, cy]) => open(floor, cx, cy))) continue;
          if (!corners.every(([cx, cy], i) => straightClear(floor, corners[i], corners[(i + 1) % 4]))) continue;
          if (!reachable.has(`${x},${y}`)) continue;
          // must not run through the exit pad or the start tile
          const overlapsExit = x <= exit.x + 1 && x + w >= exit.x && y <= exit.y + 1 && y + h >= exit.y;
          if (overlapsExit) continue;
          // a guard needs real floor to look at from its corners
          let usable = 0;
          for (const [cx, cy] of corners) {
            for (let a = 0; a < 24; a += 1) {
              const ang = (a / 24) * Math.PI * 2;
              let reach2 = 0;
              for (let d = 12; d <= GUARD.coneRange; d += 8) {
                if (!open(floor, Math.floor((cx * TILE + TILE / 2 + Math.cos(ang) * d) / TILE), Math.floor((cy * TILE + TILE / 2 + Math.sin(ang) * d) / TILE))) break;
                reach2 = d;
              }
              if (reach2 > TILE * 2) usable += 1;
            }
          }
          if (usable < 60) continue;
          rects.push({ x, y, w, h, area: w * h, usable });
        }
      }
    }
  }
  // pick one rect per guard, greedy on distance from the ones already chosen
  const chosen = [];
  for (let g = 0; g < f.guards.length; g += 1) {
    let best = null, bestScore = -1;
    for (const r of rects) {
      let minD = Infinity;
      for (const c of chosen) minD = Math.min(minD, Math.hypot(r.x - c.x, r.y - c.y));
      if (chosen.length === 0) minD = Math.hypot(r.x - kc[0], r.y - kc[1]);
      const score = minD * 2 + r.usable * 0.1;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    chosen.push(best);
  }

  console.log(`\n=== floor${fi} ${f.name}`);
  console.log(`  exit: { x: ${exit.x}, y: ${exit.y}, w: 2, h: 2 }`);
  console.log('  guards: [');
  for (const r of chosen) {
    const route = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    console.log(`    { route: ${JSON.stringify(route)} },`);
  }
  console.log('  ]');
}
