// Colours shared by every drawing function. Districts carry a colour AND a symbol so colour-blind
// players can still sort by shape.

export const DISTRICT_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xa855f7, 0xf97316];
export const DISTRICT_CSS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316'];
export type SymbolKind = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'heart';
export const DISTRICT_SYMBOLS: SymbolKind[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart'];

export const INK = 0x2a2238;
export const WHITE = 0xffffff;
export const COIN = 0xfbbf24;
export const COIN_DARK = 0xd97706;
export const COIN_LIGHT = 0xfde68a;
export const PAD_GREEN = 0x22c55e;
export const AD_PURPLE = 0x8b5cf6;
export const BRAND = 0xf97316; // Fragile orange
export const BRAND_RED = 0xdc2626;

export const ROLE_SHIRT: Record<string, number> = {
  player: 0xf97316,
  sorter: 0x16a34a,
  loader: 0x2563eb,
  collector: 0xeab308,
  helper: 0x9333ea,
};

export interface Theme {
  outside: number;
  outsideLine: number;
  grass: number;
  floor: number;
  floorAlt: number;
  grout: number;
  wallTop: number;
  wallFace: number;
  wallTrim: number;
  office: number;
  officeEdge: number;
  sign: number;
}

export const THEMES: Record<string, Theme> = {
  post: {
    outside: 0x6b7280,
    outsideLine: 0xe5e7eb,
    grass: 0x86c06c,
    floor: 0xf1e4cc,
    floorAlt: 0xebdcc0,
    grout: 0xdcc9a8,
    wallTop: 0xf8e7c8,
    wallFace: 0xd9b98a,
    wallTrim: 0xb4885a,
    office: 0x9cc9e6,
    officeEdge: 0x6fa6cc,
    sign: 0xdc2626,
  },
  city: {
    outside: 0x5b6470,
    outsideLine: 0xf5f5f4,
    grass: 0x7fb069,
    floor: 0xd9dee4,
    floorAlt: 0xd1d7de,
    grout: 0xc3cad3,
    wallTop: 0xe4e9ef,
    wallFace: 0x9aa9ba,
    wallTrim: 0x6f8196,
    office: 0xb9d98a,
    officeEdge: 0x8fbc5a,
    sign: 0x2563eb,
  },
  hub: {
    outside: 0x4b5563,
    outsideLine: 0xfacc15,
    grass: 0x6ea35c,
    floor: 0xc9cdd3,
    floorAlt: 0xc1c6cd,
    grout: 0xb3b9c1,
    wallTop: 0xd6dbe2,
    wallFace: 0x7c8797,
    wallTrim: 0x566173,
    office: 0xf2c78a,
    officeEdge: 0xd9a55a,
    sign: 0xf97316,
  },
};

/** Multiplies RGB channels; factor < 1 darkens, > 1 lightens (clamped). */
export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/** Mixes two colours, t = 0 → a, t = 1 → b. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number => Math.round((((a >> s) & 0xff) * (1 - t)) + (((b >> s) & 0xff) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
