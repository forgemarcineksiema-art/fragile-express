// Economy formulas and tuning values. Everything the pacing simulator tunes lives here or in locations/*.json.
import type { ParcelKind, WorkerRole } from './types.ts';

/** Payout base: W = BASE_PAYOUT Ă— M_lok Ă— kind multiplier. */
export const BASE_PAYOUT = 5;
/** Cost growth per level: C_k = C0 Ă— COST_GROWTH^k. */
export const COST_GROWTH = 1.35;

export const KIND_MULT: Record<ParcelKind, number> = {
  normal: 1,
  fragile: 3,
  express: 1,
  xxl: 6,
};
/** Express premium when loaded into the van before the deadline. */
export const EXPRESS_BONUS = 0.5;

export function payout(kind: ParcelKind, locMult: number, onTime: boolean): number {
  let w = BASE_PAYOUT * locMult * KIND_MULT[kind];
  if (kind === 'express' && onTime) w *= 1 + EXPRESS_BONUS;
  return Math.round(w);
}

export function levelCost(c0: number, level: number, scale = 1): number {
  return Math.round(c0 * scale * Math.pow(COST_GROWTH, level));
}

/** Upgradeable stats. `c0` is the base cost in the first location (scaled by location costScale). */
export type StatKey =
  | 'player.capacity'
  | 'player.speed'
  | 'player.stability'
  | 'belt.speed'
  | 'van.capacity'
  | 'sorter.capacity'
  | 'sorter.speed'
  | 'loader.capacity'
  | 'loader.speed'
  | 'collector.capacity'
  | 'collector.speed';

export interface StatDef {
  c0: number;
  max: number;
}

export const STATS: Record<StatKey, StatDef> = {
  'player.capacity': { c0: 30, max: 14 },
  'player.speed': { c0: 40, max: 8 },
  'player.stability': { c0: 60, max: 5 },
  'belt.speed': { c0: 50, max: 8 },
  'van.capacity': { c0: 60, max: 6 },
  'sorter.capacity': { c0: 70, max: 6 },
  'sorter.speed': { c0: 70, max: 5 },
  'loader.capacity': { c0: 70, max: 6 },
  'loader.speed': { c0: 70, max: 5 },
  'collector.capacity': { c0: 60, max: 5 },
  'collector.speed': { c0: 60, max: 5 },
};

export const isStatKey = (s: string): s is StatKey => s in STATS;

// ---------------------------------------------------------------------------------------------
// Movement and carrying
// ---------------------------------------------------------------------------------------------

export const PLAYER_BASE_CAPACITY = 6;
export const PLAYER_BASE_SPEED = 205; // world units per second
export const PLAYER_SPEED_STEP = 0.07; // +7% per level
export const CAREFUL_SPEED_FACTOR = 0.5;
/** Velocity easing rates (1/s): higher is snappier. */
export const PLAYER_ACCEL = 18;
export const PLAYER_BRAKE = 24;
export const WORKER_ACCEL = 10;
export const PLAYER_RADIUS = 15;

export const WORKER_BASE_CAPACITY: Record<WorkerRole, number> = { sorter: 3, loader: 3, collector: 0 };
export const WORKER_BASE_SPEED = 120;
export const WORKER_SPEED_STEP = 0.14;
/** Workers walk slowly and never break fragile parcels. */
export const WORKER_FRAGILE_SPEED_FACTOR = 0.7;
/** Coin collector: how much it carries per trip, in units of one parcel payout. */
export const COLLECTOR_BASE_TRIP = 60;
export const COLLECTOR_TRIP_STEP = 0.6;

/** Seconds between single parcel transfers. */
export const PLAYER_TRANSFER_INTERVAL = 0.085;
export const WORKER_TRANSFER_INTERVAL = 0.16;

export function playerCapacity(level: number): number {
  return PLAYER_BASE_CAPACITY + level;
}
export function playerSpeed(level: number): number {
  return PLAYER_BASE_SPEED * (1 + PLAYER_SPEED_STEP * level);
}
export function workerCapacity(role: WorkerRole, level: number): number {
  return WORKER_BASE_CAPACITY[role] + level;
}
export function workerSpeed(level: number): number {
  return WORKER_BASE_SPEED * (1 + WORKER_SPEED_STEP * level);
}
export function collectorTrip(level: number, locMult: number): number {
  return Math.round(COLLECTOR_BASE_TRIP * BASE_PAYOUT * locMult * (1 + COLLECTOR_TRIP_STEP * level));
}

// ---------------------------------------------------------------------------------------------
// Fragile parcels
// ---------------------------------------------------------------------------------------------

export const FRAGILE = {
  /** A stack with a fragile parcel wobbles when it holds more than this many parcels... */
  safeCount: 3,
  /** ...or when the carrier has been running for longer than this (seconds). */
  runGrace: 2,
  /** Seconds for the wobble bar to fill at stability level 0. */
  fillTime: 1.7,
  /** Wobble bar drain per second when the stack is calm. */
  decay: 0.55,
  /** Each stability level slows the wobble by this fraction. */
  stabilityStep: 0.14,
  /** Wobble left after a parcel breaks (gives a short breather). */
  afterBreak: 0.35,
  /** Careful walk (Shift / small stick tilt) wobble factor. The design says careful walk never wobbles. */
  carefulFactor: 0,
};

// ---------------------------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------------------------

export const BELT_SPEED_STEP = 0.22; // spawn rate +22% per level
export const VAN_BASE_CAPACITY = 8;
export const VAN_CAPACITY_STEP = 2;
export const VAN_LEAVE_TIME = 1.0;
export const VAN_AWAY_TIME = 3;
export const VAN_ARRIVE_TIME = 1.4;
/** Seconds between parcels moving from the dock pallet into an arrived van. */
export const PALLET_LOAD_INTERVAL = 0.07;

export function vanCapacity(level: number): number {
  return VAN_BASE_CAPACITY + VAN_CAPACITY_STEP * level;
}
export function beltInterval(base: number, level: number): number {
  return base / (1 + BELT_SPEED_STEP * level);
}

// ---------------------------------------------------------------------------------------------
// Buy pads and rewarded floor zones
// ---------------------------------------------------------------------------------------------

/** Standing on a pad starts paying after this delay, so walking across one does not drain coins. */
export const PAD_DELAY = 0.2;
/** A purchase takes about this long when the player can afford it. */
export const PAD_FILL_TIME = 1.1;
/** Rewarded floor zones start the ad after standing this long. */
export const AD_PAD_HOLD = 1;
export const TURBO_DURATION = 180;
export const TURBO_MULT = 2;
export const HELPER_DURATION = 180;
/** A rewarded zone (turbo / helper) appears about every 3 minutes and waits this long. */
export const AD_SPOT_PERIOD = 180;
export const AD_SPOT_LIFETIME = 45;
/** "Upgrade now" zone is offered when the player misses at most this fraction of the price. */
export const ASSIST_MAX_MISSING = 0.5;
export const ASSIST_LIFETIME = 12;

// ---------------------------------------------------------------------------------------------
// Offline earnings
// ---------------------------------------------------------------------------------------------

export const OFFLINE_FACTOR = 0.5;
export const OFFLINE_MAX_SECONDS = 2 * 60 * 60;
export const OFFLINE_MIN_SECONDS = 60;

// Courier orders: player-only jobs that pay well above a van run and keep the player busy once
// workers run the depot.
/** First order this long after the first worker is hired. */
export const COURIER_FIRST_DELAY = 18;
/** Pause between orders. */
export const COURIER_GAP_MIN = 28;
export const COURIER_GAP_MAX = 55;
/** How long the courier waits at the counter. */
export const COURIER_WAIT_BASE = 32;
export const COURIER_WAIT_PER_ITEM = 11;
/** Walking in from the door or back out. */
export const COURIER_WALK = 2.2;
/** Each parcel handed over pays this many times its van payout. */
export const COURIER_PAY = 4;
/** Completing the whole order adds this share of its value. */
export const COURIER_BONUS = 0.5;

// Rewarded offers at the moment of need.
/** Cash parcel: offered on a pad the player cannot afford (more than the assist share missing). */
export const CASH_SHARE = 0.4;
export const CASH_LIFETIME = 12;
/** Minimum time between two cash offers. */
export const CASH_COOLDOWN = 150;
/** Bubble wrap: fragile parcels in the player's stack do not wobble for this long. */
export const BUBBLE_DURATION = 180;
/** Offered right after a fragile parcel breaks. */
export const BUBBLE_LIFETIME = 25;
export const BUBBLE_COOLDOWN = 120;
