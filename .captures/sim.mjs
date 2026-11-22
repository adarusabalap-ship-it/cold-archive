// Score a guard route by simulating the patrol and measuring how much of the time its cone
// actually falls on floor. A route that hugs a wall scores badly here however tidy it looks on
// paper, because the guard spends its pauses sweeping brickwork.
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { Guard } from '../game/src/guards.js';
import { Player } from '../game/src/player.js';
import { TILE, GUARD } from '../game/src/config.js';

/** Fraction of cone rays that reach at least two tiles of floor. */
function coneQuality(floor, g) {
  let usable = 0;
  const RAYS = 16;
  for (let i = 0; i < RAYS; i += 1) {
    const a = g.angle - GUARD.coneHalfAngle + (GUARD.coneHalfAngle * 2 * i) / (RAYS - 1);
    let got = 0;
    for (let d = 12; d <= GUARD.coneRange; d += 4) {
      if (floor.blocksSight(Math.floor((g.x + Math.cos(a) * d) / TILE), Math.floor((g.y + Math.sin(a) * d) / TILE))) break;
      got = d;
    }
    if (got >= TILE * 2) usable += 1;
  }
  return usable / RAYS;
}

/** Simulate a route for `seconds` and return the mean cone quality. */
export function scoreRoute(floorDef, route, seconds = 26) {
  const floor = new Floor(floorDef);
  const player = new Player(floor);
  player.x = -9999; player.y = -9999;   // out of the way, so the guard just patrols
  const g = new Guard({ route }, 0);
  const dt = 1 / 60;
  let sum = 0, n = 0, minQ = 1;
  for (let t = 0; t < seconds; t += dt) {
    g.update(floor, player, dt, null);
    if (Math.floor(t * 60) % 6 === 0) {
      const q = coneQuality(floor, g);
      sum += q; n += 1; minQ = Math.min(minQ, q);
    }
  }
  return { mean: sum / n, min: minQ };
}

if (process.argv[1] && process.argv[1].endsWith('sim.mjs')) {
  for (let fi = 0; fi < FLOORS.length; fi += 1) {
    console.log(`\nfloor${fi} ${FLOORS[fi].name}`);
    FLOORS[fi].guards.forEach((g, gi) => {
      const s = scoreRoute(FLOORS[fi], g.route);
      console.log(`  guard${gi} ${JSON.stringify(g.route)}  mean=${(s.mean*100).toFixed(0)}% min=${(s.min*100).toFixed(0)}%`);
    });
  }
}
