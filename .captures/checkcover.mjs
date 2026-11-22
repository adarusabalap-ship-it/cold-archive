import { stageScene } from '../game/src/shots.js';
import { TILE } from '../game/src/config.js';
const s = stageScene('cover');
const p = s.player;
const pt = [Math.floor(p.x/TILE), Math.floor(p.y/TILE)];
console.log('player px', p.x.toFixed(1), p.y.toFixed(1), 'tile', pt);
for (const g of s.guards) {
  console.log(' guard', g.x.toFixed(1), g.y.toFixed(1), 'ang', (g.angle*180/Math.PI).toFixed(0), 'state', g.state);
}
// Is the player adjacent to / inside a crate tile?
const crates = s.floor.crates;
const inside = crates.find(c => pt[0]>=c.x && pt[0]<c.x+c.w && pt[1]>=c.y && pt[1]<c.y+c.h);
console.log('player inside crate tile?', !!inside);
const near = crates.map(c=>({c, d: Math.hypot((c.x+c.w/2)*TILE-p.x,(c.y+c.h/2)*TILE-p.y)})).sort((a,b)=>a.d-b.d)[0];
console.log('nearest crate centre dist', near.d.toFixed(1), 'px (crate half-height', (near.c.h*TILE/2).toFixed(1)+')');
const g0 = s.guards[0];
console.log('clearLine guard0->player:', s.floor.clearLine(g0.x,g0.y,p.x,p.y), '(false = blocked by cover = GOOD)');
