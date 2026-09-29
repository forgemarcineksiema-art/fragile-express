// Every sprite texture in the game, generated once at startup into a single atlas.
import type { Renderer } from 'pixi.js';
import type { ParcelKind } from '../sim/types.ts';
import {
  drawCapLogo,
  drawCapStyle,
  drawDrop,
  drawFace,
  drawForearm,
  drawHairStyle,
  drawHardhatStyle,
  drawHeadShape,
  drawPantsLeg,
  drawShoe,
  drawSleeve,
  drawTorsoOutfit,
  OUTFITS,
  type Outfit,
} from './art-people.ts';
import {
  drawBubble,
  drawCash,
  drawCoinFace,
  drawGlint,
  drawHand,
  drawCoin,
  drawIcon,
  drawParcel,
  drawShadow,
  drawVan,
  drawVanDoors,
  drawVanShadow,
  drawWheel,
  type IconName,
} from './art.ts';
import { Atlas, type AtlasEntry } from './atlas.ts';
import { DISTRICT_COLORS, DISTRICT_SYMBOLS, INK, WHITE } from './palette.ts';

const KINDS: ParcelKind[] = ['normal', 'fragile', 'express', 'xxl'];
export const ICONS: IconName[] = [
  'capacity',
  'speed',
  'stability',
  'belt',
  'vanCap',
  'van2',
  'district',
  'sorter',
  'loader',
  'collector',
  'move',
  'turbo',
  'helper',
  'clapper',
  'coin',
  'glass',
  'bolt',
  'box',
  'person',
];

export const parcelTex = (district: number, kind: ParcelKind, sorted: boolean): string =>
  `parcel_${district}_${kind}_${sorted ? 1 : 0}`;

export function buildAtlas(renderer: Renderer): Atlas {
  const e: AtlasEntry[] = [];
  for (let d = 0; d < DISTRICT_COLORS.length; d++) {
    for (const kind of KINDS) {
      for (const sorted of [false, true]) {
        const big = kind === 'xxl';
        e.push({
          name: parcelTex(d, kind, sorted),
          w: big ? 46 : 30,
          h: big ? 48 : 32,
          ax: big ? 23 : 15,
          ay: big ? 46 : 30,
          draw: (g, x, y) => drawParcel(g, x, y, DISTRICT_COLORS[d]!, DISTRICT_SYMBOLS[d]!, kind, sorted),
        });
      }
    }
    e.push({ name: `van_${d}`, w: 204, h: 150, ax: 102, ay: 98, draw: (g, x, y) => drawVan(g, x, y, DISTRICT_COLORS[d]!) });
  }
  e.push({ name: 'van_doors', w: 204, h: 150, ax: 102, ay: 98, draw: (g, x, y) => drawVanDoors(g, x, y) });
  e.push({ name: 'van_shadow', w: 210, h: 100, ax: 104, ay: 44, draw: (g, x, y) => drawVanShadow(g, x, y) });
  e.push({ name: 'wheel', w: 28, h: 28, ax: 14, ay: 14, draw: (g, x, y) => drawWheel(g, x, y) });
  e.push({ name: 'hand', w: 10, h: 10, ax: 5, ay: 5, draw: (g, x, y) => drawHand(g, x, y) });
  e.push({ name: 'bubble', w: 36, h: 40, ax: 18, ay: 38, draw: (g, x, y) => drawBubble(g, x, y) });
  e.push({ name: 'coin', w: 20, h: 15, ax: 10, ay: 7, draw: (g, x, y) => drawCoin(g, x, y) });
  e.push({ name: 'coin_face', w: 22, h: 22, ax: 11, ay: 11, draw: (g, x, y) => drawCoinFace(g, x, y) });
  e.push({ name: 'glint', w: 22, h: 22, ax: 11, ay: 11, draw: (g, x, y) => drawGlint(g, x, y) });
  e.push({ name: 'cash', w: 28, h: 22, ax: 14, ay: 20, draw: (g, x, y) => drawCash(g, x, y) });
  e.push({ name: 'shadow', w: 36, h: 16, ax: 18, ay: 8, draw: (g, x, y) => drawShadow(g, x, y, 16, 6.5) });
  // Characters
  for (const f of ['front', 'side', 'back'] as const) {
    e.push({ name: `head_${f}`, w: 34, h: 30, ax: 17, ay: 15, draw: (g, x, y) => drawHeadShape(g, x, y, f) });
    e.push({ name: `hair_${f}`, w: 32, h: 32, ax: 16, ay: 16, draw: (g, x, y) => drawHairStyle(g, x, y, f) });
    e.push({ name: `cap_${f}`, w: 34, h: 22, ax: 14, ay: 16, draw: (g, x, y) => drawCapStyle(g, x, y, f) });
    e.push({ name: `hardhat_${f}`, w: 34, h: 22, ax: 16, ay: 16, draw: (g, x, y) => drawHardhatStyle(g, x, y, f) });
  }
  for (const f of ['front', 'side'] as const) {
    e.push({ name: `caplogo_${f}`, w: 20, h: 20, ax: 10, ay: 14, draw: (g, x, y) => drawCapLogo(g, x, y, f) });
    for (const m of ['normal', 'happy', 'worried', 'shock', 'blink'] as const) {
      e.push({ name: `face_${f}_${m}`, w: 30, h: 24, ax: 13, ay: 10, draw: (g, x, y) => drawFace(g, x, y, f, m) });
    }
  }
  for (const o of Object.keys(OUTFITS) as Outfit[]) {
    for (const back of [false, true]) {
      e.push({ name: `torso_${o}_${back ? 'back' : 'front'}`, w: 34, h: 28, ax: 17, ay: 25, draw: (g, x, y) => drawTorsoOutfit(g, x, y, o, back) });
    }
  }
  e.push({ name: 'sleeve', w: 10, h: 12, ax: 5, ay: 1, draw: (g, x, y) => drawSleeve(g, x, y) });
  e.push({ name: 'forearm', w: 8, h: 12, ax: 4, ay: 1, draw: (g, x, y) => drawForearm(g, x, y) });
  e.push({ name: 'pants_leg', w: 10, h: 14, ax: 5, ay: 13, draw: (g, x, y) => drawPantsLeg(g, x, y) });
  e.push({ name: 'shoe_front', w: 12, h: 8, ax: 6, ay: 4, draw: (g, x, y) => drawShoe(g, x, y, false) });
  e.push({ name: 'shoe_side', w: 16, h: 8, ax: 5, ay: 4, draw: (g, x, y) => drawShoe(g, x, y, true) });
  e.push({ name: 'drop', w: 12, h: 14, ax: 6, ay: 7, draw: (g, x, y) => drawDrop(g, x, y) });
  for (const name of ICONS) {
    e.push({ name: `icon_${name}`, w: 64, h: 64, ax: 32, ay: 32, draw: (g, x, y) => drawIcon(g, name, x, y, 26) });
  }
  e.push({
    name: 'shard',
    w: 12,
    h: 12,
    ax: 6,
    ay: 6,
    draw: (g, x, y) => {
      g.poly([x - 5, y + 4, x + 1, y - 5, x + 5, y + 3]).fill(WHITE);
    },
  });
  e.push({ name: 'square', w: 8, h: 8, ax: 4, ay: 4, draw: (g, x, y) => g.rect(x - 4, y - 4, 8, 8).fill(WHITE) });
  e.push({ name: 'dot', w: 20, h: 20, ax: 10, ay: 10, draw: (g, x, y) => g.circle(x, y, 9).fill(WHITE) });
  e.push({ name: 'ring', w: 68, h: 68, ax: 34, ay: 34, draw: (g, x, y) => g.circle(x, y, 30).stroke({ width: 5, color: WHITE }) });
  e.push({
    name: 'arrow',
    w: 44,
    h: 52,
    ax: 22,
    ay: 50,
    draw: (g, x, y) => {
      const pts = [x - 9, y - 46, x + 9, y - 46, x + 9, y - 22, x + 19, y - 22, x, y - 2, x - 19, y - 22, x - 9, y - 22];
      g.poly(pts).fill(0xf97316).stroke({ width: 3.5, color: WHITE, join: 'round' });
      g.poly(pts).stroke({ width: 1.2, color: INK, alpha: 0.35, join: 'round' });
    },
  });
  e.push({
    name: 'bar',
    w: 6,
    h: 6,
    ax: 0,
    ay: 0,
    draw: (g, x, y) => g.rect(x, y, 6, 6).fill(WHITE),
  });
  return Atlas.build(renderer, e, 2);
}
