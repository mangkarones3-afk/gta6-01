// player.js — Reno Kade. One job: on-foot movement, driving physics,
// entering/stealing cars, and the camera that follows him.

import {
  WALK_SPEED, SPRINT_MULT, PLAYER_R, CAR_R, CAR_ACCEL, CAR_MAXV, CAR_REVERSE,
  CAR_TURN, VIEW_FOOT, VIEW_DRIVE,
} from './config.js';
import { collide } from './city.js';
import { panic } from './pedestrians.js';

export function createPlayer(city) {
  return {
    x: city.spawn.x, y: city.spawn.y, aim: 0,
    hp: 100, cash: 250, weapon: 1, mags: [Infinity, 12, 30],
    reloadT: 0, fireT: 0, car: null, dead: false,
  };
}

export function damagePlayer(S, amt) {
  const P = S.player;
  if (P.dead) return;
  P.hp -= amt;
  S.flashRed = 1;
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true;
    S.mode = 'dead'; S.deadT = 0;
    if (S.audio) S.audio.busted();
  }
}

export function tryEnterExit(S) {
  const P = S.player;
  if (P.car) {
    const c = P.car;
    P.car = null; c.driver = null;
    if (c.kind === 'cop' || c.wasCop) { /* stays a cop shell */ }
    else if (c.kind !== 'parked') c.kind = 'parked';
    P.x = c.x + Math.cos(c.angle + Math.PI / 2) * 14;
    P.y = c.y + Math.sin(c.angle + Math.PI / 2) * 14;
    const pos = collide(S.city, P, PLAYER_R); P.x = pos.x; P.y = pos.y;
    return;
  }
  let best = null, bd = 30;
  for (const c of S.cars) {
    if (c.dead) continue;
    const d = Math.hypot(c.x - P.x, c.y - P.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  const wasParked = best.kind === 'parked';
  best.driver = 'player';
  P.car = best;
  P.x = best.x; P.y = best.y;
  if (S.audio) S.audio.door();
  if (!wasParked || best.kind === 'cop') {
    // stealing a moving car or an SBPD unit is a crime even in daylight
    S.wantedAPI.addHeat(S, best.kind === 'cop' ? 55 : 22, 'VEHICLE THEFT');
  } else if (best.stolenOnce) {
    S.wantedAPI.addHeat(S, 12, 'VEHICLE THEFT');
  }
  best.stolenOnce = true;
  if (S.mission.onSteal) S.mission.onSteal(S, best);
}

export function updatePlayer(S, dt) {
  const P = S.player, I = S.input;
  const mx = S.mouse.worldX, my = S.mouse.worldY;
  P.aim = Math.atan2(my - P.y, mx - P.x);
  if (P.reloadT > 0) P.reloadT -= dt;
  if (P.fireT > 0) P.fireT -= dt;

  if (P.car) {
    const c = P.car;
    const fwd = I.keys.has('KeyW') || I.keys.has('ArrowUp');
    const back = I.keys.has('KeyS') || I.keys.has('ArrowDown');
    const left = I.keys.has('KeyA') || I.keys.has('ArrowLeft');
    const right = I.keys.has('KeyD') || I.keys.has('ArrowRight');
    const brake = I.keys.has('ShiftLeft') || I.keys.has('ShiftRight');
    if (fwd) c.v += CAR_ACCEL * dt;
    if (back) c.v -= CAR_ACCEL * 0.7 * dt;
    if (!fwd && !back) c.v -= c.v * Math.min(1, 0.55 * dt);
    if (brake) { c.v -= c.v * Math.min(1, 3.2 * dt); }
    const cap = brake ? CAR_MAXV * 0.6 : CAR_MAXV;
    c.v = Math.max(-CAR_REVERSE, Math.min(cap, c.v));
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (steer && Math.abs(c.v) > 4) {
      const rate = CAR_TURN * Math.min(1, Math.abs(c.v) / 90) * (brake ? 1.5 : 1);
      c.angle += steer * rate * dt * Math.sign(c.v);
    }
    const nx = c.x + Math.cos(c.angle) * c.v * dt;
    const ny = c.y + Math.sin(c.angle) * c.v * dt;
    const probe = { x: nx, y: ny };
    collide(S.city, probe, CAR_R);
    if (Math.hypot(probe.x - nx, probe.y - ny) > 2 && Math.abs(c.v) > 120) {
      if (S.audio) S.audio.crash();
      damagePlayer(S, 4);
      S.shake = Math.min(6, Math.abs(c.v) / 40);
    }
    if (Math.hypot(probe.x - nx, probe.y - ny) > 1) c.v *= 0.45;
    c.x = probe.x; c.y = probe.y;
    // other cars: shove apart; peds: tragedy
    for (const o of S.cars) {
      if (o === c || o.dead) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < 17 && d > 0.01) {
        const push = (17 - d) / 2, ux = (o.x - c.x) / d, uy = (o.y - c.y) / d;
        o.x += ux * push; o.y += uy * push;
        if (o.kind === 'cop' && Math.abs(c.v) > 60) S.wantedAPI.addHeat(S, 30, 'RAMMING SBPD');
      }
    }
    for (const p of S.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < 11 && Math.abs(c.v) > 26) {
        p.dead = true; p.hp = 0;
        c.v *= 0.8;
        panic(S, p.x, p.y, 130);
        S.wantedAPI.addHeat(S, 60, 'HIT AND RUN');
        if (S.audio) S.audio.thud();
      }
    }
    P.x = c.x; P.y = c.y;
    if (S.audio) S.audio.engine(Math.abs(c.v) / CAR_MAXV);
  } else {
    let vx = 0, vy = 0;
    if (I.keys.has('KeyW') || I.keys.has('ArrowUp')) vy -= 1;
    if (I.keys.has('KeyS') || I.keys.has('ArrowDown')) vy += 1;
    if (I.keys.has('KeyA') || I.keys.has('ArrowLeft')) vx -= 1;
    if (I.keys.has('KeyD') || I.keys.has('ArrowRight')) vx += 1;
    const d = Math.hypot(vx, vy);
    if (d > 0) {
      const sprint = I.keys.has('ShiftLeft') || I.keys.has('ShiftRight');
      const sp = WALK_SPEED * (sprint ? SPRINT_MULT : 1);
      const pos = { x: P.x + (vx / d) * sp * dt, y: P.y + (vy / d) * sp * dt };
      collide(S.city, pos, PLAYER_R);
      P.x = pos.x; P.y = pos.y;
    }
    // cars push the player gently aside
    for (const c of S.cars) {
      if (c.dead) continue;
      const dd = Math.hypot(c.x - P.x, c.y - P.y);
      if (dd < 13 && dd > 0.01) {
        P.x += ((P.x - c.x) / dd) * (13 - dd);
        P.y += ((P.y - c.y) / dd) * (13 - dd);
        if (Math.abs(c.v) > 90) damagePlayer(S, 9);
      }
    }
  }

  // camera
  const cam = S.cam;
  const targetVW = S.camLock ? S.camLock.viewW : (P.car ? VIEW_DRIVE : VIEW_FOOT);
  cam.viewW += (targetVW - cam.viewW) * Math.min(1, dt * 3);
  const tx = S.camLock ? S.camLock.x : P.x, ty = S.camLock ? S.camLock.y : P.y;
  cam.x += (tx - cam.x) * Math.min(1, dt * 6);
  cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  if (S.shake > 0) {
    cam.x += (Math.random() - 0.5) * S.shake;
    cam.y += (Math.random() - 0.5) * S.shake;
    S.shake = Math.max(0, S.shake - dt * 14);
  }
}
