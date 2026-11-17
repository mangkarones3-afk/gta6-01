// main.js — boot and the game loop. One job: build the state, wire the
// systems together, and run frames (title → play → dead → respawn).

import { buildCity, districtAt } from './city.js';
import { createPlayer, updatePlayer, tryEnterExit, damagePlayer } from './player.js';
import { seedTraffic, seedParked, updateTraffic } from './traffic.js';
import { seedPeds, updatePeds } from './pedestrians.js';
import { createWanted, updateWanted, addHeat } from './wanted.js';
import { updateCombat, reload } from './combat.js';
import { createMission, startStory, startSide, updateMissions } from './missions.js';
import { createAudio } from './audio.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { createInput, updateMouseWorld } from './input.js';
import { drawWorld } from './render.js';
import { drawHud, drawTitle } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const CW = canvas.width, CH = canvas.height;

const city = buildCity();
const saved = loadSave();

const S = {
  city, time: 0, mode: 'title', frozen: false, camLock: null,
  cam: { x: city.spawn.x, y: city.spawn.y, viewW: 250 },
  player: createPlayer(city),
  cars: [], peds: [], bullets: [], particles: [],
  wanted: createWanted(), mission: createMission(),
  dialogue: null, dispatch: null, toast: null,
  danger: { x: -9999, y: -9999 }, shake: 0, flashRed: 0, deadT: 0,
  districtName: 'Playa', hasSave: !!saved,
  audio: createAudio(), input: null, mouse: null,
  wantedAPI: { addHeat }, saveGame,
  districtAt: (x, y) => districtAt(city, x, y).name,
};
S.cars.push(...seedTraffic(city, 26), ...seedParked(city, 14));
S.peds.push(...seedPeds(city, 42));
S.input = createInput(canvas);
S.mouse = S.input.mouse;
window.__sb = S; // staging + test hook (the shots module and QA drive this)

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) applyShot(S, shot);

function startRun(fresh) {
  if (fresh) clearSave();
  const sv = fresh ? null : loadSave();
  if (sv) {
    S.player.cash = sv.cash;
    S.player.hp = Math.max(40, sv.hp);
    S.player.x = sv.x; S.player.y = sv.y;
    startStory(S, Math.min(4, sv.missionIdx));
  } else {
    startStory(S, 0);
  }
  S.mode = 'play';
  S.audio.unlock();
}

function respawn() {
  const P = S.player;
  P.dead = false; P.hp = 100; P.car = null;
  P.x = S.city.spawn.x; P.y = S.city.spawn.y;
  P.cash = Math.max(0, P.cash - Math.floor(P.cash * 0.08));
  S.wanted.heat = 0; S.wanted.stars = 0; S.wanted.phase = 'clear';
  S.cars = S.cars.filter(c => c.kind !== 'cop');
  S.wanted.roadblocks = [];
  S.mode = 'play';
  S.toast = { text: 'PATCHED UP — THE BAY GOES ON', until: S.time + 3 };
  saveGame(S);
}

function handlePressed() {
  const pr = S.input.pressed;
  if (S.mode === 'title') {
    if (pr.has('Enter')) startRun(false);
    if (pr.has('KeyN')) startRun(true);
    pr.clear(); return;
  }
  if (S.mode === 'dead') {
    if (pr.has('Enter')) respawn();
    pr.clear(); return;
  }
  if (pr.has('KeyE')) tryEnterExit(S);
  if (pr.has('KeyR')) reload(S);
  if (pr.has('Digit1')) S.player.weapon = 0;
  if (pr.has('Digit2')) S.player.weapon = 1;
  if (pr.has('Digit3')) S.player.weapon = 2;
  if (pr.has('KeyJ')) startSide(S);
  if (pr.has('KeyP')) S.audio.toggleMute();
  pr.clear();
}

let last = performance.now(), saveT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handlePressed();
  updateMouseWorld(S.input, S.cam, CW, CH);

  if (S.mode === 'play' && !S.frozen) {
    S.time += dt;
    updatePlayer(S, dt);
    updateTraffic(S, dt);
    updatePeds(S, dt);
    updateWanted(S, dt);
    updateCombat(S, dt);
    updateMissions(S, dt);
    S.audio.update(S);
    if (!S.player.car) S.audio.engineOff();
    S.districtName = districtAt(city, S.player.x, S.player.y).name;
    saveT += dt;
    if (saveT > 6) { saveT = 0; saveGame(S); }
  }
  if (S.mode === 'dead') S.deadT += dt;

  drawWorld(ctx, S, CW, CH);
  if (S.mode === 'title') drawTitle(ctx, S, CW, CH);
  else {
    drawHud(ctx, S, CW, CH);
    if (S.mode === 'dead') {
      ctx.fillStyle = 'rgba(20,4,8,0.62)'; ctx.fillRect(0, 0, CW, CH);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff5040'; ctx.font = '900 54px system-ui, sans-serif';
      ctx.fillText('WASTED', CW / 2, CH * 0.42);
      ctx.fillStyle = '#ffe9c4'; ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillText('The bay patches Reno up. The debt, and the day, go on.', CW / 2, CH * 0.42 + 46);
      ctx.fillText('ENTER — wake up at Playa (8% hospital fee)', CW / 2, CH * 0.42 + 76);
    }
  }
}
requestAnimationFrame(frame);
