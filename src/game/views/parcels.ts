// Parcel sprites. Each frame every parcel gets a target from the container it is in (belt, stack,
// shelf, van); when its `hop` counter changes it flies there along an arc instead of snapping.
import { Graphics, Sprite, type Container } from 'pixi.js';
import type { Parcel } from '../../sim/types.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import { PARCEL, PARCEL_XXL } from '../art.ts';
import { setTexture, type Atlas } from '../atlas.ts';
import { parcelTex } from '../textures.ts';
import { HANDS_Z, type CharacterView } from './character.ts';
import { BELT_H, type DockView, type ShelfView } from './stations.ts';

interface Target {
  x: number;
  y: number;
  z: number;
  zi: number;
  rot: number;
  hide: boolean;
}

interface View {
  sprite: Sprite;
  hop: number;
  tex: string;
  x: number;
  y: number;
  z: number;
  fly: { fx: number; fy: number; fz: number; t: number; dur: number; arc: number } | null;
}

const heightOf = (p: Parcel): number => (p.kind === 'xxl' ? PARCEL_XXL.h : PARCEL.h);
const depthOf = (p: Parcel): number => (p.kind === 'xxl' ? PARCEL_XXL.d : PARCEL.d);

export class ParcelLayer {
  private readonly views = new Map<number, View>();
  private readonly pool: Sprite[] = [];
  private readonly targets = new Map<number, Target>();
  /** Express timers drawn above parcels. */
  readonly timers = new Graphics();
  private timersDrawn = false;

  constructor(
    private readonly atlas: Atlas,
    private readonly layer: Container,
    private readonly wh: Warehouse,
  ) {}

  /** Screen position of a parcel sprite (for effects). */
  position(id: number): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.x, y: v.y - v.z } : null;
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

  private computeTargets(chars: Map<number, CharacterView>, shelves: ShelfView[], docks: DockView[], time: number): void {
    const T = this.targets;
    T.clear();
    const wh = this.wh;
    for (const b of wh.belts) {
      const { x0, y } = b.geom;
      for (const it of b.items) {
        T.set(it.p.id, { x: x0 + it.s, y, z: BELT_H, zi: y + 22 + 0.01 + it.s * 1e-5, rot: 0, hide: false });
      }
    }
    for (const c of wh.carriers) {
      const cv = chars.get(c.id);
      if (!cv) continue;
      const off = cv.stackOffset();
      const scale = cv.node.scale.y;
      let z = HANDS_Z * scale - cv.bob;
      const w = c.wobble;
      const freq = 9 + w * 8;
      for (let i = 0; i < c.stack.length; i++) {
        const p = c.stack[i]!;
        const k = i + 1;
        const sway = cv.lean * i * 0.55 + (w > 0.02 ? Math.sin(time * freq + i * 0.35) * w * k * 1.25 : 0);
        T.set(p.id, {
          x: cv.x + off.dx + sway,
          y: cv.y + 1,
          z,
          zi: cv.y + (off.front ? 0.02 : -0.02) + i * 1e-4,
          rot: sway * 0.018,
          hide: false,
        });
        z += heightOf(p);
      }
    }
    for (const sv of shelves) {
      const items = sv.shelfItems;
      for (let i = 0; i < items.length; i++) {
        const s = sv.slot(i);
        T.set(items[i]!.id, { x: s.x, y: s.y, z: s.z, zi: sv.zBase + 0.01 + s.y * 1e-5 + s.z * 1e-3, rot: 0, hide: false });
      }
    }
    for (let d = 0; d < wh.docks.length; d++) {
      const dock = wh.docks[d]!;
      const door = docks[d]!.doorPoint;
      for (const v of dock.vans) {
        for (const p of v.items) T.set(p.id, { x: door.x, y: door.y, z: 26, zi: door.y + 40, rot: 0, hide: true });
      }
    }
  }

  update(dt: number, time: number, chars: Map<number, CharacterView>, shelves: ShelfView[], docks: DockView[]): void {
    this.computeTargets(chars, shelves, docks, time);
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
        v = { sprite: s, hop: p.hop, tex, x: tg.x, y: tg.y, z: tg.z, fly: null };
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
      }
      const s = v.sprite;
      if (v.fly) {
        const f = v.fly;
        f.t += dt / f.dur;
        const k = Math.min(1, f.t);
        const e = k * (2 - k);
        v.x = f.fx + (tg.x - f.fx) * e;
        v.y = f.fy + (tg.y - f.fy) * e;
        v.z = f.fz + (tg.z - f.fz) * e + Math.sin(k * Math.PI) * f.arc;
        s.zIndex = 1e6 + v.y;
        s.rotation = Math.sin(k * Math.PI) * 0.35;
        s.visible = true;
        if (k >= 1) v.fly = null;
      } else {
        v.x = tg.x;
        v.y = tg.y;
        v.z = tg.z;
        s.zIndex = tg.zi;
        s.rotation = tg.rot;
        s.visible = !tg.hide;
      }
      // Sprites are anchored at the bottom of the front face: footprint centre + half depth.
      s.position.set(v.x, v.y + depthOf(p) / 2 - v.z);
      if (p.kind === 'express' && s.visible) this.drawTimer(p, v.x, v.y + depthOf(p) / 2 - v.z - heightOf(p) - depthOf(p) - 8);
    }
  }

  private drawTimer(p: Parcel, x: number, y: number): void {
    const left = p.deadline - this.wh.time;
    const total = this.wh.loc.features.expressTime;
    if (left <= 0) return;
    const k = Math.max(0, Math.min(1, left / total));
    const color = k > 0.5 ? 0x22c55e : k > 0.2 ? 0xfacc15 : 0xef4444;
    this.timersDrawn = true;
    this.timers.circle(x, y, 7).fill({ color: 0x1f2937, alpha: 0.85 });
    this.timers.moveTo(x, y).arc(x, y, 5.5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).closePath().fill(color);
  }
}
