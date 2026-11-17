// audio.js — all sound is generated. One job: Web Audio SFX (shots,
// impacts, cash, sirens) plus a generative sunset music loop and an
// engine hum. No audio files, no network.

export function createAudio() {
  let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null;
  let muted = false, started = false, nextNote = 0, step = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      started = true;
      nextNote = ctx.currentTime + 0.1;
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slide = 0, dest = null) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.2, freq = 1200) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // Generative music: Am — F — C — G pads over a soft bass, plucked lead.
  const CHORDS = [ [110, 164.8, 261.6], [87.3, 174.6, 220], [130.8, 196, 261.6], [98, 146.8, 246.9] ];
  const PENTA = [220, 261.6, 293.7, 329.6, 392, 440];
  let pluckSeed = 7;
  function pluckRand() { pluckSeed = (pluckSeed * 16807) % 2147483647; return pluckSeed / 2147483647; }

  function scheduleStep() {
    const chord = CHORDS[Math.floor(step / 4) % 4];
    if (step % 4 === 0) {
      for (const f of chord) tone(f, 3.6, 'triangle', 0.05, 0, musicGain);
      tone(chord[0] / 2, 1.6, 'sine', 0.16, 0, musicGain);
    }
    if (step % 2 === 0) tone(chord[0], 0.5, 'sine', 0.10, 0, musicGain);
    if (pluckRand() < 0.55) {
      const f = PENTA[Math.floor(pluckRand() * PENTA.length)];
      tone(f * 2, 0.34, 'triangle', 0.045, 0, musicGain);
    }
    step++;
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted() { return muted; },
    shoot(kind, vol = 1) { noise(0.09, 0.16 * vol, kind === 2 ? 900 : 1500); tone(kind === 2 ? 160 : 220, 0.07, 'square', 0.08 * vol, -120); },
    reload() { tone(500, 0.05, 'square', 0.07); setTimeout(() => tone(700, 0.05, 'square', 0.07), 90); },
    door() { tone(140, 0.12, 'sine', 0.15, -40); },
    crash() { noise(0.28, 0.3, 300); },
    thud() { tone(70, 0.18, 'sine', 0.3, -30); },
    explosion() { noise(0.6, 0.4, 160); tone(55, 0.5, 'sine', 0.3, -20); },
    cash() { tone(880, 0.09, 'square', 0.10); setTimeout(() => tone(1318, 0.14, 'square', 0.10), 80); },
    sirenBurst() { tone(660, 0.16, 'triangle', 0.10, 220); setTimeout(() => tone(880, 0.16, 'triangle', 0.10, -220), 150); },
    busted() { tone(392, 0.3, 'triangle', 0.16); setTimeout(() => tone(311, 0.3, 'triangle', 0.16), 260); setTimeout(() => tone(262, 0.55, 'triangle', 0.16), 520); },
    engine(ratio) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 50 + ratio * 130;
      engineGain.gain.value = 0.015 + ratio * 0.05;
    },
    engineOff() { if (engineGain) engineGain.gain.value = 0; },
    update(S) {
      if (!started || muted) return;
      // siren wash when the SBPD is close and hot
      if (S.wanted && S.wanted.stars > 0 && S.wanted.seenNow && Math.random() < 0.02) this.sirenBurst();
      while (nextNote < ctx.currentTime + 0.25) { scheduleStep(); nextNote += 0.46; }
    },
  };
}
