// traffic.js — arcade driving + road-graph traffic AI.
// Player car: kinematic bicycle model (steer taper, grip, handbrake
// drift). Traffic: lane-following cars in arclength space along the
// CityData edges, car-following gaps, yield-to-siren, spawn/despawn
// ring around the player.
import { CARS, TRAFFIC, LANE_W } from './config.js';
import { streamFor, pick, range, clamp, angLerp } from './rng.js';
import { nearestEdge } from './city.js';

export function makeCar(kind, x, z, angle, color) {
  const def = CARS[kind] || CARS.sedan;
  return { kind, def, x, z, angle, speed: 0, steer: 0, color: color || def.color,
    hp: 100, velLat: 0, smoking: false, id: 0 };
}

export function driveCar(car, input, dt) {
  const def = car.def;
  const v = car.speed;
  const maxSteer = (0.60 + (0.13 - 0.60) * clamp(Math.abs(v) / def.top, 0, 1));
  const steerTarget = input.steer * maxSteer;
  const rate = input.steer !== 0 ? 4.2 : 6.5;
  car.steer += clamp(steerTarget - car.steer, -rate * dt, rate * dt);
  let accel = 0;
  if (input.throttle > 0) accel = input.throttle * def.accel * (1 - Math.max(0, v) / def.top);
  if (input.brake) accel = v > 0.5 ? -def.brake : -def.accel * 0.6;
  if (input.reverse) accel = v < 0.5 ? -def.accel * 0.6 : -def.brake;
  accel -= 0.0009 * v * Math.abs(v) * def.accel / 8.5;
  car.speed = clamp(v + accel * dt, -8, def.top);
  if (Math.abs(car.speed) < 0.05 && accel === 0) car.speed = 0;
  const grip = input.handbrake ? 2.6 : def.grip;
  car.velLat *= Math.exp(-grip * dt);
  const yawRate = (car.speed / 2.7) * Math.tan(car.steer);
  car.angle += yawRate * dt;
  const fx = Math.cos(car.angle), fz = Math.sin(car.angle);
  const rx = -fz, rz = fx;
  car.x += (fx * car.speed + rx * car.velLat) * dt;
  car.z += (fz * car.speed + rz * car.velLat) * dt;
  if (Math.abs(Math.atan2(car.velLat, car.speed || 0.001)) > 0.9 && Math.abs(car.speed) > 5) {
    car.speed -= Math.sign(car.speed) * 6 * dt;
  }
  return car;
}

export class Traffic {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.rng = streamFor(20261117, 'traffic');
    this.yielding = new Set();
  }
  spawnNear(px, pz, n) {
    let tries = 0;
    while (this.cars.length < n && tries++ < 200) {
      const a = this.rng() * Math.PI * 2;
      const r = range(this.rng, 90, TRAFFIC.spawnR);
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      const e = nearestEdge(this.city, x, z);
      if (!e || e.drivable === false) continue;
      const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
      const t = this.rng();
      const cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
      const dir = this.rng() < 0.5 ? 1 : -1;
      const angle = Math.atan2(bz - az, bx - ax) + (dir < 0 ? Math.PI : 0);
      const laneOff = (dir > 0 ? 1 : -1) * (LANE_W / 2 + 1.7);
      const nx = cx - Math.sin(angle) * laneOff, nz = cz + Math.cos(angle) * laneOff;
      const kind = pick(this.rng, ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sports', 'truck']);
      const car = makeCar(kind, nx, nz, angle);
      car.edge = e.id; car.dir = dir; car.t = t; car.targetSpeed = range(this.rng, TRAFFIC.carSpeed[0], TRAFFIC.carSpeed[1]);
      car.targetSpeed = Math.min(car.targetSpeed, e.speed);
      this.cars.push(car);
    }
  }
  update(dt, player, policeNear) {
    const city = this.city;
    // keep the ring populated
    this.spawnNear(player.x, player.z, TRAFFIC.cars);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      if (d > TRAFFIC.despawnR) { this.cars.splice(i, 1); continue; }
      const e = city.edges[c.edge];
      if (!e) { this.cars.splice(i, 1); continue; }
      // yield to sirens: pull over and stop
      const yieldNow = policeNear && d < 90 && Math.hypot(c.x - policeNear.x, c.z - policeNear.z) < 60;
      let target = yieldNow ? 0 : c.targetSpeed;
      // car-following: slow if a car is ahead on the same edge
      for (const o of this.cars) {
        if (o === c || o.edge !== c.edge || o.dir !== c.dir) continue;
        const along = (o.t - c.t) * c.dir * e.len;
        if (along > 0 && along < 22) target = Math.min(target, Math.max(0, o.speed * 0.8));
      }
      // player car ahead on same edge
      if (player.car) {
        const along = this._along(e, c, player.car);
        if (along > 0 && along < 18) target = Math.min(target, Math.max(0, Math.abs(player.car.speed) * 0.7));
      }
      c.speed += clamp(target - c.speed, -6 * dt, 3 * dt);
      const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
      const dirAng = Math.atan2(bz - az, bx - ax) + (c.dir < 0 ? Math.PI : 0);
      c.angle = angLerp(c.angle, dirAng, Math.min(1, 4 * dt));
      const step = c.speed * dt / e.len * c.dir;
      c.t += step;
      if (c.t >= 1 || c.t <= 0) {
        // pick next edge at the junction
        const nodeId = c.t >= 1 ? (c.dir > 0 ? e.b : e.a) : (c.dir > 0 ? e.a : e.b);
        const node = city.nodes[nodeId];
        const opts = node.edges.filter(id => id !== c.edge && city.edges[id].drivable);
        if (!opts.length) { c.t = clamp(c.t, 0.05, 0.95); c.dir *= -1; continue; }
        const nid = opts[Math.floor(this.rng() * opts.length)];
        const ne = city.edges[nid];
        c.edge = nid;
        c.dir = ne.a === nodeId ? 1 : -1;
        if (c.dir < 0 && ne.lanesB === 0) c.dir = 1;
        if (c.dir > 0 && ne.lanesF === 0) c.dir = -1;
        c.t = c.dir > 0 ? 0.02 : 0.98;
        c.targetSpeed = Math.min(c.targetSpeed, ne.speed);
      }
      const cx = ax + (bx - ax) * c.t, cz = az + (bz - az) * c.t;
      const laneOff = (c.dir > 0 ? 1 : -1) * (LANE_W / 2 + 1.7);
      c.x = cx - Math.sin(c.angle) * laneOff;
      c.z = cz + Math.cos(c.angle) * laneOff;
    }
  }
  _along(e, c, other) {
    const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = ((other.x - ax) * dx + (other.z - az) * dz) / l2;
    return (t - c.t) * c.dir * e.len;
  }
}
