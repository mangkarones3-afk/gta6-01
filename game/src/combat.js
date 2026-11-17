// combat.js — guns, fists, bullets and the people who shoot back.
// One job: resolve all violence — player fire, hostile fire, damage.

import { WEAPONS } from './config.js';
import { panic } from './pedestrians.js';
import { damagePlayer } from './player.js';

export function burst(S, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    S.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.4 + Math.random() * 0.3, max: 0.7, color, s: 2.6,
    });
  }
}

function fireBullet(S, x, y, angle, w, from) {
  S.bullets.push({
    x, y, vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed,
    life: w.range / w.speed, damage: w.damage, from,
  });
}

export function playerFire(S) {
  const P = S.player;
  const w = WEAPONS[P.weapon];
  if (P.reloadT > 0 || P.fireT > 0 || P.dead) return;
  if (P.mags[P.weapon] <= 0) { reload(S); return; }
  P.fireT = w.rate;
  if (w.mag !== Infinity) P.mags[P.weapon]--;
  const ox = P.x + Math.cos(P.aim) * 10, oy = P.y + Math.sin(P.aim) * 10;
  if (S.audio) S.audio.shoot(P.weapon);
  panic(S, P.x, P.y, 150);
  // any cop in earshot takes notice
  for (const c of S.cars) {
    if (c.kind === 'cop' && Math.hypot(c.x - P.x, c.y - P.y) < 330) { S.wantedAPI.addHeat(S, 4, 'SHOTS FIRED'); break; }
  }
  if (w.id === 'fists') {
    // swing: hit whoever is in front, close
    for (const p of S.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - P.x, p.y - P.y);
      if (d < w.range + 6) {
        p.hp -= w.damage;
        burst(S, p.x, p.y, '#e33f2e', 4, 40);
        if (p.hp <= 0) { p.dead = true; S.wantedAPI.addHeat(S, 45, 'ASSAULT'); }
        else p.flee = 3;
      }
    }
    return;
  }
  const spread = w.id === 'smg' ? (Math.random() - 0.5) * 0.07 : (Math.random() - 0.5) * 0.02;
  fireBullet(S, ox, oy, P.aim + spread, w, 'player');
  burst(S, ox, oy, '#ffd76a', 2, 26);
}

export function reload(S) {
  const P = S.player;
  const w = WEAPONS[P.weapon];
  if (w.mag === Infinity || P.mags[P.weapon] === w.mag || P.reloadT > 0) return;
  P.reloadT = 0.9;
  if (S.audio) S.audio.reload();
  P.pendingReload = true; // updateCombat refills the mag when the timer ends
}

// One bullet at its current position: test it against people and cars.
function resolveBullet(S, b) {
  const P = S.player;
  if (b.life <= 0) return;
  if (b.from === 'player') {
    for (const p of S.peds) {
      if (p.dead) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 6.5) {
        p.hp -= b.damage; b.life = 0;
        burst(S, p.x, p.y, '#e33f2e', 5, 46);
        if (p.hp <= 0) { p.dead = true; panic(S, p.x, p.y, 120); S.wantedAPI.addHeat(S, p.hostile ? 15 : 55, p.hostile ? 'SHOOTOUT' : 'HOMICIDE'); }
        else p.flee = 3;
        return;
      }
    }
    for (const c of S.cars) {
      if (c.dead || c === P.car) continue;
      if (Math.hypot(c.x - b.x, c.y - b.y) < 11) {
        c.hp -= b.damage; b.life = 0;
        burst(S, b.x, b.y, '#ffb020', 4, 40);
        if (c.hp <= 0) {
          c.dead = true; burst(S, c.x, c.y, '#555560', 14, 60);
          if (c.kind === 'cop') S.wantedAPI.addHeat(S, 80, 'SBPD UNIT DOWN');
          if (S.audio) S.audio.explosion();
        }
        return;
      }
    }
  } else { // hostile bullet
    if (Math.hypot(P.x - b.x, P.y - b.y) < (P.car ? 11 : 7)) {
      b.life = 0;
      damagePlayer(S, 6);
      burst(S, P.x, P.y, '#e33f2e', 4, 40);
    }
  }
}

export function updateCombat(S, dt) {
  const P = S.player;
  if (P.pendingReload && P.reloadT <= 0) { P.mags[P.weapon] = WEAPONS[P.weapon].mag; P.pendingReload = false; }

  // mouse fire (held for automatics, per-shot for others via main's edge set)
  if (S.mouse.down && !P.car) playerFire(S);
  else if (S.mouse.down && P.car) playerFire(S);

  // bullets — moved in sub-steps of at most 5 units so a fast round can
  // never tunnel through a target between frames
  for (const b of S.bullets) {
    const stepLen = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(stepLen / 5));
    const sdt = dt / steps;
    for (let s = 0; s < steps && b.life > 0; s++) {
      b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt;
      resolveBullet(S, b);
    }
  }
  S.bullets = S.bullets.filter(b => b.life > 0);

  // hostiles: rival crew who hold their ground and shoot
  for (const p of S.peds) {
    if (!p.hostile || p.dead) continue;
    const d = Math.hypot(P.x - p.x, P.y - p.y);
    p.angle = Math.atan2(P.y - p.y, P.x - p.x);
    if (d > 105) { p.x += Math.cos(p.angle) * 38 * dt; p.y += Math.sin(p.angle) * 38 * dt; }
    else if (d < 55) { p.x -= Math.cos(p.angle) * 26 * dt; p.y -= Math.sin(p.angle) * 26 * dt; }
    p.fireT -= dt;
    if (d < 190 && p.fireT <= 0 && !P.dead) {
      p.fireT = 1.15 + Math.random() * 0.5;
      const w = WEAPONS[1];
      fireBullet(S, p.x, p.y, p.angle + (Math.random() - 0.5) * 0.16, w, 'hostile');
      if (S.audio) S.audio.shoot(1, 0.4);
    }
  }

  // particles
  for (const pt of S.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  S.particles = S.particles.filter(pt => pt.life > 0);
  if (S.flashRed > 0) S.flashRed = Math.max(0, S.flashRed - dt * 2.4);
}
