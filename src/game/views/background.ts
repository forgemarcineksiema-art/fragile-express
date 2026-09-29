// Static scenery: street, building shell, floor, office carpet and the painted zone markings.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { t } from '../../core/i18n.ts';
import type { Rect } from '../../core/math.ts';
import { BACK_WALL, WALL, type Layout, type LocationJson } from '../../sim/layout.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import { drawGlass } from '../art.ts';
import type { Atlas } from '../atlas.ts';
import { DISTRICT_COLORS, INK, THEMES, WHITE, shade, type Theme } from '../palette.ts';
import { FONT } from '../text.ts';

export const WORLD_MARGIN = { left: 250, right: 330, top: 170, bottom: 90 };
const WALL_H = 96;

function dashedRect(g: Graphics, r: Rect, color: number, width = 3, dash = 10, gap = 7, alpha = 1): void {
  const edge = (x0: number, y0: number, x1: number, y1: number): void => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const dx = (x1 - x0) / len;
    const dy = (y1 - y0) / len;
    for (let s = 0; s < len; s += dash + gap) {
      const e = Math.min(len, s + dash);
      g.moveTo(x0 + dx * s, y0 + dy * s).lineTo(x0 + dx * e, y0 + dy * e);
    }
  };
  edge(r.x, r.y, r.x + r.w, r.y);
  edge(r.x + r.w, r.y, r.x + r.w, r.y + r.h);
  edge(r.x + r.w, r.y + r.h, r.x, r.y + r.h);
  edge(r.x, r.y + r.h, r.x, r.y);
  g.stroke({ width, color, alpha, cap: 'round' });
}

function chevron(g: Graphics, x: number, y: number, s: number, color: number, alpha = 1): void {
  g.poly([x - s * 0.5, y - s * 0.6, x + s * 0.45, y, x - s * 0.5, y + s * 0.6, x - s * 0.2, y]).fill({ color, alpha });
}

/** Floor marking for a zone: tinted fill, dashed border, flow chevrons. */
export function drawZone(g: Graphics, r: Rect, color: number, arrows: number): void {
  g.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10).fill({ color, alpha: 0.16 });
  dashedRect(g, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, color, 3.5, 11, 7, 0.9);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  for (let i = 0; i < arrows; i++) chevron(g, cx - (arrows - 1) * 7 + i * 14, cy, 16, color, 0.55);
}

/** x of every back-wall window. */
function windowXs(L: Layout): number[] {
  const out: number[] = [];
  const signL = L.w / 2 - 150;
  const signR = L.w / 2 + 150;
  for (let x = 90; x < L.w - 120; x += 210) if (x + 92 < signL - 6 || x > signR + 6) out.push(x);
  return out;
}

type Decor = (g: Graphics, cx: number, top: number, th: Theme) => void;

const drawClock: Decor = (g, cx, top) => {
  const cy = top + 38;
  g.circle(cx, cy + 2, 18).fill({ color: 0x000000, alpha: 0.12 });
  g.circle(cx, cy, 18).fill(WHITE).stroke({ width: 4, color: 0x334155 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.circle(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, i % 3 === 0 ? 1.8 : 1).fill(0x334155);
  }
  g.moveTo(cx, cy).lineTo(cx - 6, cy - 5).stroke({ width: 3, color: INK, cap: 'round' });
  g.moveTo(cx, cy).lineTo(cx + 8, cy - 8).stroke({ width: 2, color: INK, cap: 'round' });
  g.circle(cx, cy, 2).fill(0xdc2626);
};

const drawPoster: Decor = (g, cx, top) => {
  g.rect(cx - 22 + 3, top + 14 + 3, 44, 56).fill({ color: 0x000000, alpha: 0.12 });
  g.rect(cx - 22, top + 14, 44, 56).fill(0xf97316);
  g.rect(cx - 18, top + 18, 36, 34).fill(0xfff7ed);
  drawGlass(g, cx, top + 35, 24, 0xdc2626);
  g.rect(cx - 16, top + 56, 32, 4).fill(WHITE);
  g.rect(cx - 12, top + 62, 24, 3).fill({ color: WHITE, alpha: 0.7 });
};

const drawBoard: Decor = (g, cx, top) => {
  g.rect(cx - 30, top + 18, 60, 42).fill(0x8b5a2b);
  g.rect(cx - 27, top + 21, 54, 36).fill(0xd6a86a);
  const notes = [0xfef08a, 0xbae6fd, 0xfecaca, 0xbbf7d0];
  notes.forEach((c, i) => {
    const x = cx - 24 + (i % 2) * 26 + (i > 1 ? 4 : 0);
    const y = top + 24 + Math.floor(i / 2) * 16;
    g.rect(x, y, 20, 14).fill(c);
    g.circle(x + 10, y + 2, 1.8).fill(0xdc2626);
  });
};

const drawMap: Decor = (g, cx, top) => {
  g.rect(cx - 32, top + 16, 64, 46).fill(WHITE);
  g.rect(cx - 29, top + 19, 58, 40).fill(0xd9f99d);
  g.rect(cx - 29, top + 36, 58, 4).fill(WHITE);
  g.rect(cx - 6, top + 19, 4, 40).fill(WHITE);
  g.poly([cx + 10, top + 19, cx + 29, top + 19, cx + 29, top + 30]).fill(0x93c5fd);
  DISTRICT_COLORS.forEach((c, i) => {
    const x = cx - 22 + (i % 3) * 20;
    const y = top + 27 + Math.floor(i / 3) * 18;
    g.circle(x, y, 3.2).fill(c).stroke({ width: 1, color: INK, alpha: 0.4 });
  });
};

const drawExtinguisher: Decor = (g, cx, top, th) => {
  // Sign on the wall and the extinguisher standing at its foot.
  g.roundRect(cx - 12, top + 14, 24, 18, 3).fill(0xdc2626);
  g.rect(cx - 2, top + 17, 4, 12).fill(WHITE);
  g.rect(cx - 7, top + 21, 14, 4).fill(WHITE);
  const by = BACK_WALL - 2;
  g.ellipse(cx, by, 10, 3).fill({ color: 0x000000, alpha: 0.18 });
  g.roundRect(cx - 7, by - 34, 14, 34, 6).fill(0xdc2626);
  g.rect(cx - 7, by - 24, 14, 6).fill(0xfef2f2);
  g.rect(cx - 3, by - 40, 6, 7).fill(0x1f2937);
  g.moveTo(cx + 3, by - 38).quadraticCurveTo(cx + 13, by - 34, cx + 9, by - 18).stroke({ width: 2.5, color: 0x1f2937 });
  void th;
};

export class Background {
  readonly ground = new Container();
  /** Zone markings per district, shown once the district is built. */
  readonly districtZones: Graphics[] = [];
  private readonly theme: Theme;

  constructor(
    private readonly wh: Warehouse,
    private readonly atlas: Atlas,
  ) {
    this.theme = THEMES[wh.loc.theme] ?? THEMES.post!;
    const L = wh.layout;
    this.drawOutside(L);
    this.drawFloor(L);
    this.drawOffice(L);
    this.drawZones(L);
    this.drawWalls(L, wh.loc);
  }

  private drawOutside(L: Layout): void {
    const th = this.theme;
    const g = new Graphics();
    const m = WORLD_MARGIN;
    const X0 = -m.left - 200;
    const Y0 = -m.top - 200;
    const FW = L.w + m.left + m.right + 400;
    const FH = L.h + m.top + m.bottom + 400;
    g.rect(X0, Y0, FW, FH).fill(th.grass);
    // Mown stripes on the lawn
    for (let y = Y0; y < Y0 + FH; y += 48) g.rect(X0, y, FW, 24).fill({ color: WHITE, alpha: 0.05 });
    // Asphalt: yard with parking bays east of the building, truck lanes west of it.
    const lane = th.outsideLine;
    g.rect(L.w - 10, Y0, m.right + 210, FH).fill(th.outside);
    for (const b of L.belts) g.rect(X0, b.y - 78, -X0 + 10, 156).fill(th.outside);
    // Pavement around the building
    g.rect(-14, -14 - 100, L.w + 28, L.h + 128 + 100).fill(0xd6d3d1);
    for (const d of L.docks) {
      g.rect(L.w + 8, d.y - 50, 190, 3).fill({ color: lane, alpha: 0.8 });
      g.rect(L.w + 8, d.y + 48, 190, 3).fill({ color: lane, alpha: 0.8 });
    }
    for (let y = Y0; y < Y0 + FH; y += 60) g.rect(L.w + 262, y, 6, 30).fill({ color: lane, alpha: 0.7 });
    for (const b of L.belts) {
      g.rect(X0, b.y - 62, -X0 - WALL, 3).fill({ color: lane, alpha: 0.7 });
      g.rect(X0, b.y + 62, -X0 - WALL, 3).fill({ color: lane, alpha: 0.7 });
    }
    // Trees and bushes on the grass
    const tree = (x: number, y: number, r: number): void => {
      g.ellipse(x + 4, y + r * 0.7, r * 0.9, r * 0.35).fill({ color: 0x000000, alpha: 0.18 });
      g.circle(x, y, r).fill(shade(th.grass, 0.72));
      g.circle(x - r * 0.3, y - r * 0.3, r * 0.55).fill(shade(th.grass, 0.85));
    };
    const onAsphalt = (x: number, y: number): boolean =>
      x > L.w - 40 || (x < 10 && L.belts.some((b) => Math.abs(y - b.y) < 110)) || (x > -30 && x < L.w + 30 && y > -130 && y < L.h + 30);
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      const x = X0 + rnd() * FW;
      const y = Y0 + rnd() * FH;
      if (onAsphalt(x, y)) continue;
      tree(x, y, 16 + rnd() * 16);
    }
    this.ground.addChild(g);
  }

  private drawFloor(L: Layout): void {
    const th = this.theme;
    const g = new Graphics();
    g.rect(WALL, BACK_WALL, L.w - WALL * 2, L.h - BACK_WALL - WALL).fill(th.floor);
    const tile = 64;
    for (let y = BACK_WALL, j = 0; y < L.h - WALL; y += tile, j++) {
      for (let x = WALL, i = 0; x < L.w - WALL; x += tile, i++) {
        if ((i + j) % 2 === 0) continue;
        g.rect(x, y, Math.min(tile, L.w - WALL - x), Math.min(tile, L.h - WALL - y)).fill(th.floorAlt);
      }
    }
    for (let x = WALL + tile; x < L.w - WALL; x += tile) g.rect(x - 1, BACK_WALL, 2, L.h - BACK_WALL - WALL).fill({ color: th.grout, alpha: 0.7 });
    for (let y = BACK_WALL + tile; y < L.h - WALL; y += tile) g.rect(WALL, y - 1, L.w - WALL * 2, 2).fill({ color: th.grout, alpha: 0.7 });
    // Soft shadow along the back wall
    g.rect(WALL, BACK_WALL, L.w - WALL * 2, 18).fill({ color: 0x000000, alpha: 0.08 });
    // Scuffs so the floor does not look brand new.
    let seed = 11;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (L.w * L.h) / 9000; i++) {
      const x = WALL + rnd() * (L.w - WALL * 2);
      const y = BACK_WALL + 20 + rnd() * (L.h - BACK_WALL - WALL - 30);
      g.ellipse(x, y, 4 + rnd() * 10, 2 + rnd() * 4).fill({ color: 0x000000, alpha: 0.03 });
    }
    // Sunlight falling through the windows.
    for (const x of windowXs(L)) {
      g.poly([x + 4, BACK_WALL, x + 88, BACK_WALL, x + 150, BACK_WALL + 150, x + 66, BACK_WALL + 150]).fill({ color: 0xfffbeb, alpha: 0.13 });
    }
    // Pools of light under the ceiling lamps.
    for (let y = BACK_WALL + 150; y < L.h - 60; y += 260) {
      for (let x = WALL + 150; x < L.w - 60; x += 280) {
        for (let r = 5; r >= 1; r--) g.ellipse(x, y, 34 * r, 22 * r).fill({ color: 0xffffff, alpha: 0.018 });
      }
    }
    this.ground.addChild(g);
  }

  private drawOffice(L: Layout): void {
    const th = this.theme;
    const g = new Graphics();
    const o = L.office;
    g.roundRect(o.x + 4, o.y + 6, o.w, o.h, 18).fill({ color: 0x000000, alpha: 0.08 });
    g.roundRect(o.x, o.y, o.w, o.h, 18).fill(th.office);
    g.roundRect(o.x, o.y, o.w, o.h, 18).stroke({ width: 4, color: th.officeEdge });
    // Carpet pattern
    for (let y = o.y + 22; y < o.y + o.h - 10; y += 22) g.rect(o.x + 12, y, o.w - 24, 2).fill({ color: WHITE, alpha: 0.12 });
    this.ground.addChild(g);
    // Column headers: who the upgrades are for
    const heads = ['person', 'sorter', 'loader', 'collector'] as const;
    heads.forEach((name, col) => {
      const s = new Sprite(this.atlas.get(`icon_${name}`));
      s.scale.set(0.62);
      s.position.set(L.officeOrigin.x + col * 98, o.y + 28);
      this.ground.addChild(s);
    });
    // Cash desk zone marking
    drawZone(g, L.safe.zone, 0xeab308, 0);
  }

  private drawZones(L: Layout): void {
    const base = new Graphics();
    for (const b of L.belts) {
      // Yellow/black hazard frame at the belt end.
      const z = b.zone;
      base.roundRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6, 10).fill({ color: 0xfacc15, alpha: 0.2 });
      const step = 14;
      for (let x = z.x + 6; x < z.x + z.w - 6; x += step) {
        base.poly([x, z.y + 4, x + 7, z.y + 4, x + 3, z.y + 10, x - 4, z.y + 10]).fill({ color: INK, alpha: 0.6 });
        base.poly([x, z.y + z.h - 10, x + 7, z.y + z.h - 10, x + 3, z.y + z.h - 4, x - 4, z.y + z.h - 4]).fill({ color: INK, alpha: 0.6 });
      }
      dashedRect(base, { x: z.x + 4, y: z.y + 4, w: z.w - 8, h: z.h - 8 }, 0xeab308, 4, 12, 6);
    }
    this.ground.addChild(base);
    for (let d = 0; d < L.shelves.length; d++) {
      const g = new Graphics();
      const color = DISTRICT_COLORS[d]!;
      const s = L.shelves[d]!;
      drawZone(g, s.inZone, color, 1);
      drawZone(g, s.outZone, color, 2);
      const dock = L.docks[d]!;
      drawZone(g, dock.zone, color, 3);
      // Coin spot
      g.circle(dock.pile.x, dock.pile.y, 30).fill({ color: 0xfbbf24, alpha: 0.14 });
      g.circle(dock.pile.x, dock.pile.y, 30).stroke({ width: 2.5, color: 0xf59e0b, alpha: 0.5 });
      // Dock leveller plate against the wall
      g.rect(dock.zone.x + dock.zone.w - 14, dock.zone.y + 10, 12, dock.zone.h - 20).fill(0x9ca3af);
      g.visible = false;
      this.districtZones.push(g);
      this.ground.addChild(g);
    }
  }

  private drawWalls(L: Layout, loc: LocationJson): void {
    const th = this.theme;
    const g = new Graphics();
    const top = BACK_WALL - WALL_H;
    // Back wall: top edge + tall front face with windows.
    g.rect(-6, top - 22, L.w + 12, 24).fill(th.wallTop);
    g.rect(-6, top, L.w + 12, WALL_H).fill(th.wallFace);
    g.rect(-6, BACK_WALL - 10, L.w + 12, 10).fill(th.wallTrim);
    const signW = 300;
    const sx = L.w / 2 - signW / 2;
    for (const x of windowXs(L)) {
      g.roundRect(x, top + 16, 92, 44, 6).fill(0xbfe3f5);
      g.roundRect(x, top + 16, 92, 44, 6).stroke({ width: 4, color: WHITE });
      g.rect(x + 44, top + 16, 4, 44).fill(WHITE);
      g.poly([x + 8, top + 52, x + 30, top + 22, x + 40, top + 22, x + 18, top + 52]).fill({ color: WHITE, alpha: 0.4 });
    }
    // Decorations in the gaps between windows.
    const decor = [drawClock, drawPoster, drawBoard, drawMap, drawExtinguisher];
    let k = 0;
    for (const x of windowXs(L)) {
      const cx = x + 92 + 59;
      if (cx + 40 > L.w - 40 || (cx + 40 > sx && cx - 40 < sx + signW)) continue;
      decor[k++ % decor.length]!(g, cx, top, this.theme);
    }
    // Sign with the location name
    g.roundRect(sx, top + 10, signW, 54, 12).fill(th.sign);
    g.roundRect(sx, top + 10, signW, 54, 12).stroke({ width: 4, color: WHITE });
    g.circle(sx + 34, top + 37, 18).fill(WHITE);
    drawGlass(g, sx + 34, top + 37, 24, th.sign);
    // Side walls (low bands) with dock door gaps on the right.
    g.rect(0, top - 22, WALL, L.h - top + 22).fill(th.wallTop);
    g.rect(0, L.h - 30, WALL, 30).fill(th.wallFace);
    g.rect(L.w - WALL, top - 22, WALL, L.h - top + 22).fill(th.wallTop);
    g.rect(L.w - WALL, L.h - 30, WALL, 30).fill(th.wallFace);
    for (const d of L.docks) {
      g.rect(L.w - WALL - 2, d.y - 46, WALL + 4, 92).fill(0x374151);
      for (let y = d.y - 46; y < d.y + 46; y += 12) {
        g.rect(L.w - WALL - 4, y, 5, 6).fill(0xfacc15);
        g.rect(L.w - 1, y, 5, 6).fill(0xfacc15);
      }
    }
    for (const b of L.belts) {
      g.rect(-2, b.y - 34, WALL + 4, 68).fill(0x374151);
      g.rect(-4, b.y - 36, WALL + 8, 5).fill(0xfacc15);
      g.rect(-4, b.y + 31, WALL + 8, 5).fill(0xfacc15);
    }
    // Front wall (low)
    g.rect(0, L.h - WALL, L.w, WALL).fill(th.wallTop);
    g.rect(0, L.h - 8, L.w, 8).fill(th.wallFace);
    this.ground.addChild(g);

    const name = new Text({
      text: t(loc.name).toUpperCase(),
      style: { fontFamily: FONT, fontSize: 24, fontWeight: '900', fill: WHITE, letterSpacing: 1 },
    });
    name.anchor.set(0.5);
    name.position.set(L.w / 2 + 22, top + 37);
    if (name.width > signW - 80) name.scale.set((signW - 80) / name.width);
    this.ground.addChild(name);
  }

  /** Called each frame; cheap. */
  update(): void {
    for (let d = 0; d < this.districtZones.length; d++) this.districtZones[d]!.visible = this.wh.shelves[d]!.built;
  }
}
