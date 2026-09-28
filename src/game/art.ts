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

export function drawCoin(g: Graphics, x: number, y: number): void {
  g.ellipse(x, y + 2, 7, 4.2).fill(COIN_DARK);
  g.rect(x - 7, y, 14, 2).fill(COIN_DARK);
  g.ellipse(x, y, 7, 4.2).fill(COIN);
  g.ellipse(x, y, 4.6, 2.6).stroke({ width: 1, color: COIN_DARK, alpha: 0.7 });
  g.ellipse(x - 2.2, y - 1.3, 1.6, 0.9).fill({ color: COIN_LIGHT, alpha: 0.9 });
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
// Character parts (drawn white so they can be tinted per worker)
// ---------------------------------------------------------------------------------------------

export function drawTorso(g: Graphics, x: number, by: number): void {
  // White shirt body; bottom edge at `by`.
  g.roundRect(x - 11, by - 21, 22, 21, 7).fill(WHITE);
  g.roundRect(x - 11, by - 7, 22, 7, 3).fill({ color: 0x000000, alpha: 0.12 });
}

export function drawTorsoDetail(g: Graphics, x: number, by: number): void {
  // Collar and a pocket logo; untinted overlay.
  g.poly([x - 5, by - 21, x + 5, by - 21, x, by - 16]).fill({ color: 0x000000, alpha: 0.18 });
  g.circle(x + 5, by - 12, 2.4).fill({ color: WHITE, alpha: 0.85 });
  g.rect(x - 11, by - 4, 22, 3).fill({ color: 0x3f2d1f, alpha: 0.55 });
}

export function drawHead(g: Graphics, x: number, cy: number): void {
  g.circle(x, cy, 10).fill(WHITE);
  g.circle(x + 2, cy + 2, 8).fill({ color: 0x000000, alpha: 0.06 });
}

export function drawCap(g: Graphics, x: number, cy: number, facing: 'front' | 'side' | 'back'): void {
  // Crown
  g.moveTo(x - 10.5, cy - 1)
    .arc(x, cy - 1, 10.5, Math.PI, 0)
    .lineTo(x + 10.5, cy - 1)
    .closePath()
    .fill(WHITE);
  if (facing === 'front') g.ellipse(x, cy, 9, 3).fill(WHITE);
  else if (facing === 'side') g.roundRect(x + 4, cy - 3.2, 11, 4.4, 2).fill(WHITE);
  // Band
  g.rect(x - 10.5, cy - 3, 21, 2.4).fill({ color: 0x000000, alpha: 0.18 });
}

export function drawEyes(g: Graphics, x: number, cy: number, facing: 'front' | 'side'): void {
  if (facing === 'front') {
    g.circle(x - 3.6, cy + 2.5, 1.7).fill(INK);
    g.circle(x + 3.6, cy + 2.5, 1.7).fill(INK);
    g.circle(x - 3.1, cy + 1.9, 0.6).fill(WHITE);
    g.circle(x + 4.1, cy + 1.9, 0.6).fill(WHITE);
    g.moveTo(x - 2.4, cy + 6).quadraticCurveTo(x, cy + 7.6, x + 2.4, cy + 6).stroke({ width: 1.2, color: INK, alpha: 0.7 });
  } else {
    g.circle(x + 5.2, cy + 2.4, 1.7).fill(INK);
    g.circle(x + 5.7, cy + 1.8, 0.6).fill(WHITE);
  }
}

export function drawLeg(g: Graphics, x: number, by: number): void {
  g.roundRect(x - 3.2, by - 11, 6.4, 11, 3).fill(WHITE);
  g.roundRect(x - 3.6, by - 3.4, 7.8, 3.4, 1.6).fill({ color: 0x1f1f1f, alpha: 0.85 });
}

export function drawArm(g: Graphics, x: number, ty: number): void {
  g.roundRect(x - 2.8, ty, 5.6, 13, 2.8).fill(WHITE);
}

// ---------------------------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------------------------

export const VAN = { w: 168, d: 70, h: 56 };

/** Brand van seen from the south, cab to the east. Anchor: footprint centre at (x, y). */
export function drawVan(g: Graphics, x: number, y: number, stripe: number): void {
  const { w, d, h } = VAN;
  const left = x - w / 2;
  const cabW = 44;
  const bodyTop = y - d / 2 - h;
  // Shadow
  g.roundRect(left + 4, y - d / 2 + 6, w, d, 10).fill({ color: 0x000000, alpha: 0.22 });
  // Cargo box: roof + side
  g.roundRect(left, bodyTop, w - cabW + 6, d, 8).fill(0xf8fafc);
  g.rect(left, y + d / 2 - h, w - cabW + 6, h).fill(0xe2e8f0);
  // Cab (lower roof)
  g.roundRect(left + w - cabW, bodyTop + 14, cabW, d - 6, 10).fill(0xf1f5f9);
  g.rect(left + w - cabW, y + d / 2 - h + 14, cabW - 2, h - 14).fill(0xe2e8f0);
  g.roundRect(left + w - cabW + 6, bodyTop + 20, cabW - 14, d - 20, 6).fill(0x7dd3fc); // windscreen
  g.rect(left + w - cabW + 8, bodyTop + 22, 8, d - 24).fill({ color: WHITE, alpha: 0.5 });
  g.roundRect(left + w - cabW + 4, y + d / 2 - h + 18, 22, 16, 3).fill(0x7dd3fc); // side window
  // Brand stripe and district band on the side
  g.rect(left, y + d / 2 - h + 20, w - cabW + 6, 10).fill(0xf97316);
  g.rect(left, y + d / 2 - h + 30, w - cabW + 6, 4).fill(stripe);
  // Logo: cracked-glass badge
  g.circle(left + 38, y + d / 2 - h + 25, 11).fill(WHITE);
  drawGlass(g, left + 38, y + d / 2 - h + 25, 14, 0xdc2626);
  // Roof ribs
  for (let i = 1; i < 4; i++) g.rect(left + i * 30, bodyTop + 4, 2, d - 8).fill({ color: 0x94a3b8, alpha: 0.35 });
  // Bumper, lights
  g.roundRect(left + w - 6, y + d / 2 - 14, 8, 10, 2).fill(0x475569);
  g.circle(left + w - 3, y + d / 2 - h + 26, 3).fill(0xfef08a);
  g.rect(left - 2, y + d / 2 - h + 8, 4, 10).fill(0xef4444);
  // Wheels
  for (const wx of [left + 30, left + w - 30]) {
    g.ellipse(wx, y + d / 2 - 2, 13, 11).fill(0x1f2937);
    g.ellipse(wx, y + d / 2 - 2, 6, 5).fill(0x9ca3af);
  }
  // Outline
  g.roundRect(left, bodyTop, w - cabW + 6, d + h, 8).stroke({ width: 1.5, color: INK, alpha: 0.35 });
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

/** Box truck at the start of the belt: rear to the east, open. Anchor: footprint centre. */
export function drawTruck(g: Graphics, x: number, y: number): void {
  const w = 230;
  const d = 96;
  const h = 84;
  const left = x - w / 2;
  g.roundRect(left - 6, y - d / 2 + 8, w + 6, d, 10).fill({ color: 0x000000, alpha: 0.2 });
  // Cab to the west
  g.roundRect(left, y - d / 2 - h + 22, 56, d, 10).fill(0xdc2626);
  g.rect(left, y + d / 2 - h + 22, 56, h - 22).fill(0xb91c1c);
  g.roundRect(left + 8, y - d / 2 - h + 28, 34, d - 14, 6).fill(0x7dd3fc);
  // Box
  g.roundRect(left + 50, y - d / 2 - h, w - 50, d, 6).fill(0xfafafa);
  g.rect(left + 50, y + d / 2 - h, w - 50, h).fill(0xe5e7eb);
  g.rect(left + 50, y + d / 2 - h + 26, w - 50, 12).fill(0xf97316);
  g.circle(left + 112, y + d / 2 - h + 32, 14).fill(WHITE);
  drawGlass(g, left + 112, y + d / 2 - h + 32, 18, 0xdc2626);
  // Open rear with parcels visible
  g.rect(left + w - 8, y - d / 2 - h + 6, 8, d + h - 12).fill(0x1f2937);
  for (const wx of [left + 34, left + 150, left + 196]) {
    g.ellipse(wx, y + d / 2 - 2, 15, 12).fill(0x1f2937);
    g.ellipse(wx, y + d / 2 - 2, 7, 6).fill(0x9ca3af);
  }
  g.roundRect(left + 50, y - d / 2 - h, w - 50, d + h, 6).stroke({ width: 1.5, color: INK, alpha: 0.35 });
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
