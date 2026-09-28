// Location data (locations/*.json) and the geometry derived from it.
// JSON only places things; station shapes and zone sizes are defined here so every location reads the same.
import { rect, type Rect, type Vec } from '../core/math.ts';
import type { StatKey } from './economy.ts';
import type { WorkerRole } from './types.ts';

export type PadType = 'upgrade' | 'district' | 'hire' | 'van2' | 'move';

export interface PadJson {
  id: string;
  type: PadType;
  stat?: StatKey;
  district?: number;
  role?: WorkerRole;
  /** Base cost override (before location costScale). */
  c0?: number;
  /** Max level override for upgrades. */
  max?: number;
  /**
   * Stage gating for upgrades. Stage = milestone pads bought in this location (districts, hires,
   * second vans). `unlock[i]` is the stage at which level i+1 becomes available; past the last entry
   * one more level opens every `every` stages. Keeps the unlock order readable and tunable.
   */
  unlock?: number[];
  every?: number;
  /** Fixed cost (move pad), already in this location's coins. */
  cost?: number;
  /** Free placement. */
  at?: [number, number];
  /** Office grid placement: [column, row]; columns are player, sorter, loader, collector. */
  slot?: [number, number];
  /** Pad ids that must be bought first; "@fragile" waits for fragile parcels. */
  requires?: string[];
  /** Pan the camera to the pad when it first appears. */
  reveal?: boolean;
}

export interface BeltJson {
  at: [number, number];
  length: number;
  /** Seconds between parcels at belt level 0. */
  interval: number;
  /** Belt surface speed, world units per second. */
  speed: number;
  maxItems: number;
  /** Parcels waiting at the end of the belt when the location starts fresh. */
  preload?: number;
}

export interface FeaturesJson {
  /** Location time (s) when fragile parcels start; null = from the start. */
  fragileAt: number | null;
  fragileChance: number;
  expressChance: number;
  /** Seconds an express parcel has to reach a van. */
  expressTime: number;
  xxlChance: number;
}

export interface LocationJson {
  id: string;
  /** i18n key of the location name. */
  name: string;
  next: string | null;
  theme: 'post' | 'city' | 'hub';
  multiplier: number;
  costScale: number;
  size: [number, number];
  spawn: [number, number];
  startCoins: number;
  districts: number;
  startDistricts: number;
  shelfCapacity: number;
  /** Parcels already loaded in the first van on a fresh start (shortens the first payout). */
  vanPreload: number;
  features: FeaturesJson;
  /** Bigger depots have more experienced staff: extra carry capacity and a speed multiplier. */
  workers?: { capacity?: number; speed?: number };
  belts: BeltJson[];
  /** Shelf centre per district, in district order. */
  shelves: [number, number][];
  /** Dock centre y per district; docks sit on the right wall. */
  docks: number[];
  /** Origin (first pad centre) of the office pad grid. */
  office: [number, number];
  /** Cash desk centre; the coin collector deposits here. */
  safe: [number, number];
  /** Where rewarded floor zones (turbo / helper) may appear. */
  adSpots: [number, number][];
  /** Extra navigation points for workers; zone centres are added automatically. */
  waypoints: [number, number][];
  obstacles?: [number, number, number, number][];
  pads: PadJson[];
}

// ---------------------------------------------------------------------------------------------
// Geometry constants
// ---------------------------------------------------------------------------------------------

export const WALL = 24;
export const BACK_WALL = 70;
export const BELT_HALF = 22;
export const BELT_ZONE = { w: 92, h: 104 };
export const SHELF_BODY = { w: 60, h: 150 };
export const SHELF_ZONE = { w: 78, h: 112 };
export const DOCK_ZONE = { w: 96, h: 100 };
export const PILE_RADIUS = 36;
export const SAFE_BODY = { w: 84, h: 52 };
export const SAFE_ZONE = { w: 96, h: 62 };
export const PAD_SIZE = 78;
export const AD_PAD_SIZE = 86;
export const OFFICE_COL = 98;
export const OFFICE_ROW = 94;
export const VAN_LENGTH = 168;
export const VAN_DEPTH = 70;

export interface BeltGeom {
  x0: number;
  y: number;
  length: number;
  body: Rect;
  zone: Rect;
  /** Where carriers stand to pick up. */
  stand: Vec;
}

export interface ShelfGeom {
  cx: number;
  cy: number;
  body: Rect;
  inZone: Rect;
  outZone: Rect;
  inStand: Vec;
  outStand: Vec;
}

export interface DockGeom {
  y: number;
  zone: Rect;
  stand: Vec;
  /** Centre of a parked van (outside the right wall). */
  bay: Vec;
  pile: Vec;
}

export interface Layout {
  w: number;
  h: number;
  walls: Rect[];
  belts: BeltGeom[];
  shelves: ShelfGeom[];
  docks: DockGeom[];
  safe: { body: Rect; zone: Rect; stand: Vec };
  office: Rect;
  officeOrigin: Vec;
  extra: Rect[];
  waypoints: Vec[];
  spawn: Vec;
}

const centred = (cx: number, cy: number, w: number, h: number): Rect => rect(cx - w / 2, cy - h / 2, w, h);

export function beltGeom(b: BeltJson): BeltGeom {
  const [x0, y] = b.at;
  const endX = x0 + b.length;
  const zone = rect(endX, y - BELT_ZONE.h / 2, BELT_ZONE.w, BELT_ZONE.h);
  return {
    x0,
    y,
    length: b.length,
    body: rect(x0, y - BELT_HALF, b.length, BELT_HALF * 2),
    zone,
    stand: { x: endX + BELT_ZONE.w / 2, y },
  };
}

export function shelfGeom(cx: number, cy: number): ShelfGeom {
  const body = centred(cx, cy, SHELF_BODY.w, SHELF_BODY.h);
  const inZone = rect(body.x - SHELF_ZONE.w, cy - SHELF_ZONE.h / 2, SHELF_ZONE.w, SHELF_ZONE.h);
  const outZone = rect(body.x + body.w, cy - SHELF_ZONE.h / 2, SHELF_ZONE.w, SHELF_ZONE.h);
  return {
    cx,
    cy,
    body,
    inZone,
    outZone,
    inStand: { x: inZone.x + inZone.w / 2, y: cy },
    outStand: { x: outZone.x + outZone.w / 2, y: cy },
  };
}

export function dockGeom(w: number, y: number): DockGeom {
  const wallX = w - WALL;
  const zone = rect(wallX - DOCK_ZONE.w, y - DOCK_ZONE.h / 2, DOCK_ZONE.w, DOCK_ZONE.h);
  return {
    y,
    zone,
    stand: { x: zone.x + zone.w / 2, y },
    bay: { x: w + VAN_LENGTH / 2 + 6, y },
    pile: { x: zone.x + zone.w / 2 - 6, y: y + DOCK_ZONE.h / 2 + PILE_RADIUS + 8 },
  };
}

export function officeSlot(origin: Vec, col: number, row: number): Vec {
  return { x: origin.x + col * OFFICE_COL, y: origin.y + row * OFFICE_ROW };
}

export function buildLayout(loc: LocationJson): Layout {
  const [w, h] = loc.size;
  const walls = [
    rect(-400, -400, w + 800, 400 + BACK_WALL), // back wall and everything behind it
    rect(-400, h - WALL, w + 800, 400 + WALL), // front wall
    rect(-400, 0, 400 + WALL, h), // left wall
    rect(w - WALL, 0, 400 + WALL, h), // right wall
  ];
  const [sx, sy] = loc.safe;
  const safeBody = centred(sx, sy, SAFE_BODY.w, SAFE_BODY.h);
  const safeZone = rect(sx - SAFE_ZONE.w / 2, safeBody.y + safeBody.h, SAFE_ZONE.w, SAFE_ZONE.h);
  const origin = { x: loc.office[0], y: loc.office[1] };
  let cols = 4;
  let rows = 3;
  for (const p of loc.pads) {
    if (!p.slot) continue;
    cols = Math.max(cols, p.slot[0] + 1);
    rows = Math.max(rows, p.slot[1] + 1);
  }
  const office = rect(origin.x - 62, origin.y - 96, OFFICE_COL * (cols - 1) + 124, OFFICE_ROW * (rows - 1) + 150);
  return {
    w,
    h,
    walls,
    belts: loc.belts.map(beltGeom),
    shelves: loc.shelves.map(([x, y]) => shelfGeom(x, y)),
    docks: loc.docks.map((y) => dockGeom(w, y)),
    safe: { body: safeBody, zone: safeZone, stand: { x: sx, y: safeZone.y + safeZone.h / 2 } },
    office,
    officeOrigin: origin,
    extra: (loc.obstacles ?? []).map(([x, y, ow, oh]) => rect(x, y, ow, oh)),
    waypoints: loc.waypoints.map(([x, y]) => ({ x, y })),
    spawn: { x: loc.spawn[0], y: loc.spawn[1] },
  };
}

/** Pad centre from `at` or the office `slot`. */
export function padPosition(layout: Layout, pad: PadJson): Vec {
  if (pad.at) return { x: pad.at[0], y: pad.at[1] };
  if (pad.slot) return officeSlot(layout.officeOrigin, pad.slot[0], pad.slot[1]);
  throw new Error(`pad ${pad.id} has neither "at" nor "slot"`);
}
