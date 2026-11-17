// shots.js — deterministic screenshot staging, driven by ?shot=N.
// Each frame is composed against the Phase 2 study's rules: the cover
// is a legible police box-in at named POIs under the tower (F1), the
// camera sits at the tightened gameplay zoom (F2), the grade is the
// saturated sunset (F3), signage fills the frame (F4), the minimap is
// populated (F5) and the HUD shows MISSION n/5 (F6).
import { makeCar } from './traffic.js';

export function shotIndex() {
  const m = /[?&]shot=(\d)/.exec(location.search);
  return m ? parseInt(m[1], 10) : 0;
}

function pinCamera(game) {
  const r = game.renderer;
  const o = game.__camOverride;
  r.cam.x = o ? o.x : game.player.x; r.cam.z = o ? o.z : game.player.z;
  r.cam.scale = game.player.onFoot ? 5.6 : 4.6;
  r.time = 2.4;
}

function addPed(game, x, z, shirt) {
  game.peds.list.push({ id: 900 + game.peds.list.length, x, z, edge: 0, t: 0, dir: 1, side: 1,
    speed: 0, shirt, state: 'walk', fleeT: 0, phase: 1.3 });
}

function setMission(game, index, step) {
  game.missions.index = index;
  game.missions.state = 'active';
  game.missions.step = step;
  game.missions.done = ['m1', 'm2', 'm3', 'm4'].slice(0, index);
}

export function stageShot(game, n) {
  const p = game.player, w = game.wanted;
  document.getElementById('start-screen').style.display = 'none';
  if (n === 1) {
    // COVER — the box-in on the downtown arterial (the z=4 road, probed
    // against the real graph: verticals x=1/98, horizontals z=4/95).
    // The hero car sits ON the road between Banco del Sol and Cine
    // Solano; camera (50,9) keeps all four POI signs + the tower's gold
    // name board clear of the HUD strips (F1/F4/F7).
    const car = makeCar('muscle', 50, 4, -0.15, '#f59e0b');
    car.speed = 14;
    p.car = car; p.onFoot = false; p.x = car.x; p.z = car.z; p.angle = car.angle;
    w.heat = 300; w.stars = 4; w.state = 'ACTIVE'; w.spotted = true;
    w.districtName = 'Downtown';
    // No dispatch ticker in this frame: its bar would sit exactly over
    // Solano Tower's gold name board at the top of the frame.
    const facePlayer = (x, z) => Math.atan2(p.z - z, p.x - x);
    const copA = makeCar('police', 95, 2, facePlayer(95, 2)); copA.speed = 6;
    const copB = makeCar('police', 100, 42, facePlayer(100, 42)); copB.speed = 6;
    const copC = makeCar('police', 2, 6, facePlayer(2, 6)); copC.speed = 10;
    w.cops = [copA, copB, copC];
    w.roadblock = { x: 152, z: 4, t: 25 };
    setMission(game, 1, 2); // MISSION 2/5, escaping the bank job's heat
    game.missions.dialogue = 'Mara: "Clean work in there. Now lose them, Reno."';
    game.missions.dialogueT = 99;
    addPed(game, 86, -13, '#2e6da8'); addPed(game, 108, -12, '#e8a317');
    addPed(game, 60, 84, '#3f8a52');
    game.traffic.spawnNear(p.x, p.z, 6);
    game.__camOverride = { x: 50, z: 9 };
  } else if (n === 2) {
    // On foot in Palmera Park — the close frame (F2), rivals in view.
    p.x = 232; p.z = 158; p.angle = 0.5; p.onFoot = true; p.car = null;
    w.districtName = 'Downtown';
    setMission(game, 3, 0); // MISSION 4/5
    game.combat.cityRef = game.city;
    game.combat.spawnEnemies(268, 128, 2, 'gang');
    addPed(game, 218, 138, '#e8e4da'); addPed(game, 252, 176, '#b83a2a');
    addPed(game, 205, 168, '#2c2c34');
    game.traffic.spawnNear(p.x, p.z, 5);
  } else if (n === 3) {
    // Golden hour on the pier — the marina, boats, the bay.
    p.x = -716; p.z = 156; p.angle = Math.PI; p.onFoot = true; p.car = null;
    w.districtName = 'Marina';
    game.missions.index = 4; game.missions.state = 'offer';
    game.missions.done = ['m1', 'm2', 'm3', 'm4'];
    addPed(game, -660, 172, '#7a4a96'); addPed(game, -700, 182, '#e8a317');
    game.traffic.spawnNear(p.x, p.z, 4);
  } else if (n === 4) {
    // The boulevard chase — three stars up the beachfront. The
    // boulevard arterial is at x=-620 (probed); both units sit in its
    // lanes, right on the player's tail.
    const car = makeCar('muscle', -620, -95, -Math.PI / 2, '#274b8f');
    car.speed = 30;
    p.car = car; p.onFoot = false; p.x = car.x; p.z = car.z; p.angle = car.angle;
    w.heat = 190; w.stars = 3; w.state = 'ACTIVE'; w.spotted = true;
    w.districtName = 'Beachfront';
    w.dispatch = 'Dispatch: suspect fleeing north on the boulevard.';
    const copA = makeCar('police', -625, -42, -Math.PI / 2); copA.speed = 28;
    const copB = makeCar('police', -614, -60, -Math.PI / 2); copB.speed = 27;
    w.cops = [copA, copB];
    setMission(game, 2, 1); // MISSION 3/5, raising the heat
    game.traffic.spawnNear(p.x, p.z, 6);
    addPed(game, -606, -20, '#c97f4a');
    game.__camOverride = { x: -625, z: -75 };
  }
  pinCamera(game);
  game.renderer.draw(game, 0.016);
  game.hud.update(game, 0);
  window.__shotReady = true;
}
