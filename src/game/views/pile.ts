// Coin pile at a dock: coins for small amounts, banknote bundles for bigger ones. The pile only grows
// when flying coins land on it (so a van's payout visibly rains down), pops new pieces in with a bounce
// and throws the occasional glint.
import { Container, Sprite } from 'pixi.js';
import type { CoinPile } from '../../sim/stations.ts';
import type { Atlas } from '../atlas.ts';

/** Coin towers around the centre: x, y. The first six form the heap, the rest ring the bundles. */
const COIN_SPOTS = [
  [0, 0],
  [-13, -3],
  [13, -2],
  [-7, 8],
  [8, 8],
  [0, -9],
  [-21, 6],
  [21, 6],
  [-17, -9],
  [18, -9],
  [0, 16],
];
/** Bundle brick pile: x, y, height. */
const CASH_SPOTS = [
  [-12, -1, 0],
  [12, -1, 0],
  [0, 8, 0],
  [-6, 2, 6],
  [7, 2, 6],
  [0, -7, 0],
  [0, -3, 12],
  [-14, 10, 0],
  [14, 10, 0],
  [-7, 11, 6],
  [8, 11, 6],
  [0, 5, 12],
];
const MAX_COINS = 16;
const MAX_CASH = CASH_SPOTS.length;

interface Piece {
  s: Sprite;
  pop: number;
}

export class PileView {
  readonly node = new Container();
  private readonly coins: Piece[] = [];
  private readonly cash: Piece[] = [];
  private readonly glint: Sprite;
  private shown = 0;
  private waitT = 0;
  private glintT = 1;
  private glintAge = -1;
  private lastCoins = -1;
  private lastCash = -1;

  constructor(
    private readonly pile: CoinPile,
    private readonly atlas: Atlas,
    private readonly unit: number,
  ) {
    this.node.position.set(pile.x, pile.y);
    this.node.zIndex = pile.y;
    this.glint = new Sprite(atlas.get('glint'));
    this.glint.visible = false;
    this.node.addChild(this.glint);
  }

  /** Coins from a departing van landed here. */
  land(amount: number): void {
    this.shown = Math.min(this.pile.value, this.shown + amount);
    this.waitT = 0;
  }

  /** Visual pieces for a value: coins first, then a banknote bundle per 20 payouts (big piles). */
  private pieces(value: number): { coins: number; cash: number } {
    if (value <= 0) return { coins: 0, cash: 0 };
    const units = Math.max(1, Math.round(value / this.unit));
    if (units <= MAX_COINS) return { coins: units, cash: 0 };
    const cash = Math.min(MAX_CASH, Math.floor(units / 20));
    const coins = Math.max(8, Math.min(MAX_COINS, units - cash * 20));
    return { coins, cash };
  }

  update(dt: number): void {
    const v = this.pile.value;
    if (v < this.shown) this.shown = v; // collected
    else if (v > this.shown) {
      // Value arrived without flying coins (loaded save): catch up after a moment.
      this.waitT += dt;
      if (this.waitT > 1.4) this.shown = v;
    }
    const { coins, cash } = this.pieces(this.shown);
    if (coins !== this.lastCoins || cash !== this.lastCash) this.layout(coins, cash);
    for (const p of [...this.coins, ...this.cash]) {
      if (p.pop < 1 && p.s.visible) {
        p.pop = Math.min(1, p.pop + dt / 0.28);
        const k = p.pop;
        p.s.scale.set(k < 0.6 ? 0.3 + (k / 0.6) * 0.9 : 1.2 - ((k - 0.6) / 0.4) * 0.2);
      }
    }
    this.updateGlint(dt, coins + cash);
  }

  private piece(list: Piece[], tex: string): Piece {
    const p: Piece = { s: new Sprite(this.atlas.get(tex)), pop: 0 };
    list.push(p);
    this.node.addChild(p.s);
    return p;
  }

  private layout(coins: number, cash: number): void {
    const grewCoins = coins > this.lastCoins;
    const grewCash = cash > this.lastCash;
    const oldCoins = Math.max(0, this.lastCoins);
    const oldCash = Math.max(0, this.lastCash);
    this.lastCoins = coins;
    this.lastCash = cash;
    while (this.coins.length < coins) this.piece(this.coins, 'coin');
    while (this.cash.length < cash) this.piece(this.cash, 'cash');
    // Small piles stack coins into towers in the middle; with bundles they ring the outside.
    const coinSpots = cash > 0 ? COIN_SPOTS.slice(6) : COIN_SPOTS.slice(0, 6);
    for (let i = 0; i < this.coins.length; i++) {
      const p = this.coins[i]!;
      p.s.visible = i < coins;
      const spot = coinSpots[i % coinSpots.length]!;
      const level = Math.floor(i / coinSpots.length);
      p.s.position.set(spot[0]!, spot[1]! - level * 2.8);
      p.s.zIndex = spot[1]! + level * 0.1;
      if (grewCoins && i >= oldCoins && i < coins) p.pop = 0;
    }
    for (let i = 0; i < this.cash.length; i++) {
      const p = this.cash[i]!;
      p.s.visible = i < cash;
      const [x, y, h] = CASH_SPOTS[i]!;
      p.s.position.set(x!, y! - h!);
      p.s.zIndex = y! + h! * 0.1 - 0.05;
      if (grewCash && i >= oldCash && i < cash) p.pop = 0;
    }
    this.node.sortableChildren = true;
    this.glint.zIndex = 999;
  }

  private updateGlint(dt: number, count: number): void {
    if (this.glintAge >= 0) {
      this.glintAge += dt;
      const k = this.glintAge / 0.45;
      this.glint.scale.set(Math.sin(Math.min(1, k) * Math.PI) * 0.8);
      this.glint.rotation += dt * 3;
      if (k >= 1) {
        this.glintAge = -1;
        this.glint.visible = false;
      }
      return;
    }
    if (count === 0) return;
    this.glintT -= dt;
    if (this.glintT > 0) return;
    this.glintT = 0.7 + Math.random() * 1.2;
    const all = [...this.coins, ...this.cash].filter((p) => p.s.visible);
    const target = all[Math.floor(Math.random() * all.length)];
    if (!target) return;
    this.glint.position.set(target.s.x + (Math.random() - 0.5) * 8, target.s.y - 4 - Math.random() * 4);
    this.glint.visible = true;
    this.glintAge = 0;
  }
}
