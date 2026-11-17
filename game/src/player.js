// player.js — Reno Kade on foot and behind the wheel.
// On foot: WASD movement, sprint, jump (visual), building collision.
// Driving: the arcade bicycle model from traffic.js; E enters, exits
// and steals cars — parked, traffic, it makes no difference to Reno.
import { PLAYER } from './config.js';
import { clamp, slideMove } from './rng.js';
import { buildingAt } from './city.js';
import { makeCar, driveCar } from './traffic.js';

export class Player {
  constructor(city) {
    this.city = city;
    this.x = -300; this.z = 280; this.angle = 0; this.hp = PLAYER.hp;
    this.cash = 250; this.car = null; this.onFoot = true;
    this.speed = 0; this.aim = 0; this.jump = 0; this.jumpV = 0;
    this.stolenCount = 0; this.dead = false; this.wastedT = 0;
  }
  update(dt, input, traffic, wanted, missions, combat, audio) {
    if (this.dead) return;
    if (this.car) this.updateDriving(dt, input, traffic, wanted, audio);
    else this.updateOnFoot(dt, input, wanted, audio);
    // enter / exit / steal
    if (input.hit('e')) {
      if (this.car) this.exitCar();
      else this.tryEnterCar(traffic, wanted, missions, audio);
    }
    if (this.hp <= 0 && !this.dead) { this.dead = true; this.wastedT = 2.5; }
  }
  updateOnFoot(dt, input, wanted, audio) {
    const ax = input.axis();
    const sprint = input.down('shift');
    const sp = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(ax.x, ax.y) || 1;
    const moving = (ax.x || ax.y) ? 1 : 0;
    const nx = this.x + (ax.x / len) * sp * dt * moving;
    const nz = this.z + (ax.y / len) * sp * dt * moving;
    const np = slideMove(this.city, buildingAt, this.x, this.z, nx, nz, 2);
    this.x = np.x; this.z = np.z;
    if (ax.x || ax.y) this.angle = Math.atan2(ax.y, ax.x);
    if (input.hit(' ') && this.jump <= 0) { this.jumpV = 3.2; }
    if (this.jump > 0 || this.jumpV > 0) {
      this.jump += this.jumpV * dt; this.jumpV -= 12 * dt;
      if (this.jump <= 0) { this.jump = 0; this.jumpV = 0; }
    }
    this.speed = moving ? sp : 0;
  }
  updateDriving(dt, input, traffic, wanted, audio) {
    const car = this.car;
    const ax = input.axis();
    const drive = {
      steer: ax.x, throttle: ax.y < 0 ? 1 : 0,
      brake: input.down(' ') || input.down('s', 'arrowdown'),
      reverse: ax.y > 0, handbrake: input.down('shift'),
    };
    driveCar(car, drive, dt);
    this.x = car.x; this.z = car.z; this.angle = car.angle;
    this.speed = Math.abs(car.speed);
    audio.setEngine(Math.abs(car.speed) / car.def.top, true);
    // building collision: push the car out, damage on hard hits
    const b = buildingAt(this.city, car.x, car.z);
    if (b) {
      const dx = car.x - b.x, dz = car.z - b.z;
      const px = b.w / 2 + 4 - Math.abs(dx), pz = b.d / 2 + 4 - Math.abs(dz);
      if (px < pz) { car.x += Math.sign(dx) * px; } else { car.z += Math.sign(dz) * pz; }
      if (Math.abs(car.speed) > 12) {
        car.speed *= -0.25; car.hp -= 8;
        audio.crash();
        if (wanted && Math.abs(car.speed) > 5) wanted.addCrime('collision', car.x, car.z);
      } else car.speed *= 0.4;
      this.x = car.x; this.z = car.z;
    }
    // hit traffic cars: shove + damage, crime if witnessed
    for (const t of traffic.cars) {
      const d = Math.hypot(t.x - car.x, t.z - car.z);
      if (d < 11 && Math.abs(car.speed) > 3) {
        t.x += Math.cos(car.angle) * 10 * dt * 8; t.z += Math.sin(car.angle) * 10 * dt * 8;
        t.hp -= 20; car.hp -= 3;
        if (t.hp <= 0) { t.hp = 100; }
        if (wanted) wanted.addCrime('collision', car.x, car.z);
        audio.crash();
      }
    }
    if (car.hp <= 0) { car.hp = 1; car.speed = 0; }
  }
  tryEnterCar(traffic, wanted, missions, audio) {
    // nearest parked / traffic car
    let best = null, bd = 1e18;
    const consider = (car, isParked) => {
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < bd && d < PLAYER.carEnterRange) { bd = d; best = { car, isParked }; }
    };
    for (const p of this.city.parked) consider(p, true);
    for (const t of traffic.cars) consider(t, false);
    if (!best) return false;
    const car = best.isParked
      ? makeCar(best.car.kind, best.car.x, best.car.z, best.car.angle)
      : best.car;
    if (best.isParked) {
      const i = this.city.parked.indexOf(best.car);
      if (i >= 0) this.city.parked.splice(i, 1);
    } else {
      const i = traffic.cars.indexOf(best.car);
      if (i >= 0) traffic.cars.splice(i, 1);
    }
    car.hp = 100;
    this.car = car; this.onFoot = false; this.stolenCount++;
    if (missions) missions.registerSteal();
    if (wanted) wanted.addCrime('theft', this.x, this.z);
    if (audio) audio.pickup();
    return true;
  }
  exitCar() {
    if (!this.car) return;
    const a = this.car.angle + Math.PI / 2;
    this.x = this.car.x + Math.cos(a) * 8; this.z = this.car.z + Math.sin(a) * 8;
    this.car.speed = 0; this.car = null; this.onFoot = true;
  }
  respawn() {
    this.hp = PLAYER.hp; this.dead = false; this.wastedT = 0;
    this.x = -300; this.z = 280; this.car = null; this.onFoot = true;
  }
}
