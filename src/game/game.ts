// Game: owns the Pixi app, the simulation of the current location, the views, UI, audio, saving and
// every Poki flow (gameplay events, commercial and rewarded breaks).
import { Application, Container } from 'pixi.js';
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
import { Camera } from './camera.ts';
import { Guide } from './guide.ts';
import { Input } from './input.ts';
import { DISTRICT_COLORS } from './palette.ts';
import { formatCoins } from './text.ts';
import { buildAtlas } from './textures.ts';
import { WorldView } from './world.ts';

const STEP = 1 / 60;
const AUTOSAVE = 10;
/** No commercial breaks during the first 5 minutes of play (lifetime). */
const NO_ADS_BEFORE = 5 * 60;

type State = 'boot' | 'play' | 'pause' | 'screen' | 'ad';

export class Game {
  private app!: Application;
  private atlas!: Atlas;
  private ui!: UI;
  private input!: Input;
  private readonly camera = new Camera();
  private readonly screenLayer = new Container();
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
    window.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });

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

    this.app.stage.addChild(this.screenLayer);
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
    this.world = new WorldView(wh, this.atlas, this.app.renderer);
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
    if (choice === 'double') {
      if (await this.rewarded('medium')) gain *= 2;
    } else {
      await this.maybeCommercial();
    }
    this.wh.coins += gain;
    this.world.fx.float(this.wh.player.x, this.wh.player.y - 70, `+${formatCoins(gain)}`, 0xfde047, 26);
    Sound.play('coin');
    this.writeSave();
    this.state = 'play';
  }

  // -------------------------------------------------------------------------------------------
  // Ads
  // -------------------------------------------------------------------------------------------

  /** commercialBreak only when returning to gameplay from a screen, never in the first 5 minutes. */
  private async maybeCommercial(): Promise<void> {
    if (this.data.playTime < NO_ADS_BEFORE) return;
    this.state = 'ad';
    await Poki.commercialBreak();
  }

  private async rewarded(size: RewardedSize): Promise<boolean> {
    const prev = this.state;
    this.state = 'ad';
    const ok = await Poki.rewardedBreak(size);
    this.state = prev === 'ad' ? 'play' : prev;
    if (!ok) this.ui.toast(t('ui.adUnavailable'));
    return ok;
  }

  private async adPadFlow(id: string, size: RewardedSize): Promise<void> {
    this.state = 'ad';
    const ok = await Poki.rewardedBreak(size);
    this.wh.resolveAd(id, ok);
    this.handleEvents(this.wh.drainEvents());
    if (!ok) this.ui.toast(t('ui.adUnavailable'));
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
    this.camera.update(dt, px, py - 30, vx, vy);
    this.camera.apply(this.world.root, dt);
    const hint = this.guide.update(dt, wh, this.world, this.camera);
    this.ui.setHint(this.state === 'play' ? hint : null);
    this.ui.setCoins(wh.coins);
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
          break;
        case 'stamp':
          if (isPlayer(e.carrier)) this.sfx('stamp');
          break;
        case 'break': {
          this.sfx('glass');
          const top = world.stackTop(e.carrier);
          world.fx.shatter(top.x, top.y + 60, 60, DISTRICT_COLORS[e.district]!);
          world.fx.float(top.x, top.y - 10, `💔 −${formatCoins(15 * wh.loc.multiplier)}`, 0xfca5a5, 20);
          this.camera.shake(9);
          break;
        }
        case 'wobble':
          this.sfx('wobble');
          break;
        case 'vanDepart': {
          const dock = wh.docks.find((d) => d.id === e.dock)!;
          this.sfx('van');
          this.sfx('horn');
          world.fx.dust(dock.geom.bay.x - 60, dock.geom.bay.y + 30, 8);
          if (e.dock === 'dock0') this.guide.vanLeft = true;
          break;
        }
        case 'coinsDropped': {
          const pile = wh.piles.find((p) => p.id === e.pile)!;
          const door = world.docks[wh.piles.indexOf(pile)]!.doorPoint;
          world.fx.coins(door.x, door.y, 6, () => ({ x: pile.x, y: pile.y }));
          world.fx.float(pile.x, pile.y - 40, `+${formatCoins(e.amount)}`, 0xfde047, 22);
          break;
        }
        case 'collect': {
          if (!isPlayer(e.carrier)) break;
          const pile = wh.piles.find((p) => p.id === e.pile)!;
          this.sfx('coin');
          world.fx.coins(pile.x, pile.y, Math.ceil(e.amount / (5 * wh.loc.multiplier)), () => ({ x: wh.player.x, y: wh.player.y - 20 }));
          world.fx.float(wh.player.x, wh.player.y - 80, `+${formatCoins(e.amount)}`, 0xfde047, 24);
          break;
        }
        case 'deposit': {
          const s = wh.layout.safe.stand;
          world.fx.float(s.x, s.y - 70, `+${formatCoins(e.amount)}`, 0xfde047, 20);
          this.sfx('coin', -5);
          break;
        }
        case 'purchase': {
          const pad = wh.pads.find((p) => p.id === e.pad)!;
          const big = pad.def.type !== 'upgrade';
          this.sfx(big ? 'unlock' : 'buy');
          world.fx.confetti(e.x, e.y);
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
        case 'hired': {
          this.sfx('hire');
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
