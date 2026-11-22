// Pick patrol routes by simulating them: the best route for a guard is the one whose cone
// falls on floor most of the time and never ends up entirely on a wall.
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { scoreRoute } from './sim.mjs';

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

const only = process.argv[2] === undefined ? -1 : Number(process.argv[2]);

for (let fi = 0; fi < FLOORS.length; fi += 1) {
  if (only >= 0 && fi !== only) continue;
  const f = FLOORS[fi];
  const floor = new Floor(f);
  const reach = bfsReach(floor, f.start);
  const kc = f.keycards[0];
  const exit = f.exit;

  const cands = [];
  for (let y = 2; y < floor.rows - 3; y += 1) {
    for (let x = 2; x < floor.cols - 3; x += 1) {
      for (const w of [4, 5, 6]) {
        for (const h of [3, 4]) {
          if (x + w > floor.cols - 2 || y + h > floor.rows - 2) continue;
          const route = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
          if (!route.every(([cx, cy]) => open(floor, cx, cy) && reach.has(`${cx},${cy}`))) continue;
          if (!route.every(([cx, cy], i) => straightClear(floor, route[i], route[(i + 1) % 4]))) continue;
          if (route.some(([cx, cy]) => cx >= exit.x - 1 && cx <= exit.x + exit.w && cy >= exit.y - 1 && cy <= exit.y + exit.h)) continue;
          cands.push(route);
        }
      }
    }
  }

  // Score every candidate, then take the best for each guard while spreading them apart.
  const scored = cands.map((route) => ({ route, ...scoreRoute(f, route, 18) }));
  scored.sort((a, b) => (b.mean + b.min * 1.5) - (a.mean + a.min * 1.5));

  const chosen = [];
  for (let g = 0; g < f.guards.length; g += 1) {
    let best = null, bestScore = -Infinity;
    for (const c of scored) {
      if (chosen.includes(c)) continue;
      const ref = chosen.length ? chosen.map((k) => ({ x: k.route[0][0], y: k.route[0][1] })) : [{ x: kc[0], y: kc[1] }];
      const minD = Math.min(...ref.map((r) => Math.hypot(c.route[0][0] - r.x, c.route[0][1] - r.y)));
      const score = c.mean * 3 + c.min * 3 + Math.min(minD, 12) * 0.4;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    chosen.push(best);
  }

  console.log(`\n=== floor${fi} ${f.name}  (${cands.length} candidates)`);
  console.log('    guards: [');
  for (const c of chosen) {
    console.log(`      { route: ${JSON.stringify(c.route)} },  // mean ${(c.mean*100).toFixed(0)}% min ${(c.min*100).toFixed(0)}%`);
  }
  console.log('    ],');
}
