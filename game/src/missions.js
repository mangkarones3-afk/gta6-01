// missions.js — the five-mission story arc, its dialogue runtime, and two
// repeatable side jobs. Steps are data; this module owns progression,
// objective markers, wanted floors, timers and rewards. Busted or wasted
// mid-mission restarts the mission from its first step (floors released).

const SBMissions = (() => {
  const City = window.SBCity;
  const A = City.anchors;

  const LUCIA = "Lucía Ferrer";
  const MARCO = "Marco el Contable";

  const MISSIONS = [
    {
      title: "First Wheels",
      reward: 650,
      steps: [
        { type: "talk", at: A.cafeAlba, label: "Meet Lucía at Café Alba", speaker: LUCIA, lines: [
          "You must be Rocco. I hear you can drive and keep your mouth shut.",
          "Prove both. There's a Caspián parked by El Mercado with my name on the paperwork and someone else's plates on the bumper.",
          "Bring it to the Dockside lot. No scratches, no police. Solano Bay is watching.",
        ] },
        { type: "steal", at: { x: 1004, y: 328 }, label: "Steal the Caspián by El Mercado", car: { archetype: 1, color: "#b7950b", heading: 0 } },
        { type: "deliver", at: A.dockLot, label: "Deliver the car to the Dockside lot" },
      ],
      outro: [LUCIA, "Clean work. The Bay might have a place for you after all."],
    },
    {
      title: "Harbor Run",
      reward: 1150,
      steps: [
        { type: "talk", at: A.cafeAlba, label: "Meet Lucía at Café Alba", speaker: LUCIA, lines: [
          "Crates came in at Marina Dock this morning. Customs paperwork says 'machine parts'. It is not machine parts.",
          "Collect them and take them to Mercado Central. And Rocco — take this. The docks have been jumpy.",
        ], grant: "gun" },
        { type: "goto", at: A.marinaDock, label: "Collect the crates at Marina Dock", radius: 9 },
        { type: "deliver", at: A.mercado, label: "Deliver the crates to Mercado Central", floor: 2, anyCar: true },
      ],
      outro: [LUCIA, "The whole port heard that run. Good. Let them wonder."],
    },
    {
      title: "The Night Ledger",
      reward: 1600,
      steps: [
        { type: "talk", at: A.safehouse, label: "See Lucía at Taller Ferrer", speaker: LUCIA, lines: [
          "Marco keeps the family's second ledger in his car — a green Vireo, always parked by the clock tower in Puerto Viejo.",
          "He never locks it. Bring me the car, Rocco, not a scene.",
        ] },
        { type: "steal", at: { x: 332, y: 500 }, label: "Take Marco's Vireo by the clock tower", car: { archetype: 0, color: "#27ae60", heading: Math.PI / 2 } },
        { type: "deliver", at: A.safehouse, label: "Bring the Vireo to Taller Ferrer" },
      ],
      outro: [MARCO, "Tell Lucía the numbers were honest. Mostly."],
    },
    {
      title: "Serena Sprint",
      reward: 2150,
      steps: [
        { type: "talk", at: A.cafeAlba, label: "Meet Lucía at Café Alba", speaker: LUCIA, lines: [
          "A guest at Hotel Serena leaves on the evening tide and his luggage absolutely does not.",
          "Pick it up, then get it to the Dockside lot before the boat goes. Fast, Rocco. Invisible is optional this time.",
        ] },
        { type: "goto", at: A.hotelSerena, label: "Pick up the luggage at Hotel Serena", radius: 9 },
        { type: "timer", at: A.dockLot, label: "Reach the Dockside lot before the tide", seconds: 95, anyCar: true },
      ],
      outro: [LUCIA, "The tide waited. It does not do that for everyone."],
    },
    {
      title: "Bay Farewell",
      reward: 3000,
      steps: [
        { type: "talk", at: A.safehouse, label: "See Lucía at Taller Ferrer", speaker: LUCIA, lines: [
          "The ledger burned us. Every badge in Solano Bay has your face by now.",
          "There's a boat at the end of the Serena pier with a quiet captain. Say goodbye to the café, then run.",
          "Whatever happens — don't stop for the lights.",
        ] },
        { type: "goto", at: A.cafeAlba, label: "Say goodbye at Café Alba", radius: 7 },
        { type: "escape", at: A.pierBoat, label: "Reach the boat at the pier — RUN", floor: 3 },
      ],
      outro: [LUCIA, "Go, Rocco. Solano Bay keeps its own. We'll settle up when the water's calm."],
    },
  ];

  const S = {
    index: 0,          // next story mission to run
    step: 0,           // current step inside the active mission
    active: false,     // a story mission is in progress
    storyDone: false,
    dialogue: null,    // {speaker, lines, idx, onDone}
    markedCar: null,   // the car a steal/deliver step is about
    timer: 0,
    side: null,        // active side job {kind, phase, at, car, pay}
    message: "", messageUntil: 0,
  };

  function say(speaker, lines, onDone) {
    S.dialogue = { speaker, lines, idx: 0, onDone: onDone || null };
  }
  function advanceDialogue() {
    if (!S.dialogue) return false;
    S.dialogue.idx++;
    if (window.SBAudio) SBAudio.click();
    if (S.dialogue.idx >= S.dialogue.lines.length) {
      const cb = S.dialogue.onDone;
      S.dialogue = null;
      if (cb) cb();
    }
    return true;
  }

  function currentStep() {
    if (!S.active) return null;
    return MISSIONS[S.index].steps[S.step] || null;
  }

  function beginStep(world) {
    const st = currentStep();
    if (!st) return;
    if (st.floor) SBWanted.setFloor(st.floor);
    if (st.type === "steal") {
      const car = SBVehicles.makeCar(st.at.x, st.at.y, st.car.heading || 0, {
        archetype: st.car.archetype, color: st.car.color, parked: true,
      });
      car.parked = true;
      S.markedCar = car;
      world.extraCars.push(car);
    }
    if (st.type === "timer") S.timer = st.seconds;
  }

  function startMission(world) {
    if (S.index >= MISSIONS.length) { S.storyDone = true; return; }
    S.active = true;
    S.step = 0;
    beginStep(world);
  }

  function completeMission(world) {
    const m = MISSIONS[S.index];
    world.player.cash += m.reward;
    if (window.SBAudio) SBAudio.missionDone();
    S.active = false;
    S.markedCar = null;
    SBWanted.clearFloor();
    S.index++;
    if (S.index >= MISSIONS.length) S.storyDone = true;
    say(m.outro[0], [m.outro[1]], null);
    world.saveGame();
  }

  function nextStep(world) {
    const m = MISSIONS[S.index];
    const st = currentStep();
    if (st && st.floor && !(m.steps[S.step + 1] && m.steps[S.step + 1].floor)) SBWanted.clearFloor();
    S.step++;
    if (S.step >= m.steps.length) completeMission(world);
    else beginStep(world);
  }

  function failCurrent(world, why) {
    if (!S.active) return;
    SBWanted.clearFloor();
    if (S.markedCar) {
      const i = world.extraCars.indexOf(S.markedCar);
      if (i >= 0) world.extraCars.splice(i, 1);
      S.markedCar = null;
    }
    S.step = 0;
    S.message = why || "Mission failed — it starts over.";
    S.messageUntil = world.time + 4;
    beginStep(world);
  }

  function distTo(world, at) {
    return Math.hypot(world.player.x - at.x, world.player.y - at.y);
  }

  function update(dt, world) {
    if (S.dialogue) return;
    const st = currentStep();
    if (st) {
      if (st.type === "talk") {
        if (distTo(world, st.at) < 4.2 && !world.playerCar) {
          say(st.speaker, st.lines, () => {
            if (st.grant === "gun") { world.player.armed = true; S.message = "Lucía gave you a pistol. Click to shoot."; S.messageUntil = world.time + 4; }
            nextStep(world);
          });
        }
      } else if (st.type === "goto") {
        if (distTo(world, st.at) < (st.radius || 8)) nextStep(world);
      } else if (st.type === "steal") {
        if (world.playerCar && world.playerCar === S.markedCar) {
          S.markedCar.parked = false;
          nextStep(world);
        }
      } else if (st.type === "deliver") {
        const inCar = st.anyCar ? !!world.playerCar : (world.playerCar && world.playerCar === S.markedCar);
        if (inCar && distTo(world, st.at) < 12) nextStep(world);
      } else if (st.type === "timer") {
        S.timer -= dt;
        if (S.timer <= 0) { failCurrent(world, "Out of time — the tide did not wait."); return; }
        const inCar = st.anyCar ? !!world.playerCar : (world.playerCar && world.playerCar === S.markedCar);
        if (inCar && distTo(world, st.at) < 12) nextStep(world);
      } else if (st.type === "escape") {
        if (distTo(world, st.at) < 7) {
          SBWanted.clearFloor();
          SBWanted.S.heat = 0;
          SBWanted.S.stars = 0;
          for (const cop of SBWanted.S.cops) cop.mode = "leave";
          nextStep(world);
        }
      }
    }
    // Side job progression.
    if (S.side) {
      const job = S.side;
      if (job.kind === "courier") {
        if (distTo(world, job.at) < 8) finishSide(world);
      } else if (job.kind === "repo") {
        if (job.phase === "steal" && world.playerCar === job.car) job.phase = "deliver";
        else if (job.phase === "deliver" && world.playerCar === job.car && distTo(world, City.anchors.dockLot) < 10) finishSide(world);
      }
    }
  }

  function objective() {
    const st = currentStep();
    if (st) return { x: st.at.x, y: st.at.y, label: st.label, mission: true };
    if (S.side) {
      if (S.side.kind === "courier") return { x: S.side.at.x, y: S.side.at.y, label: "Courier: deliver the parcel", mission: false };
      if (S.side.phase === "steal") return { x: S.side.car.x, y: S.side.car.y, label: "Repo: take the marked car", mission: false };
      return { x: City.anchors.dockLot.x, y: City.anchors.dockLot.y, label: "Repo: deliver to Dockside", mission: false };
    }
    if (!S.storyDone && !S.active) {
      const m = MISSIONS[S.index];
      const first = m.steps[0];
      return { x: first.at.x, y: first.at.y, label: first.label, mission: true };
    }
    return null;
  }

  // Side jobs are offered at their anchors when no story mission is active.
  function offerAt(world) {
    if (S.active || S.side) return null;
    if (distTo(world, City.anchors.mercado) < 9) return "courier";
    if (distTo(world, City.anchors.dockLot) < 9) return "repo";
    return null;
  }

  function startSide(world, kind) {
    if (kind === "courier") {
      const signed = City.buildings.filter((b) => b.sign && b.district !== "dock");
      const b = signed[Math.floor(Math.random() * signed.length)];
      const at = { x: b.x, y: b.y + b.d / 2 + 4 };
      S.side = { kind, at, pay: 120 + Math.round(Math.hypot(at.x - world.player.x, at.y - world.player.y) / 8) };
      say("Mercado Dispatcher", ["Parcel for " + b.sign + ". Wheels up, friend — the clock is the customer's."], null);
    } else {
      const spots = [{ x: 420, y: 326 }, { x: 1120, y: 250 }, { x: 130, y: 588 }, { x: 700, y: 194 }];
      const spot = spots[Math.floor(Math.random() * spots.length)];
      const car = SBVehicles.makeCar(spot.x, spot.y, 0, { archetype: 2, color: "#8e44ad", parked: true });
      car.parked = true;
      world.extraCars.push(car);
      S.side = { kind, phase: "steal", car, pay: 260 };
      say("Dock Boss", ["A Meridian in purple, plates unpaid. Take it to the Dockside lot and it's our money."], null);
    }
  }

  function finishSide(world) {
    world.player.cash += S.side.pay;
    if (window.SBAudio) SBAudio.cash();
    S.message = "Side job done: +$" + S.side.pay;
    S.messageUntil = world.time + 3.5;
    if (S.side.car) {
      const i = world.extraCars.indexOf(S.side.car);
      if (i >= 0 && world.playerCar !== S.side.car) world.extraCars.splice(i, 1);
    }
    S.side = null;
    world.saveGame();
  }

  function counterText() {
    if (S.storyDone) return "STORY COMPLETE";
    return "MISSION " + Math.min(S.index + 1, MISSIONS.length) + "/" + MISSIONS.length;
  }

  function stepType() { const st = currentStep(); return st ? st.type : null; }

  return { MISSIONS, S, startMission, update, objective, offerAt, startSide, advanceDialogue, failCurrent, counterText, stepType };
})();

window.SBMissions = SBMissions;
