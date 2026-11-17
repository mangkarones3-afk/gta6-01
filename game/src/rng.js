// rng.js — seeded randomness. One job: deterministic mulberry32 streams so
// the city, traffic and staged scenes come out identical on every load.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A named stream: independent sequence derived from a base seed + label.
export function stream(seed, label) {
  let h = seed >>> 0;
  for (let i = 0; i < label.length; i++) h = (Math.imul(h, 31) + label.charCodeAt(i)) >>> 0;
  return mulberry32(h);
}

export function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function rangeInt(rng, lo, hi) { return Math.floor(range(rng, lo, hi + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
export function chance(rng, p) { return rng() < p; }
