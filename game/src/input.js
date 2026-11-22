// Keyboard and mouse, kept apart from the rules so the game can be driven by a person or by a
// scripted scene. The mouse position is in world pixels, which is what a thrown pebble needs.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, clicked: false };
    this.anyKey = false;

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
      this.anyKey = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    const toWorld = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
      return { x, y };
    };
    canvas.addEventListener('mousemove', (ev) => {
      const p = toWorld(ev);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (ev) => {
      const p = toWorld(ev);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.clicked = true;
      this.anyKey = true;
    });
  }

  /** True once per physical press of the key. */
  hit(code) {
    return this.pressed.has(code);
  }

  held(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  get axis() {
    const x = (this.held('KeyD', 'ArrowRight') ? 1 : 0) - (this.held('KeyA', 'ArrowLeft') ? 1 : 0);
    const y = (this.held('KeyS', 'ArrowDown') ? 1 : 0) - (this.held('KeyW', 'ArrowUp') ? 1 : 0);
    return { x, y };
  }

  /** The frame's input, then forget the one-shot edges. */
  take() {
    const axis = this.axis;
    const frame = {
      x: axis.x,
      y: axis.y,
      crouch: this.held('ShiftLeft', 'ShiftRight'),
      sprint: this.held('Space'),
      interact: this.hit('KeyE'),
      throw: this.hit('KeyQ') || this.mouse.clicked,
      restart: this.hit('KeyR'),
      any: this.anyKey || this.pressed.size > 0,
      mouse: { x: this.mouse.x, y: this.mouse.y },
    };
    this.pressed.clear();
    this.mouse.clicked = false;
    return frame;
  }
}
