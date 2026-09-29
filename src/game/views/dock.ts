// Van dock: vans with rolling wheels and sprung bodies that back into the bay and drive off, the loading
// pallet, the load counter and the "van is on its way back" badge.
import { Container, Graphics, Sprite, type Text } from 'pixi.js';
import { VAN_ARRIVE_TIME, VAN_AWAY_TIME, VAN_LEAVE_TIME } from '../../sim/economy.ts';
import { WALL } from '../../sim/layout.ts';
import type { Dock, Van, VanState } from '../../sim/stations.ts';
import { PARCEL, VAN, VAN_WHEELS } from '../art.ts';
import type { Atlas } from '../atlas.ts';
import { DISTRICT_COLORS, INK, WHITE } from '../palette.ts';
import { label, setText } from '../text.ts';

const ARRIVE_FROM = 470;
const LEAVE_TO = 640;
const QUEUE_GAP = 205;
const PALLET = { w: 50, d: 40, h: 8 };

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInQuad = (t: number): number => t * t;

export type VanEvent = 'reverse' | 'depart' | 'stop';

/** One van: shadow on the ground, a sprung body and two rolling wheels. */
class VanView {
  readonly node = new Container();
  private readonly shadow: Sprite;
  private readonly body = new Container();
  private readonly wheels: Sprite[] = [];
  private readonly reverse: Sprite;
  private readonly brake: Sprite;
  private state: VanState;
  private fromX = 0;
  x = 0;
  private vx = 0;
  private tilt = 0;
  private tiltV = 0;
  private bounce = 0;
  private bounceV = 0;
  private puffT = 0;

  constructor(
    atlas: Atlas,
    district: number,
    private readonly van: Van,
    private readonly bay: { x: number; y: number },
  ) {
    this.state = van.state;
    this.shadow = new Sprite(atlas.get('van_shadow'));
    const bodySprite = new Sprite(atlas.get(`van_${district}`));
    // Pivot on the axle line so the body pitches around the wheels.
    this.body.pivot.set(0, VAN.d / 2 - 5);
    this.body.position.set(0, VAN.d / 2 - 5);
    this.body.addChild(bodySprite);
    this.reverse = new Sprite(atlas.get('dot'));
    this.reverse.tint = 0xfffbeb;
    this.reverse.scale.set(0.55);
    this.reverse.position.set(-VAN.w / 2 - 1, VAN.d / 2 - VAN.h + 26);
    this.brake = new Sprite(atlas.get('dot'));
    this.brake.tint = 0xff3b3b;
    this.brake.scale.set(0.6);
    this.brake.position.set(-VAN.w / 2 - 1, VAN.d / 2 - VAN.h + 12);
    this.body.addChild(this.reverse, this.brake);
    this.node.addChild(this.shadow, this.body);
    for (const w of VAN_WHEELS) {
      const s = new Sprite(atlas.get('wheel'));
      s.position.set(w.x, w.y);
      this.wheels.push(s);
      this.node.addChild(s);
    }
    this.x = this.targetX();
  }

  /** A parcel landed in the van: the body dips on its springs. */
  kick(): void {
    this.bounceV += 60;
  }

  private targetX(): number {
    const v = this.van;
    switch (v.state) {
      case 'loading':
        return this.bay.x;
      case 'arriving':
        return this.fromX + (this.bay.x - this.fromX) * easeOutCubic(1 - v.t / VAN_ARRIVE_TIME);
      case 'leaving':
        return this.bay.x + easeInQuad(1 - v.t / VAN_LEAVE_TIME) * LEAVE_TO;
      case 'waiting':
        return this.bay.x + QUEUE_GAP;
      case 'away':
        return this.bay.x + LEAVE_TO + 400;
    }
  }

  /** Returns an event when the van changes what it is doing (for sounds and effects). */
  update(dt: number, puff: (x: number, y: number) => void): VanEvent | null {
    const v = this.van;
    let ev: VanEvent | null = null;
    if (v.state !== this.state) {
      if (v.state === 'arriving') {
        this.fromX = this.state === 'waiting' ? this.x : this.bay.x + ARRIVE_FROM;
        ev = 'reverse';
      } else if (v.state === 'leaving') {
        ev = 'depart';
      } else if (v.state === 'loading') {
        ev = 'stop';
        this.tiltV -= 1.6; // settles on its springs after braking
      }
      this.state = v.state;
    }
    const nx = this.targetX();
    const nvx = dt > 0 ? (nx - this.x) / dt : 0;
    const ax = dt > 0 ? (nvx - this.vx) / dt : 0;
    this.vx = nvx;
    const dx = nx - this.x;
    this.x = nx;
    this.node.visible = v.state !== 'away';
    this.node.position.set(this.x, this.bay.y);
    // Pitch from acceleration, plus damped springs. Small fixed substeps keep the springs stable
    // when a frame is long (tab switch, slow device).
    const target = Math.max(-0.06, Math.min(0.06, -ax * 0.00006));
    for (let left = Math.min(dt, 0.1); left > 1e-6; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      this.tiltV += ((target - this.tilt) * 120 - this.tiltV * 11) * h;
      this.tilt += this.tiltV * h;
      this.bounceV += (-this.bounce * 260 - this.bounceV * 12) * h;
      this.bounce += this.bounceV * h;
    }
    if (!Number.isFinite(this.tilt + this.tiltV + this.bounce + this.bounceV)) this.tilt = this.tiltV = this.bounce = this.bounceV = 0;
    this.tilt = Math.max(-0.12, Math.min(0.12, this.tilt));
    this.bounce = Math.max(-40, Math.min(40, this.bounce));
    this.body.rotation = this.tilt;
    this.body.y = VAN.d / 2 - 5 + this.bounce * 0.06;
    for (const w of this.wheels) w.rotation += dx / 12.5;
    this.reverse.visible = v.state === 'arriving';
    this.reverse.alpha = 0.65 + Math.sin(performance.now() / 90) * 0.25;
    this.brake.visible = v.state === 'arriving' && v.t < VAN_ARRIVE_TIME * 0.35;
    // Exhaust while the engine works hard.
    if (v.state === 'leaving' || v.state === 'arriving') {
      this.puffT -= dt;
      if (this.puffT <= 0) {
        this.puffT = (v.state === 'leaving' ? 0.06 : 0.14) * (0.7 + Math.random() * 0.6);
        puff(this.x - VAN.w / 2 + 6, this.bay.y + VAN.d / 2 - 4);
      }
    }
    return ev;
  }
}

export class DockView {
  readonly node = new Container();
  /** Pallet and badge sit inside the building and sort on their own. */
  readonly palletNode = new Container();
  readonly shutter = new Graphics();
  private readonly vans: VanView[] = [];
  private readonly doors: Sprite;
  private readonly loadText: Text;
  private readonly bar = new Graphics();
  private readonly badge = new Graphics();
  private readonly badgeIcon: Sprite;
  private lastLoad = -1;
  private lastCap = -1;
  private badgeDrawn = false;

  constructor(
    private readonly dock: Dock,
    private readonly atlas: Atlas,
    worldW: number,
  ) {
    this.doors = new Sprite(atlas.get('van_doors'));
    this.loadText = label('', 16);
    this.node.addChild(this.doors, this.bar, this.loadText);
    this.node.zIndex = dock.geom.y + VAN.d / 2;
    const y = dock.geom.y;
    this.shutter.rect(worldW - WALL - 2, y - 46, WALL + 4, 92).fill(0x9ca3af);
    for (let k = y - 44; k < y + 44; k += 7) this.shutter.rect(worldW - WALL - 2, k, WALL + 4, 2).fill(0x6b7280);

    // Wooden pallet against the wall.
    const p = dock.geom.pallet;
    const g = new Graphics();
    const l = p.x - PALLET.w / 2;
    const t = p.y - PALLET.d / 2;
    g.rect(l + 3, t + 5, PALLET.w, PALLET.d).fill({ color: 0x000000, alpha: 0.16 });
    g.rect(l, t - PALLET.h, PALLET.w, PALLET.d).fill(0xc08a4e);
    for (let k = 0; k < 4; k++) g.rect(l, t - PALLET.h + 2 + k * 10, PALLET.w, 6).fill(0xd9a066);
    g.rect(l, t + PALLET.d - PALLET.h, PALLET.w, PALLET.h).fill(0x8b5a2b);
    for (const bx of [l + 2, l + PALLET.w / 2 - 4, l + PALLET.w - 10]) g.rect(bx, t + PALLET.d - PALLET.h + 1, 8, PALLET.h - 2).fill(0x5b3a1b);
    g.rect(l, t - PALLET.h, PALLET.w, PALLET.d + PALLET.h).stroke({ width: 1.2, color: INK, alpha: 0.3 });
    this.palletNode.addChild(g, this.badge);
    this.badgeIcon = new Sprite(atlas.get('icon_van2'));
    this.badgeIcon.scale.set(0.36);
    this.palletNode.addChild(this.badgeIcon);
    this.palletNode.zIndex = p.y + PALLET.d / 2;
  }

  /** Where parcels fly to when loaded (the open rear doors). */
  get doorPoint(): { x: number; y: number } {
    return { x: this.dock.geom.bay.x - VAN.w / 2 + 6, y: this.dock.geom.bay.y };
  }

  /** Footprint centre and height of a parcel on the pallet (2 × 2 per layer). */
  palletSlot(i: number): { x: number; y: number; z: number } {
    const p = this.dock.geom.pallet;
    const layer = Math.floor(i / 4);
    const k = i % 4;
    return {
      x: p.x + (k % 2 === 0 ? -12 : 12),
      y: p.y + (k < 2 ? -7 : 7) - layer * 0.5,
      z: PALLET.h + layer * (PARCEL.h + 0.5),
    };
  }

  get palletZ(): number {
    return this.palletNode.zIndex;
  }

  /** A parcel entered the van at the bay. */
  kick(): void {
    for (let i = 0; i < this.vans.length; i++) if (this.dock.vans[i]!.state === 'loading') this.vans[i]!.kick();
  }

  update(dt: number, puff: (x: number, y: number) => void, onEvent: (ev: VanEvent) => void): void {
    const d = this.dock;
    this.node.visible = d.built;
    this.palletNode.visible = d.built;
    this.shutter.visible = !d.built;
    if (!d.built) return;
    while (this.vans.length < d.vans.length) {
      const v = new VanView(this.atlas, d.district, d.vans[this.vans.length]!, d.geom.bay);
      this.node.addChildAt(v.node, 0);
      this.vans.push(v);
    }
    let doorsAt: number | null = null;
    for (const v of this.vans) {
      const ev = v.update(dt, puff);
      if (ev) onEvent(ev);
    }
    const loading = d.loadingVan();
    if (loading) doorsAt = this.vans[d.vans.indexOf(loading)]!.x;
    this.doors.visible = doorsAt !== null;
    if (doorsAt !== null) this.doors.position.set(doorsAt, d.geom.bay.y);

    const load = loading ? loading.items.length : -1;
    this.loadText.visible = this.bar.visible = !!loading;
    if (loading && (load !== this.lastLoad || d.capacity !== this.lastCap)) {
      this.lastLoad = load;
      this.lastCap = d.capacity;
      const bx = d.geom.bay.x - 40;
      const by = d.geom.bay.y - VAN.d / 2 - VAN.h - 26;
      setText(this.loadText, `${load}/${d.capacity}`);
      this.loadText.position.set(bx, by - 16);
      const w = 70;
      this.bar.clear();
      this.bar.roundRect(bx - w / 2, by - 4, w, 9, 4).fill({ color: 0x1f2937, alpha: 0.85 });
      this.bar.roundRect(bx - w / 2 + 1.5, by - 2.5, Math.max(0, (w - 3) * (load / d.capacity)), 6, 3).fill(DISTRICT_COLORS[d.district]!);
    }

    // "Van on its way back" badge over the pallet while the bay is empty.
    if (this.badgeDrawn) this.badge.clear();
    this.badgeDrawn = false;
    const atBay = d.bayVan();
    let eta = Infinity;
    for (const v of d.vans) {
      if (v.state === 'away') eta = Math.min(eta, v.t + VAN_ARRIVE_TIME);
      else if (v.state === 'leaving') eta = Math.min(eta, v.t + VAN_AWAY_TIME + VAN_ARRIVE_TIME);
    }
    const show = (!atBay || atBay.state === 'leaving') && eta < Infinity;
    this.badgeIcon.visible = show;
    if (show) {
      this.badgeDrawn = true;
      const p = d.geom.pallet;
      const bx = p.x;
      const by = p.y - PALLET.d / 2 - 44 - Math.min(6, d.pallet.length) * 4;
      const k = 1 - Math.min(1, eta / (VAN_LEAVE_TIME + VAN_AWAY_TIME + VAN_ARRIVE_TIME));
      this.badge.circle(bx, by, 17).fill({ color: WHITE, alpha: 0.95 }).stroke({ width: 2, color: INK, alpha: 0.35 });
      this.badge
        .moveTo(bx, by - 17)
        .arc(bx, by, 17, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2)
        .stroke({ width: 4, color: DISTRICT_COLORS[d.district]! });
      this.badgeIcon.position.set(bx, by);
    }
  }
}
