// Development-only: stages scenes in the live game and records Poki store assets through the dev
// server (POST /__promo): a text-free static thumbnail and an animated MP4 thumbnail.
// Poki specs: static ≥ 628×628, square, no text; animated 1080×1080, ≥ 50 fps, 4–6 s, .mp4,
// 2–3 scenes of 1–2 s, no UI. Run __dev.thumbnails() in the console of `npm run dev`.
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { Rectangle, type Application } from 'pixi.js';
import type { Camera } from './game/camera.ts';
import type { WorldView } from './game/world.ts';
import { PlayerBot } from './sim/bot.ts';
import { getLocation } from './sim/locations.ts';
import type { Parcel, ParcelKind } from './sim/types.ts';
import { Warehouse } from './sim/warehouse.ts';

interface Intent {
  x: number;
  y: number;
  careful: boolean;
}

export interface PromoHost {
  app: Application;
  wh: Warehouse;
  world: WorldView;
  camera: Camera;
  input: { read: () => Intent };
  frame: (dt: number) => void;
  enterLocation: (wh: Warehouse) => void;
}

const FPS = 60;
const OUT = 1080;

async function post(blob: Blob, name: string): Promise<void> {
  await fetch(`/__promo?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
}

/** A scripted stage: builds the depot, then scenes drive the player and the camera frame by frame. */
class Stage {
  intent: Intent = { x: 0, y: 0, careful: false };
  private nextId = 900000;

  constructor(private readonly h: PromoHost) {}

  get wh(): Warehouse {
    return this.h.wh;
  }

  build(): void {
    const wh = new Warehouse(getLocation('poczta'), null, { seed: 7, noAds: true });
    Object.assign(wh.levels, {
      'player.capacity': 4,
      district1: 1,
      hire_sorter: 1,
      hire_loader: 1,
      hire_collector: 1,
      'sorter.capacity': 2,
      'loader.capacity': 2,
      'belt.speed': 2,
    });
    wh.applyLevels();
    wh.fragileActive = true;
    // Warm up headless so shelves, belt and workers look busy.
    const bot = new PlayerBot(wh);
    for (let t = 0; t < 70; t += 1 / 60) {
      bot.update(1 / 60);
      wh.step(1 / 60);
    }
    wh.drainEvents();
    this.h.enterLocation(wh);
    this.h.world.cinematic = true;
    this.h.world.daylight.fixed = 0.3;
    this.h.input.read = () => this.intent;
  }

  /** Replaces the player's stack. */
  stack(kinds: [ParcelKind, number, boolean][]): void {
    const wh = this.wh;
    const p = wh.player;
    for (const q of p.stack) wh.parcels.delete(q.id);
    p.stack = [];
    for (const [kind, district, sorted] of kinds) {
      const parcel: Parcel = { id: this.nextId++, district, kind, sorted, deadline: 0, onTime: false, hop: 0 };
      wh.parcels.set(parcel.id, parcel);
      p.stack.push(parcel);
    }
    p.capacity = Math.max(p.capacity, kinds.length);
  }

  place(x: number, y: number): void {
    const p = this.wh.player;
    p.x = p.px = x;
    p.y = p.py = y;
    p.vx = p.vy = 0;
  }

  /** Points the camera so that `span` world units fill the square capture. */
  aim(x: number, y: number, span: number, side: number): void {
    const cam = this.h.camera;
    cam.fixedZoom = side / span;
    cam.resize(this.h.app.screen.width, this.h.app.screen.height);
    cam.pin = { x, y };
  }
}

interface Scene {
  frames: number;
  /** World units across the square capture. */
  span: number;
  setup: (s: Stage) => void;
  /** Called before every frame; `i` counts from 0 within the scene. */
  tick: (s: Stage, i: number) => void;
  focus: (s: Stage) => { x: number; y: number };
}

const SCENES: Scene[] = [
  // 1. Running with a tall wobbling stack; the top fragile parcel shatters.
  {
    frames: 108,
    span: 430,
    setup: (s) => {
      s.stack([
        ['normal', 0, false],
        ['normal', 1, false],
        ['normal', 0, false],
        ['express', 1, false],
        ['normal', 0, false],
        ['fragile', 1, false],
        ['normal', 0, false],
        ['fragile', 0, false],
        ['normal', 1, false],
      ]);
      s.place(230, 445);
      s.wh.player.wobble = 0.3;
      s.intent = { x: 1, y: 0.02, careful: false };
    },
    tick: () => {},
    focus: (s) => ({ x: s.wh.player.x + 30, y: s.wh.player.y - 95 }),
  },
  // 2. Loading the van: parcels hop in, the van dips, fills and drives off leaving coins.
  {
    frames: 102,
    span: 560,
    setup: (s) => {
      const dock = s.wh.docks[0]!;
      const van = dock.vans[0]!;
      van.state = 'loading';
      van.t = 0;
      for (const q of van.items) s.wh.parcels.delete(q.id);
      van.items = [];
      for (const q of dock.pallet) s.wh.parcels.delete(q.id);
      dock.pallet = [];
      s.stack([
        ['normal', 0, true],
        ['normal', 0, true],
        ['fragile', 0, true],
        ['normal', 0, true],
        ['normal', 0, true],
        ['normal', 0, true],
        ['normal', 0, true],
        ['fragile', 0, true],
      ]);
      s.wh.player.wobble = 0;
      s.place(dock.geom.stand.x - 110, dock.geom.stand.y + 10);
      s.intent = { x: 1, y: -0.05, careful: true };
    },
    tick: (s, i) => {
      if (i === 14) s.intent = { x: 1, y: -0.05, careful: false };
      if (i === 30) s.intent = { x: 0, y: 0, careful: false };
    },
    focus: (s) => ({ x: s.wh.docks[0]!.geom.bay.x - 70, y: s.wh.docks[0]!.geom.y - 10 }),
  },
  // 3. The depot running on its own: the truck being unloaded, the belt, workers and shelves.
  {
    frames: 90,
    span: 600,
    setup: (s) => {
      s.stack([]);
      s.place(470, 250);
      s.intent = { x: 0, y: 0, careful: false };
    },
    tick: () => {},
    focus: () => ({ x: 130, y: 250 }),
  },
];

export async function makeThumbnails(host: PromoHost): Promise<string[]> {
  const app = host.app;
  const orig = host.input.read;
  app.ticker.stop();
  const side = Math.floor(Math.min(app.screen.width, app.screen.height));
  const frameRect = new Rectangle(Math.floor((app.screen.width - side) / 2), Math.floor((app.screen.height - side) / 2), side, side);
  const grab = (): HTMLCanvasElement =>
    app.renderer.extract.canvas({ target: app.stage, frame: frameRect, resolution: OUT / side }) as HTMLCanvasElement;
  const saved: string[] = [];
  const stage = new Stage(host);
  stage.build();

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: OUT, height: OUT, frameRate: FPS },
    fastStart: 'in-memory',
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure({ codec: 'avc1.640033', width: OUT, height: OUT, bitrate: 16_000_000, framerate: FPS });
  let n = 0;
  let still: HTMLCanvasElement | null = null;
  for (let si = 0; si < SCENES.length; si++) {
    const sc = SCENES[si]!;
    sc.setup(stage);
    for (let i = 0; i < sc.frames; i++) {
      sc.tick(stage, i);
      const f = sc.focus(stage);
      stage.aim(f.x, f.y, sc.span, side);
      host.frame(1 / FPS);
      app.render();
      if (si === 0 && i === 52) {
        // Static thumbnail: a tighter shot mid-run, stack swaying, just before the crack.
        stage.aim(f.x + 30, f.y + 5, 370, side);
        host.camera.update(0, 0, 0, 0, 0);
        host.camera.apply(host.world.root, 0);
        app.render();
        const shot = grab();
        still = document.createElement('canvas');
        still.width = still.height = OUT;
        still.getContext('2d')!.drawImage(shot, 0, 0, OUT, OUT);
        stage.aim(f.x, f.y, sc.span, side);
        host.camera.update(0, 0, 0, 0, 0);
        host.camera.apply(host.world.root, 0);
        app.render();
      }
      const canvas = grab();
      const vf = new VideoFrame(canvas, { timestamp: Math.round((n * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(vf, { keyFrame: n % FPS === 0 });
      vf.close();
      n++;
      while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
    }
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  muxer.finalize();
  await post(new Blob([muxer.target.buffer], { type: 'video/mp4' }), 'animated_thumbnail_1080.mp4');
  saved.push('animated_thumbnail_1080.mp4');
  if (still) {
    const s: HTMLCanvasElement = still;
    const png = await new Promise<Blob | null>((r) => s.toBlob(r, 'image/png'));
    if (png) {
      await post(png, 'thumbnail_1080.png');
      saved.push('thumbnail_1080.png');
    }
  }

  // Back to normal play.
  host.input.read = orig;
  host.world.cinematic = false;
  host.world.daylight.fixed = null;
  host.camera.fixedZoom = null;
  host.camera.pin = null;
  host.camera.resize(app.screen.width, app.screen.height);
  app.ticker.start();
  return saved;
}
