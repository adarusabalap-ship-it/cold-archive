// The floor: solid geometry, collision, line of sight, shadow, doors, pickups and the exit.
// Everything is tile-addressed, so a level is a list of rectangles in tile units and a body
// is a circle in pixels. Sight is blocked by tall things only, which is why a low crate stops
// your body and not a flashlight beam.

import { TILE, PLAYER, VISIBILITY } from './config.js';

export const EMPTY = 0;
export const SOLID = 1;
export const LOW = 2;

/** A tiny deterministic generator: decoration must look the same in every run and every screenshot. */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export class Floor {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.brief = def.brief;
    this.theme = def.theme;
    this.cols = 44;
    this.rows = 26;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.shadow = new Float32Array(this.cols * this.rows);
    this.decor = [];
    this.crates = [];
    this.lowCrates = [];
    this.racks = [];
    this.desks = [];

    for (const [x, y, w, h] of def.walls) this.fill(x, y, w, h, SOLID);
    for (const [x, y, w, h] of def.racks) { this.fill(x, y, w, h, SOLID); this.racks.push({ x, y, w, h }); }
    for (const [x, y, w, h] of def.crates) { this.fill(x, y, w, h, SOLID); this.crates.push({ x, y, w, h }); }
    for (const [x, y, w, h] of def.lowCrates) { this.fill(x, y, w, h, LOW); this.lowCrates.push({ x, y, w, h }); }
    for (const [x, y, w, h] of def.desks) { this.fill(x, y, w, h, LOW); this.desks.push({ x, y, w, h }); }

    // Doors are holes in the wall that only a keycard opens.
    this.doors = def.doors.map((d) => ({ ...d, open: false }));

    this.exit = def.exit;
    this.start = { x: def.start[0] * TILE + TILE / 2, y: def.start[1] * TILE + TILE / 2 };

    this.keycards = def.keycards.map(([x, y], i) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false, id: i }));

    this.buildShadow();
    this.buildDecor();
  }

  fill(x, y, w, h, kind) {
    for (let j = y; j < y + h; j += 1) {
      for (let i = x; i < x + w; i += 1) {
        if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) continue;
        this.grid[j * this.cols + i] = kind;
      }
    }
  }

  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return SOLID;
    return this.grid[ty * this.cols + tx];
  }

  doorAt(tx, ty) {
    for (const d of this.doors) {
      if (d.open) continue;
      if (tx >= d.x && tx < d.x + d.w && ty >= d.y && ty < d.y + d.h) return d;
    }
    return null;
  }

  /** Blocks a body: walls, crates, shelves, desks and a shut door. */
  blocksMove(tx, ty) {
    if (this.at(tx, ty) !== EMPTY) return true;
    return this.doorAt(tx, ty) !== null;
  }

  /** Blocks sight: walls, crates and shelves, but never a low crate or a desk. */
  blocksSight(tx, ty) {
    return this.at(tx, ty) === SOLID;
  }

  /**
   * Shadow near shelving and crates: standing in it halves how visible you are. It is what makes
   * crouching behind a rack a real hiding place rather than only a way to break the cone.
   */
  buildShadow() {
    const casters = [...this.racks, ...this.lowCrates, ...this.crates];
    for (let ty = 0; ty < this.rows; ty += 1) {
      for (let tx = 0; tx < this.cols; tx += 1) {
        if (this.at(tx, ty) !== EMPTY) continue;
        let shade = 0;
        for (const c of casters) {
          const cx = c.x + c.w / 2;
          const cy = c.y + c.h / 2;
          const dx = tx + 0.5 - cx;
          const dy = ty + 0.5 - cy;
          const d = Math.hypot(dx, dy) - Math.max(c.w, c.h) / 2;
          if (d < 2.3) shade = Math.max(shade, 1 - Math.max(0, d) / 2.3);
        }
        this.shadow[ty * this.cols + tx] = shade;
      }
    }
  }

  buildDecor() {
    const rand = seeded(0x9e3779b9 ^ (this.theme + 1) * 7919);
    for (let ty = 0; ty < this.rows; ty += 1) {
      for (let tx = 0; tx < this.cols; tx += 1) {
        if (this.at(tx, ty) !== EMPTY) continue;
        if (rand() > 0.055) continue;
        this.decor.push({
          x: tx * TILE + 4 + rand() * (TILE - 8),
          y: ty * TILE + 4 + rand() * (TILE - 8),
          kind: rand() < 0.55 ? 'scuff' : 'paper',
          rot: rand() * Math.PI,
          size: 3 + rand() * 5,
        });
      }
    }
  }

  /** 0 = pitch dark, 1 = fully lit. Drives how fast a guard becomes sure of you. */
  shadeAt(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return 0;
    return this.shadow[ty * this.cols + tx];
  }

  /** Bresenham over tiles: true when nothing tall stands between two points. */
  clearLine(x0, y0, x1, y1) {
    let tx = Math.floor(x0 / TILE);
    let ty = Math.floor(y0 / TILE);
    const tx1 = Math.floor(x1 / TILE);
    const ty1 = Math.floor(y1 / TILE);
    const dx = Math.abs(tx1 - tx);
    const dy = Math.abs(ty1 - ty);
    const sx = tx < tx1 ? 1 : -1;
    const sy = ty < ty1 ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 512; guard += 1) {
      if (tx === tx1 && ty === ty1) return true;
      if (this.blocksSight(tx, ty) && !(tx === Math.floor(x0 / TILE) && ty === Math.floor(y0 / TILE))) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; tx += sx; }
      if (e2 < dx) { err += dx; ty += sy; }
    }
    return false;
  }

  /** Push a circle out of the solid tiles it overlaps, one axis at a time. */
  resolve(cx, cy, radius) {
    let x = cx;
    let y = cy;
    const minX = Math.floor((x - radius) / TILE);
    const maxX = Math.floor((x + radius) / TILE);
    const minY = Math.floor((y - radius) / TILE);
    const maxY = Math.floor((y + radius) / TILE);
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        if (!this.blocksMove(tx, ty)) continue;
        const left = tx * TILE;
        const top = ty * TILE;
        const nx = Math.max(left, Math.min(x, left + TILE));
        const ny = Math.max(top, Math.min(y, top + TILE));
        const ddx = x - nx;
        const ddy = y - ny;
        const d = Math.hypot(ddx, ddy);
        if (d >= radius) continue;
        if (d > 0.0001) {
          x += (ddx / d) * (radius - d);
          y += (ddy / d) * (radius - d);
        } else {
          const ox = Math.min(Math.abs(x - left), Math.abs(left + TILE - x));
          const oy = Math.min(Math.abs(y - top), Math.abs(top + TILE - y));
          if (ox < oy) x += x < left + TILE / 2 ? -(ox + radius) : ox + radius;
          else y += y < top + TILE / 2 ? -(oy + radius) : oy + radius;
        }
      }
    }
    return { x, y };
  }

  /** How much of you the light catches, from stance and from the shadow you stand in. */
  visibility(x, y, stance) {
    const base = stance === 'crouch' ? VISIBILITY.crouching
      : stance === 'sprint' ? VISIBILITY.sprinting
        : VISIBILITY.standing;
    const shade = this.shadeAt(x, y);
    const lit = VISIBILITY.litFloor - (VISIBILITY.litFloor - VISIBILITY.inShadow) * shade;
    return base * lit;
  }

  /**
   * The exit is a doorway you can only walk through holding the keycard: it is the floor's
   * objective, not a spot you can stumble onto. Standing in it without the card does nothing.
   */
  inExit(x, y) {
    const e = this.exit;
    if (!this.allCardsTaken) return false;
    return x >= e.x * TILE && x < (e.x + e.w) * TILE && y >= e.y * TILE && y < (e.y + e.h) * TILE;
  }

  /** True when the point is inside the exit pad, whatever the player is carrying. */
  onExitPad(x, y) {
    const e = this.exit;
    return x >= e.x * TILE && x < (e.x + e.w) * TILE && y >= e.y * TILE && y < (e.y + e.h) * TILE;
  }

  /** The keycard within reach, if any. */
  cardNear(x, y) {
    for (const c of this.keycards) {
      if (c.taken) continue;
      if (Math.hypot(c.x - x, c.y - y) < TILE * 1.4) return c;
    }
    return null;
  }

  /** The shut door within reach, if any. */
  doorNear(x, y) {
    for (const d of this.doors) {
      if (d.open) continue;
      const cx = (d.x + d.w / 2) * TILE;
      const cy = (d.y + d.h / 2) * TILE;
      if (Math.hypot(cx - x, cy - y) < TILE * 1.6) return d;
    }
    return null;
  }

  get allCardsTaken() {
    return this.keycards.every((c) => c.taken);
  }
}

export const STANCE_RADIUS = (stance) => (stance === 'crouch' ? PLAYER.crouchRadius : PLAYER.radius);
