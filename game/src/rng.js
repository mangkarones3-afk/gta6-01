// rng.js — seeded random streams. City generation and spawn choices never
// touch Math.random: every stream derives from one master seed mixed with a
// stage name, so retuning one system never reshuffles another's layout.

function mulberry32(state) {
  let a = state >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function streamFor(seed, stage) {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < stage.length; i++) {
    h ^= stage.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mulberry32(h);
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

function intRange(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

window.SBRng = { mulberry32, streamFor, pick, range, intRange };
