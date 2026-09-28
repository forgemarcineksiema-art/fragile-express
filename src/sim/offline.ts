// Offline earnings: measured by running the same simulation headless with the player absent.
import { OFFLINE_FACTOR, OFFLINE_MAX_SECONDS, OFFLINE_MIN_SECONDS } from './economy.ts';
import type { LocationJson } from './layout.ts';
import type { LocationSave } from './save.ts';
import { Warehouse } from './warehouse.ts';

const WARMUP = 60;
const MEASURE = 180;
const STEP = 1 / 30;

/** Coins per second the workers earn on their own, measured after a warm-up. */
export function automationRate(loc: LocationJson, save: LocationSave): number {
  const wh = new Warehouse(loc, { ...save, coins: 0, turboLeft: 0 }, { noPlayer: true, noAds: true });
  if (!wh.isAutomated()) return 0;
  for (let t = 0; t < WARMUP; t += STEP) wh.step(STEP);
  const before = wh.coins;
  for (let t = 0; t < MEASURE; t += STEP) wh.step(STEP);
  wh.drainEvents();
  return Math.max(0, (wh.coins - before) / MEASURE);
}

export interface OfflineResult {
  seconds: number;
  coins: number;
  rate: number;
}

/** Earnings for `awaySeconds` of absence: half the automation rate, capped at 2 hours. */
export function offlineEarnings(loc: LocationJson, save: LocationSave, awaySeconds: number): OfflineResult | null {
  if (awaySeconds < OFFLINE_MIN_SECONDS) return null;
  const rate = automationRate(loc, save);
  if (rate <= 0) return null;
  const seconds = Math.min(awaySeconds, OFFLINE_MAX_SECONDS);
  const coins = Math.floor(rate * OFFLINE_FACTOR * seconds);
  return coins > 0 ? { seconds, coins, rate } : null;
}
