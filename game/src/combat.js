// combat.js — on-foot shooting, enemy crews, damage, pickups.
// Mouse aim, click to fire; rival gang members shoot back, and car
// ramming damages them too. Enemies collide with buildings: they
// slide along walls instead of walking through them.
import { WEAPONS } from './config.js';
import { streamFor, range, clamp, slideMove } from './rng.js';
import { buildingAt } from './city.js';

export class Combat {
  constructor() {
    this.bullets = []; this.enemies = []; this.pickups = [];
    this.weapon = 'pistol'; this.ammo = { pistol: 48, smg: 120, shotgun: 24 };
    this.mag = WEAPONS.pistol.mag; this.cool = 0; this.reloadT = 0;
    this.rng = streamFor(20261117, 'combat');
    this.muzzle = 0;
  }
  spawnEnemies(x, z, n, kind) {
    for (let i = 0; i < n; i++) {
      // spawn on open ground: nudge out of any building footprint
      let ex = x + range(this.rng, -30, 30), ez = z + range(this.rng, -30, 30);
      const b = buildingAt(this.cityRef || { buildings: [] }, ex, ez, 0);
      if (b) { ex = b.x + (ex < b.x ? -1 : 1) * (b.w / 2 + 6); }
      this.enemies.push({ x: ex, z: ez,
        hp: kind === 'king' ? 80 : 50, kind, shootT: range(this.rng, 0.5, 1.5), speed: 3.4, dead: false });
    }
  }
  spawnPickup(x, z, kind) { this.pickups.push({ x, z, kind: kind || 'cash', amount: 100 }); }
  fire(px, pz, angle) {
    const w = WEAPONS[this.weapon];
    if (this.cool > 0 || this.reloadT > 0 || this.mag <= 0) return false;
    this.cool = w.rate; this.mag--; this.muzzle = 0.06;
    const n = w.pellets || 1;
    for (let i = 0; i < n; i++) {
      const a = angle + (this.rng() - 0.5) * 2 * w.spread;
      this.bullets.push({ x: px + Math.cos(angle) * 12, z: pz + Math.sin(angle) * 12,
        vx: Math.cos(a) * 520, vz: Math.sin(a) * 520, life: w.range / 520, dmg: w.damage, from: 'player' });
    }
    return true;
  }
  enemyFire(e, px, pz) {
    const a = Math.atan2(pz - e.z, px - e.x) + (this.rng() - 0.5) * 0.24;
    this.bullets.push({ x: e.x, z: e.z, vx: Math.cos(a) * 420, vz: Math.sin(a) * 420,
      life: 0.7, dmg: 7, from: 'enemy' });
  }
  reload() {
    const w = WEAPONS[this.weapon];
    if (this.reloadT > 0 || this.mag === w.mag || this.ammo[this.weapon] <= 0) return;
    this.reloadT = w.reload;
  }
  update(dt, player, city, wanted, onKill) {
    this.cityRef = city;
    this.cool = Math.max(0, this.cool - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const w = WEAPONS[this.weapon];
        const need = w.mag - this.mag;
        const take = Math.min(need, this.ammo[this.weapon]);
        this.mag += take; this.ammo[this.weapon] -= take;
      }
    }
    // bullets stop at buildings as well as bodies
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
      let dead = b.life <= 0 || !!buildingAt(city, b.x, b.z, -2);
      if (!dead) {
        if (b.from === 'player') {
          for (const e of this.enemies) {
            if (!e.dead && Math.hypot(e.x - b.x, e.z - b.z) < 9) {
              e.hp -= b.dmg; dead = true;
              if (e.hp <= 0) { e.dead = true; if (onKill) onKill(e); this.spawnPickup(e.x, e.z, 'cash'); }
              break;
            }
          }
          if (!dead) for (const f of wanted.footCops) {
            if (Math.hypot(f.x - b.x, f.z - b.z) < 9) { f.hp -= b.dmg; dead = true; break; }
          }
        } else {
          if (Math.hypot(player.x - b.x, player.z - b.z) < 8 && !player.car) {
            player.hp = Math.max(0, player.hp - b.dmg); dead = true;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
    // enemies: close in and shoot — sliding along buildings (F-fix)
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(player.x - e.x, player.z - e.z);
      const a = Math.atan2(player.z - e.z, player.x - e.x);
      if (d > 22) {
        const np = slideMove(city, buildingAt, e.x, e.z,
          e.x + Math.cos(a) * e.speed * dt, e.z + Math.sin(a) * e.speed * dt, 1);
        e.x = np.x; e.z = np.z;
      }
      e.shootT -= dt;
      if (d < 180 && e.shootT <= 0 && !player.car) { e.shootT = 1.3; this.enemyFire(e, player.x, player.z); }
      // rammed by the player car
      if (player.car && d < 14 && Math.abs(player.car.speed) > 4) {
        e.hp -= 60; if (e.hp <= 0) { e.dead = true; if (onKill) onKill(e); }
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead || this.rng() > 0.5);
    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(player.x - p.x, player.z - p.z) < 16) {
        player.cash += p.amount; this.pickups.splice(i, 1);
      }
    }
  }
}
