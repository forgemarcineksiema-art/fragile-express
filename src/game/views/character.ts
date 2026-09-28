// Character view shared by the player and the workers: tinted body parts animated by transforms only.
import { Container, Sprite } from 'pixi.js';
import type { Carrier } from '../../sim/carrier.ts';
import type { Atlas } from '../atlas.ts';
import { COIN, ROLE_SHIRT } from '../palette.ts';

const SKINS = [0xf5c9a0, 0xe0ac7e, 0xc68642, 0x8d5524, 0xffdbac, 0xd4a373];
const PANTS = [0x334155, 0x1e3a8a, 0x3f3f46, 0x44403c];

/** Height of the hands above the ground: the first parcel of the stack sits here. */
export const HANDS_Z = 20;

export class CharacterView {
  readonly node = new Container();
  private readonly shadow: Sprite;
  private readonly legL: Sprite;
  private readonly legR: Sprite;
  private readonly body = new Container();
  private readonly torso: Sprite;
  private readonly armL: Sprite;
  private readonly armR: Sprite;
  private readonly head: Sprite;
  private readonly cap: Sprite;
  private readonly eyes: Sprite;
  private readonly bag: Sprite[] = [];
  private facing: 'front' | 'side' | 'back' = 'front';
  /** Smoothed horizontal lean of the stack (springy carry). */
  lean = 0;
  private leanV = 0;
  private lastX = 0;
  private started = false;
  bob = 0;
  x = 0;
  y = 0;

  constructor(
    private readonly atlas: Atlas,
    readonly carrier: Carrier,
    helper: boolean,
  ) {
    const role = carrier.role;
    const seed = carrier.id * 7919;
    const skin = role === 'player' ? SKINS[0]! : SKINS[seed % SKINS.length]!;
    const pants = role === 'player' ? 0x1e3a8a : PANTS[seed % PANTS.length]!;
    const shirt = helper ? ROLE_SHIRT.helper! : ROLE_SHIRT[role]!;
    const cap = role === 'player' ? 0xdc2626 : helper ? 0x6b21a8 : shirt;

    this.shadow = this.part('shadow');
    this.legL = this.part('leg', pants);
    this.legR = this.part('leg', pants);
    this.torso = this.part('torso', shirt);
    const detail = this.part('torso_detail');
    this.armL = this.part('arm', shirt);
    this.armR = this.part('arm', shirt);
    this.head = this.part('head', skin);
    this.cap = this.part('cap_front', cap);
    this.eyes = this.part('eyes_front');

    this.legL.position.set(-4.5, 0);
    this.legR.position.set(4.5, 0);
    this.torso.position.set(0, -9);
    detail.position.set(0, -9);
    this.armL.position.set(-10, -28);
    this.armR.position.set(10, -28);
    this.head.position.set(0, -38);
    this.cap.position.set(0, -39);
    this.eyes.position.set(0, -38);
    this.node.addChild(this.shadow, this.legL, this.legR, this.body);
    this.body.addChild(this.armL, this.torso, detail, this.armR, this.head, this.eyes, this.cap);
    if (role === 'player') this.node.scale.set(1.12);
    if (role === 'collector') {
      for (let i = 0; i < 6; i++) {
        const c = new Sprite(atlas.get('coin'));
        c.position.set(0, -20 - i * 3.2);
        c.visible = false;
        c.tint = i % 2 ? 0xffffff : COIN;
        this.bag.push(c);
        this.body.addChild(c);
      }
    }
  }

  private part(name: string, tint?: number): Sprite {
    const s = new Sprite(this.atlas.get(name));
    if (tint !== undefined) s.tint = tint;
    return s;
  }

  /** Screen-space offset of the stack base relative to the feet. */
  stackOffset(): { dx: number; front: boolean } {
    const c = this.carrier;
    if (this.facing === 'side') return { dx: Math.sign(c.dirX || 1) * 13, front: true };
    return { dx: 0, front: this.facing !== 'back' };
  }

  update(x: number, y: number, dt: number, time: number): void {
    const c = this.carrier;
    this.x = x;
    this.y = y;
    this.node.position.set(x, y);
    this.node.zIndex = y;

    // Facing
    const ax = Math.abs(c.dirX);
    const ay = Math.abs(c.dirY);
    const next = ay > ax * 1.1 ? (c.dirY > 0 ? 'front' : 'back') : 'side';
    if (next !== this.facing) {
      this.facing = next;
      this.cap.texture = this.atlas.get(`cap_${next}`);
      this.eyes.visible = next !== 'back';
      if (next !== 'back') this.eyes.texture = this.atlas.get(`eyes_${next === 'side' ? 'side' : 'front'}`);
    }
    const flip = next === 'side' && c.dirX < 0 ? -1 : 1;
    this.body.scale.x = flip;

    // Walk cycle driven by the distance walked.
    const phase = c.walked / 8.5;
    const moving = c.moving;
    const swing = moving ? Math.sin(phase) : 0;
    this.legL.y = moving ? -Math.max(0, swing) * 3 : 0;
    this.legR.y = moving ? -Math.max(0, -swing) * 3 : 0;
    if (next === 'side') {
      this.legL.x = -2 + swing * 4 * flip;
      this.legR.x = 2 - swing * 4 * flip;
    } else {
      this.legL.x = -4.5;
      this.legR.x = 4.5;
    }
    this.bob = moving ? -Math.abs(Math.cos(phase)) * 1.8 : Math.sin(time * 2.2 + c.id) * 0.5;
    this.body.y = this.bob;

    const carrying = c.stack.length > 0 || c.coins > 0;
    if (carrying) {
      // Arms up in front, holding the stack.
      this.armL.rotation = next === 'side' ? -2.1 : 2.75;
      this.armR.rotation = next === 'side' ? -2.1 : -2.75;
      this.armL.position.set(next === 'side' ? 3 : -9, -27);
      this.armR.position.set(next === 'side' ? 5 : 9, -27);
    } else {
      this.armL.rotation = moving ? swing * 0.6 : 0.08;
      this.armR.rotation = moving ? -swing * 0.6 : -0.08;
      this.armL.position.set(-10, -28);
      this.armR.position.set(10, -28);
    }
    const back = next === 'back';
    this.armL.visible = this.armR.visible = true;
    this.head.visible = true;
    // When walking away the arms (holding the stack) are hidden behind the body.
    if (back && carrying) this.armL.visible = this.armR.visible = false;

    // Springy stack lean: a damped spring chasing the opposite of the horizontal velocity.
    if (!this.started) {
      this.started = true;
      this.lastX = x;
    }
    const vx = dt > 0 ? (x - this.lastX) / dt : 0;
    this.lastX = x;
    if (dt > 0) {
      const target = Math.max(-7, Math.min(7, -vx * 0.03));
      this.leanV += ((target - this.lean) * 140 - this.leanV * 13) * dt;
      this.lean += this.leanV * dt;
    }

    for (let i = 0; i < this.bag.length; i++) {
      const s = this.bag[i]!;
      s.visible = c.coins > 0 && i < Math.ceil((c.coins / Math.max(1, c.coinCap)) * this.bag.length);
    }
  }
}
