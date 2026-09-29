// DOM user interface: HUD, pause, offline-earnings screen, new-location screen, toasts, mock ad overlay.
// All text comes from the i18n dictionary.
import { language, languages, onLanguageChange, t } from '../core/i18n.ts';
import { LANGUAGE_NAMES } from '../i18n/index.ts';
import { formatCoins, formatTime } from '../game/text.ts';

const COIN_SVG = `<svg class="coin-ico" viewBox="0 0 40 40"><circle cx="20" cy="22" r="17" fill="#d97706"/><circle cx="20" cy="19" r="17" fill="#fbbf24"/><circle cx="20" cy="19" r="11.5" fill="none" stroke="#d97706" stroke-width="2.6" opacity=".75"/><rect x="18" y="12" width="4" height="14" rx="1.5" fill="#d97706"/><circle cx="13" cy="12" r="3" fill="#fde68a"/></svg>`;
const PAUSE_SVG = `<svg viewBox="0 0 20 20"><rect x="3" y="2" width="5" height="16" rx="1.5" fill="#fff"/><rect x="12" y="2" width="5" height="16" rx="1.5" fill="#fff"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export interface Settings {
  sfx: boolean;
  music: boolean;
}

export interface PauseActions {
  getSettings: () => Settings;
  setSfx: (on: boolean) => void;
  setMusic: (on: boolean) => void;
  setLanguage: (code: string) => void;
  stats: () => { delivered: number; broken: number };
}

export class UI {
  readonly root: HTMLDivElement;
  private readonly coins: HTMLDivElement;
  private readonly coinValue: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private readonly turbo: HTMLDivElement;
  readonly pauseBtn: HTMLButtonElement;
  private readonly screen: HTMLDivElement;
  private readonly adOverlay: HTMLDivElement;
  private shownCoins = -1;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private screenOpen = false;
  private refreshScreen: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root = el('div');
    this.root.id = 'ui';
    host.appendChild(this.root);

    this.coins = el('div', 'hud-coins', COIN_SVG);
    this.coinValue = el('span');
    this.coins.appendChild(this.coinValue);
    this.coins.addEventListener('animationend', () => this.coins.classList.remove('bump'));
    this.root.appendChild(this.coins);

    const badges = el('div', 'hud-badges');
    this.turbo = el('div', 'badge');
    badges.appendChild(this.turbo);
    this.root.appendChild(badges);

    this.pauseBtn = el('button', 'hud-pause', PAUSE_SVG);
    this.pauseBtn.setAttribute('aria-label', t('ui.pause'));
    this.root.appendChild(this.pauseBtn);

    this.hint = el('div', 'hud-hint');
    this.root.appendChild(this.hint);
    this.toastEl = el('div', 'toast');
    this.root.appendChild(this.toastEl);

    this.screen = el('div', 'screen');
    this.root.appendChild(this.screen);
    this.adOverlay = el('div', 'ad-overlay');
    this.root.appendChild(this.adOverlay);

    onLanguageChange(() => {
      this.pauseBtn.setAttribute('aria-label', t('ui.pause'));
      this.refreshScreen?.();
    });
  }

  get isScreenOpen(): boolean {
    return this.screenOpen;
  }

  private targetCoins = 0;
  private rolling = -1;

  /** Sets the coin total; the counter rolls toward it (see update). */
  setCoins(v: number): void {
    this.targetCoins = Math.floor(v);
    if (this.rolling < 0) this.rolling = this.targetCoins;
  }

  /** Coin arrived at the counter: bump and sparkle. */
  bumpCoin(): void {
    this.coins.classList.remove('bump');
    void this.coins.offsetWidth;
    this.coins.classList.add('bump');
  }

  update(dt: number): void {
    const target = this.targetCoins;
    if (this.rolling !== target) {
      const diff = target - this.rolling;
      // Count up visibly, but never take more than ~0.7 s; spending drops faster.
      const rate = diff > 0 ? 4.5 : 10;
      const step = diff * Math.min(1, dt * rate);
      this.rolling = Math.abs(diff) < 1 ? target : this.rolling + (Math.abs(step) < 1 ? Math.sign(diff) : step);
    }
    const n = Math.floor(this.rolling);
    if (n === this.shownCoins) return;
    this.shownCoins = n;
    this.coinValue.textContent = formatCoins(n);
  }

  /** Screen position of the coin counter (coins fly there). */
  coinTarget(): { x: number; y: number } {
    const r = this.coins.getBoundingClientRect();
    const h = this.root.getBoundingClientRect();
    return { x: r.left - h.left + r.height / 2, y: r.top - h.top + r.height / 2 };
  }

  setHint(text: string | null): void {
    if (text) {
      if (this.hint.textContent !== text) this.hint.textContent = text;
      this.hint.classList.add('on');
    } else {
      this.hint.classList.remove('on');
    }
  }

  toast(text: string, sub = '', ms = 3200): void {
    this.toastEl.innerHTML = '';
    this.toastEl.append(document.createTextNode(text));
    if (sub) {
      const s = el('small');
      s.textContent = sub;
      this.toastEl.append(s);
    }
    this.toastEl.classList.add('on');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('on'), ms);
  }

  setTurbo(secondsLeft: number | null): void {
    if (secondsLeft === null || secondsLeft <= 0) {
      this.turbo.classList.remove('on');
      return;
    }
    this.turbo.classList.add('on');
    const txt = `⚡ ${t('ui.turbo')} ×2 · ${formatTime(secondsLeft)}`;
    if (this.turbo.textContent !== txt) this.turbo.textContent = txt;
  }

  setHudVisible(on: boolean): void {
    this.coins.style.visibility = on ? '' : 'hidden';
    this.pauseBtn.style.visibility = on ? '' : 'hidden';
  }

  // -------------------------------------------------------------------------------------------
  // Screens
  // -------------------------------------------------------------------------------------------

  private open(build: () => HTMLElement): void {
    this.screenOpen = true;
    const render = (): void => {
      this.screen.innerHTML = '';
      this.screen.appendChild(build());
    };
    this.refreshScreen = render;
    render();
    this.screen.classList.add('on');
  }

  /** Presses the green button of the open screen (keyboard resume from pause). */
  pressPrimary(): void {
    this.screen.querySelector<HTMLButtonElement>('.btn.green')?.click();
  }

  close(): void {
    this.screenOpen = false;
    this.refreshScreen = null;
    this.screen.classList.remove('on');
    this.screen.innerHTML = '';
  }

  private button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', `btn ${cls}`);
    b.textContent = text;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  showPause(actions: PauseActions): Promise<void> {
    return new Promise((resolve) => {
      const build = (): HTMLElement => {
        const card = el('div', 'card');
        const h = el('h1');
        h.textContent = t('ui.paused');
        card.appendChild(h);
        const row = el('div', 'row');
        row.appendChild(
          this.button(t('ui.resume'), 'green', () => {
            this.close();
            resolve();
          }),
        );
        card.appendChild(row);
        const s = actions.getSettings();
        const grid = el('div', 'settings');
        const toggle = (name: string, on: boolean, set: (v: boolean) => void): void => {
          const lab = el('span');
          lab.textContent = name;
          const b = this.button(on ? t('ui.on') : t('ui.off'), `small toggle ${on ? 'green' : 'grey'}`, () => {
            set(!on);
            this.refreshScreen?.();
          });
          grid.append(lab, b);
        };
        toggle(t('ui.sound'), s.sfx, actions.setSfx);
        toggle(t('ui.music'), s.music, actions.setMusic);
        const langs = languages();
        if (langs.length > 1) {
          const lab = el('span');
          lab.textContent = t('ui.language');
          const sel = el('select', 'lang');
          for (const code of langs) {
            const o = el('option');
            o.value = code;
            o.textContent = LANGUAGE_NAMES[code] ?? code;
            o.selected = code === language();
            sel.appendChild(o);
          }
          sel.addEventListener('change', () => actions.setLanguage(sel.value));
          sel.addEventListener('pointerdown', (e) => e.stopPropagation());
          grid.append(lab, sel);
        }
        card.appendChild(grid);
        const st = actions.stats();
        const stats = el('div', 'stats');
        stats.textContent = t('ui.stats', { d: st.delivered, b: st.broken });
        card.appendChild(stats);
        return card;
      };
      this.open(build);
    });
  }

  /** Offline earnings. Resolves 'claim' or 'double' (the ad button). */
  showOffline(coins: number, seconds: number): Promise<'claim' | 'double'> {
    return new Promise((resolve) => {
      this.open(() => {
        const card = el('div', 'card');
        const h = el('h1');
        h.textContent = t('ui.welcomeBack');
        const p = el('p');
        const mins = Math.round(seconds / 60);
        p.textContent = t('ui.offlineText', { time: mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min` });
        const big = el('div', 'big-coins', COIN_SVG);
        big.append(document.createTextNode(formatCoins(coins)));
        const row = el('div', 'row');
        row.append(
          this.button(t('ui.claim'), 'green', () => {
            this.close();
            resolve('claim');
          }),
          this.button(`🎬 ${t('ui.claimX2')}`, 'ad', () => {
            this.close();
            resolve('double');
          }),
        );
        card.append(h, p, big, row);
        return card;
      });
    });
  }

  /** New location reached. Resolves 'continue' or 'double'. */
  showNewLocation(name: string, mult: number, startCoins: number): Promise<'continue' | 'double'> {
    return new Promise((resolve) => {
      this.open(() => {
        const card = el('div', 'card');
        const h = el('h1');
        h.textContent = t('ui.newLocation');
        const n = el('div', 'loc-name');
        n.textContent = name;
        const p = el('p');
        p.textContent = t('ui.newLocationText', { mult });
        const big = el('div', 'big-coins', COIN_SVG);
        big.append(document.createTextNode(formatCoins(startCoins)));
        const row = el('div', 'row');
        row.append(
          this.button(t('ui.continue'), 'green', () => {
            this.close();
            resolve('continue');
          }),
          this.button(`🎬 ${t('ui.doubleStart')}`, 'ad', () => {
            this.close();
            resolve('double');
          }),
        );
        card.append(h, n, p, big, row);
        return card;
      });
    });
  }

  showMessage(title: string, text: string, button: string): Promise<void> {
    return new Promise((resolve) => {
      this.open(() => {
        const card = el('div', 'card');
        const h = el('h1');
        h.textContent = title;
        const p = el('p');
        p.textContent = text;
        const row = el('div', 'row');
        row.appendChild(
          this.button(button, 'green', () => {
            this.close();
            resolve();
          }),
        );
        card.append(h, p, row);
        return card;
      });
    });
  }

  /** Stand-in ad used only when the Poki SDK is absent in development. */
  mockAd(done: () => void): void {
    this.adOverlay.innerHTML = '';
    const title = el('div');
    title.textContent = `🎬 ${t('ui.ad')}`;
    const bar = el('div', 'bar');
    const fill = el('i');
    bar.appendChild(fill);
    this.adOverlay.append(title, bar);
    this.adOverlay.classList.add('on');
    const start = performance.now();
    const dur = 1500;
    const tick = (): void => {
      const k = Math.min(1, (performance.now() - start) / dur);
      fill.style.width = `${k * 100}%`;
      if (k < 1) requestAnimationFrame(tick);
      else {
        this.adOverlay.classList.remove('on');
        done();
      }
    };
    requestAnimationFrame(tick);
  }
}
