import { stageScene } from '../game/src/shots.js';
import { TILE, GUARD, VIEW_W, VIEW_H } from '../game/src/config.js';
for (const name of ['play','cover','caught','won']) {
  const s = stageScene(name);
  const e = s.floor.exit;
  const ex = { x: e.x * TILE, y: e.y * TILE, w: e.w * TILE, h: e.h * TILE };
  console.log(`\n[${name}] screen=${s.screen} floor=${s.floorIndex} spotted=${s.spotted} cards=${s.floor.allCardsTaken}`);
  console.log(`  exit px x${ex.x}-${ex.x+ex.w} y${ex.y}-${ex.y+ex.h}`);
  for (const g of s.guards) {
    console.log(`  guard${g.index} (${g.x.toFixed(0)},${g.y.toFixed(0)}) angle=${(g.angle*180/Math.PI).toFixed(0)}deg state=${g.state}`);
  }
}
