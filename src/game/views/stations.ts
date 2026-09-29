// Entity views for the belt, shelves and the cash desk.
import { Container, Graphics, Text, TilingSprite, type Renderer, type Texture } from 'pixi.js';
import type { Belt, Shelf } from '../../sim/stations.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import { drawSymbol, PARCEL } from '../art.ts';
import { COIN, DISTRICT_COLORS, DISTRICT_SYMBOLS, INK, WHITE, shade } from '../palette.ts';
import { label, setText } from '../text.ts';

export const BELT_H = 14;
export const RACK_H = 12;
export const RACK_COLS = 2;
export const RACK_ROWS = 8;

export function beltTexture(renderer: Renderer): Texture {
  const g = new Graphics();
  g.rect(0, 0, 24, 34).fill(0x334155);
  g.rect(0, 0, 4, 34).fill(0x475569);
  g.rect(12, 0, 1.5, 34).fill({ color: 0x1e293b, alpha: 0.8 });
  const tex = renderer.generateTexture({ target: g, resolution: 2 });
  g.destroy();
  return tex;
}

export class BeltView {
  readonly node = new Container();
  private readonly surface: TilingSprite;

  constructor(
    private readonly belt: Belt,
    tex: Texture,
  ) {
    const { x0, y, length } = belt.geom;
    const g = new Graphics();
    const top = y - 22 - BELT_H;
    // Legs
    for (let x = x0 + 30; x < x0 + length; x += 90) g.rect(x, y + 22 - BELT_H, 6, BELT_H + 6).fill(0x475569);
    // Frame: top face + front face
    g.rect(x0, top, length, 44).fill(0x64748b);
    g.rect(x0, y + 22 - BELT_H, length, BELT_H).fill(0x475569);
    g.rect(x0, y + 22 - BELT_H, length, 3).fill({ color: WHITE, alpha: 0.18 });
    // End roller
    g.roundRect(x0 + length - 8, top - 2, 12, 48, 6).fill(0x94a3b8);
    g.rect(x0, top, length, 44).stroke({ width: 1.5, color: INK, alpha: 0.35 });
    this.node.addChild(g);
    this.surface = new TilingSprite({ texture: tex, width: length - 10, height: 34 });
    this.surface.position.set(x0, top + 5);
    this.node.addChild(this.surface);
    // Rails over the surface edges
    const rails = new Graphics();
    rails.rect(x0, top, length - 4, 5).fill(0x94a3b8);
    rails.rect(x0, top + 39, length - 4, 5).fill(0x94a3b8);
    this.node.addChild(rails);
    this.node.zIndex = y + 22;
  }

  update(dt: number): void {
    const b = this.belt;
    // The surface only moves while the front of the queue can still advance.
    const moving = b.items.length === 0 || b.items[0]!.s < b.endS - 0.5 || b.items.length < 2;
    if (moving) this.surface.tilePosition.x += b.speed * dt;
  }
}

export class ShelfView {
  readonly node = new Container();
  private readonly count: Text;
  private appear = 1;

  constructor(private readonly shelf: Shelf) {
    const { body, cx } = shelf.geom;
    const color = DISTRICT_COLORS[shelf.district]!;
    const g = new Graphics();
    // Shadow
    g.rect(body.x + 4, body.y + 6, body.w, body.h).fill({ color: 0x000000, alpha: 0.15 });
    // Steel sorting rack: galvanised deck with slats, beams and uprights in the district colour
    const deck = 0xc3cad2;
    const steelDark = 0x6b7684;
    const top = body.y - RACK_H;
    g.rect(body.x, top, body.w, body.h).fill(deck);
    for (let y = top + 5; y < top + body.h - 3; y += 4.6) g.rect(body.x + 4, y, body.w - 8, 1).fill({ color: steelDark, alpha: 0.28 });
    g.rect(cx - 2, top, 4, body.h).fill(steelDark);
    g.rect(cx - 2, top, 1.2, body.h).fill({ color: WHITE, alpha: 0.35 });
    // Lane dividers between the rows of slots
    for (let y = top + 20; y < top + body.h - 6; y += 18.5) g.rect(body.x + 4, y, body.w - 8, 1.6).fill({ color: steelDark, alpha: 0.45 });
    // Side beams and uprights
    const beam = shade(color, 0.9);
    g.rect(body.x, top, 4, body.h).fill(beam);
    g.rect(body.x + body.w - 4, top, 4, body.h).fill(beam);
    for (const uy of [top, top + body.h / 2 - 3, top + body.h - 6]) {
      g.rect(body.x - 2, uy, 7, 7).fill(shade(color, 0.62));
      g.rect(body.x + body.w - 5, uy, 7, 7).fill(shade(color, 0.62));
    }
    // Front beam with a label holder
    g.rect(body.x, body.y + body.h - RACK_H, body.w, RACK_H).fill(color);
    g.rect(body.x, body.y + body.h - RACK_H, body.w, 2.5).fill({ color: WHITE, alpha: 0.3 });
    g.rect(body.x, body.y + body.h - 3, body.w, 3).fill({ color: 0x000000, alpha: 0.2 });
    g.roundRect(cx - 11, body.y + body.h - RACK_H + 2.5, 22, 7, 1.5).fill(WHITE);
    drawSymbol(g, cx, body.y + body.h - RACK_H + 6, 5, DISTRICT_SYMBOLS[shelf.district]!, color);
    g.rect(body.x - 2, top, body.w + 4, body.h).stroke({ width: 1.5, color: INK, alpha: 0.3 });
    // Sign on a post at the north end
    const sy = body.y - RACK_H - 48;
    g.rect(cx - 2, sy + 20, 4, 30).fill(0x475569);
    g.roundRect(cx - 20, sy - 6, 40, 30, 8).fill(color);
    g.roundRect(cx - 20, sy - 6, 40, 30, 8).stroke({ width: 3, color: WHITE });
    drawSymbol(g, cx, sy + 9, 15, DISTRICT_SYMBOLS[shelf.district]!, WHITE);
    this.node.addChild(g);
    this.count = label('', 13);
    this.count.position.set(cx, sy - 16);
    this.node.addChild(this.count);
    this.node.zIndex = body.y + body.h;
    this.node.visible = shelf.built;
  }

  /** World position of a parcel slot (footprint centre) and its height. */
  slot(i: number): { x: number; y: number; z: number } {
    const { body, cx } = this.shelf.geom;
    const perLayer = RACK_COLS * RACK_ROWS;
    const layer = Math.floor(i / perLayer);
    const k = i % perLayer;
    const row = Math.floor(k / RACK_COLS);
    const col = k % RACK_COLS;
    return {
      x: cx + (col === 0 ? -15 : 15),
      y: body.y + 6 + row * 18.5 - (layer > 0 ? 3 : 0),
      z: RACK_H + layer * (PARCEL.h + 1),
    };
  }

  get zBase(): number {
    return this.node.zIndex;
  }

  hideLabels(): void {
    this.count.visible = false;
  }

  get shelfItems(): readonly import('../../sim/types.ts').Parcel[] {
    return this.shelf.items;
  }

  update(dt: number): void {
    const s = this.shelf;
    if (s.built && !this.node.visible) {
      this.node.visible = true;
      this.appear = 0;
    }
    if (this.appear < 1) {
      this.appear = Math.min(1, this.appear + dt * 2.5);
      const k = this.appear;
      const sc = 1 + Math.sin(k * Math.PI) * 0.12;
      this.node.alpha = Math.min(1, k * 2);
      this.node.pivot.set(s.geom.cx, s.geom.body.y + s.geom.body.h);
      this.node.position.set(s.geom.cx, s.geom.body.y + s.geom.body.h);
      this.node.scale.set(sc, sc * (0.4 + 0.6 * Math.min(1, k * 1.6)));
    }
    const full = s.isFull();
    setText(this.count, `${s.items.length}/${s.capacity}`);
    this.count.style.fill = full ? 0xfca5a5 : 0xffffff;
    this.count.visible = s.built;
  }
}

/** Cash desk with a register whose drawer pops open when the collector pays in. */
export class DeskView {
  readonly node = new Container();
  private readonly drawer = new Graphics();
  private open = 0;

  constructor(wh: Warehouse) {
    const g = new Graphics();
    const b = wh.layout.safe.body;
    const h = 26;
    g.rect(b.x + 4, b.y + 6, b.w, b.h).fill({ color: 0x000000, alpha: 0.15 });
    // Laminate top with a darker edge, front panel with the brand stripe and a kick plate
    g.roundRect(b.x, b.y - h, b.w, b.h, 5).fill(0xe7e2d8);
    g.rect(b.x + 3, b.y - h + 3, b.w - 6, 1.2).fill({ color: WHITE, alpha: 0.6 });
    g.rect(b.x, b.y + b.h - h - 3, b.w, 3).fill(0xc9c1b2);
    g.rect(b.x, b.y + b.h - h, b.w, h).fill(0x3f4654);
    g.rect(b.x, b.y + b.h - h + 7, b.w, 5).fill(0xf97316);
    g.rect(b.x, b.y + b.h - 5, b.w, 5).fill(0x262b33);
    for (let x = b.x + 12; x < b.x + b.w - 6; x += 20) g.rect(x, b.y + b.h - h + 14, 1.2, h - 20).fill({ color: WHITE, alpha: 0.12 });
    // Papers, a stamp and a card terminal on the top
    g.rect(b.x + 4, b.y - h + 10, 14, 11).fill(WHITE);
    g.rect(b.x + 6, b.y - h + 13, 9, 1).fill(0x94a3b8);
    g.rect(b.x + 6, b.y - h + 16, 7, 1).fill(0x94a3b8);
    g.roundRect(b.x + b.w - 16, b.y - h + 9, 10, 14, 2).fill(0x1f2937);
    g.rect(b.x + b.w - 14, b.y - h + 11, 6, 4).fill(0x60a5fa);
    g.roundRect(b.x, b.y - h, b.w, b.h + h, 5).stroke({ width: 1.5, color: INK, alpha: 0.3 });
    // Register: body, display, keys
    const cx = b.x + b.w / 2;
    const top = b.y - h;
    this.drawer.roundRect(cx - 17, top - 2, 34, 9, 2).fill(0x475569);
    this.drawer.rect(cx - 13, top, 26, 4).fill(shade(COIN, 0.95));
    const reg = new Graphics();
    reg.roundRect(cx - 20, top - 20, 40, 22, 5).fill(0x334155);
    reg.roundRect(cx - 14, top - 30, 28, 12, 3).fill(0x1f2937);
    reg.roundRect(cx - 12, top - 28, 24, 8, 2).fill(0x22c55e);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) reg.rect(cx - 15 + k * 8, top - 16 + r * 6, 6, 4).fill(0x94a3b8);
    this.node.addChild(g, this.drawer, reg);
    this.drawer.position.set(0, 0);
    this.node.zIndex = b.y + b.h;
  }

  /** Coins paid in: the drawer slides out and snaps back. */
  pop(): void {
    this.open = 1;
  }

  update(dt: number): void {
    if (this.open <= 0) return;
    this.open = Math.max(0, this.open - dt / 0.55);
    this.drawer.y = Math.sin(this.open * Math.PI) * 7;
  }
}
