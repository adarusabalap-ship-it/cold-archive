// The game loop: one canvas, a fixed 60 Hz step, and three screens (title, playing, caught or
// out). The floor is rebuilt from its definition on every restart, so a floor always begins the
// same way and the same inputs always give the same run.

import { WORLD_W, WORLD_H } from './config.js';
import { FLOORS } from './levels.js';
import { Floor } from './floor.js';
import { Player, Pebble } from './player.js';
import { makeGuards } from './guards.js';
import { drawFrame, makeCanvas } from './render.js';
import { Input } from './input.js';
import { stageScene, makeWorld } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const buffer = makeCanvas(WORLD_W, WORLD_H);
const input = new Input(canvas);

/** Which scene the page was asked for, if any: ?shot=title|play|cover|caught|won */
function requestedShot() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

let state;

function startGame() {
  state = makeWorld(0);
  state.screen = 'playing';
}

function loadFloor(index) {
  const floor = new Floor(FLOORS[index]);
  state = {
    ...state,
    floor,
    floorIndex: index,
    player: new Player(floor),
    guards: makeGuards(FLOORS[index]),
    pebblesInAir: [],
    pebbles: FLOORS[index].pebbles,
    screen: 'playing',
    nearCard: false,
    nearDoor: false,
  };
  // Elapsed and spotted carry across floors: the run is one escape, not three.
}

/** The rules for a frame of play, including picking things up and throwing a pebble. */
function playStep(dt) {
  const frame = input.take();

  if (frame.restart) {
    loadFloor(state.floorIndex);
    return;
  }

  // Interact: take a keycard, or open the shutter it opens.
  if (frame.interact) {
    const card = state.floor.cardNear(state.player.x, state.player.y);
    if (card) {
      card.taken = true;
      state.player.carrying = true;
    } else if (state.floor.allCardsTaken) {
      const door = state.floor.doorNear(state.player.x, state.player.y);
      if (door) door.open = true;
    }
  }

  // Throw a pebble toward the cursor.
  if (frame.throw && state.pebbles > 0 && state.player.throwCooldown <= 0) {
    state.pebbles -= 1;
    state.player.throwCooldown = 0.45;
    state.pebblesInAir.push(new Pebble(state.player.x, state.player.y, frame.mouse.x, frame.mouse.y));
  }

  const intent = { x: frame.x, y: frame.y, crouch: frame.crouch, sprint: frame.sprint };
  const noise = state.player.update(state.floor, dt, intent);

  for (const g of state.guards) g.update(state.floor, state.player, dt, noise);

  for (const p of state.pebblesInAir) {
    const landed = p.update(dt);
    if (landed) {
      for (const g of state.guards) {
        if (Math.hypot(landed.x - g.x, landed.y - g.y) < landed.strength) {
          g.state = 'searching';
          g.target = { x: landed.x, y: landed.y };
          g.searchTimer = 0;
          g.suspicion = Math.max(g.suspicion, 0.2);
        }
      }
    }
  }
  state.pebblesInAir = state.pebblesInAir.filter((p) => !p.landed);

  state.nearCard = state.floor.cardNear(state.player.x, state.player.y) !== null;
  state.nearDoor = state.floor.doorNear(state.player.x, state.player.y) !== null;

  state.elapsed += dt;

  // Caught: an alerted guard within arm's reach.
  for (const g of state.guards) {
    if (g.state === 'alert' && Math.hypot(g.x - state.player.x, g.y - state.player.y) < 26) {
      state.player.caught = true;
      state.spotted += 1;
      state.screen = 'caught';
      return;
    }
  }

  // Out: standing in the exit while holding the floor's keycard. The exit is a locked doorway,
  // so reaching it early does nothing until the card is in hand.
  if (state.floor.inExit(state.player.x, state.player.y)) {
    const next = state.floorIndex + 1;
    if (next < FLOORS.length) loadFloor(next);
    else state.screen = 'won';
  }
}

function titleStep() {
  const frame = input.take();
  if (frame.any) startGame();
  state.time += 1 / 60;
  for (const g of state.guards) g.update(state.floor, state.player, 1 / 60, null);
}

function endStep() {
  const frame = input.take();
  state.time += 1 / 60;
  for (const g of state.guards) g.update(state.floor, state.player, 1 / 60, null);
  if (frame.restart || frame.any) {
    state.spotted = 0;
    state.elapsed = 0;
    loadFloor(state.screen === 'won' ? 0 : state.floorIndex);
  }
}

let last = performance.now();
let acc = 0;

function frame(now) {
  const delta = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  acc += delta;

  while (acc >= STEP) {
    acc -= STEP;
    if (state.screen === 'title') titleStep();
    else if (state.screen === 'caught' || state.screen === 'won') endStep();
    else playStep(STEP);
  }

  state.time += 0;
  drawFrame(ctx, state, state.floor, buffer, state.time);
  requestAnimationFrame(frame);
}

// A screenshot scene is staged once and drawn on its own clock, with no input and no loop that
// changes it: the frame is a pure function of the seed, so a capture is reproducible.
const shot = requestedShot();
if (shot) {
  state = stageScene(shot);
  state.time = 0.9;
  drawFrame(ctx, state, state.floor, buffer, state.time);
  // Keep the beam sweeping a little so the capture is not a frozen instant, but never move the
  // player or a guard's position between two frames of the same shot.
  let t = state.time;
  setInterval(() => {
    t += 1 / 30;
    drawFrame(ctx, state, state.floor, buffer, t);
  }, 33);
} else {
  state = makeWorld(0);
  state.screen = 'title';
  requestAnimationFrame(frame);
}
