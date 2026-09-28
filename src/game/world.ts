// WorldView: every world-space layer of one location, synced to the simulation each frame.
import { Container, Graphics, Sprite, type Renderer, type Text } from 'pixi.js';
import { lerp } from '../core/math.ts';
import { PARCEL, PARCEL_XXL } from './art.ts';
import type { Atlas } from './atlas.ts';
import { Fx } from './fx.ts';
import { label, formatTime, setText } from './text.ts';
import { Background, WORLD_MARGIN } from './views/background.ts';
import { CharacterView, HANDS_Z } from './views/character.ts';
import { AdPadView, PadTooltip, PadView } from './views/pads.ts';
import { ParcelLayer } from './views/parcels.ts';
import { BeltView, DockView, PileView, ShelfView, beltTexture, deskView, truckView } from './views/stations.ts';
import { payout } from '../sim/economy.ts';
import type { Warehouse } from '../sim/warehouse.ts';

export class WorldView {
  readonly root = new Container();
  readonly floor = new Container();
  readonly entities = new Container();
  readonly overlay = new Container();
  readonly fx: Fx;
  readonly chars = new Map<number, CharacterView>();
  readonly shelves: ShelfView[];
  readonly docks: DockView[];
  readonly parcels: ParcelLayer;
  private readonly bg: Background;
  private readonly belts: BeltView[];
  private readonly piles: PileView[];
  private readonly pads: PadView[];
  private readonly adPads = new Map<string, AdPadView>();
  private readonly tooltip: PadTooltip;
  private readonly wobble = new Graphics();
  private readonly wobbleIcon: Sprite;
  private wobbleDrawn = false;
  private readonly helperTimers = new Map<number, Text>();
  readonly guideArrow: Sprite;

  constructor(
    private readonly wh: Warehouse,
    private readonly atlas: Atlas,
    renderer: Renderer,
  ) {
    this.entities.sortableChildren = true;
    this.overlay.sortableChildren = true;
    this.root.addChild(this.floor, this.entities, this.overlay);

    this.bg = new Background(wh, atlas);
    this.floor.addChild(this.bg.ground);

    const tex = beltTexture(renderer);
    this.belts = wh.belts.map((b) => {
      const v = new BeltView(b, tex);
      this.entities.addChild(v.node, truckView(b));
      return v;
    });
    this.shelves = wh.shelves.map((s) => {
      const v = new ShelfView(s);
      this.entities.addChild(v.node);
      return v;
    });
    this.docks = wh.docks.map((d) => {
      const v = new DockView(d, atlas, wh.layout.w);
      this.entities.addChild(v.node);
      this.floor.addChild(v.shutterNode);
      return v;
    });
    const unit = payout('normal', wh.loc.multiplier, false);
    this.piles = wh.piles.map((p) => {
      const v = new PileView(p, atlas, unit);
      this.entities.addChild(v.node);
      return v;
    });
    this.entities.addChild(deskView(wh));

    this.pads = wh.pads.map((p) => {
      const v = new PadView(p, atlas, wh);
      this.floor.addChild(v.node);
      return v;
    });

    this.parcels = new ParcelLayer(atlas, this.entities, wh);
    this.fx = new Fx(atlas);
    this.fx.layer.sortableChildren = true;
    this.overlay.addChild(this.fx.layer, this.parcels.timers, this.wobble);
    this.wobbleIcon = new Sprite(atlas.get('icon_glass'));
    this.wobbleIcon.scale.set(0.34);
    this.overlay.addChild(this.wobbleIcon);
    this.tooltip = new PadTooltip(wh);
    this.overlay.addChild(this.tooltip.node);
    this.guideArrow = new Sprite(atlas.get('arrow'));
    this.guideArrow.visible = false;
    this.overlay.addChild(this.guideArrow);
  }

  /** World rectangle the camera may show. */
  get bounds(): { x: number; y: number; w: number; h: number } {
    const L = this.wh.layout;
    const m = WORLD_MARGIN;
    return { x: -m.left, y: -m.top, w: L.w + m.left + m.right, h: L.h + m.top + m.bottom };
  }

  private syncCharacters(): void {
    const alive = new Set<number>();
    for (const c of this.wh.carriers) {
      alive.add(c.id);
      if (!this.chars.has(c.id)) {
        const v = new CharacterView(this.atlas, c, c.expiresAt > 0);
        this.chars.set(c.id, v);
        this.entities.addChild(v.node);
      }
    }
    for (const [id, v] of this.chars) {
      if (alive.has(id)) continue;
      this.fx.dust(v.x, v.y, 10);
      v.node.destroy({ children: true });
      this.chars.delete(id);
      const t = this.helperTimers.get(id);
      if (t) {
        t.destroy();
        this.helperTimers.delete(id);
      }
    }
  }

  private syncAdPads(dt: number, time: number): void {
    const live = new Set<string>();
    for (const a of this.wh.adPads) {
      live.add(a.id);
      let v = this.adPads.get(a.id);
      if (!v) {
        v = new AdPadView(a, this.atlas, this.wh);
        this.adPads.set(a.id, v);
        this.floor.addChild(v.node);
      }
      v.update(dt, time);
    }
    for (const [id, v] of this.adPads) {
      if (live.has(id)) continue;
      v.node.destroy({ children: true });
      this.adPads.delete(id);
    }
  }

  /** Top of the player's stack in world space (for the wobble bar and effects). */
  stackTop(id: number): { x: number; y: number } {
    const v = this.chars.get(id);
    if (!v) return { x: 0, y: 0 };
    let h = HANDS_Z * v.node.scale.y;
    for (const p of v.carrier.stack) h += p.kind === 'xxl' ? PARCEL_XXL.h : PARCEL.h;
    if (v.carrier.stack.length === 0) h = 56;
    return { x: v.x + v.stackOffset().dx, y: v.y - h - PARCEL.d };
  }

  update(dt: number, alpha: number, time: number): void {
    const wh = this.wh;
    this.syncCharacters();
    for (const c of wh.carriers) {
      const v = this.chars.get(c.id)!;
      v.update(lerp(c.px, c.x, alpha), lerp(c.py, c.y, alpha), dt, time);
    }
    this.bg.update();
    for (const b of this.belts) b.update(dt);
    for (const s of this.shelves) s.update(dt);
    for (const d of this.docks) d.update();
    for (const p of this.piles) p.update();
    for (const p of this.pads) p.update(dt, time);
    this.syncAdPads(dt, time);
    this.parcels.update(dt, time, this.chars, this.shelves, this.docks);
    this.tooltip.update();
    this.fx.update(dt);
    this.drawWobble(time);
    this.drawHelperTimers();
  }

  private drawWobble(time: number): void {
    const p = this.wh.player;
    const g = this.wobble;
    const w = p.wobble;
    const show = w > 0.01 && p.hasFragile();
    this.wobbleIcon.visible = show;
    if (!show) {
      if (this.wobbleDrawn) g.clear();
      this.wobbleDrawn = false;
      return;
    }
    g.clear();
    this.wobbleDrawn = true;
    const top = this.stackTop(p.id);
    const shake = w > 0.7 ? Math.sin(time * 50) * 2 * w : 0;
    const x = top.x + shake;
    const y = top.y - 16;
    const W = 50;
    const color = w < 0.45 ? 0xfacc15 : w < 0.75 ? 0xf97316 : 0xef4444;
    g.roundRect(x - W / 2 - 2, y - 5, W + 4, 11, 5).fill({ color: 0x1f2937, alpha: 0.9 });
    g.roundRect(x - W / 2, y - 3, W * Math.min(1, w), 7, 3).fill(color);
    this.wobbleIcon.position.set(x - W / 2 - 12, y);
  }

  private drawHelperTimers(): void {
    for (const w of this.wh.workers) {
      const c = w.carrier;
      if (c.expiresAt <= 0) continue;
      let t = this.helperTimers.get(c.id);
      if (!t) {
        t = label('', 12, 0xe9d5ff);
        this.helperTimers.set(c.id, t);
        this.overlay.addChild(t);
      }
      const v = this.chars.get(c.id);
      if (!v) continue;
      setText(t, formatTime(Math.max(0, c.expiresAt - this.wh.time)));
      t.position.set(v.x, v.y - 62);
    }
  }
}
