// First-minute tutorial: a bouncing arrow over the next station, a screen-edge pointer when it is
// off-screen, and one line of hint text. Later it points at affordable milestone pads.
import { Container, Sprite } from 'pixi.js';
import { t } from '../core/i18n.ts';
import type { Vec } from '../core/math.ts';
import { payout } from '../sim/economy.ts';
import type { Pad } from '../sim/stations.ts';
import type { Warehouse } from '../sim/warehouse.ts';
import type { Atlas } from './atlas.ts';
import type { Camera } from './camera.ts';
import type { WorldView } from './world.ts';

interface Step {
  hint: string;
  target: (wh: Warehouse) => Vec | null;
  done: (wh: Warehouse, g: Guide) => boolean;
}

const firstPad = (wh: Warehouse): Pad | undefined => wh.pads.find((p) => p.visible && p.def.type === 'upgrade');

const STEPS: Step[] = [
  {
    hint: 'tut.belt',
    target: (wh) => wh.belts[0]!.geom.stand,
    done: (wh) => wh.player.stack.length > 0,
  },
  {
    hint: 'tut.shelf',
    target: (wh) => wh.shelves[0]!.geom.inStand,
    done: (wh) => wh.shelves[0]!.items.length > 0 || wh.player.stack.some((p) => p.sorted),
  },
  {
    hint: 'tut.take',
    target: (wh) => wh.shelves[0]!.geom.outStand,
    done: (wh) => wh.player.stack.some((p) => p.sorted),
  },
  {
    hint: 'tut.van',
    target: (wh) => wh.docks[0]!.geom.stand,
    done: (wh, g) => g.vanLeft || wh.piles[0]!.value > 0,
  },
  {
    hint: 'tut.coins',
    target: (wh) => wh.piles[0]!,
    done: (wh) => wh.coins > 0 && wh.piles[0]!.value <= 0,
  },
  {
    hint: 'tut.buy',
    target: (wh) => firstPad(wh) ?? null,
    done: (wh) => wh.stage() > 0 || Object.keys(wh.levels).length > 0,
  },
];

export class Guide {
  step: number;
  vanLeft = false;
  readonly edge: Sprite;
  private bob = 0;

  constructor(
    atlas: Atlas,
    screenLayer: Container,
    done: boolean,
    private readonly onFinish: () => void,
  ) {
    this.step = done ? STEPS.length : 0;
    this.edge = new Sprite(atlas.get('arrow'));
    this.edge.anchor.set(0.5, 0.5);
    this.edge.visible = false;
    screenLayer.addChild(this.edge);
  }

  get active(): boolean {
    return this.step < STEPS.length;
  }

  /** Returns the hint text to show (null for none). */
  update(dt: number, wh: Warehouse, world: WorldView, cam: Camera): string | null {
    this.bob += dt;
    if (world.cinematic) {
      world.guideArrow.visible = false;
      this.edge.visible = false;
      return null;
    }
    let target: Vec | null = null;
    let hint: string | null = null;
    while (this.step < STEPS.length && STEPS[this.step]!.done(wh, this)) {
      this.step++;
      if (this.step === STEPS.length) this.onFinish();
    }
    if (this.step < STEPS.length) {
      const s = STEPS[this.step]!;
      target = s.target(wh);
      hint = t(s.hint);
    } else {
      const b = this.bottleneck(dt, wh);
      if (b) {
        target = b.target;
        hint = t(b.text);
      } else {
        target = this.milestoneTarget(wh);
      }
    }
    const arrow = world.guideArrow;
    if (!target) {
      arrow.visible = false;
      this.edge.visible = false;
      return hint;
    }
    arrow.visible = true;
    arrow.position.set(target.x, target.y - 40 - Math.abs(Math.sin(this.bob * 4)) * 14);
    arrow.zIndex = 1e7;
    // Screen-edge pointer when the target is off-screen.
    const p = cam.worldToScreen(target.x, target.y - 30);
    const m = 44;
    // Keep the pointer below the HUD row (coin counter, pause button).
    const top = 96;
    const off = p.x < m || p.y < top || p.x > cam.viewW - m || p.y > cam.viewH - m;
    this.edge.visible = off;
    if (off) {
      const cx = cam.viewW / 2;
      const cy = (cam.viewH + top - m) / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const k = Math.min((cam.viewW / 2 - m) / Math.max(1, Math.abs(dx)), (cam.viewH - top - m) / 2 / Math.max(1, Math.abs(dy)));
      this.edge.position.set(cx + dx * k, cy + dy * k);
      this.edge.rotation = Math.atan2(dy, dx) - Math.PI / 2;
      this.edge.scale.set(0.9 + Math.sin(this.bob * 6) * 0.08);
    }
    return hint;
  }

  private shown: { key: string; t: number } | null = null;
  private readonly cooldown = new Map<string, number>();

  /**
   * After the tutorial: what is holding the depot up right now, most urgent first. Each hint shows
   * for a few seconds and then rests, so the player is nudged, not nagged.
   */
  private bottleneck(dt: number, wh: Warehouse): { key: string; text: string; target: Vec } | null {
    for (const [k, v] of this.cooldown) this.cooldown.set(k, v - dt);
    const pl = wh.player;
    const far = (v: Vec): boolean => Math.hypot(pl.x - v.x, pl.y - v.y) > 110;
    const has = (role: string): boolean => wh.workers.some((w) => w.role === role);
    const list: { key: string; text: string; target: Vec }[] = [];
    const k = wh.layout.courier;
    if (k && wh.courier.state === 'waiting' && far(k.spot)) list.push({ key: 'courier', text: 'hint.courier', target: k.spot });
    if (!has('collector')) {
      const pile = [...wh.piles].sort((a, b) => b.value - a.value)[0];
      if (pile && pile.value >= payout('normal', wh.loc.multiplier, false) * 12 && far(pile)) list.push({ key: 'coins', text: 'hint.coins', target: pile });
    }
    if (!has('loader')) {
      const full = wh.shelves.find((s) => s.built && s.isFull());
      if (full && far(full.geom.outStand)) list.push({ key: 'shelf', text: 'hint.shelfFull', target: full.geom.outStand });
    }
    if (!has('sorter')) {
      const b = wh.belts.find((x) => x.items.length >= x.maxItems);
      if (b && far(b.geom.stand) && pl.stack.length === 0) list.push({ key: 'belt', text: 'hint.beltFull', target: b.geom.stand });
    }
    if (this.shown) {
      this.shown.t += dt;
      const still = list.find((c) => c.key === this.shown!.key);
      if (still && this.shown.t < 7) return still;
      this.cooldown.set(this.shown.key, 25);
      this.shown = null;
    }
    const next = list.find((c) => (this.cooldown.get(c.key) ?? 0) <= 0);
    if (!next) return null;
    this.shown = { key: next.key, t: 0 };
    return next;
  }

  /** After the tutorial: point at a milestone pad the player can afford but may not have noticed. */
  private milestoneTarget(wh: Warehouse): Vec | null {
    let best: Pad | null = null;
    for (const p of wh.pads) {
      if (!p.visible || p.def.type === 'upgrade') continue;
      const left = wh.padCost(p) - p.paid;
      if (wh.coins < left) continue;
      if (!best || left < wh.padCost(best) - best.paid) best = p;
    }
    if (!best) return null;
    const pl = wh.player;
    if (Math.hypot(pl.x - best.x, pl.y - best.y) < 60) return null;
    return best;
  }
}
