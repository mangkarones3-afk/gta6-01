// pedestrians.js — sidewalk crowds: walk, cross, flee gunfire and
// fast cars. Pedestrians are witnesses for the wanted system — a crime
// nobody sees is a crime nobody reports.
import { streamFor, pick, range, clamp, slideMove } from './rng.js';
import { nearestEdge, buildingAt } from './city.js';

const SHIRTS = ['#b83a2a', '#2e6da8', '#e8a317', '#3f8a52', '#7a4a96', '#e8e4da', '#2c2c34', '#c97f4a'];

export class Pedestrians {
  constructor(city) {
    this.city = city;
    this.list = [];
    this.rng = streamFor(20261117, 'peds');
    this.nextId = 1;
  }
  spawnNear(px, pz, n) {
    let tries = 0;
    while (this.list.length < n && tries++ < 150) {
      const a = this.rng() * Math.PI * 2;
      const r = range(this.rng, 40, 300);
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      const e = nearestEdge(this.city, x, z);
      if (!e) continue;
      const side = this.rng() < 0.5 ? 1 : -1;
      const off = e.halfW + 2.2;
      const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
      const t = this.rng();
      const cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
      const nx = cx + (-dz / len) * off * side, nz = cz + (dx / len) * off * side;
      if (buildingAt(this.city, nx, nz, 0)) continue; // never spawn inside a building
      this.list.push({ id: this.nextId++, x: nx, z: nz, edge: e.id, t, dir: this.rng() < 0.5 ? 1 : -1,
        side, speed: range(this.rng, 1.1, 1.8), shirt: pick(this.rng, SHIRTS),
        state: 'walk', fleeT: 0, phase: this.rng() * 6.28 });
    }
  }
  update(dt, player, threats) {
    this.spawnNear(player.x, player.z, 42);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      if (d > 380) { this.list.splice(i, 1); continue; }
      // flee from gunfire / fast cars
      let flee = false, fx = 0, fz = 0;
      for (const th of threats) {
        const td = Math.hypot(p.x - th.x, p.z - th.z);
        if (td < th.r) { flee = true; fx += (p.x - th.x) / (td || 1); fz += (p.z - th.z) / (td || 1); }
      }
      if (flee) { p.state = 'flee'; p.fleeT = 1.2; }
      else if (p.fleeT > 0) { p.fleeT -= dt; if (p.fleeT <= 0) p.state = 'walk'; }
      if (p.state === 'flee') {
        const m = Math.hypot(fx, fz) || 1;
        const np = slideMove(this.city, buildingAt, p.x, p.z, p.x + (fx / m) * 5.4 * dt, p.z + (fz / m) * 5.4 * dt, 1);
        p.x = np.x; p.z = np.z;
        p.phase += dt * 11;
        continue;
      }
      const e = this.city.edges[p.edge];
      if (!e) { this.list.splice(i, 1); continue; }
      p.t += (p.dir * p.speed * dt) / e.len;
      if (p.t >= 1 || p.t <= 0) {
        const nodeId = p.t >= 1 ? e.b : e.a;
        const node = this.city.nodes[nodeId];
        const opts = node.edges.filter(id => id !== p.edge);
        if (opts.length && this.rng() < 0.7) {
          p.edge = opts[Math.floor(this.rng() * opts.length)];
          p.t = 0.02; p.dir = 1;
        } else { p.t = clamp(p.t, 0.02, 0.98); p.dir *= -1; }
      }
      const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
      const cx = ax + dx * p.t, cz = az + dz * p.t;
      const off = e.halfW + 2.2;
      p.x = cx + (-dz / len) * off * p.side;
      p.z = cz + (dx / len) * off * p.side;
      p.phase += dt * 7;
    }
  }
  // witnesses near a crime (distance stands in for line of sight).
  witnesses(x, z, radius) {
    return this.list.filter(p => Math.hypot(p.x - x, p.z - z) < radius);
  }
}
