import { describe, expect, it } from 'vitest';
import { COURIER_BONUS, COURIER_FIRST_DELAY, COURIER_PAY, COURIER_WALK, FRAGILE, levelCost, payout, playerCapacity } from './economy.ts';
import { LOCATIONS } from './locations.ts';
import type { LocationJson } from './layout.ts';
import { NavGraph } from './nav.ts';
import { automationRate, offlineEarnings } from './offline.ts';
import { migrate, SAVE_VERSION } from './save.ts';
import type { Parcel } from './types.ts';
import { Warehouse } from './warehouse.ts';

const DT = 1 / 60;
const loc = (): LocationJson => structuredClone(LOCATIONS.poczta!);

function run(wh: Warehouse, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += DT) {
    each?.();
    wh.step(DT);
  }
}

function place(wh: Warehouse, x: number, y: number): void {
  wh.player.x = wh.player.px = x;
  wh.player.y = wh.player.py = y;
  wh.player.vx = wh.player.vy = 0;
  wh.input = { x: 0, y: 0, careful: false };
}

function parcel(wh: Warehouse, kind: Parcel['kind'], district: number, sorted = false): Parcel {
  const p: Parcel = { id: 10000 + wh.parcels.size, district, kind, sorted, deadline: 0, onTime: false, hop: 0 };
  wh.parcels.set(p.id, p);
  return p;
}

describe('economy', () => {
  it('pays W = 5 × M × kind multiplier', () => {
    expect(payout('normal', 1, false)).toBe(5);
    expect(payout('fragile', 1, false)).toBe(15);
    expect(payout('normal', 4, false)).toBe(20);
    expect(payout('express', 4, true)).toBe(30);
    expect(payout('express', 4, false)).toBe(20);
  });

  it('costs grow as C0 × 1.35^k', () => {
    expect(levelCost(30, 0)).toBe(30);
    expect(levelCost(30, 2)).toBe(55);
    expect(levelCost(100, 1, 4)).toBe(540);
  });
});

describe('belt and stack', () => {
  it('spawns parcels up to the belt limit', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    place(wh, 900, 700);
    run(wh, 60);
    expect(wh.belts[0]!.items.length).toBe(wh.belts[0]!.maxItems);
  });

  it('fills the stack up to capacity at the end of the belt', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const b = wh.belts[0]!;
    place(wh, b.geom.stand.x, b.geom.stand.y);
    run(wh, 20);
    expect(wh.player.stack.length).toBe(playerCapacity(0));
  });

  it('carries an XXL parcel alone', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const c = wh.player;
    c.stack.push(parcel(wh, 'xxl', 0));
    expect(c.canTake(parcel(wh, 'normal', 0))).toBe(false);
    c.stack.length = 0;
    c.stack.push(parcel(wh, 'normal', 0));
    expect(c.canTake(parcel(wh, 'xxl', 0))).toBe(false);
  });
});

describe('shelves and vans', () => {
  it('shelf takes only unsorted parcels of its colour and sorts them', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const s = wh.shelves[0]!;
    wh.player.stack.push(parcel(wh, 'normal', 0), parcel(wh, 'normal', 1), parcel(wh, 'normal', 0));
    place(wh, s.geom.inStand.x, s.geom.inStand.y);
    run(wh, 1);
    expect(s.items.length).toBe(2);
    expect(s.items.every((p) => p.sorted && p.district === 0)).toBe(true);
    expect(wh.player.stack.map((p) => p.district)).toEqual([1]);
  });

  it('full shelf sorts the parcels in the player hands instead of deadlocking', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const s = wh.shelves[0]!;
    for (let i = 0; i < s.capacity; i++) s.items.push(parcel(wh, 'normal', 0, true));
    wh.player.stack.push(parcel(wh, 'normal', 0), parcel(wh, 'normal', 0));
    place(wh, s.geom.inStand.x, s.geom.inStand.y);
    run(wh, 1);
    expect(wh.player.stack.every((p) => p.sorted)).toBe(true);
  });

  it('van accepts only sorted parcels, departs when full and drops coins', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const d = wh.docks[0]!;
    const van = d.loadingVan()!;
    van.items.length = 0;
    wh.player.stack.push(parcel(wh, 'normal', 0, false));
    for (let i = 0; i < d.capacity; i++) wh.player.stack.push(parcel(wh, 'normal', 0, true));
    wh.player.capacity = 20;
    place(wh, d.geom.stand.x, d.geom.stand.y);
    run(wh, 2);
    expect(van.state).not.toBe('loading');
    expect(wh.player.stack.length).toBe(1);
    expect(wh.player.stack[0]!.sorted).toBe(false);
    // Coins were dropped next to the dock; the player standing at the dock has not walked over them.
    expect(wh.piles[0]!.value).toBe(5 * d.capacity);
    run(wh, 10);
    expect(d.loadingVan()).not.toBeNull();
  });

  it('while the van is away parcels go on the pallet and load themselves when it returns', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const d = wh.docks[0]!;
    const van = d.loadingVan()!;
    van.items.length = 0;
    van.state = 'away';
    van.t = 3;
    for (let i = 0; i < 5; i++) wh.player.stack.push(parcel(wh, 'normal', 0, true));
    place(wh, d.geom.stand.x, d.geom.stand.y);
    run(wh, 1);
    expect(wh.player.stack.length).toBe(0);
    expect(d.pallet.length).toBe(5);
    place(wh, 900, 700);
    run(wh, 3 + 1.4 + 1.5);
    expect(d.loadingVan()).toBe(van);
    expect(d.pallet.length).toBe(0);
    expect(van.items.length).toBe(5);
  });

  it('the pallet holds one van load at most', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const d = wh.docks[0]!;
    d.vans[0]!.state = 'away';
    d.vans[0]!.t = 99;
    wh.player.capacity = 20;
    for (let i = 0; i < d.capacity + 3; i++) wh.player.stack.push(parcel(wh, 'normal', 0, true));
    place(wh, d.geom.stand.x, d.geom.stand.y);
    run(wh, 3);
    expect(d.pallet.length).toBe(d.capacity);
    expect(wh.player.stack.length).toBe(3);
  });

  it('player collects a coin pile by walking over it', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const pile = wh.piles[0]!;
    pile.value = 123;
    place(wh, pile.x, pile.y);
    run(wh, 0.1);
    expect(pile.value).toBe(0);
    expect(wh.coins).toBe(123);
  });
});

describe('buy pads', () => {
  it('drains coins over time only while standing, then applies the upgrade', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const pad = wh.pads.find((p) => p.id === 'p_cap')!;
    wh.coins = 100;
    // Walking across does not pay.
    place(wh, pad.x - 60, pad.y);
    run(wh, 0.6, () => (wh.input = { x: 1, y: 0, careful: false }));
    expect(pad.paid).toBe(0);
    expect(wh.coins).toBe(100);
    place(wh, pad.x, pad.y);
    run(wh, 0.4);
    expect(pad.paid).toBeGreaterThan(0);
    expect(wh.lvl('player.capacity')).toBe(0);
    run(wh, 2);
    expect(wh.lvl('player.capacity')).toBe(1);
    expect(wh.player.capacity).toBe(playerCapacity(1));
    expect(wh.coins).toBeCloseTo(70, 5);
  });

  it('district pad builds the shelf and dock and unlocks the next pads', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    wh.levels['player.capacity'] = 1;
    wh.coins = 1000;
    const pad = wh.pads.find((p) => p.id === 'district1')!;
    wh.step(DT);
    expect(pad.visible).toBe(true);
    place(wh, pad.x, pad.y);
    run(wh, 3);
    expect(wh.shelves[1]!.built).toBe(true);
    expect(wh.docks[1]!.built).toBe(true);
    expect(wh.pads.find((p) => p.id === 'hire_sorter')!.visible).toBe(true);
  });

  it('offers the rewarded "upgrade now" zone when at most half the price is missing', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const pad = wh.pads.find((p) => p.id === 'p_cap')!;
    wh.coins = 16; // price 30: missing 14 <= 15
    place(wh, pad.x, pad.y);
    run(wh, 2);
    const assist = wh.adPads.find((a) => a.kind === 'assist');
    expect(assist).toBeDefined();
    // Stand in it for a second: the game gets an ad request; success completes the purchase.
    const events: string[] = [];
    place(wh, assist!.x, assist!.y);
    run(wh, 1.2, () => events.push(...wh.drainEvents().map((e) => e.type)));
    expect(events).toContain('adRequest');
    wh.resolveAd(assist!.id, true);
    expect(wh.lvl('player.capacity')).toBe(1);
    expect(wh.coins).toBe(0);
  });

  it('does not offer the rewarded zone when more than half is missing', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const pad = wh.pads.find((p) => p.id === 'p_cap')!;
    wh.coins = 10;
    place(wh, pad.x, pad.y);
    run(wh, 2);
    expect(wh.adPads.length).toBe(0);
  });
});

describe('fragile parcels', () => {
  const setup = (): Warehouse => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    wh.fragileActive = true;
    place(wh, 700, 720);
    return wh;
  };
  const stripe = (wh: Warehouse, careful: boolean): (() => void) => {
    let dir = 1;
    return () => {
      if (wh.player.x > 1000) dir = -1;
      if (wh.player.x < 500) dir = 1;
      wh.input = { x: dir, y: 0, careful };
    };
  };

  it('a tall stack with a fragile parcel breaks it when running', () => {
    const wh = setup();
    wh.player.stack.push(parcel(wh, 'normal', 0), parcel(wh, 'normal', 0), parcel(wh, 'normal', 0), parcel(wh, 'fragile', 0));
    const events: string[] = [];
    run(wh, FRAGILE.fillTime + 0.5, () => {
      stripe(wh, false)();
      events.push(...wh.drainEvents().map((e) => e.type));
    });
    expect(events).toContain('break');
    expect(wh.player.hasFragile()).toBe(false);
    expect(wh.stats.broken).toBe(1);
  });

  it('three parcels are safe for the first two seconds of running', () => {
    const wh = setup();
    wh.player.stack.push(parcel(wh, 'normal', 0), parcel(wh, 'normal', 0), parcel(wh, 'fragile', 0));
    run(wh, FRAGILE.runGrace - 0.1, stripe(wh, false));
    expect(wh.player.wobble).toBe(0);
    run(wh, FRAGILE.fillTime + 0.5, stripe(wh, false));
    expect(wh.player.hasFragile()).toBe(false);
  });

  it('careful walk never wobbles', () => {
    const wh = setup();
    for (let i = 0; i < 6; i++) wh.player.stack.push(parcel(wh, i === 5 ? 'fragile' : 'normal', 0));
    run(wh, 8, stripe(wh, true));
    expect(wh.player.wobble).toBe(0);
    expect(wh.player.hasFragile()).toBe(true);
  });

  it('pays three times more', () => {
    expect(payout('fragile', 1, false)).toBe(3 * payout('normal', 1, false));
  });
});

describe('workers', () => {
  it('a sorter moves parcels from the belt onto shelves', () => {
    const wh = new Warehouse(loc(), null, { noAds: true, noPlayer: true });
    wh.levels['hire_sorter'] = 1;
    wh.applyLevels();
    run(wh, 40);
    expect(wh.shelves[0]!.items.length).toBeGreaterThan(3);
  });

  it('a fully staffed location earns coins on its own', () => {
    const l = loc();
    const save = new Warehouse(l, null, { noAds: true }).toSave();
    save.levels = { district1: 1, hire_sorter: 1, hire_loader: 1, hire_collector: 1 };
    const rate = automationRate(l, save);
    expect(rate).toBeGreaterThan(0.5);
    const off = offlineEarnings(l, save, 3600 * 5)!;
    expect(off.seconds).toBe(7200);
    expect(off.coins).toBe(Math.floor(rate * 0.5 * 7200));
  });

  it('no offline earnings without every link staffed', () => {
    const l = loc();
    const save = new Warehouse(l, null, { noAds: true }).toSave();
    save.levels = { district1: 1, hire_sorter: 1, hire_loader: 1 };
    expect(offlineEarnings(l, save, 3600)).toBeNull();
  });

  it('a helper from the rewarded zone leaves after its time', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    place(wh, 900, 700);
    wh.adPads.push(...[]);
    const n = wh.workers.length;
    // Simulate a granted helper directly.
    (wh as unknown as { spawnWorker: (r: string, e: number) => void }).spawnWorker('sorter', wh.time + 5);
    expect(wh.workers.length).toBe(n + 1);
    run(wh, 40);
    expect(wh.workers.length).toBe(n);
  });
});

describe('courier orders', () => {
  /** A warehouse with the first worker hired and a courier standing at the counter. */
  function withCourier(): Warehouse {
    const wh = new Warehouse(loc(), null, { noAds: true });
    wh.levels['hire_sorter'] = 1;
    wh.applyLevels();
    place(wh, 300, 300);
    run(wh, COURIER_FIRST_DELAY + COURIER_WALK + 0.5);
    return wh;
  }

  it('no courier before the first worker is hired', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    place(wh, 300, 300);
    run(wh, 60);
    expect(wh.courier.state).toBe('away');
  });

  it('comes after the first hire and waits at the counter with an order', () => {
    const wh = withCourier();
    expect(wh.courier.state).toBe('waiting');
    const order = wh.courier.order!;
    expect(order.items.length).toBeGreaterThanOrEqual(2);
    expect(order.deadline).toBeGreaterThan(wh.time);
  });

  it('takes matching parcels from the player and pays for each, plus a bonus when complete', () => {
    const wh = withCourier();
    const order = wh.courier.order!;
    wh.player.capacity = 20;
    // Bring exactly what was asked for, plus one parcel nobody wants.
    for (const it of order.items) wh.player.stack.push(parcel(wh, it.fragile ? 'fragile' : 'normal', it.district, true));
    wh.player.stack.push(parcel(wh, 'xxl', 0, true));
    const before = wh.coins;
    const spot = wh.layout.courier!.spot;
    place(wh, spot.x, spot.y - 6);
    const events: string[] = [];
    run(wh, 1.2, () => {
      for (const e of wh.drainEvents()) events.push(e.type);
    });
    expect(order.items.every((it) => it.parcel !== null)).toBe(true);
    expect(wh.player.stack.length).toBe(1);
    const pay = order.items.reduce((v, it) => v + payout(it.fragile ? 'fragile' : 'normal', 1, false) * COURIER_PAY, 0);
    expect(wh.coins - before).toBe(pay + Math.round(pay * COURIER_BONUS));
    expect(events).toContain('courierDone');
    expect(wh.courier.state).toBe('leaving');
    // He carries the parcels out, then they are gone.
    run(wh, COURIER_WALK + 0.1);
    expect(wh.courier.state).toBe('away');
    for (const it of order.items) expect(wh.parcels.has(it.parcel!)).toBe(false);
  });

  it('a normal parcel never fills a fragile line', () => {
    const wh = withCourier();
    const order = wh.courier.order!;
    order.items = [{ district: 0, fragile: true, parcel: null }];
    wh.player.stack.push(parcel(wh, 'normal', 0, true));
    const spot = wh.layout.courier!.spot;
    place(wh, spot.x, spot.y - 6);
    run(wh, 1);
    expect(order.items[0]!.parcel).toBeNull();
    expect(wh.player.stack.length).toBe(1);
  });

  it('leaves when his time runs out and comes back later with a new order', () => {
    const wh = withCourier();
    const first = wh.courier.order!;
    run(wh, first.wait + 1);
    expect(wh.courier.state === 'leaving' || wh.courier.state === 'away').toBe(true);
    run(wh, 70);
    expect(wh.courier.present).toBe(true);
    expect(wh.courier.order).not.toBe(first);
  });

  it('workers never serve him', () => {
    const wh = new Warehouse(loc(), null, { noAds: true, noPlayer: true });
    wh.levels = { district1: 1, hire_sorter: 1, hire_loader: 1, hire_collector: 1 };
    wh.applyLevels();
    run(wh, 120);
    expect(wh.courier.state).toBe('away');
  });
});

describe('navigation', () => {
  it('walks around an obstacle', () => {
    const nav = new NavGraph(
      [
        { x: 0, y: -60 },
        { x: 100, y: -60 },
      ],
      [{ x: 40, y: -40, w: 20, h: 80 }],
      5,
    );
    const path = nav.path(0, 0, 100, 0);
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual({ x: 100, y: 0 });
  });
});

describe('save', () => {
  it('round-trips a location', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    wh.coins = 77;
    wh.levels = { 'player.capacity': 1, district1: 1, hire_sorter: 1 };
    wh.applyLevels();
    wh.piles[0]!.value = 3;
    const save = wh.toSave();
    const back = new Warehouse(loc(), save, { noAds: true });
    expect(back.coins).toBe(80);
    expect(back.shelves[1]!.built).toBe(true);
    expect(back.workers.length).toBe(1);
    expect(back.player.capacity).toBe(playerCapacity(1));
  });

  it('migrate accepts valid data and rejects garbage', () => {
    const wh = new Warehouse(loc(), null, { noAds: true });
    const data = {
      v: SAVE_VERSION,
      t: 1,
      playTime: 10,
      current: wh.toSave(),
      settings: { sfx: false, music: true, lang: 'pl' },
      flags: { tutorial: true },
    };
    const ok = migrate(JSON.parse(JSON.stringify(data)));
    expect(ok?.settings.sfx).toBe(false);
    expect(ok?.current.loc).toBe('poczta');
    expect(migrate(null)).toBeNull();
    expect(migrate({ v: 99 })).toBeNull();
    expect(migrate({ v: 1, current: { coins: 5 } })).toBeNull();
  });
});
