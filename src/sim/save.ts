// Save schema, validation and migration. Storage IO lives in the game layer.

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'fragile_express_save';

export interface LocationSave {
  loc: string;
  coins: number;
  /** Upgrade levels by stat key, and 1 for bought one-shot pads by pad id. */
  levels: Record<string, number>;
  /** Coins already paid into pads. */
  paid: Record<string, number>;
  locTime: number;
  turboLeft: number;
  nextAdAt: number;
  adCycle: number;
  stats: { delivered: number; broken: number; earned: number };
  seed: number;
}

export interface Settings {
  sfx: boolean;
  music: boolean;
  lang: string | null;
}

export interface SaveData {
  v: number;
  /** Date.now() when saved; drives offline earnings. */
  t: number;
  /** Lifetime seconds of gameplay (first 5 minutes are ad-free). */
  playTime: number;
  current: LocationSave;
  settings: Settings;
  /** One-time flags: tutorial steps, intros seen. */
  flags: Record<string, boolean>;
}

export const defaultSettings = (): Settings => ({ sfx: true, music: true, lang: null });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const k in v) if (typeof v[k] === 'number' && Number.isFinite(v[k])) out[k] = v[k] as number;
  return out;
};

function readLocation(v: unknown): LocationSave | null {
  if (!isObj(v) || typeof v.loc !== 'string') return null;
  const stats = isObj(v.stats) ? v.stats : {};
  return {
    loc: v.loc,
    coins: Math.max(0, num(v.coins)),
    levels: numMap(v.levels),
    paid: numMap(v.paid),
    locTime: Math.max(0, num(v.locTime)),
    turboLeft: Math.max(0, num(v.turboLeft)),
    nextAdAt: num(v.nextAdAt, 150),
    adCycle: Math.max(0, Math.floor(num(v.adCycle))),
    stats: { delivered: num(stats.delivered), broken: num(stats.broken), earned: num(stats.earned) },
    seed: num(v.seed, 12345) >>> 0,
  };
}

/** Parses and upgrades raw save data. Returns null when unusable (the game then starts fresh). */
export function migrate(raw: unknown): SaveData | null {
  if (!isObj(raw)) return null;
  const v = num(raw.v);
  if (v < 1 || v > SAVE_VERSION) return null;
  const current = readLocation(raw.current);
  if (!current) return null;
  const s = isObj(raw.settings) ? raw.settings : {};
  const flags: Record<string, boolean> = {};
  if (isObj(raw.flags)) for (const k in raw.flags) if (raw.flags[k] === true) flags[k] = true;
  return {
    v: SAVE_VERSION,
    t: num(raw.t, Date.now()),
    playTime: Math.max(0, num(raw.playTime)),
    current,
    settings: {
      sfx: s.sfx !== false,
      music: s.music !== false,
      lang: typeof s.lang === 'string' ? s.lang : null,
    },
    flags,
  };
}
