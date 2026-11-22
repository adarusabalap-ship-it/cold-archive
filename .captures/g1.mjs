import { stageScene } from '../game/src/shots.js';
import { TILE } from '../game/src/config.js';
const s = stageScene('play');
console.log('floor', s.floorIndex, s.floor.name);
for (const g of s.guards) {
  const tx = Math.floor(g.x / TILE), ty = Math.floor(g.y / TILE);
  console.log(`g${g.index} px(${g.x.toFixed(0)},${g.y.toFixed(0)}) tile(${tx},${ty}) solidHere=${s.floor.blocksSight(tx, ty)} angle=${(g.angle*180/Math.PI).toFixed(0)} waypoint=${g.waypoint} pause=${g.pauseTimer.toFixed(2)}`);
}
console.log('route:', JSON.stringify(s.guards[1].route.map(p=>[p.x/TILE,p.y/TILE])));
