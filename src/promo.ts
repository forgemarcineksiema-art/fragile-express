// Development-only: stages a scene in the live game and saves Poki thumbnails into promo/ through the
// dev server (POST /__promo). Run __dev.thumbnails() in the console of `npm run dev`.
import { Container, Graphics, Rectangle, Text, type Application } from 'pixi.js';
import { drawGlass } from './game/art.ts';
import type { Atlas } from './game/atlas.ts';
import { FONT } from './game/text.ts';
import type { Parcel } from './sim/types.ts';
import type { Warehouse } from './sim/warehouse.ts';

async function save(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('toBlob failed');
  await fetch(`/__promo?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
}

function logo(width: number): Container {
  const c = new Container();
  const title = new Text({
    text: 'FRAGILE EXPRESS',
    style: {
      fontFamily: FONT,
      fontSize: 64,
      fontWeight: '900',
      fill: 0xffffff,
      stroke: { color: 0x7c2d12, width: 12, join: 'round' },
      dropShadow: { color: 0x000000, alpha: 0.35, distance: 6, angle: Math.PI / 2, blur: 2 },
      letterSpacing: 2,
    },
    resolution: 2,
  });
  title.anchor.set(0.5, 0);
  const scale = Math.min(1, (width - 150) / title.width);
  title.scale.set(scale);
  const badge = new Graphics();
  const r = 34 * scale + 10;
  badge.circle(0, 0, r).fill(0xdc2626).stroke({ width: 6, color: 0xffffff });
  drawGlass(badge, 0, 0, r * 1.3, 0xffffff);
  badge.position.set(-title.width / 2 - r + 6, title.height / 2);
  c.addChild(badge, title);
  return c;
}

export interface PromoHost {
  app: Application;
  atlas: Atlas;
  wh: Warehouse;
  frame: (dt: number) => void;
  camera: { fixedZoom: number | null; resize: (w: number, h: number) => void; snap: (x: number, y: number) => void; viewW: number; viewH: number };
}

/** Builds a showcase moment: a tall wobbling stack with fragile parcels next to a van. */
export async function makeThumbnails(host: PromoHost): Promise<string[]> {
  const { app, wh } = host;
  const p = wh.player;
  // Stage the player: tall mixed stack, fragile parcels near the top, wobbling hard.
  for (const q of p.stack) wh.parcels.delete(q.id);
  p.stack = [];
  const kinds: Parcel['kind'][] = ['normal', 'normal', 'normal', 'express', 'normal', 'normal', 'fragile', 'normal', 'fragile', 'normal', 'fragile'];
  kinds.forEach((kind, i) => {
    const parcel: Parcel = { id: 800000 + i, district: i % 3 === 1 ? 1 : 0, kind, sorted: true, deadline: wh.time + 40, onTime: false, hop: 0 };
    wh.parcels.set(parcel.id, parcel);
    p.stack.push(parcel);
  });
  p.capacity = 20;
  wh.fragileActive = true;
  const dock = wh.docks[0]!;
  p.x = p.px = dock.geom.stand.x - 120;
  p.y = p.py = dock.geom.stand.y + 60;
  p.dirX = 1;
  p.dirY = 0.15;
  wh.piles[0]!.value = 40 * wh.loc.multiplier * 5;
  p.wobble = 0.82;
  p.moving = true;
  // Let views settle (parcels finish their hops) without moving the sim.
  const saved = wh.step.bind(wh);
  (wh as unknown as { step: (dt: number) => void }).step = () => {};
  for (let i = 0; i < 40; i++) host.frame(1 / 60);

  const cam = host.camera;
  const shots: string[] = [];
  const shoot = async (name: string, w: number, h: number, zoom: number, cx: number, cy: number, withLogo: boolean): Promise<void> => {
    cam.fixedZoom = zoom;
    cam.resize(app.screen.width, app.screen.height);
    cam.snap(cx, cy);
    host.frame(1 / 60);
    const overlay = logo(w);
    overlay.position.set(app.screen.width / 2, app.screen.height / 2 - h / 2 + 18);
    overlay.visible = withLogo;
    app.stage.addChild(overlay);
    app.render();
    const frame = new Rectangle(Math.round(app.screen.width / 2 - w / 2), Math.round(app.screen.height / 2 - h / 2), w, h);
    const canvas = app.renderer.extract.canvas({ target: app.stage, frame, resolution: 1 }) as HTMLCanvasElement;
    app.stage.removeChild(overlay);
    overlay.destroy({ children: true });
    await save(canvas, name);
    shots.push(name);
  };
  const fx = p.x + 130;
  const fy = p.y - 90;
  const side = Math.min(628, app.screen.width, app.screen.height);
  await shoot(`thumbnail_${side}.png`, side, side, 1.3 * (side / 628), fx, fy, true);
  await shoot('screenshot.png', app.screen.width, app.screen.height, 1.1, fx - 120, fy + 20, false);
  cam.fixedZoom = null;
  cam.resize(app.screen.width, app.screen.height);
  (wh as unknown as { step: (dt: number) => void }).step = saved;
  return shots;
}
