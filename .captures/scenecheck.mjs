import { stageScene } from '../game/src/shots.js';
import { TILE, GUARD } from '../game/src/config.js';

for (const name of ['play', 'cover', 'caught', 'won']) {
  const s = stageScene(name);
  console.log(`\n[${name}] screen=${s.screen} floor=${s.floorIndex} spotted=${s.spotted} cards=${s.floor.allCardsTaken} player=(${s.player.x.toFixed(0)},${s.player.y.toFixed(0)}) stance=${s.player.stance}`);
  for (const g of s.guards) {
    let usable = 0, maxReach = 0;
    const RAYS = 24;
    for (let i = 0; i < RAYS; i += 1) {
      const a = g.angle - GUARD.coneHalfAngle + (GUARD.coneHalfAngle * 2 * i) / (RAYS - 1);
      let got = 0;
      for (let d = 12; d <= GUARD.coneRange; d += 3) {
        if (s.floor.blocksSight(Math.floor((g.x + Math.cos(a) * d) / TILE), Math.floor((g.y + Math.sin(a) * d) / TILE))) break;
        got = d;
      }
      if (got >= TILE * 2) usable += 1;
      maxReach = Math.max(maxReach, got);
    }
    const dPlayer = Math.hypot(g.x - s.player.x, g.y - s.player.y) / TILE;
    console.log(`  g${g.index} usable=${usable}/${RAYS} reach=${(maxReach/TILE).toFixed(1)}t state=${g.state} distToPlayer=${dPlayer.toFixed(1)}t`);
  }
}
