// wanted.js — heat, stars and the SBPD response. One job: the phase
// machine (pursuit → search → cooldown → clear), police spawning and
// pursuit driving, and roadblocks at 3 stars and up.

import {
  HEAT_MAX, STAR_THRESHOLDS, HEAT_DECAY_UNSEEN, COPS_PER_STAR, COP_MAX,
} from './config.js';
import { findPath, nearestNode, collide } from './city.js';

export function createWanted() {
  return {
    heat: 0, stars: 0, phase: 'clear', lastSeen: -99, seenNow: false,
    roadblocks: [], blockT: 0, repathT: 0, leaveT: 0,
  };
}

export function starsFor(heat) {
  let s = 0;
  for (const t of STAR_THRESHOLDS) if (heat >= t) s++;
  return s;
}

export function addHeat(S, amt, why) {
  const W = S.wanted;
  const before = W.stars;
  W.heat = Math.min(HEAT_MAX, W.heat + amt);
  W.stars = starsFor(W.heat);
  if (W.stars > before) {
    S.dispatch = {
      text: `${why} — ${W.stars} STAR${W.stars > 1 ? 'S' : ''}, ALL UNITS RESPOND`,
      until: S.time + 4.2,
    };
    if (S.audio) S.audio.sirenBurst();
  } else if (why && amt >= 20) {
    S.dispatch = { text: why + ' REPORTED', until: S.time + 3 };
  }
  if (W.stars > 0 && W.phase === 'clear') W.phase = 'pursuit';
  // a freshly reported crime restarts the pursuit clock: units converge
  // first, and only once they lose the trail does the search begin
  if (amt >= 20) W.lastSeen = S.time;
}

function spawnCop(S) {
  const P = S.player;
  let best = null, bd = 1e18;
  for (const n of S.city.nodes) {
    if (n.id >= 225) continue;
    const d = Math.hypot(n.x - P.x, n.y - P.y);
    if (d > 390 && d < 580 && d < bd) { bd = d; best = n; }
  }
  if (!best) return;
  const c = {
    x: best.x, y: best.y, angle: 0, v: 0, color: '#eef0f2', roof: '#dfe5ea',
    kind: 'cop', hp: 130, dead: false, marked: false, driver: 'ai',
    path: [], pathI: 0, repath: Math.random() * 0.5, leaving: false, blockPost: false,
  };
  S.cars.push(c);
}

function copDrive(S, c, dt) {
  const P = S.player;
  const W = S.wanted;
  c.repath -= dt;
  const targetNode = nearestNode(S.city, P.x, P.y);
  if (c.repath <= 0 || c.pathI >= c.path.length) {
    c.path = findPath(S.city, nearestNode(S.city, c.x, c.y), targetNode);
    c.pathI = 0; c.repath = 0.8;
  }
  let gx = P.x, gy = P.y;
  const dP = Math.hypot(P.x - c.x, P.y - c.y);
  if (dP > 110 && c.pathI < c.path.length) {
    const n = S.city.nodes[c.path[c.pathI]];
    gx = n.x; gy = n.y;
    if (Math.hypot(gx - c.x, gy - c.y) < 20) c.pathI++;
  }
  const heading = Math.atan2(gy - c.y, gx - c.x);
  let da = heading - c.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const topSpeed = c.leaving ? 150 : 208 + W.stars * 9;
  const want = dP < 34 && !c.leaving ? 40 : topSpeed;
  c.v += (want - c.v) * Math.min(1, dt * 1.7);
  c.angle += Math.max(-3.1 * dt, Math.min(3.1 * dt, da * 2.2));
  const probe = { x: c.x + Math.cos(c.angle) * c.v * dt, y: c.y + Math.sin(c.angle) * c.v * dt };
  collide(S.city, probe, 9);
  if (Math.hypot(probe.x - c.x, probe.y - c.y) < Math.abs(c.v) * dt * 0.4) c.v *= 0.5;
  c.x = probe.x; c.y = probe.y;
}

export function updateWanted(S, dt) {
  const W = S.wanted, P = S.player;
  const cops = S.cars.filter(c => c.kind === 'cop' && !c.dead && !c.blockPost);

  // eyes on the player?
  W.seenNow = false;
  for (const c of cops) {
    if (Math.hypot(c.x - P.x, c.y - P.y) < 265) { W.seenNow = true; break; }
  }
  if (W.stars === 0 && W.heat <= 0) { W.phase = 'clear'; }
  else if (W.seenNow) { W.phase = 'pursuit'; W.lastSeen = S.time; }
  else if (W.phase === 'pursuit' && S.time - W.lastSeen > 5) W.phase = 'search';
  else if (W.phase === 'search' && S.time - W.lastSeen > 13) W.phase = 'cooldown';

  // heat decays only once the trail is cold (search / cooldown) — while
  // units are actively hunting the area, being unseen buys nothing yet
  if (!W.seenNow && W.stars > 0 && W.phase !== 'pursuit') {
    const rate = W.phase === 'cooldown' ? HEAT_DECAY_UNSEEN * 2.1 : HEAT_DECAY_UNSEEN;
    W.heat = Math.max(0, W.heat - rate * dt);
    const s = starsFor(W.heat);
    if (s < W.stars) {
      W.stars = s;
      if (s === 0) { W.phase = 'clear'; W.roadblocks = []; S.dispatch = { text: 'SUSPECT LOST — UNITS STAND DOWN', until: S.time + 3.4 }; }
    }
  }

  // force levels
  const desired = W.stars > 0 ? Math.min(COP_MAX, W.stars * COPS_PER_STAR) : 0;
  const active = cops.filter(c => !c.leaving);
  if (active.length < desired) { W.leaveT -= dt; if (W.leaveT <= 0) { spawnCop(S); W.leaveT = 0.55; } }
  if (W.stars === 0) {
    for (const c of cops) c.leaving = true;
    S.cars = S.cars.filter(c => !(c.kind === 'cop' && c.leaving && Math.hypot(c.x - P.x, c.y - P.y) > 470));
  }

  // drive the police
  for (const c of S.cars) {
    if (c.kind !== 'cop' || c.dead || c.blockPost || c.driver === 'player') continue;
    copDrive(S, c, dt);
  }

  // roadblocks at 3 stars and up, ahead of the player's line of travel
  W.blockT -= dt;
  if (W.stars >= 3 && W.phase === 'pursuit' && W.blockT <= 0 && W.roadblocks.length < 2) {
    const heading = P.car ? P.car.angle : P.aim;
    const ax = P.x + Math.cos(heading) * 300, ay = P.y + Math.sin(heading) * 300;
    const nid = nearestNode(S.city, ax, ay);
    const n = S.city.nodes[nid];
    if (Math.hypot(n.x - P.x, n.y - P.y) > 190) {
      const ang = heading + Math.PI / 2;
      W.roadblocks.push({ x: n.x, y: n.y, angle: ang, until: S.time + 26 });
      const c = {
        x: n.x + Math.cos(ang) * 12, y: n.y + Math.sin(ang) * 12, angle: ang, v: 0,
        color: '#eef0f2', roof: '#dfe5ea', kind: 'cop', hp: 130, dead: false,
        marked: false, driver: 'ai', path: [], pathI: 0, repath: 0, leaving: false, blockPost: true,
      };
      S.cars.push(c);
      S.dispatch = { text: 'ROADBLOCKS UP — BOX THAT CAR IN', until: S.time + 3.6 };
      W.blockT = 15;
    } else W.blockT = 3;
  }
  W.roadblocks = W.roadblocks.filter(rb => S.time < rb.until && W.stars >= 3);
  if (W.stars < 3) {
    for (const c of S.cars) if (c.blockPost) c.leaving = true, c.blockPost = false;
  }
}
