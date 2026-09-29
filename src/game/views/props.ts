// Decorative props (drawn in code): forklifts, wrapped pallets, storage racks, a break area and the
// like. Footprints live in sim/layout.ts (solid props block the player and workers' paths).
import { Container, Graphics } from 'pixi.js';
import { PROP_SIZE, type PropJson } from '../../sim/layout.ts';
import { drawGlass } from '../art.ts';
import { DISTRICT_COLORS, INK, WHITE, shade } from '../palette.ts';

type Draw = (g: Graphics, x: number, y: number, w: number, d: number, flip: number) => void;

const OUTLINE = { width: 1.4, color: INK, alpha: 0.3 };

/** Oblique box: footprint centre (x, y), size w × d, height h; returns top-face y. */
function box(g: Graphics, x: number, y: number, w: number, d: number, h: number, top: number, front: number): number {
  const l = x - w / 2;
  const t = y - d / 2 - h;
  g.rect(l, t, w, d).fill(top);
  g.rect(l, y + d / 2 - h, w, h).fill(front);
  g.rect(l, t, w, d + h).stroke(OUTLINE);
  return t;
}

function shadow(g: Graphics, x: number, y: number, w: number, d: number): void {
  g.roundRect(x - w / 2 + 3, y - d / 2 + 5, w, d, 6).fill({ color: 0x000000, alpha: 0.16 });
}

function pallet(g: Graphics, x: number, y: number, w: number, d: number): void {
  const l = x - w / 2;
  g.rect(l, y - d / 2 - 7, w, d).fill(0xc08a4e);
  for (let k = 0; k < 4; k++) g.rect(l, y - d / 2 - 5 + k * (d / 4), w, d / 8).fill(0xd9a066);
  g.rect(l, y + d / 2 - 7, w, 7).fill(0x8b5a2b);
  for (const bx of [l + 2, x - 4, l + w - 10]) g.rect(bx, y + d / 2 - 6, 8, 5).fill(0x5b3a1b);
}

const forklift: Draw = (g, x, y, w, d, flip) => {
  shadow(g, x, y, w, d);
  const f = flip;
  // Forks sticking out in front
  g.rect(x + f * (w / 2 - 4) - (f < 0 ? 26 : 0), y - 10, 26, 4).fill(0x6b7280);
  g.rect(x + f * (w / 2 - 4) - (f < 0 ? 26 : 0), y + 6, 26, 4).fill(0x6b7280);
  // Mast
  g.rect(x + f * (w / 2 - 10) - 3, y - d / 2 - 58, 6, 60).fill(0x374151);
  g.rect(x + f * (w / 2 - 10) - 3, y + d / 2 - 64, 6, 60).fill(0x4b5563);
  // Body and counterweight
  box(g, x - f * 4, y, w - 16, d, 22, 0xfacc15, 0xeab308);
  g.rect(x - f * (w / 2 - 6) - 7, y - d / 2 - 26, 14, d).fill(0xca8a04);
  // Overhead guard and seat
  g.rect(x - 16, y - d / 2 - 50, 32, 4).fill(0x1f2937);
  for (const px of [x - 16, x + 13]) g.rect(px, y - d / 2 - 50, 3, 30).fill(0x1f2937);
  g.roundRect(x - 8, y - d / 2 - 32, 16, 10, 3).fill(0x1f2937);
  // Wheels
  for (const wx of [x - w / 2 + 16, x + w / 2 - 18]) {
    g.circle(wx, y + d / 2 - 2, 8).fill(0x111827);
    g.circle(wx, y + d / 2 - 2, 3).fill(0x9ca3af);
  }
};

const palletWrap: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  pallet(g, x, y, w, d);
  const cols = [0xc08a4e, 0xd9a066, 0xb07a40];
  for (let layer = 0; layer < 3; layer++) {
    const t = box(g, x, y - 7, w - 4, d - 6, 16, shade(cols[layer % 3]!, 1.15), cols[layer % 3]!);
    g.rect(x - 1.5, t, 3, d - 6).fill({ color: WHITE, alpha: 0.35 });
    y -= 16;
  }
  // Stretch wrap sheen
  const top = y - 7 - (d - 6) / 2;
  g.rect(x - w / 2 + 2, top, w - 4, d - 6 + 48).fill({ color: WHITE, alpha: 0.16 });
  g.poly([x - w / 2 + 6, top + d + 30, x - w / 2 + 14, top + 4, x - w / 2 + 20, top + 4, x - w / 2 + 12, top + d + 30]).fill({ color: WHITE, alpha: 0.35 });
};

const palletStack: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  for (let k = 0; k < 5; k++) pallet(g, x, y - k * 8, w, d);
};

const rackTall: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  const l = x - w / 2;
  const h = 70;
  // Uprights and shelves (tall rack against the wall, boxes on three levels)
  g.rect(l, y - d / 2 - h, w, d).fill(0x94a3b8);
  for (let lv = 0; lv < 3; lv++) {
    const sy = y + d / 2 - 8 - lv * 24;
    g.rect(l, sy, w, 4).fill(0xf97316);
    for (let i = 0; i < 5; i++) {
      if ((i + lv) % 4 === 3) continue;
      const bx = l + 6 + i * ((w - 12) / 5);
      const c = lv === 1 && i === 1 ? DISTRICT_COLORS[1]! : 0xc08a4e;
      g.rect(bx, sy - 16, (w - 12) / 5 - 4, 16).fill(c);
      g.rect(bx, sy - 16, (w - 12) / 5 - 4, 3).fill({ color: WHITE, alpha: 0.25 });
    }
  }
  for (const px of [l, x - 2, l + w - 4]) g.rect(px, y - d / 2 - h, 4, h + d).fill(0x1d4ed8);
};

const vending: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  const t = box(g, x, y, w, d, 58, 0xdc2626, 0xb91c1c);
  const fy = y + d / 2 - 58;
  g.rect(x - w / 2 + 5, fy + 6, w - 18, 38).fill(0x1e293b);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.rect(x - w / 2 + 8 + c * 8, fy + 9 + r * 9, 6, 6).fill(DISTRICT_COLORS[(r + c) % 6]!);
  g.rect(x + w / 2 - 11, fy + 10, 7, 16).fill(0x9ca3af);
  g.rect(x - w / 2 + 6, fy + 47, w - 20, 6).fill(0x111827);
  void t;
};

const waterCooler: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  box(g, x, y, w, d, 26, 0xf1f5f9, 0xe2e8f0);
  g.roundRect(x - 8, y - d / 2 - 50, 16, 24, 6).fill({ color: 0x60a5fa, alpha: 0.85 });
  g.rect(x - 5, y - d / 2 - 46, 3, 16).fill({ color: WHITE, alpha: 0.5 });
  g.rect(x - 3, y + d / 2 - 18, 6, 4).fill(0x3b82f6);
};

const bench: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  for (const lx of [x - w / 2 + 6, x + w / 2 - 10]) g.rect(lx, y - 2, 4, 12).fill(0x374151);
  box(g, x, y - 8, w, d - 6, 5, 0xd9a066, 0xa16207);
  g.rect(x - w / 2, y - d / 2 - 20, w, 8).fill(0xc08a4e);
};

const lockers: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  box(g, x, y, w, d, 62, 0x64748b, 0x475569);
  const n = Math.round(w / 22);
  const cw = w / n;
  for (let i = 0; i < n; i++) {
    const lx = x - w / 2 + i * cw;
    g.rect(lx + 2, y + d / 2 - 58, cw - 4, 54).fill(i % 2 ? 0x2563eb : 0x3b82f6);
    for (let k = 0; k < 3; k++) g.rect(lx + 5, y + d / 2 - 52 + k * 3, cw - 10, 1.2).fill({ color: WHITE, alpha: 0.35 });
    g.rect(lx + cw - 7, y + d / 2 - 30, 2, 8).fill(0xe2e8f0);
  }
};

const bins: Draw = (g, x, y, w, d) => {
  const cols = [0x22c55e, 0x3b82f6, 0xfacc15];
  const bw = w / 3;
  for (let i = 0; i < 3; i++) {
    const bx = x - w / 2 + bw * i + bw / 2;
    shadow(g, bx, y, bw - 4, d);
    box(g, bx, y, bw - 4, d, 28, shade(cols[i]!, 0.85), cols[i]!);
    g.rect(bx - (bw - 4) / 2, y - d / 2 - 30, bw - 4, 4).fill(shade(cols[i]!, 0.7));
    g.circle(bx, y + d / 2 - 14, 4).stroke({ width: 1.6, color: WHITE, alpha: 0.8 });
  }
};

const cones: Draw = (g, x, y, w) => {
  for (let i = 0; i < 3; i++) {
    const cx = x - w / 2 + 10 + i * ((w - 20) / 2);
    g.ellipse(cx + 2, y + 4, 9, 4).fill({ color: 0x000000, alpha: 0.16 });
    g.rect(cx - 9, y - 1, 18, 4).fill(0xea580c);
    g.poly([cx - 7, y, cx + 7, y, cx + 2, y - 26, cx - 2, y - 26]).fill(0xf97316);
    g.rect(cx - 5, y - 14, 10, 4).fill(WHITE);
  }
};

const plant: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  box(g, x, y, w - 6, d - 8, 16, 0x92400e, 0xb45309);
  const top = y - d / 2 - 12;
  for (const [ox, oy, r, c] of [
    [0, -18, 13, 0x15803d],
    [-9, -8, 10, 0x16a34a],
    [9, -9, 10, 0x22c55e],
    [0, -30, 9, 0x22c55e],
  ] as const) {
    g.circle(x + ox, top + oy, r).fill(c);
  }
  g.circle(x - 4, top - 24, 4).fill({ color: WHITE, alpha: 0.18 });
};

const trolley: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  g.rect(x - w / 2, y + d / 2 - 6, w, 4).fill(0x475569);
  g.rect(x + w / 2 - 5, y - d / 2 - 44, 4, 50).fill(0x334155);
  g.circle(x - w / 2 + 6, y + d / 2 - 1, 5).fill(0x111827);
  g.circle(x + w / 2 - 4, y + d / 2 - 1, 5).fill(0x111827);
  let by = y;
  for (const c of [0xc08a4e, DISTRICT_COLORS[0]!, 0xd9a066]) {
    box(g, x - 3, by - 2, w - 10, d - 8, 14, shade(c, 1.15), c);
    by -= 14;
  }
};

const scale: Draw = (g, x, y, w, d) => {
  shadow(g, x, y, w, d);
  box(g, x, y, w, d, 30, 0xe5e7eb, 0x9ca3af);
  g.rect(x - w / 2 + 6, y - d / 2 - 28, w - 12, d - 8).fill(0x6b7280);
  box(g, x - 4, y - 32, 26, 14, 14, 0xd9a066, 0xc08a4e);
  g.roundRect(x + w / 2 - 20, y + d / 2 - 24, 14, 8, 2).fill(0x111827);
  g.rect(x + w / 2 - 18, y + d / 2 - 22, 10, 4).fill(0x22c55e);
  g.circle(x - w / 2 + 12, y + d / 2 - 14, 5).fill(WHITE);
  drawGlass(g, x - w / 2 + 12, y + d / 2 - 14, 7, 0xdc2626);
};

const DRAW: Record<PropJson['type'], Draw> = {
  forklift,
  pallet_wrap: palletWrap,
  pallet_stack: palletStack,
  rack_tall: rackTall,
  vending,
  water_cooler: waterCooler,
  bench,
  lockers,
  bins,
  cones,
  plant,
  trolley,
  scale,
};

/** One entity per prop, Y-sorted with everything else. */
export function propNodes(props: readonly PropJson[]): Container[] {
  return props.map((p) => {
    const c = new Container();
    const g = new Graphics();
    const [w, d] = PROP_SIZE[p.type];
    DRAW[p.type](g, p.at[0], p.at[1], w, d, p.flip ? -1 : 1);
    c.addChild(g);
    c.zIndex = p.at[1] + d / 2;
    return c;
  });
}

/** Painted floor area: yellow frame with dark diagonal hatching. */
export function drawHatch(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h).fill({ color: 0xfacc15, alpha: 0.2 });
  for (let k = -h; k < w; k += 20) {
    let x0 = x + k;
    let y0 = y + h;
    let x1 = x + k + h;
    let y1 = y;
    if (x0 < x) {
      y0 -= x - x0;
      x0 = x;
    }
    if (x1 > x + w) {
      y1 += x1 - (x + w);
      x1 = x + w;
    }
    if (x1 <= x0) continue;
    g.moveTo(x0, y0).lineTo(x1, y1);
  }
  g.stroke({ width: 6, color: 0x1f2937, alpha: 0.13 });
  g.rect(x, y, w, h).stroke({ width: 4, color: 0xeab308, alpha: 0.9 });
}
