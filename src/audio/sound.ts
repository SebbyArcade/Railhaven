import type { Hear, Scene } from './scene.ts';
import type { Cue } from './cues.ts';

/**
 * Music and sound effects, all made in code with Web Audio (no sound files, so the game stays one file).
 * Effects follow what is on screen (see scene.ts) and fade out when zoomed out; the music keeps playing.
 */

export interface SoundSettings {
  music: boolean; sfx: boolean;
  /** volume steps 1-5 (3 is the normal level) */
  musicVol: number; sfxVol: number;
  /** the quick 🔇 button on the map: silences everything without changing the rest */
  muted: boolean;
}
const KEY = 'railhaven-sound';
const step = (v: unknown) => typeof v === 'number' && v >= 1 && v <= 5 ? Math.round(v) : 3;
/** How loud each volume step is, against the normal level. */
export const VOL_STEPS = [0, 0.35, 0.65, 1, 1.4, 1.85];

export function loadSettings(): SoundSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { music: s.music !== false, sfx: s.sfx !== false, musicVol: step(s.musicVol), sfxVol: step(s.sfxVol), muted: s.muted === true };
  } catch { return { music: true, sfx: true, musicVol: 3, sfxVol: 3, muted: false }; }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Chord progressions per season: [root offset from the key, minor?] for each bar. */
const SEASON_MUSIC = [
  { key: 60, bpm: 78, bars: [[0, 0], [9, 1], [5, 0], [7, 0]] },  // spring
  { key: 62, bpm: 86, bars: [[0, 0], [5, 0], [9, 1], [7, 0]] },  // summer
  { key: 57, bpm: 72, bars: [[0, 1], [8, 0], [3, 0], [10, 0]] }, // autumn
  { key: 55, bpm: 66, bars: [[0, 1], [5, 1], [8, 0], [7, 0]] },  // winter
] as const;
const PENTA_MAJ = [0, 2, 4, 7, 9], PENTA_MIN = [0, 3, 5, 7, 10];
/** Phones crackle when the sound card runs out of time, so the effects stay within a budget:
 *  only the loudest few things on screen make their sounds, and no more than this many effect sounds play at once. */
export const MAX_SOURCES = 8, MAX_VOICES = 28, MAX_CHUFFS = 2;
/** Effects are scheduled this far ahead, so their soft start is never cut off by a busy frame (a cut-off start pops). */
const LEAD = 0.06;
/** Panning faster than this (screen pixels a second), or zooming, starts no new effect sounds: things rush in and out
 *  of hearing then, and a burst of sounds starting at once while the phone is busy drawing the map pops. */
const PAN_CALM = 250;
/** overall level (the gentle level keeper adds less boost than the old hard one, so this is a bit higher) */
const LOUD = 0.95;

export class Sound {
  settings = loadSettings();
  private ac: AudioContext | null = null;
  private master!: GainNode; private musicBus!: GainNode; private sfxBus!: GainNode; private echo!: DelayNode;
  private noise!: AudioBuffer;
  private loops: Record<'sea' | 'wind' | 'rain', { g: GainNode; f: BiquadFilterNode } | null> = { sea: null, wind: null, rain: null };
  private next = new Map<string, number>();
  /** effect sounds playing right now, and the shared left-right placers (one per pan step instead of one per sound) */
  private cam: { x: number; y: number; z: number; t: number } | null = null; private calmAt = 0; private lastAt = 0;
  voices = 0; private pluckWave?: PeriodicWave; private pans = new Map<number, StereoPannerNode>();
  private wasMoving = new Map<string, boolean>();
  private whistleAt = 0; private thunderAt = 0; private birdAt = 0;
  private bar = 0; private barAt = 0; private note = 7;
  season = 0;

  /** Browsers only allow sound after a tap: call this from the first touch. */
  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      // 'playback' asks for a roomier sound buffer than the default. A fixed size (0.15 s, PR #144) made phones
      // crackle all the time: Android plays sound in its own block size, and an odd buffer size doesn't fit it.
      let ac: AudioContext; try { ac = new AC({ latencyHint: 'playback' }); } catch { ac = new AC(); }
      this.ac = ac;
      // phone speakers buzz on deep bass and crackle when sounds pile up: cut the lowest notes and keep the level safe
      // a phone speaker can't play low thumps: it rattles on them, which sounds like a pop. Two filters cut below ~220 Hz.
      const hp = ac.createBiquadFilter(), hp2 = ac.createBiquadFilter(); hp.type = hp2.type = 'highpass'; hp.frequency.value = hp2.frequency.value = 220;
      // a gentle level keeper: a fast, hard one ducks everything on each chuff, and that quick wobble crackles
      const lim = ac.createDynamicsCompressor(); lim.threshold.value = -12; lim.knee.value = 10; lim.ratio.value = 4; lim.attack.value = 0.015; lim.release.value = 0.3;
      this.master = ac.createGain(); this.master.gain.value = LOUD; this.master.connect(hp); hp.connect(hp2); hp2.connect(lim); lim.connect(ac.destination);
      this.musicBus = ac.createGain(); this.musicBus.connect(this.master);
      this.sfxBus = ac.createGain(); this.sfxBus.connect(this.master);
      // a soft echo on the music for warmth
      this.echo = ac.createDelay(1); this.echo.delayTime.value = 0.42;
      const fb = ac.createGain(); fb.gain.value = 0.28; const eg = ac.createGain(); eg.gain.value = 0.35;
      this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(eg); eg.connect(this.musicBus);
      const len = ac.sampleRate * 2, buf = this.noise = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0; // soft (pink-ish) noise
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      const X = Math.floor(ac.sampleRate * 0.25); // crossfade the last quarter second into the start: no click where the loop wraps
      for (let i = 0; i < X; i++) { const k = i / X; d[i] = d[i]! * k + d[len - X + i]! * (1 - k); }
      const out = ac.createBuffer(1, len - X, ac.sampleRate); out.getChannelData(0).set(d.subarray(0, len - X)); this.noise = out;
      this.apply();
      this.barAt = ac.currentTime + 0.3;
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
  }

  /** Turn music, effects or everything on or off (remembered on this device). */
  set(k: 'music' | 'sfx' | 'muted', on: boolean) {
    this.settings[k] = on; this.keep();
  }
  /** Volume step 1-5 for the music or the effects. */
  volume(k: 'musicVol' | 'sfxVol', v: number) {
    this.settings[k] = step(v); if (k === 'musicVol') this.settings.music = true; else this.settings.sfx = true; this.settings.muted = false; this.keep();
  }
  private keep() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* storage full: still applies now */ } this.apply(); }
  private apply() {
    if (!this.ac) return; const t = this.ac.currentTime, S = this.settings;
    this.musicBus.gain.setTargetAtTime(S.music ? 0.16 * VOL_STEPS[S.musicVol]! : 0, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(S.sfx ? 0.8 * VOL_STEPS[S.sfxVol]! : 0, t, 0.2);
    this.master.gain.setTargetAtTime(S.muted ? 0 : LOUD, t, 0.08);
  }

  /** Stop all sound while the game is paused or hidden. */
  pause(paused: boolean) {
    if (!this.ac) return;
    if (paused && this.ac.state === 'running') { const ac = this.ac; this.master.gain.setTargetAtTime(0, ac.currentTime, 0.03); setTimeout(() => { if (this.ac?.state === 'running') void ac.suspend(); }, 150); }
    else if (!paused && this.ac.state === 'suspended') { void this.ac.resume(); this.master.gain.setTargetAtTime(this.settings.muted ? 0 : LOUD, this.ac.currentTime + 0.05, 0.1); this.barAt = Math.max(this.barAt, this.ac.currentTime + 0.2); }
  }

  /** Call every frame with what is audible now. */
  update(sc: Scene) {
    const ac = this.ac; if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (this.settings.muted) { this.barAt = now + 0.3; return; } // nothing to hear: make nothing
    if (this.settings.music) this.music(now); else this.barAt = now + 0.3;
    this.ambience(sc, now);
    if (!this.settings.sfx) return;
    // the game just stalled (it was busy laying rails, say): don't fire every overdue sound at once to catch up
    if (this.lastAt && now - this.lastAt > 0.3) this.calmAt = Math.max(this.calmAt, now + 0.3);
    this.lastAt = now;
    const c = sc.cam, was = this.cam;
    if (c) {
      if (was && now > was.t) { // how fast the view moves, in screen pixels a second
        const dt = now - was.t, speed = Math.hypot(c.x - was.x, c.y - was.y) * c.z / dt, zoom = Math.abs(Math.log(c.z / was.z)) / dt;
        if (speed > PAN_CALM || zoom > 0.3) this.calmAt = now + 0.3; // and a moment after it settles
      }
      this.cam = { ...c, t: now };
    }
    const busy = now < this.calmAt, seen = new Set<string>(), loud = [...sc.sources].sort((a, b) => b.vol - a.vol);
    let chuffs = 0; // many trains chuffing out of step blur into a steady crackle: only the nearest few are heard
    loud.forEach((h, i) => { seen.add(h.id); const train = h.kind === 'train' && !!h.rate; if (train) chuffs++; this.source(h, now + LEAD, !busy && i < MAX_SOURCES && (!train || chuffs <= MAX_CHUFFS)); }); // the rest keep their clocks, quietly
    for (const id of [...this.next.keys()]) if (!seen.has(id)) { this.next.delete(id); this.wasMoving.delete(id); }
  }

  // ---------- music ----------
  private music(now: number) {
    while (this.barAt < now + 0.5) {
      const M = SEASON_MUSIC[this.season]!, beat = 60 / M.bpm, t0 = this.barAt, [off, minor] = M.bars[this.bar % 4]!;
      const root = M.key + off, third = minor ? 3 : 4;
      for (const iv of [0, third, 7, 12]) this.pad(midi(root - 12 + iv), t0, beat * 4);
      this.tone(midi(root - 12), t0, beat * 1.8, 0.12, 'triangle'); this.tone(midi(root - 12 + 7), t0 + beat * 2, beat * 1.8, 0.08, 'triangle');
      const scale = this.season >= 2 ? PENTA_MIN : PENTA_MAJ; void minor;
      for (let b = 0; b < 8; b++) { // a wandering little tune on the half beats
        if (Math.random() > (b % 2 ? 0.28 : 0.6)) continue;
        this.note = Math.max(0, Math.min(11, this.note + Math.round(rnd(-2.4, 2.4))));
        const m = M.key + scale[this.note % 5]! + 12 * Math.floor(this.note / 5);
        this.pluck(midi(m), t0 + b * beat / 2, 0.11);
      }
      this.bar++; this.barAt += beat * 4;
    }
  }
  private pad(f: number, t: number, dur: number) {
    const ac = this.ac!, g = this.env(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.9); g.gain.setTargetAtTime(0, t + dur - 0.4, 0.5);
    for (const det of [-6, 6]) { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 1.2); } // faded to ~4% by then: fewer notes ringing on
    lp.connect(g); g.connect(this.musicBus);
  }
  private tone(f: number, t: number, dur: number, vol: number, type: OscillatorType) {
    const ac = this.ac!, o = ac.createOscillator(), g = this.env(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.3);
    o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 1);
  }
  private pluck(f: number, t: number, vol: number) {
    const ac = this.ac!, g = this.env();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.4);
    // one oscillator with the three overtones built in (was three oscillators: same sound, a third of the work)
    const o = ac.createOscillator(); o.setPeriodicWave(this.pluckWave ??= ac.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.25, 0.08]), { disableNormalization: true }));
    o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 1.5);
    g.connect(this.musicBus); g.connect(this.echo);
  }

  // ---------- ambience: sea, wind, rain, birds, thunder ----------
  private loop(k: 'sea' | 'wind' | 'rain', type: BiquadFilterType, freq: number) {
    const ac = this.ac!, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = this.env();
    src.buffer = this.noise; src.loop = true; src.playbackRate.value = k === 'rain' ? 1.3 : 0.7;
    f.type = type; f.frequency.value = freq; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.sfxBus); src.start();
    return this.loops[k] = { g, f };
  }
  private ambience(sc: Scene, now: number) {
    const sea = this.loops.sea ?? this.loop('sea', 'lowpass', 500), wind = this.loops.wind ?? this.loop('wind', 'bandpass', 700), rain = this.loops.rain ?? this.loop('rain', 'highpass', 1800);
    const swell = 0.6 + 0.4 * Math.sin(now * 0.7) * Math.sin(now * 0.23);
    sea.g.gain.setTargetAtTime(sc.sea * 0.35 * swell, now, 0.3);
    const windy = (this.season === 3 ? 0.5 : 0.12) * Math.max(sc.hills + sc.grass * 0.4, sc.near * 0.3) + sc.storm * 0.4;
    wind.g.gain.setTargetAtTime(windy * (0.6 + 0.4 * Math.sin(now * 0.31)), now, 0.5); wind.f.frequency.setTargetAtTime(500 + 300 * Math.sin(now * 0.17), now, 0.5);
    rain.g.gain.setTargetAtTime(sc.storm * 0.3, now, 0.6);
    if (!this.settings.sfx) return;
    if (sc.storm > 0.25 && now > this.thunderAt) { this.thunderAt = now + rnd(9, 20); this.thunder(sc.storm, now + 0.05); }
    const leafy = (sc.forest + sc.grass * 0.5) * (this.season === 3 ? 0 : this.season === 2 ? 0.4 : 1) * (1 - sc.storm);
    if (leafy > 0.08 && now > this.birdAt) { this.birdAt = now + rnd(1.5, 5) / leafy; this.bird(rnd(-0.6, 0.6), Math.min(0.5, leafy), now + LEAD); }
  }

  // ---------- effects ----------
  private out(pan: number) {
    const k = Math.round(Math.max(-1, Math.min(1, pan)) * 5);
    let p = this.pans.get(k); if (!p) { p = this.ac!.createStereoPanner(); p.pan.value = k / 5; p.connect(this.sfxBus); this.pans.set(k, p); }
    return p;
  }
  /** A volume control that starts silent: one left at full volume until its fade-in begins lets a click through. */
  private env() { const g = this.ac!.createGain(); g.gain.value = 0; return g; }
  /** Count a sound while it plays; false when too many already play (it is skipped, which nobody hears in a crowd). */
  private voice(n: AudioScheduledSourceNode, must = false) {
    if (!must && this.voices >= MAX_VOICES) return false;
    this.voices++; n.addEventListener('ended', () => this.voices--); return true;
  }
  private burst(t: number, dur: number, vol: number, pan: number, type: BiquadFilterType, freq: number, q = 1) {
    if (this.voices >= MAX_VOICES) return;
    const ac = this.ac!, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = this.env(); this.voice(s);
    s.buffer = this.noise; s.loop = true; s.playbackRate.value = rnd(0.8, 1.2); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const a = Math.min(0.02, dur * 0.3); // a short fade in: an instant jump to full volume pops
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    s.connect(f); f.connect(g); g.connect(this.out(pan)); s.start(t, rnd(0, 1.5)); s.stop(t + dur + 0.08);
  }
  private ping(t: number, f: number, dur: number, vol: number, pan: number, type: OscillatorType = 'sine', bend = 1) {
    if (this.voices >= MAX_VOICES) return;
    const ac = this.ac!, o = ac.createOscillator(), g = this.env(); o.type = type; this.voice(o);
    o.frequency.setValueAtTime(f, t); if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + dur);
    const a = Math.min(0.03, Math.max(0.01, 3 / f), dur * 0.4); // low notes fade in over a few waves: a sudden low note thumps
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o.connect(g); g.connect(this.out(pan)); o.start(t); o.stop(t + dur + 0.08);
  }
  private whistle(t: number, vol: number, pan: number) {
    const ac = this.ac!, g = this.env(), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + 0.55); g.gain.linearRampToValueAtTime(0, t + 0.9);
    for (const fr of [740, 880, 1110]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.frequency.linearRampToValueAtTime(fr * 0.985, t + 0.9); o.connect(f); o.start(t); o.stop(t + 1); }
    f.connect(g); g.connect(this.out(pan));
  }
  private horn(t: number, vol: number, pan: number) {
    const ac = this.ac!, g = this.env(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.15); g.gain.setValueAtTime(vol, t + 1.3); g.gain.linearRampToValueAtTime(0, t + 1.8);
    for (const fr of [196, 294]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(lp); o.start(t); o.stop(t + 1.9); }
    lp.connect(g); g.connect(this.out(pan));
  }
  private bird(pan: number, vol: number, t: number) {
    const base = rnd(2600, 4200), n = Math.floor(rnd(2, 5));
    for (let i = 0; i < n; i++) this.ping(t + i * rnd(0.09, 0.16), base * rnd(0.9, 1.1), 0.08, 0.05 * vol, pan, 'sine', rnd(1.2, 1.5));
  }
  private gull(t: number, vol: number, pan: number) {
    for (let i = 0; i < 3; i++) this.ping(t + i * 0.22, 1500, 0.2, 0.05 * vol, pan, 'triangle', 0.6);
  }
  private thunder(vol: number, t: number) {
    this.burst(t, 0.25, 0.5 * vol, rnd(-0.5, 0.5), 'lowpass', 1500);
    this.burst(t + 0.1, 2.8, 0.45 * vol, rnd(-0.3, 0.3), 'lowpass', 420);
  }
  private baa(t: number, vol: number, pan: number) {
    const ac = this.ac!, o = ac.createOscillator(), g = this.env(), f = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = rnd(330, 420); lfo.frequency.value = 7; lg.gain.value = 12; lfo.connect(lg); lg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * vol, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.6);
    o.connect(f); f.connect(g); g.connect(this.out(pan)); o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
  }
  private saw(t: number, vol: number, pan: number) {
    const ac = this.ac!, o = ac.createOscillator(), g = this.env(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(180, t + 0.3); o.frequency.linearRampToValueAtTime(150, t + 1.4);
    f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 1.5;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * vol, t + 0.2); g.gain.setValueAtTime(0.05 * vol, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 1.5);
    o.connect(f); f.connect(g); g.connect(this.out(pan)); o.start(t); o.stop(t + 1.6);
  }

  /** A hammer blow on timber: a knock with a woody body (no hard edge: it fades in over a few ms like every effect). */
  private hammer(t: number, vol: number, pan: number) {
    this.ping(t, rnd(780, 980), 0.07, 0.09 * vol, pan, 'triangle', 0.92);
    this.burst(t, 0.06, 0.2 * vol, pan, 'bandpass', 1100, 1.1); // the thud into the wood
  }
  /** One stroke of a hand saw: a rasp that swells and fades, push a little higher than pull. */
  private rasp(t: number, dur: number, vol: number, pan: number, freq: number) {
    if (this.voices >= MAX_VOICES) return;
    const ac = this.ac!, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = this.env(); this.voice(s);
    s.buffer = this.noise; s.loop = true; s.playbackRate.value = rnd(0.9, 1.1); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.45); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out(pan)); s.start(t, rnd(0, 1.5)); s.stop(t + dur + 0.05);
  }
  /** A small chainsaw cutting a beam: it idles, revs up into the wood, bites, and drops back. */
  private chainsaw(t: number, dur: number, vol: number, pan: number) {
    if (this.voices + 3 > MAX_VOICES) return;
    const ac = this.ac!, g = this.env(), bp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.9; lp.type = 'lowpass'; lp.frequency.value = 3200;
    // the two-stroke putter: the motor's level wobbles quickly
    lfo.frequency.setValueAtTime(22, t); lfo.frequency.linearRampToValueAtTime(38, t + 0.35); lfo.frequency.setValueAtTime(38, t + dur - 0.3); lfo.frequency.linearRampToValueAtTime(24, t + dur);
    const am = ac.createGain(); am.gain.value = 0.7; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(am.gain); // inside the envelope, so it is silent once that fades
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7 * vol, t + 0.12); g.gain.linearRampToValueAtTime(vol, t + 0.4);
    g.gain.setValueAtTime(vol, t + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const [base, det] of [[96, 0], [97.5, 1]] as const) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; this.voice(o, true);
      o.frequency.setValueAtTime(base * 0.8, t); o.frequency.exponentialRampToValueAtTime(base * 1.6 + det, t + 0.35); // rev up
      o.frequency.setValueAtTime(base * 1.6, t + 0.5); o.frequency.linearRampToValueAtTime(base * 1.35, t + dur * 0.7); // bogs down in the wood
      o.frequency.linearRampToValueAtTime(base * 0.85, t + dur);
      o.connect(bp); o.start(t); o.stop(t + dur + 0.05);
    }
    // sawdust hiss while it cuts
    const s = ac.createBufferSource(), hf = ac.createBiquadFilter(), hg = this.env(); this.voice(s, true);
    s.buffer = this.noise; s.loop = true; hf.type = 'highpass'; hf.frequency.value = 3500;
    hg.gain.setValueAtTime(0, t + 0.3); hg.gain.linearRampToValueAtTime(0.35 * vol, t + 0.5); hg.gain.setValueAtTime(0.35 * vol, t + dur - 0.35); hg.gain.linearRampToValueAtTime(0, t + dur - 0.1);
    s.connect(hf); hf.connect(hg); hg.connect(this.out(pan)); s.start(t, rnd(0, 1.5)); s.stop(t + dur + 0.05);
    lfo.start(t); lfo.stop(t + dur + 0.05);
    bp.connect(lp); lp.connect(am); am.connect(g); g.connect(this.out(pan));
  }
  /** Builders at work: hammering in bursts, a hand saw, now and then the chainsaw or the crane's ratchet and a clank.
   *  `p` is how far the building is (0-1): the last moment brings the final blows. Returns the time to the next sound. */
  private builders(now: number, v: number, pan: number, p: number) {
    const r = Math.random(), side = () => pan + rnd(-0.15, 0.15);
    if (p > 0.86) { for (let i = 0; i < 2; i++) this.hammer(now + i * 0.22, v, side()); return 2; } // the last nails
    if (r < 0.42) { // a run of hammer blows, a second hammer joining in
      const k = Math.floor(rnd(3, 6)), gap = rnd(0.17, 0.24), s1 = side();
      for (let i = 0; i < k; i++) this.hammer(now + i * gap, v * rnd(0.8, 1), s1);
      if (Math.random() < 0.5) { const s2 = side(); for (let i = 0; i < 3; i++) this.hammer(now + 0.1 + i * gap * 1.3, v * 0.6, s2); }
      return k * gap + rnd(0.15, 0.4);
    }
    if (r < 0.64) { // a hand saw: four or five strokes
      const k = Math.floor(rnd(4, 6)), s1 = side(), f = rnd(2600, 3400);
      for (let i = 0; i < k; i++) this.rasp(now + i * 0.26, 0.24, 0.11 * v, s1, i % 2 ? f * 0.85 : f);
      return k * 0.26 + rnd(0.1, 0.3);
    }
    if (r < 0.86) { const d = rnd(1.1, 1.7); this.chainsaw(now, d, 0.07 * v, side()); return d + rnd(0.1, 0.4); }
    // the crane: its ratchet winding a load up, then the load set down with a clank
    for (let i = 0; i < 6; i++) this.burst(now + i * 0.07, 0.03, 0.09 * v, pan, 'bandpass', 2000 + i * 80, 3);
    this.ping(now + 0.6, rnd(420, 520), 0.35, 0.07 * v, pan, 'triangle', 0.97); this.burst(now + 0.6, 0.12, 0.12 * v, pan, 'lowpass', 900);
    return rnd(1, 1.4);
  }

  /** One-off sounds for things that just happened (see cues.ts). */
  cue(list: Cue[]) {
    const ac = this.ac; if (!ac || ac.state !== 'running' || !this.settings.sfx || this.settings.muted || !list.length) return;
    const t = ac.currentTime + LEAD, done = new Set<string>();
    for (const c of list) {
      if (done.has(c.kind)) continue; done.add(c.kind); // ten rails laid at once still clank once
      const v = c.vol, p = c.pan;
      switch (c.kind) {
        case 'build': // three hammer blows and the thump of a beam settling
          for (let i = 0; i < 3; i++) { this.ping(t + i * 0.2, rnd(850, 1000), 0.08, 0.1 * v, p, 'triangle'); this.burst(t + i * 0.2, 0.05, 0.18 * v, p, 'bandpass', 1600, 1.5); }
          this.burst(t + 0.68, 0.3, 0.25 * v, p, 'lowpass', 500); break;
        case 'upgrade': // a ratchet winding up, then a bright ding
          for (let i = 0; i < 5; i++) this.burst(t + i * 0.06, 0.03, 0.12 * v, p, 'bandpass', 2400 + i * 200, 3);
          this.ping(t + 0.35, 1568, 0.9, 0.08 * v, p); this.ping(t + 0.35, 2349, 0.6, 0.03 * v, p); break;
        case 'built': // the builders finish: a last blow and a bright two-note ding
          this.hammer(t, v, p); this.ping(t + 0.25, 1319, 0.8, 0.07 * v, p); this.ping(t + 0.37, 1976, 0.9, 0.06 * v, p); break;
        case 'remove': this.burst(t, 0.7, 0.22, 0, 'lowpass', 700); this.burst(t + 0.05, 0.3, 0.1, 0, 'bandpass', 1800); break;
        case 'rails': // a rail dropped onto sleepers, and a spike driven home
          this.ping(t, 1250, 0.35, 0.07 * v, p, 'triangle'); this.ping(t, 1870, 0.25, 0.03 * v, p); this.burst(t, 0.06, 0.16 * v, p, 'bandpass', 1300, 1.2);
          this.ping(t + 0.22, 1050, 0.25, 0.05 * v, p, 'triangle'); this.burst(t + 0.22, 0.05, 0.12 * v, p, 'bandpass', 1100, 1.2); break;
        case 'unrails': this.ping(t, 700, 0.3, 0.06, 0, 'triangle', 0.85); this.burst(t, 0.2, 0.12, 0, 'lowpass', 900); break;
        case 'train': this.whistle(t, 0.13, 0); break;
        case 'ship': this.horn(t, 0.16, 0); break;
        case 'order': this.chime([0, 4, 7], t, 0.09); break;
        case 'grow': this.chime([0, 4, 7, 12, 16], t, 0.1); break;
        case 'level': this.chime([0, 4, 7, 12], t, 0.1); this.chime([5, 9, 12, 17], t + 0.55, 0.1); this.chime([7, 11, 14, 19], t + 1.1, 0.12); break;
        case 'break': this.burst(t, 0.1, 0.18 * v, p, 'bandpass', 1800, 0.7); this.burst(t + 0.03, 0.9, 0.25 * v, p, 'lowpass', 450); break;
        case 'fire': { // a whoomph as it catches
          const ac2 = this.ac!, s2 = ac2.createBufferSource(), f = ac2.createBiquadFilter(), g = this.env();
          s2.buffer = this.noise; s2.loop = true; f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.6);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * v, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9); g.gain.linearRampToValueAtTime(0, t + 0.92);
          s2.connect(f); f.connect(g); g.connect(this.out(p)); s2.start(t); s2.stop(t + 1); break;
        }
      }
    }
  }
  /** A little bell arpeggio in the key of the season's music (steps in semitones above its root). */
  private chime(steps: number[], t: number, vol: number) {
    const key = SEASON_MUSIC[this.season]!.key + 12;
    steps.forEach((st, i) => { const f = midi(key + st); this.ping(t + i * 0.09, f, 1.1, vol, (i / Math.max(1, steps.length - 1) - 0.5) * 0.4); this.ping(t + i * 0.09, f * 2, 0.5, vol * 0.25, 0); });
  }

  /** Each sound source plays little events on its own clock. */
  private source(h: Hear, now: number, heard = true) {
    const at = this.next.get(h.id);
    // a train setting off whistles (not too often)
    const was = this.wasMoving.get(h.id); this.wasMoving.set(h.id, !!h.moving);
    if (h.kind === 'train' && h.moving && was === false && heard && now > this.whistleAt && h.vol > 0.15) { this.whistleAt = now + 8; this.whistle(now + 0.05, 0.12 * h.vol, h.pan); }
    if (at === undefined) { this.next.set(h.id, now + rnd(0, 1.5)); return; }
    if (now < at) return;
    if (!heard) { this.next.set(h.id, now + rnd(0.3, 1)); return; }
    const v = h.vol, p = h.pan; let gap = 2;
    switch (h.kind) {
      case 'train': {
        // standing: a soft breath of steam now and then (a narrower, lower band than before: a high hiss sounds like static)
        if (!h.rate) { if (Math.random() < 0.08) this.burst(now, 1, 0.03 * v, p, 'bandpass', 1800, 1.2); gap = rnd(1.5, 3); break; }
        this.burst(now, 0.16, 0.16 * v, p, 'bandpass', 600, 1.4); // chuff: a soft, round puff (was a wide 900 Hz band, crackly)
        gap = 0.62 - 0.46 * h.rate;
        break;
      }
      case 'fire':
        for (let i = 0; i < 4; i++) this.burst(now + rnd(0, 0.3), rnd(0.02, 0.06), rnd(0.15, 0.35) * v, p + rnd(-0.1, 0.1), 'highpass', rnd(1500, 4000)); // crackle
        this.burst(now, 0.5, 0.1 * v, p, 'lowpass', 600); // the roar
        if (h.moving) this.burst(now, 0.45, 0.1 * v, p, 'bandpass', 5000, 0.5); // water from the hoses
        gap = rnd(0.3, 0.5); break;
      case 'load': this.burst(now, 0.22, 0.14 * v, p, 'bandpass', 900, 0.8); this.ping(now, 330, 0.14, 0.05 * v, p); gap = rnd(0.6, 1.4); break;
      case 'repair': this.ping(now, 1900, 0.12, 0.09 * v, p, 'triangle'); this.ping(now + 0.01, 2850, 0.18, 0.05 * v, p); this.burst(now, 0.05, 0.12 * v, p, 'highpass', 3000); gap = Math.random() < 0.3 ? 1.4 : rnd(0.32, 0.5); break;
      case 'ship':
        if (h.moving && Math.random() < 0.25) this.horn(now, 0.14 * v, p); else this.gull(now, v, p);
        gap = rnd(8, 16); break;
      case 'dock': if (Math.random() < 0.3) this.ping(now, 1320, 1.6, 0.05 * v, p, 'sine'); else this.gull(now, v, p); gap = rnd(5, 11); break;
      case 'town': for (let i = 0; i < 3; i++) this.ping(now + i * 0.9, 660, 2.5, 0.05 * v, p, 'sine'); gap = rnd(40, 80); break;
      case 'wood': this.burst(now, 0.08, 0.35 * v, p, 'bandpass', 700, 2); this.ping(now, 220, 0.1, 0.1 * v, p); gap = Math.random() < 0.25 ? rnd(2.5, 4) : rnd(0.8, 1.2); break;
      case 'sawmill': this.saw(now, v, p); gap = rnd(3.5, 6); break;
      case 'build': gap = this.builders(now, v, p, h.rate ?? 0); break;
      case 'stone': case 'coal': case 'iron':
        this.ping(now, rnd(2200, 2900), 0.09, 0.07 * v, p, 'triangle'); this.burst(now, 0.06, 0.12 * v, p, 'highpass', 2500);
        if (Math.random() < 0.12) this.burst(now + 0.1, 0.6, 0.15 * v, p, 'lowpass', 800); // rocks tumbling into a cart
        gap = rnd(0.7, 1.6); break;
      case 'oil': this.ping(now, 200, 0.25, 0.07 * v, p); this.burst(now + 0.8, 0.25, 0.08 * v, p, 'bandpass', 500); gap = 1.6; break;
      case 'farm': this.burst(now, 0.5, 0.08 * v, p, 'bandpass', 3000, 0.7); gap = rnd(2.5, 5); break; // scythe swish
      case 'wool': this.baa(now, v, p); gap = rnd(6, 14); break;
      case 'gristmill': this.ping(now, 240, 0.5, 0.05 * v, p, 'triangle', 0.8); gap = rnd(2.4, 3.2); break; // creaking wheel
      default: // works: a clank and a breath of steam
        this.ping(now, rnd(320, 480), 0.12, 0.06 * v, p, 'triangle'); this.burst(now + 0.15, 0.5, 0.1 * v, p, 'highpass', 4000);
        gap = rnd(1.8, 3.4);
    }
    this.next.set(h.id, now + gap);
  }
}
