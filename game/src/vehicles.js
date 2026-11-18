// vehicles.js — arcade car handling (kinematic bicycle with a velocity
// split, so handbrake drift falls out of the grip term) and traffic AI that
// lives in lane space: a traffic car's position is always a function of
// (edge, direction, lane, s), which makes driving through buildings or off
// the road structurally impossible.

const SBVehicles = (() => {
  const C = window.SBConfig;
  const City = window.SBCity;
  const R = window.SBRng;
  const rng = R.streamFor(C.seed, "traffic");

  const ARCH = [
    { len: 4.3, top: 34, accel: 7.2, name: "Vireo" },
    { len: 4.7, top: 38, accel: 8.0, name: "Caspián" },
    { len: 5.1, top: 30, accel: 6.2, name: "Meridian" },
    { len: 4.5, top: 46, accel: 10.5, name: "Picante" },
  ];

  function makeCar(x, y, heading, opts) {
    const arch = ARCH[(opts && opts.archetype) || 0];
    return {
      x, y, heading, velFwd: 0, velLat: 0, steer: 0,
      len: arch.len, top: arch.top, accel: arch.accel,
      color: (opts && opts.color) || "#888888",
      archetype: (opts && opts.archetype) || 0,
      police: !!(opts && opts.police),
      hp: 100, driver: null, parked: !!(opts && opts.parked),
      edge: null, dir: 1, lane: 0, s: 0, cruise: 1,
      stuckFor: 0, dead: false,
    };
  }

  // Shared handling step. input: {throttle -1..1, steer -1..1, handbrake}
  function stepCar(car, input, dt) {
    const v = car.velFwd;
    const speedT = Math.min(1, Math.abs(v) / car.top);
    const maxSteer = 0.60 + (0.13 - 0.60) * speedT;
    const steerTarget = input.steer * maxSteer;
    const rate = 4.2 * dt;
    car.steer += Math.max(-rate, Math.min(rate, steerTarget - car.steer));
    let accel = 0;
    if (input.throttle > 0) accel = input.throttle * car.accel * (1 - Math.max(0, v) / car.top);
    else if (input.throttle < 0) accel = v > 0.4 ? -10.5 : input.throttle * 5.5;
    const drag = 0.012 * v * Math.abs(v);
    car.velFwd += (accel - drag) * dt;
    if (input.throttle === 0) car.velFwd -= car.velFwd * Math.min(1, 0.55 * dt);
    car.velFwd = Math.max(-8, Math.min(car.top, car.velFwd));
    const grip = input.handbrake ? 2.6 : 10;
    car.velLat *= Math.exp(-grip * dt);
    const yaw = (car.velFwd / 2.7) * Math.tan(car.steer);
    car.heading += yaw * dt;
    const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
    car.x += (fx * car.velFwd - fy * car.velLat) * dt;
    car.y += (fy * car.velFwd + fx * car.velLat) * dt;
    // Collisions: buildings and water push the car back out.
    collideWorld(car);
  }

  function collideWorld(car) {
    const r = 1.15;
    const hit = City.buildingHit(car.x, car.y, r);
    if (hit) {
      const dx = car.x - hit.x, dy = car.y - hit.y;
      const px = hit.w / 2 + r - Math.abs(dx), py = hit.d / 2 + r - Math.abs(dy);
      if (px < py) car.x = hit.x + (dx > 0 ? hit.w / 2 + r : -hit.w / 2 - r);
      else car.y = hit.y + (dy > 0 ? hit.d / 2 + r : -hit.d / 2 - r);
      car.velFwd *= 0.35;
      car.velLat = 0;
      return true;
    }
    if (City.isWater(car.x, car.y) || !City.isLand(car.x, car.y)) {
      // Shoreline and world edge are hard stops for cars.
      if (car.y > C.shoreY && !City.inPier(car.x, car.y)) car.y = C.shoreY;
      car.x = Math.max(C.world.minX + 1, Math.min(C.world.maxX - 1, car.x));
      car.y = Math.max(C.world.minY + 1, car.y);
      car.velFwd *= 0.4;
      return true;
    }
    return false;
  }

  // ---- traffic ---------------------------------------------------------
  const traffic = [];
  function spawnTraffic(player) {
    const target = 24;
    if (traffic.length >= target) return;
    for (let tries = 0; tries < 6; tries++) {
      const e = City.edges[Math.floor(rng() * City.edges.length)];
      const dist = Math.hypot((e.ax + e.bx) / 2 - player.x, (e.ay + e.by) / 2 - player.y);
      if (dist < 105 || dist > 245) continue;
      const dir = rng() > 0.5 ? 1 : -1;
      const s = R.range(rng, 20, e.len - 20);
      const pose = City.lanePose(e, dir, 0, s);
      if (City.buildingHit(pose.x, pose.y, 2)) continue;
      const car = makeCar(pose.x, pose.y, pose.heading, {
        archetype: R.intRange(rng, 0, 3), color: R.pick(rng, C.carColors),
      });
      car.edge = e.id; car.dir = dir; car.s = s;
      car.cruise = R.range(rng, 0.85, 1.02);
      car.velFwd = e.speed * 0.7;
      traffic.push(car);
      return;
    }
  }

  function chooseNextEdge(car, nodeId) {
    const node = City.nodes[nodeId];
    const options = node.edges
      .map((eid) => City.edges[eid])
      .filter((e) => e.id !== car.edge || node.edges.length === 1);
    if (!options.length) return null;
    // Prefer continuing roughly straight.
    const cur = City.edges[car.edge];
    const curDir = Math.atan2(
      (car.dir > 0 ? cur.by - cur.ay : cur.ay - cur.by),
      (car.dir > 0 ? cur.bx - cur.ax : cur.ax - cur.bx));
    let best = null, bestScore = -Infinity;
    for (const e of options) {
      const other = e.a === nodeId ? { x: e.bx, y: e.by } : { x: e.ax, y: e.ay };
      const a = Math.atan2(other.y - node.y, other.x - node.x);
      let diff = Math.abs(a - curDir);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      const score = -diff + rng() * 0.7;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function stepTraffic(dt, world) {
    const player = world.player;
    spawnTraffic(player);
    for (let i = traffic.length - 1; i >= 0; i--) {
      const car = traffic[i];
      const e = City.edges[car.edge];
      const distP = Math.hypot(car.x - player.x, car.y - player.y);
      if (distP > 280) { traffic.splice(i, 1); continue; }
      // Leader check: any car or the player ahead on the same lane.
      let want = e.speed * car.cruise;
      const ahead = (other) => {
        if (other === car) return Infinity;
        if (other.parked) return Infinity; // kerbside cars are never a leader
        const dx = other.x - car.x, dy = other.y - car.y;
        const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
        const fwd = dx * fx + dy * fy;
        const lat = Math.abs(-dx * fy + dy * fx);
        if (fwd > 0 && fwd < 15 && lat < 1.9) return fwd;
        return Infinity;
      };
      let gap = Infinity;
      for (const o of world.allCars()) gap = Math.min(gap, ahead(o));
      if (world.playerCar && world.playerCar !== car) gap = Math.min(gap, ahead(world.playerCar));
      if (gap < 7) want = 0;
      else if (gap < 13) want = Math.min(want, 4);
      // Police nearby: civilian traffic yields to the kerb.
      if (world.wanted.stars >= 1 && distP < 42) want = Math.min(want, 2.5);
      const accelIn = car.velFwd < want ? 0.55 : -1;
      // Advance in lane space, then derive the world pose.
      car.s += car.velFwd * dt;
      if (car.s >= e.len - 0.5) {
        const nodeId = car.dir > 0 ? e.b : e.a;
        const next = chooseNextEdge(car, nodeId);
        if (!next) { traffic.splice(i, 1); continue; }
        car.dir = next.a === nodeId ? 1 : -1;
        car.edge = next.id;
        car.s = 0.5;
      } else if (car.s <= 0.5) {
        car.s = 0.5;
      }
      const ne = City.edges[car.edge];
      const pose = City.lanePose(ne, car.dir, car.lane, car.s);
      car.x = pose.x; car.y = pose.y; car.heading = pose.heading;
      // Speed integrates outside lane space (gap controller above).
      car.velFwd += (accelIn > 0 ? car.accel * 0.4 : -8) * dt * (accelIn > 0 ? 1 : 1);
      if (accelIn > 0 && car.velFwd > want) car.velFwd = want;
      if (accelIn < 0) car.velFwd = Math.max(want, car.velFwd + accelIn * 6 * dt);
      car.velFwd = Math.max(0, car.velFwd);
      void distP;
    }
  }

  return { ARCH, makeCar, stepCar, collideWorld, traffic, spawnTraffic, stepTraffic };
})();

window.SBVehicles = SBVehicles;
