// Structural checks on every floor. These are the invariants that make the game playable:
// the exit is reachable from the start, the keycard is on the way and gates the exit, every
// guard's patrol is a set of straight walkable legs, every cone reaches real floor, and no
// exit pad or keycard hides under a HUD panel.
import { FLOORS } from '../game/src/levels.js';
import { Floor } from '../game/src/floor.js';
import { TILE, GUARD, WORLD_W, WORLD_H } from '../game/src/config.js';
import { makeGuards } from '../game/src/guards.js';

// The top-left panel grows with the wrapped objective (40px header + 15px a line), so measure
// it the same way the HUD does: a 12px monospace glyph is about 7.2px wide.
const CHAR_W = 7.2;
function briefPanelHeight(brief) {
  const perLine = Math.floor((372 - 28) / CHAR_W);
  const lines = Math.ceil(brief.length / perLine);
  return 40 + Math.min(lines, 3) * 15;
}
const HUD = [
  { x: 18, y: 18, w: 372, h: briefPanelHeight(FLOORS[0].brief) },
  { x: WORLD_W - 18 - 250, y: 18, w: 250, h: 66 },
  { x: 18, y: WORLD_H - 18 - 46, w: 268, h: 46 },
  { x: WORLD_W - 18 - 268, y: WORLD_H - 18 - 46, w: 268, h: 46 },
];
const hitsHud = (x, y, w, h) => HUD.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);

function straightClear(floor, a, b) {
  let x0 = a[0], y0 = a[1];
  const x1 = b[0], y1 = b[1];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (floor.blocksSight(x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function reachableTiles(floor, from) {
  const seen = new Set([from.join(',')]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= floor.cols || ny >= floor.rows) continue;
      if (floor.blocksSight(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

let bad = 0;
const fail = (m) => { console.log('   -', m); bad += 1; };

for (let fi = 0; fi < FLOORS.length; fi += 1) {
  const f = FLOORS[fi];
  const floor = new Floor(f);
  const guards = makeGuards(f);
  HUD[0].h = briefPanelHeight(f.brief);
  const reach = reachableTiles(floor, f.start);
  const before = bad;

  console.log(`\nfloor ${fi} "${f.name}"`);
  if (floor.blocksSight(f.start[0], f.start[1])) fail('start tile is solid');

  // exit: 2x2 open, reachable, clear of the HUD
  for (let dy = 0; dy < f.exit.h; dy += 1) {
    for (let dx = 0; dx < f.exit.w; dx += 1) {
      const tx = f.exit.x + dx, ty = f.exit.y + dy;
      if (floor.blocksSight(tx, ty)) fail(`exit tile (${tx},${ty}) is solid`);
      if (!reach.has(`${tx},${ty}`)) fail(`exit tile (${tx},${ty}) unreachable from start`);
    }
  }
  if (hitsHud(f.exit.x * TILE, f.exit.y * TILE, f.exit.w * TILE, f.exit.h * TILE)) fail('exit pad sits under a HUD panel');

  // keycards: on reachable open floor, off the exit pad, clear of the HUD
  if (f.keycards.length === 0) fail('floor has no keycard');
  for (const [kx, ky] of f.keycards) {
    if (floor.blocksSight(kx, ky)) fail(`keycard (${kx},${ky}) is inside a wall`);
    if (!reach.has(`${kx},${ky}`)) fail(`keycard (${kx},${ky}) unreachable from start`);
    if (kx >= f.exit.x && kx < f.exit.x + f.exit.w && ky >= f.exit.y && ky < f.exit.y + f.exit.h) fail('keycard is inside the exit pad');
    if (hitsHud(kx * TILE, ky * TILE, TILE, TILE)) fail(`keycard (${kx},${ky}) sits under a HUD panel`);
  }

  // guards: on open floor, every leg a clear straight walk, cone reaches real floor
  for (const g of guards) {
    const gt = [Math.floor(g.x / TILE), Math.floor(g.y / TILE)];
    if (floor.blocksSight(gt[0], gt[1])) fail(`guard${g.index} stands inside a wall`);
    const r = f.guards[g.index].route;
    for (let i = 0; i < r.length; i += 1) {
      const a = r[i], b = r[(i + 1) % r.length];
      if (!straightClear(floor, a, b)) fail(`guard${g.index} cannot walk straight ${a} -> ${b}`);
    }
    let usable = 0;
    const RAYS = 24;
    for (let i = 0; i < RAYS; i += 1) {
      const ang = g.angle - GUARD.coneHalfAngle + (GUARD.coneHalfAngle * 2 * i) / (RAYS - 1);
      let got = 0;
      for (let d = 12; d <= GUARD.coneRange; d += 3) {
        if (floor.blocksSight(Math.floor((g.x + Math.cos(ang) * d) / TILE), Math.floor((g.y + Math.sin(ang) * d) / TILE))) break;
        got = d;
      }
      if (got >= TILE * 2) usable += 1;
    }
    if (usable < RAYS * 0.5) fail(`guard${g.index} cone is blind (${usable}/${RAYS})`);
  }

  // the exit must actually be gated: standing on it without the card must not win
  if (floor.inExit((f.exit.x + 0.5) * TILE, (f.exit.y + 0.5) * TILE)) fail('exit is not gated by the keycard');

  console.log(bad === before ? '   ok' : '');
}
console.log(bad === 0 ? '\nALL FLOORS VALID' : `\n${bad} PROBLEM(S)`);
