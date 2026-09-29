// Character art for a cut-out rig with adult proportions (about five heads tall): torsos per outfit
// and facing, heads with a real profile, hair styles, beards, caps and hard hats, restrained faces,
// and capsule segments for jointed arms and legs. Skin, hair, hats, trousers and sleeves are drawn
// white and tinted per character; outfits with several colours are drawn in full colour.
// Every function draws around a local origin (see each comment) at the atlas anchor (x, y).
import type { Graphics } from 'pixi.js';
import { drawGlass } from './art.ts';
import { INK, WHITE, shade } from './palette.ts';

export type Outfit = 'player' | 'sorter' | 'loader' | 'collector' | 'helper';
export type Facing = 'front' | 'side' | 'back';
export type Mood = 'normal' | 'happy' | 'worried' | 'shock';
/** Face variants: moods plus eyes closed for blinking. */
export type FaceKind = Mood | 'blink';
export type HairStyle = 'short' | 'crop' | 'bob' | 'pony';
export const HAIR_STYLES: HairStyle[] = ['short', 'crop', 'bob', 'pony'];
export const FACE_KINDS: FaceKind[] = ['normal', 'happy', 'worried', 'shock', 'blink'];

/** Rig measurements in world units: feet on the ground at y = 0, up is negative. */
export const RIG = {
  hipY: -26,
  hipX: 3.1,
  thigh: 11.8,
  shin: 11.6,
  /** Bottom of the torso texture (hips). */
  torsoY: -25,
  /** Bottom of the neck. */
  neckY: -45.2,
  /** Centre of the head. */
  headY: -55.4,
  shoulderY: -43.4,
  shoulderX: 8.5,
  upper: 10.2,
  fore: 9.4,
};

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
  player: { shirt: 0xf07122, pants: 0x27324a, sleeve: 0xf07122, forearm: null, glove: null, hat: 'cap', hatColor: 0xc8322b, shoes: 0x2a2a2e },
  sorter: { shirt: 0x2f7d4f, pants: 0x3d4450, sleeve: 0x2f7d4f, forearm: null, glove: null, hat: 'cap', hatColor: 0x25643f, shoes: 0x4a3526 },
  loader: { shirt: 0x3b5ea8, pants: 0x2c4a8c, sleeve: 0x3b5ea8, forearm: 0x3b5ea8, glove: 0x8a5a2b, hat: 'hardhat', hatColor: 0xf2c230, shoes: 0x4a3526 },
  collector: { shirt: 0xf3f4f6, pants: 0x25272d, sleeve: 0xf3f4f6, forearm: 0xf3f4f6, glove: null, hat: 'cap', hatColor: 0x9c6a12, shoes: 0x1b1b1f },
  helper: { shirt: 0x7a3db8, pants: 0x4a4f5a, sleeve: 0x7a3db8, forearm: 0x7a3db8, glove: null, hat: 'cap', hatColor: 0x5b2b8c, shoes: 0x2a2a2e },
};

const LINE = { width: 0.9, color: INK, alpha: 0.42 };
const SHADE = { color: 0x000000, alpha: 0.13 };
const LIGHT = { color: WHITE, alpha: 0.16 };

function local(g: Graphics, x: number, y: number, draw: () => void): void {
  g.save();
  g.translateTransform(x, y);
  draw();
  g.restore();
}

// ---------------------------------------------------------------------------------------------
// Torso. Origin: bottom centre (hips). Height 21: neck base at -21, shoulders around -19.
// ---------------------------------------------------------------------------------------------

function frontPath(g: Graphics): Graphics {
  return g
    .moveTo(-3, -21)
    .quadraticCurveTo(-7, -20.6, -8.8, -19.2)
    .quadraticCurveTo(-10.4, -18, -10, -15)
    .lineTo(-8.3, -6.5)
    .quadraticCurveTo(-7.4, -3.5, -7.6, 0)
    .lineTo(7.6, 0)
    .quadraticCurveTo(7.4, -3.5, 8.3, -6.5)
    .lineTo(10, -15)
    .quadraticCurveTo(10.4, -18, 8.8, -19.2)
    .quadraticCurveTo(7, -20.6, 3, -21)
    .closePath();
}

/** Side silhouette, chest to the right (+x). */
function sidePath(g: Graphics): Graphics {
  return g
    .moveTo(-1.6, -21)
    .quadraticCurveTo(-4.8, -20.4, -5.2, -16.5)
    .quadraticCurveTo(-5.4, -10, -4.2, -6)
    .quadraticCurveTo(-5.6, -3, -5.2, 0)
    .lineTo(4.4, 0)
    .quadraticCurveTo(4.9, -4, 4.4, -8)
    .quadraticCurveTo(5.8, -13.5, 4.9, -17.5)
    .quadraticCurveTo(3.8, -20.6, 1.8, -21)
    .closePath();
}

/** Half width of the front silhouette at height y (for details that must stay inside it). */
function hw(y: number): number {
  if (y > -6.5) return 7.6 + 0.7 * (-y / 6.5) - 0.4;
  if (y > -15) return 8.3 + 1.7 * ((-y - 6.5) / 8.5) - 0.4;
  return 9.6;
}

function band(g: Graphics, y: number, h: number, color: number | { color: number; alpha: number }, facing: Facing): void {
  if (facing === 'side') g.rect(-4.9, y, 9.4, h).fill(color);
  else {
    const w = Math.min(hw(y), hw(y + h));
    g.rect(-w, y, w * 2, h).fill(color);
  }
}

/** The silhouette below height `top` (waist of dungarees and the like). */
function lower(g: Graphics, top: number, color: number, facing: Facing): void {
  if (facing === 'side') {
    g.moveTo(-4.5, top).quadraticCurveTo(-5.6, -3, -5.2, 0).lineTo(4.4, 0).quadraticCurveTo(4.9, -4, 4.5, top).closePath().fill(color);
  } else {
    const x = top < -6.5 ? 8.3 + 1.7 * ((-top - 6.5) / 8.5) : 7.6 + 0.7 * (-top / 6.5);
    g.moveTo(-x, top).lineTo(-8.3, Math.max(top, -6.5)).quadraticCurveTo(-7.4, -3.5, -7.6, 0).lineTo(7.6, 0).quadraticCurveTo(7.4, -3.5, 8.3, Math.max(top, -6.5)).lineTo(x, top).closePath().fill(color);
  }
}

function shading(g: Graphics, facing: Facing): void {
  if (facing === 'side') {
    g.moveTo(-1.6, -21).quadraticCurveTo(-4.8, -20.4, -5.2, -16.5).quadraticCurveTo(-5.4, -10, -4.2, -6).quadraticCurveTo(-5.6, -3, -5.2, 0).lineTo(-2.6, 0).quadraticCurveTo(-2.4, -11, -1.6, -21).fill(SHADE);
    g.ellipse(2.6, -16, 1.8, 3).fill(LIGHT);
  } else {
    g.moveTo(4.4, -20.8).quadraticCurveTo(7.6, -20.2, 8.8, -19.2).quadraticCurveTo(10.4, -18, 10, -15).lineTo(8.3, -6.5).quadraticCurveTo(7.4, -3.5, 7.6, 0).lineTo(4.2, 0).quadraticCurveTo(5.4, -10, 4.4, -20.8).fill(SHADE);
    g.ellipse(-6, -17, 2.4, 1.6).fill(LIGHT);
  }
  // Soft shadow under the chest / shoulder blades
  band(g, -9, 1.2, { color: 0x000000, alpha: 0.06 }, facing);
}

function outline(g: Graphics, facing: Facing): void {
  (facing === 'side' ? sidePath(g) : frontPath(g)).stroke(LINE);
}

function belt(g: Graphics, facing: Facing, color = 0x2a2522, buckle = true): void {
  band(g, -3.4, 2.4, color, facing);
  if (buckle && facing === 'front') g.rect(-1.3, -3.8, 2.6, 3.1).fill(0xc9a13b);
  if (facing === 'side') g.rect(1.6, -3.6, 1.2, 2.8).fill(shade(color, 1.4));
}

/** Vest panels over a shirt (hi-vis and waistcoats), front view. */
function vestFront(g: Graphics, color: number, bottom: number, pointed: boolean): void {
  for (const s of [-1, 1]) {
    g.moveTo(s * 3.2, -21)
      .lineTo(s * 6.4, -20.4)
      .quadraticCurveTo(s * 7.6, -17.5, s * 8.7, -14.5)
      .lineTo(s * 8.1, -6.5)
      .quadraticCurveTo(s * 7.3, -3.5, s * 7.5, bottom)
      .lineTo(s * (pointed ? 2.6 : 0.8), bottom + (pointed ? 1.4 : 0))
      .lineTo(s * 0.9, -9.5)
      .closePath()
      .fill(color);
  }
}

export function drawTorsoOutfit(g: Graphics, x: number, y: number, outfit: Outfit, facing: Facing): void {
  const s = OUTFITS[outfit];
  g.save();
  // The side silhouette is drawn narrow and widened here, details included. Pixi's transforms act
  // in world space, so scale first and translate after.
  if (facing === 'side') g.scaleTransform(1.2, 1);
  g.translateTransform(x, y);
  {
    const path = (): Graphics => (facing === 'side' ? sidePath(g) : frontPath(g));
    const front = facing === 'front';
    const back = facing === 'back';
    switch (outfit) {
      case 'player': {
        path().fill(s.shirt);
        shading(g, facing);
        const light = 0xf9a15c;
        if (front) {
          // Polo collar, placket and the company badge
          g.poly([-3.2, -21, -0.3, -21.2, -1.2, -17.6]).fill(light);
          g.poly([3.2, -21, 0.3, -21.2, 1.2, -17.6]).fill(light);
          g.rect(-0.7, -18.2, 1.4, 5).fill(shade(s.shirt, 0.8));
          g.circle(0, -16.6, 0.45).fill(WHITE);
          g.circle(0, -14.6, 0.45).fill(WHITE);
          g.circle(4.8, -14.6, 2.1).fill(WHITE);
          drawGlass(g, 4.8, -14.7, 2.8, 0xc8322b);
        } else if (back) {
          g.rect(-3.4, -21, 6.8, 1.6).fill(light);
          g.circle(0, -13.5, 3.2).fill(WHITE);
          drawGlass(g, 0, -13.6, 4.2, 0xc8322b);
        } else {
          g.poly([1.6, -21, 3.8, -20.4, 2.6, -18]).fill(light);
          g.circle(2.4, -14.2, 1.7).fill(WHITE);
          drawGlass(g, 2.4, -14.3, 2.2, 0xc8322b);
        }
        // Reflective band on the hem of the courier shirt
        band(g, -6.6, 1.3, { color: 0xe5e7eb, alpha: 0.9 }, facing);
        belt(g, facing);
        break;
      }
      case 'sorter': {
        path().fill(s.shirt);
        const vest = 0xe8d21d;
        const strip = 0xd8dde3;
        if (front) {
          vestFront(g, vest, -1.8, false);
          for (const yy of [-13, -7.6]) {
            const w = hw(yy + 1.6);
            g.rect(-w, yy, w - 1.1, 1.7).fill(strip);
            g.rect(1.1, yy, w - 1.1, 1.7).fill(strip);
          }
          g.rect(-0.9, -12, 1.8, 10).fill({ color: 0x000000, alpha: 0.12 });
        } else if (back) {
          g.moveTo(-3.4, -21).lineTo(-6.4, -20.4).quadraticCurveTo(-7.6, -17.5, -8.7, -14.5).lineTo(-8.1, -6.5).quadraticCurveTo(-7.3, -3.5, -7.5, -1.8).lineTo(7.5, -1.8).quadraticCurveTo(7.3, -3.5, 8.1, -6.5).lineTo(8.7, -14.5).quadraticCurveTo(7.6, -17.5, 6.4, -20.4).lineTo(3.4, -21).quadraticCurveTo(0, -19.4, -3.4, -21).fill(vest);
          band(g, -13, 1.7, strip, facing);
          band(g, -7.6, 1.7, strip, facing);
        } else {
          g.moveTo(-1.2, -20.6).quadraticCurveTo(-4.6, -20, -5, -16.5).quadraticCurveTo(-5.2, -10, -4.1, -6).quadraticCurveTo(-5.4, -3, -5.1, -1.8).lineTo(4.4, -1.8).quadraticCurveTo(4.8, -4, 4.3, -8).quadraticCurveTo(5.6, -13.5, 4.7, -17.2).lineTo(2, -19.4).fill(vest);
          band(g, -13, 1.7, strip, facing);
          band(g, -7.6, 1.7, strip, facing);
        }
        shading(g, facing);
        belt(g, facing, 0x2a2522, false);
        break;
      }
      case 'loader': {
        path().fill(s.shirt);
        const bib = s.pants;
        const dark = shade(bib, 0.78);
        if (front) {
          g.roundRect(-5.4, -16.6, 10.8, 12, 1.2).fill(bib);
          g.rect(-3, -14.2, 6, 3.6).fill(dark);
          g.rect(-3, -14.2, 6, 0.9).fill(shade(bib, 1.25));
          for (const sx of [-1, 1]) {
            g.moveTo(sx * 4.6, -16.4).lineTo(sx * 6.6, -20.4).stroke({ width: 2, color: bib });
            g.circle(sx * 4.3, -15.6, 0.7).fill(0xd4b24c);
          }
        } else if (back) {
          g.moveTo(-6.4, -20.2).lineTo(4.6, -7).moveTo(6.4, -20.2).lineTo(-4.6, -7).stroke({ width: 2, color: bib });
          g.circle(0, -12.4, 1.2).fill(dark);
        } else {
          g.moveTo(0.8, -16.8).lineTo(4.6, -16.8).quadraticCurveTo(5.5, -12, 4.4, -8).lineTo(0.8, -8).closePath().fill(bib);
          g.moveTo(-3, -20.6).lineTo(1.4, -16.4).stroke({ width: 2, color: bib });
          g.circle(1.6, -16.2, 0.7).fill(0xd4b24c);
        }
        // Waist of the dungarees
        lower(g, -7.2, bib, facing);
        shading(g, facing);
        band(g, -7.4, 0.9, dark, facing);
        break;
      }
      case 'collector': {
        path().fill(s.shirt);
        const vest = 0x9c6a12;
        if (front) {
          g.poly([-0.9, -20.2, 0.9, -20.2, 0.6, -18.6, -0.6, -18.6]).fill(0xb91c1c);
          g.poly([-0.6, -18.6, 0.6, -18.6, 1.2, -9.5, 0, -8.4, -1.2, -9.5]).fill(0xb91c1c);
          vestFront(g, vest, -2.2, true);
          for (let k = 0; k < 3; k++) g.circle(1.8, -12.6 + k * 2.8, 0.45).fill(0xfde68a);
        } else if (back) {
          g.moveTo(-6.4, -20.4).quadraticCurveTo(-7.6, -17.5, -8.7, -14.5).lineTo(-8.1, -6.5).quadraticCurveTo(-7.3, -3.5, -7.5, -2.2).lineTo(7.5, -2.2).quadraticCurveTo(7.3, -3.5, 8.1, -6.5).lineTo(8.7, -14.5).quadraticCurveTo(7.6, -17.5, 6.4, -20.4).quadraticCurveTo(0, -18.6, -6.4, -20.4).fill(shade(vest, 0.82));
          g.rect(-3.6, -7.2, 7.2, 1.2).fill(shade(vest, 0.65));
        } else {
          g.moveTo(-1, -20.2).quadraticCurveTo(-4.6, -19.8, -5, -16.5).quadraticCurveTo(-5.2, -10, -4.1, -6).quadraticCurveTo(-5.4, -3, -5.1, -2.2).lineTo(4.4, -2.2).quadraticCurveTo(4.8, -4, 4.3, -8).lineTo(3.6, -13).lineTo(1.6, -18.6).fill(vest);
          g.poly([3.6, -13, 4.9, -17.5, 3.8, -20.4, 2.2, -19]).fill(0xb91c1c);
        }
        shading(g, facing);
        belt(g, facing, 0x1b1b1f, !back);
        // Coin satchel on a strap across the body
        const strap = 0x5b3a1e;
        if (front) {
          g.moveTo(6.8, -19.8).lineTo(-6.6, -5.6).stroke({ width: 1.7, color: strap });
          g.roundRect(-11.2, -7.4, 6.4, 6.2, 1.2).fill(0x7a4a22).stroke(LINE);
          g.rect(-11.2, -7.4, 6.4, 2.2).fill(strap);
          g.circle(-8, -5, 0.8).fill(0xd4b24c);
        } else if (back) {
          g.moveTo(-6.8, -19.8).lineTo(6.6, -5.6).stroke({ width: 1.7, color: strap });
        } else {
          g.moveTo(-2.6, -20.6).lineTo(1.4, -6.4).stroke({ width: 1.7, color: strap });
          g.roundRect(0.2, -7.4, 6.2, 6.2, 1.2).fill(0x7a4a22).stroke(LINE);
          g.rect(0.2, -7.4, 6.2, 2.2).fill(strap);
          g.circle(3.3, -5, 0.8).fill(0xd4b24c);
        }
        break;
      }
      case 'helper': {
        path().fill(s.shirt);
        const dark = shade(s.shirt, 0.74);
        if (front) {
          g.ellipse(0, -20.4, 5.4, 1.9).fill(dark);
          g.roundRect(-5.6, -8.8, 11.2, 5.4, 2).fill(dark);
          g.moveTo(-1.5, -19.6).lineTo(-1.7, -15).moveTo(1.5, -19.6).lineTo(1.7, -15).stroke({ width: 0.7, color: 0xf3f4f6 });
        } else if (back) {
          g.roundRect(-5, -21.6, 10, 7.4, 3.6).fill(dark);
          g.moveTo(-3.4, -16).quadraticCurveTo(0, -14.4, 3.4, -16).stroke({ width: 0.7, color: shade(s.shirt, 0.6) });
        } else {
          g.ellipse(-3.4, -19.2, 2.8, 2.6).fill(dark);
          g.roundRect(0.6, -8.8, 4, 5.4, 1.6).fill(dark);
        }
        shading(g, facing);
        band(g, -2.4, 2.4, dark, facing);
        break;
      }
    }
    outline(g, facing);
  }
  g.restore();
}

// ---------------------------------------------------------------------------------------------
// Neck, head, hair, beard. Head origin: centre of the head (13 tall, 11 wide).
// ---------------------------------------------------------------------------------------------

/** Neck, tinted skin. Origin: bottom centre. */
export function drawNeck(g: Graphics, x: number, y: number): void {
  local(g, x, y, () => {
    g.roundRect(-2.2, -6.4, 4.4, 7.4, 1.6).fill(WHITE);
    g.rect(-2.2, -6.4, 4.4, 2.6).fill({ color: 0x000000, alpha: 0.2 });
    g.roundRect(-2.2, -6.4, 4.4, 7.4, 1.6).stroke(LINE);
  });
}

function headFrontPath(g: Graphics): Graphics {
  return g
    .moveTo(0, -6.6)
    .bezierCurveTo(3.8, -6.6, 5.4, -4, 5.4, -0.6)
    .bezierCurveTo(5.4, 2.9, 3.4, 6.2, 0, 6.6)
    .bezierCurveTo(-3.4, 6.2, -5.4, 2.9, -5.4, -0.6)
    .bezierCurveTo(-5.4, -4, -3.8, -6.6, 0, -6.6)
    .closePath();
}

function headSidePath(g: Graphics): Graphics {
  return g
    .moveTo(-1, -6.6)
    .bezierCurveTo(-4.6, -6.6, -6, -3.4, -5.8, -0.2)
    .bezierCurveTo(-5.6, 2.6, -3.8, 4.2, -2.6, 5.2)
    .lineTo(1.4, 6.6)
    .quadraticCurveTo(3.8, 6.9, 4.4, 5.4)
    .lineTo(4.5, 4.4)
    .lineTo(4.9, 3.6)
    .lineTo(4.8, 2.7)
    .lineTo(6.1, 1.8)
    .lineTo(5, -0.9)
    .quadraticCurveTo(5.4, -4.8, 3.2, -6)
    .quadraticCurveTo(1.4, -6.8, -1, -6.6)
    .closePath();
}

/** Head, tinted skin. */
export function drawHeadShape(g: Graphics, x: number, y: number, facing: Facing): void {
  local(g, x, y, () => {
    if (facing === 'side') {
      headSidePath(g).fill(WHITE);
      // Jaw and cheek shading, ear
      g.moveTo(-2.6, 5.2).lineTo(1.4, 6.6).quadraticCurveTo(-1, 3.4, -3.6, 3.4).closePath().fill({ color: 0x000000, alpha: 0.1 });
      g.ellipse(-0.9, 0.7, 1.05, 1.55).fill(WHITE).stroke({ ...LINE, alpha: 0.28 });
      g.moveTo(-0.7, -0.1).quadraticCurveTo(-1.4, 0.7, -0.7, 1.5).stroke({ width: 0.5, color: 0x000000, alpha: 0.18 });
      headSidePath(g).stroke(LINE);
    } else {
      for (const s of [-1, 1]) g.ellipse(s * 5.2, 0.5, 1.05, 1.6).fill(WHITE).stroke({ ...LINE, alpha: 0.3 });
      headFrontPath(g).fill(WHITE);
      // Shadow down the right side and under the cheekbones
      g.moveTo(1.8, -6.3).bezierCurveTo(4.6, -5.4, 5.4, -3, 5.4, -0.6).bezierCurveTo(5.4, 2.9, 3.4, 6.2, 0, 6.6).bezierCurveTo(3.2, 4, 4.2, 0, 1.8, -6.3).fill({ color: 0x000000, alpha: 0.1 });
      headFrontPath(g).stroke(LINE);
    }
  });
}

/** Hair, tinted. Styles differ mostly at the sides and back, which show under hats. */
export function drawHairStyle(g: Graphics, x: number, y: number, style: HairStyle, facing: Facing): void {
  local(g, x, y, () => {
    const fill = (p: Graphics): void => {
      p.fill(WHITE);
      p.stroke(LINE);
    };
    switch (style) {
      case 'short':
        if (facing === 'front') {
          fill(g.moveTo(-5.9, 0.2).bezierCurveTo(-6.3, -4.8, -3.9, -7.4, 0, -7.4).bezierCurveTo(3.9, -7.4, 6.3, -4.8, 5.9, 0.2).lineTo(5.1, 0.4).quadraticCurveTo(5, -2.6, 3.4, -3.4).quadraticCurveTo(0.8, -4.5, -2.2, -3.6).quadraticCurveTo(-4.6, -3, -5.1, 0.4).closePath());
        } else if (facing === 'side') {
          fill(g.moveTo(4.4, -3.8).quadraticCurveTo(3.6, -7.5, -0.8, -7.4).bezierCurveTo(-5.4, -7.3, -6.7, -3.6, -6.3, 0.2).quadraticCurveTo(-6.1, 3, -4.6, 4.3).lineTo(-2.6, 3.4).quadraticCurveTo(-3.3, 1, -2.4, -1.4).quadraticCurveTo(-0.6, -2.8, 1.2, -2.4).lineTo(1.3, 0.8).lineTo(2, 0.6).lineTo(2.2, -3).quadraticCurveTo(3.2, -3.9, 4.4, -3.8).closePath());
        } else {
          fill(g.moveTo(-5.9, 1).bezierCurveTo(-6.3, -4.8, -3.9, -7.4, 0, -7.4).bezierCurveTo(3.9, -7.4, 6.3, -4.8, 5.9, 1).quadraticCurveTo(5.2, 4.4, 3.4, 4.8).quadraticCurveTo(0, 5.6, -3.4, 4.8).quadraticCurveTo(-5.2, 4.4, -5.9, 1).closePath());
        }
        break;
      case 'crop':
        if (facing === 'front') {
          fill(g.moveTo(-5.6, -1.6).bezierCurveTo(-5.9, -5.6, -3.6, -7.1, 0, -7.1).bezierCurveTo(3.6, -7.1, 5.9, -5.6, 5.6, -1.6).quadraticCurveTo(4.6, -3.4, 0, -4.2).quadraticCurveTo(-4.6, -3.4, -5.6, -1.6).closePath());
        } else if (facing === 'side') {
          fill(g.moveTo(4.2, -4.2).quadraticCurveTo(3.4, -7.2, -0.8, -7.1).bezierCurveTo(-5.2, -7, -6.3, -3.6, -6, 0).quadraticCurveTo(-5.8, 2.6, -4.4, 3.8).lineTo(-2.6, 3).quadraticCurveTo(-3.2, 0.6, -2.2, -1.6).quadraticCurveTo(0.8, -3.6, 4.2, -4.2).closePath());
        } else {
          fill(g.moveTo(-5.7, 0.6).bezierCurveTo(-6, -4.6, -3.6, -7.1, 0, -7.1).bezierCurveTo(3.6, -7.1, 6, -4.6, 5.7, 0.6).quadraticCurveTo(4.6, 3.6, 0, 4).quadraticCurveTo(-4.6, 3.6, -5.7, 0.6).closePath());
        }
        break;
      case 'bob':
        if (facing === 'front') {
          fill(g.moveTo(-6.4, 4.6).bezierCurveTo(-7, -1, -6.4, -7.6, 0, -7.6).bezierCurveTo(6.4, -7.6, 7, -1, 6.4, 4.6).quadraticCurveTo(5.6, 5.3, 4.8, 4.6).quadraticCurveTo(5.2, 0, 4.2, -2.4).quadraticCurveTo(0.6, -3.3, -3.4, -3).quadraticCurveTo(-4.8, -2.4, -4.6, 0.4).quadraticCurveTo(-4.6, 3.6, -4.8, 4.6).quadraticCurveTo(-5.6, 5.3, -6.4, 4.6).closePath());
        } else if (facing === 'side') {
          fill(g.moveTo(4.4, -3.4).quadraticCurveTo(3.8, -7.7, -0.8, -7.6).bezierCurveTo(-6, -7.5, -7.2, -3, -6.8, 1.4).quadraticCurveTo(-6.6, 4.6, -5.4, 5.6).quadraticCurveTo(-2, 6.3, 0.6, 5.2).quadraticCurveTo(0.2, 1.6, 0.9, -1.8).quadraticCurveTo(2.4, -3.2, 4.4, -3.4).closePath());
        } else {
          fill(g.moveTo(-6.4, 4.8).bezierCurveTo(-7, -1, -6.4, -7.6, 0, -7.6).bezierCurveTo(6.4, -7.6, 7, -1, 6.4, 4.8).quadraticCurveTo(0, 6.6, -6.4, 4.8).closePath());
        }
        break;
      case 'pony':
        if (facing === 'front') {
          fill(g.moveTo(-5.8, -0.6).bezierCurveTo(-6.1, -5.2, -3.8, -7.3, 0, -7.3).bezierCurveTo(3.8, -7.3, 6.1, -5.2, 5.8, -0.6).lineTo(5, -0.4).quadraticCurveTo(4.6, -3.6, 0, -4.4).quadraticCurveTo(-4.6, -3.6, -5, -0.4).closePath());
        } else if (facing === 'side') {
          fill(g.moveTo(-5.4, -2.2).bezierCurveTo(-9.4, -2.6, -10, 2.6, -8.2, 7).quadraticCurveTo(-7.4, 3.4, -5, 1.6).closePath());
          fill(g.moveTo(4.2, -4.2).quadraticCurveTo(3.4, -7.4, -0.8, -7.3).bezierCurveTo(-5.2, -7.2, -6.4, -3.6, -6.1, 0).quadraticCurveTo(-5.9, 2.6, -4.5, 3.8).lineTo(-2.6, 3).quadraticCurveTo(-3.2, 0.6, -2.2, -1.6).quadraticCurveTo(0.8, -3.6, 4.2, -4.2).closePath());
          g.roundRect(-6.6, -2.6, 1.8, 3.4, 0.8).fill({ color: 0x000000, alpha: 0.45 });
        } else {
          fill(g.moveTo(-1.8, 1.4).bezierCurveTo(-2.8, 5.2, -1.6, 9, 0, 10).bezierCurveTo(1.6, 9, 2.8, 5.2, 1.8, 1.4).closePath());
          fill(g.moveTo(-5.8, 0.8).bezierCurveTo(-6.1, -4.8, -3.8, -7.3, 0, -7.3).bezierCurveTo(3.8, -7.3, 6.1, -4.8, 5.8, 0.8).quadraticCurveTo(4.8, 3.8, 0, 4.2).quadraticCurveTo(-4.8, 3.8, -5.8, 0.8).closePath());
          g.roundRect(-1.4, 2.6, 2.8, 1.6, 0.6).fill({ color: 0x000000, alpha: 0.45 });
        }
        break;
    }
    // A little sheen on top
    if (facing !== 'back' || style !== 'pony') g.ellipse(-1.6, -5.8, 2.2, 0.8).fill({ color: WHITE, alpha: 0.18 });
  });
}

/** Short beard, tinted with the hair colour. */
export function drawBeard(g: Graphics, x: number, y: number, facing: 'front' | 'side'): void {
  local(g, x, y, () => {
    if (facing === 'front') {
      g.moveTo(-5.3, 0.4).bezierCurveTo(-5.2, 3.4, -3.4, 6.6, 0, 7).bezierCurveTo(3.4, 6.6, 5.2, 3.4, 5.3, 0.4).lineTo(4.4, 0.8).quadraticCurveTo(3.8, 2.6, 2.2, 2.7).quadraticCurveTo(0, 2.1, -2.2, 2.7).quadraticCurveTo(-3.8, 2.6, -4.4, 0.8).closePath().fill(WHITE).stroke(LINE);
      g.moveTo(-1.6, 4.1).quadraticCurveTo(0, 4.5, 1.6, 4.1).quadraticCurveTo(0, 5.1, -1.6, 4.1).fill({ color: 0x000000, alpha: 0.25 });
    } else {
      g.moveTo(-0.4, 2.4).lineTo(-2.4, 5.2).lineTo(1.4, 6.9).quadraticCurveTo(3.9, 7.1, 4.5, 5.4).lineTo(4.9, 3.5).lineTo(3.4, 3.1).lineTo(1.4, 3.4).lineTo(0.9, 1.4).closePath().fill(WHITE).stroke(LINE);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Hats (tinted) sit on the head origin; the brim stays above the eyes.
// ---------------------------------------------------------------------------------------------

export function drawCapStyle(g: Graphics, x: number, y: number, facing: Facing): void {
  local(g, x, y, () => {
    if (facing === 'side') {
      g.moveTo(-6.4, -2).bezierCurveTo(-6.8, -7.4, -3.4, -9.6, 0.4, -9.4).bezierCurveTo(4, -9.2, 5.8, -6.8, 5.4, -3.4).lineTo(-6.4, -2).closePath().fill(WHITE).stroke(LINE);
      g.moveTo(1.6, -9).bezierCurveTo(4.4, -8.4, 5.6, -6.6, 5.4, -3.4).lineTo(3.4, -3.2).quadraticCurveTo(3.6, -6.6, 1.6, -9).fill(SHADE);
      g.moveTo(4, -3.8).quadraticCurveTo(7.6, -4, 10.2, -2.8).quadraticCurveTo(10.6, -1.8, 9.6, -1.7).quadraticCurveTo(7.2, -2.4, 4.2, -2.2).closePath().fill(WHITE).stroke(LINE);
      g.moveTo(4.2, -2.2).quadraticCurveTo(7.2, -2.4, 9.6, -1.7).lineTo(9.4, -2.2).quadraticCurveTo(7, -2.8, 4.2, -2.8).fill({ color: 0x000000, alpha: 0.22 });
      return;
    }
    const crown = (): Graphics => g.moveTo(-5.9, -2.6).bezierCurveTo(-6.2, -7.2, -3.6, -9.4, 0, -9.4).bezierCurveTo(3.6, -9.4, 6.2, -7.2, 5.9, -2.6).quadraticCurveTo(0, -3.4, -5.9, -2.6).closePath();
    crown().fill(WHITE);
    g.moveTo(2.4, -9.1).bezierCurveTo(5, -8.2, 6.2, -6, 5.9, -2.6).lineTo(3.8, -2.9).quadraticCurveTo(4.2, -6.6, 2.4, -9.1).fill(SHADE);
    g.moveTo(0, -9.3).lineTo(0, -3.2).stroke({ width: 0.6, color: 0x000000, alpha: 0.16 });
    g.circle(0, -9.2, 0.8).fill({ color: 0x000000, alpha: 0.18 });
    crown().stroke(LINE);
    if (facing === 'front') {
      g.moveTo(-6, -2.9).quadraticCurveTo(0, -4.4, 6, -2.9).quadraticCurveTo(6.4, -1.6, 5.2, -1.4).quadraticCurveTo(0, -2.4, -5.2, -1.4).quadraticCurveTo(-6.4, -1.6, -6, -2.9).closePath().fill(WHITE).stroke(LINE);
      g.moveTo(-5.2, -1.4).quadraticCurveTo(0, -2.4, 5.2, -1.4).quadraticCurveTo(0, -1.9, -5.2, -1.4).fill({ color: 0x000000, alpha: 0.25 });
    } else {
      g.moveTo(-1.8, -2.8).quadraticCurveTo(0, -5, 1.8, -2.8).closePath().fill({ color: 0x000000, alpha: 0.35 });
      g.rect(-2.4, -3.4, 4.8, 0.8).fill({ color: 0x000000, alpha: 0.2 });
    }
  });
}

export function drawHardhatStyle(g: Graphics, x: number, y: number, facing: Facing): void {
  local(g, x, y, () => {
    const side = facing === 'side';
    const dome = (): Graphics => (side ? g.moveTo(-6.6, -2.6).bezierCurveTo(-6.9, -8.2, -3.4, -10.4, 0, -10.4).bezierCurveTo(3.8, -10.4, 6.4, -8, 6.1, -2.6).closePath() : g.moveTo(-6.2, -2.6).bezierCurveTo(-6.5, -8.2, -3.4, -10.4, 0, -10.4).bezierCurveTo(3.4, -10.4, 6.5, -8.2, 6.2, -2.6).closePath());
    dome().fill(WHITE);
    g.moveTo(2.4, -10).bezierCurveTo(5.4, -9, 6.4, -6.6, 6.2, -2.6).lineTo(4, -2.6).quadraticCurveTo(4.6, -7, 2.4, -10).fill(SHADE);
    g.roundRect(side ? -2.6 : -1.1, -10.6, side ? 5.2 : 2.2, 8, 1.1).fill({ color: WHITE, alpha: 0.35 });
    dome().stroke(LINE);
    if (side) g.roundRect(-7.6, -3.4, 17.4, 1.9, 0.9).fill(WHITE).stroke(LINE);
    else g.ellipse(0, -2.6, 7.6, 1.5).fill(WHITE).stroke(LINE);
    if (side) g.rect(-7.4, -1.8, 17, 0.6).fill({ color: 0x000000, alpha: 0.2 });
  });
}

/** Company badge on the player's cap (untinted). */
export function drawCapLogo(g: Graphics, x: number, y: number, facing: Facing): void {
  if (facing === 'back') return;
  local(g, x, y, () => {
    const lx = facing === 'side' ? 2.2 : 0;
    g.circle(lx, -6.2, 1.9).fill(WHITE);
    drawGlass(g, lx, -6.3, 2.6, 0xc8322b);
  });
}

// ---------------------------------------------------------------------------------------------
// Faces (full colour): small eyes, brows, a hint of nose and mouth. No blush, no big shiny eyes.
// ---------------------------------------------------------------------------------------------

const EYE = 0x1c1714;
const BROW = { width: 0.8, color: 0x3a2618, alpha: 0.9, cap: 'round' as const };
const MOUTH = { width: 0.7, color: 0x8a3a2c, alpha: 0.75, cap: 'round' as const };

export function drawFace(g: Graphics, x: number, y: number, facing: 'front' | 'side', mood: FaceKind): void {
  local(g, x, y, () => {
    const side = facing === 'side';
    const eyes = side ? [3.3] : [-2.05, 2.05];
    const ey = -0.2;
    // Eyes
    for (let i = 0; i < eyes.length; i++) {
      const ex = eyes[i]!;
      if (mood === 'blink') g.moveTo(ex - 0.8, ey + 0.2).lineTo(ex + 0.8, ey + 0.2).stroke({ width: 0.7, color: EYE, cap: 'round' });
      else if (mood === 'shock') {
        g.ellipse(ex, ey, side ? 0.9 : 1.1, 1.25).fill(WHITE);
        g.circle(ex + (side ? 0.3 : 0), ey + 0.1, 0.62).fill(EYE);
      } else if (mood === 'happy') g.ellipse(ex, ey + 0.1, side ? 0.55 : 0.72, 0.6).fill(EYE);
      else g.ellipse(ex, ey, side ? 0.55 : 0.72, 0.92).fill(EYE);
    }
    // Brows
    for (let i = 0; i < eyes.length; i++) {
      const ex = eyes[i]!;
      const inner = side ? 1 : i === 0 ? 1 : -1; // direction towards the nose
      let y0 = -2.2;
      let y1 = -2.3;
      if (mood === 'worried') {
        y0 = -1.9;
        y1 = -2.9;
      } else if (mood === 'shock') {
        y0 = y1 = -2.9;
      } else if (mood === 'happy') {
        y0 = -2.5;
        y1 = -2.5;
      }
      g.moveTo(ex - 1.1 * inner, y0).quadraticCurveTo(ex, Math.min(y0, y1) - 0.4, ex + 1.1 * inner, y1).stroke(BROW);
    }
    // Nose shading and mouth
    if (side) {
      g.moveTo(5.1, 2.4).quadraticCurveTo(4.4, 2.6, 4.6, 1.8).stroke({ width: 0.5, color: 0x000000, alpha: 0.25 });
      if (mood === 'shock') g.ellipse(4.2, 4.1, 0.6, 0.8).fill(0x5a1d16);
      else if (mood === 'happy') g.moveTo(3.3, 3.7).quadraticCurveTo(4, 4.5, 4.7, 3.9).stroke(MOUTH);
      else if (mood === 'worried') g.moveTo(3.4, 4.2).quadraticCurveTo(4, 3.8, 4.6, 4.1).stroke(MOUTH);
      else g.moveTo(3.4, 4).lineTo(4.6, 3.9).stroke(MOUTH);
    } else {
      g.moveTo(-0.5, 2.1).quadraticCurveTo(0, 2.6, 0.7, 2.1).stroke({ width: 0.55, color: 0x000000, alpha: 0.28 });
      if (mood === 'shock') g.ellipse(0, 4.2, 0.8, 1).fill(0x5a1d16);
      else if (mood === 'happy') {
        g.moveTo(-1.7, 3.6).quadraticCurveTo(0, 5.2, 1.7, 3.6).quadraticCurveTo(0, 4.3, -1.7, 3.6).fill(0x6b2419);
      } else if (mood === 'worried') g.moveTo(-1.3, 4.3).quadraticCurveTo(0, 3.7, 1.3, 4.3).stroke(MOUTH);
      else g.moveTo(-1.3, 3.9).quadraticCurveTo(0, 4.3, 1.3, 3.9).stroke(MOUTH);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Limbs: capsules from a joint (origin) down to the next joint at `len`, white for tinting.
// ---------------------------------------------------------------------------------------------

export function drawLimb(g: Graphics, x: number, y: number, w: number, len: number, hem: boolean): void {
  local(g, x, y, () => {
    const r = w / 2;
    g.roundRect(-r, -r, w, len + w, r).fill(WHITE);
    g.roundRect(r * 0.2, -r + 0.8, r * 0.7, len + w - 1.6, r * 0.35).fill(SHADE);
    if (hem) g.rect(-r + 0.2, len + r - 2.2, w - 0.4, 1.1).fill({ color: 0x000000, alpha: 0.16 });
    // Outline the sides and the lower end only, so elbows and knees read as one bending limb.
    g.moveTo(-r, 0).lineTo(-r, len).arc(0, len, r, Math.PI, 0, true).lineTo(r, 0).stroke(LINE);
  });
}

/** Hand (tinted skin or glove). Origin: centre. */
export function drawHandShape(g: Graphics, x: number, y: number): void {
  local(g, x, y, () => {
    g.ellipse(-1.5, -0.4, 1, 1.4).fill(WHITE).stroke(LINE);
    g.ellipse(0.2, 0.2, 2.1, 2.4).fill(WHITE);
    g.ellipse(0.9, 0.7, 1, 1.4).fill(SHADE);
    g.ellipse(0.2, 0.2, 2.1, 2.4).stroke(LINE);
  });
}

/** Work shoe, tinted. Origin: the ankle. Side view points to +x. */
export function drawShoe(g: Graphics, x: number, y: number, side: boolean): void {
  local(g, x, y, () => {
    if (side) {
      const p = (): Graphics => g.moveTo(-2.7, -0.9).lineTo(1.6, -0.9).quadraticCurveTo(5.8, -0.6, 6.4, 1.4).lineTo(6.4, 2.6).lineTo(-2.9, 2.6).quadraticCurveTo(-3.2, 0.6, -2.7, -0.9).closePath();
      p().fill(WHITE);
      g.rect(-2.9, 1.7, 9.3, 0.9).fill({ color: 0x000000, alpha: 0.4 });
      g.ellipse(3.6, 0.2, 1.6, 0.6).fill(LIGHT);
      p().stroke(LINE);
    } else {
      g.roundRect(-3.3, -0.8, 6.6, 3.5, 1.6).fill(WHITE);
      g.rect(-3.2, 1.8, 6.4, 0.9).fill({ color: 0x000000, alpha: 0.4 });
      g.ellipse(-0.8, 0.2, 1.4, 0.6).fill(LIGHT);
      g.roundRect(-3.3, -0.8, 6.6, 3.5, 1.6).stroke(LINE);
    }
  });
}

/** Sweat drop for worried characters. Origin: centre. */
export function drawDrop(g: Graphics, x: number, y: number): void {
  local(g, x, y, () => {
    const p = (): Graphics => g.moveTo(0, -3.6).quadraticCurveTo(2.8, 0.6, 0, 2.8).quadraticCurveTo(-2.8, 0.6, 0, -3.6);
    p().fill(0x93c5fd);
    p().stroke({ width: 0.8, color: 0x2563eb, alpha: 0.6 });
    g.circle(-0.7, 0.6, 0.6).fill({ color: WHITE, alpha: 0.8 });
  });
}
