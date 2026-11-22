// The guards. Each one walks a route of tile centres, sweeping its flashlight as it goes, and
// decides what it can see through three tests in order: is the target inside the cone's angle,
// is it within range, and does the floor block the line between us. Seeing a shape fills a
// suspicion meter; a full meter turns into an alert, and an alert guard walks to where it last
// saw you. A thrown pebble is not seen at all — it is heard, so a guard goes to the noise and
// stands there, which is the one way to move a flashlight off a doorway without being spotted.

import { TILE, GUARD } from './config.js';

export const CALM = 'calm';
export const SUSPICIOUS = 'suspicious';
export const ALERT = 'alert';
export const SEARCHING = 'searching';

const TWO_PI = Math.PI * 2;

/** Shortest signed difference between two angles, in (-pi, pi]. */
function angleDelta(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

export class Guard {
  constructor(def, index) {
    this.index = index;
    this.route = def.route.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }));
    this.leg = 0;
    this.waypoint = 1 % this.route.length;
    this.x = this.route[0].x;
    this.y = this.route[0].y;
    this.angle = 0;
    this.state = CALM;
    this.suspicion = 0;
    this.alertTimer = 0;
    this.pauseTimer = 0;
    this.sweepPhase = index * 1.7;
    this.target = null;
    this.searchTimer = 0;
    this.lastSeen = null;
    this.stepPhase = 0;
    this.seesPlayer = false;
    this.coneTint = 0;
  }

  get facing() { return this.angle; }

  /** True when a point is inside the cone, in range and not behind anything tall. */
  canSee(floor, px, py, radius) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    const reach = GUARD.coneRange;
    if (dist > reach) return false;
    if (dist < 1) return true;
    const toTarget = Math.atan2(dy, dx);
    const spread = GUARD.coneHalfAngle + Math.atan2(radius, Math.max(dist, 1));
    if (Math.abs(angleDelta(toTarget, this.angle)) > spread) return false;
    return floor.clearLine(this.x, this.y, px, py);
  }

  /** Turn toward a heading at a fixed rate, so a guard never snaps around. */
  turnToward(wanted, dt, rate = GUARD.turnSpeed) {
    const d = angleDelta(wanted, this.angle);
    const step = rate * dt;
    if (Math.abs(d) <= step) this.angle = wanted;
    else this.angle += Math.sign(d) * step;
    this.angle = ((this.angle % TWO_PI) + TWO_PI) % TWO_PI;
  }

  /** Walk to a point, stopping when close enough; returns true when it has arrived. */
  moveToward(floor, tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return true;
    const step = Math.min(speed * dt, dist);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    const fixed = floor.resolve(nx, ny, GUARD.radius);
    this.x = fixed.x;
    this.y = fixed.y;
    this.stepPhase += step * 0.09;
    return dist - step < 2;
  }

  /** Follow the route: walk to the next waypoint, then pause and sweep the light. */
  patrol(floor, dt) {
    const wp = this.route[this.waypoint];
    const wanted = Math.atan2(wp.y - this.y, wp.x - this.x);
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      this.sweepPhase += dt * 1.9;
      const sweep = Math.sin(this.sweepPhase) * GUARD.sweepAmplitude;
      this.turnToward(this.baseAngle + sweep, dt, GUARD.turnSpeed * 1.3);
      return;
    }
    this.turnToward(wanted, dt);
    const arrived = this.moveToward(floor, wp.x, wp.y, GUARD.patrolSpeed, dt);
    if (arrived) {
      this.leg += 1;
      this.waypoint = (this.waypoint + 1) % this.route.length;
      this.pauseTimer = GUARD.pauseSeconds;
      this.baseAngle = this.angle;
      this.sweepPhase = 0;
    }
  }

  /** Go to a point of interest and stand there sweeping, until the timer runs out. */
  investigate(floor, dt) {
    const t = this.target;
    if (!t) { this.state = CALM; return; }
    const arrived = this.moveToward(floor, t.x, t.y, GUARD.searchSpeed, dt);
    this.turnToward(Math.atan2(t.y - this.y, t.x - this.x), dt);
    if (arrived) {
      this.searchTimer += dt;
      this.sweepPhase += dt * 2.4;
      this.baseAngle = this.baseAngle ?? this.angle;
      this.turnToward(this.baseAngle + Math.sin(this.sweepPhase) * 0.9, dt, GUARD.turnSpeed);
      if (this.searchTimer > 3.2) {
        this.searchTimer = 0;
        this.target = null;
        this.baseAngle = this.angle;
        this.pauseTimer = 0.4;
      }
    }
  }

  update(floor, player, dt, noise) {
    const canSee = this.canSee(floor, player.x, player.y, player.radius);
    this.seesPlayer = canSee;

    // Suspicion: rises with how visible the target is, falls back when the cone is empty.
    if (canSee) {
      const exposure = floor.visibility(player.x, player.y, player.stance);
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      const nearness = 1 - 0.55 * (dist / GUARD.coneRange);
      this.suspicion = Math.min(1.6, this.suspicion + GUARD.suspicionRise * exposure * nearness * dt);
      this.lastSeen = { x: player.x, y: player.y };
      if (this.suspicion >= 1) {
        this.state = ALERT;
        this.alertTimer = 2.6;
      } else if (this.suspicion > 0.32 && this.state === CALM) {
        this.state = SUSPICIOUS;
        this.baseAngle = this.angle;
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - GUARD.suspicionFall * dt);
      if (this.suspicion === 0 && this.state === SUSPICIOUS) {
        this.state = SEARCHING;
        this.target = this.lastSeen ? { ...this.lastSeen } : null;
        this.searchTimer = 0;
      }
    }

    // A noise the guard can hear is worth a look, and it beats a patrol but never an alert.
    if (noise && noise.strength > 0 && this.state !== ALERT) {
      const d = Math.hypot(noise.x - this.x, noise.y - this.y);
      if (d < noise.strength) {
        this.state = SEARCHING;
        this.target = { x: noise.x, y: noise.y };
        this.searchTimer = 0;
        this.suspicion = Math.max(this.suspicion, 0.2);
      }
    }

    switch (this.state) {
      case ALERT: {
        this.alertTimer -= dt;
        const point = this.lastSeen ?? player;
        this.turnToward(Math.atan2(point.y - this.y, point.x - this.x), dt, GUARD.turnSpeed * 1.7);
        this.moveToward(floor, point.x, point.y, GUARD.chaseSpeed, dt);
        if (this.alertTimer <= 0) {
          this.state = SEARCHING;
          this.target = this.lastSeen ? { ...this.lastSeen } : null;
          this.searchTimer = 0;
          this.suspicion = 0.5;
        }
        break;
      }
      case SUSPICIOUS: {
        this.turnToward(Math.atan2(player.y - this.y, player.x - this.x), dt, GUARD.turnSpeed * 1.2);
        this.suspicion = Math.max(0, this.suspicion - dt * 0.08);
        break;
      }
      case SEARCHING: {
        this.investigate(floor, dt);
        break;
      }
      default: {
        this.suspicion = Math.max(0, this.suspicion - GUARD.alertDecay * dt * 0.4);
        this.patrol(floor, dt);
      }
    }

    this.coneTint += ((this.state === ALERT ? 1 : this.suspicion > 0.3 ? 0.55 : 0) - this.coneTint) * Math.min(1, dt * 6);
  }
}

/** Turn the floor's guard definitions into guards that start on their route. */
export function makeGuards(def) {
  return def.guards.map((g, i) => new Guard(g, i));
}
