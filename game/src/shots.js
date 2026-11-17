// shots.js — deterministic staged scenes for the screenshots. One job:
// when the page is opened with ?shot=<name>, arrange the live game state
// into the exact frame the shot needs (the same systems, frozen mid-beat).
// Nothing here draws or fakes anything — it only places real actors.

import { say } from './missions.js';

function poi(S, id) { return S.city.pois.find(p => p.id === id); }

function setWanted(S, heat) {
  S.wanted.heat = heat;
  S.wanted.stars = heat >= 400 ? 5 : heat >= 280 ? 4 : heat >= 180 ? 3 : heat >= 100 ? 2 : heat >= 40 ? 1 : 0;
  S.wanted.phase = S.wanted.stars > 0 ? 'pursuit' : 'clear';
  S.wanted.seenNow = S.wanted.stars > 0;
}

function copAt(S, x, y, angle) {
  const c = {
    x, y, angle, v: 0, color: '#eef0f2', roof: '#dfe5ea', kind: 'cop',
    hp: 130, dead: false, marked: false, driver: 'ai', path: [], pathI: 0,
    repath: 0, leaving: false, blockPost: false,
  };
  S.cars.push(c);
  return c;
}

function heroCar(S, x, y, angle, color) {
  const c = {
    x, y, angle, v: 0, color, roof: '#3a2a10', kind: 'parked',
    hp: 120, dead: false, marked: false, driver: 'player', stolenOnce: true,
  };
  S.cars.push(c);
  S.player.car = c;
  S.player.x = x; S.player.y = y;
  return c;
}

// Find the intersection whose surrounding blocks carry the most signage —
// the cover needs a named, lived-in corner of the city, reasonably close
// to the mission objective so its distance reads like a real errand.
function busiestCorner(S) {
  const mk = poi(S, 'mercado-central');
  let best = null, bestScore = -1;
  for (const n of S.city.nodes) {
    if (n.id >= 225) continue;
    let score = 0;
    for (const b of S.city.buildings) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (Math.abs(cx - n.x) < 165 && Math.abs(cy - n.y) < 115) {
        if (b.sign) score += b.poi ? 3 : 2;
        else score += 0.4;
      }
    }
    if (n.y > 900) score += 1.5;
    const dJob = Math.hypot(n.x - mk.x, n.y - mk.y);
    if (dJob > 700) continue; // the errand must read as an errand
    score -= dJob / 130; // closeness to the job
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

export function applyShot(S, name) {
  S.mode = 'play';
  S.frozen = true;
  S.time = 12.4;
  const P = S.player;
  P.cash = 250;

  if (name === 'cover') {
    const n = busiestCorner(S);
    heroCar(S, n.x, n.y, 0, '#ffb020');
    // box-in: one cop west facing east, one east nose-in facing west, one south
    copAt(S, n.x - 52, n.y - 4, 0);
    copAt(S, n.x + 58, n.y + 3, Math.PI);
    copAt(S, n.x + 6, n.y + 56, -Math.PI / 2);
    S.wanted.roadblocks.push({ x: n.x + 118, y: n.y, angle: Math.PI / 2, until: 1e9 });
    setWanted(S, 300); // 4 stars
    const M = S.mission;
    M.idx = 1; M.name = 'Cobro Pendiente'; M.side = false;
    const mk = poi(S, 'mercado-central');
    M.objective = { x: mk.x, y: mk.y, label: 'Go to Mercado Central' };
    say(S, 'Mara Voss', [
      'A stallholder at the Mercado owes us and sent muscle instead of money.',
      'Collect what is ours, Reno. However you need to.',
    ], 1e9);
    S.cam.x = n.x + 8; S.cam.y = n.y; S.cam.viewW = 340;
    S.camLock = { x: n.x + 8, y: n.y, viewW: 340 };
  } else if (name === 'park') {
    const pond = S.city.pond;
    P.car = null;
    P.x = pond.x - 66; P.y = pond.y + 30; P.aim = 0.4;
    let placed = 0;
    for (const p of S.peds) {
      if (placed >= 2) break;
      p.hostile = true; p.hp = 46; p.color = '#20242e'; p.dead = false;
      p.x = pond.x + 30 + placed * 26; p.y = pond.y - 12 + placed * 20;
      placed++;
    }
    let strollers = 0;
    for (const p of S.peds) {
      if (strollers >= 3 || p.hostile) continue;
      p.x = pond.x - 30 + strollers * 34; p.y = pond.y + 62 - strollers * 8;
      strollers++;
    }
    const M = S.mission;
    M.idx = 3; M.name = 'Palmera Heat'; M.side = false;
    M.objective = { x: pond.x, y: pond.y, label: 'Cross Palmera Park to the pond' };
    say(S, 'Mara Voss', ['Rivals in the park, Reno. The pond — get her there.'], 1e9);
    setWanted(S, 0);
    S.cam.x = P.x + 16; S.cam.y = P.y; S.cam.viewW = 250;
    S.camLock = { x: P.x + 16, y: P.y, viewW: 250 };
  } else if (name === 'marina') {
    const pier = S.city.pier;
    P.car = null;
    P.x = pier.x + 150; P.y = pier.y + 26; P.aim = Math.PI;
    // two locals stroll the deck so the pier reads lived-in
    let onDeck = 0;
    for (const p of S.peds) {
      if (onDeck >= 2) break;
      p.x = pier.x + 74 + onDeck * 120; p.y = pier.y + 14 + onDeck * 22;
      onDeck++;
    }
    const M = S.mission;
    M.idx = 4; M.name = 'The Paloma Run'; M.side = false;
    const mc = poi(S, 'marina-club');
    M.objective = { x: mc.x, y: mc.y, label: 'Deliver to Marina Club' };
    say(S, 'Mara Voss', ['New job, Reno — the last one. A very fast car at Hotel Paloma. Pier drop, then we are square.'], 1e9);
    setWanted(S, 0);
    S.cam.x = P.x - 6; S.cam.y = P.y; S.cam.viewW = 330;
    S.camLock = { x: P.x - 6, y: P.y, viewW: 330 };
  } else if (name === 'chase') {
    const x = 8 * 158; // the long Downtown–Mercado avenue
    heroCar(S, x, 1560, -Math.PI / 2, '#e33f2e');
    S.player.car.v = 150;
    copAt(S, x + 2, 1560 + 52, -Math.PI / 2);
    copAt(S, x - 3, 1560 + 97, -Math.PI / 2);
    setWanted(S, 226); // 3 stars
    S.dispatch = { text: 'ALL UNITS — RED COUPE NORTHBOUND, DO NOT LOSE IT', until: 1e9 };
    const M = S.mission;
    M.idx = 2; M.name = 'Hot Pickup'; M.side = false;
    M.objective = { x, y: 1560 - 400, label: 'Lose the SBPD' };
    S.cam.x = x; S.cam.y = 1560 + 6; S.cam.viewW = 330;
    S.camLock = { x, y: 1560 + 6, viewW: 330 };
  }
  S.districtName = S.districtAt(S.player.x, S.player.y);
}
