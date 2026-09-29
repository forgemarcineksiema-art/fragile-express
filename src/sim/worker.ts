// Worker AI: a state machine driving a Carrier along the waypoint graph.
//   sorter:    belt -> shelf of the parcel's colour
//   loader:    shelf -> van of the same district
//   collector: coin pile -> cash desk
import { dist2, type Vec } from '../core/math.ts';
import type { Carrier } from './carrier.ts';
import { WORKER_FRAGILE_SPEED_FACTOR } from './economy.ts';
import type { Belt, CoinPile, Dock, Shelf } from './stations.ts';
import type { WorkerRole } from './types.ts';
import type { Warehouse } from './warehouse.ts';

type State = 'idle' | 'walk' | 'work' | 'wait';

type Job =
  | { kind: 'belt'; belt: Belt }
  | { kind: 'shelfIn'; shelf: Shelf }
  | { kind: 'shelfOut'; shelf: Shelf; want: number }
  | { kind: 'dock'; dock: Dock }
  | { kind: 'pile'; pile: CoinPile }
  | { kind: 'safe' }
  | { kind: 'rest'; at: Vec };

const ARRIVE = 7;

export class Worker {
  readonly carrier: Carrier;
  readonly role: WorkerRole;
  state: State = 'idle';
  job: Job | null = null;
  path: Vec[] = [];
  /** Time spent in the current work step without progress. */
  stall = 0;
  /** Countdown before re-thinking while idle. */
  think = 0;
  /** Temporary helper past its time: finishes the current delivery, then leaves. */
  retiring = false;
  /** Per-worker offset inside zones so workers do not stand on each other. */
  readonly jitter: Vec;

  constructor(carrier: Carrier, role: WorkerRole, jitter: Vec) {
    this.carrier = carrier;
    this.role = role;
    this.jitter = jitter;
  }

  /** Jobs the other workers are heading to or working at (used to spread loaders out). */
  static claimed(wh: Warehouse, self: Worker, kind: Job['kind']): Set<unknown> {
    const out = new Set<unknown>();
    for (const w of wh.workers) {
      if (w === self || !w.job || w.job.kind !== kind) continue;
      const j = w.job;
      if (j.kind === 'shelfOut' || j.kind === 'shelfIn') out.add(j.shelf);
      else if (j.kind === 'dock') out.add(j.dock);
      else if (j.kind === 'pile') out.add(j.pile);
      else if (j.kind === 'belt') out.add(j.belt);
    }
    return out;
  }

  update(dt: number, wh: Warehouse): void {
    const c = this.carrier;
    c.moveX = 0;
    c.moveY = 0;
    // Workers never break parcels: they switch to careful walk while holding fragile ones.
    c.careful = c.hasFragile();

    if (this.state === 'idle' || this.state === 'wait') {
      this.think -= dt;
      if (this.think <= 0) this.plan(wh);
      const now = this.state as State; // plan() may have changed it
      if (now !== 'walk' && now !== 'work') return;
    }
    if (this.state === 'walk') {
      this.walk(wh);
      return;
    }
    if (this.state === 'work') this.work(dt, wh);
  }

  private go(wh: Warehouse, job: Job): void {
    this.job = job;
    const t = this.standPoint(job);
    this.path = wh.nav.path(this.carrier.x, this.carrier.y, t.x, t.y);
    this.state = 'walk';
    this.stall = 0;
  }

  private idle(delay = 0.4): void {
    this.state = 'idle';
    this.job = null;
    this.think = delay;
  }

  private standPoint(job: Job): Vec {
    const j = this.jitter;
    switch (job.kind) {
      case 'belt':
        return { x: job.belt.geom.stand.x + j.x * 0.6, y: job.belt.geom.stand.y + j.y };
      case 'shelfIn':
        return { x: job.shelf.geom.inStand.x + j.x * 0.4, y: job.shelf.geom.inStand.y + j.y };
      case 'shelfOut':
        return { x: job.shelf.geom.outStand.x + j.x * 0.4, y: job.shelf.geom.outStand.y + j.y };
      case 'dock':
        return { x: job.dock.geom.stand.x + j.x * 0.5, y: job.dock.geom.stand.y + j.y };
      case 'pile':
        return { x: job.pile.x, y: job.pile.y };
      case 'safe':
        return { x: this.whSafe.x + j.x, y: this.whSafe.y + j.y * 0.4 };
      case 'rest':
        return { x: job.at.x + j.x, y: job.at.y + j.y };
    }
  }

  /** Cash desk stand point, set by the warehouse when the worker is created. */
  whSafe: Vec = { x: 0, y: 0 };

  private walk(wh: Warehouse): void {
    const c = this.carrier;
    const next = this.path[0];
    if (!next) {
      this.state = 'work';
      this.stall = 0;
      return;
    }
    const dx = next.x - c.x;
    const dy = next.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d <= ARRIVE) {
      this.path.shift();
      if (this.path.length === 0) {
        this.state = 'work';
        this.stall = 0;
        // Re-validate the job on arrival; the world may have changed while walking.
        if (this.job?.kind === 'rest') this.idle(0.5);
      }
      return;
    }
    // Scale the last few units so the worker does not overshoot the stand point.
    const step = c.speed * (c.careful ? WORKER_FRAGILE_SPEED_FACTOR : 1) * wh.dt;
    const k = d < step ? d / step : 1;
    c.moveX = (dx / d) * k;
    c.moveY = (dy / d) * k;
  }

  private work(dt: number, wh: Warehouse): void {
    const c = this.carrier;
    const job = this.job;
    if (!job) {
      this.idle();
      return;
    }
    this.stall += dt;
    switch (job.kind) {
      case 'belt': {
        // Carry an XXL parcel alone; otherwise fill up, leaving early if the belt runs dry.
        if (wh.pickFromBelt(c, job.belt)) this.stall = 0;
        const done = c.isFull() || c.hasXXL() || (c.stack.length > 0 && this.stall > 1.2);
        const front = job.belt.front();
        const blocked = front !== null && !c.canTake(front) && c.stack.length > 0;
        if (done || blocked) this.afterPick(wh);
        else if (c.stack.length === 0 && this.stall > 2.5) this.plan(wh);
        return;
      }
      case 'shelfIn': {
        if (wh.dropOnShelf(c, job.shelf)) {
          this.stall = 0;
          return;
        }
        const left = c.count((p) => !p.sorted && p.district === job.shelf.district);
        if (left === 0) this.afterPick(wh);
        else if (this.stall > 3) this.afterPick(wh, job.shelf); // shelf full: try other colours first
        return;
      }
      case 'shelfOut': {
        const have = c.count((p) => p.sorted && p.district === job.shelf.district);
        if (have < job.want && wh.pickFromShelf(c, job.shelf)) {
          this.stall = 0;
          return;
        }
        const enough = have >= job.want || c.isFull();
        if (enough || (have > 0 && this.stall > 0.6) || (have === 0 && this.stall > 1.5)) {
          if (have > 0) this.go(wh, { kind: 'dock', dock: wh.docks[job.shelf.district]! });
          else this.idle(0.3);
        }
        return;
      }
      case 'dock': {
        if (wh.dropInVan(c, job.dock)) {
          this.stall = 0;
          return;
        }
        const left = c.count((p) => p.sorted && p.district === job.dock.district);
        if (left === 0) this.idle(0.1);
        // Van away: keep waiting at the dock; the parcels have nowhere else to go.
        return;
      }
      case 'pile': {
        if (wh.collectPile(c, job.pile)) this.stall = 0;
        if (c.coins >= c.coinCap || job.pile.value <= 0 || this.stall > 0.5) {
          if (c.coins > 0) this.go(wh, { kind: 'safe' });
          else this.idle(0.3);
        }
        return;
      }
      case 'safe': {
        wh.depositCoins(c);
        this.idle(0.2);
        return;
      }
      case 'rest':
        this.idle(0.5);
        return;
    }
  }

  /** After picking from the belt: head for the shelf of the top unsorted parcel. */
  private afterPick(wh: Warehouse, skip?: Shelf): void {
    const c = this.carrier;
    const candidates = new Map<number, number>();
    for (const p of c.stack) if (!p.sorted) candidates.set(p.district, (candidates.get(p.district) ?? 0) + 1);
    let best: Shelf | null = null;
    let bestD = Infinity;
    for (const d of candidates.keys()) {
      const s = wh.shelves[d]!;
      if (!s.built || s === skip || s.isFull()) continue;
      const dd = dist2(c.x, c.y, s.geom.inStand.x, s.geom.inStand.y);
      if (dd < bestD) {
        bestD = dd;
        best = s;
      }
    }
    if (!best && skip && candidates.has(skip.district)) best = skip;
    if (best) this.go(wh, { kind: 'shelfIn', shelf: best });
    else if (c.stack.length === 0) this.idle(0.1);
    else {
      // Every target shelf is full: wait by the first one.
      const first = wh.shelves[[...candidates.keys()][0]!]!;
      this.go(wh, { kind: 'shelfIn', shelf: first });
    }
  }

  private plan(wh: Warehouse): void {
    this.think = 0.4;
    const c = this.carrier;
    if (this.retiring && c.stack.length === 0 && c.coins === 0) {
      this.state = 'idle';
      this.job = null;
      return;
    }
    if (this.role === 'sorter') this.planSorter(wh);
    else if (this.role === 'loader') this.planLoader(wh);
    else this.planCollector(wh);
  }

  private planSorter(wh: Warehouse): void {
    const c = this.carrier;
    if (c.count((p) => !p.sorted) > 0) {
      this.afterPick(wh);
      return;
    }
    // Nearest belt that has parcels; with one belt this is simply the belt.
    let best: Belt | null = null;
    let bestScore = Infinity;
    const claimed = Worker.claimed(wh, this, 'belt');
    for (const b of wh.belts) {
      const d = Math.sqrt(dist2(c.x, c.y, b.geom.stand.x, b.geom.stand.y));
      const score = d - b.items.length * 40 + (claimed.has(b) ? 150 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (best) this.go(wh, { kind: 'belt', belt: best });
  }

  private planLoader(wh: Warehouse): void {
    const c = this.carrier;
    const sortedLeft = c.topIndex((p) => p.sorted);
    if (sortedLeft >= 0) {
      this.go(wh, { kind: 'dock', dock: wh.docks[c.stack[sortedLeft]!.district]! });
      return;
    }
    const claimed = Worker.claimed(wh, this, 'shelfOut');
    let best: Shelf | null = null;
    let bestScore = -Infinity;
    for (const s of wh.shelves) {
      if (!s.built || s.items.length === 0) continue;
      const dock = wh.docks[s.district]!;
      const room = dock.dropRoom();
      if (room <= 0) continue;
      const d = Math.sqrt(dist2(c.x, c.y, s.geom.outStand.x, s.geom.outStand.y));
      const score = Math.min(s.items.length, room) * 60 - d * 0.25 - (claimed.has(s) ? 400 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best) {
      const dock = wh.docks[best.district]!;
      const want = Math.max(1, Math.min(c.capacity, dock.dropRoom()));
      this.go(wh, { kind: 'shelfOut', shelf: best, want });
      return;
    }
    this.restNear(wh);
  }

  private planCollector(wh: Warehouse): void {
    const c = this.carrier;
    if (c.coins >= c.coinCap && c.coins > 0) {
      this.go(wh, { kind: 'safe' });
      return;
    }
    const claimed = Worker.claimed(wh, this, 'pile');
    let best: CoinPile | null = null;
    let bestScore = 0;
    for (const p of wh.piles) {
      if (p.value <= 0) continue;
      const score = p.value - (claimed.has(p) ? 1e9 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) this.go(wh, { kind: 'pile', pile: best });
    else if (c.coins > 0) this.go(wh, { kind: 'safe' });
    else this.restNear(wh);
  }

  /** Nothing to do: wait at a sensible spot instead of freezing mid-floor. */
  private restNear(wh: Warehouse): void {
    const c = this.carrier;
    let at: Vec;
    if (this.role === 'loader') {
      const built = wh.shelves.filter((s) => s.built);
      const s = built[Math.abs(this.carrier.id) % built.length]!;
      at = { x: s.geom.outStand.x + 30, y: s.geom.outStand.y };
    } else if (this.role === 'collector') {
      at = { x: this.whSafe.x, y: this.whSafe.y + 30 };
    } else {
      at = wh.belts[0]!.geom.stand;
    }
    if (dist2(c.x, c.y, at.x + this.jitter.x, at.y + this.jitter.y) > 40 * 40) this.go(wh, { kind: 'rest', at });
    else {
      this.state = 'wait';
      this.job = null;
      this.think = 0.5;
    }
  }
}
