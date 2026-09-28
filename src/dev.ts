// Development-only console helpers (not included in production builds).
// __dev.sim(seconds, intent) steps the game manually (works even when the tab is hidden),
// __dev.go(x, y) walks the player to a world point, __dev.reset() wipes the save.
import type { Game } from './game/game.ts';
import { PlayerBot } from './sim/bot.ts';
import { SAVE_KEY } from './sim/save.ts';
import { getLocation } from './sim/locations.ts';
import { Warehouse as WarehouseCtor, type Warehouse } from './sim/warehouse.ts';

interface Intent {
  x: number;
  y: number;
  careful: boolean;
}

export function installDevTools(game: Game): void {
  const g = game as unknown as {
    frame: (dt: number) => void;
    input: { read: () => Intent };
    app: { render: () => void };
    wh: {
      player: { x: number; y: number; stack: unknown[]; wobble: number };
      time: number;
      coins: number;
      belts: { items: unknown[] }[];
    };
    state: string;
    writeSave: () => void;
  };
  const snapshot = (): Record<string, unknown> => {
    const p = g.wh.player;
    return {
      state: g.state,
      t: +g.wh.time.toFixed(2),
      x: Math.round(p.x),
      y: Math.round(p.y),
      stack: p.stack.length,
      coins: Math.round(g.wh.coins),
      wobble: +p.wobble.toFixed(2),
    };
  };
  const sim = (sec: number, intent?: Intent | null): Record<string, unknown> => {
    const orig = g.input.read;
    if (intent) g.input.read = () => intent;
    for (let i = 0; i < Math.round(sec * 60); i++) g.frame(1 / 60);
    g.input.read = orig;
    g.app.render();
    return snapshot();
  };
  const go = (tx: number, ty: number, careful = false, maxSec = 8): Record<string, unknown> => {
    for (let i = 0; i < maxSec * 20; i++) {
      const p = g.wh.player;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) break;
      sim(0.05, { x: dx / d, y: dy / d, careful });
    }
    return sim(1 / 60, { x: 0, y: 0, careful: false });
  };
  const wait = (sec: number): Record<string, unknown> => sim(sec, { x: 0, y: 0, careful: false });
  // Let the pacing bot play the live game for `sec` seconds (fast-forward for visual checks).
  let bot: PlayerBot | null = null;
  let botWh: unknown = null;
  const autoplay = (sec: number): Record<string, unknown> => {
    const wh = g.wh as unknown as Warehouse;
    if (!bot || botWh !== wh) {
      bot = new PlayerBot(wh);
      botWh = wh;
    }
    const orig = g.input.read;
    for (let i = 0; i < Math.round(sec * 60); i++) {
      bot.update(1 / 60);
      const intent = { ...wh.input };
      g.input.read = () => intent;
      g.frame(1 / 60);
    }
    g.input.read = orig;
    g.app.render();
    return snapshot();
  };
  /** Jump straight to a location with optional coins (for visual checks). */
  const gotoLocation = (id: string, coins = 0): Record<string, unknown> => {
    const loc = getLocation(id);
    const wh = new WarehouseCtor(loc, null);
    wh.coins = coins;
    (g as unknown as { enterLocation: (w: Warehouse) => void }).enterLocation(wh);
    return sim(0.1, null);
  };
  /** Zoom the camera out around a world point (null restores normal zoom). */
  const overview = (zoom: number | null, x = 0, y = 0): void => {
    const cam = (g as unknown as { camera: { fixedZoom: number | null; zoom: number; resize: (w: number, h: number) => void; viewW: number; viewH: number; snap: (x: number, y: number) => void } }).camera;
    cam.fixedZoom = zoom;
    cam.resize(cam.viewW, cam.viewH);
    if (zoom) {
      g.wh.player.x = x;
      g.wh.player.y = y;
    }
    cam.snap(x, y);
    sim(0.05, null);
  };
  const thumbnails = async (): Promise<string[]> => {
    const { makeThumbnails } = await import('./promo.ts');
    return makeThumbnails(game as unknown as import('./promo.ts').PromoHost);
  };
  const reset = (): void => {
    g.writeSave = () => {};
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  };
  (window as unknown as { __dev: unknown; __game: Game }).__dev = { sim, go, wait, reset, snapshot, autoplay, location: gotoLocation, overview, thumbnails };
  (window as unknown as { __game: Game }).__game = game;
}
