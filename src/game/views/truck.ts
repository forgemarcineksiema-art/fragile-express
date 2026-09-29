// Delivery truck at the start of a belt, with an unloader who reaches into the open side door, holds
// the next parcel and hands it onto the belt the moment the simulation releases it.
import { Container, Graphics, Sprite } from 'pixi.js';
import { Carrier } from '../../sim/carrier.ts';
import type { Belt } from '../../sim/stations.ts';
import type { Parcel } from '../../sim/types.ts';
import { drawTruck, PARCEL, PARCEL_XXL, TRUCK } from '../art.ts';
import { setTexture, type Atlas } from '../atlas.ts';
import { parcelTex } from '../textures.ts';
import { CharacterView, HANDS_Z } from './character.ts';

type Phase = 'idle' | 'reach' | 'hold' | 'toss';

export class TruckView {
  /** Truck body (sorted as one entity). */
  readonly node = new Container();
  readonly worker: CharacterView;
  readonly held: Sprite;
  private readonly body = new Graphics();
  private readonly carrier: Carrier;
  private readonly cx: number;
  private readonly dummy: Parcel = { id: -1, district: 0, kind: 'normal', sorted: false, deadline: 0, onTime: false, hop: 0 };
  private phase: Phase = 'idle';
  private t = 0;
  private lastId = -1;
  private puffT = 1;
  private release: { x: number; y: number; z: number } | null = null;

  constructor(
    private readonly belt: Belt,
    private readonly atlas: Atlas,
  ) {
    const { x0, y } = belt.geom;
    this.cx = x0 - TRUCK.w / 2 - 7;
    drawTruck(this.body, this.cx, y);
    this.node.addChild(this.body);
    this.node.zIndex = y + TRUCK.d / 2 + 2;
    // The unloader stands in front of the side door, south of the truck.
    this.carrier = new Carrier(-100 - belt.index, 'loader', x0 - 42, y + TRUCK.d / 2 + 16, 13);
    this.worker = new CharacterView(atlas, this.carrier, false);
    this.held = new Sprite();
    this.held.visible = false;
    const last = belt.items[belt.items.length - 1];
    this.lastId = last ? last.p.id : -1;
  }

  /** Where a parcel leaves the unloader's hands (for the flight onto the belt), or null. */
  handsPoint(): { x: number; y: number; z: number } | null {
    // The truck notices the new parcel a moment before the parcel layer does: keep the release point.
    if (this.phase === 'toss' && this.t < 0.1) return this.release;
    if (this.phase !== 'hold') return null;
    const off = this.worker.stackOffset();
    return { x: this.worker.x + off.dx + this.worker.sway(0), y: this.worker.y + 1, z: HANDS_Z - this.worker.bob };
  }

  update(dt: number, time: number, puff: (x: number, y: number) => void): void {
    const b = this.belt;
    const c = this.carrier;
    this.t += dt;

    // Detect the parcel the simulation just put on the belt.
    const last = b.items[b.items.length - 1];
    const lastId = last ? last.p.id : -1;
    const spawned = lastId !== this.lastId && last !== undefined && last.s < 12;
    this.lastId = lastId;

    if (spawned && (this.phase === 'hold' || this.phase === 'reach')) {
      this.release = this.phase === 'hold' ? this.handsPoint() : null;
      this.phase = 'toss';
      this.t = 0;
    } else if (this.phase === 'idle' && b.next && b.canSpawn() && b.spawnT < 0.55) {
      this.phase = 'reach';
      this.t = 0;
    } else if (this.phase === 'reach' && this.t > 0.2 && b.next) {
      this.phase = 'hold';
      this.t = 0;
      setTexture(this.held, this.atlas.get(parcelTex(b.next.district, b.next.kind, false)));
      this.dummy.kind = b.next.kind;
    } else if (this.phase === 'toss' && this.t > 0.3) {
      this.phase = 'idle';
      this.t = 0;
    }

    // Pose: face the truck to reach in, turn to the belt to hand the parcel over.
    switch (this.phase) {
      case 'idle':
        c.dirX = 0.15;
        c.dirY = 1;
        break;
      case 'reach':
        c.dirX = -0.1;
        c.dirY = -1;
        break;
      case 'hold':
      case 'toss':
        c.dirX = 1;
        c.dirY = -0.3;
        break;
    }
    c.stack = this.phase === 'hold' ? [this.dummy] : [];
    this.worker.update(c.x, c.y, dt, time);

    this.held.visible = this.phase === 'hold';
    if (this.held.visible) {
      const off = this.worker.stackOffset();
      const d = this.dummy.kind === 'xxl' ? PARCEL_XXL.d : PARCEL.d;
      this.held.position.set(this.worker.x + off.dx + this.worker.sway(0), this.worker.y + 1 + d / 2 - (HANDS_Z - this.worker.bob));
      this.held.zIndex = this.worker.y + 0.02;
    }

    // Engine idling: a faint shiver and the odd puff from the exhaust under the cab.
    this.body.y = Math.sin(time * 38) * 0.35;
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = 0.9 + Math.random() * 0.9;
      puff(this.cx - TRUCK.w / 2 + 50, b.geom.y + TRUCK.d / 2 - 4);
    }
  }
}
