// Character view shared by the player and the workers: a cut-out rig (thighs and shins with knees,
// upper arms and forearms with elbows, torso, neck, head) posed every frame from the carrier's
// motion. The body height follows the legs, so it dips when the stride is widest and rises as the
// legs pass. Also owns the stack "physics": a damped spring chain where every parcel follows the one
// below it, so the stack lags behind when the carrier speeds up and whips back when it stops.
import { Container, Sprite, type Text } from 'pixi.js';
import type { Carrier } from '../../sim/carrier.ts';
import { HAIR_STYLES, OUTFITS, RIG, type FaceKind, type HairStyle, type Mood, type Outfit } from '../art-people.ts';
import { setTexture, type Atlas } from '../atlas.ts';
import { COIN, INK, shade } from '../palette.ts';
import { label } from '../text.ts';

const SKINS = [0xefc4a0, 0xdca57c, 0xc0875a, 0x8d5a3b, 0xf3d2b6, 0xa8714c];
const HAIR = [0x2b1d14, 0x17120f, 0x5e3b21, 0xb8904f, 0x7a3413, 0x4a4541, 0x9a938c];

/** Height of the hands above the ground when carrying: the first parcel of the stack sits here. */
export const HANDS_Z = 30;

type Facing = 'front' | 'side' | 'back';

const K = 230; // spring stiffness between neighbouring parcels
const D = 12; // damping
const INERTIA = 0.034; // how much the carrier's acceleration pushes each parcel
/** World units walked per radian of the walk cycle. */
const STRIDE = 9.5;
const LEG = RIG.thigh + RIG.shin;
/** How far in front of the body a stack is held when walking sideways. */
const SIDE_REACH = 18;

interface Limb {
  /** At the shoulder or hip. */
  root: Container;
  upper: Sprite;
  /** At the elbow or knee. */
  joint: Container;
  lower: Sprite;
  /** Hand or shoe. */
  end: Sprite;
  tints: [number, number, number];
}

export class CharacterView {
  readonly node = new Container();
  /** Drawn in front of the stack: hands gripping it, sweat drop and speech bubbles. */
  readonly front = new Container();
  private readonly rig = new Container();
  private readonly legL: Limb;
  private readonly legR: Limb;
  private readonly armL: Limb;
  private readonly armR: Limb;
  private readonly armsBehind = new Container();
  private readonly armsFront = new Container();
  private readonly neck: Sprite;
  private readonly torso: Sprite;
  private readonly headGroup = new Container();
  private readonly head: Sprite;
  private readonly beard: Sprite | null;
  private readonly face: Sprite;
  private readonly hair: Sprite;
  private readonly hat: Sprite;
  private readonly logo: Sprite | null;
  private readonly carryL: Sprite;
  private readonly carryR: Sprite;
  private readonly drop: Sprite;
  private readonly coins = new Container();
  private readonly outfit: Outfit;
  private readonly hairStyle: HairStyle;
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
  private amp = 0;
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
    const player = role === 'player';
    const skin = player ? SKINS[0]! : SKINS[seed % SKINS.length]!;
    const hairColor = player ? 0x4a2e17 : HAIR[(seed >> 3) % HAIR.length]!;
    this.hairStyle = player ? 'short' : HAIR_STYLES[(seed >> 5) % HAIR_STYLES.length]!;
    const bearded = !player && (this.hairStyle === 'short' || this.hairStyle === 'crop') && (seed >> 7) % 3 === 0;
    this.hatName = style.hat;

    const shadow = this.part('shadow');
    shadow.scale.set(0.9, 0.85);
    this.legL = this.limb('thigh', 'shin', 'shoe_front', style.pants, style.pants, style.shoes, RIG.thigh, RIG.shin);
    this.legR = this.limb('thigh', 'shin', 'shoe_front', style.pants, style.pants, style.shoes, RIG.thigh, RIG.shin);
    const fore = style.forearm ?? skin;
    const hand = style.glove ?? skin;
    this.armL = this.limb('upperarm', 'forearm', 'hand', style.sleeve, fore, hand, RIG.upper, RIG.fore + 0.8);
    this.armR = this.limb('upperarm', 'forearm', 'hand', style.sleeve, fore, hand, RIG.upper, RIG.fore + 0.8);
    this.neck = this.part('neck', skin);
    this.neck.position.set(0, RIG.neckY);
    this.torso = this.part(`torso_${this.outfit}_front`);
    this.torso.position.set(0, RIG.torsoY);
    this.head = this.part('head_front', skin);
    this.beard = bearded ? this.part('beard_front', hairColor) : null;
    this.face = this.part('face_front_normal');
    this.hair = this.part(`hair_${this.hairStyle}_front`, hairColor);
    this.hat = this.part(`${this.hatName}_front`, style.hatColor);
    this.logo = player ? this.part('caplogo_front') : null;
    this.headGroup.position.set(0, RIG.headY);
    this.headGroup.scale.set(1.08);
    this.headGroup.addChild(this.head);
    if (this.beard) this.headGroup.addChild(this.beard);
    this.headGroup.addChild(this.face, this.hair, this.hat);
    if (this.logo) this.headGroup.addChild(this.logo);

    this.rig.addChild(this.legL.root, this.legR.root, this.armsBehind, this.neck, this.torso, this.coins, this.armsFront, this.headGroup);
    this.node.addChild(shadow, this.rig);

    this.carryL = this.part('hand', hand);
    this.carryR = this.part('hand', hand);
    this.drop = this.part('drop');
    this.drop.visible = false;
    this.front.addChild(this.carryL, this.carryR, this.drop, this.bubble);

    const bubbleSprite = this.part('bubble');
    this.bubbleText = label('', 17, INK, { stroke: { color: 0xffffff, width: 0 } });
    this.bubbleText.position.set(0, -21);
    this.bubble.addChild(bubbleSprite, this.bubbleText);
    this.bubble.visible = false;

    const scale = player ? 1.1 : 1;
    this.node.scale.set(scale);
    this.front.scale.set(scale);
    if (role === 'collector') {
      for (let i = 0; i < 6; i++) {
        const c = new Sprite(atlas.get('coin'));
        c.scale.set(0.8);
        c.tint = i % 2 ? 0xffffff : COIN;
        c.visible = false;
        this.coins.addChild(c);
      }
    }
  }

  private part(name: string, tint?: number): Sprite {
    const s = new Sprite(this.atlas.get(name));
    if (tint !== undefined) s.tint = tint;
    return s;
  }

  private limb(a: string, b: string, c: string, ta: number, tb: number, tc: number, upperLen: number, lowerLen: number): Limb {
    const root = new Container();
    const upper = this.part(a, ta);
    const joint = new Container();
    joint.y = upperLen;
    const lower = this.part(b, tb);
    const end = this.part(c, tc);
    end.y = lowerLen;
    joint.addChild(lower, end);
    root.addChild(upper, joint);
    return { root, upper, joint, lower, end, tints: [ta, tb, tc] };
  }

  private tintLimb(l: Limb, k: number): void {
    l.upper.tint = shade(l.tints[0], k);
    l.lower.tint = shade(l.tints[1], k);
    l.end.tint = shade(l.tints[2], k);
  }

  /** Shows a mood for a moment (happy after a sale, shocked after a break). */
  emote(mood: Mood, seconds = 1): void {
    this.mood = mood;
    this.moodT = seconds;
  }

  /** Screen-space offset of the stack base relative to the feet. */
  stackOffset(): { dx: number; front: boolean } {
    // Held out in front when walking sideways, so the face stays visible.
    if (this.facing === 'side') return { dx: this.flip * SIDE_REACH, front: true };
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

  private applyFacing(f: Facing): void {
    this.facing = f;
    const a = this.atlas;
    const side = f === 'side';
    const view = side ? 'side' : 'front';
    setTexture(this.head, a.get(`head_${f}`));
    setTexture(this.hair, a.get(`hair_${this.hairStyle}_${f}`));
    setTexture(this.hat, a.get(`${this.hatName}_${f}`));
    setTexture(this.torso, a.get(`torso_${this.outfit}_${f}`));
    this.face.visible = f !== 'back';
    this.faceKey = '';
    if (this.beard) {
      this.beard.visible = f !== 'back';
      setTexture(this.beard, a.get(`beard_${view}`));
    }
    if (this.logo) {
      this.logo.visible = f !== 'back';
      setTexture(this.logo, a.get(`caplogo_${view}`));
    }
    const shoe = a.get(side ? 'shoe_side' : 'shoe_front');
    setTexture(this.legL.end, shoe);
    setTexture(this.legR.end, shoe);
    if (side) {
      // The far arm swings behind the body, the far limbs a shade darker.
      this.armsBehind.addChild(this.armL.root);
      this.armsFront.addChild(this.armR.root);
      this.tintLimb(this.legL, 0.78);
      this.tintLimb(this.armL, 0.78);
      this.legL.root.position.set(-0.6, RIG.hipY);
      this.legR.root.position.set(0.6, RIG.hipY);
      this.armL.root.position.set(-0.4, RIG.shoulderY);
      this.armR.root.position.set(0.3, RIG.shoulderY);
    } else {
      this.armsFront.addChild(this.armL.root, this.armR.root);
      this.tintLimb(this.legL, 1);
      this.tintLimb(this.armL, 1);
      this.legL.root.position.set(-RIG.hipX, RIG.hipY);
      this.legR.root.position.set(RIG.hipX, RIG.hipY);
      this.armL.root.position.set(-RIG.shoulderX, RIG.shoulderY);
      this.armR.root.position.set(RIG.shoulderX, RIG.shoulderY);
    }
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
    const adx = Math.abs(c.dirX);
    const ady = Math.abs(c.dirY);
    const next: Facing = ady > adx * 1.1 ? (c.dirY > 0 ? 'front' : 'back') : 'side';
    if (next !== this.facing) this.applyFacing(next);
    const side = next === 'side';
    const back = next === 'back';
    this.flip = side && c.dirX < 0 ? -1 : 1;
    this.rig.scale.x = this.flip;

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

    // Stride amplitude eases in and out, so the legs come together when the carrier stops.
    const run = c.running;
    const target = c.moving ? (run ? 1 : 0.62) : 0;
    this.amp += (target - this.amp) * Math.min(1, dt * 9);
    const A = this.amp;
    const phase = c.walked / STRIDE;
    const carrying = c.stack.length > 0;
    const holdingCoins = !carrying && c.coins > 0;

    if (side) {
      let reach = 0;
      [this.legL, this.legR].forEach((leg, i) => {
        const p = phase + i * Math.PI;
        const s = Math.sin(p);
        const co = Math.cos(p);
        const t = -s * (run ? 0.46 : 0.5) * A;
        const k = (Math.max(0, co) * (run ? 0.88 : 0.7) + 0.05) * A;
        leg.root.rotation = t;
        leg.root.scale.y = 1;
        leg.joint.rotation = k;
        leg.end.rotation = -(t + k) + (co > 0 ? -0.15 * A : 0);
        reach = Math.max(reach, RIG.thigh * Math.cos(t) + RIG.shin * Math.cos(t + k));
      });
      // Keep the planted foot on the ground: the body sinks as the stride opens.
      this.rig.y = LEG - reach;
    } else {
      [this.legL, this.legR].forEach((leg, i) => {
        const lift = Math.max(0, Math.sin(phase + i * Math.PI)) * A;
        leg.root.rotation = 0;
        leg.root.scale.y = 1 - lift * 0.17;
        leg.joint.rotation = 0;
        leg.end.rotation = 0;
      });
      this.rig.y = -Math.abs(Math.cos(phase)) * 0.9 * A;
    }
    this.bob = this.rig.y;
    const lean = Math.max(-0.12, Math.min(0.12, this.vx * (side ? 0.0005 : 0.00025)));
    this.rig.rotation += (lean - this.rig.rotation) * Math.min(1, dt * 12);
    // Breathing when idle, a little nod with each step when moving
    this.headGroup.y = RIG.headY + (c.moving ? Math.abs(Math.sin(phase)) * 0.35 * A : Math.sin(time * 2.2 + c.id) * 0.25);

    this.poseArms(side, back, carrying, holdingCoins, phase, A, run);
    this.placeCarryHands(side, back, carrying);

    // Coins held in front of the belly by the collector
    const coinN = holdingCoins ? Math.ceil((c.coins / Math.max(1, c.coinCap)) * this.coins.children.length) : 0;
    this.coins.children.forEach((s, i) => {
      s.visible = !back && i < coinN;
      s.position.set(side ? 9 : 0, -32.5 - i * 2.4);
    });

    // Mood: emotes win, then worry about a wobbling stack; blink now and then.
    if (this.moodT > 0) this.moodT -= dt;
    else this.mood = c.wobble > 0.35 || (c.role === 'player' && c.hasFragile() && c.runTime > 1.6) ? 'worried' : 'normal';
    this.blinkT -= dt;
    if (this.blinkT <= 0) this.blinkT = 2.5 + Math.random() * 3;
    const kind: FaceKind = this.mood === 'normal' && this.blinkT < 0.13 ? 'blink' : this.mood;
    if (!back) {
      const key = `face_${side ? 'side' : 'front'}_${kind}`;
      if (key !== this.faceKey) {
        this.faceKey = key;
        setTexture(this.face, this.atlas.get(key));
      }
    }
    this.drop.visible = this.mood === 'worried' && !back;
    if (this.drop.visible) {
      this.drop.position.set(this.flip * (side ? -6.5 : 7), RIG.headY - 4 + this.bob + Math.abs(Math.sin(time * 5)) * 2);
    }

    this.updateStack(dt, time);
    this.updateBubble(dt);
  }

  private poseArms(side: boolean, back: boolean, carrying: boolean, coins: boolean, phase: number, A: number, run: boolean): void {
    const arms = [this.armL, this.armR];
    arms.forEach((arm, i) => {
      arm.root.scale.y = 1;
      arm.joint.scale.y = 1;
      arm.joint.visible = true;
      arm.end.visible = true;
      // -1 for the arm on the viewer's left, +1 on the right (front and back views).
      const sgn = i === 0 ? -1 : 1;
      if (carrying) {
        arm.end.visible = false;
        if (side) {
          arm.root.rotation = -0.5;
          arm.joint.rotation = -1.05;
        } else if (back) {
          arm.root.rotation = -sgn * 0.3;
          arm.joint.visible = false;
        } else {
          arm.root.rotation = -sgn * 0.3;
          arm.root.scale.y = 0.85;
          arm.joint.rotation = sgn * 0.4;
          arm.joint.scale.y = 0.5;
        }
        return;
      }
      if (coins) {
        if (side) {
          arm.root.rotation = -0.3;
          arm.joint.rotation = -1.25;
        } else {
          arm.root.rotation = -sgn * 0.12;
          arm.joint.rotation = sgn * 1.25;
          if (back) arm.joint.visible = false;
        }
        return;
      }
      if (side) {
        const s = Math.sin(phase + i * Math.PI);
        arm.root.rotation = s * (run ? 0.6 : 0.45) * A + 0.04;
        arm.joint.rotation = -(0.18 + 0.4 * Math.max(0, -s) * A + (run ? 0.55 * A : 0));
      } else {
        const swing = Math.sin(phase + i * Math.PI + Math.PI) * A;
        arm.root.rotation = -sgn * (0.07 + 0.05 * A);
        arm.root.scale.y = 1 - Math.max(0, back ? -swing : swing) * 0.14;
        arm.joint.rotation = sgn * (0.1 + (run ? 0.5 : 0.12) * A);
      }
    });
  }

  /** Hands gripping the bottom parcel of the stack (drawn in front of it). */
  private placeCarryHands(side: boolean, back: boolean, carrying: boolean): void {
    const show = carrying && !back;
    this.carryL.visible = show && !side;
    this.carryR.visible = show;
    if (!show) return;
    // Parcels are placed in world units; the hands live in the scaled container.
    const sc = this.node.scale.y;
    const bx = this.stackOffset().dx + this.sway(0);
    const bz = (HANDS_Z - this.bob) * sc + 3.5;
    if (side) {
      this.carryR.position.set((bx - this.flip * 5) / sc, -bz / sc);
    } else {
      this.carryL.position.set((bx - 13.2) / sc, -bz / sc);
      this.carryR.position.set((bx + 13.2) / sc, -bz / sc);
    }
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
    const top = -78 - this.carrier.stack.length * 3;
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
