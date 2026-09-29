// The courier who comes in through the front door for an order: his figure walking in and out,
// the pickup mat on the floor, and the order card above him (the parcels he wants, ticks for the
// ones handed over, the time he will still wait and what the order pays).
import { Container, Graphics, Sprite, type Text } from 'pixi.js';
import { Carrier } from '../../sim/carrier.ts';
import { COURIER_WALK } from '../../sim/economy.ts';
import type { CourierOrder } from '../../sim/types.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import type { Atlas } from '../atlas.ts';
import { INK, WHITE } from '../palette.ts';
import { formatCoins, label, setText } from '../text.ts';
import { parcelTex } from '../textures.ts';
import { CharacterView } from './character.ts';

const TEAL = 0x0f766e;
const SLOT = 30;

export class CourierView {
  readonly figure: CharacterView;
  /** Pickup mat, drawn on the floor. */
  readonly mat = new Graphics();
  /** Order card, drawn above everything in the world. */
  readonly card = new Container();
  private readonly cardBg = new Graphics();
  private readonly marks = new Graphics();
  private readonly bar = new Graphics();
  private readonly icons: Sprite[] = [];
  private readonly price: Text;
  private readonly coin: Sprite;
  private readonly carrier: Carrier;
  private order: CourierOrder | null = null;
  private pop = 0;
  private lastY = 0;

  constructor(
    private readonly wh: Warehouse,
    private readonly atlas: Atlas,
  ) {
    const k = wh.layout.courier!;
    this.carrier = new Carrier(-500, 'sorter', k.door.x, k.door.y, 13);
    this.carrier.stack = wh.courier.parcels;
    this.figure = new CharacterView(atlas, this.carrier, false, 'courier');
    this.figure.node.visible = this.figure.front.visible = false;
    this.drawMat();
    this.price = label('', 13, 0xfde047);
    this.price.anchor.set(0, 0.5);
    this.coin = new Sprite(atlas.get('icon_coin'));
    this.coin.anchor.set(0.5);
    this.coin.scale.set(0.24);
    this.card.addChild(this.cardBg, this.marks, this.bar, this.coin, this.price);
    this.card.visible = false;
  }

  private drawMat(): void {
    const z = this.wh.layout.courier!.zone;
    const g = this.mat;
    g.roundRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6, 12).fill({ color: TEAL, alpha: 0.14 });
    // Dashed border
    const dash = (x0: number, y0: number, x1: number, y1: number): void => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 0; s < len; s += 17) {
        const e = Math.min(len, s + 10);
        g.moveTo(x0 + ((x1 - x0) * s) / len, y0 + ((y1 - y0) * s) / len).lineTo(x0 + ((x1 - x0) * e) / len, y0 + ((y1 - y0) * e) / len);
      }
    };
    dash(z.x + 5, z.y + 5, z.x + z.w - 5, z.y + 5);
    dash(z.x + z.w - 5, z.y + 5, z.x + z.w - 5, z.y + z.h - 5);
    dash(z.x + z.w - 5, z.y + z.h - 5, z.x + 5, z.y + z.h - 5);
    dash(z.x + 5, z.y + z.h - 5, z.x + 5, z.y + 5);
    g.stroke({ width: 3.5, color: TEAL, alpha: 0.85, cap: 'round' });
    // Hand-over sign: a parcel and an arrow towards the door
    const cx = z.x + z.w / 2;
    const cy = z.y + z.h / 2 + 4;
    g.rect(cx - 13, cy - 10, 16, 12).fill({ color: TEAL, alpha: 0.45 });
    g.poly([cx + 6, cy - 9, cx + 16, cy - 4, cx + 6, cy + 1]).fill({ color: TEAL, alpha: 0.45 });
  }

  private buildCard(order: CourierOrder): void {
    this.order = order;
    for (const s of this.icons) s.destroy();
    this.icons.length = 0;
    const n = order.items.length;
    const w = Math.max(96, n * SLOT + 20);
    const h = 58;
    const g = this.cardBg;
    g.clear();
    g.roundRect(-w / 2 + 2, -h + 3, w, h, 10).fill({ color: 0x000000, alpha: 0.18 });
    g.roundRect(-w / 2, -h, w, h, 10).fill(WHITE);
    g.poly([-7, -1, 7, -1, 0, 8]).fill(WHITE);
    g.roundRect(-w / 2, -h, w, h, 10).stroke({ width: 1.5, color: INK, alpha: 0.3 });
    g.roundRect(-w / 2, -h, w, 5, 3).fill(TEAL);
    order.items.forEach((it, i) => {
      const s = new Sprite(this.atlas.get(parcelTex(it.district, it.fragile ? 'fragile' : 'normal', true)));
      s.scale.set(0.66);
      s.position.set(-((n - 1) * SLOT) / 2 + i * SLOT, -h + 30);
      this.icons.push(s);
      this.card.addChildAt(s, 1);
    });
    this.coin.position.set(-12, -9);
    this.price.position.set(-3, -9);
    setText(this.price, `+${formatCoins(order.value)}`);
    this.pop = 0;
  }

  /** Speech bubble over the courier. */
  say(text: string): void {
    this.figure.say(text);
  }

  update(dt: number, time: number): void {
    const k = this.wh.courier;
    const L = this.wh.layout.courier!;
    const c = this.carrier;
    const node = this.figure.node;
    if (k.state === 'away') {
      node.visible = this.figure.front.visible = this.card.visible = false;
      return;
    }
    node.visible = this.figure.front.visible = true;
    const outside = L.door.y + 26;
    let y = L.spot.y;
    let moving = false;
    if (k.state === 'arriving') {
      const p = 1 - Math.max(0, k.t) / COURIER_WALK;
      y = outside + (L.spot.y - outside) * p;
      c.dirX = 0;
      c.dirY = -1;
      moving = true;
    } else if (k.state === 'leaving') {
      const p = 1 - Math.max(0, k.t) / COURIER_WALK;
      y = L.spot.y + (outside - L.spot.y) * p;
      c.dirX = 0;
      c.dirY = 1;
      moving = true;
    } else {
      c.dirX = 0;
      c.dirY = 1;
    }
    c.walked += Math.abs(y - this.lastY);
    this.lastY = y;
    c.moving = moving;
    c.running = false;
    c.x = c.px = L.spot.x;
    c.y = c.py = y;
    // Fade through the doorway
    const a = Math.max(0, Math.min(1, (outside - y) / 30));
    node.alpha = this.figure.front.alpha = a;
    this.figure.update(L.spot.x, y, dt, time);

    // Order card
    const order = k.order;
    const show = order !== null && (k.state === 'arriving' || k.state === 'waiting');
    this.card.visible = show;
    if (!show || !order) return;
    if (order !== this.order) this.buildCard(order);
    this.pop = Math.min(1, this.pop + dt * 4);
    const s = this.pop < 1 ? 0.6 + Math.sin(this.pop * Math.PI * 0.5) * 0.4 + Math.sin(this.pop * Math.PI) * 0.12 : 1;
    this.card.scale.set(s);
    this.card.position.set(L.spot.x, y - 92 - Math.sin(time * 2.4) * 1.5);
    // Ticks on the parcels already handed over
    const m = this.marks;
    m.clear();
    order.items.forEach((it, i) => {
      const icon = this.icons[i]!;
      icon.alpha = it.parcel !== null ? 0.35 : 1;
      if (it.parcel !== null) {
        const x = icon.x;
        const yy = icon.y - 11;
        m.circle(x, yy, 7).fill(0x16a34a);
        m.moveTo(x - 3.2, yy).lineTo(x - 0.8, yy + 2.6).lineTo(x + 3.6, yy - 2.8).stroke({ width: 2, color: WHITE, cap: 'round', join: 'round' });
      }
    });
    // Time left
    const w = this.cardBg.width - 8;
    const left = k.state === 'waiting' ? Math.max(0, order.deadline - this.wh.time) / order.wait : 1;
    const color = left > 0.5 ? 0x22c55e : left > 0.22 ? 0xfacc15 : 0xef4444;
    const b = this.bar;
    b.clear();
    b.roundRect(-w / 2 + 10, -22, w - 20, 4, 2).fill(0xe5e7eb);
    b.roundRect(-w / 2 + 10, -22, (w - 20) * left, 4, 2).fill(color);
  }
}
