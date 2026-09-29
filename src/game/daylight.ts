// Time of day: a slow cycle from morning through sunset and night back to dawn, driven by play time.
// Night falls on the surroundings (ground, cars, vans, trucks, lamps); the warehouse stays lit, its
// windows show the sky, and street lamps, wall lamps and headlights glow.
import { Container, Sprite, Texture } from 'pixi.js';
import { mix } from './palette.ts';
import type { Background } from './views/background.ts';
import type { Outdoor } from './views/outdoor.ts';

/** Seconds of play for a full day. */
const CYCLE = 480;
/** Where in the cycle a location starts: early morning light. */
const START = 0.03;

interface Key {
  t: number;
  /** Multiply colour for everything outside. */
  shade: number;
  /** Lamps and headlights, 0..1. */
  lamps: number;
  /** Sunlight through the windows, 0..1. */
  sun: number;
  /** Colour and strength of the sky seen through the windows. */
  sky: number;
  skyA: number;
}

const KEYS: Key[] = [
  { t: 0, shade: 0xf3e2d4, lamps: 0.25, sun: 0.7, sky: 0xf7c9a8, skyA: 0.35 },
  { t: 0.08, shade: 0xffffff, lamps: 0, sun: 1, sky: 0xffffff, skyA: 0 },
  { t: 0.5, shade: 0xffffff, lamps: 0, sun: 1, sky: 0xffffff, skyA: 0 },
  { t: 0.58, shade: 0xffdcb4, lamps: 0, sun: 0.95, sky: 0xffc07a, skyA: 0.35 },
  { t: 0.64, shade: 0xe9a58c, lamps: 0.4, sun: 0.55, sky: 0xf08a5d, skyA: 0.55 },
  { t: 0.7, shade: 0x8e87b6, lamps: 0.85, sun: 0.1, sky: 0x4b4a7a, skyA: 0.75 },
  { t: 0.76, shade: 0x5d6796, lamps: 1, sun: 0, sky: 0x1b2442, skyA: 0.88 },
  { t: 0.9, shade: 0x5d6796, lamps: 1, sun: 0, sky: 0x1b2442, skyA: 0.88 },
  { t: 0.96, shade: 0xb4a6c6, lamps: 0.6, sun: 0.3, sky: 0x8f7fae, skyA: 0.5 },
  { t: 1, shade: 0xf3e2d4, lamps: 0.25, sun: 0.7, sky: 0xf7c9a8, skyA: 0.35 },
];

let glow: Texture | null = null;

/** Soft round light, white, for additive glows. */
export function glowTexture(): Texture {
  if (glow) return glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glow = Texture.from(c);
  return glow;
}

function light(x: number, y: number, w: number, h: number, tint: number): Sprite {
  const s = new Sprite(glowTexture());
  s.anchor.set(0.5);
  s.position.set(x, y);
  s.width = w;
  s.height = h;
  s.tint = tint;
  s.blendMode = 'add';
  return s;
}

export class Daylight {
  /** Bright spots at lamp heads, drawn above everything in the world. */
  readonly blooms = new Container();
  private readonly pools: Sprite[] = [];
  private readonly heads: Sprite[] = [];
  private readonly beams: Sprite[] = [];
  private readonly beamLayer = new Container();
  private lastShade = -1;
  /** Fixed point in the cycle (0..1) for thumbnails; null follows play time. */
  fixed: number | null = null;
  /** Current state, for other views (0 = full day, 1 = full night). */
  lamps = 0;

  constructor(
    private readonly bg: Background,
    private readonly outdoor: Outdoor,
    /** Outdoor nodes that are not part of the outdoor view (vans, trucks, the unloaders). */
    private readonly outside: () => Container[],
  ) {
    for (const l of outdoor.lamps) {
      const pool = light(l.gx, l.gy, 170, 80, 0xffd28a);
      this.pools.push(pool);
      bg.groundLights.addChild(pool);
      const head = light(l.hx, l.hy + 2, 46, 30, 0xffe2a8);
      this.heads.push(head);
      this.blooms.addChild(head);
    }
    // Lamps on the back-wall columns inside the warehouse
    for (const cx of bg.columnXs) {
      const head = light(cx, bg.columnLampY, 38, 22, 0xfff0c8);
      this.heads.push(head);
      this.blooms.addChild(head);
    }
    bg.groundLights.addChild(this.beamLayer);
  }

  private state(p: number): Key {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1]!.t <= p) i++;
    const a = KEYS[i]!;
    const b = KEYS[i + 1]!;
    const k = Math.max(0, Math.min(1, (p - a.t) / Math.max(1e-6, b.t - a.t)));
    return {
      t: p,
      shade: mix(a.shade, b.shade, k),
      lamps: a.lamps + (b.lamps - a.lamps) * k,
      sun: a.sun + (b.sun - a.sun) * k,
      sky: mix(a.sky, b.sky, k),
      skyA: a.skyA + (b.skyA - a.skyA) * k,
    };
  }

  update(time: number): void {
    const p = this.fixed ?? (time / CYCLE + START) % 1;
    const s = this.state(p);
    const bg = this.bg;
    this.lamps = s.lamps;
    if (s.shade !== this.lastShade) {
      this.lastShade = s.shade;
      bg.nightShade.visible = s.shade !== 0xffffff;
      bg.nightShade.tint = s.shade;
      this.outdoor.setTint(s.shade);
      for (const n of this.outside()) n.tint = s.shade;
      if (bg.walls) bg.walls.tint = mix(0xffffff, s.shade, 0.3);
    }
    bg.windowGlass.tint = s.sky;
    bg.windowGlass.alpha = s.skyA;
    bg.sunlight.alpha = s.sun;
    bg.lampLight.alpha = 0.5 + 0.5 * s.lamps;
    const on = s.lamps > 0.02;
    for (const l of this.pools) {
      l.visible = on;
      l.alpha = s.lamps * 0.75;
    }
    for (const l of this.heads) {
      l.visible = on;
      l.alpha = s.lamps;
    }
    this.updateBeams(on ? s.lamps : 0);
  }

  /** Headlight beams in front of moving cars. */
  private updateBeams(a: number): void {
    const cars = a > 0 ? this.outdoor.headlights() : [];
    while (this.beams.length < cars.length) {
      const b = light(0, 0, 110, 34, 0xfff1c4);
      this.beams.push(b);
      this.beamLayer.addChild(b);
    }
    this.beams.forEach((b, i) => {
      const c = cars[i];
      b.visible = c !== undefined;
      if (!c) return;
      b.position.set(c.x, c.y);
      b.width = c.vertical ? 46 : 110;
      b.height = c.vertical ? 70 : 34;
      b.alpha = a * 0.8;
    });
  }
}

