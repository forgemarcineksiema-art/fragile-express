// Small math helpers shared by the simulation and the renderer.

export interface Vec {
  x: number;
  y: number;
}

/** Axis-aligned rectangle: top-left corner plus size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

/** Moves `v` toward `target` by at most `step`. */
export const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export const rectCenter = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inflate = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 });
export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** True when segment (x0,y0)-(x1,y1) crosses the rectangle (Liang–Barsky clip). */
export function segmentHitsRect(x0: number, y0: number, x1: number, y1: number, r: Rect): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      if (qi < 0) return false;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

/** Pushes a circle out of a rectangle. Returns the corrected centre or null when not overlapping. */
export function pushCircleOutOfRect(cx: number, cy: number, radius: number, r: Rect): Vec | null {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return null;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * radius, y: ny + (dy / d) * radius };
  }
  // Centre is inside the rectangle: leave through the nearest edge.
  const left = cx - r.x;
  const right = r.x + r.w - cx;
  const top = cy - r.y;
  const bottom = r.y + r.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: r.x - radius, y: cy };
  if (m === right) return { x: r.x + r.w + radius, y: cy };
  if (m === top) return { x: cx, y: r.y - radius };
  return { x: cx, y: r.y + r.h + radius };
}
