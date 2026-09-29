// WorldView: every world-space layer of one location, synced to the simulation each frame.
import { Container, Graphics, Sprite, type Renderer, type Text } from 'pixi.js';
import { lerp } from '../core/math.ts';
import { PARCEL, PARCEL_XXL } from './art.ts';
import type { Atlas } from './atlas.ts';
import { Daylight } from './daylight.ts';
import { Fx } from './fx.ts';
import { label, formatTime, setText } from './text.ts';
import { Background } from './views/background.ts';
import { WORLD_MARGIN } from './views/outdoor.ts';
import { CharacterView, HANDS_Z } from './views/character.ts';
import { AdPadView, PadTooltip, PadView } from './views/pads.ts';
import { ParcelLayer } from './views/parcels.ts';
import { DockView, type VanEvent } from './views/dock.ts';
import { PileView } from './views/pile.ts';
import { BeltView, DeskView, ShelfView, beltTexture } from './views/stations.ts';
import { TruckView } from './views/truck.ts';
import { CourierView } from './views/courier.ts';
import { propNodes } from './views/props.ts';
import { payout } from '../sim/economy.ts';
import type { Warehouse } from '../sim/warehouse.ts';

export class WorldView {
  readonly root = new Container();
  readonly floor = new Container();
  readonly entities = new Container();
  readonly overlay = new Container();
  readonly fx: Fx;
  /** Time of day: dusk, night lighting and dawn. */
  readonly daylight: Daylight;
  readonly chars = new Map<number, CharacterView>();
  readonly shelves: ShelfView[];
  readonly docks: DockView[];
  readonly parcels: ParcelLayer;
  private readonly bg: Background;
  private readonly belts: BeltView[];
  readonly piles: PileView[];
  private readonly trucks: TruckView[] = [];
  readonly desk: DeskView;
  /** The courier at the front door (locations that have one). */
  readonly courier: CourierView | null = null;
  private readonly pads: PadView[];
  private readonly adPads = new Map<string, AdPadView>();
  private readonly tooltip: PadTooltip;
  private readonly wobble = new Graphics();
  private readonly wobbleIcon: Sprite;
  private wobbleDrawn = false;
  private readonly helperTimers = new Map<number, Text>();
  readonly guideArrow: Sprite;
  /** Van state changes, for sounds (set by the game). */
  onVanEvent: ((ev: VanEvent, x: number, y: number) => void) | null = null;

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
    this.bg.outdoor.attach(this.entities);

    const tex = beltTexture(renderer);
    this.belts = wh.belts.map((b) => {
      const v = new BeltView(b, tex);
      const truck = new TruckView(b, atlas);
      this.trucks.push(truck);
      this.entities.addChild(v.node, truck.node, truck.worker.node, truck.worker.front, truck.held);
      return v;
    });
    this.shelves = wh.shelves.map((s) => {
      const v = new ShelfView(s);
      this.entities.addChild(v.node);
      return v;
    });
    this.docks = wh.docks.map((d) => {
      const v = new DockView(d, atlas, wh.layout.w);
      this.entities.addChild(v.node, v.palletNode);
      this.floor.addChild(v.shutter);
      return v;
    });
    const unit = payout('normal', wh.loc.multiplier, false);
    this.piles = wh.piles.map((p) => {
      const v = new PileView(p, atlas, unit);
      this.entities.addChild(v.node);
      return v;
    });
    this.desk = new DeskView(wh);
    this.entities.addChild(this.desk.node);
    for (const n of propNodes(wh.loc.props ?? [])) this.entities.addChild(n);

    this.pads = wh.pads.map((p) => {
      const v = new PadView(p, atlas, wh);
      this.floor.addChild(v.node);
      return v;
    });

    if (wh.layout.courier) {
      const cv = new CourierView(wh, atlas);
      this.courier = cv;
      this.floor.addChild(cv.mat);
      this.entities.addChild(cv.figure.node, cv.figure.front);
    }

    this.parcels = new ParcelLayer(atlas, this.entities, wh);
    this.parcels.courier = this.courier?.figure ?? null;
    this.parcels.onVanLand = (d) => this.docks[d]?.kick();
    this.parcels.spawnOrigin = (belt) => this.trucks[belt]?.handsPoint() ?? null;
    this.fx = new Fx(atlas);
    this.fx.layer.sortableChildren = true;
    this.daylight = new Daylight(this.bg, this.bg.outdoor, () => [
      ...this.docks.map((d) => d.node),
      ...this.trucks.flatMap((t) => [t.node, t.worker.node, t.worker.front, t.held]),
    ]);
    this.overlay.addChild(this.daylight.blooms, this.fx.layer, this.parcels.timers, this.wobble);
    if (this.courier) this.overlay.addChild(this.courier.card);
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
        this.entities.addChild(v.node, v.front);
        const said = this.pendingSay.get(c.id);
        if (said) {
          v.say(said);
          this.pendingSay.delete(c.id);
        }
      }
    }
    for (const [id, v] of this.chars) {
      if (alive.has(id)) continue;
      this.fx.dust(v.x, v.y, 10);
      v.destroy();
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

  /** A short happy/shocked face on a carrier. */
  emote(carrierId: number, mood: 'happy' | 'shock', seconds = 1): void {
    this.chars.get(carrierId)?.emote(mood, seconds);
  }

  private readonly lastDust = new Map<number, number>();

  /** Little dust clouds kicked up by running feet. */
  private stepDust(): void {
    for (const c of this.wh.carriers) {
      const v = this.chars.get(c.id);
      if (!v) continue;
      const last = this.lastDust.get(c.id) ?? c.walked;
      const fast = c.running && Math.hypot(c.vx, c.vy) > 150;
      if (!fast) {
        this.lastDust.set(c.id, c.walked);
        continue;
      }
      if (c.walked - last >= 34) {
        this.lastDust.set(c.id, c.walked);
        this.fx.stepPuff(v.x - c.dirX * 8, v.y + 2);
      }
    }
  }

  /** Speech bubble over a carrier. */
  say(carrierId: number, text: string): void {
    const v = this.chars.get(carrierId);
    if (v) v.say(text);
    else this.pendingSay.set(carrierId, text); // worker hired this step: its view appears next frame
  }

  private readonly pendingSay = new Map<number, string>();

  /** Top of the player's stack in world space (for the wobble bar and effects). */
  stackTop(id: number): { x: number; y: number } {
    const v = this.chars.get(id);
    if (!v) return { x: 0, y: 0 };
    let h = HANDS_Z * v.node.scale.y;
    for (const p of v.carrier.stack) h += p.kind === 'xxl' ? PARCEL_XXL.h : PARCEL.h;
    if (v.carrier.stack.length === 0) h = 74;
    return { x: v.x + v.stackOffset().dx, y: v.y - h - PARCEL.d };
  }

  /** Hides prices, counters, bubbles and other overlays (thumbnails and trailers). */
  cinematic = false;

  private applyCinematic(): void {
    for (const p of this.pads) p.node.visible = false;
    for (const a of this.adPads.values()) a.node.visible = false;
    this.tooltip.node.visible = false;
    this.guideArrow.visible = false;
    if (this.courier) this.courier.card.visible = false;
    this.wobble.visible = false;
    this.wobbleIcon.visible = false;
    this.parcels.timers.visible = false;
    for (const t of this.helperTimers.values()) t.visible = false;
    for (const s of this.shelves) s.hideLabels();
    for (const d of this.docks) d.hideLabels();
    for (const c of this.chars.values()) c.hideBubble();
  }

  update(dt: number, alpha: number, time: number): void {
    const wh = this.wh;
    this.syncCharacters();
    for (const c of wh.carriers) {
      const v = this.chars.get(c.id)!;
      v.update(lerp(c.px, c.x, alpha), lerp(c.py, c.y, alpha), dt, time);
    }
    this.bg.update();
    this.bg.outdoor.update(dt);
    this.daylight.update(wh.time);
    for (const b of this.belts) b.update(dt);
    for (const t of this.trucks) t.update(dt, time, (x, y) => this.fx.puff(x, y));
    for (const s of this.shelves) s.update(dt);
    for (const d of this.docks) {
      d.update(
        dt,
        (x, y) => this.fx.puff(x, y),
        (ev) => this.onVanEvent?.(ev, d.doorPoint.x, d.doorPoint.y),
      );
    }
    for (const p of this.piles) p.update(dt);
    this.courier?.update(dt, time);
    this.desk.update(dt);
    for (const p of this.pads) p.update(dt, time);
    this.syncAdPads(dt, time);
    this.parcels.update(dt, this.chars, this.shelves, this.docks);
    this.tooltip.update();
    this.fx.update(dt);
    this.drawWobble(time);
    this.drawHelperTimers();
    if (dt > 0) this.stepDust();
    this.fx.noText = this.cinematic;
    if (this.cinematic) this.applyCinematic();
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
    // Follow the swaying top parcel so the bar stays on the stack.
    const topParcel = p.stack[p.stack.length - 1];
    const sway = topParcel ? this.parcels.position(topParcel.id) : null;
    const base = this.stackTop(p.id);
    const top = sway ? { x: sway.x, y: base.y } : base;
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
      t.position.set(v.x, v.y - 80);
    }
  }
}
