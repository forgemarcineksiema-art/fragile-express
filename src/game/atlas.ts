// Builds one texture atlas from vector drawing callbacks, so every sprite shares a GPU texture and batches.
import { CanvasSource, Graphics, Rectangle, Texture, type Renderer, type Sprite, type TextureSource } from 'pixi.js';

/** Assigns a texture and its default anchor (Pixi only applies defaultAnchor in the Sprite constructor). */
export function setTexture(sprite: Sprite, tex: Texture): void {
  sprite.texture = tex;
  const a = tex.defaultAnchor;
  if (a) sprite.anchor.set(a.x ?? 0, a.y ?? 0);
}

/**
 * Renders a display object into a texture that survives WebGL context loss: a render texture lives
 * only on the GPU and comes back blank, so its pixels are copied to a canvas the GPU can re-upload.
 */
export function bakeTexture(renderer: Renderer, target: Graphics, resolution: number, frame?: Rectangle): TextureSource {
  const rt = renderer.generateTexture({ target, frame, resolution, antialias: true });
  const canvas = renderer.extract.canvas({ target: rt }) as HTMLCanvasElement;
  rt.destroy(true);
  return new CanvasSource({ resource: canvas, resolution });
}

export interface AtlasEntry {
  name: string;
  w: number;
  h: number;
  /** Anchor inside the cell (becomes the texture's default anchor). */
  ax: number;
  ay: number;
  draw: (g: Graphics, ax: number, ay: number) => void;
}

const MAX_W = 1024;
const GAP = 3;

export class Atlas {
  private readonly map = new Map<string, Texture>();

  static build(renderer: Renderer, entries: AtlasEntry[], resolution = 2): Atlas {
    const atlas = new Atlas();
    let x = 0;
    let y = 0;
    let rowH = 0;
    const cells: { e: AtlasEntry; x: number; y: number }[] = [];
    // Tallest first packs rows tighter.
    for (const e of [...entries].sort((a, b) => b.h - a.h)) {
      if (x + e.w > MAX_W) {
        x = 0;
        y += rowH + GAP;
        rowH = 0;
      }
      cells.push({ e, x, y });
      x += e.w + GAP;
      rowH = Math.max(rowH, e.h);
    }
    const totalH = Math.ceil(y + rowH);
    const g = new Graphics();
    for (const c of cells) c.e.draw(g, c.x + c.e.ax, c.y + c.e.ay);
    const source = bakeTexture(renderer, g, resolution, new Rectangle(0, 0, MAX_W, totalH));
    g.destroy();
    for (const c of cells) {
      atlas.map.set(
        c.e.name,
        new Texture({
          source,
          frame: new Rectangle(c.x, c.y, c.e.w, c.e.h),
          defaultAnchor: { x: c.e.ax / c.e.w, y: c.e.ay / c.e.h },
        }),
      );
    }
    return atlas;
  }

  get(name: string): Texture {
    const t = this.map.get(name);
    if (!t) throw new Error(`atlas: missing texture "${name}"`);
    return t;
  }

  has(name: string): boolean {
    return this.map.has(name);
  }
}
