// Drawing. One canvas, one pass, no images: the whole game is shapes, gradients and text, so
// every screenshot is a real render of this file. The order matters and is fixed here — floor,
// shadow, exits and pickups, cones, guards, player, then the lighting pass that darkens what the
// flashlights do not reach, then the HUD on top.

import { TILE, WORLD_W, WORLD_H, COLORS, THEMES, GUARD, VIEW_W, VIEW_H } from './config.js';
import { SOLID, LOW } from './floor.js';
import { ALERT, SUSPICIOUS } from './guards.js';

const TAU = Math.PI * 2;

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Rounded rectangle path, used by nearly everything with a body. */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawFloorBase(ctx, floor) {
  const theme = THEMES[floor.theme];
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // A soft checker so the floor reads as tiled without being busy.
  ctx.fillStyle = theme.floorAlt;
  for (let ty = 0; ty < floor.rows; ty += 1) {
    for (let tx = 0; tx < floor.cols; tx += 1) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let tx = 1; tx < floor.cols; tx += 1) {
    ctx.beginPath();
    ctx.moveTo(tx * TILE + 0.5, 0);
    ctx.lineTo(tx * TILE + 0.5, WORLD_H);
    ctx.stroke();
  }
  for (let ty = 1; ty < floor.rows; ty += 1) {
    ctx.beginPath();
    ctx.moveTo(0, ty * TILE + 0.5);
    ctx.lineTo(WORLD_W, ty * TILE + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Shadows cast by shelving and crates. They are what make a crouch behind a rack a real hiding
 * place, so they have to be visible — but they are drawn as a soft, cool tint rather than a
 * black blob, so the floor underneath keeps its texture and a cone crossing one still reads.
 */
function drawShadow(ctx, floor) {
  for (let ty = 0; ty < floor.rows; ty += 1) {
    for (let tx = 0; tx < floor.cols; tx += 1) {
      const s = floor.shadow[ty * floor.cols + tx];
      if (s <= 0.02) continue;
      ctx.fillStyle = `rgba(4, 10, 20, ${0.4 * s})`;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
}

function drawDecor(ctx, floor) {
  for (const d of floor.decor) {
    if (d.kind === 'scuff') {
      ctx.strokeStyle = 'rgba(120, 140, 160, 0.07)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + Math.cos(d.rot) * d.size, d.y + Math.sin(d.rot) * d.size);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(200, 214, 230, 0.10)';
      ctx.fillRect(d.x, d.y, d.size, d.size * 0.7);
    }
  }
}

/**
 * Walls, crates, shelves and desks. Each solid gets a drop shadow, a body and a bright top
 * face, which is what separates an obstacle from the floor at a glance and gives the room its
 * depth without a lighting engine.
 */
function drawSolids(ctx, floor) {
  const isCrate = (tx, ty) => floor.crates.some((c) => tx >= c.x && tx < c.x + c.w && ty >= c.y && ty < c.y + c.h);
  const isRack = (tx, ty) => floor.racks.some((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);

  // One shadow pass first, so no shadow falls on a neighbour's body. The offset is deliberately
  // large and constant, because that offset is what makes a solid read as TALL: a box with no
  // shadow is a rectangle painted on the floor, and cover you cannot see the height of is cover
  // you do not trust.
  for (let ty = 0; ty < floor.rows; ty += 1) {
    for (let tx = 0; tx < floor.cols; tx += 1) {
      if (floor.at(tx, ty) !== SOLID) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(tx * TILE + 7, ty * TILE + 9, TILE, TILE);
    }
  }

  for (let ty = 0; ty < floor.rows; ty += 1) {
    for (let tx = 0; tx < floor.cols; tx += 1) {
      const kind = floor.at(tx, ty);
      if (kind !== SOLID) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const crate = isCrate(tx, ty);
      const rack = isRack(tx, ty);
      ctx.fillStyle = crate ? COLORS.crate : rack ? COLORS.rack : COLORS.wall;
      ctx.fillRect(x, y, TILE, TILE);
      // The lit top face: a bright band on the upper edge of every solid.
      ctx.fillStyle = crate ? COLORS.crateTop : rack ? COLORS.rackTop : COLORS.wallTop;
      ctx.fillRect(x, y, TILE, 6);
      // A darker seam on the lower edge, which reads as the shadowed side.
      ctx.fillStyle = COLORS.wallShade;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, y + TILE - 3, TILE, 3);
      ctx.globalAlpha = 1;
    }
  }

  // Crate bodies get an outline so a stack of them reads as separate boxes.
  for (const c of floor.crates) {
    const x = c.x * TILE;
    const y = c.y * TILE;
    const w = c.w * TILE;
    const h = c.h * TILE;
    // A tall side face on the right and bottom, in the shadowed tone: this is what turns a
    // rectangle into a box with height, and height is what makes it read as cover.
    ctx.fillStyle = 'rgba(12, 8, 4, 0.55)';
    ctx.fillRect(x + w - 4, y + 4, 6, h + 4);
    ctx.fillRect(x + 4, y + h - 4, w + 2, 6);
    ctx.strokeStyle = COLORS.crateEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + w - 3, y + h - 3);
    ctx.moveTo(x + w - 3, y + 3);
    ctx.lineTo(x + 3, y + h - 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Shelving: uprights with a lit status LED, which is what makes a rack read as a rack.
  for (const r of floor.racks) {
    const x = r.x * TILE;
    const y = r.y * TILE;
    const w = r.w * TILE;
    const h = r.h * TILE;
    ctx.strokeStyle = COLORS.rackTop;
    ctx.lineWidth = 1.5;
    for (let i = 1; i < r.h; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 2, y + i * TILE);
      ctx.lineTo(x + w - 2, y + i * TILE);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = COLORS.rackLed;
    ctx.fillRect(x + w / 2 - 2, y + 4, 4, 3);
  }

  // Desks: low, with paper on them, drawn after the walls so they sit on the floor.
  for (const d of floor.desks) {
    const x = d.x * TILE;
    const y = d.y * TILE;
    const w = d.w * TILE;
    const h = d.h * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 3, y + 4, w, h);
    ctx.fillStyle = COLORS.desk;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.deskTop;
    ctx.fillRect(x, y, w, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(x + 9, y + 13, 16, 11);
    ctx.fillRect(x + w - 32, y + 11, 14, 10);
  }

  // Low crates: shorter, with a bright lip, since they stop you and not a flashlight.
  for (const c of floor.lowCrates) {
    const x = c.x * TILE;
    const y = c.y * TILE;
    const w = c.w * TILE;
    const h = c.h * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(x + 3, y + 5, w, h);
    ctx.fillStyle = COLORS.lowCrate;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.lowTop;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = COLORS.crateEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    // A dark inner stripe, so a low crate reads as an open-topped box you can crouch behind.
    ctx.fillStyle = 'rgba(30, 22, 10, 0.55)';
    ctx.fillRect(x + 5, y + 7, w - 10, h - 12);
  }
}

function drawDoors(ctx, floor) {
  for (const d of floor.doors) {
    const x = d.x * TILE;
    const y = d.y * TILE;
    const w = d.w * TILE;
    const h = d.h * TILE;
    if (d.open) {
      ctx.fillStyle = 'rgba(87, 227, 155, 0.16)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = COLORS.exit;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    } else {
      ctx.fillStyle = COLORS.door;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = COLORS.doorLocked;
      ctx.fillRect(x + w / 2 - 3, y + h / 2 - 3, 6, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }
}

function drawExit(ctx, floor, time) {
  const e = floor.exit;
  const x = e.x * TILE;
  const y = e.y * TILE;
  const w = e.w * TILE;
  const h = e.h * TILE;
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);

  const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 0.9);
  grad.addColorStop(0, `rgba(87, 227, 155, ${0.42 + pulse * 0.22})`);
  grad.addColorStop(1, 'rgba(87, 227, 155, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - w * 0.5, y - h * 0.5, w * 2, h * 2);

  ctx.fillStyle = 'rgba(31, 107, 76, 0.85)';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.strokeStyle = COLORS.exit;
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -time * 22;
  ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
  ctx.setLineDash([]);

  // The word, so a screenshot says what the glowing box is.
  ctx.fillStyle = COLORS.exit;
  ctx.font = 'bold 11px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', x + w / 2, y + h / 2);
}

function drawKeycard(ctx, card, time) {
  if (card.taken) return;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.1);
  const grad = ctx.createRadialGradient(card.x, card.y, 2, card.x, card.y, 26);
  grad.addColorStop(0, `rgba(255, 207, 92, ${0.3 + pulse * 0.25})`);
  grad.addColorStop(1, 'rgba(255, 207, 92, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(card.x, card.y, 26, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(card.x, card.y);
  ctx.rotate(-0.35);
  ctx.fillStyle = COLORS.keycard;
  roundRect(ctx, -9, -6, 18, 12, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 26, 34, 0.85)';
  ctx.fillRect(-6, -3, 7, 4);
  ctx.fillRect(2, -3, 5, 1.5);
  ctx.restore();
}

/**
 * One flashlight. Every cone is drawn to the same spec — a filled wedge at a fixed opacity, a
 * bright rim along both edges and a bright far arc — so "inside the bright shape" always means
 * the same thing. The wedge is sampled ray by ray so a wall cuts it, and its far edge is drawn
 * at the real reach, never at the nominal range.
 */
function drawCone(ctx, guard, floor) {
  const range = GUARD.coneRange;
  const half = GUARD.coneHalfAngle;
  const steps = 44;
  const hot = guard.coneTint;
  // Red, always. Amber sat in the same warm family as the wooden crates, so a beam and a box
  // read as the same kind of thing; red is the one hue no prop uses, and it is the universal
  // danger signal. Alerted goes hotter and more saturated. The rim is near-white so the beam's
  // edge survives the downscale to a contact sheet.
  const fill = hot > 0.4 ? 'rgba(255, 44, 32, 0.46)' : 'rgba(236, 52, 44, 0.30)';
  const rim = hot > 0.4 ? 'rgba(255, 196, 186, 1)' : 'rgba(255, 154, 142, 0.92)';

  // The wedge, its far edge following whatever stops the light.
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = guard.angle - half + (half * 2 * i) / steps;
    let reach = range;
    for (let d = 10; d <= range; d += 3) {
      const px = guard.x + Math.cos(a) * d;
      const py = guard.y + Math.sin(a) * d;
      if (floor.blocksSight(Math.floor(px / TILE), Math.floor(py / TILE))) { reach = d; break; }
    }
    points.push({ x: guard.x + Math.cos(a) * reach, y: guard.y + Math.sin(a) * reach });
  }

  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // The rim: both edges and the far arc, one weight, so the boundary is unambiguous.
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(points[0].x, points[0].y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    if (i === 0) ctx.moveTo(points[0].x, points[0].y);
    else ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // A faint wash nearer the lamp, so the beam has a near and a far.
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  for (const p of points) {
    ctx.lineTo(guard.x + (p.x - guard.x) * 0.45, guard.y + (p.y - guard.y) * 0.45);
  }
  ctx.closePath();
  ctx.fillStyle = hot > 0.4 ? 'rgba(255, 70, 52, 0.30)' : 'rgba(255, 92, 72, 0.20)';
  ctx.fill();
}

/**
 * A guard seen from above: the same construction as the player — head, shoulders, two arms —
 * but in red and with both arms forward around a lamp, so the silhouette says "someone aiming a
 * flashlight" at a glance. Alerted, the body goes hot and a ring pulses; the shape stays the
 * same, so a guard is recognisable whatever state it is in.
 */
function drawGuard(ctx, guard, time) {
  const x = guard.x;
  const y = guard.y;
  const alerted = guard.state === ALERT;
  const suspicious = guard.state === SUSPICIOUS || guard.suspicion > 0.3;
  const body = alerted ? '#ff7a5c' : COLORS.guard;
  const bodyDark = alerted ? '#8c2a18' : COLORS.guardDark;

  // Body shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 12, 9, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(guard.angle);   // faces +x

  const shoulder = 6.0;
  const reach = 11.0;

  // Torso: a narrow rounded bar across the shoulders, bright rim over a darker core. It is kept
  // narrower than the arms are spread, so the arms are visible either side of it and the
  // silhouette is a body with limbs rather than a filled disc.
  ctx.fillStyle = body;
  roundRect(ctx, -6.0, -shoulder, 11.5, shoulder * 2, 5);
  ctx.fill();
  ctx.fillStyle = bodyDark;
  roundRect(ctx, -4.6, -shoulder + 1.8, 9.0, (shoulder - 1.8) * 2, 3.4);
  ctx.fill();

  // Both arms forward and out to the sides, converging on the lamp — the flashlight grip. They
  // start outside the torso edge so they are not swallowed by it.
  ctx.strokeStyle = body;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-0.5, side * (shoulder + 1.2));
    ctx.lineTo(reach - 1.5, side * 2.6);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Head: brighter than the body and set slightly back from the hands, so it reads as a head
  // and not as a highlight on the torso.
  ctx.fillStyle = COLORS.guardHead;
  ctx.beginPath();
  ctx.arc(0.0, 0, 4.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = bodyDark;
  ctx.beginPath();
  ctx.arc(-0.8, 0, 2.2, 0, TAU);
  ctx.fill();

  // The lamp itself: a bright bead in both hands, which is where the cone comes from.
  ctx.fillStyle = COLORS.guardEye;
  ctx.beginPath();
  ctx.arc(reach, 0, 3.0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 246, 214, 0.55)';
  ctx.beginPath();
  ctx.arc(reach, 0, 5.4, 0, TAU);
  ctx.fill();
  ctx.restore();

  // A ring in the guard's own colour, so it never reads as a floor decoration.
  ctx.strokeStyle = alerted ? 'rgba(255, 122, 92, 0.9)' : 'rgba(226, 86, 60, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, GUARD.radius + 5, 0, TAU);
  ctx.stroke();

  // State pip above the head: calm none, suspicious a wedge, alert an exclamation.
  if (alerted) {
    ctx.fillStyle = COLORS.danger;
    ctx.font = 'bold 18px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 20 + Math.sin(time * 12) * 1.5);
  } else if (suspicious) {
    ctx.fillStyle = COLORS.warn;
    ctx.font = 'bold 16px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y - 20);
  }
}

/**
 * The player, drawn as a person seen from above rather than a token: a head, two shoulders and
 * two hands, in a bright cyan outline with a dark fill so the silhouette holds against both the
 * lit floor and the shadows. Crouched, the body tucks in — shoulders narrow, head forward, and a
 * dashed ring marks the smaller profile — so the pose is readable without reading the HUD.
 */
function drawPlayer(ctx, player, floor, time) {
  const crouched = player.stance === 'crouch';
  const sprinting = player.stance === 'sprint';
  const x = player.x;
  const y = player.y;

  // A ring on the floor showing exactly how visible you are right now.
  const vis = floor.visibility(x, y, player.stance);
  ctx.strokeStyle = `rgba(79, 240, 216, ${0.22 + vis * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, TAU);
  ctx.stroke();

  // A soft halo, so the eye finds the player in a dark room without the body glowing. Wide and
  // strong, because "where am I" is the first question a stealth screenshot has to answer.
  const glow = ctx.createRadialGradient(x, y, 3, x, y, 34);
  glow.addColorStop(0, 'rgba(79, 240, 216, 0.46)');
  glow.addColorStop(0.5, 'rgba(79, 240, 216, 0.14)');
  glow.addColorStop(1, 'rgba(79, 240, 216, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, TAU);
  ctx.fill();

  // Contact shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 6, crouched ? 11 : 14, crouched ? 8 : 10, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.facing);   // the figure faces +x in its own frame

  const shoulder = crouched ? 6.4 : 8.2;    // half the shoulder width
  const reach = crouched ? 7.6 : 9.4;       // how far forward the hands sit

  // Shoulders and torso: one rounded bar across the body, dark inside, bright rim.
  ctx.fillStyle = COLORS.player;
  roundRect(ctx, -8.2, -shoulder, 16.4, shoulder * 2, 5.5);
  ctx.fill();
  ctx.fillStyle = COLORS.playerDark;
  roundRect(ctx, -6.3, -shoulder + 2, 12.6, (shoulder - 2) * 2, 3.8);
  ctx.fill();

  // Two arms reaching forward, ending in hands — the clearest "person" cue from above.
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(1.8, side * (shoulder - 1.8));
    ctx.lineTo(reach, side * (shoulder + (sprinting ? 1.8 : 0.6)));
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Head: a filled circle at the front, brighter than the body, with a dark visor gap.
  ctx.fillStyle = COLORS.playerHood;
  ctx.beginPath();
  ctx.arc(1.6, 0, crouched ? 4.4 : 5.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.playerDark;
  ctx.beginPath();
  ctx.arc(3.0, 0, crouched ? 1.9 : 2.4, 0, TAU);
  ctx.fill();

  ctx.restore();

  // A facing arrow, outside the body, so the heading is legible even at thumbnail size.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.facing);
  ctx.fillStyle = 'rgba(79, 240, 216, 0.9)';
  ctx.beginPath();
  ctx.moveTo(reach + 9, 0);
  ctx.lineTo(reach + 2.5, -3.6);
  ctx.lineTo(reach + 2.5, 3.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Crouched: a dashed ring marks the tighter profile, the same language as the smaller radius.
  if (crouched) {
    ctx.strokeStyle = 'rgba(79, 240, 216, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawPebbles(ctx, pebbles) {
  for (const p of pebbles) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(p.x + 1, p.y + 2, 4, 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b9c6d4';
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.arc, 3.2, 0, TAU);
    ctx.fill();
  }
}

/**
 * The darkness pass: everything the lamps and your own small light do not reach goes dim, but
 * never black — the level has to stay readable in a screenshot, so the floor keeps enough
 * contrast for walls, cover and the exit to be told apart in the dark.
 */
function drawLighting(ctx, floor, guards, player, buffer) {
  const b = buffer.getContext('2d');
  b.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, WORLD_W, WORLD_H);
  b.fillStyle = 'rgba(6, 10, 16, 0.46)';
  b.fillRect(0, 0, WORLD_W, WORLD_H);

  b.globalCompositeOperation = 'destination-out';

  // Each guard's cone punches a hole in the dark, cut by the walls the same way it is drawn.
  for (const g of guards) {
    const grad = b.createRadialGradient(g.x, g.y, 6, g.x, g.y, GUARD.coneRange);
    grad.addColorStop(0, 'rgba(0,0,0,0.95)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = grad;
    b.beginPath();
    b.moveTo(g.x, g.y);
    const steps = 32;
    for (let i = 0; i <= steps; i += 1) {
      const a = g.angle - GUARD.coneHalfAngle + (GUARD.coneHalfAngle * 2 * i) / steps;
      let reach = GUARD.coneRange;
      for (let d = 12; d <= GUARD.coneRange; d += 3) {
        const px = g.x + Math.cos(a) * d;
        const py = g.y + Math.sin(a) * d;
        if (floor.blocksSight(Math.floor(px / TILE), Math.floor(py / TILE))) { reach = d; break; }
      }
      b.lineTo(g.x + Math.cos(a) * reach, g.y + Math.sin(a) * reach);
    }
    b.closePath();
    b.fill();
  }

  // The player carries a small pool of light of their own, so you can always read yourself.
  const self = b.createRadialGradient(player.x, player.y, 4, player.x, player.y, 120);
  self.addColorStop(0, 'rgba(0,0,0,0.8)');
  self.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = self;
  b.beginPath();
  b.arc(player.x, player.y, 120, 0, TAU);
  b.fill();

  // The exit glows through the dark.
  const e = floor.exit;
  const ex = (e.x + e.w / 2) * TILE;
  const ey = (e.y + e.h / 2) * TILE;
  const eg = b.createRadialGradient(ex, ey, 4, ex, ey, 130);
  eg.addColorStop(0, 'rgba(0,0,0,0.9)');
  eg.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = eg;
  b.beginPath();
  b.arc(ex, ey, 130, 0, TAU);
  b.fill();

  ctx.drawImage(buffer, 0, 0);
}

function bar(ctx, x, y, w, h, value, fill, back) {
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x + 1, y + 1, Math.max(0, (w - 2) * Math.max(0, Math.min(1, value))), h - 2, (h - 2) / 2);
  ctx.fill();
}

/** Break a sentence into lines that fit `maxWidth`, so an objective is never cut mid-word. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawHud(ctx, state, floor) {
  const pad = 18;

  // Top-left: where you are and what you are doing. The panel is sized to the wrapped
  // objective, so a long brief gets two or three lines rather than being cut off mid-word.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '12px ui-monospace, Consolas, monospace';
  const panelW = 372;
  const briefLines = wrapText(ctx, floor.brief, panelW - 28).slice(0, 3);
  const panelH = 40 + briefLines.length * 15;
  ctx.fillStyle = 'rgba(4, 6, 10, 0.72)';
  roundRect(ctx, pad, pad, panelW, panelH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 231, 208, 0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, pad + 0.5, pad + 0.5, panelW - 1, panelH - 1, 10);
  ctx.stroke();

  ctx.fillStyle = THEMES[floor.theme].accent;
  ctx.font = 'bold 13px ui-monospace, Consolas, monospace';
  ctx.fillText(floor.name.toUpperCase(), pad + 14, pad + 24);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px ui-monospace, Consolas, monospace';
  briefLines.forEach((line, i) => {
    ctx.fillText(line, pad + 14, pad + 44 + i * 15);
  });

  // Top-right: floor number, keycard, and how many times you have been seen.
  const rightW = 250;
  const rx = WORLD_W - pad - rightW;
  ctx.fillStyle = 'rgba(4, 6, 10, 0.72)';
  roundRect(ctx, rx, pad, rightW, 66, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 231, 208, 0.22)';
  roundRect(ctx, rx + 0.5, pad + 0.5, rightW - 1, 65, 10);
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`FLOOR ${state.floorIndex + 1}/${state.floorCount}`, rx + 14, pad + 24);

  const card = floor.allCardsTaken;
  ctx.fillStyle = card ? COLORS.exit : COLORS.keycard;
  ctx.fillText(card ? 'KEYCARD  HELD' : 'KEYCARD  MISSING', rx + 14, pad + 46);

  ctx.fillStyle = COLORS.textDim;
  ctx.font = '11px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`SPOTTED ${state.spotted}`, rx + rightW - 14, pad + 24);
  ctx.fillText(`${state.elapsed.toFixed(1)}s`, rx + rightW - 14, pad + 46);

  // Bottom-left: stance and stamina.
  const by = WORLD_H - pad - 46;
  ctx.fillStyle = 'rgba(4, 6, 10, 0.72)';
  roundRect(ctx, pad, by, 268, 46, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 231, 208, 0.22)';
  roundRect(ctx, pad + 0.5, by + 0.5, 267, 45, 10);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px ui-monospace, Consolas, monospace';
  const stanceLabel = state.player.stance === 'crouch' ? 'CROUCH'
    : state.player.stance === 'sprint' ? 'SPRINT' : 'WALK';
  ctx.fillText(stanceLabel, pad + 14, by + 20);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '10px ui-monospace, Consolas, monospace';
  ctx.fillText('STAMINA', pad + 84, by + 19);
  bar(ctx, pad + 84, by + 25, 168, 8, state.player.stamina,
    state.player.stamina > 0.25 ? '#5ee7d0' : '#ffcf5c', 'rgba(255,255,255,0.12)');

  // Bottom-right: pebbles left, and a hint of what the key does.
  const px = WORLD_W - pad - 268;
  ctx.fillStyle = 'rgba(4, 6, 10, 0.72)';
  roundRect(ctx, px, by, 268, 46, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 231, 208, 0.22)';
  roundRect(ctx, px + 0.5, by + 0.5, 267, 45, 10);
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`PEBBLES ${state.pebbles}`, px + 14, by + 20);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '10px ui-monospace, Consolas, monospace';
  const hint = state.nearDoor ? 'E  OPEN SHUTTER' : state.nearCard ? 'E  TAKE KEYCARD' : 'Q  THROW PEBBLE';
  ctx.fillText(hint, px + 14, by + 35);

  // The detection meter, centre-top, only when somebody is on to you.
  const topSuspicion = state.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
  if (topSuspicion > 0.06) {
    const w = 300;
    const x = (WORLD_W - w) / 2;
    const y = pad + 16;
    ctx.fillStyle = 'rgba(4, 6, 10, 0.8)';
    roundRect(ctx, x - 8, y - 8, w + 16, 40, 10);
    ctx.fill();
    ctx.fillStyle = topSuspicion >= 1 ? COLORS.danger : COLORS.warn;
    ctx.font = 'bold 11px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(topSuspicion >= 1 ? 'SPOTTED' : 'SEEN', WORLD_W / 2, y + 8);
    bar(ctx, x, y + 14, w, 8, Math.min(1, topSuspicion),
      topSuspicion >= 1 ? COLORS.danger : COLORS.warn, 'rgba(255,255,255,0.12)');
  }
}

function drawTitle(ctx, state, floor, time) {
  ctx.fillStyle = 'rgba(3, 5, 9, 0.78)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const cx = WORLD_W / 2;
  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.player;
  ctx.font = 'bold 72px ui-monospace, Consolas, monospace';
  ctx.fillText('COLD ARCHIVE', cx, WORLD_H / 2 - 74);

  ctx.fillStyle = COLORS.textDim;
  ctx.font = '16px ui-monospace, Consolas, monospace';
  ctx.fillText('three floors, four guards, one way out that nobody sees', cx, WORLD_H / 2 - 40);

  ctx.strokeStyle = 'rgba(94, 231, 208, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 220, WORLD_H / 2 - 20);
  ctx.lineTo(cx + 220, WORLD_H / 2 - 20);
  ctx.stroke();

  const rows = [
    ['W A S D', 'move, quietly'],
    ['SHIFT', 'crouch — small and nearly silent'],
    ['SPACE', 'sprint — fast, loud, and easy to see'],
    ['E', 'take a keycard, open a shutter'],
    ['Q / CLICK', 'throw a pebble where you want a guard to look'],
    ['R', 'restart the floor'],
  ];
  ctx.font = '13px ui-monospace, Consolas, monospace';
  rows.forEach(([key, what], i) => {
    const y = WORLD_H / 2 + 12 + i * 26;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(key, cx - 16, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(what, cx + 16, y);
  });

  const blink = 0.55 + 0.45 * Math.sin(time * 3.4);
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(87, 227, 155, ${blink})`;
  ctx.font = 'bold 17px ui-monospace, Consolas, monospace';
  ctx.fillText('PRESS ANY KEY TO ENTER', cx, WORLD_H - 96);

  ctx.fillStyle = COLORS.textDim;
  ctx.font = '11px ui-monospace, Consolas, monospace';
  ctx.fillText('a flashlight sees you; a shadow does not', cx, WORLD_H - 62);
}

function drawCaught(ctx, time) {
  ctx.fillStyle = `rgba(120, 18, 12, ${0.42 + 0.18 * Math.sin(time * 9)})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe4de';
  ctx.font = 'bold 54px ui-monospace, Consolas, monospace';
  ctx.fillText('SEEN', WORLD_W / 2, WORLD_H / 2 - 6);
  ctx.font = '15px ui-monospace, Consolas, monospace';
  ctx.fillStyle = 'rgba(255, 228, 222, 0.8)';
  ctx.fillText('the floor resets — R to try again', WORLD_W / 2, WORLD_H / 2 + 34);
}

function drawWin(ctx, time) {
  ctx.fillStyle = 'rgba(3, 12, 9, 0.86)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.exit;
  ctx.font = 'bold 46px ui-monospace, Consolas, monospace';
  ctx.fillText('YOU ARE OUT', WORLD_W / 2, WORLD_H / 2 - 40);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '15px ui-monospace, Consolas, monospace';
  ctx.fillText('nobody saw you leave', WORLD_W / 2, WORLD_H / 2 + 2);
  ctx.fillStyle = `rgba(94, 231, 208, ${0.6 + 0.4 * Math.sin(time * 2.6)})`;
  ctx.font = 'bold 14px ui-monospace, Consolas, monospace';
  ctx.fillText('R  PLAY AGAIN', WORLD_W / 2, WORLD_H / 2 + 52);
}

/** Draw one frame of the game. Pure function of the state passed in. */
export function drawFrame(ctx, state, floor, buffer, time) {
  ctx.save();
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  drawFloorBase(ctx, floor);
  drawShadow(ctx, floor);
  drawDecor(ctx, floor);
  drawDoors(ctx, floor);
  drawExit(ctx, floor, time);
  for (const card of floor.keycards) drawKeycard(ctx, card, time);

  // Cones go UNDER the props. The cone geometry already truncates each ray at the first tile
  // that blocks sight, so a beam stops at a crate's edge; drawing the crate afterwards makes
  // that stop crisp and unmistakable. Drawn on top, a beam paints across the very box it is
  // supposed to be blocked by, and no screenshot can show cover doing its job.
  for (const g of state.guards) drawCone(ctx, g, floor);

  drawSolids(ctx, floor);
  drawPebbles(ctx, state.pebblesInAir);

  drawLighting(ctx, floor, state.guards, state.player, buffer);

  for (const g of state.guards) drawGuard(ctx, g, time);
  if (!state.player.caught) drawPlayer(ctx, state.player, floor, time);

  drawHud(ctx, state, floor);

  if (state.screen === 'title') drawTitle(ctx, state, floor, time);
  else if (state.screen === 'caught') drawCaught(ctx, time);
  else if (state.screen === 'won') drawWin(ctx, time);

  ctx.restore();
}
