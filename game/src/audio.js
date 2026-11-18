// audio.js — every sound is synthesized with Web Audio; there are no audio
// files. A tiny stats registry counts created/started nodes so a headless
// test can prove the graph actually runs (literal ear-verification is
// impossible in a headless browser and is never claimed).

const SBAudio = (() => {
  let ctx = null, master = null, musicGain = null, engineNodes = null, sirenNodes = null;
  const stats = { created: 0, started: 0, errors: [] };

  function note(type) { stats.created++; if (type === "start") stats.started++; }

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      note();
      return true;
    } catch (err) {
      stats.errors.push(String(err));
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === "suspended") ctx.resume();
  }

  function blip(freq, dur, type, vol, when) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
    note(); note("start");
  }

  function noiseBurst(dur, freq, vol) {
    if (!ensure()) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
    note(); note("start");
  }

  function gunshot(distant) {
    noiseBurst(distant ? 0.16 : 0.22, distant ? 900 : 1600, distant ? 0.1 : 0.3);
  }
  function thud() { blip(90, 0.12, "sine", 0.35); noiseBurst(0.06, 500, 0.12); }
  function cash() { blip(880, 0.09, "square", 0.12); blip(1318, 0.14, "square", 0.12, 0.08); }
  function missionDone() { blip(523, 0.14, "triangle", 0.2); blip(659, 0.14, "triangle", 0.2, 0.12); blip(784, 0.22, "triangle", 0.22, 0.24); }
  function sirenBurst() { blip(660, 0.16, "square", 0.06); blip(880, 0.16, "square", 0.06, 0.16); }
  function click() { blip(1200, 0.05, "square", 0.08); }

  // Ambient pad loop: a slow four-chord progression, generated.
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
  let chordIdx = 0, musicTimer = null;
  function playChord() {
    if (!ensure()) return;
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    for (const f of chord) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f / 2;
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.9);
      o.connect(g); g.connect(musicGain);
      o.start(t0); o.stop(t0 + 4);
      note(); note("start");
    }
  }
  function startMusic() {
    if (musicTimer) return;
    playChord();
    musicTimer = setInterval(playChord, 4000);
  }

  // Engine hum follows the driven car's speed; siren bed while wanted.
  function setEngine(on, speedRatio) {
    if (!ensure()) return;
    if (on && !engineNodes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = 55;
      g.gain.value = 0.05;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 320;
      o.connect(f); f.connect(g); g.connect(master);
      o.start();
      note(); note("start");
      engineNodes = { o, g, f };
    }
    if (engineNodes) {
      engineNodes.o.frequency.value = 50 + speedRatio * 130;
      engineNodes.g.gain.value = on ? 0.05 : 0.0;
      if (!on) { try { engineNodes.o.stop(); } catch (e) { /* already stopped */ } engineNodes = null; }
    }
  }
  function setSiren(on) {
    if (!ensure()) return;
    if (on && !sirenNodes) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      o.type = "square";
      o.frequency.value = 760;
      lfo.frequency.value = 0.7;
      lfoG.gain.value = 140;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      g.gain.value = 0.028;
      o.connect(g); g.connect(master);
      o.start(); lfo.start();
      note(); note("start"); note(); note("start");
      sirenNodes = { o, lfo };
    }
    if (!on && sirenNodes) {
      try { sirenNodes.o.stop(); sirenNodes.lfo.stop(); } catch (e) { /* already stopped */ }
      sirenNodes = null;
    }
  }

  function testHooks() {
    return {
      running: !!ctx && ctx.state === "running",
      state: ctx ? ctx.state : "none",
      stats: { created: stats.created, started: stats.started, errors: stats.errors.slice() },
      musicOn: !!musicTimer,
    };
  }

  return { ensure, resume, gunshot, thud, cash, missionDone, sirenBurst, click, startMusic, setEngine, setSiren, testHooks };
})();

window.SBAudio = SBAudio;

window.SBAudio = SBAudio;
