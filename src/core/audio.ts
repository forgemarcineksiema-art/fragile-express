// Synthesised sound (WebAudio, no audio files): physical-sounding effects placed in stereo by the
// game, a quiet warehouse ambience with crickets at night, and a groove that loops for minutes
// before it repeats. Everything goes through a compressor so busy moments never clip.

export type SfxName =
  | 'pick'
  | 'drop'
  | 'stamp'
  | 'coin'
  | 'pay'
  | 'buy'
  | 'unlock'
  | 'glass'
  | 'wobble'
  | 'van'
  | 'horn'
  | 'hire'
  | 'ui'
  | 'turbo'
  | 'reverse'
  | 'brake'
  | 'clink'
  | 'cash'
  | 'error'
  | 'step';

export const SFX_NAMES: SfxName[] = ['pick', 'drop', 'stamp', 'coin', 'pay', 'buy', 'unlock', 'glass', 'wobble', 'van', 'horn', 'hire', 'ui', 'turbo', 'reverse', 'brake', 'clink', 'cash', 'error', 'step'];

type Wave = OscillatorType;

/** A place to synthesise into: a context, an output node and a start time. */
interface Out {
  ctx: BaseAudioContext;
  dest: AudioNode;
  t: number;
  noise: AudioBuffer;
}

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

function env(g: GainNode, t: number, vol: number, attack: number, dur: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Oscillator with an exponential decay; optional pitch slide and lowpass. */
function osc(o: Out, when: number, freq: number, dur: number, wave: Wave, vol: number, opts: { to?: number; attack?: number; lp?: number; lpTo?: number } = {}): void {
  const { ctx } = o;
  const t = o.t + when;
  const s = ctx.createOscillator();
  s.type = wave;
  s.frequency.setValueAtTime(freq, t);
  if (opts.to) s.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const g = ctx.createGain();
  env(g, t, vol, opts.attack ?? 0.004, dur);
  let node: AudioNode = s;
  if (opts.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(opts.lp, t);
    if (opts.lpTo) f.frequency.exponentialRampToValueAtTime(opts.lpTo, t + dur);
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(o.dest);
  s.start(t);
  s.stop(t + dur + 0.03);
}

/** Filtered noise burst; optional filter sweep. */
function noise(o: Out, when: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1, opts: { to?: number; attack?: number } = {}): void {
  const { ctx } = o;
  const t = o.t + when;
  const src = ctx.createBufferSource();
  src.buffer = o.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, vol, opts.attack ?? 0.002, dur);
  src.connect(f).connect(g).connect(o.dest);
  src.start(t, Math.random() * 0.8);
  src.stop(t + dur + 0.03);
}

/** Two-operator FM bell: metallic partials for coins and chimes. */
function bell(o: Out, when: number, freq: number, dur: number, vol: number, ratio = 3.5, index = 1.4): void {
  const { ctx } = o;
  const t = o.t + when;
  const car = ctx.createOscillator();
  car.frequency.value = freq;
  const mod = ctx.createOscillator();
  mod.frequency.value = freq * ratio;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(freq * index, t);
  depth.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur);
  mod.connect(depth).connect(car.frequency);
  const g = ctx.createGain();
  env(g, t, vol, 0.002, dur);
  car.connect(g).connect(o.dest);
  car.start(t);
  mod.start(t);
  car.stop(t + dur + 0.03);
  mod.stop(t + dur + 0.03);
}

/** Soft mallet (marimba-like): sine with a quieter octave partial. */
function mallet(o: Out, when: number, freq: number, dur: number, vol: number): void {
  osc(o, when, freq, dur, 'sine', vol, { attack: 0.003 });
  osc(o, when, freq * 4, dur * 0.25, 'sine', vol * 0.18, { attack: 0.002 });
}

const PENTA = [0, 2, 4, 7, 9];

/**
 * Level trims from offline measurements (RMS over each sound): frequent feedback around -24 dBFS,
 * rewards and warnings a little louder, background details quieter.
 */
const TRIM: Partial<Record<SfxName, number>> = {
  pick: 1.2,
  drop: 0.7,
  stamp: 0.8,
  coin: 1.8,
  unlock: 1.3,
  glass: 1.5,
  wobble: 3,
  horn: 2.2,
  turbo: 4,
  reverse: 2,
  cash: 1.7,
};

/** Every sound effect as a recipe; `p` is a pitch step (stack height, coin index). */
const RECIPES: Record<SfxName, (o: Out, p: number) => void> = {
  pick: (o, p) => {
    // Cardboard lifted, plus a mallet note climbing the pentatonic scale as the stack grows.
    noise(o, 0, 0.05, 0.22, 'bandpass', 1300, 0.8);
    const k = Math.max(0, Math.min(14, Math.round(p)));
    const semis = PENTA[k % 5]! + 12 * Math.floor(k / 5);
    mallet(o, 0.005, hz(67 + semis), 0.16, 0.2);
  },
  drop: (o, p) => {
    osc(o, 0, 150 * Math.pow(2, p / 12), 0.12, 'sine', 0.42, { to: 70 });
    noise(o, 0, 0.07, 0.28, 'lowpass', 750, 0.7);
    if (p > 0) osc(o, 0.01, 950, 0.04, 'sine', 0.05);
  },
  stamp: (o) => {
    noise(o, 0, 0.03, 0.4, 'bandpass', 2200, 1.5);
    osc(o, 0, 190, 0.08, 'sine', 0.32, { to: 90 });
  },
  coin: (o) => {
    bell(o, 0, hz(88), 0.28, 0.1, 3.5, 1.2);
    bell(o, 0.07, hz(95), 0.4, 0.1, 3.5, 1.2);
  },
  clink: (o, p) => {
    bell(o, 0, 2500 * Math.pow(2, p / 24), 0.14, 0.07, 1.41, 2);
  },
  pay: (o) => {
    osc(o, 0, 2100 + Math.random() * 200, 0.035, 'sine', 0.06);
    osc(o, 0.004, 3300, 0.025, 'sine', 0.03);
  },
  cash: (o) => {
    noise(o, 0, 0.09, 0.2, 'bandpass', 3000, 1);
    bell(o, 0.05, hz(91), 0.3, 0.09, 3.5, 1.3);
    bell(o, 0.13, hz(96), 0.55, 0.09, 3.5, 1.3);
  },
  buy: (o) => {
    [72, 76, 79, 84].forEach((n, i) => mallet(o, i * 0.055, hz(n), 0.3, 0.2));
    bell(o, 0.24, hz(96), 0.5, 0.04, 2, 0.8);
  },
  unlock: (o) => {
    [67, 72, 76, 79, 84, 88].forEach((n, i) => mallet(o, i * 0.07, hz(n), 0.35, 0.2));
    for (const n of [60, 64, 67, 72]) osc(o, 0.3, hz(n), 1.1, 'triangle', 0.05, { attack: 0.06 });
    noise(o, 0.25, 0.7, 0.06, 'highpass', 6000, 0.7, { attack: 0.15 });
  },
  glass: (o) => {
    noise(o, 0, 0.35, 0.4, 'bandpass', 5200, 0.8);
    noise(o, 0, 0.12, 0.3, 'bandpass', 2500, 1.5);
    for (let i = 0; i < 8; i++) osc(o, 0.02 + i * 0.028, 2500 + Math.random() * 3500, 0.1 + Math.random() * 0.2, 'sine', 0.07);
  },
  wobble: (o) => {
    // Cardboard creak
    osc(o, 0, 118, 0.3, 'sawtooth', 0.06, { to: 92, lp: 1100 });
    osc(o, 0.12, 146, 0.26, 'sawtooth', 0.045, { to: 116, lp: 1100 });
  },
  van: (o) => {
    // Diesel pulling away: a rising, opening engine note and rumble
    osc(o, 0, 46, 1.15, 'sawtooth', 0.22, { to: 92, lp: 240, lpTo: 900, attack: 0.08 });
    osc(o, 0, 92, 1.0, 'sawtooth', 0.07, { to: 170, lp: 400, lpTo: 1200, attack: 0.08 });
    noise(o, 0, 1.0, 0.08, 'lowpass', 320, 0.7, { attack: 0.06 });
  },
  horn: (o) => {
    for (const w of [0, 0.19]) {
      osc(o, w, 370, 0.14, 'sawtooth', 0.06, { lp: 1800, attack: 0.01 });
      osc(o, w, 466, 0.14, 'sawtooth', 0.05, { lp: 1800, attack: 0.01 });
    }
  },
  reverse: (o) => {
    for (let i = 0; i < 3; i++) osc(o, i * 0.3, 1100, 0.13, 'sine', 0.07, { attack: 0.01 });
  },
  brake: (o) => {
    noise(o, 0, 0.36, 0.13, 'highpass', 2600, 0.8, { attack: 0.02 });
  },
  hire: (o) => {
    mallet(o, 0, hz(79), 0.2, 0.2);
    mallet(o, 0.1, hz(86), 0.35, 0.2);
  },
  ui: (o) => {
    osc(o, 0, 1250, 0.035, 'sine', 0.12);
    noise(o, 0, 0.012, 0.06, 'highpass', 4000, 0.7);
  },
  turbo: (o) => {
    noise(o, 0, 0.6, 0.2, 'bandpass', 400, 1.2, { to: 4200, attack: 0.05 });
    osc(o, 0, 220, 0.55, 'sawtooth', 0.05, { to: 880, lp: 2000 });
  },
  error: (o) => {
    osc(o, 0, 210, 0.1, 'triangle', 0.14);
    osc(o, 0.11, 170, 0.14, 'triangle', 0.14);
  },
  step: (o, p) => {
    noise(o, 0, 0.035, 0.07, 'lowpass', p > 0 ? 1000 : 850, 0.8);
    osc(o, 0, p > 0 ? 95 : 85, 0.03, 'sine', 0.06);
  },
};

// ---------------------------------------------------------------------------------------------
// Music: C major, 100 BPM, 16th-note grid. 32-bar form, lead phrases rotate each pass, a
// breakdown every third pass: about five minutes before anything repeats exactly.
// ---------------------------------------------------------------------------------------------

const BPM = 100;
/** Music sits well under the effects. */
const MUSIC_VOL = 0.14;
const STEP = 60 / BPM / 4;
const CHORDS: Record<string, { root: number; notes: number[] }> = {
  C: { root: 48, notes: [60, 64, 67] },
  Am: { root: 45, notes: [57, 60, 64] },
  F: { root: 41, notes: [57, 60, 65] },
  G: { root: 43, notes: [55, 59, 62] },
  Dm7: { root: 50, notes: [57, 60, 62, 65] },
  Em: { root: 40, notes: [55, 59, 64] },
};
const SECTIONS: Record<string, string[]> = {
  A: ['C', 'Am', 'F', 'G'],
  B: ['Dm7', 'G', 'Em', 'Am'],
  C: ['F', 'G', 'Em', 'Am'],
  D: ['F', 'G', 'C', 'C'],
};
const FORM = ['A', 'A', 'B', 'C', 'A', 'A', 'B', 'D'];
/** Two-bar lead phrases on the C major pentatonic (0 = rest). */
const PHRASES = [
  [72, 0, 0, 76, 0, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0, 69, 0, 0, 72, 0, 0, 74, 0, 72, 0, 69, 0, 67, 0, 0, 0],
  [76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 0, 74, 0, 72, 0, 0, 74, 0, 76, 0, 74, 0, 72, 0, 69, 0, 72, 0, 0, 0, 0, 0],
  [67, 0, 69, 72, 0, 0, 72, 0, 74, 0, 72, 69, 0, 0, 67, 0, 64, 0, 67, 0, 69, 0, 72, 0, 74, 0, 0, 76, 0, 0, 0, 0],
  [79, 0, 0, 76, 0, 0, 74, 0, 72, 0, 74, 0, 76, 0, 0, 0, 72, 0, 0, 69, 0, 0, 67, 0, 69, 0, 72, 0, 72, 0, 0, 0],
];
/** Which phrase plays over each two-bar block of the form, per pass (-1 = no lead). */
const LEAD_PLAN = [
  [-1, -1, -1, -1, 0, 1, 2, 3, -1, -1, 0, 1, 2, 3, 0, 3],
  [-1, -1, 2, 3, 0, 1, 2, 3, 1, 0, 2, 3, 0, 1, 2, 3],
  [-1, -1, -1, -1, -1, -1, 1, 2, -1, -1, 3, 0, 1, 2, 0, 3],
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private ambBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private sfxOn = true;
  private musicOn = true;
  private muteReasons = new Set<string>();
  private musicStep = 0;
  private nextNoteAt = 0;
  private last: Partial<Record<SfxName, number>> = {};
  private night = 0;
  private ducked = false;
  private nextCricket = 0;

  /** Creates or resumes the context; call from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 10;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.connect(comp);
        this.sfxBus = ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicFilter = ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.value = 16000;
        this.musicFilter.Q.value = 0.5;
        this.musicFilter.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = MUSIC_VOL;
        this.musicBus.connect(this.musicFilter);
        this.ambBus = ctx.createGain();
        this.ambBus.connect(this.master);
        this.noiseBuf = makeNoise(ctx, 1);
        this.startAmbience();
        this.setSfx(this.sfxOn);
        this.setMusic(this.musicOn);
        this.applyGain();
        // Lookahead scheduler for the music and the crickets; runs for the life of the page.
        setInterval(() => this.tick(), 50);
        this.nextNoteAt = ctx.currentTime + 0.15;
      }
      if (this.ctx.state !== 'running') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.value = on ? 0.6 : 0;
    if (this.ambBus) this.ambBus.gain.value = on ? 1 : 0;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, this.ctx.currentTime, 0.05);
  }

  /** Mutes everything while any reason is active (ads, hidden tab). */
  mute(reason: string, on: boolean): void {
    if (on) this.muteReasons.add(reason);
    else this.muteReasons.delete(reason);
    this.applyGain();
  }

  /** Softer, muffled music behind menus and the pause screen. */
  duck(on: boolean): void {
    if (on === this.ducked) return;
    this.ducked = on;
    this.applyFilter();
  }

  /** 0 = day, 1 = night: crickets outside and a mellower mix. */
  setNight(k: number): void {
    if (Math.abs(k - this.night) < 0.02) return;
    this.night = k;
    this.applyFilter();
  }

  private applyFilter(): void {
    if (!this.ctx || !this.musicFilter) return;
    const cutoff = this.ducked ? 900 : 16000 - this.night * 12500;
    this.musicFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.25);
  }

  private applyGain(): void {
    if (!this.master || !this.ctx) return;
    const target = this.muteReasons.size > 0 ? 0 : 1;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  /**
   * Plays an effect. `pitch` is a step (stack height, coin index); `vol` and `pan` place it
   * relative to the camera (the game fades distant sounds out).
   */
  play(name: SfxName, pitch = 0, vol = 1, pan = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || ctx.state !== 'running' || vol <= 0.02) return;
    // Throttle very frequent sounds.
    const now = ctx.currentTime;
    const minGap = name === 'pay' ? 0.07 : name === 'pick' || name === 'drop' ? 0.03 : name === 'clink' ? 0.035 : name === 'step' ? 0.1 : 0.015;
    if ((this.last[name] ?? -1) > now - minGap) return;
    this.last[name] = now;
    const g = ctx.createGain();
    g.gain.value = vol * (TRIM[name] ?? 1);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.sfxBus!);
    const spread = name === 'drop' || name === 'clink' || name === 'pay' || name === 'step' || name === 'stamp' ? (Math.random() - 0.5) * 1.2 : 0;
    RECIPES[name]({ ctx, dest: g, t: now, noise: this.noiseBuf! }, pitch + spread);
    // Disconnect the voice once it has rung out.
    setTimeout(() => {
      g.disconnect();
      p.disconnect();
    }, 2500);
  }

  // -------------------------------------------------------------------------------------------
  // Ambience
  // -------------------------------------------------------------------------------------------

  private startAmbience(): void {
    const ctx = this.ctx!;
    // Room tone of a big hall: slow brown noise, low-passed, barely there.
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(ctx, 3, true);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(f).connect(g).connect(this.ambBus!);
    src.start();
    // Conveyor motor hum
    const hum = ctx.createOscillator();
    hum.frequency.value = 100;
    const hg = ctx.createGain();
    hg.gain.value = 0.006;
    hum.connect(hg).connect(this.ambBus!);
    hum.start();
  }

  private crickets(now: number): void {
    if (this.night < 0.45 || now < this.nextCricket) return;
    const ctx = this.ctx!;
    this.nextCricket = now + 0.35 + Math.random() * 0.9;
    const pan = Math.random() * 1.6 - 0.8;
    const out = ctx.createStereoPanner();
    out.pan.value = pan;
    out.connect(this.ambBus!);
    const o: Out = { ctx, dest: out, t: now + 0.05, noise: this.noiseBuf! };
    const f = 4200 + Math.random() * 700;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) osc(o, i * 0.07, f, 0.035, 'sine', 0.012 * this.night, { attack: 0.004 });
    setTimeout(() => out.disconnect(), 1500);
  }

  // -------------------------------------------------------------------------------------------
  // Scheduler (music and crickets)
  // -------------------------------------------------------------------------------------------

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.sfxOn) this.crickets(ctx.currentTime);
    if (!this.musicOn) {
      this.nextNoteAt = Math.max(this.nextNoteAt, ctx.currentTime + 0.1);
      return;
    }
    while (this.nextNoteAt < ctx.currentTime + 0.2) {
      this.musicNote(this.musicStep, this.nextNoteAt);
      this.musicStep++;
      this.nextNoteAt += STEP;
    }
  }

  private musicNote(n: number, t: number): void {
    const o: Out = { ctx: this.ctx!, dest: this.musicBus!, t, noise: this.noiseBuf! };
    const s = n % 16;
    const bar = Math.floor(n / 16);
    const pass = Math.floor(bar / 32) % 3;
    const barInForm = bar % 32;
    const chord = CHORDS[SECTIONS[FORM[Math.floor(barInForm / 4)]!]![barInForm % 4]!]!;
    // Every third pass drops the kick and bass for the first eight bars.
    const breakdown = pass === 2 && barInForm < 8;
    // Drums
    if (!breakdown && (s === 0 || s === 8 || (s === 10 && bar % 2 === 1))) osc(o, 0, 120, 0.2, 'sine', 0.5, { to: 45 });
    if (s === 4 || s === 12) {
      noise(o, 0, 0.13, 0.28, 'bandpass', 1800, 0.9);
      osc(o, 0, 190, 0.05, 'sine', 0.12);
    }
    if (s % 2 === 0) noise(o, 0, s % 4 === 2 ? 0.05 : 0.03, s % 4 === 2 ? 0.1 : 0.06, 'highpass', 8000, 0.7);
    // Bass: root, fifth and octave on a syncopated pattern
    const bassAt: Record<number, number> = { 0: 0, 3: 0, 6: 7, 8: 0, 10: 12, 14: 7 };
    const b = bassAt[s];
    if (!breakdown && b !== undefined) {
      osc(o, 0, hz(chord.root + b), STEP * 2.2, 'triangle', 0.5, { lp: 900, attack: 0.008 });
      osc(o, 0, hz(chord.root + b - 12), STEP * 2.2, 'sine', 0.35, { attack: 0.008 });
    }
    // Keys: soft off-beat stabs
    if (s === 2 || s === 6 || s === 10 || s === 14) {
      const kv = breakdown ? 1.8 : 1;
      for (const k of chord.notes) {
        osc(o, 0, hz(k), 0.5, 'sine', 0.07 * kv, { attack: 0.006 });
        osc(o, 0, hz(k + 12), 0.25, 'triangle', 0.025 * kv, { attack: 0.004 });
      }
    }
    // Lead
    const block = Math.floor(barInForm / 2);
    const phrase = LEAD_PLAN[pass]![block]!;
    if (phrase >= 0) {
      const note = PHRASES[phrase]![(barInForm % 2) * 16 + s]!;
      if (note) {
        osc(o, 0, hz(note), STEP * 2.6, 'triangle', 0.2, { attack: 0.01, lp: 3200 });
        osc(o, 0, hz(note) * 1.004, STEP * 2.6, 'sine', 0.08, { attack: 0.01 });
      }
    }
  }
}

function makeNoise(ctx: BaseAudioContext, seconds: number, brown = false): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

/** Development: renders one effect offline and returns its peak and RMS level in dBFS. */
export async function measureSfx(name: SfxName, pitch = 0): Promise<{ peak: number; rms: number; length: number }> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, sr * 2, sr);
  const trim = ctx.createGain();
  trim.gain.value = TRIM[name] ?? 1;
  trim.connect(ctx.destination);
  RECIPES[name]({ ctx, dest: trim, t: 0, noise: makeNoise(ctx, 1) }, pitch);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  let sum = 0;
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]!);
    peak = Math.max(peak, a);
    sum += a * a;
    if (a > 0.001) last = i;
  }
  const n = Math.max(1, last);
  const db = (v: number): number => Math.round(20 * Math.log10(Math.max(1e-6, v)) * 10) / 10;
  return { peak: db(peak), rms: db(Math.sqrt(sum / n)), length: Math.round((last / sr) * 1000) / 1000 };
}

/** Development: renders `seconds` of the music offline and returns its peak and RMS in dBFS. */
export async function measureMusic(seconds = 20, startBar = 0): Promise<{ peak: number; rms: number }> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, sr * seconds, sr);
  const eng = new AudioEngine() as unknown as { ctx: BaseAudioContext; musicBus: AudioNode; noiseBuf: AudioBuffer; musicNote: (n: number, t: number) => void };
  const bus = ctx.createGain();
  bus.gain.value = MUSIC_VOL;
  bus.connect(ctx.destination);
  eng.ctx = ctx;
  eng.musicBus = bus;
  eng.noiseBuf = makeNoise(ctx, 1);
  const steps = Math.floor(seconds / STEP) - 4;
  for (let i = 0; i < steps; i++) eng.musicNote(startBar * 16 + i, i * STEP);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]!);
    peak = Math.max(peak, a);
    sum += a * a;
  }
  const db = (v: number): number => Math.round(20 * Math.log10(Math.max(1e-6, v)) * 10) / 10;
  return { peak: db(peak), rms: db(Math.sqrt(sum / d.length)) };
}

export const Sound = new AudioEngine();
