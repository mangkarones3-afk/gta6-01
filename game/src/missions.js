// missions.js — Mara Voss's jobs. One job: run the five-mission story arc
// (and three repeatable side jobs) as staged objectives with dialogue,
// scripted heat, and exact cash payouts.

import { burst } from './combat.js';

export const STORY_COUNT = 5;
const PAYOUTS = [400, 500, 1000, 1200, 1900]; // sums to the $5,000 debt

export function say(S, name, lines, dur = 6.5) {
  S.dialogue = { name, lines, until: S.time + dur };
}

function poi(S, id) { return S.city.pois.find(p => p.id === id); }
function near(S, x, y, r) { return Math.hypot(S.player.x - x, S.player.y - y) < r; }

export function createMission() {
  return {
    idx: -1, side: false, name: '', stage: '', objective: null,
    markedCar: null, data: {}, onSteal: null, done: false,
  };
}

function setObjective(S, x, y, label) { S.mission.objective = { x, y, label }; }

function pay(S, amount, label) {
  S.player.cash += amount;
  S.toast = { text: `${label}  +$${amount}`, until: S.time + 3.2 };
  if (S.audio) S.audio.cash();
}

// ---------- story missions ----------

export function startStory(S, idx) {
  const M = S.mission;
  Object.assign(M, { idx, side: false, done: false, markedCar: null, data: {}, onSteal: null });
  const P = S.player;
  if (idx === 0) {
    M.name = 'First Wheels';
    M.stage = 'steal';
    say(S, 'Mara Voss', [
      'Reno. You owe me five grand, so you work. Simple.',
      'An amber coupe near Mercado Central is marked. Take it — quiet hands, fast feet.',
      'Drop it at Taller Brisa in Alto. Do not scratch the paint.',
    ], 9);
    // mark the parked car nearest the market
    const mk = poi(S, 'mercado-central');
    let best = null, bd = 1e9;
    for (const c of S.cars) {
      if (c.kind !== 'parked') continue;
      const d = Math.hypot(c.x - mk.x, c.y - mk.y);
      if (d < bd) { bd = d; best = c; }
    }
    best.marked = true; best.color = '#ffb020'; best.roof = '#3a2a10';
    M.markedCar = best;
    setObjective(S, best.x, best.y, 'Steal the amber coupe');
    M.onSteal = (st, car) => {
      if (car !== M.markedCar || M.stage !== 'steal') return;
      M.stage = 'deliver';
      st.wantedAPI.addHeat(st, 45, 'STOLEN COUPE SPOTTED');
      const t = poi(st, 'taller-brisa');
      setObjective(st, t.x, t.y, 'Deliver the coupe to Taller Brisa');
      say(st, 'Mara Voss', ['That alarm is not my problem. Drive, Reno. Alto, now.'], 5);
    };
  } else if (idx === 1) {
    M.name = 'Cobro Pendiente';
    M.stage = 'goto';
    say(S, 'Mara Voss', [
      'A stallholder at the Mercado owes us and sent muscle instead of money.',
      'Collect what is ours. However you need to.',
    ], 8);
    const mk = poi(S, 'mercado-central');
    setObjective(S, mk.x, mk.y, 'Go to Mercado Central');
  } else if (idx === 2) {
    M.name = 'Hot Pickup';
    M.stage = 'goto';
    say(S, 'Mara Voss', [
      'Almacén Gris, down by the Marina. A package is waiting and nobody can know.',
      'Whatever happens — lose the police BEFORE you come back to me.',
    ], 8);
    const w = poi(S, 'almacen-gris');
    setObjective(S, w.x, w.y, 'Pick up at Almacén Gris');
  } else if (idx === 3) {
    M.name = 'Palmera Heat';
    M.stage = 'goto';
    say(S, 'Mara Voss', [
      'A courier waits at Mirador Café with my ledger. Her rivals know it.',
      'Bring her across Palmera Park to the pond. Keep her breathing.',
    ], 8);
    const c = poi(S, 'mirador-cafe');
    setObjective(S, c.x, c.y, 'Meet the courier at Mirador Café');
  } else if (idx === 4) {
    M.name = 'The Paloma Run';
    M.stage = 'steal';
    say(S, 'Mara Voss', [
      'Last one, Reno. A guest at Hotel Paloma leaves a very fast car unattended.',
      'Take it to the Marina Club pier. Then we are square — all five grand.',
    ], 8.5);
    const h = poi(S, 'hotel-paloma');
    let best = null, bd = 1e9;
    for (const c of S.cars) {
      if (c.kind !== 'parked') continue;
      const d = Math.hypot(c.x - h.x, c.y - h.y);
      if (d < bd) { bd = d; best = c; }
    }
    best.marked = true; best.color = '#e33f2e'; best.roof = '#20242e';
    M.markedCar = best;
    setObjective(S, best.x, best.y, 'Steal the red coupe at Hotel Paloma');
    M.onSteal = (st, car) => {
      if (car !== M.markedCar || M.stage !== 'steal') return;
      M.stage = 'deliver';
      st.wantedAPI.addHeat(st, 60, 'PALOMA COUPE TAKEN');
      const mc = poi(st, 'marina-club');
      setObjective(st, mc.x, mc.y, 'Deliver to Marina Club, on the pier');
    };
  }
}

function completeStory(S) {
  const M = S.mission;
  pay(S, PAYOUTS[M.idx], 'JOB DONE');
  const next = M.idx + 1;
  M.objective = null; M.onSteal = null; M.markedCar = null;
  if (next < STORY_COUNT) {
    S.toast = { text: `DEBT LEFT: $${5000 - PAYOUTS.slice(0, next).reduce((a, b) => a + b, 0)}`, until: S.time + 3.4 };
    startStory(S, next);
  } else {
    M.done = true; M.idx = STORY_COUNT;
    S.toast = { text: 'DEBT CLEARED — SOLANO BAY IS YOURS', until: S.time + 5 };
    say(S, 'Mara Voss', ['Square, Reno. All five grand. The bay is yours now — try not to owe me again.'], 7);
  }
  if (S.saveGame) S.saveGame(S);
}

// ---------- side jobs ----------

const SIDE_DEFS = [
  { name: 'Quayside Parcel', pay: 150, from: 'marina-club', to: 'farmacia-luz', verb: 'Take the parcel to Farmacia Luz' },
  { name: 'Market Run', pay: 170, from: 'mercado-central', to: 'hotel-paloma', verb: 'Take the goods to Hotel Paloma' },
  { name: 'Café Drop', pay: 130, from: 'cine-solano', to: 'mirador-cafe', verb: 'Take the envelope to Mirador Café' },
];

export function startSide(S) {
  const M = S.mission;
  if (M.objective && !M.side) return; // story first
  const def = SIDE_DEFS[Math.floor(Math.random() * SIDE_DEFS.length)];
  Object.assign(M, { side: true, name: def.name, stage: 'pickup', done: false, data: { def }, onSteal: null, markedCar: null });
  const f = poi(S, def.from);
  setObjective(S, f.x, f.y, 'Pick up at ' + f.name);
  say(S, 'Mara Voss', [`Quick favour, off the books: ${def.name.toLowerCase()}. Pays $${def.pay}.`], 5.5);
}

function completeSide(S) {
  const M = S.mission;
  pay(S, M.data.def.pay, 'SIDE JOB DONE');
  M.objective = null; M.side = false;
  // hand the story thread back
  if (!M.done && M.idx >= 0 && M.idx < STORY_COUNT) startStory(S, M.idx);
}

// ---------- per-frame ----------

export function updateMissions(S, dt) {
  const M = S.mission;
  if (!M.objective || S.player.dead) return;
  const o = M.objective;

  if (M.side) {
    if (M.stage === 'pickup' && near(S, o.x, o.y, 30)) {
      M.stage = 'deliver';
      const t = poi(S, M.data.def.to);
      setObjective(S, t.x, t.y, M.data.def.verb);
      burst(S, S.player.x, S.player.y, '#ffd76a', 8, 40);
    } else if (M.stage === 'deliver' && near(S, o.x, o.y, 32)) completeSide(S);
    return;
  }

  switch (M.idx) {
    case 0:
      if (M.stage === 'deliver' && S.player.car === M.markedCar && near(S, o.x, o.y, 40)) completeStory(S);
      break;
    case 1: {
      if (M.stage === 'goto' && near(S, o.x, o.y, 34)) {
        M.stage = 'muscle';
        const mk = poi(S, 'mercado-central');
        const thug = S.peds.find(p => !p.dead && !p.hostile && Math.hypot(p.x - mk.x, p.y - mk.y) > 60)
          || S.peds.find(p => !p.dead && !p.hostile);
        if (thug) { thug.hostile = true; thug.hp = 46; thug.color = '#20242e'; M.data.thug = thug; }
        setObjective(S, thug ? thug.x : mk.x, thug ? thug.y : mk.y, 'Deal with the muscle');
        say(S, 'Mara Voss', ['That is him. Collect, Reno.'], 4);
      } else if (M.stage === 'muscle') {
        const t = M.data.thug;
        if (t) setObjective(S, t.x, t.y, 'Deal with the muscle');
        if (!t || t.dead) {
          M.stage = 'collect';
          const mk = poi(S, 'mercado-central');
          setObjective(S, mk.x, mk.y, 'Collect the payment');
        }
      } else if (M.stage === 'collect' && near(S, o.x, o.y, 30)) completeStory(S);
      break;
    }
    case 2:
      if (M.stage === 'goto' && near(S, o.x, o.y, 34)) {
        M.stage = 'escape';
        S.wantedAPI.addHeat(S, 210, 'WAREHOUSE ALARM');
        S.dispatch = { text: 'ALL UNITS — WAREHOUSE ON THE MARINA, MOVE', until: S.time + 4 };
        setObjective(S, S.player.x, S.player.y, 'Lose the SBPD');
        say(S, 'Mara Voss', ['You are lit up like a ferry, Reno. Vanish. THEN come to the Mercado.'], 6);
      } else if (M.stage === 'escape') {
        setObjective(S, S.player.x, S.player.y, 'Lose the SBPD');
        if (S.wanted.stars === 0 && S.wanted.phase === 'clear') {
          M.stage = 'plaza';
          const mk = poi(S, 'mercado-central');
          setObjective(S, mk.x, mk.y, 'Return to Mercado Central');
        }
      } else if (M.stage === 'plaza' && near(S, o.x, o.y, 36)) completeStory(S);
      break;
    case 3:
      if (M.stage === 'goto' && near(S, o.x, o.y, 32)) {
        M.stage = 'cross';
        const pond = S.city.pond;
        setObjective(S, pond.x, pond.y, 'Cross Palmera Park to the pond');
        // two rival crew wait in the park
        let spawned = 0;
        for (const p of S.peds) {
          if (spawned >= 2) break;
          if (p.dead || p.hostile) continue;
          if (Math.hypot(p.x - pond.x, p.y - pond.y) < 190) { p.hostile = true; p.hp = 46; p.color = '#20242e'; spawned++; }
        }
        say(S, 'Mara Voss', ['Rivals in the park, Reno. The pond — get her there.'], 5);
      } else if (M.stage === 'cross' && near(S, o.x, o.y, 40)) completeStory(S);
      break;
    case 4:
      if (M.stage === 'deliver' && S.player.car === M.markedCar && near(S, o.x, o.y, 44)) completeStory(S);
      break;
  }
}
