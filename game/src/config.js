// Tunables and the palette. Every number the game feels through lives here, so the
// look and the difficulty can be read in one place: tile size, walk and sprint
// speeds, how far a guard's flashlight reaches, how fast suspicion fills, and the
// colour of each thing drawn on the floor.

export const TILE = 32;
export const VIEW_W = 44;
export const VIEW_H = 26;
export const WORLD_W = VIEW_W * TILE;
export const WORLD_H = VIEW_H * TILE;

export const PLAYER = {
  radius: 9,
  walk: 118,
  sprint: 196,
  crouch: 62,
  accel: 14,
  crouchRadius: 7,
  catchRadius: 15,
};

// A guard's flashlight: the cone it casts, and how long it takes to be sure.
export const GUARD = {
  radius: 10,
  patrolSpeed: 46,
  searchSpeed: 78,
  chaseSpeed: 132,
  coneHalfAngle: 0.42,
  coneRange: 9.6 * TILE,
  turnSpeed: 3.4,
  pauseSeconds: 1.5,
  sweepAmplitude: 0.62,
  suspicionRise: 1.55,
  suspicionFall: 0.55,
  alertDecay: 0.34,
  hearingRadius: 5.4 * TILE,
};

// How visible the player is, by stance and by how much light falls on them.
export const VISIBILITY = {
  standing: 1.0,
  crouching: 0.58,
  sprinting: 1.18,
  inShadow: 0.42,
  litFloor: 1.0,
  lowCoverBonus: 0.34,
};

export const NOISE = {
  sprint: 5.6 * TILE,
  walk: 2.6 * TILE,
  crouch: 0.9 * TILE,
  sprintEvery: 0.34,
  walkEvery: 0.55,
};

// The palette is deliberately wide in value: the floor is dark but never black, walls sit
// clearly above it, and every hazard is a hue that no piece of furniture uses, so a frame
// read at thumbnail size still separates walkable floor, cover, guard and exit.
export const COLORS = {
  void: '#05080d',
  floor: '#26333f',
  floorAlt: '#2b3947',
  floorLine: '#33434f',
  wall: '#4a5d72',
  wallTop: '#6b8299',
  wallShade: '#1b242e',
  crate: '#5f4a30',
  crateTop: '#7d6340',
  crateEdge: '#a8875c',
  rack: '#3c4d5e',
  rackTop: '#54697d',
  rackLed: '#57e39b',
  desk: '#46566a',
  deskTop: '#5d7189',
  paper: '#e6eef7',
  lowCrate: '#6d5232',
  lowTop: '#8f6d43',
  guard: '#e2563c',
  guardDark: '#a02f1e',
  guardHead: '#ff8a6a',
  guardEye: '#ffe6b0',
  player: '#4ff0d8',
  playerDark: '#0e5f5c',
  playerHood: '#bffff5',
  exit: '#57e39b',
  exitDim: '#1f6b4c',
  keycard: '#ffd24a',
  door: '#8a6a3a',
  doorLocked: '#d1512f',
  text: '#f0f5fb',
  textDim: '#9fb0c2',
  danger: '#ff5c45',
  warn: '#ffc93c',
};

// The three floors, each with its own floor tint so a screenshot reads as a
// different place at a glance.
export const THEMES = [
  { floor: '#26333f', floorAlt: '#2b3947', line: '#33434f', accent: '#4ff0d8' },
  { floor: '#243039', floorAlt: '#2a3742', line: '#31404c', accent: '#8fc2ff' },
  { floor: '#2f2b23', floorAlt: '#353026', line: '#413a2c', accent: '#ffd24a' },
];
