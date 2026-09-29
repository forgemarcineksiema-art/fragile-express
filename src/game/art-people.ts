// Character art: role outfits, heads with ears, faces with moods, hats, sleeves and shoes.
// Skin, hair, hats and plain garments are drawn white and tinted per character; outfits with several
// colours (vests, straps, badges) are drawn in full colour, one texture per role and facing.
import type { Graphics } from 'pixi.js';
import { drawGlass } from './art.ts';
import { INK, WHITE, shade } from './palette.ts';

export type Outfit = 'player' | 'sorter' | 'loader' | 'collector' | 'helper';
export type Facing = 'front' | 'side' | 'back';
export type Mood = 'normal' | 'happy' | 'worried' | 'shock';
/** Face variants: moods plus eyes closed for blinking. */
export type FaceKind = Mood | 'blink';

export interface OutfitStyle {
  shirt: number;
  pants: number;
  sleeve: number;
  /** Forearm colour; null means bare skin (short sleeves). */
  forearm: number | null;
  /** Glove colour; null means bare hands. */
  glove: number | null;
  hat: 'cap' | 'hardhat';
  hatColor: number;
  shoes: number;
}

export const OUTFITS: Record<Outfit, OutfitStyle> = {
  player: { shirt: 0xf97316, pants: 0x1e3a8a, sleeve: 0xf97316, forearm: null, glove: null, hat: 'cap', hatColor: 0xdc2626, shoes: 0x1f2937 },
  sorter: { shirt: 0x16a34a, pants: 0x374151, sleeve: 0x16a34a, forearm: null, glove: null, hat: 'cap', hatColor: 0x15803d, shoes: 0x3f2d1f },
  loader: { shirt: 0x2563eb, pants: 0x1d4ed8, sleeve: 0x2563eb, forearm: 0x2563eb, glove: 0x92400e, hat: 'hardhat', hatColor: 0xfacc15, shoes: 0x3f2d1f },
  collector: { shirt: 0xf8fafc, pants: 0x1f2937, sleeve: 0xf8fafc, forearm: null, glove: null, hat: 'cap', hatColor: 0xca8a04, shoes: 0x111827 },
  helper: { shirt: 0x9333ea, pants: 0x4b5563, sleeve: 0x9333ea, forearm: 0x9333ea, glove: null, hat: 'cap', hatColor: 0x6b21a8, shoes: 0x1f2937 },
};

// ---------------------------------------------------------------------------------------------
// Torso per outfit (full colour). Anchor: bottom centre of the torso at (x, by).
// ---------------------------------------------------------------------------------------------

function torsoBase(g: Graphics, x: number, by: number, color: number): void {
  g.roundRect(x - 11.5, by - 22, 23, 22, 7).fill(color);
  g.roundRect(x + 4, by - 20, 7.5, 18, 4).fill({ color: 0x000000, alpha: 0.09 });
  g.roundRect(x - 11.5, by - 22, 23, 22, 7).stroke({ width: 1.2, color: INK, alpha: 0.25 });
}

function belt(g: Graphics, x: number, by: number, color = 0x1f2937, buckle = true): void {
  g.rect(x - 11, by - 5, 22, 3).fill(color);
  if (buckle) g.rect(x - 2, by - 5.4, 4, 3.8).fill(0xfbbf24);
}

export function drawTorsoOutfit(g: Graphics, x: number, by: number, outfit: Outfit, back: boolean): void {
  const s = OUTFITS[outfit];
  switch (outfit) {
    case 'player': {
      torsoBase(g, x, by, s.shirt);
      if (back) {
        g.rect(x - 7, by - 22, 14, 3).fill(WHITE);
        g.rect(x - 11, by - 15, 22, 4).fill({ color: WHITE, alpha: 0.9 });
      } else {
        g.poly([x - 6, by - 22, x, by - 22, x - 1, by - 17]).fill(WHITE);
        g.poly([x + 6, by - 22, x, by - 22, x + 1, by - 17]).fill(WHITE);
        for (let k = 0; k < 2; k++) g.circle(x, by - 15 + k * 4, 0.9).fill(WHITE);
        g.circle(x - 6, by - 14, 3.3).fill(WHITE);
        drawGlass(g, x - 6, by - 14.2, 4.4, 0xdc2626);
      }
      belt(g, x, by);
      break;
    }
    case 'sorter': {
      torsoBase(g, x, by, s.shirt);
      const vest = 0xfacc15;
      const stripe = 0xe5e7eb;
      if (back) {
        g.roundRect(x - 11, by - 20, 22, 18, 5).fill(vest);
        g.rect(x - 11, by - 15, 22, 2.5).fill(stripe);
        g.rect(x - 11, by - 9, 22, 2.5).fill(stripe);
      } else {
        g.roundRect(x - 11, by - 21, 8, 19, 4).fill(vest);
        g.roundRect(x + 3, by - 21, 8, 19, 4).fill(vest);
        for (const yy of [by - 15, by - 9]) {
          g.rect(x - 11, yy, 8, 2.5).fill(stripe);
          g.rect(x + 3, yy, 8, 2.5).fill(stripe);
        }
      }
      break;
    }
    case 'loader': {
      torsoBase(g, x, by, s.shirt);
      const dark = shade(s.shirt, 0.72);
      if (back) {
        g.moveTo(x - 7, by - 21).lineTo(x + 5, by - 7).moveTo(x + 7, by - 21).lineTo(x - 5, by - 7).stroke({ width: 2.6, color: dark });
      } else {
        g.roundRect(x - 6, by - 17, 12, 9, 2).fill(dark);
        g.rect(x - 4, by - 15, 8, 1.2).fill({ color: WHITE, alpha: 0.4 });
        g.rect(x - 8, by - 22, 3, 7).fill(dark);
        g.rect(x + 5, by - 22, 3, 7).fill(dark);
        g.circle(x - 6.5, by - 16, 1.1).fill(0xfbbf24);
        g.circle(x + 6.5, by - 16, 1.1).fill(0xfbbf24);
      }
      belt(g, x, by, dark, false);
      break;
    }
    case 'collector': {
      torsoBase(g, x, by, s.shirt);
      const vest = 0xca8a04;
      if (back) {
        g.roundRect(x - 11, by - 20, 22, 17, 5).fill(vest);
      } else {
        g.roundRect(x - 11, by - 20, 8.5, 17, 4).fill(vest);
        g.roundRect(x + 2.5, by - 20, 8.5, 17, 4).fill(vest);
        for (let k = 0; k < 3; k++) g.circle(x + 4.5, by - 16 + k * 4, 0.9).fill(0xfef3c7);
        g.poly([x - 2.5, by - 22, x + 2.5, by - 22, x, by - 14]).fill(0xdc2626);
      }
      // Coin satchel strap and bag at the hip
      g.moveTo(x + 9, by - 21).lineTo(x - 9, by - 5).stroke({ width: 2.6, color: 0x78350f });
      g.roundRect(x - 14, by - 9, 9, 8, 2).fill(0x92400e).stroke({ width: 1, color: INK, alpha: 0.35 });
      g.rect(x - 14, by - 9, 9, 3).fill(0x78350f);
      g.circle(x - 9.5, by - 5, 1.2).fill(0xfbbf24);
      break;
    }
    case 'helper': {
      torsoBase(g, x, by, s.shirt);
      const dark = shade(s.shirt, 0.75);
      if (back) {
        g.moveTo(x - 8, by - 22).arc(x, by - 22, 8, Math.PI, 0, true).fill(dark);
      } else {
        g.roundRect(x - 7, by - 10, 14, 7, 3).fill(dark);
        g.moveTo(x - 2.5, by - 21).lineTo(x - 2.5, by - 15).moveTo(x + 2.5, by - 21).lineTo(x + 2.5, by - 15).stroke({ width: 1.2, color: WHITE });
        g.circle(x + 6, by - 15, 3).fill(WHITE);
        g.moveTo(x + 6, by - 15).lineTo(x + 6, by - 17).moveTo(x + 6, by - 15).lineTo(x + 7.4, by - 14.4).stroke({ width: 0.8, color: INK });
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Head, hair, hats (white, tinted), faces (full colour). Anchor: head centre (x, cy); radius 11.
// ---------------------------------------------------------------------------------------------

export const HEAD_R = 11;

export function drawHeadShape(g: Graphics, x: number, cy: number, facing: Facing): void {
  if (facing === 'front' || facing === 'back') {
    g.circle(x - HEAD_R + 0.5, cy + 1.5, 3).fill(WHITE);
    g.circle(x + HEAD_R - 0.5, cy + 1.5, 3).fill(WHITE);
  }
  g.circle(x, cy, HEAD_R).fill(WHITE);
  if (facing === 'side') {
    g.circle(x - 2, cy + 1.5, 3).fill(WHITE);
    g.circle(x - 2, cy + 1.5, 1.6).fill({ color: 0x000000, alpha: 0.08 });
    g.circle(x + HEAD_R - 0.2, cy + 2.5, 2.4).fill(WHITE); // nose
  }
  // Soft shading at the lower right
  g.moveTo(x + 2, cy + HEAD_R - 0.5).arc(x, cy, HEAD_R - 0.5, Math.PI * 0.42, Math.PI * 0.05, true).closePath().fill({ color: 0x000000, alpha: 0.07 });
}

export function drawHairStyle(g: Graphics, x: number, cy: number, facing: Facing): void {
  if (facing === 'back') {
    g.circle(x, cy - 0.5, HEAD_R + 0.4).fill(WHITE);
    g.roundRect(x - 8, cy + 4, 16, 6, 3).fill(WHITE);
  } else if (facing === 'side') {
    g.moveTo(x + 1, cy - HEAD_R - 0.4).arc(x, cy, HEAD_R + 0.4, -Math.PI / 2, Math.PI * 0.62, true).closePath().fill(WHITE);
    g.circle(x - 3, cy + 6.5, 3.8).fill(WHITE);
    g.poly([x + 2, cy - 7, x + 9, cy - 6, x + 6, cy - 2]).fill(WHITE);
  } else {
    g.ellipse(x - 9.2, cy + 0.5, 2.8, 5).fill(WHITE);
    g.ellipse(x + 9.2, cy + 0.5, 2.8, 5).fill(WHITE);
    g.poly([x - 8, cy - 6, x - 1, cy - 7, x - 4, cy - 2.5]).fill(WHITE);
    g.poly([x + 8, cy - 6, x + 1, cy - 7, x + 4, cy - 3]).fill(WHITE);
  }
}

export function drawCapStyle(g: Graphics, x: number, cy: number, facing: Facing): void {
  g.moveTo(x - 11.6, cy - 2)
    .arc(x, cy - 2, 11.6, Math.PI, 0)
    .lineTo(x + 11.6, cy - 2)
    .closePath()
    .fill(WHITE);
  g.moveTo(x - 11.6, cy - 2).arc(x, cy - 2, 11.6, Math.PI, Math.PI * 1.25).stroke({ width: 2, color: WHITE, alpha: 0.6 });
  if (facing === 'front') {
    g.ellipse(x, cy - 0.8, 10.5, 3.4).fill(WHITE);
    g.ellipse(x, cy - 0.2, 10.5, 2.6).fill({ color: 0x000000, alpha: 0.14 });
  } else if (facing === 'side') {
    g.roundRect(x + 3, cy - 4.4, 13, 4.6, 2.2).fill(WHITE);
    g.rect(x + 3, cy - 1.6, 13, 1.8).fill({ color: 0x000000, alpha: 0.14 });
  } else {
    g.roundRect(x - 3.5, cy - 5, 7, 3, 1.5).fill({ color: 0x000000, alpha: 0.25 });
  }
  g.rect(x - 11.4, cy - 4, 22.8, 2).fill({ color: 0x000000, alpha: 0.16 });
  g.circle(x, cy - 13.2, 1.5).fill({ color: 0x000000, alpha: 0.18 });
}

export function drawHardhatStyle(g: Graphics, x: number, cy: number, facing: Facing): void {
  g.moveTo(x - 12, cy - 2)
    .arc(x, cy - 2, 12, Math.PI, 0)
    .lineTo(x + 12, cy - 2)
    .closePath()
    .fill(WHITE);
  if (facing === 'side') g.roundRect(x - 12.5, cy - 3.5, 29, 4.2, 2).fill(WHITE);
  else g.roundRect(x - 14.5, cy - 3.5, 29, 4.2, 2).fill(WHITE);
  g.rect(x - 1.8, cy - 13.5, 3.6, 11).fill({ color: 0x000000, alpha: 0.12 });
  g.rect(x - 12, cy - 4.6, 24, 1.4).fill({ color: 0x000000, alpha: 0.16 });
  g.moveTo(x - 9, cy - 8).arc(x, cy - 2, 10, Math.PI * 1.15, Math.PI * 1.35).stroke({ width: 1.8, color: WHITE, alpha: 0.7 });
}

/** Brand badge on the player's cap (untinted). */
export function drawCapLogo(g: Graphics, x: number, cy: number, facing: Facing): void {
  if (facing === 'back') return;
  const lx = facing === 'side' ? x + 4 : x;
  g.circle(lx, cy - 8, 3.4).fill(WHITE);
  drawGlass(g, lx, cy - 8.2, 4.6, 0xdc2626);
}

const BLUSH = 0xfb7185;

function eyeOval(g: Graphics, ex: number, ey: number, lookUp = false): void {
  g.ellipse(ex, ey, 2.1, 2.8).fill(INK);
  g.circle(ex - 0.7, ey - (lookUp ? 1.4 : 0.9), 0.95).fill(WHITE);
  g.circle(ex + 0.8, ey + 1, 0.45).fill(WHITE);
}

/** Face features for a mood; front view or side view (facing right). */
export function drawFace(g: Graphics, x: number, cy: number, facing: 'front' | 'side', mood: FaceKind): void {
  const side = facing === 'side';
  const eyes = side ? [x + 5.6] : [x - 4, x + 4];
  const ey = cy + 1.4;
  // Blush
  for (const bx of side ? [x + 4.5] : [x - 6.8, x + 6.8]) g.ellipse(bx, cy + 5, 2.6, 1.5).fill({ color: BLUSH, alpha: mood === 'happy' ? 0.5 : 0.32 });
  switch (mood) {
    case 'normal':
      for (const ex of eyes) {
        eyeOval(g, ex, ey);
        g.moveTo(ex - 2.2, ey - 4.2).quadraticCurveTo(ex, ey - 5.2, ex + 2.2, ey - 4.2).stroke({ width: 1.2, color: INK, alpha: 0.75, cap: 'round' });
      }
      if (side) g.moveTo(x + 6.5, cy + 6.3).quadraticCurveTo(x + 8.2, cy + 7.6, x + 9.6, cy + 6.2).stroke({ width: 1.2, color: INK, alpha: 0.8, cap: 'round' });
      else g.moveTo(x - 2.4, cy + 6).quadraticCurveTo(x, cy + 7.8, x + 2.4, cy + 6).stroke({ width: 1.3, color: INK, alpha: 0.8, cap: 'round' });
      break;
    case 'happy':
      for (const ex of eyes) {
        g.moveTo(ex - 2.3, ey + 0.8).quadraticCurveTo(ex, ey - 2.4, ex + 2.3, ey + 0.8).stroke({ width: 1.6, color: INK, cap: 'round' });
      }
      if (side) {
        g.moveTo(x + 6, cy + 5.5).quadraticCurveTo(x + 8.5, cy + 10, x + 10.4, cy + 5.2).closePath().fill(0x7f1d1d);
      } else {
        g.moveTo(x - 3.6, cy + 5).quadraticCurveTo(x, cy + 11, x + 3.6, cy + 5).closePath().fill(0x7f1d1d);
        g.ellipse(x, cy + 7.8, 1.8, 1).fill(0xfb7185);
      }
      break;
    case 'worried':
      for (let i = 0; i < eyes.length; i++) {
        const ex = eyes[i]!;
        eyeOval(g, ex, ey + 0.3, true);
        const inner = side ? -1 : i === 0 ? 1 : -1;
        g.moveTo(ex - 2.3 * inner, ey - 3.6).lineTo(ex + 2.3 * inner, ey - 5.4).stroke({ width: 1.3, color: INK, alpha: 0.85, cap: 'round' });
      }
      if (side) g.moveTo(x + 6.5, cy + 7).quadraticCurveTo(x + 7.5, cy + 6, x + 8.5, cy + 7).quadraticCurveTo(x + 9.5, cy + 8, x + 10, cy + 7).stroke({ width: 1.2, color: INK, cap: 'round' });
      else g.moveTo(x - 2.6, cy + 7).quadraticCurveTo(x - 1.3, cy + 6, x, cy + 7).quadraticCurveTo(x + 1.3, cy + 8, x + 2.6, cy + 7).stroke({ width: 1.2, color: INK, cap: 'round' });
      break;
    case 'blink':
      for (const ex of eyes) {
        g.moveTo(ex - 2.2, ey + 0.2).quadraticCurveTo(ex, ey + 1.6, ex + 2.2, ey + 0.2).stroke({ width: 1.5, color: INK, cap: 'round' });
        g.moveTo(ex - 2.2, ey - 4.2).quadraticCurveTo(ex, ey - 5.2, ex + 2.2, ey - 4.2).stroke({ width: 1.2, color: INK, alpha: 0.75, cap: 'round' });
      }
      if (side) g.moveTo(x + 6.5, cy + 6.3).quadraticCurveTo(x + 8.2, cy + 7.6, x + 9.6, cy + 6.2).stroke({ width: 1.2, color: INK, alpha: 0.8, cap: 'round' });
      else g.moveTo(x - 2.4, cy + 6).quadraticCurveTo(x, cy + 7.8, x + 2.4, cy + 6).stroke({ width: 1.3, color: INK, alpha: 0.8, cap: 'round' });
      break;
    case 'shock':
      for (const ex of eyes) {
        g.circle(ex, ey, 2.9).fill(WHITE).stroke({ width: 1, color: INK });
        g.circle(ex, ey + 0.3, 1.2).fill(INK);
        g.moveTo(ex - 2.3, ey - 5.6).quadraticCurveTo(ex, ey - 6.8, ex + 2.3, ey - 5.6).stroke({ width: 1.3, color: INK, cap: 'round' });
      }
      if (side) g.ellipse(x + 8.2, cy + 7, 1.6, 2.2).fill(0x7f1d1d);
      else g.ellipse(x, cy + 7, 2.2, 2.8).fill(0x7f1d1d);
      break;
  }
}

// ---------------------------------------------------------------------------------------------
// Limbs
// ---------------------------------------------------------------------------------------------

/** Upper arm (sleeve), white for tinting. Anchor: shoulder (top centre). */
export function drawSleeve(g: Graphics, x: number, ty: number): void {
  g.roundRect(x - 3.8, ty, 7.6, 8.5, 3.6).fill(WHITE);
  g.rect(x - 3.8, ty + 6.5, 7.6, 1.2).fill({ color: 0x000000, alpha: 0.12 });
}

/** Forearm, white for tinting (skin or long sleeve). Anchor: elbow (top centre). */
export function drawForearm(g: Graphics, x: number, ty: number): void {
  g.roundRect(x - 2.7, ty, 5.4, 9, 2.7).fill(WHITE);
}

/** Trouser leg, white for tinting. Anchor: bottom centre. */
export function drawPantsLeg(g: Graphics, x: number, by: number): void {
  g.roundRect(x - 3.3, by - 11.5, 6.6, 11.5, 3).fill(WHITE);
  g.rect(x + 1, by - 10, 1.6, 8).fill({ color: 0x000000, alpha: 0.08 });
}

/** Shoe, white for tinting. Anchor: ankle (bottom of the leg). */
export function drawShoe(g: Graphics, x: number, by: number, side: boolean): void {
  if (side) {
    g.roundRect(x - 3.8, by - 3.2, 10, 4.6, 2.3).fill(WHITE);
    g.rect(x - 3.8, by + 0.4, 10, 1).fill({ color: 0x000000, alpha: 0.35 });
  } else {
    g.ellipse(x, by - 0.8, 4.4, 2.7).fill(WHITE);
    g.rect(x - 4.2, by + 0.6, 8.4, 1).fill({ color: 0x000000, alpha: 0.35 });
  }
  g.ellipse(x - 1, by - 2, 1.6, 0.7).fill({ color: WHITE, alpha: 0.35 });
}

/** Sweat drop for worried characters. Anchor: centre. */
export function drawDrop(g: Graphics, x: number, y: number): void {
  g.moveTo(x, y - 5).quadraticCurveTo(x + 4, y + 1, x, y + 4).quadraticCurveTo(x - 4, y + 1, x, y - 5).fill(0x7dd3fc);
  g.moveTo(x, y - 5).quadraticCurveTo(x + 4, y + 1, x, y + 4).quadraticCurveTo(x - 4, y + 1, x, y - 5).stroke({ width: 1, color: 0x0284c7, alpha: 0.6 });
  g.circle(x - 1.1, y + 0.8, 0.9).fill({ color: WHITE, alpha: 0.8 });
}
