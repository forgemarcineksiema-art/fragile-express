// Stations: belt, shelf, van dock, coin pile, buy pad and rewarded floor zone.
import { rect, type Rect } from '../core/math.ts';
import { VAN_ARRIVE_TIME, VAN_AWAY_TIME, VAN_LEAVE_TIME } from './economy.ts';
import { AD_PAD_SIZE, PAD_SIZE, type BeltGeom, type DockGeom, type PadJson, type ShelfGeom } from './layout.ts';
import type { AdKind, AdSize, Parcel, CourierOrder } from './types.ts';

/** Gap between parcel centres on the belt. */
export const BELT_SPACING = 30;
/** How far from the belt end the front parcel stops. */
export const BELT_END_GAP = 14;

export interface BeltItem {
  p: Parcel;
  /** Distance travelled from the belt start. */
  s: number;
}

export class Belt {
  readonly index: number;
  readonly geom: BeltGeom;
  readonly baseInterval: number;
  readonly speed: number;
  readonly maxItems: number;
  /** Front (closest to the end) first. */
  items: BeltItem[] = [];
  spawnT = 0.4;
  /** Kind and district of the parcel that comes out of the truck next. */
  next: { kind: import('./types.ts').ParcelKind; district: number } | null = null;

  constructor(index: number, geom: BeltGeom, baseInterval: number, speed: number, maxItems: number) {
    this.index = index;
    this.geom = geom;
    this.baseInterval = baseInterval;
    this.speed = speed;
    this.maxItems = maxItems;
  }

  get endS(): number {
    return this.geom.length - BELT_END_GAP;
  }

  /** The parcel waiting at the end of the belt, if any. */
  front(): Parcel | null {
    const f = this.items[0];
    return f && f.s >= this.endS - 1 ? f.p : null;
  }

  canSpawn(): boolean {
    if (this.items.length >= this.maxItems) return false;
    const last = this.items[this.items.length - 1];
    return !last || last.s >= BELT_SPACING;
  }

  /** Adds a parcel at the start of the belt. */
  push(p: Parcel): void {
    this.items.push({ p, s: 0 });
  }

  /** Places a parcel directly into the queue at the end (fresh-start preload). */
  preload(p: Parcel): void {
    const s = this.items.length === 0 ? this.endS : this.items[this.items.length - 1]!.s - BELT_SPACING;
    this.items.push({ p, s: Math.max(0, s) });
  }

  take(): Parcel | null {
    const p = this.front();
    if (p) this.items.shift();
    return p;
  }

  move(dt: number): void {
    let limit = this.endS;
    for (const it of this.items) {
      it.s = Math.min(it.s + this.speed * dt, limit);
      limit = it.s - BELT_SPACING;
    }
  }
}

export class Shelf {
  readonly district: number;
  readonly geom: ShelfGeom;
  readonly capacity: number;
  items: Parcel[] = [];
  built = false;

  constructor(district: number, geom: ShelfGeom, capacity: number) {
    this.district = district;
    this.geom = geom;
    this.capacity = capacity;
  }

  get id(): string {
    return `shelf${this.district}`;
  }

  isFull(): boolean {
    return this.items.length >= this.capacity;
  }
}

export type VanState = 'waiting' | 'arriving' | 'loading' | 'leaving' | 'away';

export class Van {
  readonly id: number;
  state: VanState;
  /** Time left in the current state. */
  t = 0;
  items: Parcel[] = [];

  constructor(id: number, state: VanState) {
    this.id = id;
    this.state = state;
  }
}

export class Dock {
  readonly district: number;
  readonly geom: DockGeom;
  vans: Van[] = [];
  built = false;
  capacity = 8;
  /** Parcels dropped while no van is loading wait here and load themselves when a van arrives. */
  pallet: Parcel[] = [];
  /** Countdown to the next pallet → van transfer. */
  palletT = 0;

  constructor(district: number, geom: DockGeom) {
    this.district = district;
    this.geom = geom;
    this.vans.push(new Van(0, 'loading'));
  }

  get id(): string {
    return `dock${this.district}`;
  }

  /** The van at the bay (arriving, loading or leaving). */
  bayVan(): Van | null {
    for (const v of this.vans) if (v.state === 'arriving' || v.state === 'loading' || v.state === 'leaving') return v;
    return null;
  }

  /** The van that accepts parcels right now. */
  loadingVan(): Van | null {
    for (const v of this.vans) if (v.state === 'loading') return v;
    return null;
  }

  room(): number {
    const v = this.loadingVan();
    return v ? Math.max(0, this.capacity - v.items.length) : 0;
  }

  /** The pallet holds one van load. */
  palletRoom(): number {
    return Math.max(0, this.capacity - this.pallet.length);
  }

  /** Room for parcels right now: the van if it is loading, otherwise the pallet. */
  dropRoom(): number {
    return this.room() + this.palletRoom();
  }

  addVan(): void {
    this.vans.push(new Van(this.vans.length, this.bayVan() ? 'waiting' : 'arriving'));
    const v = this.vans[this.vans.length - 1]!;
    if (v.state === 'arriving') v.t = VAN_ARRIVE_TIME;
  }

  /** Advances van timers. Returns the van that has to depart this step (full), if any. */
  update(dt: number): { departed: Van | null; arrived: boolean } {
    let departed: Van | null = null;
    let arrived = false;
    for (const v of this.vans) {
      if (v.state === 'loading' && v.items.length >= this.capacity) {
        v.state = 'leaving';
        v.t = VAN_LEAVE_TIME;
        departed = v;
        continue;
      }
      if (v.state === 'loading' || v.state === 'waiting') continue;
      v.t -= dt;
      if (v.t > 0) continue;
      if (v.state === 'leaving') {
        v.state = 'away';
        v.t = VAN_AWAY_TIME;
      } else if (v.state === 'away') {
        v.state = 'waiting';
      } else if (v.state === 'arriving') {
        v.state = 'loading';
        arrived = true;
      }
    }
    // A free bay pulls in the next waiting van.
    if (!this.bayVan()) {
      const next = this.vans.find((v) => v.state === 'waiting');
      if (next) {
        next.state = 'arriving';
        next.t = VAN_ARRIVE_TIME;
      }
    }
    return { departed, arrived };
  }
}

export class CoinPile {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  value = 0;

  constructor(id: string, x: number, y: number, r: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.r = r;
  }
}

export class Pad {
  readonly def: PadJson;
  readonly x: number;
  readonly y: number;
  readonly zone: Rect;
  paid = 0;
  visible = false;
  /** Set once the pad has been shown; used to announce newly visible pads. */
  shown = false;
  standT = 0;

  constructor(def: PadJson, x: number, y: number) {
    this.def = def;
    this.x = x;
    this.y = y;
    this.zone = rect(x - PAD_SIZE / 2, y - PAD_SIZE / 2, PAD_SIZE, PAD_SIZE);
  }

  get id(): string {
    return this.def.id;
  }
}

export class AdPad {
  readonly id: string;
  readonly kind: AdKind;
  readonly size: AdSize;
  readonly x: number;
  readonly y: number;
  readonly zone: Rect;
  /** Sim time when the zone disappears if unused. */
  expiresAt: number;
  /** Buy pad this zone completes (assist only). */
  readonly target: string | null;
  standT = 0;
  /** After an ad the player must step out before the zone can trigger again. */
  armed = true;
  pending = false;
  /** Coins a cash parcel gives. */
  amount = 0;

  constructor(id: string, kind: AdKind, size: AdSize, x: number, y: number, expiresAt: number, target: string | null) {
    this.id = id;
    this.kind = kind;
    this.size = size;
    this.x = x;
    this.y = y;
    this.expiresAt = expiresAt;
    this.target = target;
    this.zone = rect(x - AD_PAD_SIZE / 2, y - AD_PAD_SIZE / 2, AD_PAD_SIZE, AD_PAD_SIZE);
  }
}

/** The courier who comes in through the front door to pick up an order from the player. */
export class Courier {
  state: 'away' | 'arriving' | 'waiting' | 'leaving' = 'away';
  /** Seconds left of the walk in or out. */
  t = 0;
  order: CourierOrder | null = null;
  /** Sim time of the next order (0 = not scheduled yet). */
  nextAt = 0;
  /** Parcels he has been given (carried out when he leaves). */
  parcels: Parcel[] = [];

  get present(): boolean {
    return this.state !== 'away';
  }
}
