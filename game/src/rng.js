// rng.js — seeded randomness only. No Math.random anywhere in the
// game logic; every stream derives from the master seed so a staged
// screenshot and a replayed save rebuild the same city, every time.
export function mulberry32(state) {
  let a = state >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// One named stream per system: 'city', 'traffic', 'wanted', ... —
// streams never interleave, so adding a prop cannot reshuffle traffic.
export function streamFor(seed, stage) {
  let h = (0x811C9DC5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < stage.length; i++) { h ^= stage.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return mulberry32(h);
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
export function range(rng, a, b) { return a + rng() * (b - a); }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Axis-separated building slide, shared by the player, enemies and
// foot cops: try x alone, then z alone, so movers hug walls instead
// of walking through them. Returns the resolved position.
export function slideMove(city, buildingAt, x, z, nx, nz, pad) {
  if (!buildingAt(city, nx, z, pad)) x = nx;
  if (!buildingAt(city, x, nz, pad)) z = nz;
  return { x, z };
}
