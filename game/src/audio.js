// audio.js — everything is generated Web Audio: engine, sirens,
// gunshots, impacts, pickups, UI — plus a small generative music loop
// (bass + pad + hats over a I–VI–III–VII progression in D minor) so
// the bay never sits in silence. No external files, no assets.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenOn = false;
    this.musicOn = false; this._musicTimer = null; this._bar = 0;
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startMusic();
    } catch (e) { /* audio is optional */ }
  }
  startEngine() {
    const c = this.ctx;
    this.engineOsc = c.createOscillator(); this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;
    this.engineGain = c.createGain(); this.engineGain.gain.value = 0;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
    this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
    // siren: two-tone square, gain-gated
    this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this._sirenTimer = setInterval(() => {
      if (!this.ctx || !this.sirenOn) return;
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.setValueAtTime(Math.floor(t * 2) % 2 ? 960 : 660, t);
    }, 120);
  }
  setEngine(norm, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(40 + norm * 160, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + norm * 0.06 : 0, t, 0.1);
  }
  setSiren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.2);
  }
  // --- generative music: 8 bars, bass line + warm pad + soft hats ---
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const roots = [146.83, 110.0, 174.61, 130.81]; // D2 A2 F3 C3
    const chords = [[293.66, 349.23, 440.0], [220.0, 261.63, 329.63],
      [349.23, 440.0, 523.25], [261.63, 329.63, 392.0]];
    const step = () => {
      if (!this.ctx) return;
      const bar = this._bar % 4;
      const t = this.ctx.currentTime;
      // bass: root on 1 and the off-beat
      this.tone(roots[bar], t, 0.42, 'triangle', 0.10);
      this.tone(roots[bar], t + 0.55, 0.3, 'triangle', 0.07);
      this.tone(roots[bar] * 1.5, t + 1.1, 0.3, 'triangle', 0.05);
      // pad: the chord, slow attack
      for (const f of chords[bar]) this.tone(f, t, 1.7, 'sine', 0.028);
      // hats: four soft ticks
      for (let k = 0; k < 4; k++) this.noise(t + k * 0.44, 0.03, 0.012, 6000);
      this._bar++;
    };
    step();
    this._musicTimer = setInterval(step, 1760);
  }
  tone(freq, t, dur, type, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, vol, freq) {
    const c = this.ctx;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq || 1000;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  blip(freq, dur, vol, type) {
    if (!this.ctx || this.muted) return;
    this.tone(freq, this.ctx.currentTime, dur, type || 'square', vol);
  }
  shot(weapon) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, weapon === 'shotgun' ? 0.22 : 0.09, weapon === 'shotgun' ? 0.3 : 0.18, 700);
    if (weapon === 'shotgun') this.tone(90, t, 0.18, 'sine', 0.25);
  }
  crash() { if (this.ctx && !this.muted) { this.noise(this.ctx.currentTime, 0.25, 0.3, 300); this.tone(70, this.ctx.currentTime, 0.2, 'sine', 0.3); } }
  cash() { this.blip(880, 0.09, 0.12); setTimeout(() => this.blip(1320, 0.12, 0.12), 70); }
  pickup() { this.blip(660, 0.08, 0.1); }
  sirenBlip() { this.blip(520, 0.1, 0.06); }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
}
