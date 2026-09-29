// Shared simulation types. Nothing here may import rendering code.

export type ParcelKind = 'normal' | 'fragile' | 'express' | 'xxl';

export interface Parcel {
  id: number;
  /** District index; also the colour index. */
  district: number;
  kind: ParcelKind;
  /** Set when the parcel has passed through a shelf; only sorted parcels go into vans. */
  sorted: boolean;
  /** Express deadline in sim time (seconds); 0 for other kinds. */
  deadline: number;
  /** Express parcel loaded into a van before its deadline. */
  onTime: boolean;
  /** Incremented whenever the parcel changes container, so the renderer can animate the hop. */
  hop: number;
}

export type Role = 'player' | 'sorter' | 'loader' | 'collector';
export type WorkerRole = Exclude<Role, 'player'>;
export const WORKER_ROLES: readonly WorkerRole[] = ['sorter', 'loader', 'collector'];

export type AdKind = 'turbo' | 'helper' | 'assist';
export type AdSize = 'small' | 'medium' | 'large';

/** Events emitted by the simulation for the renderer, audio and UI. */
export type SimEvent =
  | { type: 'spawn'; parcel: number; belt: number }
  | { type: 'pickup'; carrier: number; parcel: number; from: 'belt' | 'shelf' }
  | { type: 'drop'; carrier: number; parcel: number; to: 'shelf' | 'van' | 'pallet'; station: string }
  | { type: 'palletLoad'; dock: string; parcel: number }
  | { type: 'stamp'; carrier: number; parcel: number; station: string }
  | { type: 'break'; carrier: number; parcel: number; district: number; x: number; y: number; h: number }
  | { type: 'wobble'; carrier: number }
  | { type: 'vanDepart'; dock: string; coins: number; parcels: number }
  | { type: 'vanArrive'; dock: string }
  | { type: 'coinsDropped'; pile: string; amount: number }
  | { type: 'collect'; carrier: number; pile: string; amount: number }
  | { type: 'deposit'; carrier: number; amount: number }
  | { type: 'pay'; pad: string; amount: number }
  | { type: 'purchase'; pad: string; level: number; x: number; y: number; reveal: { x: number; y: number } | null }
  | { type: 'padShown'; pad: string; x: number; y: number; reveal: boolean }
  | { type: 'hired'; carrier: number; role: WorkerRole; temp: boolean }
  | { type: 'helperGone'; carrier: number }
  | { type: 'fragileIntro' }
  | { type: 'adPadShown'; pad: string; kind: AdKind }
  | { type: 'adRequest'; pad: string; kind: AdKind; size: AdSize }
  | { type: 'turboStart'; until: number }
  | { type: 'turboEnd' }
  | { type: 'locationComplete' };
