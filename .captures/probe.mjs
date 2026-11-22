import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { makeGuards } from '../game/src/guards.js';
import { TILE, GUARD } from '../game/src/config.js';

for (let fi = 0; fi < FLOORS.length; fi += 1) {
  const floor = new Floor(FLOORS[fi]);
  const guards = makeGuards(FLOORS[fi]);
  console.log(`--- floor ${fi} ${FLOORS[fi].name}`);
  for (const g of guards) {
    const tx = Math.floor(g.x / TILE), ty = Math.floor(g.y / TILE);
    const ownSolid = floor.blocksSight(tx, ty);
    // how many of 24 sample rays are immediately blocked?
    let blocked = 0, total = 24;
    for (let i = 0; i < total; i += 1) {
      const a = g.angle - GUARD.coneHalfAngle + (GUARD.coneHalfAngle * 2 * i) / (total - 1);
      let hit = false;
      for (let d = 10; d <= GUARD.coneRange; d += 3) {
        if (floor.blocksSight(Math.floor((g.x + Math.cos(a) * d) / TILE), Math.floor((g.y + Math.sin(a) * d) / TILE))) { hit = true; break; }
      }
      if (hit) blocked += 1;
    }
    console.log(`  guard${g.index} tile(${tx},${ty}) pos(${g.x.toFixed(0)},${g.y.toFixed(0)}) ownTileSolid=${ownSolid} raysBlocked=${blocked}/${total} angle=${g.angle.toFixed(2)}`);
  }
}
