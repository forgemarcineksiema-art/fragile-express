// Buy pads and rewarded floor zones.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { t } from '../../core/i18n.ts';
import { AD_PAD_HOLD } from '../../sim/economy.ts';
import { AD_PAD_SIZE, PAD_SIZE } from '../../sim/layout.ts';
import type { AdPad, Pad } from '../../sim/stations.ts';
import type { Warehouse } from '../../sim/warehouse.ts';
import { drawSymbol, type IconName } from '../art.ts';
import type { Atlas } from '../atlas.ts';
import { AD_PURPLE, DISTRICT_COLORS, DISTRICT_SYMBOLS, INK, PAD_GREEN, WHITE } from '../palette.ts';
import { formatCoins, formatTime, label, setText } from '../text.ts';

export function padIcon(pad: Pad): IconName {
  const d = pad.def;
  switch (d.type) {
    case 'district':
      return 'district';
    case 'hire':
      return d.role!;
    case 'van2':
      return 'van2';
    case 'move':
      return 'move';
    case 'upgrade': {
      const stat = d.stat!;
      if (stat.endsWith('.capacity')) return stat === 'van.capacity' ? 'vanCap' : 'capacity';
      if (stat.endsWith('.speed')) return stat === 'belt.speed' ? 'belt' : 'speed';
      return 'stability';
    }
  }
}

/** i18n key for the pad title. */
export function padTitleKey(pad: Pad): string {
  const d = pad.def;
  switch (d.type) {
    case 'upgrade':
      return `stat.${d.stat}`;
    case 'hire':
      return `hire.${d.role}`;
    default:
      return pad.id === 'franchise' ? 'pad.franchise' : `pad.${d.type}`;
  }
}

function dashed(g: Graphics, half: number, r: number, color: number, alpha: number): void {
  // Dashed rounded square outline.
  const n = 28;
  const pts: [number, number][] = [];
  const side = half - r;
  const per = n / 4;
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < per; i++) {
      const k = i / per;
      const a = (s * Math.PI) / 2;
      const along = -side + k * side * 2;
      const x = Math.cos(a) * half - Math.sin(a) * along;
      const y = Math.sin(a) * half + Math.cos(a) * along;
      pts.push([x, y]);
    }
  }
  for (let i = 0; i < pts.length; i += 2) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    g.moveTo(a[0], a[1]).lineTo(b[0], b[1]);
  }
  g.stroke({ width: 4, color, alpha, cap: 'round' });
}

export class PadView {
  readonly node = new Container();
  private readonly fill: Sprite;
  private readonly price: Text;
  private readonly level: Text;
  private readonly glow = new Graphics();
  private appear = 0;
  private lastLevel = -1;

  constructor(
    readonly pad: Pad,
    atlas: Atlas,
    private readonly wh: Warehouse,
  ) {
    const half = PAD_SIZE / 2;
    const base = new Graphics();
    const isMove = pad.def.type === 'move';
    base.roundRect(-half + 3, -half + 5, PAD_SIZE, PAD_SIZE, 14).fill({ color: 0x000000, alpha: 0.12 });
    base.roundRect(-half, -half, PAD_SIZE, PAD_SIZE, 14).fill({ color: isMove ? 0x1e3a8a : 0x1f2937, alpha: 0.55 });
    this.glow.roundRect(-half - 6, -half - 6, PAD_SIZE + 12, PAD_SIZE + 12, 18).fill(0xfde047);
    this.glow.visible = false;
    this.node.addChild(this.glow, base);
    this.fill = new Sprite(atlas.get('bar'));
    this.fill.tint = PAD_GREEN;
    this.fill.alpha = 0.85;
    this.fill.anchor.set(0, 1);
    this.fill.position.set(-half + 3, half - 3);
    this.fill.width = PAD_SIZE - 6;
    this.fill.height = 0;
    this.node.addChild(this.fill);
    const border = new Graphics();
    dashed(border, half - 2, 12, WHITE, 0.95);
    this.node.addChild(border);
    const icon = new Sprite(atlas.get(`icon_${padIcon(pad)}`));
    icon.scale.set(0.78);
    icon.position.set(0, -9);
    this.node.addChild(icon);
    if (pad.def.type === 'district' || pad.def.type === 'van2') {
      const d = pad.def.district ?? 0;
      const badge = new Graphics();
      badge.circle(half - 12, -half + 12, 11).fill(DISTRICT_COLORS[d]!).stroke({ width: 2.5, color: WHITE });
      drawSymbol(badge, half - 12, -half + 12, 10, DISTRICT_SYMBOLS[d]!, WHITE);
      this.node.addChild(badge);
    }
    const coin = new Sprite(atlas.get('icon_coin'));
    coin.scale.set(0.3);
    coin.position.set(-22, 23);
    this.price = label('', 17);
    this.price.anchor.set(0, 0.5);
    this.price.position.set(-13, 23);
    this.level = label('', 11, 0xfde68a);
    this.level.position.set(-half + 16, -half + 11);
    this.node.addChild(coin, this.price, this.level);
    this.node.position.set(pad.x, pad.y);
    this.node.visible = false;
  }

  update(dt: number, time: number): void {
    const p = this.pad;
    if (!p.visible) {
      this.node.visible = false;
      this.appear = 0;
      return;
    }
    if (!this.node.visible) this.node.visible = true;
    if (this.appear < 1) {
      this.appear = Math.min(1, this.appear + dt * 3.2);
      const k = this.appear;
      this.node.scale.set(k < 1 ? 0.2 + 0.8 * k + Math.sin(k * Math.PI) * 0.25 : 1);
    }
    const wh = this.wh;
    const cost = wh.padCost(p);
    const price = formatCoins(Math.ceil(cost - p.paid));
    if (price !== this.price.text) {
      setText(this.price, price);
      // Keep long prices (and the larger phone labels) inside the pad.
      this.price.scale.set(1);
      const room = PAD_SIZE / 2 + 9;
      if (this.price.width > room) this.price.scale.set(room / this.price.width);
    }
    const lvl = wh.padLevel(p);
    if (lvl !== this.lastLevel) {
      this.lastLevel = lvl;
      setText(this.level, p.def.type === 'upgrade' && lvl > 0 ? `Lv${lvl + 1}` : '');
    }
    this.fill.height = (PAD_SIZE - 6) * Math.min(1, p.paid / cost);
    // Affordable pads breathe to draw the eye.
    const affordable = wh.coins + p.paid >= cost;
    this.glow.visible = affordable;
    if (affordable) this.glow.alpha = 0.35 + Math.sin(time * 5) * 0.15;
  }
}

export class AdPadView {
  readonly node = new Container();
  private readonly ring = new Graphics();
  private readonly timer: Text;
  private appear = 0;
  private ringK = 0;

  constructor(
    readonly pad: AdPad,
    atlas: Atlas,
    private readonly wh: Warehouse,
  ) {
    const r = AD_PAD_SIZE / 2;
    const base = new Graphics();
    base.circle(3, 5, r).fill({ color: 0x000000, alpha: 0.14 });
    base.circle(0, 0, r).fill({ color: AD_PURPLE, alpha: 0.8 });
    base.circle(0, 0, r - 5).stroke({ width: 3, color: WHITE, alpha: 0.9 });
    this.node.addChild(base, this.ring);
    const clap = new Sprite(atlas.get('icon_clapper'));
    clap.scale.set(0.42);
    clap.position.set(-r + 18, -r + 16);
    const badge = new Graphics();
    badge.circle(-r + 18, -r + 16, 16).fill(INK).stroke({ width: 2.5, color: WHITE });
    this.node.addChild(badge, clap);
    const rewardIcon: IconName = pad.kind === 'turbo' ? 'turbo' : pad.kind === 'helper' ? 'helper' : pad.kind === 'cash' ? 'cash' : pad.kind === 'bubble' ? 'bubble' : 'capacity';
    const icon = new Sprite(atlas.get(`icon_${rewardIcon}`));
    icon.scale.set(0.72);
    icon.position.set(0, -8);
    this.node.addChild(icon);
    const text =
      pad.kind === 'turbo' ? t('ad.turbo') : pad.kind === 'helper' ? t('ad.helper') : pad.kind === 'cash' ? `+${formatCoins(pad.amount)}` : pad.kind === 'bubble' ? t('ad.bubble') : t('ad.assist');
    const caption = label(text, 14);
    caption.position.set(0, 22);
    if (caption.width > AD_PAD_SIZE - 8) caption.scale.set((AD_PAD_SIZE - 8) / caption.width);
    this.node.addChild(caption);
    this.timer = label('', 11, 0xe9d5ff);
    this.timer.position.set(0, r + 10);
    this.node.addChild(this.timer);
    this.node.position.set(pad.x, pad.y);
    this.node.scale.set(0.2);
  }

  update(dt: number, time: number): void {
    const p = this.pad;
    if (this.appear < 1) {
      this.appear = Math.min(1, this.appear + dt * 3);
      const k = this.appear;
      this.node.scale.set(0.2 + 0.8 * k + Math.sin(k * Math.PI) * 0.2);
    } else {
      this.node.scale.set(1 + Math.sin(time * 3.2) * 0.03);
    }
    const r = AD_PAD_SIZE / 2;
    const k = Math.min(1, p.standT / AD_PAD_HOLD);
    if (k !== this.ringK) {
      this.ringK = k;
      this.ring.clear();
      if (k > 0) this.ring.moveTo(0, -r - 1).arc(0, 0, r + 1, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).stroke({ width: 7, color: 0xfde047 });
    }
    const left = p.expiresAt - this.wh.time;
    setText(this.timer, p.kind === 'assist' ? '' : formatTime(left));
  }
}

/** Speech-bubble tooltip above the pad the player stands on. */
export class PadTooltip {
  readonly node = new Container();
  private readonly bg = new Graphics();
  private readonly title: Text;
  private readonly detail: Text;
  private current: Pad | null = null;

  constructor(private readonly wh: Warehouse) {
    this.title = label('', 15);
    this.detail = label('', 12, 0xfde68a);
    this.node.addChild(this.bg, this.title, this.detail);
    this.node.visible = false;
  }

  update(): void {
    const pad = this.wh.padUnderPlayer();
    if (!pad) {
      this.node.visible = false;
      this.current = null;
      return;
    }
    this.node.visible = true;
    const wh = this.wh;
    const lvl = wh.padLevel(pad);
    setText(this.title, t(padTitleKey(pad)));
    setText(this.detail, this.detailText(pad, lvl));
    if (this.current !== pad) {
      this.current = pad;
    }
    const w = Math.max(this.title.width, this.detail.width) + 24;
    const h = this.detail.text ? 44 : 28;
    this.bg.clear();
    this.bg.roundRect(-w / 2, -h, w, h, 10).fill({ color: INK, alpha: 0.9 });
    this.bg.poly([-8, 0, 8, 0, 0, 9]).fill({ color: INK, alpha: 0.9 });
    this.title.position.set(0, this.detail.text ? -h + 14 : -h / 2);
    this.detail.position.set(0, -12);
    this.node.position.set(pad.x, pad.y - PAD_SIZE / 2 - 64);
  }

  private detailText(pad: Pad, lvl: number): string {
    const d = pad.def;
    const wh = this.wh;
    if (d.type === 'upgrade') {
      const next = lvl + 1;
      const max = wh.padCap(pad);
      return t('pad.level', { a: next, b: max });
    }
    if (d.type === 'move') return t(pad.id === 'franchise' ? 'pad.franchiseHint' : 'pad.moveHint');
    if (d.type === 'van2') return t('pad.van2Hint');
    if (d.type === 'district') return t('pad.districtHint');
    return t(`hire.${d.role}.hint`);
  }
}
