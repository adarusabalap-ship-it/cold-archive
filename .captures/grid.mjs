import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
const floor = new Floor(FLOORS[2]);
let hdr = '    ';
for (let x = 0; x < floor.cols; x += 1) hdr += (x % 10);
console.log(hdr);
for (let y = 12; y <= 21; y += 1) {
  let row = String(y).padStart(3, ' ') + ' ';
  for (let x = 0; x < floor.cols; x += 1) row += floor.at(x, y) === 1 ? '#' : '.';
  console.log(row);
}
console.log('\nguard2 at tile (8,15). exit tile of floor:', JSON.stringify(FLOORS[2].exit), 'keycard', JSON.stringify(FLOORS[2].keycards));
