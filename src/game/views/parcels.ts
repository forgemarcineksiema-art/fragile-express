// Parcel sprites. Each frame every parcel gets a target from the container it is in (belt, stack,
// shelf, pallet, van); when its `hop` counter changes it flies there along an arc instead of snapping.
// Landings squash and spring back, and parcels whose support was taken away fall under gravity.
import { Graphics, Sprite, type Container } from 'pixi.js';
import type { Parcel } from '../../sim/types.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import { PARCEL, PARCEL_XXL } from '../art.ts';
import { setTexture, type Atlas } from '../atlas.ts';
import { parcelTex } from '../textures.ts';
import { HANDS_Z, type CharacterView } from './character.ts';
import type { DockView } from './dock.ts';
import { BELT_H, type ShelfView } from './stations.ts';

interface Target {
  x: number;
  y: number;
  z: number;
  zi: number;
  rot: number;
  hide: boolean;
  /** Dock index when the parcel is going into a van. */
  van: number;
}

interface View {
  sprite: Sprite;
  hop: number;
  tex: string;
  x: number;
  y: number;
  z: number;
  fallV: number;
  /** Landing squash, 1 → 0. */
  land: number;
  fly: { fx: number; fy: number; fz: number; t: number; dur: number; arc: number } | null;
}

const heightOf = (p: Parcel): number => (p.kind === 'xxl' ? PARCEL_XXL.h : PARCEL.h);
const depthOf = (p: Parcel): number => (p.kind === 'xxl' ? PARCEL_XXL.d : PARCEL.d);
const GRAVITY = 1400;
const LAND_TIME = 0.2;

/** Small deterministic "hand placed" offsets for parcels at rest. */
const jitterX = (id: number): number => (((id * 37) % 7) - 3) * 0.55;
const jitterR = (id: number): number => (((id * 53) % 9) - 4) * 0.012;

export class ParcelLayer {
  private readonly views = new Map<number, View>();
  private readonly pool: Sprite[] = [];
  private readonly targets = new Map<number, Target>();
  /** Express timers drawn above parcels. */
  readonly timers = new Graphics();
  private timersDrawn = false;
  /** Called when a parcel lands inside a van (the van dips on its springs). */
  onVanLand: ((dock: number) => void) | null = null;
  /** Where a parcel appearing on belt `i` comes from (the unloader's hands). */
  spawnOrigin: ((belt: number) => { x: number; y: number; z: number } | null) | null = null;

  constructor(
    private readonly atlas: Atlas,
    private readonly layer: Container,
    private readonly wh: Warehouse,
  ) {}

  /** The courier's figure, when the location has one (set by the world view). */
  courier: CharacterView | null = null;

  /** Targets for a stack carried by a character. */
  private stackTargets(cv: CharacterView, stack: readonly Parcel[]): void {
    const off = cv.stackOffset();
    const scale = cv.node.scale.y;
    let z = (HANDS_Z - cv.bob) * scale;
    for (let i = 0; i < stack.length; i++) {
      const p = stack[i]!;
      this.targets.set(p.id, {
        x: cv.x + off.dx + cv.sway(i),
        y: cv.y + 1,
        z,
        zi: cv.y + (off.front ? 0.02 : -0.02) + i * 1e-4,
        rot: cv.swayRot(i),
        hide: false,
        van: -1,
      });
      z += heightOf(p);
    }
  }

  /** Screen position of a parcel sprite (for effects). */
  position(id: number): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.x, y: v.y - v.z } : null;
  }

  /** Index of the belt this parcel was just put on, or -1. */
  private beltStart(id: number): number {
    for (const b of this.wh.belts) {
      const last = b.items[b.items.length - 1];
      if (last && last.p.id === id && last.s < 12) return b.index;
    }
    return -1;
  }

  private sprite(): Sprite {
    const s = this.pool.pop() ?? new Sprite();
    s.visible = true;
    s.alpha = 1;
    s.rotation = 0;
    s.scale.set(1);
    if (!s.parent) this.layer.addChild(s);
    return s;
  }

  private computeTargets(chars: Map<number, CharacterView>, shelves: ShelfView[], docks: DockView[]): void {
    const T = this.targets;
    T.clear();
    const wh = this.wh;
    for (const b of wh.belts) {
      const { x0, y } = b.geom;
      for (const it of b.items) {
        T.set(it.p.id, { x: x0 + it.s, y, z: BELT_H, zi: y + 22 + 0.01 + it.s * 1e-5, rot: 0, hide: false, van: -1 });
      }
    }
    for (const c of wh.carriers) {
      const cv = chars.get(c.id);
      if (cv) this.stackTargets(cv, c.stack);
    }
    // Parcels handed to the courier stay in his arms until he walks out.
    if (this.courier && wh.courier.parcels.length) this.stackTargets(this.courier, wh.courier.parcels);
    for (const sv of shelves) {
      const items = sv.shelfItems;
      for (let i = 0; i < items.length; i++) {
        const s = sv.slot(i);
        const id = items[i]!.id;
        T.set(id, { x: s.x + jitterX(id), y: s.y, z: s.z, zi: sv.zBase + 0.01 + s.y * 1e-5 + s.z * 1e-3, rot: jitterR(id), hide: false, van: -1 });
      }
    }
    for (let d = 0; d < wh.docks.length; d++) {
      const dock = wh.docks[d]!;
      const dv = docks[d]!;
      for (let i = 0; i < dock.pallet.length; i++) {
        const s = dv.palletSlot(i);
        const id = dock.pallet[i]!.id;
        T.set(id, {
          x: s.x + jitterX(id) * 0.5,
          y: s.y,
          z: s.z,
          zi: dv.palletZ + 0.01 + s.y * 1e-5 + s.z * 1e-3,
          rot: jitterR(id) * 0.6,
          hide: false,
          van: -1,
        });
      }
      const door = dv.doorPoint;
      for (const v of dock.vans) {
        for (const p of v.items) T.set(p.id, { x: door.x, y: door.y, z: 26, zi: door.y + 40, rot: 0, hide: true, van: d });
      }
    }
  }

  update(dt: number, chars: Map<number, CharacterView>, shelves: ShelfView[], docks: DockView[]): void {
    this.computeTargets(chars, shelves, docks);
    const wh = this.wh;
    // Remove views of parcels that left the simulation (delivered or broken).
    for (const [id, v] of this.views) {
      if (!wh.parcels.has(id)) {
        v.sprite.visible = false;
        this.pool.push(v.sprite);
        this.views.delete(id);
      }
    }
    if (this.timersDrawn) this.timers.clear();
    this.timersDrawn = false;
    for (const p of wh.parcels.values()) {
      const tg = this.targets.get(p.id);
      if (!tg) continue;
      let v = this.views.get(p.id);
      const tex = parcelTex(p.district, p.kind, p.sorted);
      if (!v) {
        const s = this.sprite();
        setTexture(s, this.atlas.get(tex));
        // Fresh parcels on a belt are handed over by the truck's unloader (or drop in if he is busy).
        const belt = this.beltStart(p.id);
        const origin = belt >= 0 ? (this.spawnOrigin?.(belt) ?? null) : null;
        if (origin) {
          v = { sprite: s, hop: p.hop, tex, x: origin.x, y: origin.y, z: origin.z, fallV: 0, land: 0, fly: { fx: origin.x, fy: origin.y, fz: origin.z, t: 0, dur: 0.3, arc: 26 } };
        } else {
          v = { sprite: s, hop: p.hop, tex, x: tg.x, y: tg.y, z: tg.z + (belt >= 0 ? 46 : 0), fallV: 0, land: 0, fly: null };
        }
        this.views.set(p.id, v);
      }
      if (v.tex !== tex) {
        v.tex = tex;
        setTexture(v.sprite, this.atlas.get(tex));
      }
      if (v.hop !== p.hop) {
        v.hop = p.hop;
        const dist = Math.hypot(tg.x - v.x, tg.y - v.y);
        v.fly = { fx: v.x, fy: v.y, fz: v.z, t: 0, dur: Math.min(0.34, 0.16 + dist / 1400), arc: 26 + Math.min(60, dist * 0.18) };
        v.fallV = 0;
      }
      const s = v.sprite;
      let rot = tg.rot;
      if (v.fly) {
        const f = v.fly;
        f.t += dt / f.dur;
        const k = Math.min(1, f.t);
        const e = k * (2 - k);
        v.x = f.fx + (tg.x - f.fx) * e;
        v.y = f.fy + (tg.y - f.fy) * e;
        v.z = f.fz + (tg.z - f.fz) * e + Math.sin(k * Math.PI) * f.arc;
        s.zIndex = 1e6 + v.y;
        rot = Math.sin(k * Math.PI) * 0.35;
        s.visible = true;
        if (k >= 1) {
          v.fly = null;
          v.land = 1;
          if (tg.van >= 0) this.onVanLand?.(tg.van);
        }
      } else {
        v.x = tg.x;
        v.y = tg.y;
        if (tg.z < v.z - 0.5) {
          // Support removed: fall onto the parcel below.
          v.fallV += GRAVITY * dt;
          v.z = Math.max(tg.z, v.z - v.fallV * dt);
          if (v.z <= tg.z) {
            v.fallV = 0;
            v.land = 0.6;
          }
        } else {
          v.z = tg.z;
          v.fallV = 0;
        }
        s.zIndex = tg.zi;
        s.visible = !tg.hide;
      }
      // Landing squash: wide and short, then springs back.
      if (v.land > 0) {
        v.land = Math.max(0, v.land - dt / LAND_TIME);
        const q = Math.sin(v.land * Math.PI) * 0.16;
        s.scale.set(1 + q * 0.7, 1 - q);
      } else if (s.scale.x !== 1) {
        s.scale.set(1);
      }
      s.rotation = rot;
      // Sprites are anchored at the bottom of the front face: footprint centre + half depth.
      s.position.set(v.x, v.y + depthOf(p) / 2 - v.z);
      if (p.kind === 'express' && s.visible) this.drawTimer(p, v.x, v.y + depthOf(p) / 2 - v.z - heightOf(p) - depthOf(p) - 8);
    }
  }

  private drawTimer(p: Parcel, x: number, y: number): void {
    const left = p.deadline - this.wh.time;
    const total = this.wh.loc.features.expressTime;
    if (left <= 0 || p.onTime) return;
    const k = Math.max(0, Math.min(1, left / total));
    const color = k > 0.5 ? 0x22c55e : k > 0.2 ? 0xfacc15 : 0xef4444;
    this.timersDrawn = true;
    this.timers.circle(x, y, 7).fill({ color: 0x1f2937, alpha: 0.85 });
    this.timers.moveTo(x, y).arc(x, y, 5.5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).closePath().fill(color);
  }
}
