// wanted.js — heat is the only currency; stars derive from heat.
// States: CALM -> ACTIVE <-> SEARCH -> COOLDOWN -> CALM. Police spawn
// off-screen on the road graph (110-150 m ring, never in view), chase
// via BFS routing, and collide with buildings like everyone else.
import { WANTED } from './config.js';
import { streamFor, clamp, slideMove } from './rng.js';
import { nearestNode, route, buildingAt } from './city.js';
import { makeCar } from './traffic.js';

export class Wanted {
  constructor(city) {
    this.city = city;
    this.heat = 0; this.stars = 0; this.state = 'CALM';
    this.spotted = false; this.lastSpotted = -99; this.lkp = { x: 0, z: 0 };
    this.searchT = 0; this.searchCentre = { x: 0, z: 0 }; this.searchR = 0;
    this.cops = []; this.footCops = []; this.spawnT = 0;
    this.floor = 0; this.cap = 5; this.crimeMult = 1;
    this.roadblock = null; this.bust = 0;
    this.rng = streamFor(20261117, 'wanted');
    this.districtName = 'Downtown';
    this.onStar = null; this.onState = null; this.dispatch = '';
    this.stats = { timesWanted: 0, maxStars: 0, escapes: 0, busts: 0 };
    this._sirenPhase = false; this._sirenT = 0;
  }
  starsFor(heat) {
    let s = 0;
    for (let i = 1; i <= 5; i++) if (heat >= WANTED.thresholds[i]) s = i;
    return Math.min(s, this.cap);
  }
  addCrime(id, x, z) {
    const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    if (this._lastCrime && this._lastCrime.id === id && now - this._lastCrime.t < 2) return;
    this._lastCrime = { id, t: now };
    const base = (WANTED.crimes[id] || 10) * this.crimeMult;
    this.heat = clamp(this.heat + base, 0, WANTED.heatMax);
    this.applyFloor();
    this.refreshStars();
  }
  applyFloor() { if (this.floor > 0) this.heat = Math.max(this.heat, WANTED.thresholds[this.floor]); }
  refreshStars() {
    const s = this.starsFor(this.heat);
    if (s !== this.stars) {
      const old = this.stars; this.stars = s;
      if (s > old && s > 0) {
        this.stats.timesWanted++; this.stats.maxStars = Math.max(this.stats.maxStars, s);
        this.dispatch = s >= 3 ? `Dispatch: suspect last seen in ${this.districtName} — all units respond.` :
          `Dispatch: ${s}-star alert, units responding.`;
        if (this.onStar) this.onStar(old, s);
      }
      if (s === 0 && this.state !== 'CALM') this.setState('CALM');
    }
    if (this.stars > 0 && this.state === 'CALM') this.setState('ACTIVE');
  }
  setState(s) {
    if (this.state === s) return;
    const prev = this.state; this.state = s;
    if (s === 'SEARCH') {
      this.searchT = WANTED.searchTime[this.stars];
      this.searchCentre = { x: this.lkp.x, z: this.lkp.z };
      this.searchR = 30;
      this.dispatch = 'Dispatch: suspect lost — searching the area.';
    }
    if (s === 'COOLDOWN' && prev === 'SEARCH') this.stats.escapes++;
    if (this.onState) this.onState(s);
  }
  forceCooldown() { this.heat = Math.min(this.heat, WANTED.thresholds[1]); this.refreshStars(); this.setState('COOLDOWN'); }
  update(dt, now, player, peds) {
    const city = this.city;
    // perception: any cop within 55 m spots the player
    let seen = false;
    for (const c of this.cops) {
      if (Math.hypot(c.x - player.x, c.z - player.z) < 55) { seen = true; break; }
    }
    if (this.stars > 0) {
      if (seen) { this.spotted = true; this.lastSpotted = now; this.lkp = { x: player.x, z: player.z }; if (this.state !== 'ACTIVE') this.setState('ACTIVE'); }
      else if (this.state === 'ACTIVE' && now - this.lastSpotted > WANTED.loseSightDelay) this.setState('SEARCH');
    }
    if (this.state === 'SEARCH') {
      this.searchT -= dt; this.searchR = Math.min(WANTED.searchRadiusCap[this.stars], this.searchR + 8 * dt);
      const d = Math.hypot(player.x - this.searchCentre.x, player.z - this.searchCentre.z);
      if (d > this.searchR + 60) this.searchT -= dt * 2;
      if (this.searchT <= 0) this.setState('COOLDOWN');
    } else if (this.state === 'COOLDOWN') {
      this.heat = Math.max(0, this.heat - WANTED.decay * dt);
      this.refreshStars();
      if (this.heat <= 0) { this.setState('CALM'); this.cops = []; this.footCops = []; }
    }
    // spawn trickle
    if (this.stars > 0 && this.state !== 'COOLDOWN') {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.cops.length < WANTED.caps[this.stars]) {
        this.spawnT = WANTED.spawnInterval[this.stars];
        this.spawnCop(player);
      }
    }
    // siren phase
    this._sirenT += dt; if (this._sirenT > 0.45) { this._sirenT = 0; this._sirenPhase = !this._sirenPhase; }
    this.updateCops(dt, player, now);
    this.updateFootCops(dt, player);
    // roadblock at 3+ stars when the player speeds down a corridor
    if (this.stars >= 3 && !this.roadblock && player.car && Math.abs(player.car.speed) > 25) {
      this.roadblock = { x: player.x + Math.cos(player.car.angle) * 160, z: player.z + Math.sin(player.car.angle) * 160, t: 25 };
    }
    if (this.roadblock) { this.roadblock.t -= dt; if (this.roadblock.t <= 0) this.roadblock = null; }
    // bust: foot cop within reach of a slow/stopped player
    let bustNear = false;
    for (const f of this.footCops) {
      if (Math.hypot(f.x - player.x, f.z - player.z) < 14 && (!player.car || Math.abs(player.car.speed) < 3)) bustNear = true;
    }
    this.bust = bustNear ? clamp(this.bust + dt / 1.2, 0, 1) : clamp(this.bust - dt * 3, 0, 1);
    if (this.bust >= 1) { this.stats.busts++; this.bust = 0; return 'BUSTED'; }
    return null;
  }
  spawnCop(player) {
    // a graph node 110-150 m away: close enough to matter, never in view
    const cands = this.city.nodes.filter(n => {
      const d = Math.hypot(n.x - player.x, n.z - player.z);
      return d > 110 && d < 160;
    });
    if (!cands.length) return;
    const n = cands[Math.floor(this.rng() * cands.length)];
    const car = makeCar('police', n.x, n.z, 0);
    car.pursuit = true; car.route = null; car.repathT = 0; car.stuckT = 0;
    this.cops.push(car);
  }
  updateCops(dt, player, now) {
    const city = this.city;
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      if (d > 260) { this.cops.splice(i, 1); continue; } // recycle: despawn far away
      let tx = player.x, tz = player.z;
      if (this.state === 'SEARCH' || this.state === 'COOLDOWN') { tx = this.searchCentre.x; tz = this.searchCentre.z; }
      c.repathT -= dt;
      if (c.repathT <= 0 || !c.route) {
        c.repathT = 1.5;
        const from = nearestNode(city, c.x, c.z), to = nearestNode(city, tx, tz);
        c.route = route(city, from.id, to.id) || [from.id];
        c.routeI = 0;
      }
      // steer toward the next route node, then the target
      let steerTo = null;
      if (c.route && c.routeI < c.route.length) {
        const n = city.nodes[c.route[c.routeI]];
        if (Math.hypot(n.x - c.x, n.z - c.z) < 18) c.routeI++;
        else steerTo = n;
      }
      const gx = steerTo ? steerTo.x : tx, gz = steerTo ? steerTo.z : tz;
      const want = Math.atan2(gz - c.z, gx - c.x);
      let diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const speedCap = (player.car ? player.car.def.top : 30) * WANTED.copSpeed[this.stars] * (d > 120 ? 1.08 : 1);
      const throttle = d > 12 ? 1 : 0.4;
      c.steer = clamp(diff * 1.6, -0.55, 0.55);
      const accel = throttle * c.def.accel * (1 - Math.max(0, c.speed) / Math.min(speedCap, c.def.top));
      c.speed = clamp(c.speed + accel * dt, 0, Math.min(speedCap, c.def.top));
      const yawRate = (c.speed / 2.7) * Math.tan(c.steer);
      c.angle += yawRate * dt;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.z += Math.sin(c.angle) * c.speed * dt;
      // buildings are solid for police too: push out, bleed speed
      const b = buildingAt(city, c.x, c.z);
      if (b) {
        const dx = c.x - b.x, dz = c.z - b.z;
        const px = b.w / 2 + 4 - Math.abs(dx), pz = b.d / 2 + 4 - Math.abs(dz);
        if (px < pz) { c.x += Math.sign(dx) * px; } else { c.z += Math.sign(dz) * pz; }
        c.speed *= 0.4;
      }
      // stuck recovery
      if (c.speed < 1 && throttle > 0) { c.stuckT += dt; if (c.stuckT > 2.5) { c.speed = -6; c.stuckT = 0; } } else c.stuckT = 0;
      // ramming: shove the player car
      if (player.car && d < 12 && Math.abs(player.car.speed) > 1) {
        player.car.x += Math.cos(c.angle) * 6 * dt; player.car.z += Math.sin(c.angle) * 6 * dt;
      }
      // foot cops deploy from a stopped cop car near a stopped player
      if (this.stars >= 2 && this.footCops.length < WANTED.footCaps[this.stars] &&
        d < 30 && (!player.car || Math.abs(player.car.speed) < 3) && this.rng() < dt * 0.5) {
        this.footCops.push({ x: c.x + 8, z: c.z, hp: 50, speed: 5.6, shootT: 1 });
      }
    }
  }
  updateFootCops(dt, player) {
    for (let i = this.footCops.length - 1; i >= 0; i--) {
      const f = this.footCops[i];
      if (f.hp <= 0) { this.footCops.splice(i, 1); continue; }
      const d = Math.hypot(player.x - f.x, player.z - f.z);
      const a = Math.atan2(player.z - f.z, player.x - f.x);
      if (d > 16) {
        // building collision: foot cops slide along walls (F-fix)
        const np = slideMove(this.city, buildingAt, f.x, f.z,
          f.x + Math.cos(a) * f.speed * dt, f.z + Math.sin(a) * f.speed * dt, 1);
        f.x = np.x; f.z = np.z;
      }
      f.shootT -= dt;
      if (this.stars >= 3 && d < 90 && d > 12 && f.shootT <= 0) {
        f.shootT = 1.1;
        if (player.hp > 0) player.hp = Math.max(0, player.hp - 6);
      }
    }
  }
}
