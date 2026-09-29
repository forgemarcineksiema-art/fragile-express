// Follow camera with look-ahead, world clamping and a short "reveal" pan to newly unlocked things.
import type { Container } from 'pixi.js';
import { clamp, damp, easeInOutQuad } from '../core/math.ts';

/** Visible world area at zoom 1 on the 16:9 base resolution (1031×580). */
const VIEW_AREA = 930 * 523;
const MIN_VIEW_W = 560;

interface Reveal {
  x: number;
  y: number;
  t: number;
  fromX: number;
  fromY: number;
}

/** Zoom that shows about the same world area on any screen (narrow screens keep a minimum width). */
export function baseZoomFor(w: number, h: number): number {
  const z = Math.sqrt((w * h) / VIEW_AREA);
  return w / z < MIN_VIEW_W ? w / MIN_VIEW_W : z;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  /** Zoom for the screen size; `zoom` pulls back from it while a tall stack is carried. */
  private baseZoom = 1;
  private zoomMul = 1;
  viewW = 1031;
  viewH = 580;
  private reveal: Reveal | null = null;
  private bounds = { x: 0, y: 0, w: 1000, h: 800 };

  setBounds(x: number, y: number, w: number, h: number): void {
    this.bounds = { x, y, w, h };
  }

  /** Development override (overview screenshots). */
  fixedZoom: number | null = null;

  resize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    const z = baseZoomFor(w, h);
    this.baseZoom = z;
    this.zoom = this.fixedZoom ?? z * this.zoomMul;
  }

  get revealing(): boolean {
    return this.reveal !== null;
  }

  private queue: { x: number; y: number }[] = [];

  /** Pans to a point for a moment; reveals requested during another one play after it. */
  startReveal(x: number, y: number): void {
    if (this.reveal) {
      this.queue.push({ x, y });
      return;
    }
    this.reveal = { x, y, t: 0, fromX: this.x, fromY: this.y };
  }

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.clampToBounds();
  }

  /** Development override: keep the camera on a point instead of the player. */
  pin: { x: number; y: number } | null = null;
  /** How far above the player the camera currently looks (tall stacks). */
  private lift = 0;

  /**
   * Follows (fx, fy). `stackH` is how far the carried stack reaches above the feet: a tall tower
   * makes the camera look up and pull back so the top (and the wobble bar) stays on screen.
   */
  update(dt: number, fx: number, fy: number, vx: number, vy: number, stackH = 0): void {
    if (this.fixedZoom === null) {
      const viewH = this.viewH / this.baseZoom;
      const fit = clamp((viewH * 0.9) / (stackH + 190), 0.68, 1);
      this.zoomMul += (fit - this.zoomMul) * damp(2.2, dt);
      this.zoom = this.baseZoom * this.zoomMul;
    }
    this.lift += (Math.max(0, stackH * 0.5 - 60) - this.lift) * damp(3, dt);
    fy -= this.lift;
    if (this.pin) {
      // Pinned shots frame exactly (the capture may be narrower than the screen).
      this.x = this.pin.x;
      this.y = this.pin.y;
      return;
    }
    const r = this.reveal;
    if (r) {
      // Pan out (0.7 s), hold (1.1 s), pan back (0.6 s).
      r.t += dt;
      if (r.t < 0.7) {
        const k = easeInOutQuad(r.t / 0.7);
        this.x = r.fromX + (r.x - r.fromX) * k;
        this.y = r.fromY + (r.y - r.fromY) * k;
      } else if (r.t < 1.8) {
        this.x = r.x;
        this.y = r.y;
        if (r.t + dt >= 1.8 && this.queue.length > 0) {
          // Chain straight into the next reveal instead of returning to the player first.
          const n = this.queue.shift()!;
          this.reveal = { x: n.x, y: n.y, t: 0, fromX: this.x, fromY: this.y };
        }
      } else if (r.t < 2.4) {
        const k = easeInOutQuad((r.t - 1.8) / 0.6);
        this.x = r.x + (fx - r.x) * k;
        this.y = r.y + (fy - r.y) * k;
      } else {
        this.reveal = null;
      }
      this.clampToBounds();
      return;
    }
    const lookX = fx + clamp(vx, -260, 260) * 0.22;
    const lookY = fy + clamp(vy, -260, 260) * 0.18;
    const k = damp(6, dt);
    this.x += (lookX - this.x) * k;
    this.y += (lookY - this.y) * k;
    this.clampToBounds();
  }

  private clampToBounds(): void {
    const b = this.bounds;
    const hw = this.viewW / this.zoom / 2;
    const hh = this.viewH / this.zoom / 2;
    this.x = b.w <= hw * 2 ? b.x + b.w / 2 : clamp(this.x, b.x + hw, b.x + b.w - hw);
    this.y = b.h <= hh * 2 ? b.y + b.h / 2 : clamp(this.y, b.y + hh, b.y + b.h - hh);
  }

  private shakeT = 0;
  private shakeAmp = 0;

  shake(amp: number, time = 0.3): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, time);
  }

  apply(root: Container, dt: number): void {
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 3;
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    root.scale.set(this.zoom);
    root.position.set(Math.round(this.viewW / 2 - this.x * this.zoom + sx), Math.round(this.viewH / 2 - this.y * this.zoom + sy));
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.x) * this.zoom + this.viewW / 2, y: (y - this.y) * this.zoom + this.viewH / 2 };
  }
}
