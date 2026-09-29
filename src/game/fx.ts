// Pooled particles and floating texts in world space.
import { Container, Sprite, type Text } from 'pixi.js';
import { setTexture, type Atlas } from './atlas.ts';
import { label } from './text.ts';

interface Particle {
  s: Sprite;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  spin: number;
  life: number;
  max: number;
  fade: boolean;
  shrink: boolean;
  /** Expanding ring instead of a ballistic particle. */
  ring: boolean;
  /** Scale growth per second (puffs). */
  grow: number;
  /** Spinning coin: horizontal scale follows |cos(life × spinX)|. */
  spinX: number;
  base: number;
  /** Bounces left before the particle settles (-1: generic soft bounce forever). */
  bounces: number;
  onBounce: (() => void) | null;
  /** Homing target (coins flying to a carrier); called every frame. */
  home: (() => { x: number; y: number }) | null;
  onDone: (() => void) | null;
}

interface Floater {
  t: Text;
  icon: Sprite | null;
  x: number;
  y: number;
  life: number;
  max: number;
  big: boolean;
}

export class Fx {
  readonly layer = new Container();
  private readonly parts: Particle[] = [];
  private readonly pool: Sprite[] = [];
  private readonly floaters: Floater[] = [];
  private readonly textPool: Text[] = [];

  constructor(private readonly atlas: Atlas) {}

  private sprite(tex: string, tint = 0xffffff): Sprite {
    const s = this.pool.pop() ?? new Sprite();
    setTexture(s, this.atlas.get(tex));
    s.tint = tint;
    s.alpha = 1;
    s.scale.set(1);
    s.rotation = 0;
    s.visible = true;
    if (!s.parent) this.layer.addChild(s);
    return s;
  }

  private add(p: Partial<Particle> & { s: Sprite; x: number; y: number; max: number }): void {
    this.parts.push({ z: 0, vx: 0, vy: 0, vz: 0, g: 0, spin: 0, life: 0, fade: true, shrink: false, ring: false, grow: 0, spinX: 0, base: 1, bounces: -1, onBounce: null, home: null, onDone: null, ...p });
  }

  /** Glass shards and cardboard bits bursting from a broken fragile parcel. */
  shatter(x: number, y: number, z: number, color: number): void {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 140;
      this.add({
        s: this.sprite('shard', i % 3 === 0 ? color : i % 2 ? 0xe0f2fe : 0xbae6fd),
        x,
        y,
        z,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.5,
        vz: 120 + Math.random() * 180,
        g: 600,
        spin: (Math.random() - 0.5) * 20,
        max: 0.8 + Math.random() * 0.4,
      });
    }
    this.ring(x, y - z, 0xef4444, 0.9);
  }

  /**
   * A van's payout raining onto its pile: spinning coins arc from the van door, bounce once with a
   * clink and settle; `onLand` fires for each coin as it merges into the pile.
   */
  coinRain(fromX: number, fromY: number, fromZ: number, toX: number, toY: number, n: number, onLand: () => void, onClink: () => void): void {
    const g = 950;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 20;
      const tx = toX + Math.cos(a) * r;
      const ty = toY + Math.sin(a) * r * 0.6;
      const T = 0.5 + Math.random() * 0.25;
      const s = this.sprite('coin_face');
      s.scale.set(0.8);
      this.add({
        s,
        x: fromX,
        y: fromY,
        z: fromZ,
        vx: (tx - fromX) / T,
        vy: (ty - fromY) / T,
        vz: (-fromZ + 0.5 * g * T * T) / T,
        g,
        max: 3,
        life: -i * 0.035,
        fade: false,
        spinX: 14 + Math.random() * 8,
        base: 0.8,
        bounces: 1,
        onBounce: onClink,
        onDone: onLand,
      });
    }
  }

  /** Coins popping up from a pile that is being picked up. */
  pickupBurst(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this.sprite('coin_face');
      s.scale.set(0.7);
      this.add({
        s,
        x: x + Math.cos(a) * 12,
        y: y + Math.sin(a) * 7,
        z: 2,
        vx: Math.cos(a) * 30,
        vy: Math.sin(a) * 15,
        vz: 260 + Math.random() * 120,
        g: 700,
        max: 0.45,
        spinX: 20,
        base: 0.7,
      });
    }
  }

  /** Big payout label with a spinning coin icon ("+40", "+80 ×2"). */
  payout(x: number, y: number, text: string, color = 0xfde047): void {
    if (this.noText) return;
    const t = this.textPool.pop() ?? label('', 26);
    t.text = text;
    t.style.fill = color;
    t.style.fontSize = 26;
    t.visible = true;
    t.alpha = 1;
    if (!t.parent) this.layer.addChild(t);
    const icon = this.sprite('coin_face');
    this.floaters.push({ t, icon, x, y, life: 0, max: 1.5, big: true });
  }

  /** Coins hopping from a point into a (moving) target. */
  coins(fromX: number, fromY: number, n: number, target: () => { x: number; y: number }, onEach?: () => void): void {
    const count = Math.min(14, Math.max(1, n));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({
        s: this.sprite('coin'),
        x: fromX + Math.cos(a) * 8,
        y: fromY + Math.sin(a) * 5,
        z: 4,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 50,
        vz: 170 + Math.random() * 60,
        g: 520,
        max: 1.2,
        life: -i * 0.025,
        fade: false,
        home: target,
        onDone: i === 0 ? (onEach ?? null) : null,
      });
    }
  }

  /** Single coin flying from a carrier into a pad while paying. */
  payCoin(fromX: number, fromY: number, toX: number, toY: number): void {
    this.add({
      s: this.sprite('coin_face'),
      spinX: 18,
      base: 0.75,
      x: fromX,
      y: fromY,
      z: 36,
      vx: (toX - fromX) / 0.3,
      vy: (toY - fromY) / 0.3,
      vz: 110,
      g: 900,
      max: 0.3,
      fade: false,
    });
  }

  confetti(x: number, y: number): void {
    const colors = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xa855f7, 0xf97316];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 120;
      const s = this.sprite('square', colors[i % colors.length]);
      s.scale.set(0.8, 0.5);
      this.add({ s, x, y, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 220 + Math.random() * 200, g: 500, spin: (Math.random() - 0.5) * 16, max: 1.3 });
    }
    this.ring(x, y, 0xfde047, 0.7);
  }

  ring(x: number, y: number, tint: number, max = 0.6): void {
    const s = this.sprite('ring', tint);
    s.scale.set(0.3);
    this.add({ s, x, y, max, ring: true });
  }

  dust(x: number, y: number, n = 6): void {
    for (let i = 0; i < n; i++) {
      const s = this.sprite('dot', 0xd1d5db);
      s.scale.set(0.6 + Math.random() * 0.6);
      s.alpha = 0.7;
      this.add({ s, x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 16, z: 4, vx: (Math.random() - 0.5) * 40, vz: 20 + Math.random() * 30, max: 0.6 + Math.random() * 0.4 });
    }
  }

  /** Exhaust puff: a grey ball that drifts up, grows and fades. */
  puff(x: number, y: number): void {
    const s = this.sprite('dot', Math.random() < 0.5 ? 0xd1d5db : 0xe5e7eb);
    s.scale.set(0.22 + Math.random() * 0.14);
    s.alpha = 0.55;
    this.add({ s, x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, z: 5, vx: -12 - Math.random() * 18, vy: (Math.random() - 0.5) * 16, vz: 22 + Math.random() * 14, max: 0.45 + Math.random() * 0.2, grow: 1.3 });
  }

  /** Suppresses floating texts (cinematic mode). */
  noText = false;

  float(x: number, y: number, text: string, color = 0xfde047, size = 20): void {
    if (this.noText) return;
    const t = this.textPool.pop() ?? label('', size);
    t.text = text;
    t.style.fill = color;
    t.style.fontSize = size;
    t.visible = true;
    t.alpha = 1;
    if (!t.parent) this.layer.addChild(t);
    this.floaters.push({ t, icon: null, x, y, life: 0, max: 1.1, big: false });
  }

  update(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]!;
      p.life += dt;
      if (p.life < 0) {
        p.s.visible = false;
        continue;
      }
      p.s.visible = true;
      const k = p.life / p.max;
      if (p.ring) {
        p.s.scale.set(0.3 + k * 1.6);
        p.s.alpha = 1 - k;
        p.s.position.set(p.x, p.y);
      } else if (p.home && p.life > 0.28) {
        const tg = p.home();
        const f = Math.min(1, (p.life - 0.28) / 0.25);
        p.x += (tg.x - p.x) * f;
        p.y += (tg.y - p.y) * f;
        p.z += (40 - p.z) * f;
        p.s.position.set(p.x, p.y - p.z);
        if (f >= 1) p.life = p.max;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vz -= p.g * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          if (p.bounces === 0) {
            p.life = p.max; // settled: merges into whatever it landed on
          } else {
            if (p.bounces > 0) p.bounces--;
            p.onBounce?.();
            p.vz *= -0.35;
            p.vx *= 0.45;
            p.vy *= 0.45;
          }
        }
        if (p.spinX > 0) p.s.scale.set(p.base * Math.max(0.12, Math.abs(Math.cos(p.life * p.spinX))), p.base);
        p.s.position.set(p.x, p.y - p.z);
        p.s.rotation += p.spin * dt;
        if (p.grow) p.s.scale.set(p.s.scale.x + p.grow * dt);
        if (p.fade) p.s.alpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      }
      p.s.zIndex = p.y + 1000;
      if (p.life >= p.max) {
        p.onDone?.();
        p.s.visible = false;
        this.pool.push(p.s);
        this.parts.splice(i, 1);
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.life += dt;
      const k = f.life / f.max;
      const rise = f.big ? 46 * (1 - Math.pow(1 - Math.min(1, k * 1.4), 3)) : 30 * Math.min(1, k * 1.6);
      // Pop in with an overshoot, then drift up and fade.
      let pop = k < 0.15 ? 0.6 + k * 2.7 : 1;
      if (f.big) pop = k < 0.12 ? 0.3 + (k / 0.12) * 1.0 : k < 0.22 ? 1.3 - ((k - 0.12) / 0.1) * 0.3 : 1;
      f.t.position.set(f.x + (f.icon ? 12 : 0), f.y - rise);
      f.t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      f.t.scale.set(pop);
      f.t.zIndex = 1e7;
      if (f.icon) {
        f.icon.visible = true;
        f.icon.position.set(f.x + 12 - f.t.width / 2 - 14, f.y - rise);
        f.icon.scale.set(pop * Math.max(0.2, Math.abs(Math.cos(f.life * 6))), pop);
        f.icon.alpha = f.t.alpha;
        f.icon.zIndex = 1e7;
      }
      if (k >= 1) {
        f.t.visible = false;
        this.textPool.push(f.t);
        if (f.icon) {
          f.icon.visible = false;
          this.pool.push(f.icon);
        }
        this.floaters.splice(i, 1);
      }
    }
  }
}

/** Coins flying in screen space from the world to the HUD coin counter. */
export class ScreenCoins {
  readonly layer = new Container();
  private readonly flying: {
    s: Sprite;
    t: number;
    dur: number;
    x0: number;
    y0: number;
    cx: number;
    cy: number;
    x1: number;
    y1: number;
    done: () => void;
  }[] = [];
  private readonly pool: Sprite[] = [];

  constructor(private readonly atlas: Atlas) {}

  fly(x0: number, y0: number, x1: number, y1: number, n: number, onArrive: (i: number) => void): void {
    for (let i = 0; i < n; i++) {
      const s = this.pool.pop() ?? new Sprite();
      setTexture(s, this.atlas.get('coin_face'));
      s.visible = false;
      if (!s.parent) this.layer.addChild(s);
      const cx = (x0 + x1) / 2 + (Math.random() - 0.5) * 140;
      const cy = Math.min(y0, y1) - 40 - Math.random() * 70;
      const idx = i;
      this.flying.push({
        s,
        t: -i * 0.045,
        dur: 0.55 + Math.random() * 0.15,
        x0: x0 + (Math.random() - 0.5) * 24,
        y0: y0 + (Math.random() - 0.5) * 14,
        cx,
        cy,
        x1,
        y1,
        done: () => onArrive(idx),
      });
    }
  }

  update(dt: number): void {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]!;
      f.t += dt;
      if (f.t < 0) continue;
      f.s.visible = true;
      const k = Math.min(1, f.t / f.dur);
      const e = k * k * (3 - 2 * k);
      const u = 1 - e;
      f.s.position.set(u * u * f.x0 + 2 * u * e * f.cx + e * e * f.x1, u * u * f.y0 + 2 * u * e * f.cy + e * e * f.y1);
      const sc = 1.1 - 0.35 * e;
      f.s.scale.set(sc * Math.max(0.15, Math.abs(Math.cos(f.t * 16))), sc);
      if (k >= 1) {
        f.done();
        f.s.visible = false;
        this.pool.push(f.s);
        this.flying.splice(i, 1);
      }
    }
  }
}
