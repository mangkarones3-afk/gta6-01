// traffic.js — road traffic and parked cars. One job: keep civilian cars
// flowing along the road graph on the correct side, and seed the parked
// cars the player can steal.

import { ROAD_W, CAR_MAXV } from './config.js';
import { stream, range, pick } from './rng.js';

const CAR_COLORS = ['#c9542e', '#2e7f86', '#e8c07a', '#7a9a3a', '#8a3b5c', '#e6e2d5', '#3f6fb5', '#d9905f', '#5c7a3a', '#9a4a2e'];
const ROOF_COLORS = ['#20242e', '#e6e2d5', '#7a2e2e', '#2e4a5c', '#3a3a3a'];

export function makeCar(x, y, angle, rng, kind) {
  const color = pick(rng, CAR_COLORS);
  return {
    x, y, angle, v: 0, color, roof: pick(rng, ROOF_COLORS), kind,
    hp: 120, dead: false, marked: false, driver: null,
    from: -1, to: -1, speed: range(rng, 62, 104),
  };
}

export function seedTraffic(city, count) {
  const rng = stream(777, 'traffic');
  const cars = [];
  for (let k = 0; k < count; k++) {
    const n = city.nodes[Math.floor(rng() * (city.nodes.length - 6))]; // skip pier nodes
    const to = pick(rng, n.next);
    const t = city.nodes[to];
    const c = makeCar(n.x, n.y, Math.atan2(t.y - n.y, t.x - n.x), rng, 'traffic');
    c.from = n.id; c.to = to;
    cars.push(c);
  }
  return cars;
}

export function seedParked(city, count) {
  const rng = stream(4242, 'parked');
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 400) {
    const e = pick(rng, city.edges);
    if (e.a >= 225 || e.b >= 225) continue; // not on the pier
    const a = city.nodes[e.a], b = city.nodes[e.b];
    const t = range(rng, 0.25, 0.75);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const side = rng() < 0.5 ? 1 : -1;
    const off = (ROAD_W / 2 - 4.5) * side;
    const x = a.x + (b.x - a.x) * t + Math.cos(ang + Math.PI / 2) * off;
    const y = a.y + (b.y - a.y) * t + Math.sin(ang + Math.PI / 2) * off;
    const c = makeCar(x, y, side > 0 ? ang : ang + Math.PI, rng, 'parked');
    cars.push(c);
  }
  return cars;
}

// Drive one AI car along its current edge; at the node, choose the next.
function driveAlong(S, c, dt, speedCap) {
  const target = S.city.nodes[c.to];
  const dx = target.x - c.x, dy = target.y - c.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.min(c.speed, speedCap);
  c.v += (want - c.v) * Math.min(1, dt * 2.2);
  // right-hand lane offset relative to travel direction
  const hx = dx / (dist || 1), hy = dy / (dist || 1);
  const ox = -hy * 4.6, oy = hx * 4.6;
  const gx = target.x + ox, gy = target.y + oy;
  const gdx = gx - c.x, gdy = gy - c.y;
  const gd = Math.hypot(gdx, gdy) || 1;
  const heading = Math.atan2(gdy, gdx);
  let da = heading - c.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  c.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, da));
  c.x += Math.cos(c.angle) * c.v * dt;
  c.y += Math.sin(c.angle) * c.v * dt;
  if (dist < 16) {
    const from = c.to;
    const opts = S.city.nodes[from].next.filter(n => n !== c.from);
    c.from = from;
    c.to = opts.length ? opts[Math.floor(Math.random() * opts.length)] : c.from;
  }
}

export function updateTraffic(S, dt) {
  for (const c of S.cars) {
    if (c.kind !== 'traffic' || c.driver === 'player' || c.dead) continue;
    // slow for a car ahead
    let cap = CAR_MAXV;
    for (const o of S.cars) {
      if (o === c || o.dead) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < 26) {
        const ahead = (o.x - c.x) * Math.cos(c.angle) + (o.y - c.y) * Math.sin(c.angle);
        if (ahead > 0) cap = Math.min(cap, 26);
      }
    }
    if (S.player.car !== c) {
      const d = Math.hypot(S.player.x - c.x, S.player.y - c.y);
      if (d < 22 && !S.player.car) cap = Math.min(cap, 20);
    }
    driveAlong(S, c, dt, cap);
  }
}
