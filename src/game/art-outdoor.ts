// Outdoor art drawn at the origin into shareable GraphicsContexts: cars seen from the side (driving
// east-west) and from the front or rear (parked north-south), street lamps and street furniture.
// Same oblique convention as the rest of the game: the footprint's top face is lifted by the
// object's height and only the south-facing side is visible.
import { GraphicsContext } from 'pixi.js';
import { INK, WHITE, mix, shade } from './palette.ts';

/** Footprint of a car: length along its driving axis, width across it. */
export const CAR = { len: 96, wid: 44, hb: 17, hc: 15 };
export const CAR_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xf1f5f9, 0x9ca3af, 0xa855f7, 0xf97316, 0x334155, 0x0ea5e9, 0x7f1d1d, 0x14532d];

const GLASS = 0x9ccbe6;
const GLASS_DARK = 0x5d8fb3;
const TYRE = 0x1f2937;
const TRIM = 0x475569;
const OUTLINE = { width: 1.4, color: INK, alpha: 0.3 };

const topColor = (c: number): number => mix(c, WHITE, 0.2);

/** Side view, nose to the east; (0, 0) is the footprint centre. Flip with scale.x = -1. */
export function drawCarSide(g: GraphicsContext, color: number): void {
  const { len, wid, hb, hc } = CAR;
  const l = -len / 2;
  const r = len / 2;
  const deckT = -wid / 2 - hb;
  const deckB = wid / 2 - hb;
  const bottom = wid / 2;
  g.roundRect(l + 4, -wid / 2 + 7, len, wid, 14).fill({ color: 0x000000, alpha: 0.22 });
  // Lower body: bonnet/boot deck and the side panel
  g.roundRect(l, deckT, len, wid, 12).fill(topColor(color));
  g.roundRect(l, deckB, len, hb, 7).fill(color);
  g.rect(l + 5, deckB + 1, len - 10, 2).fill({ color: WHITE, alpha: 0.3 });
  g.rect(l + 3, bottom - 6, len - 6, 3).fill({ color: 0x000000, alpha: 0.16 });
  // Cabin: base on the deck, roof lifted by hc
  const bx0 = -34;
  const bx1 = 24;
  const by0 = deckT + 5;
  const by1 = deckB - 3;
  const rx0 = -28;
  const rx1 = 13;
  const ry0 = by0 - hc + 2;
  const ry1 = by1 - hc - 1;
  g.poly([rx0, ry0, bx0, by0, bx0, by1, rx0, ry1]).fill(GLASS_DARK); // rear window
  g.poly([rx1, ry0, bx1, by0, bx1, by1, rx1, ry1]).fill(GLASS); // windscreen
  g.poly([rx1 + 3, ry0 + 3, rx1 + 7, ry0 + 5, rx1 + 7, ry1 - 2, rx1 + 3, ry1 - 4]).fill({ color: WHITE, alpha: 0.45 });
  // Side of the cabin with two windows and the pillars in body colour
  g.poly([rx0, ry1, rx1, ry1, bx1, by1, bx0, by1]).fill(color);
  g.poly([rx0 + 3, ry1 + 2, -8, ry1 + 2, -8, by1 - 2, bx0 + 5, by1 - 2]).fill(GLASS);
  g.poly([-4, ry1 + 2, rx1 - 1, ry1 + 2, bx1 - 5, by1 - 2, -4, by1 - 2]).fill(GLASS);
  g.rect(-1, ry1 + 3, 2.5, by1 - ry1 - 6).fill({ color: WHITE, alpha: 0.45 });
  g.roundRect(rx0, ry0, rx1 - rx0, ry1 - ry0, 7).fill(topColor(color));
  g.roundRect(rx0 + 3, ry0 + 2, rx1 - rx0 - 6, 5, 3).fill({ color: WHITE, alpha: 0.3 });
  g.roundRect(rx0, ry0, rx1 - rx0, ry1 - ry0, 7).stroke({ ...OUTLINE, alpha: 0.2 });
  g.roundRect(bx1 - 3, by1 - 2, 7, 4, 2).fill(shade(color, 0.7)); // mirror
  // Doors and handles
  for (const dx of [-32, -6, 22]) g.rect(dx, deckB + 1, 1.3, hb - 5).fill({ color: 0x000000, alpha: 0.22 });
  for (const dx of [-20, 8]) g.roundRect(dx, deckB + 4, 6, 2, 1).fill({ color: 0x000000, alpha: 0.3 });
  // Lights: seen on the deck corners from above and on the side panel ends
  g.roundRect(r - 6, deckT + 4, 5, 8, 2).fill(0xfef9c3);
  g.roundRect(r - 6, deckB - 12, 5, 8, 2).fill(0xfef9c3);
  g.roundRect(l + 1, deckT + 4, 4, 8, 2).fill(0xef4444);
  g.roundRect(l + 1, deckB - 12, 4, 8, 2).fill(0xef4444);
  g.roundRect(r - 5, deckB + 3, 5, 5, 2).fill(0xfef9c3);
  g.roundRect(l, deckB + 3, 4, 5, 2).fill(0xef4444);
  g.roundRect(r - 7, bottom - 7, 8, 6, 2).fill(TRIM);
  g.roundRect(l - 1, bottom - 7, 8, 6, 2).fill(TRIM);
  // Wheels under their arches
  for (const wx of [l + 20, r - 20]) {
    g.moveTo(wx - 11.5, bottom - 2).arc(wx, bottom - 2, 11.5, Math.PI, 0).closePath().fill(shade(color, 0.45));
    g.circle(wx, bottom - 1, 9).fill(TYRE);
    g.circle(wx, bottom - 1, 4.2).fill(0xcbd5e1);
    g.circle(wx, bottom - 1, 1.4).fill(0x64748b);
  }
  g.roundRect(l, deckT, len, bottom - deckT, 11).stroke(OUTLINE);
}

/**
 * A car parked north-south, (0, 0) the footprint centre. `nose` = true: it faces south and shows its
 * grille; false: it faces north and shows its tail lights.
 */
export function drawCarEnd(g: GraphicsContext, color: number, nose: boolean): void {
  const { len, wid, hb, hc } = CAR;
  const w2 = wid / 2;
  const deckT = -len / 2 - hb;
  const deckB = len / 2 - hb;
  const bottom = len / 2;
  g.roundRect(-w2 + 3, -len / 2 + 8, wid, len, 14).fill({ color: 0x000000, alpha: 0.22 });
  // Tyres peeking out at the sides
  for (const ty of [deckT + 16, deckB - 26]) {
    g.roundRect(-w2 - 2, ty, 5, 14, 2).fill(TYRE);
    g.roundRect(w2 - 3, ty, 5, 14, 2).fill(TYRE);
  }
  g.roundRect(-w2, deckT, wid, len, 12).fill(topColor(color));
  g.roundRect(-w2, deckB, wid, hb, 7).fill(color);
  g.rect(-w2 + 4, deckB + 1, wid - 8, 2).fill({ color: WHITE, alpha: 0.3 });
  // Cabin: a long bonnet on the nose side; the sloping glass at its south end faces us
  const lift = hc - 3;
  const by0 = nose ? deckT + 22 : deckT + 30;
  const by1 = nose ? deckT + 64 : deckT + 72;
  const ry0 = by0 + 12 - lift;
  const ry1 = by1 - 2 - lift;
  g.poly([-16, ry1, 16, ry1, 19, by1, -19, by1]).fill(nose ? GLASS : GLASS_DARK);
  g.poly([-12, ry1 + 3, -6, ry1 + 3, -10, by1 - 3, -16, by1 - 3]).fill({ color: WHITE, alpha: 0.4 });
  g.poly([-16, ry0, -19, by0, -19, by1, -16, ry1]).fill(GLASS_DARK);
  g.poly([16, ry0, 19, by0, 19, by1, 16, ry1]).fill(GLASS_DARK);
  g.roundRect(-16, ry0, 32, ry1 - ry0, 7).fill(topColor(color));
  g.roundRect(-13, ry0 + 2, 26, 4, 2).fill({ color: WHITE, alpha: 0.3 });
  g.roundRect(-16, ry0, 32, ry1 - ry0, 7).stroke({ ...OUTLINE, alpha: 0.2 });
  // Mirrors
  g.roundRect(-w2 - 3, (nose ? by1 : by0) - 8, 5, 4, 2).fill(shade(color, 0.7));
  g.roundRect(w2 - 2, (nose ? by1 : by0) - 8, 5, 4, 2).fill(shade(color, 0.7));
  // South end face
  if (nose) {
    g.roundRect(-10, deckB + 5, 20, 7, 3).fill(0x334155);
    for (let k = 0; k < 3; k++) g.rect(-8, deckB + 6.5 + k * 2, 16, 0.8).fill({ color: WHITE, alpha: 0.3 });
    g.roundRect(-w2 + 2, deckB + 3, 9, 6, 3).fill(0xfef9c3);
    g.roundRect(w2 - 11, deckB + 3, 9, 6, 3).fill(0xfef9c3);
    g.roundRect(-w2 + 3, deckB - 6, 7, 4, 2).fill({ color: 0xfef9c3, alpha: 0.8 });
    g.roundRect(w2 - 10, deckB - 6, 7, 4, 2).fill({ color: 0xfef9c3, alpha: 0.8 });
  } else {
    g.roundRect(-w2 + 2, deckB + 3, 10, 6, 2).fill(0xef4444);
    g.roundRect(w2 - 12, deckB + 3, 10, 6, 2).fill(0xef4444);
    g.roundRect(-7, deckB + 5, 14, 6, 1.5).fill(0xf8fafc).stroke({ width: 0.8, color: 0x1e3a8a, alpha: 0.6 });
    g.roundRect(-w2 + 3, deckB - 6, 7, 4, 2).fill({ color: 0xef4444, alpha: 0.8 });
    g.roundRect(w2 - 10, deckB - 6, 7, 4, 2).fill({ color: 0xef4444, alpha: 0.8 });
  }
  g.roundRect(-w2 + 1, bottom - 5, wid - 2, 5, 2).fill(TRIM);
  g.roundRect(-w2, deckT, wid, bottom - deckT, 11).stroke(OUTLINE);
}

/** Street lamp with its base at the origin and the arm reaching west (flip with scale.x = -1). */
export function drawLamp(g: GraphicsContext): void {
  g.ellipse(2, 0, 8, 3).fill({ color: 0x000000, alpha: 0.22 });
  g.roundRect(-5, -9, 10, 9, 2).fill(0x334155);
  g.rect(-2, -104, 4, 96).fill(0x4b5563);
  g.rect(-2, -104, 1.5, 96).fill({ color: WHITE, alpha: 0.25 });
  g.moveTo(0, -102).quadraticCurveTo(0, -112, -12, -112).lineTo(-20, -112).stroke({ width: 3, color: 0x4b5563 });
  g.roundRect(-34, -116, 24, 8, 4).fill(0x1f2937);
  g.roundRect(-32, -109, 20, 3.5, 1.5).fill(0xfef3c7);
  g.ellipse(-22, -104, 12, 3).fill({ color: 0xfef3c7, alpha: 0.18 });
}

export function drawHydrant(g: GraphicsContext): void {
  g.ellipse(1, 0, 8, 3).fill({ color: 0x000000, alpha: 0.2 });
  g.roundRect(-5, -18, 10, 18, 3).fill(0xdc2626);
  g.roundRect(-7, -20, 14, 4, 2).fill(0xb91c1c);
  g.circle(0, -22, 4).fill(0xdc2626);
  g.rect(-8, -12, 3, 4).fill(0xb91c1c);
  g.rect(5, -12, 3, 4).fill(0xb91c1c);
  g.rect(-3, -17, 2, 14).fill({ color: WHITE, alpha: 0.3 });
}

export function drawBollard(g: GraphicsContext): void {
  g.ellipse(1, 0, 6, 2.4).fill({ color: 0x000000, alpha: 0.2 });
  g.roundRect(-4, -22, 8, 22, 3).fill(0xfacc15);
  g.rect(-4, -17, 8, 3).fill(0x1f2937);
  g.rect(-4, -9, 8, 3).fill(0x1f2937);
  g.rect(-2.5, -21, 1.5, 20).fill({ color: WHITE, alpha: 0.3 });
}

export function drawBench(g: GraphicsContext): void {
  g.ellipse(0, 2, 30, 5).fill({ color: 0x000000, alpha: 0.16 });
  for (const lx of [-22, 20]) g.rect(lx, -12, 3, 12).fill(0x374151);
  g.roundRect(-28, -16, 56, 8, 2).fill(0xb45309);
  g.rect(-28, -14, 56, 1.2).fill({ color: WHITE, alpha: 0.25 });
  g.roundRect(-28, -30, 56, 9, 2).fill(0xc2410c);
  g.rect(-28, -27, 56, 1.2).fill({ color: WHITE, alpha: 0.25 });
  for (const lx of [-22, 20]) g.rect(lx, -30, 3, 16).fill(0x374151);
}

export function drawBin(g: GraphicsContext): void {
  g.ellipse(1, 1, 9, 3).fill({ color: 0x000000, alpha: 0.18 });
  g.roundRect(-7, -22, 14, 22, 3).fill(0x15803d);
  g.roundRect(-8, -24, 16, 5, 2).fill(0x166534);
  g.rect(-4, -18, 2, 14).fill({ color: WHITE, alpha: 0.25 });
}

export function drawParkingSign(g: GraphicsContext): void {
  g.ellipse(1, 0, 5, 2).fill({ color: 0x000000, alpha: 0.2 });
  g.rect(-1.5, -58, 3, 58).fill(0x6b7280);
  g.roundRect(-11, -78, 22, 22, 4).fill(0x2563eb).stroke({ width: 1.5, color: WHITE });
  g.rect(-5, -73, 3.4, 13).fill(WHITE);
  g.moveTo(-3.5, -71.3).lineTo(0.5, -71.3).arc(0.5, -68, 3.3, -Math.PI / 2, Math.PI / 2).lineTo(-3.5, -64.7).stroke({ width: 3, color: WHITE });
}

/** Round shrub in a concrete planter. */
export function drawPlanter(g: GraphicsContext, leaf: number): void {
  g.ellipse(1, 1, 16, 4).fill({ color: 0x000000, alpha: 0.16 });
  g.roundRect(-14, -12, 28, 12, 3).fill(0xa8a29e);
  g.roundRect(-14, -16, 28, 5, 2).fill(0xd6d3d1);
  g.circle(-5, -22, 9).fill(shade(leaf, 0.8));
  g.circle(6, -21, 8).fill(shade(leaf, 0.8));
  g.circle(0, -27, 9).fill(leaf);
  g.circle(-3, -30, 4).fill({ color: WHITE, alpha: 0.15 });
}

const carCache = new Map<string, GraphicsContext>();

/** Shared geometry for a car of one colour seen from the side, the front ('nose') or the rear. */
export function carContext(kind: 'side' | 'nose' | 'tail', color: number): GraphicsContext {
  const key = `${kind}_${color}`;
  let c = carCache.get(key);
  if (!c) {
    c = new GraphicsContext();
    if (kind === 'side') drawCarSide(c, color);
    else drawCarEnd(c, color, kind === 'nose');
    carCache.set(key, c);
  }
  return c;
}
