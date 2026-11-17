// pedestrians.js — people on the sidewalks. One job: spawn the crowd,
// stroll it along the road edges, and make it flee from danger.

import { ROAD_W } from './config.js';
import { stream, range, pick } from './rng.js';
import { collide } from './city.js';

const SKIN = ['#f0c8a0', '#c98a5a', '#8a5a34', '#6e4525'];
const CLOTH = ['#c9542e', '#2e7f86', '#e8c07a', '#7a9a3a', '#8a3b5c', '#e6e2d5', '#3f6fb5', '#d9905f', '#3a3a3a', '#b5523c'];

export function seedPeds(city, count) {
  const rng = stream(9182, 'peds');
  const peds = [];
  for (let k = 0; k < count; k++) {
    const n = city.nodes[Math.floor(rng() * 225)];
    const to = pick(rng, n.next.filter(x => x < 225));
    peds.push({
      x: n.x + range(rng, -8, 8), y: n.y + range(rng, -8, 8),
      from: n.id, to, speed: range(rng, 26, 44),
      color: pick(rng, CLOTH), hp: 20, dead: false, flee: 0, hostile: false,
      fireT: 0, angle: 0,
    });
  }
  return peds;
}

export function updatePeds(S, dt) {
  const rng = Math.random;
  for (const p of S.peds) {
    if (p.dead) continue;
    if (p.hostile) continue; // hostiles are driven by combat.js
    let vx = 0, vy = 0;
    if (p.flee > 0) {
      p.flee -= dt;
      const dx = p.x - S.danger.x, dy = p.y - S.danger.y;
      const d = Math.hypot(dx, dy) || 1;
      vx = (dx / d) * 95; vy = (dy / d) * 95;
    } else {
      const t = S.city.nodes[p.to];
      // walk the sidewalk: offset to the left of travel direction
      const f = S.city.nodes[p.from];
      const hx = t.x - f.x, hy = t.y - f.y, hd = Math.hypot(hx, hy) || 1;
      const gx = t.x + (-hy / hd) * (ROAD_W / 2 + 3.5), gy = t.y + (hx / hd) * (ROAD_W / 2 + 3.5);
      const dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy);
      if (d < 6) {
        const opts = S.city.nodes[p.to].next.filter(n => n !== p.from && n < 225);
        p.from = p.to;
        p.to = opts.length ? opts[Math.floor(rng() * opts.length)] : p.from;
      } else { vx = (dx / d) * p.speed; vy = (dy / d) * p.speed; }
    }
    p.x += vx * dt; p.y += vy * dt;
    p.angle = Math.atan2(vy, vx);
    const pos = collide(S.city, p, 4.5);
    p.x = pos.x; p.y = pos.y;
  }
}

// A gunshot or crash nearby: everyone in earshot runs.
export function panic(S, x, y, radius) {
  S.danger.x = x; S.danger.y = y;
  for (const p of S.peds) {
    if (p.dead || p.hostile) continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) p.flee = Math.max(p.flee, 2.6);
  }
}
