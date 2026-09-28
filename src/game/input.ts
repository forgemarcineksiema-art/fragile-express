// Keyboard (WASD / arrows, Shift = careful walk) and a floating virtual joystick anywhere on the screen
// (small tilt = walk, full tilt = run). Mouse drag works as the joystick too.

export interface MoveIntent {
  x: number;
  y: number;
  careful: boolean;
}

const RADIUS = 58; // CSS px for full tilt
const DEAD = 0.14;
const WALK_MAX = 0.62; // below this tilt the joystick walks carefully

export class Input {
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private ox = 0;
  private oy = 0;
  private cx = 0;
  private cy = 0;
  enabled = true;
  /** First real movement input (drives gameplayStart and audio unlock). */
  onActivity: (() => void) | null = null;
  onPause: (() => void) | null = null;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  constructor(private readonly surface: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    surface.appendChild(this.base);

    window.addEventListener('keydown', this.keyDown, { passive: false });
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', () => this.clear());
    surface.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
  }

  private readonly keyDown = (e: KeyboardEvent): void => {
    const k = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === 'Escape' || k === 'Space' || k === 'KeyP') {
      this.onPause?.();
      return;
    }
    this.keys.add(k);
    if (this.enabled && this.isMoveKey(k)) this.onActivity?.();
  };

  private readonly keyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private isMoveKey(k: string): boolean {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k);
  }

  private readonly down = (e: PointerEvent): void => {
    if (!this.enabled || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Buttons, selects and open screens handle their own input.
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, select, .screen, .ad-overlay')) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.ox = this.cx = e.clientX;
    this.oy = this.cy = e.clientY;
    const r = this.surface.getBoundingClientRect();
    this.base.style.left = `${e.clientX - r.left}px`;
    this.base.style.top = `${e.clientY - r.top}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.classList.add('on');
    this.onActivity?.();
  };

  private readonly move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.cx = e.clientX;
    this.cy = e.clientY;
    let dx = this.cx - this.ox;
    let dy = this.cy - this.oy;
    const len = Math.hypot(dx, dy);
    // Floating base: drag it along when the finger goes past the rim.
    if (len > RADIUS) {
      const over = len - RADIUS;
      this.ox += (dx / len) * over;
      this.oy += (dy / len) * over;
      const r = this.surface.getBoundingClientRect();
      this.base.style.left = `${this.ox - r.left}px`;
      this.base.style.top = `${this.oy - r.top}px`;
      dx = this.cx - this.ox;
      dy = this.cy - this.oy;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  private readonly up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.base.classList.remove('on');
  };

  clear(): void {
    this.keys.clear();
    this.pointerId = null;
    this.base.classList.remove('on');
  }

  get usingJoystick(): boolean {
    return this.pointerId !== null;
  }

  read(): MoveIntent {
    if (!this.enabled) return { x: 0, y: 0, careful: false };
    if (this.pointerId !== null) {
      const dx = this.cx - this.ox;
      const dy = this.cy - this.oy;
      const m = Math.min(1, Math.hypot(dx, dy) / RADIUS);
      if (m < DEAD) return { x: 0, y: 0, careful: false };
      const len = Math.hypot(dx, dy);
      return { x: dx / len, y: dy / len, careful: m < WALK_MAX };
    }
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const careful = k.has('ShiftLeft') || k.has('ShiftRight');
    if (x === 0 && y === 0) return { x: 0, y: 0, careful };
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len, careful };
  }
}
