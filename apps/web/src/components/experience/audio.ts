'use client';
/**
 * Procedural sound design — no audio files. A soft park ambience (wind in the
 * leaves, far-away birds) plus paper / wax / pen foley for interactions.
 */

type Ctx = AudioContext;

class SoundEngine {
  ctx: Ctx | null = null;
  master: GainNode | null = null;
  ambience: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private birdTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = true;
  private started = false;
  private music: HTMLAudioElement | null = null;
  private lastHover = 0;

  ensure(): Ctx | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.25);
    if (this.music) {
      if (on) void this.music.play().catch(() => {});
      else this.music.pause();
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  private noise(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    return src;
  }

  private kind: 'park' | 'sea' | 'room' | 'sky' = 'park';
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  /** Start ambience (call from a user gesture) */
  startAmbience(opts: { wind: number; musicUrl?: string; ambience?: 'park' | 'sea' | 'room' | 'sky' }) {
    const ctx = this.ensure();
    if (!ctx || this.started) return;
    this.started = true;
    this.kind = opts.ambience ?? 'park';
    const amb = ctx.createGain();
    amb.gain.value = 0;
    amb.gain.setTargetAtTime(1, ctx.currentTime, 2.5);
    amb.connect(this.master!);
    this.ambience = amb;
    if (this.kind !== 'park') {
      this.startWorld(ctx, amb, opts.wind);
      this.startMusic(opts.musicUrl);
      return;
    }

    // wind: low rumble + leaf rustle, both slowly modulated
    const low = this.noise();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const lowGain = ctx.createGain();
    lowGain.gain.value = 0.05 + opts.wind * 0.05;
    low.connect(lp).connect(lowGain).connect(amb);
    low.start();

    const rustle = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.6;
    const hs = ctx.createBiquadFilter();
    hs.type = 'highpass';
    hs.frequency.value = 1400;
    const rustleGain = ctx.createGain();
    rustleGain.gain.value = 0.012;
    rustle.connect(bp).connect(hs).connect(rustleGain).connect(amb);
    rustle.start();

    // gust LFOs
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02 + opts.wind * 0.03;
    lfo.connect(lfoGain).connect(rustleGain.gain);
    lfo.start();
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.043;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 0.03;
    lfo2.connect(lfo2Gain).connect(lowGain.gain);
    lfo2.start();

    this.scheduleBird();
    this.startMusic(opts.musicUrl);
  }

  private startMusic(url?: string) {
    if (!url) return;
    try {
      this.music = new Audio(url);
      this.music.loop = true;
      this.music.volume = 0.35;
      this.music.crossOrigin = 'anonymous';
      if (this.enabled) void this.music.play().catch(() => {});
    } catch {
      /* noop */
    }
  }

  private every(minMs: number, maxMs: number, fn: () => void) {
    const tick = () => {
      fn();
      this.timers.push(setTimeout(tick, minMs + Math.random() * (maxMs - minMs)));
    };
    this.timers.push(setTimeout(tick, minMs * 0.5 + Math.random() * minMs));
  }

  /** looping filtered noise bed */
  private bed(amb: GainNode, type: BiquadFilterType, freq: number, q: number, gain: number, lfo?: { rate: number; depth: number }) {
    const ctx = this.ctx!;
    const src = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(amb);
    src.start();
    if (lfo) {
      const o = ctx.createOscillator();
      o.frequency.value = lfo.rate;
      const og = ctx.createGain();
      og.gain.value = lfo.depth;
      o.connect(og).connect(g.gain);
      o.start();
    }
    return { src, f, g };
  }

  private startWorld(ctx: Ctx, amb: GainNode, wind: number) {
    if (this.kind === 'sea') {
      // distant surf bed + individual waves that swell, break and wash back
      this.bed(amb, 'lowpass', 420, 0.5, 0.05, { rate: 0.06, depth: 0.02 });
      this.bed(amb, 'highpass', 5200, 0.4, 0.006);
      this.every(6500, 9500, () => this.wave());
      this.every(9000, 22000, () => this.gull());
    } else if (this.kind === 'room') {
      // quiet room tone, a clock, a curtain breathing, birds far outside
      this.bed(amb, 'lowpass', 180, 0.5, 0.03);
      this.bed(amb, 'bandpass', 1800, 0.5, 0.006, { rate: 0.05 + wind * 0.05, depth: 0.006 });
      this.every(1000, 1000, () => this.tick());
      this.every(5000, 14000, () => {
        const g = this.ambience;
        this.ambience = null;
        // birds sound further away indoors
        if (g) {
          const far = ctx.createGain();
          far.gain.value = 0.35;
          far.connect(g);
          this.ambience = far;
          this.bird();
          this.ambience = g;
        }
      });
    } else if (this.kind === 'sky') {
      // high altitude wind and slow wind chimes
      this.bed(amb, 'bandpass', 700, 0.35, 0.035, { rate: 0.04, depth: 0.02 });
      this.bed(amb, 'highpass', 3000, 0.3, 0.005, { rate: 0.07, depth: 0.004 });
      this.every(2800, 6500, () => this.windChime());
      this.every(18000, 32000, () => this.burner());
    }
  }

  private wave() {
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    const t = ctx.currentTime;
    const src = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(2200, t + 2.2);
    f.frequency.exponentialRampToValueAtTime(500, t + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 2.3);
    g.gain.exponentialRampToValueAtTime(0.002, t + 6.5);
    src.connect(f).connect(g).connect(this.ambience);
    src.start(t, Math.random());
    src.stop(t + 7);
    // the fizz of foam as it washes back
    const fizz = this.noise();
    const hf = ctx.createBiquadFilter();
    hf.type = 'highpass';
    hf.frequency.value = 4500;
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0, t + 2.2);
    fg.gain.linearRampToValueAtTime(0.018, t + 2.8);
    fg.gain.exponentialRampToValueAtTime(0.0005, t + 6);
    fizz.connect(hf).connect(fg).connect(this.ambience);
    fizz.start(t + 2.2, Math.random());
    fizz.stop(t + 6.2);
  }

  private gull() {
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    const out = ctx.createGain();
    out.gain.value = 0.012;
    pan.connect(out).connect(this.ambience);
    let t = ctx.currentTime + 0.05;
    const calls = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < calls; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 3;
      const g = ctx.createGain();
      const f0 = 1500 + Math.random() * 300;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * 1.25, t + 0.08);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 0.42);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(bp).connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.5);
      t += 0.35 + Math.random() * 0.2;
    }
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    const t = ctx.currentTime;
    const src = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3800;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02, t);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.03);
    src.connect(f).connect(g).connect(this.ambience);
    src.start(t, Math.random());
    src.stop(t + 0.05);
  }

  private windChime() {
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    const scale = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * (0.15 + Math.random() * 0.3);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = scale[Math.floor(Math.random() * scale.length)];
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = o.frequency.value * 2.76;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0003, t + 3.2);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o.connect(g);
      o2.connect(g2).connect(g);
      g.connect(this.ambience);
      o.start(t);
      o2.start(t);
      o.stop(t + 3.3);
      o2.stop(t + 3.3);
    }
  }

  private burner() {
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    const t = ctx.currentTime;
    const src = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.02, t + 0.4);
    g.gain.setValueAtTime(0.02, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.4);
    src.connect(f).connect(g).connect(this.ambience);
    src.start(t, Math.random());
    src.stop(t + 2.5);
  }

  private scheduleBird() {
    const wait = 2500 + Math.random() * 7000;
    this.birdTimer = setTimeout(() => {
      this.bird();
      this.scheduleBird();
    }, wait);
  }

  private bird() {
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const out = ctx.createGain();
    out.gain.value = 0.02 + Math.random() * 0.025;
    pan.connect(out).connect(this.ambience);
    const kind = Math.random();
    const notes = kind < 0.5 ? 2 + Math.floor(Math.random() * 4) : 1;
    let t = ctx.currentTime + 0.05;
    const base = 2600 + Math.random() * 1800;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const g = ctx.createGain();
      g.gain.value = 0;
      const dur = kind < 0.5 ? 0.07 + Math.random() * 0.05 : 0.35;
      const f0 = base * (1 + (Math.random() - 0.5) * 0.15);
      o.frequency.setValueAtTime(f0, t);
      if (kind < 0.5) o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), t + dur);
      else {
        o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + dur * 0.3);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
      }
      // vibrato for a more natural warble
      const vib = ctx.createOscillator();
      vib.frequency.value = 30 + Math.random() * 25;
      const vg = ctx.createGain();
      vg.gain.value = f0 * 0.03;
      vib.connect(vg).connect(o.frequency);
      g.gain.linearRampToValueAtTime(1, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(pan);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.05);
      vib.stop(t + dur + 0.05);
      t += dur + 0.04 + Math.random() * 0.06;
    }
  }

  /** filtered noise burst — the basis of all paper foley */
  private burst(opts: { dur: number; freq: number; q?: number; gain: number; type?: BiquadFilterType; sweepTo?: number; attack?: number; delay?: number }) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0008, t + opts.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + opts.dur + 0.05);
  }

  private tone(opts: { f: number; to?: number; dur: number; gain: number; type?: OscillatorType; delay?: number }) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.f, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + opts.dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + opts.dur + 0.05);
  }

  hover() {
    const now = performance.now();
    if (now - this.lastHover < 400 || !this.ctx) return;
    this.lastHover = now;
    this.burst({ dur: 0.18, freq: 5200, gain: 0.02, q: 1.2 });
  }
  tap() {
    this.burst({ dur: 0.09, freq: 1800, gain: 0.08, q: 1.5 });
    this.tone({ f: 180, to: 90, dur: 0.12, gain: 0.05 });
  }
  crack() {
    this.burst({ dur: 0.05, freq: 3800, gain: 0.35, q: 3 });
    this.burst({ dur: 0.12, freq: 1600, gain: 0.18, q: 2, delay: 0.03 });
    this.burst({ dur: 0.08, freq: 6000, gain: 0.08, q: 4, delay: 0.09 });
    this.tone({ f: 320, to: 120, dur: 0.1, gain: 0.08, type: 'triangle' });
  }
  flap() {
    this.burst({ dur: 0.7, freq: 900, sweepTo: 4200, gain: 0.07, q: 0.7, attack: 0.15 });
    this.burst({ dur: 0.35, freq: 5000, gain: 0.03, q: 1, delay: 0.2 });
  }
  slide() {
    this.burst({ dur: 0.9, freq: 2400, sweepTo: 1200, gain: 0.05, q: 0.5, attack: 0.25, type: 'bandpass' });
  }
  unfold() {
    this.burst({ dur: 0.45, freq: 1200, sweepTo: 3600, gain: 0.08, q: 0.6, attack: 0.05 });
    this.burst({ dur: 0.08, freq: 2400, gain: 0.08, q: 2, delay: 0.38 });
  }
  page() {
    this.burst({ dur: 0.55, freq: 700, sweepTo: 5200, gain: 0.08, q: 0.6, attack: 0.08 });
    this.burst({ dur: 0.1, freq: 3000, gain: 0.05, q: 1.5, delay: 0.42 });
  }
  pencil() {
    this.burst({ dur: 0.05, freq: 7000, gain: 0.03, q: 2 });
  }
  select() {
    this.tone({ f: 880, to: 1320, dur: 0.12, gain: 0.025, type: 'sine' });
    this.burst({ dur: 0.04, freq: 5000, gain: 0.02, q: 2 });
  }
  error() {
    this.tone({ f: 330, to: 250, dur: 0.18, gain: 0.04, type: 'triangle' });
  }
  stamp() {
    this.tone({ f: 120, to: 55, dur: 0.25, gain: 0.3 });
    this.burst({ dur: 0.08, freq: 900, gain: 0.2, q: 1 });
  }
  whoosh() {
    this.burst({ dur: 1.4, freq: 300, sweepTo: 2600, gain: 0.12, q: 0.7, attack: 0.5 });
  }
  chime() {
    [0, 0.12, 0.24].forEach((d, i) => this.tone({ f: [784, 988, 1175][i], dur: 1.4, gain: 0.035, delay: d }));
  }

  pop() {
    this.tone({ f: 620, to: 180, dur: 0.12, gain: 0.25, type: 'triangle' });
    this.burst({ dur: 0.06, freq: 2600, gain: 0.3, q: 2 });
    this.burst({ dur: 0.25, freq: 7000, gain: 0.04, q: 1, delay: 0.05 });
  }
  squeak() {
    this.tone({ f: 520, to: 780, dur: 0.18, gain: 0.03, type: 'triangle' });
  }
  splash() {
    this.burst({ dur: 1.4, freq: 900, sweepTo: 3000, gain: 0.08, q: 0.5, attack: 0.3 });
    this.burst({ dur: 0.9, freq: 6000, gain: 0.03, q: 0.5, delay: 0.4 });
  }
  clink() {
    [2400, 3150].forEach((f, i) => this.tone({ f, dur: 0.6, gain: 0.02, delay: i * 0.02 }));
  }
  ribbon() {
    this.burst({ dur: 0.5, freq: 3000, sweepTo: 5500, gain: 0.04, q: 1.4, attack: 0.1 });
  }
  release() {
    this.burst({ dur: 1.2, freq: 400, sweepTo: 1800, gain: 0.06, q: 0.6, attack: 0.3 });
    this.tone({ f: 660, to: 990, dur: 0.6, gain: 0.02 });
  }
  gust() {
    this.burst({ dur: 2.2, freq: 500, sweepTo: 1400, gain: 0.06, q: 0.4, attack: 0.8 });
  }

  stop() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.birdTimer) clearTimeout(this.birdTimer);
    this.music?.pause();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.started = false;
  }
}

export const sfx = new SoundEngine();
