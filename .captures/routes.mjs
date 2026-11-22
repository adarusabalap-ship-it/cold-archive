// Guard routes must be walkable end to end: a waypoint pair whose straight walk is blocked
// leaves a guard grinding against a crate with its flashlight aimed at the box.
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { TILE } from '../game/src/config.js';

function walkable(floor, from, to) {
  const seen = new Set([from.join(',')]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === to[0] && y === to[1]) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= floor.cols || ny >= floor.rows) continue;
      if (floor.blocksSight(nx, ny)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return false;
}

let bad = 0;
for (let fi = 0; fi < FLOORS.length; fi += 1) {
  const floor = new Floor(FLOORS[fi]);
  FLOORS[fi].guards.forEach((g, gi) => {
    for (let i = 0; i < g.route.length; i += 1) {
      const a = g.route[i];
      const b = g.route[(i + 1) % g.route.length];
      if (!walkable(floor, a, b)) {
        console.log(`floor${fi} guard${gi}: ${a} -> ${b} BLOCKED`);
        bad += 1;
      }
    }
  });
}
console.log(bad === 0 ? 'ALL ROUTES WALKABLE' : `${bad} blocked leg(s)`);
