// The player: a body with a stance, a stamina bar for sprinting, and the noise it makes.
// Crouching shrinks the body and cuts the noise it makes, so the same corridor is safe at a
// crouch and fatal at a run. Sound carries through walls here on purpose: what a guard hears
// is a direction to walk to, not a sighting.

import { TILE, PLAYER, NOISE } from './config.js';

export class Player {
  constructor(floor) {
    this.reset(floor);
  }

  reset(floor) {
    this.x = floor.start.x;
    this.y = floor.start.y;
    this.vx = 0;
    this.vy = 0;
    this.stance = 'walk';
    this.radius = PLAYER.radius;
    this.stamina = 1;
    this.noiseTimer = 0;
    this.stepPhase = 0;
    this.bob = 0;
    this.caught = false;
    this.facing = -Math.PI / 2;
    this.throwCooldown = 0;
    this.carrying = false;
  }

  /** The body's radius follows the stance, which is what makes crouching worth its slowness. */
  setStance(stance) {
    if (this.stance === stance) return;
    this.stance = stance;
    this.radius = stance === 'crouch' ? PLAYER.crouchRadius : PLAYER.radius;
  }

  update(floor, dt, input) {
    const wantsSprint = input.sprint && this.stamina > 0.02 && (input.x !== 0 || input.y !== 0);
    const wantsCrouch = input.crouch && !wantsSprint;
    this.setStance(wantsSprint ? 'sprint' : wantsCrouch ? 'crouch' : 'walk');

    const speed = this.stance === 'sprint' ? PLAYER.sprint
      : this.stance === 'crouch' ? PLAYER.crouch
        : PLAYER.walk;

    // Normalise the input so diagonals are not faster than the axes.
    let ix = input.x;
    let iy = input.y;
    const len = Math.hypot(ix, iy);
    if (len > 0) { ix /= len; iy /= len; }

    const targetVx = ix * speed;
    const targetVy = iy * speed;
    const blend = Math.min(1, PLAYER.accel * dt);
    this.vx += (targetVx - this.vx) * blend;
    this.vy += (targetVy - this.vy) * blend;

    const moved = Math.hypot(this.vx, this.vy);
    if (moved > 4) this.facing = Math.atan2(this.vy, this.vx);

    const next = floor.resolve(this.x + this.vx * dt, this.y + this.vy * dt, this.radius);
    this.x = next.x;
    this.y = next.y;

    this.stepPhase += moved * dt * 0.06;
    this.bob = Math.sin(this.stepPhase * 6) * (this.stance === 'crouch' ? 0.4 : 1);

    // Stamina: sprinting drains, standing still or crouching refills.
    if (this.stance === 'sprint') this.stamina = Math.max(0, this.stamina - dt * 0.42);
    else this.stamina = Math.min(1, this.stamina + dt * (this.stance === 'crouch' ? 0.5 : 0.3));

    if (this.throwCooldown > 0) this.throwCooldown -= dt;

    return this.makeNoise(moved, dt);
  }

  /** The noise the guards may hear this frame, or null. */
  makeNoise(speed, dt) {
    if (speed < 8) { this.noiseTimer = 0; return null; }
    const interval = this.stance === 'sprint' ? NOISE.sprintEvery
      : this.stance === 'crouch' ? NOISE.walkEvery * 2.2
        : NOISE.walkEvery;
    this.noiseTimer += dt;
    if (this.noiseTimer < interval) return null;
    this.noiseTimer = 0;
    const strength = this.stance === 'sprint' ? NOISE.sprint
      : this.stance === 'crouch' ? NOISE.crouch
        : NOISE.walk;
    return { x: this.x, y: this.y, strength };
  }

  get visibility() {
    return this.stance === 'crouch' ? 0.58 : this.stance === 'sprint' ? 1.18 : 1;
  }
}

/** A thrown pebble: it flies to a point, then becomes a noise the guards investigate. */
export class Pebble {
  constructor(x, y, tx, ty) {
    this.x0 = x;
    this.y0 = y;
    this.tx = tx;
    this.ty = ty;
    this.t = 0;
    this.flight = Math.max(0.18, Math.hypot(tx - x, ty - y) / 620);
    this.x = x;
    this.y = y;
    this.landed = false;
    this.arc = 0;
  }

  update(dt) {
    if (this.landed) return null;
    this.t += dt;
    const k = Math.min(1, this.t / this.flight);
    this.x = this.x0 + (this.tx - this.x0) * k;
    this.y = this.y0 + (this.ty - this.y0) * k;
    this.arc = Math.sin(k * Math.PI) * 14;
    if (k >= 1) {
      this.landed = true;
      return { x: this.tx, y: this.ty, strength: TILE * 5.2 };
    }
    return null;
  }
}
