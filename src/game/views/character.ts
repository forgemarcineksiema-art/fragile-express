// Character view shared by the player and the workers: tinted body parts animated by transforms only.
// Also owns the stack "physics": a damped spring chain where every parcel follows the one below it,
// so the stack lags behind when the carrier speeds up and whips back when it stops.
import { Container, Sprite, type Text } from 'pixi.js';
import type { Carrier } from '../../sim/carrier.ts';
import { OUTFITS, type FaceKind, type Mood, type Outfit } from '../art-people.ts';
import type { Atlas } from '../atlas.ts';
import { COIN, INK } from '../palette.ts';
import { label } from '../text.ts';

const SKINS = [0xf5c9a0, 0xe0ac7e, 0xc68642, 0x8d5524, 0xffdbac, 0xd4a373];
const HAIR = [0x3b2a1a, 0x1f1a17, 0x7c4a1e, 0xd6a24a, 0x9a3412, 0x57534e];

/** Height of the hands above the ground: the first parcel of the stack sits here. */
export const HANDS_Z = 20;

type Facing = 'front' | 'side' | 'back';

const K = 230; // spring stiffness between neighbouring parcels
const D = 12; // damping
const INERTIA = 0.034; // how much the carrier's acceleration pushes each parcel
const HEAD_Y = -41;
const SHOULDER_Y = -29;
const ARM_LEN = 15;

export class CharacterView {
  readonly node = new Container();
  /** Drawn in front of the stack: hands, sweat drop and speech bubbles. */
  readonly front = new Container();
  private readonly legL: Sprite;
  private readonly legR: Sprite;
  private readonly shoeL: Sprite;
  private readonly shoeR: Sprite;
  private readonly body = new Container();
  private readonly torso: Sprite;
  private readonly armL = new Container();
  private readonly armR = new Container();
  private readonly head: Sprite;
  private readonly face: Sprite;
  private readonly hair: Sprite;
  private readonly hat: Sprite;
  private readonly logo: Sprite | null;
  private readonly handL: Sprite;
  private readonly handR: Sprite;
  private readonly drop: Sprite;
  private readonly bag: Sprite[] = [];
  private readonly outfit: Outfit;
  private readonly hatName: 'cap' | 'hardhat';
  private readonly bubble = new Container();
  private readonly bubbleText: Text;
  private bubbleT = 0;
  private facing: Facing | null = null;
  private faceKey = '';
  private flip = 1;
  private blinkT = 2 + Math.random() * 3;
  private mood: Mood = 'normal';
  private moodT = 0;
  private started = false;
  private lastX = 0;
  private vx = 0;
  private ax = 0;
  private offs: number[] = [];
  private vels: number[] = [];
  bob = 0;
  x = 0;
  y = 0;

  constructor(
    private readonly atlas: Atlas,
    readonly carrier: Carrier,
    helper: boolean,
  ) {
    const role = carrier.role;
    const seed = Math.abs(carrier.id * 7919);
    this.outfit = helper ? 'helper' : (role as Outfit);
    const style = OUTFITS[this.outfit];
    const skin = role === 'player' ? SKINS[0]! : SKINS[seed % SKINS.length]!;
    const hairColor = role === 'player' ? 0x5b3a1b : HAIR[(seed >> 3) % HAIR.length]!;
    this.hatName = style.hat;

    const shadow = this.part('shadow');
    this.legL = this.part('pants_leg', style.pants);
    this.legR = this.part('pants_leg', style.pants);
    this.shoeL = this.part('shoe_front', style.shoes);
    this.shoeR = this.part('shoe_front', style.shoes);
    this.torso = this.part(`torso_${this.outfit}_front`);
    for (const arm of [this.armL, this.armR]) {
      const sleeve = this.part('sleeve', style.sleeve);
      const fore = this.part('forearm', style.forearm ?? skin);
      fore.position.set(0, 7);
      arm.addChild(sleeve, fore);
    }
    this.head = this.part('head_front', skin);
    this.face = this.part('face_front_normal');
    this.hair = this.part('hair_front', hairColor);
    this.hat = this.part(`${this.hatName}_front`, style.hatColor);
    this.logo = role === 'player' ? this.part('caplogo_front') : null;
    const handTint = style.glove ?? skin;
    this.handL = this.part('hand', handTint);
    this.handR = this.part('hand', handTint);
    this.drop = this.part('drop');
    this.drop.visible = false;

    this.legL.position.set(-4.5, -1.5);
    this.legR.position.set(4.5, -1.5);
    this.torso.position.set(0, -9);
    for (const p of [this.head, this.hair]) p.position.set(0, HEAD_Y);
    this.face.position.set(0, HEAD_Y + 1);
    // Hats sit a little high so the brim never covers the eyes.
    this.hat.position.set(0, HEAD_Y - 2);
    this.logo?.position.set(0, HEAD_Y - 2);
    this.node.addChild(shadow, this.legL, this.legR, this.shoeL, this.shoeR, this.body);
    this.body.addChild(this.armL, this.torso, this.armR, this.head, this.face, this.hair, this.hat);
    if (this.logo) this.body.addChild(this.logo);
    this.front.addChild(this.handL, this.handR, this.drop, this.bubble);

    const bubbleSprite = this.part('bubble');
    this.bubbleText = label('', 17, INK, { stroke: { color: 0xffffff, width: 0 } });
    this.bubbleText.position.set(0, -21);
    this.bubble.addChild(bubbleSprite, this.bubbleText);
    this.bubble.visible = false;

    const scale = role === 'player' ? 1.12 : 1;
    this.node.scale.set(scale);
    this.front.scale.set(scale);
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

  /** Shows a mood for a moment (happy after a sale, shocked after a break). */
  emote(mood: Mood, seconds = 1): void {
    this.mood = mood;
    this.moodT = seconds;
  }

  /** Screen-space offset of the stack base relative to the feet. */
  stackOffset(): { dx: number; front: boolean } {
    // Held out in front when walking sideways, so the face stays visible.
    if (this.facing === 'side') return { dx: this.flip * 26, front: true };
    return { dx: 0, front: this.facing !== 'back' };
  }

  /** Horizontal sway of stack level `i` (spring chain). */
  sway(i: number): number {
    return this.offs[i] ?? 0;
  }

  /** Tilt of stack level `i` from the bend between it and the level below. */
  swayRot(i: number): number {
    const below = i === 0 ? 0 : (this.offs[i - 1] ?? 0);
    return ((this.offs[i] ?? 0) - below) * 0.06;
  }

  /** Pops a short speech bubble ("!", "$", "♥"). */
  say(text: string, seconds = 1.2): void {
    this.bubbleText.text = text;
    this.bubbleT = seconds;
    this.bubble.visible = true;
    if (text === '!') this.emote('shock', 1.1);
    else this.emote('happy', 1);
  }

  update(x: number, y: number, dt: number, time: number): void {
    const c = this.carrier;
    this.x = x;
    this.y = y;
    this.node.position.set(x, y);
    this.front.position.set(x, y);
    this.node.zIndex = y;
    this.front.zIndex = y + 0.03;

    // Facing
    const ax = Math.abs(c.dirX);
    const ay = Math.abs(c.dirY);
    const next: Facing = ay > ax * 1.1 ? (c.dirY > 0 ? 'front' : 'back') : 'side';
    if (next !== this.facing) {
      this.facing = next;
      this.hat.texture = this.atlas.get(`${this.hatName}_${next}`);
      this.hair.texture = this.atlas.get(`hair_${next}`);
      this.head.texture = this.atlas.get(`head_${next}`);
      this.torso.texture = this.atlas.get(`torso_${this.outfit}_${next === 'back' ? 'back' : 'front'}`);
      this.face.visible = next !== 'back';
      if (this.logo) {
        this.logo.visible = next !== 'back';
        if (next !== 'back') this.logo.texture = this.atlas.get(`caplogo_${next}`);
      }
      const shoe = this.atlas.get(next === 'side' ? 'shoe_side' : 'shoe_front');
      this.shoeL.texture = shoe;
      this.shoeR.texture = shoe;
      this.faceKey = '';
    }
    this.flip = next === 'side' && c.dirX < 0 ? -1 : 1;
    this.body.scale.x = this.flip;
    this.shoeL.scale.x = this.shoeR.scale.x = next === 'side' ? this.flip : 1;

    // Velocity and acceleration of the carrier on screen (drives lean and the stack springs).
    if (!this.started) {
      this.started = true;
      this.lastX = x;
    }
    if (dt > 0) {
      const nvx = (x - this.lastX) / dt;
      const nax = (nvx - this.vx) / dt;
      this.ax += (nax - this.ax) * Math.min(1, dt * 30);
      this.vx = nvx;
    }
    this.lastX = x;

    // Walk cycle driven by the distance walked; squash on every step, lean into the run.
    const phase = c.walked / 8.5;
    const moving = c.moving;
    const swing = moving ? Math.sin(phase) : 0;
    this.legL.y = -1.5 - (moving ? Math.max(0, swing) * 3 : 0);
    this.legR.y = -1.5 - (moving ? Math.max(0, -swing) * 3 : 0);
    if (next === 'side') {
      this.legL.x = -2 + swing * 4 * this.flip;
      this.legR.x = 2 - swing * 4 * this.flip;
    } else {
      this.legL.x = -4.5;
      this.legR.x = 4.5;
    }
    this.shoeL.position.set(this.legL.x, this.legL.y + 1.5);
    this.shoeR.position.set(this.legR.x, this.legR.y + 1.5);
    const step = Math.abs(Math.cos(phase));
    this.bob = moving ? -step * 1.8 : Math.sin(time * 2.2 + c.id) * 0.5;
    this.body.y = this.bob;
    const squash = moving ? 1 - (1 - step) * 0.05 : 1 + Math.sin(time * 2.2 + c.id) * 0.012;
    this.body.scale.y = squash;
    const lean = Math.max(-0.14, Math.min(0.14, this.vx * 0.0006));
    this.body.rotation += (lean - this.body.rotation) * Math.min(1, dt * 12);

    const carrying = c.stack.length > 0 || c.coins > 0;
    const back = next === 'back';
    if (carrying) {
      this.armL.rotation = next === 'side' ? -1.75 : 2.75;
      this.armR.rotation = next === 'side' ? -1.75 : -2.75;
      this.armL.position.set(next === 'side' ? 3 : -10, SHOULDER_Y + 2);
      this.armR.position.set(next === 'side' ? 5 : 10, SHOULDER_Y + 2);
    } else {
      this.armL.rotation = moving ? swing * 0.6 : 0.1;
      this.armR.rotation = moving ? -swing * 0.6 : -0.1;
      this.armL.position.set(-11, SHOULDER_Y);
      this.armR.position.set(11, SHOULDER_Y);
    }
    this.armL.visible = this.armR.visible = !(back && carrying);

    // Hands: gripping the bottom parcel when carrying, at the end of the swinging arms otherwise.
    const holding = c.stack.length > 0 && !back;
    this.handL.visible = this.handR.visible = !back || !carrying;
    const sc = this.node.scale.y;
    if (holding) {
      // Parcels are placed in world units; the hands live in the scaled container.
      const bx = this.stackOffset().dx + this.sway(0);
      const bz = (HANDS_Z - this.bob) * sc + 5;
      this.handL.position.set((bx - 13.5) / sc, -bz / sc);
      this.handR.position.set((bx + 13.5) / sc, -bz / sc);
    } else if (c.coins > 0) {
      this.handL.position.set(-7, -22 + this.bob);
      this.handR.position.set(7, -22 + this.bob);
    } else {
      // End of each arm, following the body's flip, lean and bob.
      const cos = Math.cos(this.body.rotation);
      const sin = Math.sin(this.body.rotation);
      const place = (hand: Sprite, shoulderX: number, r: number): void => {
        const lx = this.flip * (shoulderX - Math.sin(r) * ARM_LEN);
        const ly = SHOULDER_Y + Math.cos(r) * ARM_LEN;
        hand.position.set(lx * cos - ly * sin, lx * sin + ly * cos + this.bob);
      };
      place(this.handL, -11, this.armL.rotation);
      place(this.handR, 11, this.armR.rotation);
    }

    // Mood: emotes win, then worry about a wobbling stack; blink now and then.
    if (this.moodT > 0) this.moodT -= dt;
    else this.mood = c.wobble > 0.35 || (c.role === 'player' && c.hasFragile() && c.runTime > 1.6) ? 'worried' : 'normal';
    this.blinkT -= dt;
    if (this.blinkT <= 0) this.blinkT = 2.5 + Math.random() * 3;
    const kind: FaceKind = this.mood === 'normal' && this.blinkT < 0.13 ? 'blink' : this.mood;
    if (next !== 'back') {
      const key = `face_${next === 'side' ? 'side' : 'front'}_${kind}`;
      if (key !== this.faceKey) {
        this.faceKey = key;
        this.face.texture = this.atlas.get(key);
      }
    }
    this.drop.visible = this.mood === 'worried' && !back;
    if (this.drop.visible) this.drop.position.set(this.flip * (next === 'side' ? -8 : 11), HEAD_Y - 6 + this.bob + Math.abs(Math.sin(time * 5)) * 3);

    for (let i = 0; i < this.bag.length; i++) {
      this.bag[i]!.visible = c.coins > 0 && i < Math.ceil((c.coins / Math.max(1, c.coinCap)) * this.bag.length);
    }

    this.updateStack(dt, time);
    this.updateBubble(dt);
  }

  private updateStack(dt: number, time: number): void {
    const c = this.carrier;
    const n = c.stack.length;
    while (this.offs.length < n) {
      // New parcel on top starts where the previous top is.
      this.offs.push(this.offs[this.offs.length - 1] ?? 0);
      this.vels.push(0);
    }
    this.offs.length = n;
    this.vels.length = n;
    if (dt <= 0 || n === 0) return;
    const w = c.wobble;
    const h = Math.min(dt, 1 / 30);
    for (let i = 0; i < n; i++) {
      const below = i === 0 ? 0 : this.offs[i - 1]!;
      let f = (below - this.offs[i]!) * K - this.vels[i]! * D - this.ax * INERTIA * K * 0.05;
      if (w > 0.02) f += Math.sin(time * (8 + w * 7) + i * 0.6) * w * 380 * ((i + 1) / n);
      this.vels[i] = this.vels[i]! + f * h;
      const lim = 4 + i * 3.4;
      const o = this.offs[i]! + this.vels[i]! * h;
      if (!Number.isFinite(o)) {
        this.offs[i] = 0;
        this.vels[i] = 0;
      } else {
        this.offs[i] = Math.max(-lim, Math.min(lim, o));
      }
    }
  }

  private updateBubble(dt: number): void {
    if (this.bubbleT <= 0) return;
    this.bubbleT -= dt;
    const top = -64 - this.carrier.stack.length * 3;
    this.bubble.position.set(this.facing === 'side' ? -this.flip * 18 : -20, top);
    const age = 1.2 - this.bubbleT;
    const pop = age < 0.15 ? 0.5 + (age / 0.15) * 0.6 : age < 0.25 ? 1.1 - ((age - 0.15) / 0.1) * 0.1 : 1;
    this.bubble.scale.set(this.bubbleT < 0.15 ? Math.max(0, this.bubbleT / 0.15) : pop);
    if (this.bubbleT <= 0) this.bubble.visible = false;
  }

  hideBubble(): void {
    this.bubble.visible = false;
    this.bubbleT = 0;
  }

  destroy(): void {
    this.node.destroy({ children: true });
    this.front.destroy({ children: true });
  }
}
