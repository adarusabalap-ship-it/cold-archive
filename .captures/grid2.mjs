import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
const fi = Number(process.argv[2] || 1);
const y0 = Number(process.argv[3] || 0), y1 = Number(process.argv[4] || 25);
const floor = new Floor(FLOORS[fi]);
let hdr = '    ';
for (let x = 0; x < floor.cols; x += 1) hdr += (x % 10);
console.log(hdr);
for (let y = y0; y <= y1; y += 1) {
  let row = String(y).padStart(3, ' ') + ' ';
  for (let x = 0; x < floor.cols; x += 1) row += floor.at(x, y) === 1 ? '#' : '.';
  console.log(row);
}
