// Life on the car parks: now and then a car drives in along the aisle, turns and parks in a free
// space; parked cars later reverse (or drive) out and leave the way they came. Visual only.
import { Container, Graphics } from 'pixi.js';
import { CAR, CAR_COLORS, carContext } from '../art-outdoor.ts';

type Facing = 'E' | 'W' | 'N' | 'S';
type View = 'side' | 'nose' | 'tail';

interface Space {
  x: number;
  y: number;
  taken: boolean;
}

export interface Lot {
  spaces: Space[];
  /** y of the aisle the spaces open onto. */
  aisle: number;
  /** -1: the aisle is north of the spaces, +1: south of them. */
  side: -1 | 1;
  /** Off-screen x where cars come from and go to (east). */
  exitX: number;
}

interface Waypoint {
  x: number;
  y: number;
  face: Facing;
  speed: number;
}

interface Car {
  node: Container;
  views: Record<View, Graphics>;
  x: number;
  y: number;
  face: Facing;
  prev: Facing | null;
  fade: number;
  v: number;
  lot: Lot;
  space: Space;
  path: Waypoint[];
  /** Seconds left parked (driving cars ignore it). */
  wait: number;
  leaving: boolean;
}

const viewOf = (f: Facing): View => (f === 'E' || f === 'W' ? 'side' : f === 'S' ? 'nose' : 'tail');
/** Direction a car faces when it has driven nose-first into a space of this lot. */
const inward = (lot: Lot): Facing => (lot.side < 0 ? 'S' : 'N');

export class Parking {
  readonly lots: Lot[] = [];
  private readonly cars: Car[] = [];
  private readonly initial: { lot: Lot; space: Space; face: Facing; color: number }[] = [];
  private layer: Container | null = null;
  private timer = 2;
  private tint = 0xffffff;

  addLot(aisle: number, side: -1 | 1, exitX: number): Lot {
    const lot: Lot = { spaces: [], aisle, side, exitX };
    this.lots.push(lot);
    return lot;
  }

  /** Adds a space; `parked` puts a car in it from the start ('nose' faces south, 'tail' north). */
  addSpace(lot: Lot, x: number, y: number, parked: 'nose' | 'tail' | null, color: number): void {
    const space: Space = { x, y, taken: parked !== null };
    lot.spaces.push(space);
    if (parked) this.initial.push({ lot, space, face: parked === 'nose' ? 'S' : 'N', color });
  }

  attach(layer: Container): void {
    this.layer = layer;
    for (const c of this.initial) {
      const car = this.makeCar(c.lot, c.space, c.color, c.space.x, c.space.y, c.face);
      car.wait = 8 + Math.random() * 110;
    }
    this.initial.length = 0;
  }

  setTint(t: number): void {
    this.tint = t;
    for (const c of this.cars) c.node.tint = t;
  }

  private makeCar(lot: Lot, space: Space, color: number, x: number, y: number, face: Facing): Car {
    const node = new Container();
    const views = {
      side: new Graphics(carContext('side', color)),
      nose: new Graphics(carContext('nose', color)),
      tail: new Graphics(carContext('tail', color)),
    };
    node.addChild(views.side, views.nose, views.tail);
    node.tint = this.tint;
    this.layer!.addChild(node);
    const car: Car = { node, views, x, y, face, prev: null, fade: 1, v: 0, lot, space, path: [], wait: 0, leaving: false };
    this.cars.push(car);
    this.render(car);
    return car;
  }

  /** Cars with their lights on the move, for headlight beams. */
  headlights(out: { x: number; y: number; vertical: boolean }[]): void {
    for (const c of this.cars) {
      if (c.path.length === 0) continue;
      switch (c.face) {
        case 'E':
          out.push({ x: c.x + 100, y: c.y + 8, vertical: false });
          break;
        case 'W':
          out.push({ x: c.x - 100, y: c.y + 8, vertical: false });
          break;
        case 'S':
          out.push({ x: c.x, y: c.y + 82, vertical: true });
          break;
        case 'N':
          out.push({ x: c.x, y: c.y - 88, vertical: true });
          break;
      }
    }
  }

  private arrive(lot: Lot): boolean {
    const free = lot.spaces.filter((s) => !s.taken);
    if (free.length === 0) return false;
    const space = free[Math.floor(Math.random() * free.length)]!;
    space.taken = true;
    const car = this.makeCar(lot, space, CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]!, lot.exitX, lot.aisle, 'W');
    const into = inward(lot);
    car.path = [
      { x: space.x + 30, y: lot.aisle, face: 'W', speed: 115 },
      { x: space.x, y: lot.aisle - lot.side * 16, face: into, speed: 38 },
      { x: space.x, y: space.y, face: into, speed: 42 },
    ];
    car.v = 115;
    return true;
  }

  private leave(car: Car): void {
    const lot = car.lot;
    const out = lot.aisle - lot.side * 16;
    car.leaving = true;
    // Nose-in cars reverse out keeping their facing; cars that backed in drive straight out.
    car.path = [
      { x: car.space.x, y: out, face: car.face, speed: car.face === inward(lot) ? 30 : 40 },
      { x: car.space.x + 30, y: lot.aisle, face: 'E', speed: 45 },
      { x: lot.exitX, y: lot.aisle, face: 'E', speed: 125 },
    ];
    car.space.taken = false;
  }

  update(dt: number): void {
    if (!this.layer || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.timer -= dt;
    if (this.timer <= 0 && this.lots.length) {
      this.timer = 3.5 + Math.random() * 6;
      const lot = this.lots[Math.floor(Math.random() * this.lots.length)]!;
      // One manoeuvre per lot at a time keeps the aisle clear.
      if (!this.cars.some((c) => c.lot === lot && c.path.length > 0)) {
        const ready = this.cars.filter((c) => c.lot === lot && c.path.length === 0 && !c.leaving && c.wait <= 0);
        const free = lot.spaces.filter((s) => !s.taken).length;
        const leaveFirst = ready.length > 0 && (free === 0 || Math.random() < 0.5);
        if (leaveFirst) this.leave(ready[Math.floor(Math.random() * ready.length)]!);
        else if (!this.arrive(lot) && ready.length) this.leave(ready[0]!);
      }
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i]!;
      if (c.path.length === 0) {
        c.wait -= dt;
        continue;
      }
      const wp = c.path[0]!;
      if (wp.face !== c.face) {
        c.prev = c.face;
        c.face = wp.face;
        c.fade = 0;
      }
      const dx = wp.x - c.x;
      const dy = wp.y - c.y;
      const d = Math.hypot(dx, dy);
      // Brake into every waypoint: cars slow for turns and stop in the space.
      const want = Math.min(wp.speed, Math.sqrt(2 * 160 * d) + 8);
      c.v += Math.max(-320 * dt, Math.min(160 * dt, want - c.v));
      const step = Math.min(d, Math.max(0, c.v) * dt);
      if (d > 1e-3) {
        c.x += (dx / d) * step;
        c.y += (dy / d) * step;
      }
      if (d - step < 0.4) {
        c.path.shift();
        if (c.path.length === 0) {
          c.v = 0;
          if (c.leaving) {
            c.node.destroy({ children: true });
            this.cars.splice(i, 1);
            continue;
          }
          c.wait = 30 + Math.random() * 120;
        }
      }
      c.fade = Math.min(1, c.fade + dt / 0.28);
      this.render(c);
    }
  }

  private render(c: Car): void {
    const cur = viewOf(c.face);
    for (const k of ['side', 'nose', 'tail'] as View[]) c.views[k].visible = false;
    const v = c.views[cur];
    v.visible = true;
    v.alpha = c.fade;
    if (cur === 'side') v.scale.x = c.face === 'W' ? -1 : 1;
    if (c.prev && c.fade < 1) {
      const pv = viewOf(c.prev);
      if (pv !== cur) {
        const p = c.views[pv];
        p.visible = true;
        p.alpha = 1 - c.fade;
        if (pv === 'side') p.scale.x = c.prev === 'W' ? -1 : 1;
      }
    }
    c.node.position.set(c.x, c.y);
    c.node.zIndex = c.y + (cur === 'side' ? CAR.wid / 2 : CAR.len / 2);
  }
}
