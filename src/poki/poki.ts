// Poki SDK wrapper ("poki-kit"). Portable: no game imports, hooks for pause/mute during ads.
// Rules enforced here:
//  - init never blocks the game (errors are swallowed, e.g. with an ad blocker)
//  - gameplayStart/gameplayStop are never sent twice in a row and never during an ad
//  - rewardedBreak resolves true only on a successful view

export type RewardedSize = 'small' | 'medium' | 'large';

interface PokiSDKType {
  init(): Promise<void>;
  setDebug(on: boolean): void;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(opts?: { size?: RewardedSize; onStart?: () => void } | (() => void)): Promise<boolean>;
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKType;
  }
}

export interface AdHooks {
  /** Pause the game, mute audio, block input. */
  onAdStart: () => void;
  /** Resume audio and input (the caller decides when gameplay resumes). */
  onAdEnd: () => void;
}

/** Local stand-in when the SDK is missing: simulates ads in development, grants nothing in production. */
export interface MockAd {
  show: (kind: 'commercial' | 'rewarded', done: (watched: boolean) => void) => void;
}

class PokiKit {
  private sdk: PokiSDKType | null = null;
  private inGameplay = false;
  private adActive = false;
  private hooks: AdHooks = { onAdStart: () => {}, onAdEnd: () => {} };
  private mock: MockAd | null = null;
  private pending: Promise<unknown> | null = null;

  get adPlaying(): boolean {
    return this.adActive;
  }

  get hasSdk(): boolean {
    return this.sdk !== null;
  }

  setHooks(hooks: AdHooks): void {
    this.hooks = hooks;
  }

  setMock(mock: MockAd | null): void {
    this.mock = mock;
  }

  async init(debug = false): Promise<void> {
    const sdk = typeof window !== 'undefined' ? window.PokiSDK : undefined;
    if (!sdk) return;
    try {
      await sdk.init();
    } catch {
      // Ad blocker or network error: keep the SDK object, the game must start anyway.
    }
    this.sdk = sdk;
    if (debug) {
      try {
        sdk.setDebug(true);
      } catch {
        /* ignore */
      }
    }
  }

  loadingFinished(): void {
    try {
      this.sdk?.gameLoadingFinished();
    } catch {
      /* ignore */
    }
  }

  gameplayStart(): void {
    if (this.inGameplay || this.adActive) return;
    this.inGameplay = true;
    try {
      this.sdk?.gameplayStart();
    } catch {
      /* ignore */
    }
  }

  gameplayStop(): void {
    if (!this.inGameplay || this.adActive) return;
    this.inGameplay = false;
    try {
      this.sdk?.gameplayStop();
    } catch {
      /* ignore */
    }
  }

  get playing(): boolean {
    return this.inGameplay;
  }

  private start(): void {
    this.adActive = true;
    this.hooks.onAdStart();
  }

  private end(): void {
    if (!this.adActive) return;
    this.adActive = false;
    this.hooks.onAdEnd();
  }

  /** Interstitial. Call only when returning to gameplay from a screen; gameplay must be stopped. */
  commercialBreak(): Promise<void> {
    if (this.pending) return this.pending.then(() => undefined);
    this.gameplayStop();
    const p = new Promise<void>((resolve) => {
      const finish = (): void => {
        this.end();
        resolve();
      };
      if (this.sdk) {
        try {
          this.sdk.commercialBreak(() => this.start()).then(finish, finish);
        } catch {
          finish();
        }
      } else if (this.mock) {
        this.start();
        this.mock.show('commercial', () => finish());
      } else {
        resolve();
      }
    });
    this.pending = p.finally(() => {
      this.pending = null;
    });
    return p;
  }

  /** Rewarded ad. Resolves true only when the player watched it to the end. */
  rewardedBreak(size: RewardedSize): Promise<boolean> {
    if (this.pending) return Promise.resolve(false);
    this.gameplayStop();
    const p = new Promise<boolean>((resolve) => {
      const finish = (ok: boolean): void => {
        this.end();
        resolve(ok === true);
      };
      if (this.sdk) {
        try {
          this.sdk.rewardedBreak({ size, onStart: () => this.start() }).then(
            (ok) => finish(ok),
            () => finish(false),
          );
        } catch {
          finish(false);
        }
      } else if (this.mock) {
        this.start();
        this.mock.show('rewarded', (watched) => finish(watched));
      } else {
        resolve(false);
      }
    });
    this.pending = p.finally(() => {
      this.pending = null;
    });
    return p;
  }
}

export const Poki = new PokiKit();
