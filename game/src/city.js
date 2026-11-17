// city.js — procedural generation of Solano Bay. One job: turn the seed into
// the road graph, buildings, POIs, park and pier, and answer collision and
// routing questions about them. No rendering, no gameplay state.

import {
  ROAD_W, BLOCK, PITCH, COLS, ROWS, WORLD_W, WORLD_H, BAY_X, PIER_Y_ROW,
  PIER_LEN, CITY_SEED, DISTRICTS, PARK_BLOCKS, POIS, SHOP_SIGNS, WALLS,
} from './config.js';
import { stream, range, rangeInt, pick, chance } from './rng.js';

// Lots per block side: the commercial districts (Downtown, Mercado) are
// built fine-grained (3x3 small shopfronts — the signage the city is read
// by), the rest of the city keeps larger 2x2 lots.
function lotsPerSide(district) { return (district.id === 'downtown' || district.id === 'mercado') ? 3 : 2; }
// POI lot indices are written for the 2x2 scheme (0=NW 1=NE 2=SW 3=SE);
// translate corner lots into the 3x3 scheme.
function translateLot(lot, lps) { return lps === 2 ? lot : [0, 2, 6, 8][lot]; }

export function districtOfBlock(bx, by) {
  for (const d of DISTRICTS) if (bx >= d.bx0 && bx <= d.bx1 && by >= d.by0 && by <= d.by1) return d;
  // fall back to the nearest district rectangle centre
  let best = DISTRICTS[0], bd = 1e9;
  for (const d of DISTRICTS) {
    const cx = (d.bx0 + d.bx1) / 2, cy = (d.by0 + d.by1) / 2;
    const dist = (cx - bx) * (cx - bx) + (cy - by) * (cy - by);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

function isParkBlock(bx, by) { return PARK_BLOCKS.some(p => p.bx === bx && p.by === by); }

export function buildCity() {
  const rng = stream(CITY_SEED, 'city');

  // ---- road graph: grid intersections + a line of pier nodes ----
  const nodes = [];
  const nodeId = (i, j) => j * COLS + i;
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++)
      nodes.push({ id: nodeId(i, j), x: i * PITCH, y: j * PITCH, next: [] });
  const pierY = PIER_Y_ROW * PITCH;
  const pierNodeIds = [];
  for (let k = 1; k <= 5; k++) {
    const id = nodes.length;
    nodes.push({ id, x: BAY_X - (PIER_LEN / 5) * k + 40, y: pierY, next: [] });
    pierNodeIds.push(id);
  }
  const edges = [];
  const link = (a, b) => { edges.push({ a, b }); nodes[a].next.push(b); nodes[b].next.push(a); };
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      if (i + 1 < COLS) link(nodeId(i, j), nodeId(i + 1, j));
      if (j + 1 < ROWS) link(nodeId(i, j), nodeId(i, j + 1));
    }
  link(nodeId(0, PIER_Y_ROW), pierNodeIds[0]);
  for (let k = 0; k + 1 < pierNodeIds.length; k++) link(pierNodeIds[k], pierNodeIds[k + 1]);

  // ---- buildings: 2x2 lots per block, POIs pinned to their lots ----
  const buildings = [];
  const poiByLot = new Map();
  for (const p of POIS) {
    const d = districtOfBlock(p.bx, p.by);
    poiByLot.set(p.bx + ',' + p.by + ',' + translateLot(p.lot, lotsPerSide(d)), p);
  }
  const poiOut = [];
  for (let by = 0; by < ROWS - 1; by++) {
    for (let bx = 0; bx < COLS - 1; bx++) {
      if (isParkBlock(bx, by)) continue;
      const district = districtOfBlock(bx, by);
      const lps = lotsPerSide(district), LOT = BLOCK / lps;
      const x0 = bx * PITCH + ROAD_W / 2, y0 = by * PITCH + ROAD_W / 2;
      for (let lot = 0; lot < lps * lps; lot++) {
        const lx = x0 + (lot % lps) * LOT, ly = y0 + Math.floor(lot / lps) * LOT;
        const poi = poiByLot.get(bx + ',' + by + ',' + lot);
        if (!poi && !chance(rng, 0.66)) continue; // empty lot: parking / plaza
        const pad = poi ? 2 : range(rng, 2, 6);
        const w = LOT - pad * 2, h = LOT - pad * 2;
        const tall = district.id === 'downtown' ? rangeInt(rng, 4, 8) : rangeInt(rng, 1, 3);
        const b = {
          x: lx + pad, y: ly + pad, w, h,
          color: poi ? poi.color : pick(rng, WALLS[district.id]),
          floors: tall, district: district.id,
          sign: poi ? poi.name.toUpperCase() : (chance(rng, 0.6) ? pick(rng, SHOP_SIGNS) : null),
          poi: poi ? poi.id : null,
        };
        buildings.push(b);
        if (poi) poiOut.push({ ...poi, x: b.x + b.w / 2, y: b.y + b.h / 2, building: b });
      }
    }
  }

  // ---- Palmera Park: pond ellipse + a ring and scatter of palms ----
  const parkRect = {
    x: 10 * PITCH + ROAD_W / 2, y: 2 * PITCH + ROAD_W / 2,
    w: 2 * PITCH - ROAD_W, h: 2 * PITCH - ROAD_W,
  };
  const pond = { x: parkRect.x + parkRect.w * 0.5, y: parkRect.y + parkRect.h * 0.46, rx: 62, ry: 40 };
  const palms = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    palms.push({ x: pond.x + Math.cos(a) * (pond.rx + 22), y: pond.y + Math.sin(a) * (pond.ry + 18), s: range(rng, 0.85, 1.2) });
  }
  for (let k = 0; k < 16; k++)
    palms.push({ x: range(rng, parkRect.x + 16, parkRect.x + parkRect.w - 16), y: range(rng, parkRect.y + 16, parkRect.y + parkRect.h - 16), s: range(rng, 0.8, 1.25) });

  // ---- Marina pier: deck, moored boats, lighthouse ----
  const pier = { x: BAY_X - PIER_LEN + 40, y: pierY - 26, w: PIER_LEN, h: 52 };
  const boats = [];
  for (let k = 0; k < 12; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    boats.push({
      x: pier.x + 30 + Math.floor(k / 2) * 78 + range(rng, -6, 6),
      y: pierY + side * (52 + range(rng, 4, 16)),
      w: range(rng, 23, 33), h: 11, color: pick(rng, ['#e6e2d5', '#c9542e', '#2e7f86', '#e8c07a']),
    });
  }
  const lighthouse = { x: pier.x + 14, y: pierY, r: 15 };

  const spawn = { x: 2 * PITCH + 40, y: 12 * PITCH + 30 }; // Playa, near Hotel Paloma

  return {
    nodes, edges, buildings, pois: poiOut, parkRect, pond, palms, pier, boats, lighthouse, spawn,
    w: WORLD_W, h: WORLD_H,
  };
}

// ---- collision: circle vs building AABBs + water (pier deck is walkable) ----
export function collide(city, pos, r) {
  // water west of the bay line, unless standing on the pier deck
  const onPier = pos.x > city.pier.x - 4 && pos.x < BAY_X + 12 && Math.abs(pos.y - (city.pier.y + 26)) < 30;
  if (pos.x - r < BAY_X && !onPier) pos.x = BAY_X + r;
  if (pos.x < city.pier.x + 10 && !onPier && pos.y > city.pier.y - 60 && pos.y < city.pier.y + 112) {
    // open water beside the pier
    if (pos.x - r < BAY_X) pos.x = BAY_X + r;
  }
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nx, dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) { const d = Math.sqrt(d2); pos.x = nx + (dx / d) * r; pos.y = ny + (dy / d) * r; }
      else { // centre inside the box: push out along the smallest penetration
        const left = pos.x - b.x, right = b.x + b.w - pos.x, top = pos.y - b.y, bot = b.y + b.h - pos.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) pos.x = b.x - r; else if (m === right) pos.x = b.x + b.w + r;
        else if (m === top) pos.y = b.y - r; else pos.y = b.y + b.h + r;
      }
    }
  }
  // lighthouse base
  const lh = city.lighthouse;
  const dx = pos.x - lh.x, dy = pos.y - lh.y, rr = lh.r + r;
  const d2 = dx * dx + dy * dy;
  if (d2 < rr * rr && d2 > 0.0001) { const d = Math.sqrt(d2); pos.x = lh.x + (dx / d) * rr; pos.y = lh.y + (dy / d) * rr; }
  return pos;
}

export function insideBuilding(city, x, y) {
  for (const b of city.buildings)
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  return false;
}

// ---- routing: breadth-first shortest path over the road graph ----
export function findPath(city, fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, -1]]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of city.nodes[cur].next) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === toId) {
        const path = [toId];
        let c = toId;
        while (prev.get(c) !== -1) { c = prev.get(c); path.unshift(c); }
        return path;
      }
      queue.push(n);
    }
  }
  return [fromId];
}

export function nearestNode(city, x, y) {
  let best = 0, bd = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bd) { bd = d; best = n.id; }
  }
  return best;
}

export function districtAt(city, x, y) {
  const bx = Math.max(0, Math.min(COLS - 2, Math.floor(x / PITCH)));
  const by = Math.max(0, Math.min(ROWS - 2, Math.floor(y / PITCH)));
  if (x < BAY_X) return DISTRICTS[0];
  return districtOfBlock(bx, by);
}
