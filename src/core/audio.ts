// Synthesised sound effects and a small music loop (WebAudio, no audio files).

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
  | 'error';

type Wave = OscillatorType;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sfxOn = true;
  private musicOn = true;
  private muteReasons = new Set<string>();
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private nextNoteAt = 0;
  private last: Partial<Record<SfxName, number>> = {};

  /** Creates or resumes the context; call from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.55;
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.16;
        this.musicBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.applyGain();
        if (this.musicOn) this.startMusic();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.value = on ? 0.55 : 0;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** Mutes everything while any reason is active (ads, hidden tab). */
  mute(reason: string, on: boolean): void {
    if (on) this.muteReasons.add(reason);
    else this.muteReasons.delete(reason);
    this.applyGain();
  }

  private applyGain(): void {
    if (!this.master || !this.ctx) return;
    const target = this.muteReasons.size > 0 ? 0 : 1;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, wave: Wave, vol: number, when = 0, slideTo?: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxBus!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private hiss(dur: number, vol: number, freq: number, q: number, when = 0, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus!);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  /** `pitch` shifts pickups up as the stack grows. */
  play(name: SfxName, pitch = 0): void {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return;
    // Throttle very frequent sounds.
    const now = this.ctx.currentTime;
    const minGap = name === 'pay' ? 0.07 : name === 'pick' || name === 'drop' ? 0.03 : 0.015;
    if ((this.last[name] ?? -1) > now - minGap) return;
    this.last[name] = now;
    const up = Math.pow(2, pitch / 12);
    switch (name) {
      case 'pick':
        this.tone(520 * up, 0.08, 'sine', 0.35, 0, 820 * up);
        break;
      case 'drop':
        this.tone(330 * up, 0.09, 'triangle', 0.35, 0, 190 * up);
        this.hiss(0.04, 0.08, 1800, 1);
        break;
      case 'stamp':
        this.hiss(0.05, 0.25, 900, 2);
        this.tone(200, 0.06, 'square', 0.12);
        break;
      case 'coin':
        this.tone(1320, 0.06, 'square', 0.12);
        this.tone(1760, 0.12, 'square', 0.12, 0.05);
        break;
      case 'pay':
        this.tone(1500 + Math.random() * 200, 0.04, 'triangle', 0.14);
        break;
      case 'buy':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.12, i * 0.06));
        this.tone(2093, 0.3, 'sine', 0.08, 0.24);
        break;
      case 'unlock':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, i * 0.08));
        this.hiss(0.5, 0.05, 6000, 0.7, 0.3, 'highpass');
        break;
      case 'glass':
        this.hiss(0.35, 0.45, 5200, 0.8);
        this.hiss(0.12, 0.35, 2500, 1.5);
        for (let i = 0; i < 7; i++) this.tone(2400 + Math.random() * 3000, 0.12 + Math.random() * 0.2, 'sine', 0.08, 0.02 + i * 0.03);
        break;
      case 'wobble':
        this.tone(140, 0.25, 'sawtooth', 0.07, 0, 110);
        this.tone(170, 0.25, 'sawtooth', 0.05, 0.12, 130);
        break;
      case 'van':
        this.tone(70, 0.9, 'sawtooth', 0.09, 0, 150, 0.1);
        this.hiss(0.9, 0.06, 400, 0.8, 0, 'lowpass');
        break;
      case 'horn':
        this.tone(440, 0.12, 'square', 0.09);
        this.tone(554, 0.12, 'square', 0.07);
        this.tone(440, 0.14, 'square', 0.09, 0.16);
        this.tone(554, 0.14, 'square', 0.07, 0.16);
        break;
      case 'hire':
        this.tone(660, 0.1, 'sine', 0.2, 0, 990);
        this.tone(990, 0.16, 'sine', 0.2, 0.1, 1320);
        break;
      case 'ui':
        this.tone(880, 0.05, 'sine', 0.18);
        break;
      case 'turbo':
        this.tone(220, 0.5, 'sawtooth', 0.1, 0, 1760);
        this.tone(440, 0.5, 'square', 0.05, 0.05, 1760);
        break;
      case 'reverse':
        for (let i = 0; i < 3; i++) this.tone(1040, 0.09, 'square', 0.05, i * 0.26);
        break;
      case 'brake':
        this.hiss(0.22, 0.12, 2600, 0.9);
        break;
      case 'error':
        this.tone(220, 0.12, 'square', 0.1);
        this.tone(180, 0.16, 'square', 0.1, 0.1);
        break;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Music: a light 16-step loop with bass, chords and a lead.
  // -------------------------------------------------------------------------------------------

  private startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 50);
  }

  private stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private note(freq: number, t: number, dur: number, wave: Wave, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const step = 60 / 116 / 2; // eighth notes
    const hz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
    // I–vi–IV–V in C, 8 eighths per chord.
    const roots = [48, 45, 41, 43];
    const chords = [
      [60, 64, 67],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
    ];
    const lead = [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 0, 74, 76, 0, 77, 0, 76, 72, 0, 69, 72, 0, 74, 0, 71, 74, 0, 79, 77, 74];
    while (this.nextNoteAt < ctx.currentTime + 0.2) {
      const s = this.musicStep % 32;
      const bar = Math.floor(s / 8);
      const t = this.nextNoteAt;
      if (s % 2 === 0) this.note(hz(roots[bar]!), t, step * 1.6, 'triangle', 0.5);
      if (s % 4 === 2) for (const n of chords[bar]!) this.note(hz(n), t, step * 1.2, 'square', 0.06);
      const l = lead[s]!;
      if (l && Math.floor(this.musicStep / 32) % 2 === 1) this.note(hz(l), t, step * 0.9, 'triangle', 0.22);
      if (s % 2 === 1) this.hissMusic(t);
      this.musicStep++;
      this.nextNoteAt += step;
    }
  }

  private hissMusic(t: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f).connect(g).connect(this.musicBus!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.05);
  }
}

export const Sound = new AudioEngine();
