// Vector art drawn in code (no image assets). Every function draws into a Graphics around an anchor.
// Projection: top-down with a slight tilt. Ground footprint is drawn 1:1; heights go straight up the screen,
// so a box shows its top face and its south (front) face.
import type { Graphics } from 'pixi.js';
import { COIN, COIN_DARK, COIN_LIGHT, INK, WHITE, shade, type SymbolKind } from './palette.ts';

export const PARCEL = { w: 26, d: 12, h: 16 };
export const PARCEL_XXL = { w: 40, d: 18, h: 26 };

export function drawSymbol(g: Graphics, x: number, y: number, s: number, kind: SymbolKind, color: number): void {
  switch (kind) {
    case 'circle':
      g.circle(x, y, s * 0.55).fill(color);
      break;
    case 'square':
      g.rect(x - s * 0.5, y - s * 0.5, s, s).fill(color);
      break;
    case 'triangle':
      g.poly([x, y - s * 0.6, x + s * 0.6, y + s * 0.45, x - s * 0.6, y + s * 0.45]).fill(color);
      break;
    case 'star':
      g.star(x, y + s * 0.05, 5, s * 0.65, s * 0.3, 0).fill(color);
      break;
    case 'diamond':
      g.poly([x, y - s * 0.65, x + s * 0.5, y, x, y + s * 0.65, x - s * 0.5, y]).fill(color);
      break;
    case 'heart': {
      const r = s * 0.3;
      g.circle(x - r * 0.95, y - r * 0.4, r).fill(color);
      g.circle(x + r * 0.95, y - r * 0.4, r).fill(color);
      g.poly([x - s * 0.58, y - r * 0.15, x + s * 0.58, y - r * 0.15, x, y + s * 0.6]).fill(color);
      break;
    }
  }
}

export function drawGlass(g: Graphics, x: number, y: number, s: number, color: number): void {
  // Wine glass: bowl, stem, foot.
  g.moveTo(x - s * 0.42, y - s * 0.6)
    .lineTo(x + s * 0.42, y - s * 0.6)
    .quadraticCurveTo(x + s * 0.42, y + s * 0.05, x, y + s * 0.08)
    .quadraticCurveTo(x - s * 0.42, y + s * 0.05, x - s * 0.42, y - s * 0.6)
    .fill(color);
  g.rect(x - s * 0.06, y + s * 0.05, s * 0.12, s * 0.4).fill(color);
  g.rect(x - s * 0.28, y + s * 0.42, s * 0.56, s * 0.1).fill(color);
}

export function drawBolt(g: Graphics, x: number, y: number, s: number, color: number): void {
  g.poly([
    x + s * 0.1, y - s * 0.65,
    x - s * 0.4, y + s * 0.08,
    x - s * 0.02, y + s * 0.08,
    x - s * 0.12, y + s * 0.65,
    x + s * 0.42, y - s * 0.12,
    x + s * 0.02, y - s * 0.12,
  ]).fill(color);
}

/**
 * A parcel with its anchor at the bottom-centre of the front face (x, by).
 * `kind` adds the fragile label, express bolt or XXL tape; `sorted` adds a white address label.
 */
export function drawParcel(
  g: Graphics,
  x: number,
  by: number,
  color: number,
  symbol: SymbolKind,
  kind: 'normal' | 'fragile' | 'express' | 'xxl',
  sorted: boolean,
): void {
  const { w, d, h } = kind === 'xxl' ? PARCEL_XXL : PARCEL;
  const left = x - w / 2;
  const topY = by - h - d;
  const front = color;
  const top = shade(color, 1.22);
  // Faces
  g.rect(left, by - h, w, h).fill(front);
  g.rect(left, topY, w, d).fill(top);
  // Soft vertical shading on the front face
  g.rect(left, by - 3, w, 3).fill({ color: 0x000000, alpha: 0.12 });
  // Tape across the lid and down the front
  const tape = kind === 'fragile' ? 0xfef2f2 : kind === 'express' ? 0xfde047 : shade(color, 1.5);
  const tw = kind === 'xxl' ? 8 : 5;
  g.rect(x - tw / 2, topY, tw, d).fill({ color: tape, alpha: 0.9 });
  g.rect(x - tw / 2, by - h, tw, h * 0.35).fill({ color: tape, alpha: 0.9 });
  if (kind === 'fragile') {
    // Red hazard ticks on the tape
    for (let i = 0; i < 3; i++) g.rect(x - tw / 2, topY + 1 + i * 4, tw, 2).fill(0xdc2626);
  }
  // Lid edge highlight
  g.rect(left, by - h - 1, w, 1.5).fill({ color: WHITE, alpha: 0.35 });
  // District symbol (always), plus the fragile glass / express bolt
  const sy = by - h * 0.42;
  const ss = kind === 'xxl' ? 11 : 7;
  if (kind === 'normal' || kind === 'xxl') {
    g.circle(x, sy, ss * 0.78).fill({ color: WHITE, alpha: 0.95 });
    drawSymbol(g, x, sy, ss * 0.9, symbol, shade(color, 0.72));
  } else {
    g.circle(x - 6, sy, 5.4).fill({ color: WHITE, alpha: 0.95 });
    drawSymbol(g, x - 6, sy, 6.2, symbol, shade(color, 0.72));
    if (kind === 'fragile') {
      g.roundRect(x + 1, sy - 6, 11, 12, 2).fill(0xdc2626);
      drawGlass(g, x + 6.5, sy - 0.5, 9, WHITE);
    } else {
      g.roundRect(x + 1, sy - 6, 11, 12, 2).fill(0x1e293b);
      drawBolt(g, x + 6.5, sy, 10, 0xfde047);
    }
  }
  if (sorted) {
    // Address label on the lid
    const lw = kind === 'xxl' ? 14 : 9;
    const lx = x + w / 2 - lw - 3;
    g.rect(lx, topY + 2, lw, d - 4).fill(WHITE);
    g.rect(lx + 1.5, topY + 3.5, lw - 3, 1).fill(0x94a3b8);
    g.rect(lx + 1.5, topY + 6, lw - 5, 1).fill(0x94a3b8);
  }
  // Outline
  g.rect(left, topY, w, d + h).stroke({ width: 1.2, color: INK, alpha: 0.45, alignment: 1 });
  g.moveTo(left, by - h).lineTo(left + w, by - h).stroke({ width: 1, color: INK, alpha: 0.25 });
}

/** Five-point star squashed vertically by `sy` (embossed on coins). */
function starPoly(g: Graphics, x: number, y: number, r: number, sy: number, color: number, alpha: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * sy);
  }
  g.poly(pts).fill({ color, alpha });
}

/** Coin lying flat (piles). Anchor: centre of the top face. */
export function drawCoin(g: Graphics, x: number, y: number): void {
  const rx = 8.5;
  const ry = 5;
  g.ellipse(x, y + 2.4, rx, ry).fill(0xb45309);
  g.rect(x - rx, y, rx * 2, 2.4).fill(COIN_DARK);
  g.ellipse(x, y, rx, ry).fill(COIN);
  g.ellipse(x, y, rx * 0.72, ry * 0.72).stroke({ width: 1.1, color: COIN_DARK, alpha: 0.55 });
  starPoly(g, x, y + 0.2, 3, 0.6, COIN_DARK, 0.5);
  g.ellipse(x - 3.2, y - 2, 2.6, 1.1).fill({ color: COIN_LIGHT, alpha: 0.95 });
}

/** Coin seen face-on (flying coins spin by scaling it horizontally). */
export function drawCoinFace(g: Graphics, x: number, y: number): void {
  g.circle(x, y, 9).fill(0xb45309);
  g.circle(x, y - 0.8, 8.4).fill(COIN);
  g.circle(x, y - 0.8, 6).stroke({ width: 1.3, color: COIN_DARK, alpha: 0.6 });
  starPoly(g, x, y - 0.8, 3.6, 1, COIN_DARK, 0.55);
  g.moveTo(x - 6, y - 3).arc(x, y - 0.8, 6.4, Math.PI * 1.1, Math.PI * 1.45).stroke({ width: 1.6, color: COIN_LIGHT, cap: 'round' });
}

/** Four-point sparkle. */
export function drawGlint(g: Graphics, x: number, y: number): void {
  g.poly([x, y - 9, x + 1.8, y - 1.8, x + 9, y, x + 1.8, y + 1.8, x, y + 9, x - 1.8, y + 1.8, x - 9, y, x - 1.8, y - 1.8]).fill(WHITE);
  g.circle(x, y, 2).fill(WHITE);
}

/** Bundle of banknotes (bigger payouts). Anchor: bottom centre of the front face. */
export function drawCash(g: Graphics, x: number, by: number): void {
  const w = 24;
  const d = 11;
  const h = 6;
  g.rect(x - w / 2, by - h, w, h).fill(0x15803d);
  for (let k = 1; k < 3; k++) g.rect(x - w / 2, by - h + k * 2, w, 0.8).fill({ color: 0xbbf7d0, alpha: 0.7 });
  g.rect(x - w / 2, by - h - d, w, d).fill(0x4ade80);
  g.rect(x - w / 2 + 2, by - h - d + 2, w - 4, d - 4).stroke({ width: 0.8, color: 0x166534, alpha: 0.6 });
  g.circle(x, by - h - d / 2, 2.4).stroke({ width: 1, color: 0x166534, alpha: 0.7 });
  g.rect(x - 2.5, by - h - d, 5, d + h).fill(0xfef3c7);
  g.rect(x - w / 2, by - h - d, w, d + h).stroke({ width: 1, color: INK, alpha: 0.35 });
}

/** Round coin icon for HUD / pads (front view). */
export function drawCoinIcon(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y + r * 0.12, r).fill(COIN_DARK);
  g.circle(x, y, r).fill(COIN);
  g.circle(x, y, r * 0.68).stroke({ width: Math.max(1, r * 0.14), color: COIN_DARK, alpha: 0.75 });
  g.rect(x - r * 0.1, y - r * 0.38, r * 0.2, r * 0.76).fill(COIN_DARK);
  g.circle(x - r * 0.38, y - r * 0.4, r * 0.18).fill({ color: COIN_LIGHT, alpha: 0.9 });
}

export function drawShadow(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  g.ellipse(x, y, rx, ry).fill({ color: 0x000000, alpha: 0.22 });
}

// ---------------------------------------------------------------------------------------------
// Small character bits (the rest lives in art-people.ts)
// ---------------------------------------------------------------------------------------------

/** Speech bubble; anchor at the tip of the tail. */
export function drawBubble(g: Graphics, x: number, y: number): void {
  g.roundRect(x - 15, y - 34, 30, 26, 9).fill(WHITE).stroke({ width: 2, color: INK, alpha: 0.35 });
  g.poly([x - 5, y - 9, x + 5, y - 9, x, y]).fill(WHITE);
  g.moveTo(x - 5, y - 8.5).lineTo(x, y).lineTo(x + 5, y - 8.5).stroke({ width: 2, color: INK, alpha: 0.35 });
}

// ---------------------------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------------------------

export const VAN = { w: 168, d: 70, h: 56 };

/** Ground shadow of a van (stays on the ground while the body bounces on its springs). */
export function drawVanShadow(g: Graphics, x: number, y: number): void {
  const { w, d } = VAN;
  g.roundRect(x - w / 2 + 6, y - d / 2 + 16, w - 10, d - 8, 18).fill({ color: 0x000000, alpha: 0.2 });
}

/** Wheel positions relative to the van footprint centre. */
export const VAN_WHEELS = [
  { x: -VAN.w / 2 + 32, y: VAN.d / 2 - 5 },
  { x: VAN.w / 2 - 32, y: VAN.d / 2 - 5 },
];

/** Brand van body seen from the south, cab to the east, without wheels. Anchor: footprint centre (x, y). */
export function drawVan(g: Graphics, x: number, y: number, stripe: number): void {
  const { w, d, h } = VAN;
  const left = x - w / 2;
  const cabW = 46;
  const boxW = w - cabW + 6;
  const roofTop = y - d / 2 - h;
  const sideTop = y + d / 2 - h;
  const bottom = y + d / 2 - 6;
  // Cargo box roof with a raised centre panel and ribs
  g.roundRect(left, roofTop, boxW, d, 10).fill(0xf8fafc);
  g.roundRect(left + 6, roofTop + 6, boxW - 12, d - 14, 6).fill(0xeef2f7);
  for (let i = 1; i < 5; i++) g.rect(left + 6 + i * ((boxW - 12) / 5), roofTop + 8, 2, d - 18).fill({ color: 0x94a3b8, alpha: 0.28 });
  // Cargo box side panel
  g.roundRect(left, sideTop, boxW, h - 6, 5).fill(0xe8edf3);
  g.rect(left + 2, sideTop, boxW - 4, 3).fill({ color: WHITE, alpha: 0.9 });
  g.rect(left, bottom - 6, boxW, 6).fill(0xcbd5e1);
  // Brand stripe, district band and logo badge
  g.rect(left, sideTop + 17, boxW, 11).fill(0xf97316);
  g.rect(left, sideTop + 28, boxW, 4).fill(stripe);
  g.circle(left + 40, sideTop + 22, 12).fill(WHITE).stroke({ width: 2, color: 0xf97316 });
  drawGlass(g, left + 40, sideTop + 22, 15, 0xdc2626);
  // Rear door seam and handle
  g.rect(left + 3, sideTop + 4, 1.5, h - 14).fill({ color: 0x94a3b8, alpha: 0.8 });
  // Cab: lower roof, windscreen, side window, door
  const cabL = left + w - cabW;
  g.roundRect(cabL, roofTop + 14, cabW, d - 6, 13).fill(0xf1f5f9);
  g.roundRect(cabL + 8, roofTop + 20, cabW - 17, d - 20, 7).fill(0x7dd3fc);
  g.poly([cabL + 12, roofTop + 24, cabL + 20, roofTop + 24, cabL + 14, roofTop + d - 8, cabL + 10, roofTop + d - 8]).fill({ color: WHITE, alpha: 0.45 });
  g.roundRect(cabL, sideTop + 14, cabW - 2, h - 20, 7).fill(0xe8edf3);
  g.roundRect(cabL + 5, sideTop + 18, 25, 15, 4).fill(0x7dd3fc);
  g.rect(cabL + 9, sideTop + 20, 3, 11).fill({ color: WHITE, alpha: 0.5 });
  g.rect(cabL + 3, sideTop + 16, 1.5, h - 26).fill({ color: 0x94a3b8, alpha: 0.8 });
  g.roundRect(cabL + 20, sideTop + 36, 8, 2.5, 1).fill(0x64748b);
  g.roundRect(cabL - 5, sideTop + 17, 6, 9, 2).fill(0x334155); // mirror
  // Wheel arches (wheels are separate sprites)
  for (const wh of VAN_WHEELS) {
    g.moveTo(x + wh.x - 16, bottom + 1).arc(x + wh.x, bottom + 1, 16, Math.PI, 0).closePath().fill(0x334155);
  }
  // Lights and bumpers
  g.roundRect(left + w - 5, sideTop + 26, 6, 7, 2).fill(0xfef08a);
  g.roundRect(left + w - 8, bottom - 7, 10, 8, 2).fill(0x475569);
  g.roundRect(left - 3, sideTop + 7, 5, 11, 2).fill(0xef4444);
  g.roundRect(left - 4, bottom - 7, 8, 8, 2).fill(0x475569);
  // Outline
  g.roundRect(left, roofTop, boxW, d + h - 6, 10).stroke({ width: 1.5, color: INK, alpha: 0.3 });
}

export function drawWheel(g: Graphics, x: number, y: number): void {
  g.circle(x, y, 12.5).fill(0x1f2937);
  g.circle(x, y, 7.5).fill(0xcbd5e1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.moveTo(x, y).lineTo(x + Math.cos(a) * 6.5, y + Math.sin(a) * 6.5).stroke({ width: 1.8, color: 0x64748b });
  }
  g.circle(x, y, 2.4).fill(0x475569);
  g.circle(x - 4, y - 4, 1.4).fill({ color: WHITE, alpha: 0.6 });
}

/** Loading ramp bridging the dock and the open rear of a parked van (overlay at the west end). */
export function drawVanDoors(g: Graphics, x: number, y: number): void {
  const { w, d } = VAN;
  const left = x - w / 2;
  const top = y - d / 2 + 8;
  const rh = d - 16;
  g.rect(left - 14, top, 20, rh).fill(0x9ca3af);
  for (let k = top + 3; k < top + rh - 2; k += 6) g.rect(left - 12, k, 16, 2).fill({ color: 0x4b5563, alpha: 0.6 });
  g.rect(left - 14, top, 20, rh).stroke({ width: 1.2, color: INK, alpha: 0.4 });
  // Open rear: dark cargo space showing on the side panel's west edge.
  g.rect(left, y + d / 2 - VAN.h + 4, 8, VAN.h - 10).fill({ color: 0x0f172a, alpha: 0.6 });
}

export const TRUCK = { w: 230, d: 96, h: 84 };
/** Side cargo door, relative to the truck's footprint centre (x range on the south face). */
export const TRUCK_DOOR = { x0: TRUCK.w / 2 - 70, x1: TRUCK.w / 2 - 14 };

/** Box truck at the start of the belt: cab to the west, side door open with cargo inside. */
export function drawTruck(g: Graphics, x: number, y: number): void {
  const { w, d, h } = TRUCK;
  const left = x - w / 2;
  const sideTop = y + d / 2 - h;
  const roofTop = y - d / 2 - h;
  const bottom = y + d / 2 - 6;
  g.roundRect(left + 2, y - d / 2 + 14, w - 4, d - 6, 16).fill({ color: 0x000000, alpha: 0.2 });
  // Cab
  g.roundRect(left, roofTop + 24, 58, d - 4, 12).fill(0xdc2626);
  g.roundRect(left + 8, roofTop + 30, 36, d - 18, 7).fill(0x7dd3fc);
  g.poly([left + 12, roofTop + 34, left + 20, roofTop + 34, left + 14, roofTop + d, left + 10, roofTop + d]).fill({ color: WHITE, alpha: 0.45 });
  g.roundRect(left, sideTop + 24, 56, h - 30, 8).fill(0xb91c1c);
  g.roundRect(left + 20, sideTop + 30, 28, 18, 4).fill(0x7dd3fc);
  g.roundRect(left + 55, sideTop + 30, 6, 10, 2).fill(0x1f2937); // mirror
  g.roundRect(left - 4, bottom - 9, 10, 10, 3).fill(0x475569);
  g.circle(left + 3, sideTop + 44, 3.5).fill(0xfef08a);
  // Cargo box: roof with ribs, side with brand stripe
  g.roundRect(left + 52, roofTop, w - 52, d, 7).fill(0xfafafa);
  for (let i = 1; i < 7; i++) g.rect(left + 52 + i * ((w - 52) / 7), roofTop + 4, 2, d - 8).fill({ color: 0x94a3b8, alpha: 0.28 });
  g.rect(left + 52, sideTop, w - 52, h - 6).fill(0xe5e7eb);
  g.rect(left + 54, sideTop, w - 56, 3).fill({ color: WHITE, alpha: 0.9 });
  g.rect(left + 52, sideTop + 24, w - 52, 12).fill(0xf97316);
  g.circle(left + 104, sideTop + 30, 15).fill(WHITE).stroke({ width: 2, color: 0xf97316 });
  drawGlass(g, left + 104, sideTop + 30, 19, 0xdc2626);
  g.rect(left + 52, bottom - 6, w - 52, 6).fill(0xcbd5e1);
  // Side door rolled up: dark cargo space with parcels still inside (top right already unloaded)
  const dx0 = x + TRUCK_DOOR.x0;
  const dx1 = x + TRUCK_DOOR.x1;
  const dTop = sideTop + 8;
  g.rect(dx0, dTop, dx1 - dx0, bottom - dTop - 4).fill(0x111827);
  g.rect(dx0 - 2, dTop - 6, dx1 - dx0 + 4, 7).fill(0x9ca3af);
  g.rect(dx0 - 2, dTop - 6, dx1 - dx0 + 4, 7).stroke({ width: 1, color: INK, alpha: 0.4 });
  const cols = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xc08a4e, 0xa855f7];
  const bw = (dx1 - dx0 - 6) / 3;
  const bh = 13;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 3 && c > 0) continue;
      if (r === 2 && c === 2) continue;
      const bx = dx0 + 3 + c * bw;
      const by = bottom - 8 - (r + 1) * bh;
      const col = cols[(r * 3 + c * 2) % cols.length]!;
      g.rect(bx, by, bw - 1.5, bh - 1.5).fill(col);
      g.rect(bx, by, bw - 1.5, 3).fill({ color: WHITE, alpha: 0.25 });
      g.rect(bx + bw / 2 - 2.5, by, 3, bh - 1.5).fill({ color: WHITE, alpha: 0.35 });
    }
  }
  // Rear doors and lights (east end)
  g.rect(left + w - 5, sideTop + 4, 5, h - 14).fill(0x9ca3af);
  g.roundRect(left + w - 4, sideTop + 8, 5, 10, 2).fill(0xef4444);
  // Wheels
  for (const wx of [left + 34, left + 150, left + 196]) {
    g.moveTo(wx - 17, bottom + 1).arc(wx, bottom + 1, 17, Math.PI, 0).closePath().fill(0x334155);
    g.circle(wx, bottom + 4, 13).fill(0x1f2937);
    g.circle(wx, bottom + 4, 7).fill(0xcbd5e1);
    g.circle(wx, bottom + 4, 2.4).fill(0x475569);
  }
  g.roundRect(left + 52, roofTop, w - 52, d + h - 6, 7).stroke({ width: 1.5, color: INK, alpha: 0.32 });
}

// ---------------------------------------------------------------------------------------------
// Icons (pads, HUD). Drawn in a (−1..1) box scaled by `s`.
// ---------------------------------------------------------------------------------------------

export type IconName =
  | 'capacity'
  | 'speed'
  | 'stability'
  | 'belt'
  | 'vanCap'
  | 'van2'
  | 'district'
  | 'sorter'
  | 'loader'
  | 'collector'
  | 'move'
  | 'turbo'
  | 'helper'
  | 'clapper'
  | 'coin'
  | 'glass'
  | 'bolt'
  | 'box'
  | 'person';

function person(g: Graphics, x: number, y: number, s: number, shirt: number): void {
  g.roundRect(x - s * 0.42, y - s * 0.05, s * 0.84, s * 0.7, s * 0.25).fill(shirt);
  g.circle(x, y - s * 0.38, s * 0.3).fill(0xf5c9a0);
  g.moveTo(x - s * 0.32, y - s * 0.46)
    .arc(x, y - s * 0.46, s * 0.32, Math.PI, 0)
    .closePath()
    .fill(shade(shirt, 0.8));
}

function miniBox(g: Graphics, x: number, y: number, s: number, color: number): void {
  g.rect(x - s * 0.5, y - s * 0.2, s, s * 0.55).fill(color);
  g.rect(x - s * 0.5, y - s * 0.42, s, s * 0.24).fill(shade(color, 1.25));
  g.rect(x - s * 0.08, y - s * 0.42, s * 0.16, s * 0.35).fill({ color: WHITE, alpha: 0.6 });
}

function arrowUp(g: Graphics, x: number, y: number, s: number, color: number): void {
  g.poly([x, y - s * 0.5, x + s * 0.42, y, x + s * 0.16, y, x + s * 0.16, y + s * 0.45, x - s * 0.16, y + s * 0.45, x - s * 0.16, y, x - s * 0.42, y]).fill(color);
}

function smallVan(g: Graphics, x: number, y: number, s: number): void {
  g.roundRect(x - s * 0.8, y - s * 0.45, s * 1.15, s * 0.7, s * 0.12).fill(0xf8fafc);
  g.roundRect(x + s * 0.3, y - s * 0.22, s * 0.5, s * 0.47, s * 0.12).fill(0xf1f5f9);
  g.rect(x + s * 0.42, y - s * 0.15, s * 0.28, s * 0.18).fill(0x7dd3fc);
  g.rect(x - s * 0.8, y - s * 0.12, s * 1.15, s * 0.14).fill(0xf97316);
  g.circle(x - s * 0.45, y + s * 0.28, s * 0.16).fill(0x1f2937);
  g.circle(x + s * 0.5, y + s * 0.28, s * 0.16).fill(0x1f2937);
  g.roundRect(x - s * 0.8, y - s * 0.45, s * 1.6, s * 0.72, s * 0.12).stroke({ width: Math.max(1, s * 0.06), color: INK, alpha: 0.5 });
}

export function drawIcon(g: Graphics, name: IconName, x: number, y: number, s: number): void {
  switch (name) {
    case 'capacity':
      miniBox(g, x - s * 0.18, y + s * 0.45, s * 0.8, 0xd97706);
      miniBox(g, x - s * 0.18, y + s * 0.05, s * 0.8, 0xf59e0b);
      miniBox(g, x - s * 0.18, y - s * 0.35, s * 0.8, 0xfbbf24);
      arrowUp(g, x + s * 0.55, y - s * 0.05, s * 0.75, 0x22c55e);
      break;
    case 'speed':
      // Sneaker with speed lines
      g.roundRect(x - s * 0.45, y - s * 0.1, s * 1.05, s * 0.45, s * 0.2).fill(0x3b82f6);
      g.roundRect(x - s * 0.45, y - s * 0.45, s * 0.5, s * 0.5, s * 0.15).fill(0x3b82f6);
      g.rect(x - s * 0.5, y + s * 0.3, s * 1.12, s * 0.12).fill(WHITE);
      g.rect(x - s * 0.3, y - s * 0.3, s * 0.2, s * 0.06).fill(WHITE);
      for (let i = 0; i < 3; i++) g.rect(x - s * 1, y - s * 0.3 + i * s * 0.25, s * 0.38 - i * s * 0.06, s * 0.09).fill(0x94a3b8);
      break;
    case 'stability':
      g.poly([x, y - s * 0.8, x + s * 0.7, y - s * 0.5, x + s * 0.6, y + s * 0.3, x, y + s * 0.8, x - s * 0.6, y + s * 0.3, x - s * 0.7, y - s * 0.5]).fill(0x0ea5e9);
      drawGlass(g, x, y - s * 0.02, s * 0.9, WHITE);
      break;
    case 'belt':
      g.roundRect(x - s * 0.9, y + s * 0.05, s * 1.8, s * 0.4, s * 0.2).fill(0x334155);
      for (let i = 0; i < 4; i++) g.circle(x - s * 0.62 + i * s * 0.41, y + s * 0.25, s * 0.1).fill(0x94a3b8);
      miniBox(g, x - s * 0.1, y - s * 0.12, s * 0.62, 0xef4444);
      g.poly([x + s * 0.55, y - s * 0.55, x + s * 0.95, y - s * 0.3, x + s * 0.55, y - s * 0.05]).fill(0x22c55e);
      g.rect(x + s * 0.1, y - s * 0.38, s * 0.47, s * 0.16).fill(0x22c55e);
      break;
    case 'vanCap':
      smallVan(g, x - s * 0.1, y + s * 0.15, s);
      miniBox(g, x + s * 0.55, y - s * 0.45, s * 0.55, 0xf59e0b);
      break;
    case 'van2':
      smallVan(g, x + s * 0.22, y - s * 0.25, s * 0.72);
      smallVan(g, x - s * 0.18, y + s * 0.35, s * 0.72);
      break;
    case 'district':
      // Little houses
      g.poly([x - s * 0.9, y - s * 0.05, x - s * 0.45, y - s * 0.5, x, y - s * 0.05]).fill(0xef4444);
      g.rect(x - s * 0.78, y - s * 0.05, s * 0.66, s * 0.6).fill(0xfef3c7);
      g.poly([x - s * 0.05, y - s * 0.25, x + s * 0.45, y - s * 0.75, x + s * 0.95, y - s * 0.25]).fill(0x3b82f6);
      g.rect(x + s * 0.08, y - s * 0.25, s * 0.74, s * 0.8).fill(0xe0f2fe);
      g.rect(x - s * 0.55, y + s * 0.2, s * 0.2, s * 0.35).fill(0x92400e);
      g.rect(x + s * 0.35, y + s * 0.2, s * 0.2, s * 0.35).fill(0x92400e);
      break;
    case 'sorter':
      person(g, x - s * 0.15, y + s * 0.1, s, 0x16a34a);
      miniBox(g, x + s * 0.55, y + s * 0.35, s * 0.5, 0xef4444);
      break;
    case 'loader':
      person(g, x - s * 0.15, y + s * 0.1, s, 0x2563eb);
      smallVan(g, x + s * 0.52, y + s * 0.45, s * 0.45);
      break;
    case 'collector':
      person(g, x - s * 0.15, y + s * 0.1, s, 0xeab308);
      drawCoinIcon(g, x + s * 0.55, y + s * 0.42, s * 0.3);
      break;
    case 'person':
      person(g, x, y + s * 0.1, s, 0xf97316);
      break;
    case 'move':
      g.rect(x - s * 0.85, y - s * 0.35, s * 1.1, s * 0.9).fill(0xe2e8f0);
      g.poly([x - s * 0.95, y - s * 0.35, x - s * 0.3, y - s * 0.85, x + s * 0.35, y - s * 0.35]).fill(0x64748b);
      g.rect(x - s * 0.45, y + s * 0.1, s * 0.3, s * 0.45).fill(0x475569);
      arrowUp(g, x + s * 0.6, y - s * 0.1, s * 0.8, 0x22c55e);
      break;
    case 'turbo':
      drawCoinIcon(g, x - s * 0.25, y + s * 0.05, s * 0.6);
      g.roundRect(x + s * 0.05, y - s * 0.85, s * 0.9, s * 0.62, s * 0.18).fill(0xdc2626);
      g.moveTo(x + s * 0.22, y - s * 0.72).lineTo(x + s * 0.48, y - s * 0.38).stroke({ width: s * 0.1, color: WHITE });
      g.moveTo(x + s * 0.48, y - s * 0.72).lineTo(x + s * 0.22, y - s * 0.38).stroke({ width: s * 0.1, color: WHITE });
      g.moveTo(x + s * 0.6, y - s * 0.7)
        .quadraticCurveTo(x + s * 0.82, y - s * 0.78, x + s * 0.8, y - s * 0.6)
        .lineTo(x + s * 0.6, y - s * 0.38)
        .lineTo(x + s * 0.84, y - s * 0.38)
        .stroke({ width: s * 0.09, color: WHITE });
      break;
    case 'helper':
      person(g, x - s * 0.2, y + s * 0.12, s * 0.95, 0x9333ea);
      g.circle(x + s * 0.55, y - s * 0.45, s * 0.36).fill(WHITE);
      g.circle(x + s * 0.55, y - s * 0.45, s * 0.36).stroke({ width: s * 0.08, color: 0x9333ea });
      g.moveTo(x + s * 0.55, y - s * 0.45).lineTo(x + s * 0.55, y - s * 0.66).stroke({ width: s * 0.07, color: INK });
      g.moveTo(x + s * 0.55, y - s * 0.45).lineTo(x + s * 0.7, y - s * 0.4).stroke({ width: s * 0.07, color: INK });
      break;
    case 'clapper':
      g.roundRect(x - s * 0.8, y - s * 0.25, s * 1.6, s * 1.0, s * 0.12).fill(0x1f2937);
      g.poly([x - s * 0.82, y - s * 0.35, x + s * 0.78, y - s * 0.75, x + s * 0.84, y - s * 0.5, x - s * 0.76, y - s * 0.1]).fill(0x1f2937);
      for (let i = 0; i < 4; i++) {
        const bx = x - s * 0.62 + i * s * 0.4;
        g.poly([bx, y - s * 0.3 - i * s * 0.1, bx + s * 0.18, y - s * 0.35 - i * s * 0.1, bx + s * 0.28, y - s * 0.16 - i * s * 0.1, bx + s * 0.1, y - s * 0.11 - i * s * 0.1]).fill(WHITE);
      }
      g.poly([x - s * 0.18, y + s * 0.05, x + s * 0.32, y + s * 0.3, x - s * 0.18, y + s * 0.55]).fill(WHITE);
      break;
    case 'coin':
      drawCoinIcon(g, x, y, s * 0.85);
      break;
    case 'glass':
      drawGlass(g, x, y, s * 1.4, 0xdc2626);
      break;
    case 'bolt':
      drawBolt(g, x, y, s * 1.5, 0xfacc15);
      break;
    case 'box':
      miniBox(g, x, y + s * 0.15, s * 1.4, 0xf59e0b);
      break;
  }
}
