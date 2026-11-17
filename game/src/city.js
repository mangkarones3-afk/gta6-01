// city.js — Solano Bay as one plain-data object (CityData contract).
// Roads first, districts before streets, blocks from the grid,
// buildings and props by rule. Traffic, police, the minimap and the
// missions all read this same object — nothing keeps a private map.
import { SEED, WORLD, ROAD_PITCH, DISTRICTS, LANDMARKS, POIS } from './config.js';
import { streamFor, pick, range, clamp } from './rng.js';

export function districtAt(x, z) {
  if (x < WORLD.waterX + 140) return 'marina';
  if (z > 420 && x > 220) return 'harbor';
  if (z < -360 && x > -520 && x < 260) return 'oldtown';
  if (x > 430) return 'hillside';
  if (Math.abs(x) < 260 && Math.abs(z) < 260) return 'downtown';
  return 'midtown';
}
export function districtDef(id) { return DISTRICTS.find(d => d.id === id) || DISTRICTS[5]; }

export function generateCity() {
  const rngRoads = streamFor(SEED, 'roads');
  const rngBuild = streamFor(SEED, 'buildings');
  const rngProps = streamFor(SEED, 'props');
  const half = WORLD.half;

  // --- road lines (perturbed grid, one jitter per line) ---
  const xs = [], zs = [];
  for (let x = -700; x <= 700; x += ROAD_PITCH) xs.push(x + range(rngRoads, -8, 8));
  for (let z = -700; z <= 700; z += ROAD_PITCH) zs.push(z + range(rngRoads, -8, 8));

  const nodes = [], nodeByKey = new Map();
  function nodeAt(x, z) {
    const k = Math.round(x) + ',' + Math.round(z);
    if (nodeByKey.has(k)) return nodeByKey.get(k);
    const id = nodes.length;
    const n = { id, x, z, edges: [], signalised: false, deadEnd: false };
    nodes.push(n); nodeByKey.set(k, id); return id;
  }
  const edges = [];
  function addEdge(ax, az, bx, bz, cls) {
    const a = nodeAt(ax, az), b = nodeAt(bx, bz);
    if (a === b) return;
    const id = edges.length;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const lanes = cls === 'ring' ? 3 : cls === 'arterial' ? 2 : 1;
    const halfW = cls === 'ring' ? 10.5 : cls === 'arterial' ? 7.2 : cls === 'collector' ? 5 : 3.8;
    const e = { id, a, b, pts: [[ax, az], [bx, bz]], cls, lanesF: lanes, lanesB: lanes,
      halfW, parking: cls !== 'ring', drivable: true, district: districtAt((ax + bx) / 2, (az + bz) / 2),
      len, speed: cls === 'ring' ? 27 : cls === 'arterial' ? 17 : cls === 'collector' ? 13 : 10 };
    edges.push(e); nodes[a].edges.push(id); nodes[b].edges.push(id);
    return e;
  }
  // verticals + horizontals (skip segments over the bay, x < waterX)
  for (const x of xs) {
    for (let i = 0; i < zs.length - 1; i++) {
      if (x < WORLD.waterX + 20) continue;
      addEdge(x, zs[i], x, zs[i + 1], Math.abs(x) < 300 ? 'arterial' : 'collector');
    }
  }
  for (const z of zs) {
    for (let i = 0; i < xs.length - 1; i++) {
      if (xs[i] < WORLD.waterX + 20 && xs[i + 1] < WORLD.waterX + 20) continue;
      addEdge(xs[i], z, xs[i + 1], z, Math.abs(z) < 300 ? 'arterial' : 'collector');
    }
  }
  // ring road (outer rectangle) + beachfront boulevard along the water
  const R = 700;
  addEdge(-R, -R, R, -R, 'ring'); addEdge(R, -R, R, R, 'ring');
  addEdge(R, R, -R, R, 'ring'); addEdge(-R, R, -R, -R, 'ring');
  addEdge(WORLD.waterX + 20, -R, WORLD.waterX + 20, R, 'arterial');
  // one-way pairs downtown: two parallel locals, mirrored directions
  for (const e of edges) {
    if (e.district === 'downtown' && e.cls === 'collector' && Math.abs(e.pts[0][0] - e.pts[1][0]) < 1) {
      if (Math.round(e.pts[0][0]) % 200 < 100) { e.lanesB = 0; e.lanesF = 2; }
    }
  }
  for (const n of nodes) {
    n.signalised = n.edges.some(id => edges[id].cls === 'arterial') &&
      n.edges.filter(id => edges[id].cls === 'arterial').length >= 2;
  }

  // --- blocks (grid cells between streets), parcels, buildings ---
  const blocks = [], buildings = [], props = [];
  let bid = 0, palmeraPlaced = false;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i] + 11, x1 = xs[i + 1] - 11, z0 = zs[j] + 11, z1 = zs[j + 1] - 11;
      if (x1 - x0 < 24 || z1 - z0 < 24) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (cx < WORLD.waterX + 30) continue; // bay
      const district = districtAt(cx, cz);
      const def = districtDef(district);
      const block = { id: blocks.length, poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], district, cx, cz };
      blocks.push(block);
      // Palmera Park: one named park with a pond, planted on the block
      // nearest its anchor so a green landmark breaks the Midtown grid.
      if (!palmeraPlaced && Math.hypot(cx - 240, cz - 200) < 60) {
        palmeraPlaced = true;
        props.push({ id: props.length, type: 'park', name: 'Palmera Park', pond: true, x: cx, z: cz, w: x1 - x0, d: z1 - z0 });
        continue;
      }
      // unnamed park every ~14th block in residential districts
      if ((district === 'hillside' || district === 'midtown') && rngBuild() < 0.07) {
        props.push({ id: props.length, type: 'park', x: cx, z: cz, w: x1 - x0, d: z1 - z0 });
        continue;
      }
      const nB = district === 'downtown' ? 1 : district === 'harbor' ? 1 : rngBuild() < 0.5 ? 2 : 4;
      const cols = nB === 1 ? 1 : 2, rows = nB <= 2 ? 1 : 2;
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const w = (x1 - x0) / cols - 8, d = (z1 - z0) / rows - 8;
        const bx = x0 + 4 + (w + 8) * c + w / 2, bz = z0 + 4 + (d + 8) * r + d / 2;
        // landmark parcels are reserved: a regular building whose
        // footprint would swallow a landmark is never placed.
        if (LANDMARKS.some(lm => Math.abs(bx - lm.x) < w / 2 + 23 && Math.abs(bz - lm.z) < d / 2 + 23)) continue;
        const t = clamp(1 - Math.hypot(bx - def.cx, bz - def.cz) / def.r, 0, 1);
        const h = def.hMin + (def.hMax - def.hMin) * Math.pow(t, 1.4) * (0.75 + 0.5 * rngBuild());
        buildings.push({ id: bid++, x: bx, z: bz, rotY: 0, w, d, h: Math.round(h),
          archetype: h < 10 ? 'house' : h < 25 ? 'slab' : 'tower',
          tint: pick(rngBuild, def.palette), roof: def.roof, district, landmark: false, poi: null });
      }
    }
  }
  // landmarks: tall unique buildings on reserved parcels
  for (const lm of LANDMARKS) {
    const def = districtDef(lm.district);
    buildings.push({ id: bid++, x: lm.x, z: lm.z, rotY: 0, w: 34, d: 34, h: lm.h,
      archetype: 'landmark', tint: pick(rngBuild, def.palette), roof: def.roof,
      district: lm.district, landmark: true, name: lm.name, poi: null });
  }
  const landmarks = LANDMARKS.map((lm, i) => ({ id: i, name: lm.name, x: lm.x, z: lm.z, district: lm.district }));
  // POIs: pin each named business to the ordinary building nearest its
  // anchor — the sign painter in render.js does the rest.
  for (const poi of POIS) {
    let best = null, bd = 1e18;
    for (const b of buildings) {
      if (b.landmark) continue;
      const d = (b.x - poi.x) ** 2 + (b.z - poi.z) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    if (best && bd < 110 * 110) best.poi = { name: poi.name, sign: poi.sign };
  }
  const pois = buildings.filter(b => b.poi).map(b => ({ name: b.poi.name, x: b.x, z: b.z, district: b.district }));

  // --- the Marina Pier: a deck reaching into the bay, boats alongside,
  // and the boardwalk strip where the beach meets the boulevard ---
  props.push({ id: props.length, type: 'pier', x: -706, z: 160, w: 132, d: 46 });
  props.push({ id: props.length, type: 'boardwalk', x: WORLD.waterX + 8, z: 40, w: 16, d: 760 });
  const boatCols = ['#e2725b', '#f2ead8', '#2e8b9a', '#e8a13c', '#b83a2a'];
  const boatSpots = [[-700, 96], [-742, 226], [-676, 250], [-716, -60], [-688, -180], [-748, 40]];
  boatSpots.forEach(([bx, bz], i) => {
    props.push({ id: props.length, type: 'boat', x: bx, z: bz, angle: range(rngProps, -0.4, 0.4), color: boatCols[i % boatCols.length] });
  });

  // --- props by rule: palms on the marina, trees in hillside, lights on arterials ---
  for (const e of edges) {
    if (e.cls === 'arterial') {
      const n = Math.floor(e.len / 26);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const px = e.pts[0][0] + (e.pts[1][0] - e.pts[0][0]) * t;
        const pz = e.pts[0][1] + (e.pts[1][1] - e.pts[0][1]) * t;
        props.push({ id: props.length, type: 'light', x: px + (e.pts[0][0] === e.pts[1][0] ? 9 : 0), z: pz + (e.pts[0][1] === e.pts[1][1] ? 9 : 0) });
      }
    }
    if (e.district === 'marina' && Math.abs(e.pts[0][0] - e.pts[1][0]) < 1) {
      const n = Math.floor(e.len / 12);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        props.push({ id: props.length, type: 'palm', x: e.pts[0][0] - 12, z: e.pts[0][1] + (e.pts[1][1] - e.pts[0][1]) * t });
      }
    }
    if (e.district === 'hillside' && rngProps() < 0.6) {
      props.push({ id: props.length, type: 'tree', x: (e.pts[0][0] + e.pts[1][0]) / 2 + range(rngProps, -14, 14), z: (e.pts[0][1] + e.pts[1][1]) / 2 + range(rngProps, -14, 14) });
    }
  }
  // parked cars along parking edges
  const parked = [];
  for (const e of edges) {
    if (!e.parking || rngProps() > 0.5) continue;
    const n = Math.floor(e.len / 30);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const px = e.pts[0][0] + (e.pts[1][0] - e.pts[0][0]) * t;
      const pz = e.pts[0][1] + (e.pts[1][1] - e.pts[0][1]) * t;
      parked.push({ x: px, z: pz, angle: Math.atan2(e.pts[1][1] - e.pts[0][1], e.pts[1][0] - e.pts[0][0]), kind: pick(rngProps, ['sedan', 'sedan', 'sports', 'van', 'taxi']) });
    }
  }

  // --- anchors: mission/spawn points on the graph ---
  const anchors = [];
  function anchor(kind, x, z) {
    let best = null, bd = 1e18;
    for (const n of nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    anchors.push({ id: anchors.length, kind, node: best.id, x: best.x, z: best.z, district: districtAt(best.x, best.z) });
  }
  anchor('safehouse', -300, 300); anchor('garage', -300, 300);
  anchor('landmarkFront', 60, -40); anchor('landmarkFront', -700, 160);
  anchor('landmarkFront', -140, -560); anchor('landmarkFront', 560, 660);
  anchor('storefront', -260, 360); anchor('storefront', 60, 160);
  anchor('warehouseDoor', 560, 560); anchor('alleyMid', -60, -460);
  anchor('pierEnd', -720, 160); anchor('parkingLot', 260, -60);

  return { seed: SEED, version: 1, districts: DISTRICTS, nodes, edges, blocks,
    buildings, props, landmarks, anchors, parked, pois };
}

// Nearest node / edge helpers shared by traffic, police and missions.
export function nearestNode(city, x, z) {
  let best = city.nodes[0], bd = 1e18;
  for (const n of city.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
export function nearestEdge(city, x, z) {
  let best = null, bd = 1e18;
  for (const e of city.edges) {
    if (!e.drivable) continue;
    const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = clamp(t, 0, 1);
    const px = ax + dx * t, pz = az + dz * t, d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// BFS route over the directed graph (one-way edges respected).
export function route(city, fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, -1]]); const q = [fromId];
  while (q.length) {
    const cur = q.shift();
    for (const eid of city.nodes[cur].edges) {
      const e = city.edges[eid];
      let nxt = -1;
      if (e.a === cur && e.lanesF > 0) nxt = e.b;
      else if (e.b === cur && e.lanesB > 0) nxt = e.a;
      if (nxt < 0 || prev.has(nxt)) continue;
      prev.set(nxt, cur);
      if (nxt === toId) { const path = [toId]; let p = toId; while (prev.get(p) >= 0) { p = prev.get(p); path.unshift(p); } return path; }
      q.push(nxt);
    }
  }
  return null;
}
// Building whose footprint (grown by pad) contains the point, or null.
export function buildingAt(city, x, z, pad) {
  const p = pad === undefined ? 2 : pad;
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + p && Math.abs(z - b.z) < b.d / 2 + p) return b;
  }
  return null;
}
export function onRoad(city, x, z) {
  const e = nearestEdge(city, x, z);
  if (!e) return false;
  const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  let t = ((x - ax) * dx + (z - az) * dz) / l2; t = clamp(t, 0, 1);
  const px = ax + dx * t, pz = az + dz * t;
  return Math.hypot(x - px, z - pz) < e.halfW + 4;
}
