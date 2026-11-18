// city.js — seeded generation of Solano Bay: the road graph (nodes, edges,
// lanes), blocks filled with buildings and diegetic signs, landmarks,
// parked cars, props and mission anchors. One dataset, consumed by the
// renderer, traffic, police routing, missions and the minimap alike — the
// graph is the truth; if the map and the street disagree, the map is wrong.

const SBCity = (() => {
  const C = window.SBConfig;
  const R = window.SBRng;
  const rngRoads = R.streamFor(C.seed, "roads");
  const rngBlocks = R.streamFor(C.seed, "blocks");
  const rngProps = R.streamFor(C.seed, "props");
  void rngRoads;

  // ---- road graph ------------------------------------------------------
  const nodes = [];
  const nodeId = new Map();
  C.hStreets.forEach((h, j) => {
    C.vStreets.forEach((v, i) => {
      const id = nodes.length;
      nodeId.set(i + "," + j, id);
      nodes.push({ id, x: v.x, y: h.y, edges: [] });
    });
  });

  const edges = [];
  function addEdge(a, b, cls, vertical) {
    const spec = C.road[cls];
    const A = nodes[a], B = nodes[b];
    const e = {
      id: edges.length, a, b, cls, vertical,
      halfW: spec.halfW, lanes: spec.lanes, speed: spec.speed,
      ax: A.x, ay: A.y, bx: B.x, by: B.y,
      len: Math.hypot(B.x - A.x, B.y - A.y),
    };
    edges.push(e);
    A.edges.push(e.id);
    B.edges.push(e.id);
    return e;
  }
  C.hStreets.forEach((h, j) => {
    for (let i = 0; i < C.vStreets.length - 1; i++) {
      addEdge(nodeId.get(i + "," + j), nodeId.get((i + 1) + "," + j), h.cls, false);
    }
  });
  C.vStreets.forEach((v, i) => {
    for (let j = 0; j < C.hStreets.length - 1; j++) {
      addEdge(nodeId.get(i + "," + j), nodeId.get(i + "," + (j + 1)), v.cls, true);
    }
  });

  // Pose on a lane: dir +1 travels a->b, -1 travels b->a; lane 0 is the
  // rightmost lane of that direction. s = metres travelled from the start.
  function lanePose(e, dir, lane, s) {
    const ux = (e.bx - e.ax) / e.len, uy = (e.by - e.ay) / e.len;
    const off = (lane + 0.5) * (e.halfW / e.lanes);
    // right of travel direction (ux,uy) is (-uy,ux) in screen coords (y down)
    const rx = -uy * dir, ry = ux * dir;
    const t = dir > 0 ? s : e.len - s;
    return {
      x: e.ax + ux * t + rx * off,
      y: e.ay + uy * t + ry * off,
      heading: Math.atan2(uy * dir, ux * dir),
    };
  }

  function nearestNode(x, y) {
    let best = 0, bd = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  // Breadth-first route over the undirected graph; returns node ids.
  function route(fromId, toId) {
    if (fromId === toId) return [fromId];
    const prev = new Map([[fromId, -1]]);
    const queue = [fromId];
    while (queue.length) {
      const cur = queue.shift();
      for (const eid of nodes[cur].edges) {
        const e = edges[eid];
        const nxt = e.a === cur ? e.b : e.a;
        if (!prev.has(nxt)) {
          prev.set(nxt, cur);
          if (nxt === toId) {
            const path = [toId];
            let p = cur;
            while (p !== -1) { path.unshift(p); p = prev.get(p); }
            return path;
          }
          queue.push(nxt);
        }
      }
    }
    return [fromId];
  }

  function edgeBetween(a, b) {
    for (const eid of nodes[a].edges) {
      const e = edges[eid];
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e;
    }
    return null;
  }

  // ---- districts -------------------------------------------------------
  function districtAt(x, y) {
    for (const d of C.districts) {
      if (x >= d.rect[0] && x < d.rect[2] && y >= d.rect[1] && y < d.rect[3]) return d;
    }
    return C.districts[4];
  }

  // ---- land and water --------------------------------------------------
  function inPier(x, y) {
    return x >= C.pier.minX && x <= C.pier.maxX && y >= C.pier.minY && y <= C.pier.maxY;
  }
  function isWater(x, y) {
    return y > C.shoreY && !inPier(x, y);
  }
  function isLand(x, y) {
    if (inPier(x, y)) return true;
    return x >= C.world.minX && x <= C.world.maxX && y >= C.world.minY && y <= C.shoreY;
  }

  // ---- buildings -------------------------------------------------------
  const buildings = [];
  const landmarks = [];
  const blockRects = [];
  const signCursor = {};

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function nextSign(districtId) {
    const pool = C.signNames[districtId];
    if (signCursor[districtId] === undefined) {
      signCursor[districtId] = Math.floor(rngBlocks() * pool.length);
    }
    const name = pool[signCursor[districtId] % pool.length];
    signCursor[districtId] += 1;
    return name;
  }

  function addBuilding(x, y, w, d, h, district, opts) {
    const b = {
      id: buildings.length, x, y, w, d, h,
      tint: shade((opts && opts.tint) || R.pick(rngBlocks, district.palette), R.range(rngBlocks, 0.86, 1.07)),
      roof: district.roof,
      district: district.id,
      sign: (opts && opts.sign) || null,
      signSide: (opts && opts.signSide) || "S",
      signBoth: !!(opts && opts.signBoth),
      landmark: (opts && opts.landmark) || null,
    };
    buildings.push(b);
    return b;
  }

  // Landmark blocks are reserved: key = "vi,hj" of the block's west/north streets.
  const reserved = {
    "3,1": { kind: "tower", name: "TORRE ALBA" },        // downtown tower
    "6,1": { kind: "market", name: "MERCADO CENTRAL" },  // market hall
    "1,3": { kind: "clocktower", name: "TORRE DEL RELOJ" }, // old-town clock tower
    "0,0": { kind: "watertower", name: "PALMA VERDE" },  // suburb water tower
  };

  for (let i = 0; i < C.vStreets.length - 1; i++) {
    for (let j = 0; j < C.hStreets.length - 1; j++) {
      const vs = C.vStreets[i], ve = C.vStreets[i + 1];
      const hs = C.hStreets[j], he = C.hStreets[j + 1];
      const x0 = vs.x + C.road[vs.cls].halfW + C.sidewalk;
      const x1 = ve.x - C.road[ve.cls].halfW - C.sidewalk;
      const y0 = hs.y + C.road[hs.cls].halfW + C.sidewalk;
      const y1 = he.y - C.road[he.cls].halfW - C.sidewalk;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const key = i + "," + j;

      if (reserved[key]) {
        const spec = reserved[key];
        const b = addBuilding(cx, cy, (x1 - x0) * 0.62, (y1 - y0) * 0.62,
          spec.kind === "tower" ? 96 : spec.kind === "market" ? 16 : 22,
          district, { sign: spec.name, signSide: "S", landmark: spec.kind });
        landmarks.push({ name: spec.name, kind: spec.kind, x: cx, y: cy, district: district.id, building: b.id });
        continue;
      }

      blockRects.push({ x: cx, y: cy, w: x1 - x0, d: y1 - y0 });
      // Split the block into a grid of lots: columns along its longer axis,
      // and a second row whenever the block is deep enough — a block must
      // never read as one slab.
      const wide = x1 - x0 >= y1 - y0;
      const span = wide ? x1 - x0 : y1 - y0;
      const depth = wide ? y1 - y0 : x1 - x0;
      const lotTarget = district.id === "aurora" ? 44 : district.id === "dock" ? 52 : district.id === "palma" ? 26 : 32;
      const lots = Math.max(1, Math.round(span / lotTarget));
      const rows = depth > 62 ? 2 : 1;
      const lotSpan = span / lots;
      const rowSpan = depth / rows;
      for (let k = 0; k < lots; k++) {
        for (let rIdx = 0; rIdx < rows; rIdx++) {
          const gap = 2.6;
          let bx, by, bw, bd;
          if (wide) {
            bx = x0 + lotSpan * (k + 0.5); bw = lotSpan - gap;
            by = y0 + rowSpan * (rIdx + 0.5); bd = rowSpan - gap;
          } else {
            bx = x0 + rowSpan * (rIdx + 0.5); bw = rowSpan - gap;
            by = y0 + lotSpan * (k + 0.5); bd = lotSpan - gap;
          }
          // Shore row: leave the lighthouse point clear.
          if (j === C.hStreets.length - 1 && bx > 585 && bx < 655) continue;
          const dc = Math.hypot(bx - (district.rect[0] + district.rect[2]) / 2, by - (district.rect[1] + district.rect[3]) / 2);
          const fall = Math.max(0, 1 - dc / 340);
          const h = district.hMin + (district.hMax - district.hMin) * fall * R.range(rngBlocks, 0.55, 1.05);
          let side, signBoth = false;
          if (rows === 2) side = rIdx === 0 ? "N" : "S";
          else if (wide) { side = rngBlocks() < 0.5 ? "N" : "S"; signBoth = bd > 40; }
          else side = rngBlocks() < 0.5 ? "W" : "E";
          const sign = rngBlocks() < district.signShare ? nextSign(district.id) : null;
          addBuilding(bx, by, bw, bd, h, district, { sign, signSide: side, signBoth });
        }
      }
    }
  }

  // Shore landmarks that live outside blocks.
  landmarks.push({ name: "FARO SERENA", kind: "lighthouse", x: 620, y: 784, district: "serena", building: -1 });
  landmarks.push({ name: "MARINA DOCK", kind: "cranes", x: 985, y: 782, district: "dock", building: -1 });

  // ---- anchors (mission / POI points, on sidewalks by construction) ----
  function frontOf(building, dist) {
    if (!building) return { x: 0, y: 0, dx: 0, dy: 1 };
    // Scan outward from the sign face for the nearest standable point (not
    // inside another building, not in water) near the wanted offset — in a
    // tight lot grid a blind offset can land inside the next building.
    // Returns the point plus the outward normal (dx, dy).
    const normals = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    const sides = [building.signSide, "S", "N", "E", "W"];
    const seen = {};
    for (const side of sides) {
      if (seen[side]) continue;
      seen[side] = true;
      const n = normals[side] || [0, 1];
      const fx = side === "E" ? building.x + building.w / 2 : side === "W" ? building.x - building.w / 2 : building.x;
      const fy = side === "N" ? building.y - building.d / 2 : side === "S" ? building.y + building.d / 2 : building.y;
      for (let d = 2; d <= dist + 7; d += 1) {
        const px = fx + n[0] * d, py = fy + n[1] * d;
        if (isWater(px, py) || !isLand(px, py)) break;
        if (buildingHit(px, py, 0.7)) continue;
        return { x: px, y: py, dx: n[0], dy: n[1] };
      }
    }
    return { x: building.x, y: building.y + building.d / 2 + dist, dx: 0, dy: 1 };
  }
  function findSigned(name) {
    return buildings.find((b) => b.sign === name) || null;
  }
  const cafe = findSigned("CAFÉ ALBA");
  const taller = findSigned("TALLER FERRER");
  const anchors = {
    cafeAlba: frontOf(cafe, 3),
    safehouse: frontOf(taller, 3),
    mercado: { x: 970, y: 306 },
    marinaDock: { x: 985, y: 742 },
    dockLot: { x: 1085, y: 660 },
    pierBoat: { x: 900, y: 896 },
    faro: { x: 620, y: 770 },
    torreAlba: { x: 550, y: 293 },
    clockTower: { x: 270, y: 553 },
    hotelSerena: { x: 700, y: 730 },
  };

  // ---- parked cars and props ------------------------------------------
  const parked = [];
  for (const e of edges) {
    if (e.cls === "arterial") continue;
    const rng = R.streamFor(C.seed, "park" + e.id);
    for (let s = 18; s < e.len - 18; s += 11) {
      if (rng() > 0.42) continue;
      const side = rng() > 0.5 ? 1 : -1;
      const ux = (e.bx - e.ax) / e.len, uy = (e.by - e.ay) / e.len;
      const off = e.halfW - 1.7;
      parked.push({
        x: e.ax + ux * s + -uy * side * off,
        y: e.ay + uy * s + ux * side * off,
        heading: Math.atan2(uy, ux) + (side < 0 ? Math.PI : 0),
        color: R.pick(rng, C.carColors),
        archetype: R.intRange(rng, 0, 2),
      });
    }
  }

  const props = [];
  for (let x = -20; x <= 1140; x += 23) {
    if (x > C.pier.minX - 14 && x < C.pier.maxX + 14) continue;
    props.push({ type: "palm", x: x + R.range(rngProps, -3, 3), y: 786 });
  }
  for (const b of buildings) {
    if ((b.district === "palma" || b.district === "viejo") && rngProps() < 0.5) {
      props.push({ type: "tree", x: b.x + b.w / 2 + 3, y: b.y + R.range(rngProps, -6, 6) });
    }
  }
  for (const n of nodes) {
    props.push({ type: "lamp", x: n.x + 9, y: n.y + 9 });
    props.push({ type: "lamp", x: n.x - 9, y: n.y - 9 });
  }

  // ---- collision --------------------------------------------------------
  function buildingHit(x, y, r) {
    for (const b of buildings) {
      if (x > b.x - b.w / 2 - r && x < b.x + b.w / 2 + r && y > b.y - b.d / 2 - r && y < b.y + b.d / 2 + r) return b;
    }
    return null;
  }

  return {
    nodes, edges, buildings, landmarks, anchors, parked, props, blockRects,
    lanePose, nearestNode, route, edgeBetween, districtAt,
    isWater, isLand, inPier, buildingHit, findSigned,
  };
})();

window.SBCity = SBCity;
