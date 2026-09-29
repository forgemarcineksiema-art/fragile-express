// Game: owns the Pixi app, the simulation of the current location, the views, UI, audio, saving and
// every Poki flow (gameplay events, commercial and rewarded breaks).
import { Application, Container, Sprite, Texture } from 'pixi.js';
import { ScreenCoins } from './fx.ts';
import { Sound, type SfxName } from '../core/audio.ts';
import { detectLanguage, setLanguage, t } from '../core/i18n.ts';
import { readJson, writeJson } from '../core/storage.ts';
import { Poki, type RewardedSize } from '../poki/poki.ts';
import { FIRST_LOCATION, getLocation, LOCATIONS } from '../sim/locations.ts';
import { offlineEarnings } from '../sim/offline.ts';
import { defaultSettings, migrate, SAVE_KEY, SAVE_VERSION, type SaveData } from '../sim/save.ts';
import type { SimEvent } from '../sim/types.ts';
import { Warehouse } from '../sim/warehouse.ts';
import { UI } from '../ui/ui.ts';
import type { Atlas } from './atlas.ts';
import { Camera, baseZoomFor } from './camera.ts';
import { Guide } from './guide.ts';
import { Input } from './input.ts';
import { DISTRICT_COLORS } from './palette.ts';
import { formatCoins, setLabelScale } from './text.ts';
import { buildAtlas } from './textures.ts';
import { WorldView } from './world.ts';

const STEP = 1 / 60;
const AUTOSAVE = 10;
/** No commercial breaks during the first 5 minutes of play (lifetime). */

type State = 'boot' | 'play' | 'pause' | 'screen' | 'ad';

export class Game {
  private app!: Application;
  private atlas!: Atlas;
  private ui!: UI;
  private input!: Input;
  private readonly camera = new Camera();
  private readonly screenLayer = new Container();
  private vignette: Sprite | null = null;
  private coinTrail!: ScreenCoins;
  private wh!: Warehouse;
  private world!: WorldView;
  private guide!: Guide;
  private data!: SaveData;
  private state: State = 'boot';
  private acc = 0;
  private time = 0;
  private saveT = 0;
  private payFxT = 0;
  private lockInput = 0;
  private lastPlayerX = 0;
  private lastPlayerY = 0;

  constructor(private readonly host: HTMLElement) {}

  async init(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resizeTo: this.host,
      background: '#2b2f38',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    this.host.appendChild(this.app.canvas);
    this.atlas = buildAtlas(this.app.renderer);
    this.ui = new UI(this.host);
    this.input = new Input(this.host);
    this.input.onPause = () => this.togglePause();
    this.input.onActivity = () => Sound.unlock();
    this.ui.pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Sound.unlock();
      Sound.play('ui');
      this.togglePause();
    });
    this.ui.pauseBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const) {
      window.addEventListener(ev, () => Sound.unlock(), { capture: true });
    }

    Poki.setHooks({
      onAdStart: () => {
        this.input.enabled = false;
        this.input.clear();
        Sound.mute('ad', true);
        this.app.ticker.stop();
      },
      onAdEnd: () => {
        Sound.mute('ad', false);
        this.input.enabled = true;
        this.app.ticker.start();
      },
    });
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('mockads')) {
      Poki.setMock({ show: (_kind, done) => this.ui.mockAd(() => done(true)) });
    }

    this.data = this.loadSave();
    Sound.setSfx(this.data.settings.sfx);
    Sound.setMusic(this.data.settings.music);
    setLanguage(this.data.settings.lang ?? detectLanguage(navigator.languages ?? [navigator.language]));

    this.vignette = makeVignette();
    this.coinTrail = new ScreenCoins(this.atlas);
    this.screenLayer.addChild(this.coinTrail.layer);
    this.app.stage.addChild(this.vignette, this.screenLayer);
    const locId = LOCATIONS[this.data.current.loc] ? this.data.current.loc : FIRST_LOCATION;
    const hasSave = this.data.t > 0;
    this.enterLocation(new Warehouse(getLocation(locId), hasSave ? this.data.current : null));

    this.camera.resize(this.app.screen.width, this.app.screen.height);
    this.camera.snap(this.wh.player.x, this.wh.player.y);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        Sound.mute('hidden', true);
        this.writeSave();
        if (this.state === 'play') this.openPause();
      } else {
        Sound.mute('hidden', false);
      }
    });
    window.addEventListener('pagehide', () => this.writeSave());

    this.app.ticker.add((tk) => this.frame(Math.min(tk.deltaMS / 1000, 0.1)));

    // Returning player: show what the team earned while away before gameplay starts.
    if (hasSave) {
      const away = (Date.now() - this.data.t) / 1000;
      const off = offlineEarnings(this.wh.loc, this.wh.toSave(), away);
      if (off) {
        this.state = 'screen';
        void this.offlineFlow(off.coins, off.seconds);
        return;
      }
    }
    this.state = 'play';
  }

  // -------------------------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------------------------

  private loadSave(): SaveData {
    const loaded = migrate(readJson<unknown>(SAVE_KEY));
    if (loaded) return loaded;
    return {
      v: SAVE_VERSION,
      t: 0,
      playTime: 0,
      current: new Warehouse(getLocation(FIRST_LOCATION), null, { noAds: true }).toSave(),
      settings: defaultSettings(),
      flags: {},
    };
  }

  private writeSave(): void {
    if (!this.wh) return;
    this.data.current = this.wh.toSave();
    this.data.t = Date.now();
    this.data.v = SAVE_VERSION;
    writeJson(SAVE_KEY, this.data);
  }

  // -------------------------------------------------------------------------------------------
  // Location
  // -------------------------------------------------------------------------------------------

  private enterLocation(wh: Warehouse): void {
    if (this.world) {
      this.app.stage.removeChild(this.world.root);
      this.world.root.destroy({ children: true });
      this.guide.edge.destroy();
    }
    this.wh = wh;
    setLabelScale(Math.max(1, Math.min(1.45, 0.95 / baseZoomFor(this.app.screen.width, this.app.screen.height))));
    this.world = new WorldView(wh, this.atlas, this.app.renderer);
    this.world.onVanEvent = (ev, x, y) => {
      if (ev === 'reverse') this.sfxAt('reverse', x, y);
      else if (ev === 'stop') this.sfxAt('brake', x, y);
    };
    this.app.stage.addChildAt(this.world.root, 0);
    const b = this.world.bounds;
    this.camera.setBounds(b.x, b.y, b.w, b.h);
    this.camera.snap(wh.player.x, wh.player.y);
    this.guide = new Guide(this.atlas, this.screenLayer, !!this.data.flags.tutorial || wh.loc.id !== FIRST_LOCATION, () => {
      this.data.flags.tutorial = true;
      this.writeSave();
    });
    this.lastPlayerX = wh.player.x;
    this.lastPlayerY = wh.player.y;
    this.acc = 0;
  }

  private async locationFlow(): Promise<void> {
    this.state = 'screen';
    Poki.gameplayStop();
    this.writeSave();
    const next = this.wh.loc.next ? LOCATIONS[this.wh.loc.next] : undefined;
    if (!next) {
      await this.ui.showMessage(t('ui.newLocation'), t('ui.comingSoon'), t('ui.continue'));
      await this.maybeCommercial();
      this.state = 'play';
      return;
    }
    Sound.play('unlock');
    const choice = await this.ui.showNewLocation(t(next.name), next.multiplier, next.startCoins);
    let coins = next.startCoins;
    if (choice === 'double') {
      if (await this.rewarded('large')) coins *= 2;
    } else {
      await this.maybeCommercial();
    }
    // Leftover coins move along with the player; nothing earned is lost.
    const leftover = Math.floor(this.wh.coins);
    const wh = new Warehouse(next, null);
    wh.coins = coins + leftover;
    this.enterLocation(wh);
    this.writeSave();
    this.ui.toast(t(next.name), t('ui.newLocationText', { mult: next.multiplier }));
    this.state = 'play';
  }

  private async offlineFlow(coins: number, seconds: number): Promise<void> {
    const choice = await this.ui.showOffline(coins, seconds);
    let gain = coins;
    // Shown at startup: no commercial break here.
    if (choice === 'double' && (await this.rewarded('medium'))) gain *= 2;
    this.wh.coins += gain;
    this.world.fx.float(this.wh.player.x, this.wh.player.y - 70, `+${formatCoins(gain)}`, 0xfde047, 26);
    Sound.play('coin');
    this.writeSave();
    this.state = 'play';
  }

  // -------------------------------------------------------------------------------------------
  // Ads
  // -------------------------------------------------------------------------------------------

  /**
   * A commercial break whenever the player returns to gameplay from a screen. Poki decides whether an
   * ad actually plays (no timers of our own); never called at startup.
   */
  private async maybeCommercial(): Promise<void> {
    this.state = 'ad';
    await Poki.commercialBreak();
  }

  private async rewarded(size: RewardedSize): Promise<boolean> {
    const prev = this.state;
    this.state = 'ad';
    const ok = await Poki.rewardedBreak(size);
    this.state = prev === 'ad' ? 'play' : prev;
    return ok;
  }

  private async adPadFlow(id: string, size: RewardedSize): Promise<void> {
    this.state = 'ad';
    const ok = await Poki.rewardedBreak(size);
    this.wh.resolveAd(id, ok);
    this.handleEvents(this.wh.drainEvents());
    this.state = 'play';
  }

  // -------------------------------------------------------------------------------------------
  // Pause
  // -------------------------------------------------------------------------------------------

  private togglePause(): void {
    if (this.state === 'play') this.openPause();
    else if (this.state === 'pause') this.ui.pressPrimary();
  }

  private openPause(): void {
    this.state = 'pause';
    Poki.gameplayStop();
    this.input.clear();
    this.writeSave();
    void this.ui
      .showPause({
        getSettings: () => this.data.settings,
        setSfx: (on) => {
          this.data.settings.sfx = on;
          Sound.setSfx(on);
          this.writeSave();
        },
        setMusic: (on) => {
          this.data.settings.music = on;
          Sound.setMusic(on);
          this.writeSave();
        },
        setLanguage: (code) => {
          this.data.settings.lang = code;
          setLanguage(code);
          // World labels (wall sign, floor zones) are baked at build time: rebuild the views.
          this.enterLocation(this.wh);
          this.writeSave();
        },
        stats: () => this.wh.stats,
      })
      .then(async () => {
        await this.maybeCommercial();
        this.state = 'play';
      });
  }

  // -------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------

  private frame(dt: number): void {
    this.time += dt;
    const wh = this.wh;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    if (sw !== this.camera.viewW || sh !== this.camera.viewH) this.camera.resize(sw, sh);
    if (this.vignette && (this.vignette.width !== sw || this.vignette.height !== sh)) {
      this.vignette.width = sw;
      this.vignette.height = sh;
    }
    if (this.state === 'play') {
      this.lockInput = Math.max(0, this.lockInput - dt);
      const intent = this.lockInput > 0 || this.camera.revealing ? { x: 0, y: 0, careful: false } : this.input.read();
      wh.input = intent;
      if ((intent.x !== 0 || intent.y !== 0) && !Poki.playing) Poki.gameplayStart();
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        wh.step(STEP);
        this.acc -= STEP;
        steps++;
        this.handleEvents(wh.drainEvents());
        if ((this.state as State) !== 'play') break;
      }
      if (steps === 6) this.acc = 0;
      if (Poki.playing) this.data.playTime += dt;
      this.saveT += dt;
      if (this.saveT >= AUTOSAVE) {
        this.saveT = 0;
        this.writeSave();
      }
      this.payFx(dt);
    }
    const alpha = this.state === 'play' ? this.acc / STEP : 1;
    this.world.update(this.state === 'play' ? dt : dt * 0.25, alpha, this.time);
    const p = wh.player;
    const px = p.px + (p.x - p.px) * alpha;
    const py = p.py + (p.y - p.py) * alpha;
    const vx = dt > 0 ? (px - this.lastPlayerX) / dt : 0;
    const vy = dt > 0 ? (py - this.lastPlayerY) / dt : 0;
    this.lastPlayerX = px;
    this.lastPlayerY = py;
    const stackH = p.stack.length > 0 ? p.y - this.world.stackTop(p.id).y : 0;
    this.camera.update(dt, px, py - 30, vx, vy, stackH);
    this.camera.apply(this.world.root, dt);
    const hint = this.guide.update(dt, wh, this.world, this.camera);
    this.ui.setHint(this.state === 'play' ? hint : null);
    this.updateGoal();
    if (this.state === 'play') this.footsteps();
    Sound.setNight(this.world.daylight.lamps);
    Sound.duck(this.state !== 'play');
    this.ui.setCoins(wh.coins);
    this.ui.update(dt);
    this.coinTrail.update(dt);
    this.ui.setTurbo(wh.turboActive() ? wh.turboUntil - wh.time : null);
  }

  private payFx(dt: number): void {
    const pad = this.wh.payingPad;
    if (!pad) return;
    this.payFxT -= dt;
    if (this.payFxT > 0) return;
    this.payFxT = 0.06;
    this.world.fx.payCoin(this.wh.player.x, this.wh.player.y, pad.x, pad.y);
    Sound.play('pay');
  }

  private sfx(name: SfxName, pitch = 0): void {
    Sound.play(name, pitch);
  }

  /** A sound from a place in the world: panned by where it is on screen, fading out off-screen. */
  private sfxAt(name: SfxName, x: number, y: number, pitch = 0, vol = 1): void {
    const cam = this.camera;
    const hw = cam.viewW / cam.zoom / 2;
    const hh = cam.viewH / cam.zoom / 2;
    const dx = (x - cam.x) / hw;
    const dy = (y - cam.y) / hh;
    const d = Math.hypot(dx, dy);
    const fade = d <= 1 ? 1 : Math.max(0, 1 - (d - 1) / 0.7);
    Sound.play(name, pitch, vol * fade, Math.max(-1, Math.min(1, dx)) * 0.6);
  }

  private lastStep = 0;

  /** Location progress: milestones (districts, hires, second vans, the move) bought of all. */
  private updateGoal(): void {
    const wh = this.wh;
    if (this.state !== 'play' || !this.guide || this.guide.active) {
      this.ui.setGoal(null);
      return;
    }
    const miles = wh.pads.filter((p) => p.def.type !== 'upgrade');
    const done = miles.filter((p) => wh.padBought(p.id)).length;
    let next: (typeof miles)[number] | null = null;
    for (const p of miles) {
      if (!p.visible || wh.padBought(p.id)) continue;
      if (!next || wh.padCost(p) - p.paid < wh.padCost(next) - next.paid) next = p;
    }
    const labelOf = (p: (typeof miles)[number]): string => {
      switch (p.def.type) {
        case 'district':
          return t('pad.district');
        case 'hire':
          return t(`hire.${p.def.role}`);
        case 'van2':
          return t('pad.van2');
        default:
          return t('pad.move');
      }
    };
    const left = next ? Math.ceil(wh.padCost(next) - next.paid) : 0;
    this.ui.setGoal({
      name: t(wh.loc.name),
      done,
      total: miles.length,
      next: next ? { label: labelOf(next), price: left, affordable: wh.coins >= left } : null,
    });
  }

  /** Footsteps of the player, one per foot fall. */
  private footsteps(): void {
    const p = this.wh.player;
    const stride = 9.5 * Math.PI;
    const n = Math.floor(p.walked / stride);
    if (n !== this.lastStep) {
      if (p.moving && n > this.lastStep) Sound.play('step', n % 2, p.running ? 0.9 : 0.55);
      this.lastStep = n;
    }
  }

  private handleEvents(events: SimEvent[]): void {
    const wh = this.wh;
    const world = this.world;
    const isPlayer = (id: number): boolean => id === wh.player.id;
    for (const e of events) {
      switch (e.type) {
        case 'pickup':
          if (isPlayer(e.carrier)) this.sfx('pick', Math.min(12, wh.player.stack.length));
          break;
        case 'drop':
          if (isPlayer(e.carrier)) this.sfx('drop', e.to === 'van' ? 3 : 0);
          else {
            const c = world.chars.get(e.carrier);
            if (c) this.sfxAt('drop', c.x, c.y, e.to === 'van' ? 3 : 0, 0.35);
          }
          break;
        case 'stamp':
          if (isPlayer(e.carrier)) this.sfx('stamp');
          break;
        case 'break': {
          if (isPlayer(e.carrier)) this.sfx('glass');
          else {
            const c = world.chars.get(e.carrier);
            if (c) this.sfxAt('glass', c.x, c.y);
          }
          const top = world.stackTop(e.carrier);
          world.fx.shatter(top.x, top.y + 60, 60, DISTRICT_COLORS[e.district]!);
          world.fx.float(top.x, top.y - 10, `💔 −${formatCoins(15 * wh.loc.multiplier)}`, 0xfca5a5, 20);
          world.say(e.carrier, '!');
          this.camera.shake(9);
          break;
        }
        case 'wobble':
          this.sfx('wobble');
          break;
        case 'vanDepart': {
          const dock = wh.docks.find((d) => d.id === e.dock)!;
          this.sfxAt('van', dock.geom.bay.x, dock.geom.bay.y);
          // A toot now and then, not every time a van leaves.
          if (Math.random() < 0.3) this.sfxAt('horn', dock.geom.bay.x, dock.geom.bay.y, 0, 0.8);
          world.fx.dust(dock.geom.bay.x - 60, dock.geom.bay.y + 30, 8);
          if (e.dock === 'dock0') this.guide.vanLeft = true;
          break;
        }
        case 'coinsDropped': {
          // The payout rains out of the van onto the pile; the pile grows as coins land.
          const idx = wh.piles.findIndex((p) => p.id === e.pile);
          const pile = wh.piles[idx]!;
          const door = world.docks[idx]!.doorPoint;
          const n = Math.min(16, Math.max(5, Math.round(e.amount / (5 * wh.loc.multiplier))));
          const view = world.piles[idx]!;
          world.fx.coinRain(door.x + 6, door.y + 4, 34, pile.x, pile.y, n, () => view.land(e.amount / n), () => this.sfxAt('clink', pile.x, pile.y, Math.random() * 4));
          const turbo = wh.turboActive();
          world.fx.payout(pile.x, pile.y - 46, `+${formatCoins(e.amount)}${turbo ? ' ×2' : ''}`, turbo ? 0xc4b5fd : 0xfde047);
          this.sfxAt('cash', pile.x, pile.y);
          break;
        }
        case 'collect': {
          if (!isPlayer(e.carrier)) break;
          // Coins jump off the floor and fly into the counter at the top of the screen.
          const pile = wh.piles.find((p) => p.id === e.pile)!;
          const units = Math.round(e.amount / (5 * wh.loc.multiplier));
          world.fx.pickupBurst(pile.x, pile.y, 6);
          const from = this.camera.worldToScreen(pile.x, pile.y - 10);
          const to = this.ui.coinTarget();
          const n = Math.min(16, Math.max(5, units));
          this.coinTrail.fly(from.x, from.y, to.x, to.y, n, (i) => {
            this.ui.bumpCoin();
            this.sfx('clink', Math.min(12, i));
          });
          world.fx.payout(wh.player.x, wh.player.y - 96, `+${formatCoins(e.amount)}`);
          world.emote(wh.player.id, 'happy', 0.9);
          this.sfx('coin');
          break;
        }
        case 'deposit': {
          world.say(e.carrier, '$');
          const s = wh.layout.safe.stand;
          const c = world.chars.get(e.carrier);
          const b = wh.layout.safe.body;
          if (c) world.fx.coinRain(c.x, c.y, 30, b.x + b.w / 2, b.y + 6, 6, () => world.desk.pop(), () => this.sfxAt('clink', s.x, s.y, 2));
          world.fx.payout(s.x, s.y - 78, `+${formatCoins(e.amount)}`);
          this.sfxAt('cash', s.x, s.y);
          break;
        }
        case 'purchase': {
          const pad = wh.pads.find((p) => p.id === e.pad)!;
          const big = pad.def.type !== 'upgrade';
          this.sfx(big ? 'unlock' : 'buy');
          if (big && pad.def.type !== 'move') {
            const miles = wh.pads.filter((p) => p.def.type !== 'upgrade');
            const done = miles.filter((p) => wh.padBought(p.id)).length;
            this.ui.popGoal();
            this.ui.toast(t('goal.done', { n: done, total: miles.length }));
          }
          world.fx.confetti(e.x, e.y);
          world.emote(wh.player.id, 'happy', 1.2);
          if (e.reveal) {
            this.camera.startReveal(e.reveal.x, e.reveal.y);
            this.lockInput = 0.4;
          }
          this.writeSave();
          break;
        }
        case 'padShown': {
          if (!e.reveal) break;
          const pad = wh.pads.find((p) => p.id === e.pad)!;
          this.camera.startReveal(e.x, e.y);
          if (pad.def.type === 'move') this.ui.toast(t('hint.move'));
          else if (pad.def.type === 'hire') this.ui.toast(t('hint.worker'));
          break;
        }
        case 'courierArrive':
          Sound.play('hire');
          if (!this.data.flags.courier) {
            this.data.flags.courier = true;
            this.ui.toast(t('hint.courierIntro'), '', 5000);
          }
          break;
        case 'courierHand': {
          const cv = world.courier;
          if (!cv) break;
          const at = { x: cv.figure.x, y: cv.figure.y - 60 };
          this.sfxAt('drop', at.x, at.y + 60, 2);
          world.fx.payout(at.x, at.y - 30, `+${formatCoins(e.amount)}`);
          const from = this.camera.worldToScreen(at.x, at.y);
          const to = this.ui.coinTarget();
          this.coinTrail.fly(from.x, from.y, to.x, to.y, 5, (i) => {
            this.ui.bumpCoin();
            this.sfx('clink', Math.min(12, i + 4));
          });
          break;
        }
        case 'courierDone': {
          const cv = world.courier;
          if (!cv) break;
          this.sfx('cash');
          world.fx.confetti(cv.figure.x, cv.figure.y - 40);
          world.fx.payout(cv.figure.x, cv.figure.y - 120, `+${formatCoins(e.bonus)} ★`, 0xfde047);
          cv.say('👍');
          world.emote(wh.player.id, 'happy', 1.2);
          break;
        }
        case 'courierLeave':
          if (!e.complete) world.courier?.say('…');
          break;
        case 'hired': {
          this.sfx('hire');
          world.say(e.carrier, '👋');
          const s = wh.layout.safe.stand;
          world.fx.dust(s.x, s.y, 8);
          break;
        }
        case 'helperGone':
          this.ui.toast(t('hint.helperGone'), '', 2200);
          break;
        case 'fragileIntro':
          this.ui.toast(t('hint.fragile'), this.input.usingJoystick || matchMedia('(pointer: coarse)').matches ? t('hint.fragileTouch') : t('hint.fragileKeys'), 6000);
          break;
        case 'spawn': {
          const p = wh.parcels.get(e.parcel);
          if (p?.kind === 'express' && !this.data.flags.express) {
            this.data.flags.express = true;
            this.ui.toast(t('hint.express'), '', 5000);
          } else if (p?.kind === 'xxl' && !this.data.flags.xxl) {
            this.data.flags.xxl = true;
            this.ui.toast(t('hint.xxl'), '', 5000);
          }
          break;
        }
        case 'adPadShown':
          if (e.kind !== 'assist') this.sfx('ui');
          break;
        case 'adRequest':
          void this.adPadFlow(e.pad, e.size);
          break;
        case 'turboStart':
          this.sfx('turbo');
          break;
        case 'turboEnd':
          this.ui.toast(t('hint.turboEnd'), '', 2000);
          break;
        case 'locationComplete':
          void this.locationFlow();
          break;
      }
    }
  }
}

/** Soft dark edges drawn over the world (screen space, under the HUD). */
function makeVignette(): Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(128, 128, 80, 128, 128, 184);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(24,18,44,0.34)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  const s = new Sprite(Texture.from(c));
  s.eventMode = 'none';
  return s;
}
