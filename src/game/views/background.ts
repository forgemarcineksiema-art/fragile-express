// Static scenery: building shell, floor, office carpet and the painted zone markings (the
// surroundings are in outdoor.ts).
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { t } from '../../core/i18n.ts';
import type { Rect } from '../../core/math.ts';
import { BACK_WALL, WALL, type Layout, type LocationJson } from '../../sim/layout.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import { drawGlass } from '../art.ts';
import type { Atlas } from '../atlas.ts';
import { DISTRICT_COLORS, INK, THEMES, WHITE, shade, type Theme } from '../palette.ts';
import { FONT } from '../text.ts';
import { Outdoor } from './outdoor.ts';
import { drawHatch } from './props.ts';

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
  /** Sunlight falling through the windows (strength follows the time of day). */
  readonly sunlight = new Graphics();
  /** Pools of light under the ceiling lamps (stronger at night). */
  readonly lampLight = new Graphics();
  /** x of the steel columns on the back wall (their lamps glow at night). */
  columnXs: number[] = [];
  /** y of the lamps on those columns. */
  readonly columnLampY = BACK_WALL - WALL_H + 11.5;
  /** Multiply layer darkening the outdoor ground at dusk and night. */
  readonly nightShade = new Graphics();
  /** Additive light pools on the outdoor ground (lamps, headlights). */
  readonly groundLights = new Container();
  /** Glass of the back-wall windows, tinted with the sky colour. */
  readonly windowGlass = new Graphics();
  /** The building shell (dimmed a little at night). */
  walls: Graphics | null = null;
  /** Street, lots and yard around the building. */
  readonly outdoor: Outdoor;

  constructor(
    private readonly wh: Warehouse,
    private readonly atlas: Atlas,
  ) {
    this.theme = THEMES[wh.loc.theme] ?? THEMES.post!;
    const L = wh.layout;
    this.outdoor = new Outdoor(L, this.theme);
    this.ground.addChild(this.outdoor.ground);
    // Night falls on the surroundings only: a multiply layer over the outdoor ground (the building's
    // floor is drawn over it), then additive pools of lamp and headlight light.
    const st = this.outdoor.st;
    this.nightShade.rect(st.x0, st.y0, st.x1 - st.x0, st.y1 - st.y0).fill(WHITE);
    this.nightShade.blendMode = 'multiply';
    this.nightShade.visible = false;
    this.ground.addChild(this.nightShade, this.groundLights);
    this.drawFloor(L);
    this.drawOffice(L);
    this.drawZones(L);
    this.drawWalls(L, wh.loc);
    // Mostly static: its own render group keeps it from being rebatched every frame.
    this.ground.isRenderGroup = true;
  }

  private drawFloor(L: Layout): void {
    const th = this.theme;
    const g = new Graphics();
    const x0 = WALL;
    const y0 = BACK_WALL;
    const x1 = L.w - WALL;
    const y1 = L.h - WALL;
    let seed = 11;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // Poured concrete in large slabs, each a touch lighter or darker than its neighbours
    g.rect(x0, y0, x1 - x0, y1 - y0).fill(th.floor);
    const slab = 176;
    for (let y = y0; y < y1; y += slab) {
      for (let x = x0; x < x1; x += slab) {
        const v = rnd();
        g.rect(x, y, Math.min(slab, x1 - x), Math.min(slab, y1 - y)).fill({ color: v < 0.5 ? 0x000000 : 0xffffff, alpha: 0.015 + Math.abs(v - 0.5) * 0.05 });
      }
    }
    // Trowel swirls, stains and scuffs
    for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 4200; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + 16 + rnd() * (y1 - y0 - 20);
      g.ellipse(x, y, 3 + rnd() * 14, 1.5 + rnd() * 5).fill({ color: 0x000000, alpha: 0.018 + rnd() * 0.02 });
    }
    for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 60000; i++) {
      const x = x0 + 30 + rnd() * (x1 - x0 - 60);
      const y = y0 + 40 + rnd() * (y1 - y0 - 80);
      g.ellipse(x, y, 16 + rnd() * 26, 8 + rnd() * 12).fill({ color: 0x3b2f22, alpha: 0.025 });
    }
    // Forklift tyre marks: pairs of faint curved streaks
    for (let k = 0; k < Math.round((x1 - x0) / 160); k++) {
      const sx = x0 + 40 + rnd() * (x1 - x0 - 80);
      const sy = y0 + 60 + rnd() * (y1 - y0 - 120);
      const dx = (rnd() - 0.5) * 260;
      const dy = (rnd() - 0.5) * 160;
      const bend = (rnd() - 0.5) * 140;
      for (const off of [0, 13]) {
        g.moveTo(sx, sy + off).quadraticCurveTo(sx + dx / 2 + bend, sy + dy / 2 + off - bend * 0.4, sx + dx, sy + dy + off).stroke({ width: 4, color: 0x000000, alpha: 0.035, cap: 'round' });
      }
    }
    // Saw-cut joints between the slabs
    for (let x = x0 + slab; x < x1; x += slab) {
      g.rect(x - 0.8, y0, 1.6, y1 - y0).fill({ color: th.grout, alpha: 0.85 });
      g.rect(x + 0.8, y0, 1, y1 - y0).fill({ color: 0xffffff, alpha: 0.18 });
    }
    for (let y = y0 + slab; y < y1; y += slab) {
      g.rect(x0, y - 0.8, x1 - x0, 1.6).fill({ color: th.grout, alpha: 0.85 });
      g.rect(x0, y + 0.8, x1 - x0, 1).fill({ color: 0xffffff, alpha: 0.18 });
    }
    // Soft shadow along the back wall
    g.rect(x0, y0, x1 - x0, 22).fill({ color: 0x000000, alpha: 0.07 });
    g.rect(x0, y0, x1 - x0, 8).fill({ color: 0x000000, alpha: 0.06 });
    // Hazard-painted areas (forklift parking, storage corners).
    for (const [px, py, pw, ph] of this.wh.loc.paint ?? []) drawHatch(g, px, py, pw, ph);
    this.ground.addChild(g);
    // Sunlight through the windows and the pools under the ceiling lamps change with the time of day.
    const sun = this.sunlight;
    for (const x of windowXs(L)) {
      sun.poly([x + 4, BACK_WALL, x + 88, BACK_WALL, x + 150, BACK_WALL + 150, x + 66, BACK_WALL + 150]).fill({ color: 0xfffbeb, alpha: 0.16 });
    }
    const lamps = this.lampLight;
    for (let y = BACK_WALL + 150; y < L.h - 60; y += 260) {
      for (let x = WALL + 150; x < L.w - 60; x += 280) {
        for (let r = 5; r >= 1; r--) lamps.ellipse(x, y, 34 * r, 22 * r).fill({ color: 0xfff7e0, alpha: 0.022 });
      }
    }
    this.ground.addChild(sun, lamps);
  }

  private drawOffice(L: Layout): void {
    const th = this.theme;
    const g = new Graphics();
    const o = L.office;
    const carpet = shade(th.office, 0.84);
    g.roundRect(o.x + 4, o.y + 6, o.w, o.h, 14).fill({ color: 0x000000, alpha: 0.1 });
    g.roundRect(o.x, o.y, o.w, o.h, 14).fill(carpet);
    // Carpet tiles laid in alternating directions
    const t = 36;
    for (let y = o.y + 8, j = 0; y < o.y + o.h - 8; y += t, j++) {
      for (let x = o.x + 8, i = 0; x < o.x + o.w - 8; x += t, i++) {
        const w = Math.min(t, o.x + o.w - 8 - x);
        const h = Math.min(t, o.y + o.h - 8 - y);
        g.rect(x, y, w, h).fill({ color: (i + j) % 2 ? 0xffffff : 0x000000, alpha: 0.018 });
        const across = (i + j) % 2 === 0;
        for (let k = 5; k < (across ? h : w); k += 6) {
          if (across) g.rect(x + 2, y + k, w - 4, 0.8).fill({ color: 0x000000, alpha: 0.03 });
          else g.rect(x + k, y + 2, 0.8, h - 4).fill({ color: 0x000000, alpha: 0.03 });
        }
      }
    }
    // Skirting strip around the carpet
    g.roundRect(o.x, o.y, o.w, o.h, 14).stroke({ width: 5, color: th.officeEdge });
    g.roundRect(o.x + 2.5, o.y + 2.5, o.w - 5, o.h - 5, 12).stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
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
    // Insulated wall panels, a girt near the top and a concrete plinth at the floor
    for (let x = 0; x < L.w; x += 42) g.rect(x, top + 2, 1.4, WALL_H - 14).fill({ color: 0x000000, alpha: 0.07 });
    g.rect(-6, top, L.w + 12, 5).fill({ color: 0x000000, alpha: 0.1 });
    g.rect(-6, top + 64, L.w + 12, 2).fill({ color: 0x000000, alpha: 0.08 });
    g.rect(-6, BACK_WALL - 20, L.w + 12, 10).fill(shade(th.wallTrim, 1.25));
    g.rect(-6, BACK_WALL - 20, L.w + 12, 2).fill({ color: WHITE, alpha: 0.25 });
    for (const x of windowXs(L)) {
      g.roundRect(x - 3, top + 13, 98, 50, 6).fill(shade(th.wallFace, 0.8));
      g.roundRect(x, top + 16, 92, 44, 5).fill(0xbfe3f5);
      g.rect(x + 44, top + 16, 4, 44).fill(0xe5e7eb);
      g.rect(x, top + 37, 92, 2.5).fill(0xe5e7eb);
      g.poly([x + 8, top + 52, x + 30, top + 22, x + 40, top + 22, x + 18, top + 52]).fill({ color: WHITE, alpha: 0.4 });
      g.roundRect(x, top + 16, 92, 44, 5).stroke({ width: 3, color: 0xe5e7eb });
    }
    // Steel columns between the windows, each with a lamp at the top
    this.columnXs = [];
    const signL = L.w / 2 - 160;
    const signR = L.w / 2 + 160;
    for (let x = 290; x < L.w - 60; x += 210) if (x + 10 < signL || x - 10 > signR) this.columnXs.push(x);
    this.columnXs.push(14, L.w - 14);
    for (const cx of this.columnXs) {
      g.rect(cx - 8, top - 22, 16, WALL_H + 22).fill(0x4b5563);
      g.rect(cx - 8, top - 22, 3, WALL_H + 22).fill(0x6b7280);
      g.rect(cx + 5, top - 22, 3, WALL_H + 22).fill(0x374151);
      g.rect(cx - 11, BACK_WALL - 5, 22, 5).fill(0x374151);
      g.roundRect(cx - 12, top + 4, 24, 8, 2).fill(0x1f2937);
      g.roundRect(cx - 10, top + 10, 20, 3, 1.5).fill(0xfef3c7);
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
    // Column heads along the side and front walls, clear of the doors
    const cap = (x: number, y: number): void => {
      g.rect(x - 8, y - 8, 16, 16).fill(shade(th.wallTop, 0.82));
      g.rect(x - 8, y - 8, 16, 16).stroke({ width: 1, color: INK, alpha: 0.2 });
    };
    for (let y = BACK_WALL + 200; y < L.h - 80; y += 210) {
      if (!L.belts.some((b) => Math.abs(b.y - y) < 60)) cap(WALL / 2, y);
      if (!L.docks.some((d) => Math.abs(d.y - y) < 70)) cap(L.w - WALL / 2, y);
    }
    for (let x = 290; x < L.w - 60; x += 420) cap(x, L.h - WALL / 2);
    this.ground.addChild(g);
    this.walls = g;
    for (const x of windowXs(L)) {
      for (const [px, py] of [[x + 1.5, top + 17.5], [x + 48, top + 17.5], [x + 1.5, top + 39.5], [x + 48, top + 39.5]] as const) {
        this.windowGlass.rect(px, py, 42.5, 19).fill(WHITE);
      }
    }
    this.windowGlass.alpha = 0;

    const name = new Text({
      text: t(loc.name).toUpperCase(),
      style: { fontFamily: FONT, fontSize: 24, fontWeight: '900', fill: WHITE, letterSpacing: 1 },
    });
    name.anchor.set(0.5);
    name.position.set(L.w / 2 + 22, top + 37);
    if (name.width > signW - 80) name.scale.set((signW - 80) / name.width);
    this.ground.addChild(name);
    this.ground.addChild(this.windowGlass);
  }

  /** Called each frame; cheap. */
  update(): void {
    for (let d = 0; d < this.districtZones.length; d++) this.districtZones[d]!.visible = this.wh.shelves[d]!.built;
  }
}
