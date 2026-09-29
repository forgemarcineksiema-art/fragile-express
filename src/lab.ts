// Development-only character lab (open /lab.html on the dev server): every role in every facing,
// standing, walking and carrying, at game scale and magnified, animated live.
import { Application, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { Carrier } from './sim/carrier.ts';
import type { Parcel } from './sim/types.ts';
import { PARCEL } from './game/art.ts';
import { CharacterView, HANDS_Z } from './game/views/character.ts';
import { buildAtlas, parcelTex } from './game/textures.ts';

type Role = 'player' | 'sorter' | 'loader' | 'collector';
const ROLES: (Role | 'helper')[] = ['player', 'sorter', 'loader', 'collector', 'helper'];
const POSES: { name: string; dirX: number; dirY: number; walk: boolean; carry: number }[] = [
  { name: 'front', dirX: 0, dirY: 1, walk: false, carry: 0 },
  { name: 'front walk', dirX: 0, dirY: 1, walk: true, carry: 0 },
  { name: 'side', dirX: 1, dirY: 0, walk: false, carry: 0 },
  { name: 'side walk', dirX: 1, dirY: 0, walk: true, carry: 0 },
  { name: 'side left walk', dirX: -1, dirY: 0, walk: true, carry: 0 },
  { name: 'back walk', dirX: 0, dirY: -1, walk: true, carry: 0 },
  { name: 'front carry', dirX: 0, dirY: 1, walk: true, carry: 4 },
  { name: 'side carry', dirX: 1, dirY: 0, walk: true, carry: 4 },
];

interface Cell {
  view: CharacterView;
  carrier: Carrier;
  walk: boolean;
  parcels: Sprite[];
}

async function boot(): Promise<void> {
  const app = new Application();
  const big = new URLSearchParams(location.search).get('zoom');
  const zoom = big ? Number(big) : 3;
  await app.init({ width: 1400, height: 1000, background: 0xe9dcc3, antialias: true, resolution: 1 });
  document.body.appendChild(app.canvas);
  const params = new URLSearchParams(location.search);
  const atlas = buildAtlas(app.renderer, params.get('lineup') ? 4 : 2);
  const world = new Container();
  world.sortableChildren = true;
  const magnified = new Container();
  magnified.scale.set(zoom);
  magnified.position.set(0, 250);
  magnified.sortableChildren = true;
  app.stage.addChild(world, magnified);

  const cells: Cell[] = [];
  const onlyRole = new URLSearchParams(location.search).get('role');
  const roles = onlyRole ? ROLES.filter((r) => r === onlyRole) : ROLES;
  let id = 1;
  const add = (layer: Container, role: Role | 'helper', pose: (typeof POSES)[number], x: number, y: number): void => {
    const c = new Carrier(id++, role === 'helper' ? 'sorter' : role, x, y, 13);
    c.dirX = pose.dirX;
    c.dirY = pose.dirY;
    if (role === 'helper') c.expiresAt = 1;
    const stack: Parcel[] = [];
    for (let i = 0; i < pose.carry; i++) stack.push({ id: 1000 + id * 10 + i, district: i % 2, kind: i === 2 ? 'fragile' : 'normal', sorted: false, deadline: 0, onTime: false, hop: 0 });
    c.stack = stack;
    const view = new CharacterView(atlas, c, role === 'helper');
    layer.addChild(view.node, view.front);
    const parcels = stack.map((p) => {
      const s = new Sprite(atlas.get(parcelTex(p.district, p.kind, p.sorted)));
      layer.addChild(s);
      return s;
    });
    cells.push({ view, carrier: c, walk: pose.walk, parcels });
  };

  // Game-scale strip along the top, magnified grid below.
  const ground = new Graphics();
  world.addChild(ground);
  roles.forEach((role, r) => {
    POSES.forEach((pose, k) => add(world, role, pose, 40 + k * 44 + r * 360 - (r > 2 ? 3 * 360 : 0), 90 + (r > 2 ? 90 : 0)));
  });
  const gx = 34;
  const gy = 78;
  roles.slice(0, 3).forEach((role, r) => {
    POSES.forEach((pose, k) => add(magnified, role, pose, 22 + k * gx, 72 + r * gy));
  });

  // ?lineup=1: every role from the front, side and back, plus carrying poses; saved to promo/.
  if (params.get('lineup')) {
    world.visible = false;
    for (const c of cells) {
      c.view.node.destroy({ children: true });
      c.view.front.destroy({ children: true });
      for (const p of c.parcels) p.destroy();
    }
    cells.length = 0;
    const floor = new Graphics();
    floor.rect(0, 0, 1400, 1000).fill(0xf1e4cc);
    for (let y = 0; y < 1000; y += 64) for (let x = (y / 64) % 2 ? 64 : 0; x < 1400; x += 128) floor.rect(x, y, 64, 64).fill(0xebdcc0);
    app.stage.addChildAt(floor, 0);
    magnified.scale.set(3.6);
    magnified.position.set(0, 0);
    const freeze = (walk: number, run: boolean): void => {
      const cell = cells[cells.length - 1]!;
      cell.carrier.moving = walk >= 0;
      cell.carrier.running = run;
      cell.carrier.walked = Math.max(0, walk) * 9.5;
      for (let i = 0; i < 90; i++) cell.view.update(cell.carrier.x, cell.carrier.y, 1 / 60, 0);
      const off = cell.view.stackOffset();
      let z = (HANDS_Z - cell.view.bob) * cell.view.node.scale.y;
      cell.parcels.forEach((s, i) => {
        s.position.set(cell.carrier.x + off.dx, cell.carrier.y + 1 - z);
        s.zIndex = cell.carrier.y + (off.front ? 0.02 : -0.02) + i * 1e-4;
        z += PARCEL.h - 2;
      });
    };
    ROLES.forEach((role, r) => {
      const x0 = 14 + r * 76;
      add(magnified, role, { name: '', dirX: 0, dirY: 1, walk: false, carry: 0 }, x0, 84);
      freeze(-1, false);
      add(magnified, role, { name: '', dirX: 1, dirY: 0, walk: false, carry: 0 }, x0 + 24, 84);
      freeze(0.9, true);
      add(magnified, role, { name: '', dirX: 0, dirY: -1, walk: false, carry: 0 }, x0 + 48, 84);
      freeze(-1, false);
    });
    const poses: [Role | 'helper', number, number, number, number, boolean][] = [
      ['player', 1, 0, 4, 2.4, true],
      ['player', 0, 1, 4, 0.5, true],
      ['sorter', -1, 0, 3, 4, false],
      ['loader', 1, 0, 2, 5.5, true],
      ['player', 1, 0, 0, 4.2, false],
      ['sorter', 0, 1, 0, 1.2, true],
    ];
    poses.forEach(([role, dx, dy, carry, walk, run], k) => {
      add(magnified, role, { name: '', dirX: dx, dirY: dy, walk: true, carry }, 30 + k * 60, 196);
      freeze(walk, run);
    });
    // Game scale, as seen while playing
    ROLES.forEach((role, r) => {
      add(world, role, { name: '', dirX: 0, dirY: 1, walk: false, carry: 0 }, 1180 + (r % 3) * 38, 780 + Math.floor(r / 3) * 90);
      freeze(-1, false);
    });
    world.visible = true;
    const save = async (): Promise<string> => {
      const canvas = app.renderer.extract.canvas({ target: app.stage, frame: new Rectangle(0, 0, 1400, 900) }) as HTMLCanvasElement;
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      await fetch('/__promo?name=_characters_lineup.png', { method: 'POST', body: blob });
      return 'saved';
    };
    (window as unknown as { __lab: unknown }).__lab = { app, save };
    return;
  }

  // ?cycle=1: frozen phases of the walk cycle (run, careful walk, front, back) for one role.
  if (new URLSearchParams(location.search).get('cycle')) {
    world.visible = false;
    for (const c of cells) {
      c.view.node.destroy({ children: true });
      c.view.front.destroy({ children: true });
      for (const p of c.parcels) p.destroy();
    }
    cells.length = 0;
    const role = (onlyRole ?? 'player') as Role;
    const rows: { dirX: number; dirY: number; run: boolean; carry: number }[] = [
      { dirX: 1, dirY: 0, run: true, carry: 0 },
      { dirX: 1, dirY: 0, run: false, carry: 0 },
      { dirX: 0, dirY: 1, run: true, carry: 0 },
      { dirX: 0, dirY: -1, run: true, carry: 0 },
    ];
    magnified.scale.set(zoom);
    magnified.position.set(0, 0);
    rows.forEach((r, ri) => {
      for (let k = 0; k < 8; k++) {
        add(magnified, role, { name: '', dirX: r.dirX, dirY: r.dirY, walk: false, carry: r.carry }, 16 + k * 30, 70 + ri * 68);
        const cell = cells[cells.length - 1]!;
        cell.carrier.moving = true;
        cell.carrier.running = r.run;
        cell.carrier.walked = (k / 8) * Math.PI * 2 * 9.5;
        // Settle the eased stride amplitude before freezing.
        for (let i = 0; i < 60; i++) cell.view.update(cell.carrier.x, cell.carrier.y, 1 / 60, 0);
      }
    });
    return;
  }

  let t = 0;
  app.ticker.add((tk) => {
    const dt = tk.deltaMS / 1000;
    t += dt;
    for (const cell of cells) {
      const c = cell.carrier;
      c.moving = cell.walk;
      c.running = cell.walk;
      if (cell.walk) c.walked += 110 * dt;
      cell.view.update(c.x, c.y, dt, t);
      const off = cell.view.stackOffset();
      let z = (HANDS_Z - cell.view.bob) * cell.view.node.scale.y;
      cell.parcels.forEach((s, i) => {
        s.position.set(c.x + off.dx + cell.view.sway(i), c.y + 1 - z);
        s.zIndex = c.y + (off.front ? 0.02 : -0.02) + i * 1e-4;
        z += PARCEL.h - 2;
      });
    }
  });
  (window as unknown as { __lab: unknown }).__lab = { app, cells, pause: () => app.ticker.stop(), play: () => app.ticker.start() };
}

void boot();
