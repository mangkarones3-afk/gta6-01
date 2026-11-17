// main.js — assembles the game and runs the loop.
// Order per frame: input -> player -> traffic -> peds -> wanted ->
// combat -> missions -> render -> HUD -> audio -> save.
import { CARS, WORLD } from './config.js';
import { generateCity, districtAt } from './city.js';
import { Renderer } from './render.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Wanted } from './wanted.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { loadSave, storeSave } from './save.js';
import { shotIndex, stageShot } from './shots.js';

const TITLE = { downtown: 'Downtown', marina: 'Marina', oldtown: 'Old Town',
  harbor: 'Harbor', beachfront: 'Beachfront', hills: 'The Hills' };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.city = generateCity();
    this.renderer = new Renderer(canvas);
    this.renderer.resize(1280, 800);
    this.traffic = new Traffic(this.city);
    this.peds = new Pedestrians(this.city);
    this.player = new Player(this.city);
    this.wanted = new Wanted(this.city);
    this.combat = new Combat();
    this.combat.cityRef = this.city;
    this.missions = new Missions(this);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    this.CARS = CARS;
    this.mode = 'title';
    this.time = 0; this.saveT = 0; this.districtT = 0;
    this.overlay = document.getElementById('wasted');
    // restore save
    const save = loadSave();
    if (save) {
      this.player.cash = save.cash || 250;
      this.player.stolenCount = save.stolen || 0;
      this.missions.deserialize(save.missions);
      if (save.stats) this.wanted.stats = save.stats;
    }
    this.wanted.onStar = () => this.audio.sirenBlip();
    const start = () => {
      if (this.mode === 'title') {
        this.mode = 'play';
        document.getElementById('start-screen').style.display = 'none';
        this.audio.init();
      }
    };
    document.getElementById('start-screen').addEventListener('click', start);
    window.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
  }
  start() {
    const shot = shotIndex();
    if (shot >= 1 && shot <= 4) {
      this.mode = 'shot';
      stageShot(this, shot);
      return;
    }
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (this.mode === 'play') this.update(dt);
      this.renderer.draw(this, dt);
      this.hud.update(this, dt);
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  endRun(text) {
    this.overlay.querySelector('span').textContent = text;
    this.overlay.style.display = 'flex';
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.player.respawn();
      this.wanted.heat = 0; this.wanted.stars = 0; this.wanted.state = 'CALM';
      this.wanted.cops = []; this.wanted.footCops = []; this.wanted.bust = 0;
      this.player.cash = Math.max(0, this.player.cash - 150);
      storeSave(this);
    }, 2200);
  }
  update(dt) {
    const g = this, p = g.player, inp = g.input;
    g.time += dt;
    if (p.dead) return;
    // mission + side-job keys
    if (inp.hit('m') && g.missions.state === 'offer' && g.missions.def) g.missions.start();
    if (inp.hit('j') && !g.missions.side) g.missions.startSide();
    if (inp.hit('n')) { try { localStorage.removeItem('solano-bay-save-v1'); } catch (e) {} location.reload(); }
    if (inp.hit('p')) g.audio.toggleMute();
    // combat keys
    if (inp.hit('1')) g.combat.weapon = 'pistol';
    if (inp.hit('2')) g.combat.weapon = 'smg';
    if (inp.hit('3')) g.combat.weapon = 'shotgun';
    if (inp.hit('r')) g.combat.reload();
    // aim + fire on foot
    if (p.onFoot) {
      const cx = g.canvas.width / 2, cy = g.canvas.height / 2;
      p.aim = Math.atan2(inp.mouse.y - cy, inp.mouse.x - cx);
      if (inp.mouse.down && g.combat.cool <= 0) {
        if (g.combat.fire(p.x, p.z, p.aim)) {
          g.audio.shot(g.combat.weapon);
          g.wanted.addCrime('gunfire', p.x, p.z);
          g.renderer.burst(p.x + Math.cos(p.aim) * 14, p.z + Math.sin(p.aim) * 14, '#ffd98a', 2);
        } else if (g.combat.mag <= 0) g.combat.reload();
      }
    }
    p.update(dt, inp, g.traffic, g.wanted, g.missions, g.combat, g.audio);
    const policeNear = g.wanted.cops.length ? g.wanted.cops[0] : null;
    g.traffic.update(dt, p, policeNear);
    const threats = [];
    if (g.combat.muzzle > 0) threats.push({ x: p.x, z: p.z, r: 90 });
    if (p.car && Math.abs(p.car.speed) > 20) threats.push({ x: p.x, z: p.z, r: 42 });
    g.peds.update(dt, p, threats);
    const bustResult = g.wanted.update(dt, g.time, p, g.peds);
    g.combat.update(dt, p, g.city, g.wanted, () => g.missions.registerKill());
    g.missions.update(dt);
    g.audio.setSiren(g.wanted.cops.length > 0 && g.wanted.stars > 0);
    if (!p.car) g.audio.setEngine(0, false);
    // district name for dispatch + minimap
    g.districtT -= dt;
    if (g.districtT <= 0) {
      g.districtT = 0.5;
      g.wanted.districtName = TITLE[districtAt(g.city, p.x, p.z)] || 'Downtown';
    }
    // death / bust
    if (p.dead) { g.endRun('WASTED'); }
    else if (bustResult === 'BUSTED') { p.dead = true; g.endRun('BUSTED'); }
    // periodic save
    g.saveT -= dt;
    if (g.saveT <= 0) { g.saveT = 5; storeSave(g); }
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;
game.start();
