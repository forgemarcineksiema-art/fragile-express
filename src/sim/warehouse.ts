// Warehouse: the whole simulation of one location. Pure TypeScript with a fixed step; the renderer,
// the pacing simulator and the offline-earnings estimate all drive this same class.
import { dist2, inRect, pushCircleOutOfRect, rectsOverlap, type Rect, type Vec } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import { Carrier } from './carrier.ts';
import {
  AD_PAD_HOLD,
  AD_SPOT_LIFETIME,
  AD_SPOT_PERIOD,
  ASSIST_LIFETIME,
  ASSIST_MAX_MISSING,
  CAREFUL_SPEED_FACTOR,
  FRAGILE,
  HELPER_DURATION,
  PAD_DELAY,
  PAD_FILL_TIME,
  PLAYER_RADIUS,
  PLAYER_TRANSFER_INTERVAL,
  STATS,
  TURBO_DURATION,
  TURBO_MULT,
  WORKER_FRAGILE_SPEED_FACTOR,
  WORKER_TRANSFER_INTERVAL,
  beltInterval,
  collectorTrip,
  levelCost,
  payout,
  playerCapacity,
  playerSpeed,
  vanCapacity,
  workerCapacity,
  workerSpeed,
  type StatKey,
} from './economy.ts';
import { AD_PAD_SIZE, PAD_SIZE, buildLayout, padPosition, type Layout, type LocationJson, type PadJson } from './layout.ts';
import { NavGraph } from './nav.ts';
import type { LocationSave } from './save.ts';
import { AdPad, Belt, CoinPile, Dock, Pad, Shelf } from './stations.ts';
import type { AdKind, Parcel, ParcelKind, SimEvent, WorkerRole } from './types.ts';
import { Worker } from './worker.ts';

export interface WarehouseOptions {
  seed?: number;
  /** No player on the floor (offline estimate, automation benchmarks). */
  noPlayer?: boolean;
  /** Never spawn rewarded floor zones (headless runs). */
  noAds?: boolean;
}

export interface MoveInput {
  x: number;
  y: number;
  careful: boolean;
}

const DEFAULT_C0: Record<Exclude<PadJson['type'], 'upgrade' | 'move'>, number> = {
  district: 100,
  hire: 120,
  van2: 120,
};

export class Warehouse {
  readonly loc: LocationJson;
  readonly layout: Layout;
  readonly rng: Rng;
  readonly opts: WarehouseOptions;
  /** Length of the current step. */
  dt = 1 / 60;
  time = 0;
  /** Time spent in this location, persisted (drives fragile unlock and ad-zone timing). */
  locTime = 0;
  coins = 0;
  levels: Record<string, number> = {};

  readonly belts: Belt[];
  readonly shelves: Shelf[];
  readonly docks: Dock[];
  readonly piles: CoinPile[];
  readonly pads: Pad[];
  adPads: AdPad[] = [];
  readonly player: Carrier;
  workers: Worker[] = [];
  readonly parcels = new Map<number, Parcel>();
  events: SimEvent[] = [];
  input: MoveInput = { x: 0, y: 0, careful: false };
  readonly nav: NavGraph;
  /** Player collision rectangles (only what is built). */
  solids: Rect[] = [];

  fragileActive = false;
  private forceFragile = false;
  turboUntil = 0;
  private turboWasOn = false;
  nextAdAt = 150;
  adCycle = 0;
  complete = false;
  stats = { delivered: 0, broken: 0, earned: 0 };

  private nextId = 1;
  private wobbleWarned = false;
  private loaded = false;

  constructor(loc: LocationJson, save?: LocationSave | null, opts: WarehouseOptions = {}) {
    this.loc = loc;
    this.opts = opts;
    this.layout = buildLayout(loc);
    this.rng = new Rng(save?.seed ?? opts.seed ?? 12345);
    const L = this.layout;

    this.belts = loc.belts.map((b, i) => new Belt(i, L.belts[i]!, b.interval, b.speed, b.maxItems));
    this.shelves = L.shelves.map((g, i) => new Shelf(i, g, loc.shelfCapacity));
    this.docks = L.docks.map((g, i) => new Dock(i, g));
    this.piles = this.docks.map((d) => new CoinPile(`pile${d.district}`, d.geom.pile.x, d.geom.pile.y, 36));
    this.pads = loc.pads.map((p) => {
      const at = padPosition(L, p);
      return new Pad(p, at.x, at.y);
    });

    const navPoints: Vec[] = [
      ...L.waypoints,
      ...L.belts.map((b) => b.stand),
      ...L.shelves.flatMap((s) => [s.inStand, s.outStand]),
      ...L.docks.flatMap((d) => [d.stand, d.pile]),
      L.safe.stand,
    ];
    this.nav = new NavGraph(navPoints, [...L.walls, ...L.belts.map((b) => b.body), ...L.shelves.map((s) => s.body), L.safe.body, ...L.extra]);

    const spawn = opts.noPlayer ? { x: -300, y: -300 } : L.spawn;
    this.player = new Carrier(0, 'player', spawn.x, spawn.y, PLAYER_RADIUS);

    if (save) {
      this.coins = save.coins;
      this.levels = { ...save.levels };
      this.locTime = save.locTime;
      this.turboUntil = save.turboLeft > 0 ? save.turboLeft : 0;
      this.nextAdAt = save.nextAdAt;
      this.adCycle = save.adCycle;
      this.stats = { ...save.stats };
      for (const pad of this.pads) pad.paid = save.paid[pad.id] ?? 0;
      this.fragileActive = loc.features.fragileAt === null || this.locTime >= loc.features.fragileAt;
    } else {
      this.coins = loc.startCoins;
      this.fragileActive = loc.features.fragileAt === null;
    }
    this.applyLevels();
    if (!save) this.freshStart();
    this.refreshPads(true);
    this.loaded = true;
  }

  // -------------------------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------------------------

  private freshStart(): void {
    for (let i = 0; i < this.belts.length; i++) {
      const b = this.belts[i]!;
      const n = this.loc.belts[i]!.preload ?? 0;
      for (let k = 0; k < n; k++) b.preload(this.makeParcel('normal', this.randomDistrict()));
    }
    const van = this.docks[0]?.loadingVan();
    if (van) {
      for (let k = 0; k < this.loc.vanPreload; k++) {
        const p = this.makeParcel('normal', 0);
        p.sorted = true;
        van.items.push(p);
      }
    }
  }

  lvl(key: string): number {
    return this.levels[key] ?? 0;
  }

  private bought(type: PadJson['type']): number {
    let n = 0;
    for (const p of this.pads) if (p.def.type === type && this.lvl(p.id) > 0) n++;
    return n;
  }

  /** Rebuilds everything that depends on purchase levels. Idempotent. */
  applyLevels(): void {
    const p = this.player;
    p.capacity = playerCapacity(this.lvl('player.capacity'));
    p.speed = playerSpeed(this.lvl('player.speed'));
    p.stability = Math.min(0.9, this.lvl('player.stability') * FRAGILE.stabilityStep);

    for (let i = 0; i < this.shelves.length; i++) {
      const bought = this.pads.some((pad) => pad.def.type === 'district' && pad.def.district === i && this.lvl(pad.id) > 0);
      const built = i < this.loc.startDistricts || bought;
      this.shelves[i]!.built = built;
      this.docks[i]!.built = built;
    }
    const cap = vanCapacity(this.lvl('van.capacity'));
    for (const d of this.docks) {
      d.capacity = cap;
      const want = 1 + (this.pads.some((pad) => pad.def.type === 'van2' && pad.def.district === d.district && this.lvl(pad.id) > 0) ? 1 : 0);
      while (d.vans.length < want) d.addVan();
    }

    // Permanent workers from hire pads.
    for (const role of ['sorter', 'loader', 'collector'] as const) {
      const want = this.pads.filter((pad) => pad.def.type === 'hire' && pad.def.role === role && this.lvl(pad.id) > 0).length;
      let have = this.workers.filter((w) => w.role === role && w.carrier.expiresAt === 0).length;
      while (have < want) {
        this.spawnWorker(role, 0);
        have++;
      }
    }
    for (const w of this.workers) this.applyWorkerStats(w);

    this.solids = [
      ...this.layout.walls,
      ...this.layout.belts.map((b) => b.body),
      ...this.shelves.filter((s) => s.built).map((s) => s.geom.body),
      this.layout.safe.body,
      ...this.layout.extra,
    ];
  }

  private applyWorkerStats(w: Worker): void {
    const c = w.carrier;
    const r = w.role;
    const bonus = this.loc.workers ?? {};
    c.speed = workerSpeed(this.lvl(`${r}.speed`)) * (bonus.speed ?? 1);
    if (r === 'collector') {
      c.capacity = 0;
      c.coinCap = collectorTrip(this.lvl('collector.capacity'), this.loc.multiplier);
    } else {
      c.capacity = workerCapacity(r, this.lvl(`${r}.capacity`)) + (bonus.capacity ?? 0);
    }
  }

  private spawnWorker(role: WorkerRole, expiresAt: number): Worker {
    const at = this.layout.safe.stand;
    const c = new Carrier(this.nextId++, role, at.x + this.rng.range(-20, 20), at.y + this.rng.range(0, 20), 13);
    c.expiresAt = expiresAt;
    const w = new Worker(c, role, { x: this.rng.range(-16, 16), y: this.rng.range(-26, 26) });
    w.whSafe = { x: at.x, y: at.y };
    this.applyWorkerStats(w);
    this.workers.push(w);
    if (this.loaded) this.events.push({ type: 'hired', carrier: c.id, role, temp: expiresAt > 0 });
    return w;
  }

  // -------------------------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------------------------

  get carriers(): Carrier[] {
    const out: Carrier[] = this.opts.noPlayer ? [] : [this.player];
    for (const w of this.workers) out.push(w.carrier);
    return out;
  }

  turboActive(): boolean {
    return this.time < this.turboUntil;
  }

  padLevel(pad: Pad): number {
    return pad.def.type === 'upgrade' ? this.lvl(pad.def.stat!) : this.lvl(pad.id);
  }

  /** Milestones bought in this location; each one unlocks more upgrade levels. */
  stage(): number {
    return this.bought('district') + this.bought('hire') + this.bought('van2');
  }

  /** Highest level ever reachable for this pad. */
  padCap(pad: Pad): number {
    if (pad.def.type !== 'upgrade') return 1;
    return pad.def.max ?? STATS[pad.def.stat!].max;
  }

  /** Highest level reachable right now (stage gating). */
  padMax(pad: Pad): number {
    const cap = this.padCap(pad);
    if (pad.def.type !== 'upgrade') return cap;
    const unlock = pad.def.unlock;
    if (!unlock || unlock.length === 0) return cap;
    const stage = this.stage();
    let n = 0;
    for (const s of unlock) if (s <= stage) n++;
    const last = unlock[unlock.length - 1]!;
    if (stage > last) n += Math.floor((stage - last) / Math.max(1, pad.def.every ?? 1));
    return Math.min(cap, n);
  }

  padCost(pad: Pad): number {
    const d = pad.def;
    const scale = this.loc.costScale;
    switch (d.type) {
      case 'upgrade':
        return levelCost(d.c0 ?? STATS[d.stat!].c0, this.lvl(d.stat!), scale);
      case 'district':
      case 'hire':
      case 'van2':
        return levelCost(d.c0 ?? DEFAULT_C0[d.type], this.bought(d.type), scale);
      case 'move':
        return d.cost ?? 1000;
    }
  }

  /** Whether the pad with this id has been bought at least once. */
  padBought(id: string): boolean {
    const pad = this.pads.find((p) => p.id === id);
    if (!pad) return this.lvl(id) > 0;
    return this.padLevel(pad) > 0;
  }

  private requirementsMet(pad: Pad): boolean {
    for (const r of pad.def.requires ?? []) {
      if (r === '@fragile') {
        if (!this.fragileActive) return false;
      } else if (!this.padBought(r)) {
        return false;
      }
    }
    return true;
  }

  /** Every link of the chain has a permanent worker (condition for offline earnings). */
  isAutomated(): boolean {
    const has = (role: WorkerRole): boolean => this.workers.some((w) => w.role === role && w.carrier.expiresAt === 0);
    return has('sorter') && has('loader') && has('collector');
  }

  builtDistricts(): number[] {
    const out: number[] = [];
    for (const s of this.shelves) if (s.built) out.push(s.district);
    return out;
  }

  // -------------------------------------------------------------------------------------------
  // Step
  // -------------------------------------------------------------------------------------------

  step(dt: number): void {
    this.dt = dt;
    this.time += dt;
    this.locTime += dt;

    this.updateFeatures();
    this.updateBelts(dt);
    this.updatePlayerIntent();
    for (const w of this.workers) w.update(dt, this);
    for (const c of this.carriers) {
      c.transferT -= dt;
      this.moveCarrier(c, dt);
      this.updateWobble(c, dt);
    }
    if (!this.opts.noPlayer) {
      this.playerInteractions();
      this.updatePads(dt);
      this.updateAdPads(dt);
    }
    this.updateDocks(dt);
    this.updateHelpers();
    this.updateTurbo();
    this.refreshPads(false);
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private updateFeatures(): void {
    const at = this.loc.features.fragileAt;
    if (!this.fragileActive && at !== null && this.locTime >= at) {
      this.fragileActive = true;
      this.forceFragile = true;
      this.events.push({ type: 'fragileIntro' });
    }
  }

  private randomDistrict(): number {
    const built = this.builtDistricts();
    return built[this.rng.int(built.length)]!;
  }

  private makeParcel(kind: ParcelKind, district: number): Parcel {
    const p: Parcel = {
      id: this.nextId++,
      district,
      kind,
      sorted: false,
      deadline: kind === 'express' ? this.time + this.loc.features.expressTime : 0,
      onTime: false,
      hop: 0,
    };
    this.parcels.set(p.id, p);
    return p;
  }

  private rollKind(): ParcelKind {
    const f = this.loc.features;
    if (this.fragileActive && (this.forceFragile || this.rng.chance(f.fragileChance))) {
      this.forceFragile = false;
      return 'fragile';
    }
    if (f.expressChance > 0 && this.rng.chance(f.expressChance)) return 'express';
    if (f.xxlChance > 0 && this.rng.chance(f.xxlChance)) return 'xxl';
    return 'normal';
  }

  private updateBelts(dt: number): void {
    const level = this.lvl('belt.speed');
    for (const b of this.belts) {
      b.move(dt);
      b.spawnT -= dt;
      if (b.spawnT <= 0 && b.canSpawn()) {
        const p = this.makeParcel(this.rollKind(), this.randomDistrict());
        b.push(p);
        b.spawnT = beltInterval(b.baseInterval, level);
        this.events.push({ type: 'spawn', parcel: p.id, belt: b.index });
      }
    }
  }

  private updatePlayerIntent(): void {
    const p = this.player;
    if (this.opts.noPlayer) return;
    const m = Math.hypot(this.input.x, this.input.y);
    if (m < 0.05) {
      p.moveX = 0;
      p.moveY = 0;
    } else {
      p.moveX = this.input.x / m;
      p.moveY = this.input.y / m;
    }
    p.careful = this.input.careful;
  }

  private moveCarrier(c: Carrier, dt: number): void {
    c.px = c.x;
    c.py = c.y;
    const m = Math.hypot(c.moveX, c.moveY);
    if (m < 0.02) {
      c.moving = false;
      c.running = false;
      return;
    }
    const isPlayer = c.role === 'player';
    const factor = c.careful ? (isPlayer ? CAREFUL_SPEED_FACTOR : WORKER_FRAGILE_SPEED_FACTOR) : 1;
    const len = c.speed * factor * dt * (isPlayer ? 1 : Math.min(1, m));
    const nx = c.moveX / m;
    const ny = c.moveY / m;
    c.x += nx * len;
    c.y += ny * len;
    if (isPlayer) this.resolveCollision(c);
    const moved = Math.hypot(c.x - c.px, c.y - c.py);
    c.walked += moved;
    c.dirX = nx;
    c.dirY = ny;
    c.moving = moved > 0.01;
    c.running = c.moving && !c.careful;
  }

  private resolveCollision(c: Carrier): void {
    for (let pass = 0; pass < 2; pass++) {
      for (const r of this.solids) {
        const fix = pushCircleOutOfRect(c.x, c.y, c.radius, r);
        if (fix) {
          c.x = fix.x;
          c.y = fix.y;
        }
      }
    }
  }

  private updateWobble(c: Carrier, dt: number): void {
    if (c.role !== 'player') {
      c.wobble = 0;
      return;
    }
    c.runTime = c.running ? c.runTime + dt : 0;
    const fragile = c.hasFragile();
    let rate = 0;
    if (fragile && c.moving) {
      const over = c.stack.length > FRAGILE.safeCount || c.runTime > FRAGILE.runGrace;
      if (over) rate = c.careful ? FRAGILE.carefulFactor : 1;
    }
    if (rate > 0) {
      c.wobble += (dt * rate * (1 - c.stability)) / FRAGILE.fillTime;
      if (!this.wobbleWarned && c.wobble > 0.45) {
        this.wobbleWarned = true;
        this.events.push({ type: 'wobble', carrier: c.id });
      }
    } else {
      c.wobble = Math.max(0, c.wobble - FRAGILE.decay * dt);
      if (c.wobble < 0.2) this.wobbleWarned = false;
    }
    if (!fragile) c.wobble = Math.max(0, c.wobble - FRAGILE.decay * dt);
    if (c.wobble >= 1) {
      const i = c.topIndex((p) => p.kind === 'fragile');
      if (i >= 0) {
        const [p] = c.stack.splice(i, 1);
        this.parcels.delete(p!.id);
        this.stats.broken++;
        this.events.push({ type: 'break', carrier: c.id, parcel: p!.id, district: p!.district, x: c.x, y: c.y, h: i });
      }
      c.wobble = FRAGILE.afterBreak;
      this.wobbleWarned = false;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Transfers (shared by the player and workers)
  // -------------------------------------------------------------------------------------------

  private ready(c: Carrier): boolean {
    return c.transferT <= 0;
  }

  private spend(c: Carrier): void {
    c.transferT = c.role === 'player' ? PLAYER_TRANSFER_INTERVAL : WORKER_TRANSFER_INTERVAL;
  }

  pickFromBelt(c: Carrier, belt: Belt): boolean {
    if (!this.ready(c)) return false;
    const f = belt.front();
    if (!f || !c.canTake(f)) return false;
    belt.take();
    c.stack.push(f);
    f.hop++;
    this.spend(c);
    this.events.push({ type: 'pickup', carrier: c.id, parcel: f.id, from: 'belt' });
    return true;
  }

  dropOnShelf(c: Carrier, shelf: Shelf): boolean {
    if (!this.ready(c) || !shelf.built) return false;
    const i = c.topIndex((p) => !p.sorted && p.district === shelf.district);
    if (i < 0) return false;
    if (shelf.isFull()) {
      // Full shelf: the player swaps with it, so the parcel in hand comes back sorted.
      // Without this a full stack of one colour and a full shelf of that colour would deadlock.
      if (c.role !== 'player') return false;
      const p = c.stack[i]!;
      p.sorted = true;
      p.hop++;
      this.spend(c);
      this.events.push({ type: 'stamp', carrier: c.id, parcel: p.id, station: shelf.id });
      return true;
    }
    const [p] = c.stack.splice(i, 1);
    p!.sorted = true;
    p!.hop++;
    shelf.items.push(p!);
    this.spend(c);
    this.events.push({ type: 'drop', carrier: c.id, parcel: p!.id, to: 'shelf', station: shelf.id });
    return true;
  }

  pickFromShelf(c: Carrier, shelf: Shelf): boolean {
    if (!this.ready(c) || shelf.items.length === 0) return false;
    const p = shelf.items[shelf.items.length - 1]!;
    if (!c.canTake(p)) return false;
    shelf.items.pop();
    c.stack.push(p);
    p.hop++;
    this.spend(c);
    this.events.push({ type: 'pickup', carrier: c.id, parcel: p.id, from: 'shelf' });
    return true;
  }

  dropInVan(c: Carrier, dock: Dock): boolean {
    if (!this.ready(c) || !dock.built) return false;
    const van = dock.loadingVan();
    if (!van || van.items.length >= dock.capacity) return false;
    const i = c.topIndex((p) => p.sorted && p.district === dock.district);
    if (i < 0) return false;
    const [p] = c.stack.splice(i, 1);
    p!.hop++;
    if (p!.kind === 'express') p!.onTime = this.time <= p!.deadline;
    van.items.push(p!);
    this.spend(c);
    this.events.push({ type: 'drop', carrier: c.id, parcel: p!.id, to: 'van', station: dock.id });
    return true;
  }

  collectPile(c: Carrier, pile: CoinPile): boolean {
    if (pile.value <= 0) return false;
    if (c.role === 'player') {
      const amount = pile.value;
      pile.value = 0;
      this.coins += amount;
      this.events.push({ type: 'collect', carrier: c.id, pile: pile.id, amount });
      return true;
    }
    if (!this.ready(c)) return false;
    const room = c.coinCap - c.coins;
    if (room <= 0) return false;
    const amount = Math.min(pile.value, room, Math.max(1, c.coinCap / 6));
    pile.value -= amount;
    if (pile.value < 1e-6) pile.value = 0;
    c.coins += amount;
    this.spend(c);
    this.events.push({ type: 'collect', carrier: c.id, pile: pile.id, amount });
    return true;
  }

  depositCoins(c: Carrier): void {
    if (c.coins <= 0) return;
    const amount = c.coins;
    c.coins = 0;
    this.coins += amount;
    this.events.push({ type: 'deposit', carrier: c.id, amount });
  }

  private playerInteractions(): void {
    const c = this.player;
    const { x, y } = c;
    for (const b of this.belts) if (inRect(b.geom.zone, x, y)) this.pickFromBelt(c, b);
    for (const s of this.shelves) {
      if (!s.built) continue;
      if (inRect(s.geom.inZone, x, y)) this.dropOnShelf(c, s);
      if (inRect(s.geom.outZone, x, y)) this.pickFromShelf(c, s);
    }
    for (const d of this.docks) if (d.built && inRect(d.geom.zone, x, y)) this.dropInVan(c, d);
    for (const p of this.piles) if (p.value > 0 && dist2(x, y, p.x, p.y) <= (p.r + c.radius) ** 2) this.collectPile(c, p);
  }

  // -------------------------------------------------------------------------------------------
  // Buy pads
  // -------------------------------------------------------------------------------------------

  private refreshPads(initial: boolean): void {
    for (const pad of this.pads) {
      const vis = this.padLevel(pad) < this.padMax(pad) && this.requirementsMet(pad);
      pad.visible = vis;
      if (vis && !pad.shown) {
        pad.shown = true;
        if (!initial) this.events.push({ type: 'padShown', pad: pad.id, x: pad.x, y: pad.y, reveal: !!pad.def.reveal });
      }
    }
  }

  /** Pad the player is standing on (visible), if any. */
  padUnderPlayer(): Pad | null {
    for (const pad of this.pads) if (pad.visible && inRect(pad.zone, this.player.x, this.player.y)) return pad;
    return null;
  }

  /** True while the player is paying into this pad (renderer spawns flying coins). */
  payingPad: Pad | null = null;

  private updatePads(dt: number): void {
    this.payingPad = null;
    const c = this.player;
    for (const pad of this.pads) {
      // Paying needs the player to stand on the pad; walking across one never drains coins.
      if (!pad.visible || !inRect(pad.zone, c.x, c.y) || c.moving) {
        pad.standT = 0;
        continue;
      }
      pad.standT += dt;
      if (pad.standT < PAD_DELAY) continue;
      const cost = this.padCost(pad);
      const remaining = cost - pad.paid;
      if (remaining <= 1e-6) {
        this.purchase(pad);
        continue;
      }
      if (this.coins > 1e-6) {
        const rate = Math.max(cost / PAD_FILL_TIME, 30);
        const amount = Math.min(remaining, this.coins, rate * dt);
        this.coins -= amount;
        pad.paid += amount;
        this.payingPad = pad;
        if (cost - pad.paid <= 1e-6) this.purchase(pad);
      } else {
        this.coins = 0;
        this.offerAssist(pad, cost);
      }
    }
  }

  purchase(pad: Pad): void {
    const d = pad.def;
    pad.paid = 0;
    const key = d.type === 'upgrade' ? d.stat! : pad.id;
    this.levels[key] = this.lvl(key) + 1;
    let reveal: Vec | null = null;
    if (d.type === 'district') {
      const s = this.shelves[d.district!]!;
      const dock = this.docks[d.district!]!;
      reveal = { x: (s.geom.cx + dock.geom.stand.x) / 2, y: (s.geom.cy + dock.geom.stand.y) / 2 };
    }
    this.applyLevels();
    // The new shelf may appear on top of the player: step out of it.
    if (d.type === 'district') this.resolveCollision(this.player);
    this.events.push({ type: 'purchase', pad: pad.id, level: this.lvl(key), x: pad.x, y: pad.y, reveal });
    this.adPads = this.adPads.filter((a) => a.target !== pad.id || a.pending);
    if (d.type === 'move') {
      this.complete = true;
      this.events.push({ type: 'locationComplete' });
    }
  }

  // -------------------------------------------------------------------------------------------
  // Rewarded floor zones
  // -------------------------------------------------------------------------------------------

  private offerAssist(pad: Pad, cost: number): void {
    if (pad.def.type === 'move') return;
    const missing = cost - pad.paid - this.coins;
    if (missing <= 0 || missing > cost * ASSIST_MAX_MISSING) return;
    const existing = this.adPads.find((a) => a.kind === 'assist');
    if (existing?.target === pad.id) {
      existing.expiresAt = this.time + ASSIST_LIFETIME;
      return;
    }
    if (existing?.pending) return;
    const at = this.freeSpotNear(pad.x, pad.y);
    if (!at) return;
    this.adPads = this.adPads.filter((a) => a.kind !== 'assist');
    this.adPads.push(new AdPad(`assist:${pad.id}`, 'assist', 'medium', at.x, at.y, this.time + ASSIST_LIFETIME, pad.id));
    this.events.push({ type: 'adPadShown', pad: `assist:${pad.id}`, kind: 'assist' });
  }

  /** A spot next to (x, y) for an extra floor zone that overlaps nothing. */
  private freeSpotNear(x: number, y: number): Vec | null {
    const step = (PAD_SIZE + AD_PAD_SIZE) / 2 + 10;
    const candidates: Vec[] = [
      { x: x + step, y },
      { x: x - step, y },
      { x, y: y + step },
      { x, y: y - step },
      { x: x + step, y: y + step },
      { x: x - step, y: y + step },
    ];
    for (const p of candidates) {
      const r = { x: p.x - AD_PAD_SIZE / 2, y: p.y - AD_PAD_SIZE / 2, w: AD_PAD_SIZE, h: AD_PAD_SIZE };
      if (r.x < 30 || r.y < 80 || r.x + r.w > this.layout.w - 30 || r.y + r.h > this.layout.h - 30) continue;
      if (this.solids.some((s) => rectsOverlap(s, r))) continue;
      if (this.pads.some((pd) => pd.visible && rectsOverlap(pd.zone, r))) continue;
      if (this.shelves.some((s) => rectsOverlap(s.geom.inZone, r) || rectsOverlap(s.geom.outZone, r))) continue;
      if (this.docks.some((d) => rectsOverlap(d.geom.zone, r))) continue;
      if (this.belts.some((b) => rectsOverlap(b.geom.zone, r))) continue;
      return p;
    }
    return null;
  }

  private updateAdPads(dt: number): void {
    const c = this.player;
    // Schedule turbo / helper zones about every 3 minutes, alternating.
    if (!this.opts.noAds && this.locTime >= this.nextAdAt && !this.adPads.some((a) => a.kind !== 'assist')) {
      const helperActive = this.workers.some((w) => w.carrier.expiresAt > 0);
      let kind: AdKind | null = this.adCycle % 2 === 0 ? 'helper' : 'turbo';
      if (kind === 'turbo' && this.turboActive()) kind = helperActive ? null : 'helper';
      else if (kind === 'helper' && helperActive) kind = this.turboActive() ? null : 'turbo';
      const spots = this.loc.adSpots;
      if (kind && spots.length > 0) {
        const [sx, sy] = spots[this.adCycle % spots.length]!;
        const id = `${kind}:${this.adCycle}`;
        this.adPads.push(new AdPad(id, kind, kind === 'helper' ? 'small' : 'medium', sx, sy, this.time + AD_SPOT_LIFETIME, null));
        this.events.push({ type: 'adPadShown', pad: id, kind });
        this.adCycle++;
        this.nextAdAt = this.locTime + AD_SPOT_PERIOD / 2;
      } else {
        this.nextAdAt = this.locTime + 30;
      }
    }

    for (const a of this.adPads) {
      if (inRect(a.zone, c.x, c.y)) {
        if (a.armed && !a.pending) {
          a.standT += dt;
          if (a.standT >= AD_PAD_HOLD) {
            a.pending = true;
            a.standT = 0;
            this.events.push({ type: 'adRequest', pad: a.id, kind: a.kind, size: a.size });
          }
        }
        // Keep the zone alive while the player is on it.
        a.expiresAt = Math.max(a.expiresAt, this.time + 2);
      } else {
        a.standT = 0;
        a.armed = true;
      }
    }
    this.adPads = this.adPads.filter((a) => a.pending || this.time < a.expiresAt || this.assistStillWanted(a));
  }

  private assistStillWanted(a: AdPad): boolean {
    if (a.kind !== 'assist' || !a.target) return false;
    const pad = this.pads.find((p) => p.id === a.target);
    return !!pad && inRect(pad.zone, this.player.x, this.player.y);
  }

  /** Reports the result of the rewarded ad requested by an `adRequest` event. */
  resolveAd(id: string, success: boolean): void {
    const a = this.adPads.find((p) => p.id === id);
    if (!a) return;
    a.pending = false;
    if (!success) {
      a.armed = false;
      return;
    }
    this.adPads = this.adPads.filter((p) => p !== a);
    if (a.kind === 'turbo') {
      this.turboUntil = Math.max(this.time, this.turboUntil) + TURBO_DURATION;
      this.events.push({ type: 'turboStart', until: this.turboUntil });
    } else if (a.kind === 'helper') {
      this.spawnWorker(this.helperRole(), this.time + HELPER_DURATION);
    } else if (a.kind === 'assist' && a.target) {
      const pad = this.pads.find((p) => p.id === a.target);
      if (!pad || !pad.visible) return;
      const cost = this.padCost(pad);
      const take = Math.min(this.coins, Math.max(0, cost - pad.paid));
      this.coins -= take;
      this.purchase(pad);
    }
  }

  /** The helper fills the most useful missing link. */
  helperRole(): WorkerRole {
    const count = (r: WorkerRole): number => this.workers.filter((w) => w.role === r).length;
    if (count('sorter') === 0) return 'sorter';
    if (count('loader') === 0) return 'loader';
    if (count('collector') === 0) return 'collector';
    return count('sorter') <= count('loader') ? 'sorter' : 'loader';
  }

  private updateHelpers(): void {
    for (const w of this.workers) {
      if (w.carrier.expiresAt > 0 && this.time >= w.carrier.expiresAt) w.retiring = true;
    }
    const gone = this.workers.filter((w) => w.retiring && w.state === 'idle' && w.carrier.stack.length === 0 && w.carrier.coins === 0);
    if (gone.length === 0) return;
    for (const w of gone) this.events.push({ type: 'helperGone', carrier: w.carrier.id });
    this.workers = this.workers.filter((w) => !gone.includes(w));
  }

  private updateTurbo(): void {
    const on = this.turboActive();
    if (this.turboWasOn && !on) this.events.push({ type: 'turboEnd' });
    this.turboWasOn = on;
  }

  // -------------------------------------------------------------------------------------------
  // Docks
  // -------------------------------------------------------------------------------------------

  private updateDocks(dt: number): void {
    const mult = this.turboActive() ? TURBO_MULT : 1;
    for (const d of this.docks) {
      if (!d.built) continue;
      const { departed, arrived } = d.update(dt);
      if (departed) {
        let coins = 0;
        for (const p of departed.items) {
          coins += payout(p.kind, this.loc.multiplier, p.onTime) * mult;
          this.parcels.delete(p.id);
        }
        const n = departed.items.length;
        departed.items = [];
        const pile = this.piles[d.district]!;
        pile.value += coins;
        this.stats.delivered += n;
        this.stats.earned += coins;
        this.events.push({ type: 'vanDepart', dock: d.id, coins, parcels: n });
        this.events.push({ type: 'coinsDropped', pile: pile.id, amount: coins });
      }
      if (arrived) this.events.push({ type: 'vanArrive', dock: d.id });
    }
  }

  // -------------------------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------------------------

  toSave(): LocationSave {
    const paid: Record<string, number> = {};
    for (const p of this.pads) if (p.paid > 0) paid[p.id] = p.paid;
    // Coins lying on the floor and carried by the collector are banked on save.
    let floor = 0;
    for (const p of this.piles) floor += p.value;
    for (const w of this.workers) floor += w.carrier.coins;
    return {
      loc: this.loc.id,
      coins: this.coins + floor,
      levels: { ...this.levels },
      paid,
      locTime: this.locTime,
      turboLeft: Math.max(0, this.turboUntil - this.time),
      nextAdAt: this.nextAdAt,
      adCycle: this.adCycle,
      stats: { ...this.stats },
      seed: this.rng.state,
    };
  }

  /** Stat level lookup with a typed key, for UI. */
  statLevel(key: StatKey): number {
    return this.lvl(key);
  }
}
