// Text helpers. System fonts only: the game makes no network requests besides the Poki SDK.
import { Text, type TextStyleOptions } from 'pixi.js';

export const FONT = '"Trebuchet MS", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function label(text: string, size: number, fill: number | string = 0xffffff, extra: Partial<TextStyleOptions> = {}): Text {
  const tx = new Text({
    text,
    style: {
      fontFamily: FONT,
      fontSize: size,
      fontWeight: '900',
      fill,
      stroke: { color: 0x2a2238, width: Math.max(2, size * 0.18), join: 'round' },
      ...extra,
    },
    resolution: 2,
  });
  tx.anchor.set(0.5);
  return tx;
}

/** Sets text only when it changed (Text re-renders a canvas on every change). */
export function setText(tx: Text, value: string): void {
  if (tx.text !== value) tx.text = value;
}

export function formatCoins(v: number): string {
  const n = Math.floor(v);
  if (n < 10_000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(n < 100_000_000 ? 1 : 0).replace(/\.0$/, '')}M`;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
