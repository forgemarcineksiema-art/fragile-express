// Carrier: anything that walks around with a stack of parcels (the player and every worker).
import type { Parcel, Role } from './types.ts';

export class Carrier {
  readonly id: number;
  readonly role: Role;
  x: number;
  y: number;
  /** Position at the previous step, for render interpolation. */
  px: number;
  py: number;
  dirX = 0;
  dirY = 1;
  /** Desired movement this step (length 0..1). */
  moveX = 0;
  moveY = 0;
  /** Current velocity (world units per second); eases toward the desired one. */
  vx = 0;
  vy = 0;
  /** Careful walk: half speed, never wobbles. */
  careful = false;
  /** Full (running) speed in world units per second. */
  speed = 100;
  capacity = 1;
  stability = 0;
  radius: number;
  stack: Parcel[] = [];
  /** Coins carried (coin collector). */
  coins = 0;
  coinCap = 0;
  wobble = 0;
  /** How long the carrier has been running without a break. */
  runTime = 0;
  moving = false;
  running = false;
  /** Cooldown until the next single-parcel transfer. */
  transferT = 0;
  /** Distance walked, drives the walk animation. */
  walked = 0;
  /** Temporary helper hired through a rewarded ad; 0 for permanent. */
  expiresAt = 0;

  constructor(id: number, role: Role, x: number, y: number, radius: number) {
    this.id = id;
    this.role = role;
    this.x = this.px = x;
    this.y = this.py = y;
    this.radius = radius;
  }

  hasFragile(): boolean {
    for (const p of this.stack) if (p.kind === 'fragile') return true;
    return false;
  }

  hasXXL(): boolean {
    for (const p of this.stack) if (p.kind === 'xxl') return true;
    return false;
  }

  /** Whether one more parcel of this kind fits. An XXL parcel is carried alone. */
  canTake(p: Parcel): boolean {
    if (this.stack.length === 0) return true;
    if (p.kind === 'xxl' || this.hasXXL()) return false;
    return this.stack.length < this.capacity;
  }

  /** Room left for ordinary parcels. */
  room(): number {
    if (this.hasXXL()) return 0;
    return Math.max(0, this.capacity - this.stack.length);
  }

  isFull(): boolean {
    return this.room() === 0;
  }

  /** Index of the top-most parcel matching the predicate, or -1. */
  topIndex(pred: (p: Parcel) => boolean): number {
    for (let i = this.stack.length - 1; i >= 0; i--) if (pred(this.stack[i]!)) return i;
    return -1;
  }

  count(pred: (p: Parcel) => boolean): number {
    let n = 0;
    for (const p of this.stack) if (pred(p)) n++;
    return n;
  }
}
