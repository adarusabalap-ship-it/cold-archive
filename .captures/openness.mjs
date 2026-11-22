// A guard whose patrol hugs a wall spends half its sweep staring at brickwork. Check that each
// corner of each route can see real floor in at least half the compass directions.
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
const open = (floor, x, y) => x >= 0 && y >= 0 && x < floor.cols && y < floor.rows && !floor.blocksSight(x, y);
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
let bad = 0;
for (let fi = 0; fi < FLOORS.length; fi += 1) {
  const floor = new Floor(FLOORS[fi]);
  FLOORS[fi].guards.forEach((g, gi) => {
    const scores = g.route.map(([x, y]) => openness(floor, x, y));
    const worst = Math.min(...scores);
    if (worst < 4) { console.log(`floor${fi} guard${gi}: corners ${JSON.stringify(scores)} — too walled in`); bad += 1; }
  });
}
console.log(bad === 0 ? 'ALL ROUTES HAVE ROOM TO SEE' : `${bad} wall-hugging route(s)`);
