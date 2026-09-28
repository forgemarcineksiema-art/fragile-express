// Minimal dictionary-based i18n. Every visible string goes through `t()`.

export type Dict = Record<string, string>;

const dicts: Record<string, Dict> = {};
let current = 'en';
let fallback = 'en';
const listeners = new Set<() => void>();

export function registerLanguage(code: string, dict: Dict): void {
  dicts[code] = dict;
}

export function languages(): string[] {
  return Object.keys(dicts);
}

export function setFallback(code: string): void {
  fallback = code;
}

export function setLanguage(code: string): void {
  const next = dicts[code] ? code : fallback;
  if (next === current) return;
  current = next;
  for (const fn of listeners) fn();
}

export function language(): string {
  return current;
}

export function onLanguageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Picks the best registered language for a list of BCP-47 tags (e.g. navigator.languages). */
export function detectLanguage(tags: readonly string[]): string {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (dicts[lower]) return lower;
    const base = lower.split('-')[0]!;
    if (dicts[base]) return base;
  }
  return fallback;
}

/** Translates `key`, replacing `{name}` placeholders with `params`. Missing keys fall back, then echo the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[current]?.[key] ?? dicts[fallback]?.[key] ?? key;
  if (params) {
    for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}
