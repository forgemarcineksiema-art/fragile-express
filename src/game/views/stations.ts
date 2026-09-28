// Entity views for the belt, shelves, van docks, coin piles and the cash desk.
import { Container, Graphics, Sprite, Text, TilingSprite, type Renderer, type Texture } from 'pixi.js';
import { VAN_ARRIVE_TIME, VAN_LEAVE_TIME } from '../../sim/economy.ts';
import { WALL } from '../../sim/layout.ts';
import type { Belt, CoinPile, Dock, Shelf } from '../../sim/stations.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import { drawSymbol, drawTruck, PARCEL, VAN } from '../art.ts';
import type { Atlas } from '../atlas.ts';
import { COIN, DISTRICT_COLORS, DISTRICT_SYMBOLS, INK, WHITE, shade } from '../palette.ts';
import { label, setText } from '../text.ts';

export const BELT_H = 14;
export const RACK_H = 12;
export const RACK_COLS = 2;
export const RACK_ROWS = 8;

const easeIn = (t: number): number => t * t;
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

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

export function truckView(belt: Belt): Graphics {
  const g = new Graphics();
  drawTruck(g, belt.geom.x0 - 122, belt.geom.y);
  g.zIndex = belt.geom.y + 50;
  return g;
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
    // Top: metal frame with two wooden lanes
    g.rect(body.x, body.y - RACK_H, body.w, body.h).fill(0x64748b);
    g.rect(body.x + 4, body.y - RACK_H + 4, body.w / 2 - 6, body.h - 8).fill(0xc9955f);
    g.rect(body.x + body.w / 2 + 2, body.y - RACK_H + 4, body.w / 2 - 6, body.h - 8).fill(0xc9955f);
    for (let y = body.y - RACK_H + 20; y < body.y + body.h - RACK_H - 4; y += 18.5) {
      g.rect(body.x + 2, y, body.w - 4, 2).fill({ color: 0x8b5a2b, alpha: 0.5 });
    }
    // Front face
    g.rect(body.x, body.y + body.h - RACK_H, body.w, RACK_H).fill(0x475569);
    g.rect(body.x, body.y + body.h - RACK_H, body.w, 3).fill({ color: WHITE, alpha: 0.2 });
    // Colour strip down the side
    g.rect(body.x - 3, body.y - RACK_H, 3, body.h).fill(color);
    g.rect(body.x + body.w, body.y - RACK_H, 3, body.h).fill(color);
    g.rect(body.x - 3, body.y - RACK_H, body.w + 6, body.h).stroke({ width: 1.5, color: INK, alpha: 0.3 });
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
      x: cx + (col === 0 ? -14 : 14),
      y: body.y + 6 + row * 18.5 - (layer > 0 ? 3 : 0),
      z: RACK_H + layer * (PARCEL.h + 1),
    };
  }

  get zBase(): number {
    return this.node.zIndex;
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

export interface VanPose {
  x: number;
  y: number;
  visible: boolean;
  doors: boolean;
}

export class DockView {
  readonly node = new Container();
  private readonly vans: Sprite[] = [];
  private readonly doors: Sprite;
  private readonly loadText: Text;
  private readonly bar = new Graphics();
  private readonly shutter = new Graphics();
  private lastLoad = -1;

  constructor(
    private readonly dock: Dock,
    private readonly atlas: Atlas,
    worldW: number,
  ) {
    this.doors = new Sprite(atlas.get('van_doors'));
    this.node.addChild(this.doors);
    this.loadText = label('', 16);
    this.node.addChild(this.bar, this.loadText);
    this.node.zIndex = dock.geom.y + VAN.d / 2;
    // Roller shutter shown while the district is locked.
    const y = dock.geom.y;
    this.shutter.rect(worldW - WALL - 2, y - 46, WALL + 4, 92).fill(0x9ca3af);
    for (let k = y - 44; k < y + 44; k += 7) this.shutter.rect(worldW - WALL - 2, k, WALL + 4, 2).fill(0x6b7280);
    this.shutter.zIndex = y - 60;
  }

  get shutterNode(): Graphics {
    return this.shutter;
  }

  /** Where parcels fly to when loaded (the open rear doors). */
  get doorPoint(): { x: number; y: number } {
    return { x: this.dock.geom.bay.x - VAN.w / 2 + 6, y: this.dock.geom.bay.y };
  }

  private pose(i: number): VanPose {
    const v = this.dock.vans[i]!;
    const bay = this.dock.geom.bay;
    switch (v.state) {
      case 'loading':
        return { x: bay.x, y: bay.y, visible: true, doors: true };
      case 'arriving':
        return { x: bay.x + easeOut(v.t / VAN_ARRIVE_TIME) * 520, y: bay.y, visible: true, doors: false };
      case 'leaving':
        return { x: bay.x + easeIn(1 - v.t / VAN_LEAVE_TIME) * 620, y: bay.y, visible: true, doors: false };
      case 'waiting':
        return { x: bay.x + 205, y: bay.y, visible: true, doors: false };
      case 'away':
        return { x: 0, y: 0, visible: false, doors: false };
    }
  }

  update(): void {
    const d = this.dock;
    this.node.visible = d.built;
    this.shutter.visible = !d.built;
    while (this.vans.length < d.vans.length) {
      const s = new Sprite(this.atlas.get(`van_${d.district}`));
      this.node.addChildAt(s, 0);
      this.vans.push(s);
    }
    let doorsOpen = false;
    for (let i = 0; i < d.vans.length; i++) {
      const p = this.pose(i);
      const s = this.vans[i]!;
      s.visible = p.visible;
      s.position.set(p.x, p.y);
      if (p.doors) {
        doorsOpen = true;
        this.doors.position.set(p.x, p.y);
      }
    }
    this.doors.visible = doorsOpen;
    const van = d.loadingVan();
    const load = van ? van.items.length : -1;
    this.loadText.visible = this.bar.visible = !!van;
    if (van && load !== this.lastLoad) {
      this.lastLoad = load;
      const bx = d.geom.bay.x - 40;
      const by = d.geom.bay.y - VAN.d / 2 - VAN.h - 26;
      setText(this.loadText, `${load}/${d.capacity}`);
      this.loadText.position.set(bx, by - 16);
      const w = 70;
      this.bar.clear();
      this.bar.roundRect(bx - w / 2, by - 4, w, 9, 4).fill({ color: 0x1f2937, alpha: 0.85 });
      this.bar.roundRect(bx - w / 2 + 1.5, by - 2.5, Math.max(0, (w - 3) * (load / d.capacity)), 6, 3).fill(DISTRICT_COLORS[d.district]!);
    }
  }
}

/** Coin pile: towers of coins that grow with the value. */
export class PileView {
  readonly node = new Container();
  private coins: Sprite[] = [];
  private shown = -1;

  constructor(
    private readonly pile: CoinPile,
    private readonly atlas: Atlas,
    private readonly unit: number,
  ) {
    this.node.position.set(pile.x, pile.y);
    this.node.zIndex = pile.y;
  }

  update(): void {
    const n = this.pile.value <= 0 ? 0 : Math.min(36, Math.max(1, Math.ceil(this.pile.value / this.unit)));
    if (n === this.shown) return;
    this.shown = n;
    while (this.coins.length < n) {
      const s = new Sprite(this.atlas.get('coin'));
      this.node.addChild(s);
      this.coins.push(s);
    }
    const towers = [
      [0, 0],
      [-15, -4],
      [15, -3],
      [-8, 9],
      [9, 10],
      [-20, 8],
      [21, 9],
      [0, -12],
      [0, 18],
    ];
    for (let i = 0; i < this.coins.length; i++) {
      const s = this.coins[i]!;
      s.visible = i < n;
      const t = towers[i % towers.length]!;
      const level = Math.floor(i / towers.length);
      s.position.set(t[0]!, t[1]! - level * 3.2);
    }
    // Draw back towers first.
    this.coins.sort((a, b) => a.y - b.y);
    this.coins.forEach((s, i) => this.node.setChildIndex(s, i));
  }
}

export function deskView(wh: Warehouse): Container {
  const c = new Container();
  const g = new Graphics();
  const b = wh.layout.safe.body;
  const h = 26;
  g.rect(b.x + 4, b.y + 6, b.w, b.h).fill({ color: 0x000000, alpha: 0.15 });
  g.roundRect(b.x, b.y - h, b.w, b.h, 6).fill(0xb45309);
  g.rect(b.x, b.y + b.h - h, b.w, h).fill(0x92400e);
  g.rect(b.x, b.y + b.h - h, b.w, 3).fill({ color: WHITE, alpha: 0.2 });
  // Cash register
  g.roundRect(b.x + b.w / 2 - 20, b.y - h - 18, 40, 30, 5).fill(0x334155);
  g.roundRect(b.x + b.w / 2 - 14, b.y - h - 26, 28, 12, 3).fill(0x22c55e);
  g.rect(b.x + b.w / 2 - 12, b.y - h + 2, 24, 8).fill(shade(COIN, 0.9));
  g.roundRect(b.x, b.y - h, b.w, b.h + h, 6).stroke({ width: 1.5, color: INK, alpha: 0.3 });
  c.addChild(g);
  c.zIndex = b.y + b.h;
  return c;
}
