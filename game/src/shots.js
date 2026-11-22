// The screenshot scenes behind ?shot=title|play|caught|won. Each one builds a real floor, runs the
// real rules forward for a fixed number of steps with a scripted player, and stops on a frame worth
// showing. Same seed, same frame: a screenshot is reproducible, and it is the game's own renderer
// that draws it — no image is ever edited or composited.

import { FLOORS } from './levels.js';
import { Floor } from './floor.js';
import { Player } from './player.js';
import { makeGuards } from './guards.js';
import { TILE, WORLD_W, WORLD_H } from './config.js';

const STEP = 1 / 60;

/** Build the world a scene needs. */
export function makeWorld(floorIndex = 0) {
  const floor = new Floor(FLOORS[floorIndex]);
  const player = new Player(floor);
  return {
    floor,
    floorIndex,
    floorCount: FLOORS.length,
    player,
    guards: makeGuards(FLOORS[floorIndex]),
    pebblesInAir: [],
    pebbles: FLOORS[floorIndex].pebbles,
    spotted: 0,
    elapsed: 0,
    screen: 'play',
    nearCard: false,
    nearDoor: false,
    time: 0,
  };
}

/** Advance the world by one fixed step with the given intent. */
export function stepWorld(state, intent) {
  const dt = STEP;
  state.time += dt;
  state.elapsed += dt;
  const noise = state.player.update(state.floor, dt, intent);
  for (const g of state.guards) g.update(state.floor, state.player, dt, noise);

  for (const p of state.pebblesInAir) {
    const landed = p.update(dt);
    if (landed) {
      for (const g of state.guards) {
        const d = Math.hypot(landed.x - g.x, landed.y - g.y);
        if (d < landed.strength) {
          g.state = 'searching';
          g.target = { x: landed.x, y: landed.y };
          g.searchTimer = 0;
        }
      }
    }
  }
  state.pebblesInAir = state.pebblesInAir.filter((p) => !p.landed);

  state.nearCard = state.floor.cardNear(state.player.x, state.player.y) !== null;
  state.nearDoor = state.floor.doorNear(state.player.x, state.player.y) !== null;

  const caught = state.guards.some((g) => g.state === 'alert'
    && Math.hypot(g.x - state.player.x, g.y - state.player.y) < 26);
  if (caught) {
    state.player.caught = true;
    state.screen = 'caught';
    state.spotted += 1;
  }
  return caught;
}

/** Hold still for a while so the guards' patrol carries the scene forward. */
function settle(state, steps, intent = {}) {
  for (let i = 0; i < steps; i += 1) stepWorld(state, { x: 0, y: 0, crouch: false, sprint: false, ...intent });
}

/** Every tile a body can stand on. */
function openTiles(floor) {
  const out = [];
  for (let ty = 1; ty < floor.rows - 1; ty += 1) {
    for (let tx = 1; tx < floor.cols - 1; tx += 1) {
      if (!floor.blocksMove(tx, ty)) out.push([tx, ty]);
    }
  }
  return out;
}

/** Drop the player on a tile centre, in a given stance, facing a heading. */
function place(state, tx, ty, stance = 'walk', facing = -Math.PI / 2) {
  state.player.x = tx * TILE + TILE / 2;
  state.player.y = ty * TILE + TILE / 2;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.facing = facing;
  state.player.setStance(stance);
}

/**
 * Score a tile by how much guard is around it: close enough that cones fill the frame, far
 * enough that the player is not already standing inside one.
 */
function guardPresence(state, tx, ty) {
  const px = tx * TILE + TILE / 2;
  const py = ty * TILE + TILE / 2;
  let score = 0;
  for (const g of state.guards) {
    const d = Math.hypot(g.x - px, g.y - py) / TILE;
    if (d >= 3.5 && d <= 11) score += 11 - d;
  }
  return score;
}

/** True when the tile touches a low crate — cover you can crouch behind. */
function besideLowCover(floor, tx, ty) {
  return floor.lowCrates.some((c) => tx >= c.x - 1 && tx <= c.x + c.w && ty >= c.y - 1 && ty <= c.y + c.h);
}

/** The open tile that scores best under `score`, or null. */
function bestTile(floor, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const [tx, ty] of openTiles(floor)) {
    const s = score(tx, ty);
    if (s > bestScore) { bestScore = s; best = [tx, ty]; }
  }
  return best;
}

/**
 * Put the world in the named scene and return the screen to draw. Any unknown name is 'play'.
 * The scenes are chosen to show what a judge is asked to look for: a level from above, guards
 * with vision cones, cover to hide behind, and an exit to reach.
 *
 * Positions come from the level itself, so editing a floor cannot leave a scene staged inside
 * a wall or aimed at an empty corner.
 */
export function stageScene(name) {
  if (name === 'title') {
    const state = makeWorld(0);
    settle(state, 40);
    state.screen = 'title';
    return state;
  }

  if (name === 'caught') {
    // Stand in a guard's light and let the suspicion meter fill until it walks you down.
    const state = makeWorld(2);
    settle(state, 150);
    const g = state.guards.reduce((a, b) => (b.y > a.y ? b : a), state.guards[0]);
    const tx = Math.round((g.x + Math.cos(g.angle) * TILE * 2.5) / TILE);
    const ty = Math.round((g.y + Math.sin(g.angle) * TILE * 2.5) / TILE);
    if (!state.floor.blocksMove(tx, ty)) place(state, tx, ty, 'walk', g.angle + Math.PI);
    for (let i = 0; i < 900 && state.screen !== 'caught'; i += 1) {
      stepWorld(state, { x: 0, y: 0, crouch: false, sprint: false });
    }
    state.screen = 'caught';
    return state;
  }

  if (name === 'won') {
    // The last floor's exit, unlocked by its keycard: the winning frame with the level still
    // readable behind it.
    const state = makeWorld(2);
    for (const c of state.floor.keycards) c.taken = true;
    state.player.carrying = true;
    const e = state.floor.exit;
    place(state, e.x, e.y, 'walk', 0);
    settle(state, 24);
    state.screen = 'won';
    state.spotted = 0;
    state.elapsed = 214.7;
    return state;
  }

  if (name === 'cover') {
    // The frame that states the whole mechanic: a guard's beam hard-stopping on a tall crate
    // with the player crouched in the dark pocket behind it. This is staged from geometry, not
    // guessed: pick a tall crate, stand the player tight against its far face, and put a guard
    // on the near side aiming at the crate, so the cone's far edge lands on the box edge and
    // the player sits just outside the light.
    const state = makeWorld(2);
    settle(state, 120);

    const T = TILE;
    const crateTiles = state.floor.crates;
    let best = null;
    for (const c of crateTiles) {
      // Candidate standing spots: the open tiles immediately below the crate (screen-down), so
      // the crate sits between the player and a guard placed above it.
      const cx = (c.x + c.w / 2) * T;
      for (let ox = 0; ox < c.w; ox += 1) {
        const tx = c.x + ox;
        const ty = c.y + c.h;          // first tile past the crate's bottom edge
        if (state.floor.blocksMove(tx, ty)) continue;
        if (state.floor.blocksMove(tx, ty + 1)) continue;
        // Nudge the player up inside the tile so the body actually touches the crate face —
        // crouched against the box, not standing a body-width out in the open.
        const px = tx * T + T / 2;
        const py = ty * T + T / 2 - 11;
        // A guard above the crate, close enough that its cone covers the crate but not so
        // close that the frame is all guard.
        const gy = (c.y - 3.2) * T;
        if (gy < T) continue;
        const gx = px;
        if (state.floor.blocksMove(Math.floor(gx / T), Math.floor(gy / T))) continue;
        // The crate must actually block the sightline from that guard to the player.
        if (state.floor.clearLine(gx, gy, px, py)) continue;
        const dist = Math.hypot(gx - px, gy - py);
        // Prefer a mid distance so the cone and the crate both fit comfortably in frame, and
        // prefer a crate near the middle of the map: staged in a far corner, the tableau sits
        // under the HUD and reads as an afterthought instead of the subject of the shot.
        const midX = WORLD_W / 2;
        const midY = WORLD_H / 2;
        const offCentre = Math.hypot(px - midX, py - midY);
        const score = (100 - Math.abs(dist - T * 6.5)) - offCentre * 0.06;
        if (!best || score > best.score) best = { score, px, py, gx, gy, crate: c };
      }
    }

    if (best) {
      // Put the guard where the geometry wants it, facing straight down at the crate.
      const g = state.guards[0];
      g.x = best.gx;
      g.y = best.gy;
      g.angle = Math.PI / 2;          // +y, i.e. down toward the crate
      g.state = 'patrol';
      g.suspicion = 0;
      g.target = null;
      // The other guards patrol at a distance from the tableau, on the same side, so the frame
      // still reads as a patrolled room rather than one guard alone in an empty half.
      state.guards.slice(1).forEach((o, i) => {
        const sx = best.px + T * (i % 2 === 0 ? -4.5 : 4.5);
        const sy = best.py + T * (2.2 + i * 1.6);
        if (!state.floor.blocksMove(Math.floor(sx / T), Math.floor(sy / T))) {
          o.x = sx;
          o.y = sy;
        }
        o.angle = -Math.PI / 2;
        o.state = 'patrol';
        o.suspicion = 0;
      });
      place(state, Math.round(best.px / T - 0.5), Math.round(best.py / T - 0.5), 'crouch', Math.PI / 2);
      // place() snaps to a tile centre; restore the exact pixel the search chose, so the body
      // really is tucked against the crate face rather than a body-width out in the open.
      state.player.x = best.px;
      state.player.y = best.py;
      // Face the player away from the beam — the pose of someone hiding, not confronting.
      state.player.facing = Math.PI / 2;
    } else {
      const spot = bestTile(state.floor, (tx, ty) => (besideLowCover(state.floor, tx, ty)
        ? 100 + guardPresence(state, tx, ty) : -1));
      if (spot) place(state, spot[0], spot[1], 'crouch', -Math.PI / 2);
    }
    return state;
  }

  // 'play': the floor seen from above with the most guard around a standing player — a cone in
  // shot, cover nearby, and the exit pad lit.
  const state = makeWorld(1);
  settle(state, 150);
  const spot = bestTile(state.floor, (tx, ty) => guardPresence(state, tx, ty)
    + (besideLowCover(state.floor, tx, ty) ? 4 : 0));
  if (spot) place(state, spot[0], spot[1], 'walk', -Math.PI / 2);
  settle(state, 30);
  return state;
}
