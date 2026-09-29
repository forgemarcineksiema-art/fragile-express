// A greedy bot that plays like a reasonable human: it keeps the chain moving and buys the
// cheapest visible pad as soon as it can afford it. Used by tools/pacing-sim and tests.
import { dist2, inRect, type Vec } from '../core/math.ts';
import { FRAGILE } from './economy.ts';
import type { Belt, CoinPile, Dock, Pad, Shelf } from './stations.ts';
import type { Warehouse } from './warehouse.ts';

type Task =
  | { kind: 'buy'; pad: Pad; level: number; cost: number }
  | { kind: 'collect'; pile: CoinPile }
  | { kind: 'belt'; belt: Belt }
  | { kind: 'shelfIn'; shelf: Shelf }
  | { kind: 'shelfOut'; shelf: Shelf; want: number }
  | { kind: 'dock'; dock: Dock };

export interface BotOptions {
  /** Pause after each finished task, like a human looking around. */
  think?: number;
  /** Called on every purchase with the price paid. */
  onBuy?: (pad: Pad, time: number, cost: number) => void;
}

export class PlayerBot {
  private readonly wh: Warehouse;
  private readonly think: number;
  private readonly onBuy?: (pad: Pad, time: number, cost: number) => void;
  private task: Task | null = null;
  private path: Vec[] = [];
  private wait = 0;
  private idle = 0;
  private lastStack = 0;
  private taskTime = 0;

  constructor(wh: Warehouse, opts: BotOptions = {}) {
    this.wh = wh;
    this.think = opts.think ?? 0.35;
    this.onBuy = opts.onBuy;
  }

  update(dt: number): void {
    const wh = this.wh;
    const c = wh.player;
    wh.input.x = 0;
    wh.input.y = 0;
    wh.input.careful = false;
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    if (!this.task) {
      this.task = this.plan();
      this.taskTime = 0;
      this.idle = 0;
      if (!this.task) {
        this.wait = 0.25;
        return;
      }
      const at = this.standPoint(this.task);
      this.path = wh.nav.path(c.x, c.y, at.x, at.y);
    }
    this.taskTime += dt;
    if (this.taskTime > 25) {
      this.finish();
      return;
    }
    // A purchase can move the player (a new shelf pushes it aside), so check it before arrival.
    const t = this.task;
    if (t.kind === 'buy' && (wh.padLevel(t.pad) > t.level || !t.pad.visible)) {
      if (wh.padLevel(t.pad) > t.level) this.onBuy?.(t.pad, wh.time, t.cost);
      this.finish();
      return;
    }

    if (!this.arrived(this.task)) {
      const next = this.path[0];
      if (!next) {
        const at = this.standPoint(this.task);
        this.path = wh.nav.path(c.x, c.y, at.x, at.y);
        return;
      }
      const dx = next.x - c.x;
      const dy = next.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) {
        this.path.shift();
        return;
      }
      wh.input.x = dx / d;
      wh.input.y = dy / d;
      // Careful with fragile parcels: walk slowly when the stack is tall or after running a while.
      if (c.hasFragile() && (c.stack.length > FRAGILE.safeCount || c.runTime > FRAGILE.runGrace - 0.4 || c.wobble > 0.2)) {
        wh.input.careful = true;
      }
      return;
    }
    if (this.done(this.task, dt)) this.finish();
  }

  private finish(): void {
    this.task = null;
    this.wait = this.think;
  }

  private standPoint(t: Task): Vec {
    switch (t.kind) {
      case 'buy':
        return { x: t.pad.x, y: t.pad.y };
      case 'collect':
        return { x: t.pile.x, y: t.pile.y };
      case 'belt':
        return t.belt.geom.stand;
      case 'shelfIn':
        return t.shelf.geom.inStand;
      case 'shelfOut':
        return t.shelf.geom.outStand;
      case 'dock':
        return t.dock.geom.stand;
    }
  }

  private arrived(t: Task): boolean {
    const c = this.wh.player;
    switch (t.kind) {
      case 'buy':
        return inRect(t.pad.zone, c.x, c.y) && dist2(c.x, c.y, t.pad.x, t.pad.y) < 20 * 20;
      case 'collect':
        return dist2(c.x, c.y, t.pile.x, t.pile.y) < (t.pile.r + c.radius - 4) ** 2;
      case 'belt':
        return inRect(t.belt.geom.zone, c.x, c.y);
      case 'shelfIn':
        return inRect(t.shelf.geom.inZone, c.x, c.y);
      case 'shelfOut':
        return inRect(t.shelf.geom.outZone, c.x, c.y);
      case 'dock':
        return inRect(t.dock.geom.zone, c.x, c.y);
    }
  }

  private done(t: Task, dt: number): boolean {
    const wh = this.wh;
    const c = wh.player;
    this.idle += dt;
    // Any transfer counts as progress.
    if (c.stack.length !== this.lastStack) {
      this.lastStack = c.stack.length;
      this.idle = 0;
    }
    switch (t.kind) {
      case 'buy':
        return wh.coins <= 1e-6 && this.idle > 0.8;
      case 'collect':
        return t.pile.value <= 0;
      case 'belt': {
        const front = t.belt.front();
        if (front && !c.canTake(front) && c.stack.length > 0) return true;
        // Leave with a partial stack when the belt runs dry.
        return c.isFull() || (c.stack.length > 0 && this.idle > 1.2 && t.belt.items.length === 0) || (c.stack.length > 0 && this.idle > 2.5);
      }
      case 'shelfIn':
        return c.count((p) => !p.sorted && p.district === t.shelf.district) === 0;
      case 'shelfOut': {
        const have = c.count((p) => p.sorted && p.district === t.shelf.district);
        const top = t.shelf.items[t.shelf.items.length - 1];
        if (top && have < t.want && c.canTake(top)) this.idle = 0;
        return have >= t.want || c.isFull() || this.idle > 0.6;
      }
      case 'dock': {
        const left = c.count((p) => p.sorted && p.district === t.dock.district);
        if (left === 0) return true;
        return this.idle > 8;
      }
    }
  }

  private plan(): Task | null {
    const wh = this.wh;
    const c = wh.player;

    // 1. Buy the cheapest visible pad when affordable. Once the move pad shows up the bot saves
    //    for it and only picks up small upgrades on the way.
    const move = wh.pads.find((p) => p.visible && p.def.type === 'move');
    const moveCost = move ? wh.padCost(move) : Infinity;
    let cheapest: Pad | null = null;
    let cheapestLeft = Infinity;
    for (const pad of wh.pads) {
      if (!pad.visible) continue;
      if (move && pad !== move && wh.padCost(pad) > moveCost * 0.05) continue;
      const left = wh.padCost(pad) - pad.paid;
      if (left < cheapestLeft) {
        cheapestLeft = left;
        cheapest = pad;
      }
    }
    if (cheapest && wh.coins >= cheapestLeft - 1e-6 && c.stack.length === 0) {
      return { kind: 'buy', pad: cheapest, level: wh.padLevel(cheapest), cost: wh.padCost(cheapest) };
    }

    // 2. Pick up coins lying on the floor when empty-handed or passing close by.
    let pile: CoinPile | null = null;
    let pileD = Infinity;
    for (const p of wh.piles) {
      if (p.value <= 0) continue;
      const d = dist2(c.x, c.y, p.x, p.y);
      if (d < pileD) {
        pileD = d;
        pile = p;
      }
    }
    const poorEnough = cheapest ? wh.coins < cheapestLeft : false;
    if (pile && (c.stack.length === 0 || pileD < 220 * 220) && (poorEnough || pileD < 220 * 220)) return { kind: 'collect', pile };

    // 3. Unsorted parcels in hand go to their shelf.
    const unsorted = c.stack.filter((p) => !p.sorted);
    if (unsorted.length > 0) {
      // Prefer shelves with room; a full shelf still sorts the parcels in hand.
      let best: Shelf | null = null;
      let bestD = Infinity;
      for (const p of unsorted) {
        const s = wh.shelves[p.district]!;
        if (!s.built) continue;
        const d = dist2(c.x, c.y, s.geom.inStand.x, s.geom.inStand.y) + (s.isFull() ? 400 * 400 : 0);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (best) return { kind: 'shelfIn', shelf: best };
    }

    // 4. Sorted parcels in hand go to their van.
    const sorted = c.stack.filter((p) => p.sorted);
    if (sorted.length > 0) {
      const dock = wh.docks[sorted[sorted.length - 1]!.district]!;
      return { kind: 'dock', dock };
    }

    // 5. Empty-handed: feed a van from a stocked shelf, else fetch from the belt.
    let bestShelf: Shelf | null = null;
    let bestScore = 0;
    for (const s of wh.shelves) {
      if (!s.built || s.items.length === 0) continue;
      const dock = wh.docks[s.district]!;
      const room = dock.dropRoom();
      if (room <= 0) continue;
      const score = Math.min(s.items.length, room, c.capacity);
      if (score > bestScore) {
        bestScore = score;
        bestShelf = s;
      }
    }
    const beltStock = wh.belts.reduce((n, b) => n + b.items.length, 0);
    if (bestShelf && (bestScore >= Math.min(4, c.capacity) || beltStock < 3)) {
      const room = wh.docks[bestShelf.district]!.dropRoom();
      return { kind: 'shelfOut', shelf: bestShelf, want: Math.min(c.capacity, room) };
    }
    let belt = wh.belts[0]!;
    for (const b of wh.belts) if (b.items.length > belt.items.length) belt = b;
    return { kind: 'belt', belt };
  }
}
