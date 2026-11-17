// missions.js — the campaign: five story jobs for the Bay Rats, plus
// repeatable side work. Reno Kade owes the crew; each job pays down
// the debt and raises his name. Steps are data: goto / steal / heat /
// fight / deliver / chop / cooldown. The heat step (mission 3) is the
// heart of the game: make the SBPD come, then make them lose you.
import { STORY } from './config.js';
import { clamp } from './rng.js';

const GARAGE = { x: -300, z: 300 };
const CLUB = { x: -540, z: 60 };
const MARKET = { x: -260, z: 360 };
const TOWER = { x: 60, z: -40 };

const DEFS = [
  { id: 'm1', title: 'First Wheels', intro: 'Mara: "Debt collectors ride in style, Reno. Steal me a car worth a damn and bring it to the garage."',
    steps: [
      { kind: 'steal', label: 'Steal any car' },
      { kind: 'goto', label: 'Bring the car to Taller Voss', x: GARAGE.x, z: GARAGE.z, inCar: true },
    ], pay: 400 },
  { id: 'm2', title: 'Cash in the Registers', intro: 'Mara: "Banco del Sol owes the crew. Rob the till, and don\'t stick around for the photo."',
    steps: [
      { kind: 'goto', label: 'Reach Banco del Sol', x: 30, z: 60 },
      { kind: 'stand', label: 'Rob the till — stay in the circle', x: 30, z: 60, t: 4 },
      { kind: 'heatstep', label: 'Escape the heat', minStars: 0 },
    ], pay: 900 },
  { id: 'm3', title: 'Make Some Noise', intro: 'Mara: "The crew needs a distraction downtown. Three stars of noise, then vanish. Can you do vanishing?"',
    steps: [
      { kind: 'goto', label: 'Reach Solano Tower', x: TOWER.x, z: TOWER.z },
      { kind: 'heat', label: 'Raise the heat to 3 stars', minStars: 3 },
      { kind: 'heatstep', label: 'Lose the heat — break line of sight', minStars: 0 },
    ], pay: 1500 },
  { id: 'm4', title: 'Rats in the Market', intro: 'Mara: "A rival crew is shaking down Mercado Central. Clear them out. All of them."',
    steps: [
      { kind: 'goto', label: 'Reach Mercado Central', x: MARKET.x, z: MARKET.z },
      { kind: 'fight', label: 'Clear the rival crew', x: MARKET.x, z: MARKET.z, count: 4 },
    ], pay: 2200 },
  { id: 'm5', title: 'The Velero Job', intro: 'Mara: "One last job. The Velero kingpin is at his club. End it, and the bay is ours."',
    steps: [
      { kind: 'goto', label: 'Reach Club Velero', x: CLUB.x, z: CLUB.z },
      { kind: 'fight', label: 'Take down the kingpin', x: CLUB.x, z: CLUB.z, count: 3, king: true },
      { kind: 'heatstep', label: 'Escape with the bay watching', minStars: 0 },
    ], pay: 4000 },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0; this.step = 0; this.state = 'offer'; // offer -> active -> done
    this.standT = 0; this.kills = 0; this.steals = 0;
    this.side = null; this.sideN = 0;
    this.done = [];
    this.banner = null; this.bannerT = 0;
    this.dialogue = null; this.dialogueT = 0;
  }
  get def() { return DEFS[this.index] || null; }
  start() {
    if (!this.def) return;
    this.state = 'active'; this.step = 0; this.standT = 0; this.kills = 0;
    this.stealsAtStart = this.steals; // the steal step counts fresh thefts only
    this.showDialogue(this.def.intro, 7);
    this.banner = this.def.title; this.bannerT = 3;
  }
  showDialogue(text, t) { this.dialogue = text; this.dialogueT = t || 5; }
  stepObj() {
    if (this.side) {
      const s = this.side;
      if (s.stage === 'goto') return { kind: 'goto', x: s.x, z: s.z, label: s.label };
      if (s.stage === 'deliver') return { kind: 'goto', x: s.dx, z: s.dz, label: s.label };
      return { kind: s.kind, x: s.x, z: s.z, label: s.label };
    }
    if (this.state !== 'active' || !this.def) return null;
    const s = this.def.steps[this.step];
    if (!s) return null;
    if (s.kind === 'heat') return { kind: 'heat', x: 0, z: 0, label: s.label };
    if (s.kind === 'heatstep') return { kind: 'heat', x: 0, z: 0, label: s.label };
    return { kind: s.kind, x: s.x || 0, z: s.z || 0, label: s.label };
  }
  currentLabel() {
    const o = this.stepObj();
    if (o) return o.label;
    if (this.state === 'offer' && this.def) return `New job: ${this.def.title} — press M`;
    if (!this.def) return 'Solano Bay is yours. Side jobs: press J.';
    return '';
  }
  registerSteal() { this.steals++; }
  registerKill() { this.kills++; }
  advance() {
    const d = this.def;
    this.step++;
    if (this.step >= d.steps.length) {
      this.state = 'done'; this.done.push(d.id);
      this.game.player.cash += d.pay;
      this.game.audio.cash();
      this.banner = `Job done: +$${d.pay}`; this.bannerT = 3.5;
      this.showDialogue(d.id === 'm5' ? 'Mara: "The bay is ours, Reno. Drinks at the Velero — on the house."' :
        'Mara: "Clean work. Come see me when you want more."', 6);
      this.index++;
      if (this.def) this.state = 'offer';
    }
  }
  update(dt) {
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.dialogueT > 0) this.dialogueT -= dt;
    const g = this.game, p = g.player, w = g.wanted;
    if (this.side) { this.updateSide(dt); return; }
    if (this.state !== 'active' || !this.def) return;
    const s = this.def.steps[this.step];
    if (!s) return;
    const d = Math.hypot(p.x - (s.x || 0), p.z - (s.z || 0));
    switch (s.kind) {
      case 'goto': if (d < 26 && (!s.inCar || p.car)) this.advance(); break;
      case 'steal': if (this.steals > (this.stealsAtStart || 0)) this.advance(); break;
      case 'stand':
        if (d < 30) { this.standT += dt; if (this.standT >= s.t) { w.addCrime('robbery', p.x, p.z); this.advance(); } }
        else this.standT = Math.max(0, this.standT - dt);
        break;
      case 'heat': if (w.stars >= s.minStars) this.advance(); break;
      case 'heatstep':
        // heat must have arrived and then been shaken off: COOLDOWN is
        // the wanted state right after SEARCH ends — heat is leaving.
        if (w.state === 'COOLDOWN') this.advance();
        break;
      case 'fight':
        if (!this._spawned) {
          this._spawned = true; this.kills = 0;
          g.combat.cityRef = g.city;
          g.combat.spawnEnemies(s.x, s.z, s.count, s.king ? 'king' : 'gang');
        }
        if (this.kills >= s.count) { this._spawned = false; this.advance(); }
        break;
    }
  }
  // --- side jobs (repeatable) ---
  startSide() {
    const g = this.game;
    this.sideN++;
    const kind = ['chop', 'delivery', 'taxi'][this.sideN % 3];
    if (kind === 'chop') {
      const target = g.city.parked[Math.floor(Math.random() * g.city.parked.length)];
      this.side = { kind, stage: 'goto', label: 'Steal the marked car', x: target.x, z: target.z, carRef: target,
        dx: GARAGE.x, dz: GARAGE.z, pay: 350 };
    } else if (kind === 'delivery') {
      this.side = { kind, stage: 'goto', label: 'Pick up the package at the market', x: MARKET.x, z: MARKET.z,
        dx: TOWER.x, dz: TOWER.z, pay: 300 };
    } else {
      this.side = { kind, stage: 'goto', label: 'Pick up the fare downtown', x: 120, z: -40,
        dx: CLUB.x, dz: CLUB.z, pay: 280 };
    }
    this.showDialogue(`Side job: ${this.side.label}. Pay $${this.side.pay}.`, 5);
  }
  updateSide(dt) {
    const g = this.game, p = g.player;
    const s = this.side;
    if (s.stage === 'goto') {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < 26) {
        if (s.kind === 'chop' && !p.car) { this.showDialogue('You need the car — get in it.', 2); return; }
        s.stage = 'deliver';
        s.label = s.kind === 'chop' ? 'Deliver the car to Taller Voss' :
          s.kind === 'delivery' ? 'Deliver the package to Solano Tower' : 'Drop the fare at Club Velero';
      }
    } else if (s.stage === 'deliver') {
      const d = Math.hypot(p.x - s.dx, p.z - s.dz);
      if (d < 30 && (!s.kind || s.kind !== 'chop' || p.car)) {
        p.cash += s.pay; g.audio.cash();
        this.banner = `Side job done: +$${s.pay}`; this.bannerT = 3;
        this.side = null;
      }
    }
  }
  serialize() { return { index: this.index, done: this.done, sideN: this.sideN }; }
  deserialize(d) {
    if (!d) return;
    this.index = d.index || 0; this.done = d.done || []; this.sideN = d.sideN || 0;
    this.state = this.def ? 'offer' : 'done';
  }
}
STORY.missions = DEFS.map(d => d.title);
