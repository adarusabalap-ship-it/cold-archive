// The three floors of the archive, each described as rectangles in tile units so the
// layout can be read as numbers rather than guessed from a picture. `walls`, `crates`,
// `racks` and `desks` stop both a body and a flashlight; `lowCrates` stop a body only,
// which is what makes them cover you can crouch behind and still be seen over.
//
// A door is a passable tile in a gap until the floor's keycard is taken; the exit is a
// rectangle you must stand in, and the guards walk the routes given, in tile centres.

export const FLOORS = [
  {
    id: 'cold-storage',
    name: 'Sub-basement · Cold Storage',
    brief: 'Take the keycard from the office, open the shutter, and leave by the loading bay.',
    theme: 0,
    start: [3, 22],
    exit: { x: 1, y: 3, w: 2, h: 2 },
    pebbles: 3,
    walls: [
      [0, 0, 44, 1], [0, 25, 44, 1], [0, 0, 1, 26], [43, 0, 1, 26],
      [14, 1, 1, 8], [14, 10, 1, 4],
      [1, 15, 8, 1], [11, 15, 10, 1],
      [30, 2, 1, 8], [30, 2, 10, 1], [39, 2, 1, 8], [30, 9, 5, 1], [36, 9, 4, 1],
    ],
    crates: [
      [18, 3, 2, 2], [21, 3, 2, 2], [18, 7, 2, 2], [25, 10, 2, 2], [31, 20, 2, 2],
    ],
    lowCrates: [
      [3, 11, 4, 1], [9, 12, 3, 1], [17, 17, 3, 1], [24, 20, 2, 1], [35, 17, 3, 1],
    ],
    racks: [
      [3, 3, 1, 5], [6, 3, 1, 5], [9, 3, 1, 5], [20, 17, 1, 5], [27, 17, 1, 5],
    ],
    desks: [[33, 4, 4, 1], [16, 22, 3, 1]],
    keycards: [[36, 6]],
    doors: [{ x: 35, y: 9, w: 1, h: 1 }],
    guards: [
      { route: [[2, 9], [6, 9], [6, 12], [2, 12]] },
      { route: [[31, 4], [35, 4], [35, 7], [31, 7]] },
    ],
  },
  {
    id: 'records-hall',
    name: 'Second floor · Records Hall',
    brief: 'Cross the reading room, lift the master key from the east stacks, and take the stair.',
    theme: 1,
    start: [40, 22],
    exit: { x: 1, y: 3, w: 2, h: 2 },
    pebbles: 3,
    walls: [
      [0, 0, 44, 1], [0, 25, 44, 1], [0, 0, 1, 26], [43, 0, 1, 26],
      [13, 1, 1, 7], [13, 10, 1, 6],
      [26, 1, 1, 5], [26, 8, 1, 7],
      [1, 14, 11, 1], [16, 14, 10, 1], [29, 14, 13, 1],
    ],
    crates: [
      [16, 5, 2, 2], [21, 5, 2, 2], [31, 3, 2, 2], [35, 3, 2, 2], [39, 8, 2, 2],
    ],
    lowCrates: [
      [16, 10, 4, 1], [22, 10, 3, 1], [30, 10, 3, 1], [34, 21, 3, 1], [17, 21, 3, 1],
    ],
    racks: [
      [3, 2, 1, 4], [6, 2, 1, 4], [9, 2, 1, 4],
      [17, 2, 1, 4], [20, 2, 1, 4], [23, 2, 1, 4],
      [3, 18, 1, 4], [6, 18, 1, 4], [9, 18, 1, 4],
      [33, 18, 1, 4], [36, 18, 1, 4], [39, 18, 1, 4],
    ],
    desks: [[30, 5, 3, 1], [3, 11, 3, 1], [8, 11, 2, 1]],
    keycards: [[38, 11]],
    doors: [{ x: 27, y: 14, w: 1, h: 1 }],
    guards: [
      { route: [[27, 6], [31, 6], [31, 10], [27, 10]] },
      { route: [[2, 7], [6, 7], [6, 11], [2, 11]] },
      { route: [[14, 8], [18, 8], [18, 11], [14, 11]] },
    ],
  },
  {
    id: 'the-vault',
    name: 'Vault level · The Strongroom',
    brief: 'Four on the floor. Reach the strongroom door, then the roof stair beyond it.',
    theme: 2,
    start: [2, 23],
    exit: { x: 41, y: 22, w: 2, h: 2 },
    pebbles: 4,
    walls: [
      [0, 0, 44, 1], [0, 25, 44, 1], [0, 0, 1, 26], [43, 0, 1, 26],
      [1, 4, 14, 1], [18, 4, 14, 1], [34, 4, 9, 1],
      [1, 12, 10, 1], [14, 12, 8, 1], [25, 12, 18, 1],
      [1, 20, 20, 1], [24, 20, 19, 1],
      [16, 1, 1, 3], [28, 5, 1, 7], [10, 13, 1, 2], [10, 18, 1, 2], [34, 13, 1, 7],
    ],
    crates: [
      [3, 7, 2, 2], [6, 7, 2, 2], [30, 7, 2, 2], [37, 7, 2, 2],
      [5, 16, 2, 2], [9, 16, 2, 2], [31, 16, 2, 2], [36, 16, 2, 2],
    ],
    lowCrates: [
      [14, 8, 3, 1], [26, 9, 3, 1], [15, 22, 4, 1], [27, 22, 4, 1], [20, 16, 3, 1],
    ],
    racks: [
      [20, 6, 1, 4], [24, 6, 1, 4], [20, 16, 1, 3], [24, 16, 1, 3],
    ],
    desks: [[19, 21, 3, 1], [37, 10, 3, 1]],
    keycards: [[21, 9]],
    doors: [{ x: 22, y: 12, w: 1, h: 1 }],
    guards: [
      { route: [[8, 6], [14, 6], [14, 9], [8, 9]] },
      { route: [[20, 21], [24, 21], [24, 24], [20, 24]] },
      { route: [[35, 6], [39, 6], [39, 10], [35, 10]] },
      { route: [[9, 21], [15, 21], [15, 24], [9, 24]] },
    ],
  },
];
