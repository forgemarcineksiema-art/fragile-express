// Everything outside the building: the street in front with passing cars, the loading yard's
// markings, parking lots with parked cars, street lamps and a little street furniture.
// Things nothing can drive past are drawn once into the ground layer; lamps, bollards and cars in
// the yard and on the street are Y-sorted entities so vans and traffic pass behind and in front.
import { Container, Graphics, GraphicsContext, Text } from 'pixi.js';
import type { Rect } from '../../core/math.ts';
import type { Layout } from '../../sim/layout.ts';
import {
  CAR,
  CAR_COLORS,
  drawBench,
  drawBin,
  drawBollard,
  drawCarEnd,
  drawCarSide,
  drawHydrant,
  drawLamp,
  drawParkingSign,
  drawPlanter,
} from '../art-outdoor.ts';
import { WHITE, shade, type Theme } from '../palette.ts';
import { FONT } from '../text.ts';

/** How far past the building the camera may look. */
export const WORLD_MARGIN = { left: 250, right: 400, top: 190, bottom: 230 };

/** North edge of the pavement strip behind the building. */
const BACK_WALK = -70;
/** Width of a space for a car parked north-south, height of one parked east-west. */
const SPACE = 60;
const ROW = 66;
const PAVE = 0xd6d3d1;
const PAVE_JOINT = 0xc2bdb8;
const CURB = 0xeeece9;

export interface Street {
  /** Drawn extent. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** The street in front of the building (y): near pavement, road edges, far pavement. */
  walk: number;
  road0: number;
  road1: number;
  lanes: { y: number; dir: 1 | -1 }[];
  back: Rect;
  yard: Rect;
  west: Rect[];
}

export function outdoorGeom(L: Layout): Street {
  const m = WORLD_MARGIN;
  const x1 = L.w + m.right + 200;
  const h = L.h;
  // Lots west of the building fill the gaps between the delivery truck lanes.
  const west: Rect[] = [];
  let from = 16;
  const lanes = L.belts.map((b) => b.y).sort((a, b) => a - b);
  for (const by of [...lanes, null]) {
    const to = by === null ? h - 14 : by - 108;
    if (to - from >= 120) west.push({ x: -240, y: from, w: 226, h: to - from });
    if (by !== null) from = by + 108;
  }
  return {
    x0: -m.left - 200,
    x1,
    y0: -m.top - 200,
    y1: h + m.bottom + 200,
    walk: h,
    road0: h + 46,
    road1: h + 206,
    lanes: [
      { y: h + 88, dir: -1 },
      { y: h + 164, dir: 1 },
    ],
    back: { x: -30, y: -200, w: L.w + 20, h: 200 + BACK_WALK },
    yard: { x: L.w - 10, y: -200, w: x1 - L.w + 10, h: h + 46 + 200 },
    west,
  };
}

type Kind = 'side' | 'nose' | 'tail' | 'lamp' | 'hydrant' | 'bollard' | 'bench' | 'bin' | 'sign' | 'planter';

interface Placed {
  kind: Kind;
  x: number;
  y: number;
  color?: number;
  /** Mirror horizontally (cars facing west, lamps reaching east). */
  flip?: boolean;
}

// Geometry is shared between every copy of the same car colour or lamp.
const contexts = new Map<string, GraphicsContext>();

function context(p: Placed): GraphicsContext {
  const key = `${p.kind}_${p.color ?? 0}`;
  let c = contexts.get(key);
  if (!c) {
    c = new GraphicsContext();
    const color = p.color ?? 0;
    switch (p.kind) {
      case 'side':
        drawCarSide(c, color);
        break;
      case 'nose':
      case 'tail':
        drawCarEnd(c, color, p.kind === 'nose');
        break;
      case 'lamp':
        drawLamp(c);
        break;
      case 'hydrant':
        drawHydrant(c);
        break;
      case 'bollard':
        drawBollard(c);
        break;
      case 'bench':
        drawBench(c);
        break;
      case 'bin':
        drawBin(c);
        break;
      case 'sign':
        drawParkingSign(c);
        break;
      case 'planter':
        drawPlanter(c, color);
        break;
    }
    contexts.set(key, c);
  }
  return c;
}

/** y the object sorts by: the south edge of its footprint. */
function sortY(p: Placed): number {
  if (p.kind === 'side') return p.y + CAR.wid / 2;
  if (p.kind === 'nose' || p.kind === 'tail') return p.y + CAR.len / 2;
  return p.y;
}

/** A placed object; `sorted` nodes get a zIndex for the Y-sorted entity layer. */
function node(p: Placed, sorted: boolean): Graphics {
  const g = new Graphics(context(p));
  g.position.set(p.x, p.y);
  if (p.flip) g.scale.x = -1;
  // Any non-zero zIndex makes Pixi sort the parent, so static ground objects keep 0 and rely on
  // the order they are added in.
  if (sorted) g.zIndex = sortY(p);
  return g;
}

interface TrafficCar {
  node: Graphics;
  x: number;
  lane: number;
  v: number;
  vmax: number;
}

export class Outdoor {
  /** Ground-level drawing plus the objects nothing moves past. */
  readonly ground = new Container();
  readonly st: Street;
  private readonly entityThings: Placed[] = [];
  private layer: Container | null = null;
  private readonly traffic: TrafficCar[] = [];
  private readonly spawnT = [0.6, 2.2];
  private seed: number;

  constructor(
    private readonly L: Layout,
    private readonly th: Theme,
  ) {
    this.st = outdoorGeom(L);
    this.seed = 1 + ((L.w * 31 + L.h * 7 + L.docks.length * 131) % 2147483646);
    const statics: Placed[] = [];
    this.drawGround(statics);
    statics.sort((a, b) => sortY(a) - sortY(b));
    for (const p of statics) this.ground.addChild(node(p, false));
  }

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private carColor(): number {
    return CAR_COLORS[Math.floor(this.rnd() * CAR_COLORS.length)]!;
  }

  /** Adds the yard and street objects and the traffic to the Y-sorted entity layer. */
  attach(layer: Container): void {
    this.layer = layer;
    for (const p of this.entityThings) layer.addChild(node(p, true));
    // Start with a few cars already on the road.
    for (let lane = 0; lane < this.st.lanes.length; lane++) {
      for (let k = 0; k < 3; k++) this.spawn(lane, this.st.x0 + 200 + Math.random() * (this.st.x1 - this.st.x0 - 400));
    }
  }

  private drawGround(statics: Placed[]): void {
    const { L, th, st } = this;
    const g = new Graphics();
    const W = st.x1 - st.x0;
    const asphalt = th.outside;
    const road = shade(th.outside, 0.8);
    const line = th.outsideLine;
    g.rect(st.x0, st.y0, W, st.y1 - st.y0).fill(th.grass);
    for (let y = st.y0; y < st.y1; y += 48) g.rect(st.x0, y, W, 24).fill({ color: WHITE, alpha: 0.05 });
    const paved: Rect[] = [];
    const pave = (x: number, y: number, w: number, h: number, color: number): void => {
      g.rect(x, y, w, h).fill(color);
      paved.push({ x, y, w, h });
    };

    // Delivery truck lanes west of the belts
    for (const b of L.belts) {
      pave(st.x0, b.y - 78, -st.x0 + 10, 156, asphalt);
      g.rect(st.x0, b.y - 62, -st.x0 - 24, 3).fill({ color: line, alpha: 0.7 });
      g.rect(st.x0, b.y + 62, -st.x0 - 24, 3).fill({ color: line, alpha: 0.7 });
    }

    // Staff car park behind the building: cars parked nose-in or reversed in.
    const bk = st.back;
    pave(bk.x, bk.y, bk.w, bk.h, asphalt);
    const spaceY0 = BACK_WALK - 104;
    for (let sx = 0; sx + SPACE <= L.w - 20; sx += SPACE) {
      this.spaceLines(g, sx, spaceY0, SPACE, 100, 'v');
      this.maybePark(statics, sx + SPACE / 2, spaceY0 + 52, 0.7);
    }
    // Pavement strip along the back wall
    g.rect(bk.x, BACK_WALK, bk.w, 26).fill(PAVE);
    for (let x = bk.x; x < bk.x + bk.w; x += 26) g.rect(x, BACK_WALK, 1.5, 26).fill(PAVE_JOINT);
    g.rect(bk.x, BACK_WALK - 3, bk.w, 4).fill(CURB);
    for (let x = 180; x < L.w - 80; x += 330) statics.push({ kind: 'lamp', x, y: BACK_WALK + 14, flip: (x / 330) % 2 > 1 });
    statics.push({ kind: 'sign', x: L.w - 30, y: BACK_WALK + 12 });

    // Pavement apron around the building
    g.rect(-14, BACK_WALK + 20, L.w + 4, L.h - BACK_WALK - 20).fill(PAVE);

    // Lots west of the building
    for (const r of st.west) {
      pave(r.x, r.y, r.w, r.h, asphalt);
      pave(r.x, r.y - 30, 100, r.h + 60, asphalt);
      for (let y = r.y + 6; y + ROW <= r.y + r.h - 4; y += ROW) {
        this.spaceLines(g, -136, y, 122, ROW, 'h');
        if (this.rnd() < 0.62) statics.push({ kind: 'side', x: -78, y: y + ROW / 2, color: this.carColor(), flip: this.rnd() < 0.35 });
      }
      statics.push({ kind: 'lamp', x: -150, y: r.y + r.h - 8, flip: true });
      statics.push({ kind: 'sign', x: -146, y: r.y + 24 });
    }

    // Loading yard east of the building
    const yd = st.yard;
    pave(yd.x, yd.y, yd.w, yd.h, asphalt);
    const docks = L.docks.map((d) => d.y);
    docks.forEach((d, i) => {
      g.rect(L.w + 6, d - 51, 190, 3).fill({ color: WHITE, alpha: 0.85 });
      g.rect(L.w + 6, d + 48, 190, 3).fill({ color: WHITE, alpha: 0.85 });
      for (let x = L.w + 206; x < L.w + 400; x += 26) {
        g.rect(x, d - 51, 13, 3).fill({ color: WHITE, alpha: 0.6 });
        g.rect(x, d + 48, 13, 3).fill({ color: WHITE, alpha: 0.6 });
      }
      g.rect(L.w + 190, d - 48, 5, 96).fill({ color: 0xfacc15, alpha: 0.85 });
      const num = new Text({ text: String(i + 1), style: { fontFamily: FONT, fontSize: 46, fontWeight: '900', fill: WHITE } });
      num.anchor.set(0.5);
      num.alpha = 0.45;
      num.position.set(L.w + 130, d);
      this.ground.addChild(num);
      // Bollards guarding the dock door
      this.entityThings.push({ kind: 'bollard', x: L.w + 10, y: d - 56 }, { kind: 'bollard', x: L.w + 10, y: d + 58 });
      const next = docks[i + 1];
      if (next !== undefined) this.entityThings.push({ kind: 'lamp', x: L.w + 226, y: (d + next) / 2 + 6 });
    });
    // Rows of parked cars at the north and south ends of the yard
    const rows: number[] = [];
    if (docks.length) {
      rows.push(docks[0]! - 164);
      if (docks[docks.length - 1]! + 170 <= L.h + 30) rows.push(docks[docks.length - 1]! + 66);
    }
    for (const ry of rows) {
      for (let k = 0; k < 6; k++) {
        const sx = L.w + 24 + k * SPACE;
        this.spaceLines(g, sx, ry, SPACE, 98, 'v');
        this.maybePark(this.entityThings, sx + SPACE / 2, ry + 50, 0.6);
      }
      this.entityThings.push({ kind: 'lamp', x: L.w + 20, y: ry < docks[0]! ? ry + 2 : ry + 96, flip: true });
    }
    // Give-way teeth where the yard meets the street
    for (let x = L.w + 14; x < L.w + 396; x += 18) g.poly([x, st.road0 - 16, x + 12, st.road0 - 16, x + 6, st.road0 - 6]).fill({ color: WHITE, alpha: 0.8 });
    this.entityThings.push({ kind: 'bollard', x: L.w + 2, y: L.h + 14 }, { kind: 'lamp', x: L.w + 24, y: L.h + 30, flip: true });

    // The street in front of the building
    const walkW = L.w - 10 - st.x0;
    pave(st.x0, st.walk, walkW, st.road0 - st.walk, PAVE);
    for (let x = st.x0; x < L.w - 10; x += 26) g.rect(x, st.walk, 1.5, st.road0 - st.walk).fill(PAVE_JOINT);
    g.rect(st.x0, st.walk + 22, walkW, 1.5).fill(PAVE_JOINT);
    pave(st.x0, st.road0, W, st.road1 - st.road0, road);
    g.rect(st.x0, st.road0 - 5, walkW, 5).fill(CURB);
    g.rect(st.x0, st.road0, walkW, 3).fill({ color: 0x000000, alpha: 0.18 });
    const mid = (st.road0 + st.road1) / 2;
    const zebra = Math.round(L.w * 0.42);
    g.rect(st.x0, st.road0 + 9, walkW, 2.5).fill({ color: WHITE, alpha: 0.7 });
    g.rect(st.x0, st.road1 - 11, W, 2.5).fill({ color: WHITE, alpha: 0.7 });
    for (let x = st.x0; x < st.x1; x += 64) {
      if (Math.abs(x + 17 - zebra) < 60) continue;
      g.rect(x, mid - 2, 34, 4).fill({ color: line, alpha: 0.9 });
    }
    for (let y = st.road0 + 12; y < st.road1 - 14; y += 18) g.rect(zebra - 28, y, 56, 10).fill({ color: WHITE, alpha: 0.85 });
    for (const [mx, my] of [
      [L.w * 0.18, mid + 38],
      [L.w * 0.72, mid - 36],
    ] as const) {
      g.circle(mx, my, 10).fill(shade(road, 0.75));
      g.circle(mx, my, 10).stroke({ width: 1.5, color: shade(road, 1.25) });
      for (let k = -1; k <= 1; k++) g.rect(mx - 6, my + k * 4 - 0.6, 12, 1.2).fill({ color: shade(road, 1.3), alpha: 0.8 });
    }
    // Far kerb and pavement
    g.rect(st.x0, st.road1, W, 5).fill(CURB);
    pave(st.x0, st.road1 + 5, W, 26, PAVE);
    for (let x = st.x0; x < st.x1; x += 26) g.rect(x, st.road1 + 5, 1.5, 26).fill(PAVE_JOINT);
    for (let x = 90; x < L.w + 380; x += 300) this.entityThings.push({ kind: 'lamp', x, y: st.road1 + 22, flip: true });
    this.entityThings.push({ kind: 'hydrant', x: Math.round(L.w * 0.6), y: st.road1 + 22 });
    // Benches, bins and planters on the near pavement
    for (const f of [0.22, 0.68]) {
      const bx = Math.round(L.w * f);
      statics.push({ kind: 'bench', x: bx, y: st.walk + 36 });
      statics.push({ kind: 'bin', x: bx + 46, y: st.walk + 38 });
      statics.push({ kind: 'planter', x: bx - 60, y: st.walk + 38, color: shade(th.grass, 0.9) });
    }

    // Trees on whatever grass is left, and a row of street trees across the road
    const tree = (x: number, y: number, r: number): void => {
      g.ellipse(x + 4, y + r * 0.7, r * 0.9, r * 0.35).fill({ color: 0x000000, alpha: 0.18 });
      g.circle(x, y, r).fill(shade(th.grass, 0.72));
      g.circle(x - r * 0.3, y - r * 0.3, r * 0.55).fill(shade(th.grass, 0.85));
    };
    const building = { x: -14, y: BACK_WALK, w: L.w + 4, h: L.h - BACK_WALK };
    const blocked = (x: number, y: number, r: number): boolean =>
      [...paved, building].some((p) => x > p.x - r && x < p.x + p.w + r && y > p.y - r && y < p.y + p.h + r);
    for (let i = 0; i < 140; i++) {
      const x = st.x0 + this.rnd() * W;
      const y = st.y0 + this.rnd() * (st.y1 - st.y0);
      const r = 16 + this.rnd() * 16;
      if (blocked(x, y, r * 0.6)) continue;
      tree(x, y, r);
    }
    for (let x = st.x0 + 60; x < st.x1; x += 150) tree(x + this.rnd() * 30, st.road1 + 58, 22 + this.rnd() * 6);
    this.ground.addChildAt(g, 0);
  }

  /** Painted bay separators: 'v' spaces are entered from the north or south, 'h' from the west. */
  private spaceLines(g: Graphics, x: number, y: number, w: number, h: number, dir: 'v' | 'h'): void {
    const c = { color: WHITE, alpha: 0.8 };
    if (dir === 'v') {
      g.rect(x - 1.5, y, 3, h).fill(c);
      g.rect(x + w - 1.5, y, 3, h).fill(c);
      g.roundRect(x + w / 2 - 11, y + h - 12, 22, 5, 2).fill({ color: 0xa8a29e, alpha: 0.9 });
    } else {
      g.rect(x, y - 1.5, w, 3).fill(c);
      g.rect(x, y + h - 1.5, w, 3).fill(c);
      g.roundRect(x + w - 14, y + h / 2 - 11, 5, 22, 2).fill({ color: 0xa8a29e, alpha: 0.9 });
    }
  }

  private maybePark(into: Placed[], x: number, y: number, chance: number): void {
    if (this.rnd() >= chance) return;
    into.push({ kind: this.rnd() < 0.6 ? 'nose' : 'tail', x: x + (this.rnd() - 0.5) * 4, y: y + (this.rnd() - 0.5) * 6, color: this.carColor() });
  }

  private spawn(lane: number, at: number | null): void {
    const l = this.st.lanes[lane]!;
    if (!this.layer) return;
    const x = at ?? (l.dir > 0 ? this.st.x0 + 110 : this.st.x1 - 110);
    if (this.traffic.some((c) => c.lane === lane && Math.abs(c.x - x) < CAR.len + 70)) return;
    const n = node({ kind: 'side', x, y: l.y, color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]!, flip: l.dir < 0 }, true);
    this.layer.addChild(n);
    const vmax = 150 + Math.random() * 90;
    this.traffic.push({ node: n, x, lane, v: vmax, vmax });
  }

  /** Moves the traffic: cars keep their distance and brake behind slower ones. */
  update(dt: number): void {
    if (!this.layer || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const st = this.st;
    for (let i = 0; i < this.spawnT.length; i++) {
      this.spawnT[i]! -= dt;
      if (this.spawnT[i]! <= 0) {
        this.spawn(i, null);
        this.spawnT[i] = 2.5 + Math.random() * 6;
      }
    }
    for (const c of this.traffic) {
      const lane = st.lanes[c.lane]!;
      let gap = Infinity;
      let lead = 0;
      for (const o of this.traffic) {
        if (o === c || o.lane !== c.lane) continue;
        const d = (o.x - c.x) * lane.dir;
        if (d > 0 && d < gap) {
          gap = d;
          lead = o.v;
        }
      }
      gap -= CAR.len;
      const want = gap < 170 ? Math.max(0, Math.min(c.vmax, lead + (gap - 34) * 1.8)) : c.vmax;
      c.v += Math.max(-420 * dt, Math.min(140 * dt, want - c.v));
      c.x += lane.dir * c.v * dt;
      c.node.x = c.x;
    }
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const c = this.traffic[i]!;
      const dir = st.lanes[c.lane]!.dir;
      if ((dir > 0 && c.x > st.x1 - 90) || (dir < 0 && c.x < st.x0 + 90)) {
        c.node.destroy();
        this.traffic.splice(i, 1);
      }
    }
  }
}
