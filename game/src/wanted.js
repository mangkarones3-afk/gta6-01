// wanted.js — the crime-response loop: crime -> witness -> heat -> stars ->
// pursuit -> search -> cooldown -> clean. Heat is the only currency; stars
// are derived from it by threshold. Police spawn only out of view, navigate
// by the road graph to the player's last known position when line of sight
// breaks, and a completed evasion is always banked.

const SBWanted = (() => {
  const C = window.SBConfig;
  const City = window.SBCity;
  const R = window.SBRng;
  const rng = R.streamFor(C.seed, "wanted");
  const W = C.wanted;

  const S = {
    heat: 0, stars: 0, state: "CALM",
    cops: [], reports: [], recent: [],
    lkp: { x: 0, y: 0 }, lastSpottedAt: -99, spotted: false,
    searchT: 0, searchR: 30, spawnT: 0, floor: 0, cap: 5,
    bustMeter: 0, dispatch: { text: "", until: 0 },
    stats: { timesWanted: 0, escapes: 0, busts: 0, highest: 0 },
  };

  function losClear(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(d / 3));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (City.buildingHit(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, -0.2)) return false;
    }
    return true;
  }

  function starsFor(heat) {
    let s = 0;
    for (let i = 0; i < W.thresholds.length; i++) if (heat >= W.thresholds[i]) s = i + 1;
    return Math.min(s, S.cap);
  }

  function setDispatch(text, now) {
    S.dispatch = { text, until: now + 5 };
  }

  // The only way heat enters. Witness rules decide whether it lands at all.
  function addCrime(kind, x, y, world) {
    const amount = C.crimes[kind];
    if (amount === undefined) return;
    const now = world.time;
    // Deduplicate: one crime event = one award, however many saw it.
    for (const r of S.recent) {
      if (r.kind === kind && now - r.at < 4 && Math.hypot(r.x - x, r.y - y) < 25) return;
    }
    let witnessed = false, instant = false;
    for (const cop of S.cops) {
      if (Math.hypot(cop.x - x, cop.y - y) < 55 && losClear(cop.x, cop.y, x, y)) { witnessed = true; instant = true; break; }
    }
    if (!witnessed) {
      for (const p of world.peds) {
        if (Math.hypot(p.x - x, p.y - y) < 35 && losClear(p.x, p.y, x, y)) { witnessed = true; break; }
      }
    }
    if (!witnessed && (kind === "gunshot" || kind === "carDestroyed")) {
      for (const p of world.peds) {
        if (Math.hypot(p.x - x, p.y - y) < 60) { witnessed = true; break; }
      }
      for (const c of world.trafficCars) {
        if (Math.hypot(c.x - x, c.y - y) < 50) { witnessed = true; break; }
      }
    }
    if (!witnessed) return;
    S.recent.push({ kind, x, y, at: now });
    S.reports.push({ amount, at: now + (instant ? 0 : R.range(rng, 1.5, 3)) });
  }

  function applyHeat(amount, world) {
    const before = S.stars;
    S.heat = Math.min(500, S.heat + amount);
    if (S.floor > 0) S.heat = Math.max(S.heat, W.thresholds[S.floor - 1]);
    S.stars = starsFor(S.heat);
    if (S.stars > before) {
      if (before === 0) S.stats.timesWanted++;
      S.stats.highest = Math.max(S.stats.highest, S.stars);
      const d = City.districtAt(world.player.x, world.player.y);
      setDispatch("Dispatch: suspect in " + d.name + " — all units respond.", world.time);
      if (S.state === "CALM" || S.state === "COOLDOWN") {
        S.state = "ACTIVE";
        S.lkp = { x: world.player.x, y: world.player.y };
        S.lastSpottedAt = world.time;
      }
    }
  }

  function setFloor(n) {
    S.floor = n;
    if (n > 0) S.heat = Math.max(S.heat, W.thresholds[n - 1]);
    S.stars = Math.max(S.stars, starsFor(S.heat));
    if (S.stars > 0 && S.state === "CALM") S.state = "ACTIVE";
  }
  function clearFloor() { S.floor = 0; }
  function forceCooldown() {
    if (S.stars > 0) { S.state = "COOLDOWN"; }
  }

  function spawnPoint(world) {
    const anchor = S.state === "SEARCH" ? S.lkp : world.player;
    let fallback = null;
    for (let tries = 0; tries < 14; tries++) {
      const n = City.nodes[Math.floor(rng() * City.nodes.length)];
      const d = Math.hypot(n.x - anchor.x, n.y - anchor.y);
      if (d < 115 || d > 175) continue;
      const dp = Math.hypot(n.x - world.player.x, n.y - world.player.y);
      if (dp < 110) continue;
      if (dp < 185 && losClear(n.x, n.y, world.player.x, world.player.y)) {
        // In band but inside the player's view: not a fair spawn, yet worth
        // remembering — around open ground every in-band node can be
        // visible, and falling back to a seen spawn beats spawning nobody.
        if (!fallback) fallback = n;
        continue;
      }
      return n;
    }
    return fallback;
  }

  function spawnCop(world) {
    const node = spawnPoint(world);
    if (!node) return;
    const baseTop = world.playerCar ? world.playerCar.top : 38;
    const cop = SBVehicles.makeCar(node.x, node.y, rng() * Math.PI * 2, {
      archetype: 1, color: "#f4f6f8", police: true,
    });
    cop.top = Math.min(52, Math.max(30, baseTop * W.speedFactor[Math.max(1, S.stars)]));
    cop.mode = S.state === "SEARCH" ? "search" : "chase";
    cop.route = [];
    cop.routeT = 0;
    cop.stuckFor = 0;
    cop.reverseFor = 0;
    cop.searchNode = null;
    S.cops.push(cop);
    if (window.SBAudio) SBAudio.sirenBurst();
  }

  function driveCop(cop, dt, world) {
    const player = world.player;
    let tx, ty, arriveR = 7;
    if (cop.mode === "leave") {
      tx = cop.x + Math.cos(cop.heading) * 60;
      ty = cop.y + Math.sin(cop.heading) * 60;
    } else if (cop.mode === "search") {
      if (!cop.searchNode || Math.hypot(cop.searchNode.x - cop.x, cop.searchNode.y - cop.y) < 10) {
        const near = City.nodes.filter((n) => Math.hypot(n.x - S.lkp.x, n.y - S.lkp.y) < S.searchR);
        cop.searchNode = near.length ? near[Math.floor(rng() * near.length)] : City.nodes[City.nearestNode(cop.x, cop.y)];
        cop.route = City.route(City.nearestNode(cop.x, cop.y), cop.searchNode.id).map((id) => City.nodes[id]);
      }
      const wp = cop.route.length > 1 ? cop.route[1] : cop.searchNode;
      tx = wp.x; ty = wp.y;
    } else {
      // Chase: waypoint = next graph node toward the player, or the player
      // directly when line of sight is clear.
      cop.routeT -= dt;
      if (cop.routeT <= 0 || !cop.route || !cop.route.length) {
        cop.routeT = 1.4;
        cop.route = City.route(City.nearestNode(cop.x, cop.y), City.nearestNode(player.x, player.y)).map((id) => City.nodes[id]);
      }
      if (S.spotted || losClear(cop.x, cop.y, player.x, player.y)) { tx = player.x; ty = player.y; arriveR = 2.5; }
      else {
        const wp = cop.route.length > 1 ? cop.route[1] : cop.route[0];
        tx = wp.x; ty = wp.y;
      }
    }
    const want = Math.atan2(ty - cop.y, tx - cop.x);
    let diff = want - cop.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const speedCap = cop.mode === "search" ? 0.45 : 1;
    let throttle = Math.abs(diff) < 1.25 ? speedCap : 0.15;
    if (cop.reverseFor > 0) { cop.reverseFor -= dt; throttle = -1; }
    SBVehicles.stepCar(cop, { throttle, steer: Math.max(-1, Math.min(1, diff * 1.7)), handbrake: false }, dt);
    if (Math.abs(cop.velFwd) < 0.7 && throttle > 0) {
      cop.stuckFor += dt;
      if (cop.stuckFor > 2.4) { cop.reverseFor = 0.9; cop.stuckFor = 0; cop.routeT = 0; }
    } else cop.stuckFor = 0;
    // Progress-based stuck detection: grinding along a wall or pinned
    // against the player's car still counts as stuck — back out, re-route.
    cop.progT = (cop.progT || 0) + dt;
    if (cop.progT > 4) {
      const moved = cop.lastPX === undefined ? 99 : Math.hypot(cop.x - cop.lastPX, cop.y - cop.lastPY);
      if (moved < 3 && throttle > 0 && cop.mode !== "leave") {
        cop.reverseFor = 1.1;
        cop.routeT = 0;
        cop.searchNode = null;
      }
      cop.lastPX = cop.x; cop.lastPY = cop.y; cop.progT = 0;
    }
    void arriveR;
  }

  function update(dt, world) {
    const now = world.time;
    const player = world.player;
    // Pending witness reports land.
    for (let i = S.reports.length - 1; i >= 0; i--) {
      if (now >= S.reports[i].at) { applyHeat(S.reports[i].amount, world); S.reports.splice(i, 1); }
    }
    if (S.floor > 0 && S.heat < W.thresholds[S.floor - 1]) {
      S.heat = W.thresholds[S.floor - 1];
      S.stars = starsFor(S.heat);
    }
    // Perception: any cop with clear sight inside 55 m spots the player.
    S.spotted = false;
    for (const cop of S.cops) {
      if (cop.mode === "leave") continue;
      if (Math.hypot(cop.x - player.x, cop.y - player.y) < 55 && losClear(cop.x, cop.y, player.x, player.y)) {
        S.spotted = true;
        S.lkp = { x: player.x, y: player.y };
        S.lastSpottedAt = now;
      }
    }
    // State machine.
    if (S.stars > 0) {
      if (S.spotted && S.state !== "ACTIVE") {
        S.state = "ACTIVE";
        const d = City.districtAt(player.x, player.y);
        setDispatch("Dispatch: visual on the suspect in " + d.name + ".", now);
      } else if (S.state === "ACTIVE" && now - S.lastSpottedAt > W.loseSightDelay) {
        S.state = "SEARCH";
        S.searchT = W.searchTime[S.stars];
        S.searchR = 30;
        const d = City.districtAt(S.lkp.x, S.lkp.y);
        setDispatch("Dispatch: suspect last seen in " + d.name + " — sweep the area.", now);
        for (const cop of S.cops) { cop.mode = "search"; cop.searchNode = null; }
      } else if (S.state === "SEARCH") {
        S.searchR = Math.min(80 + S.stars * 16, 30 + (W.searchTime[S.stars] - S.searchT) * 8);
        const far = Math.hypot(player.x - S.lkp.x, player.y - S.lkp.y) > S.searchR + 60;
        S.searchT -= dt * (far ? 3 : 1);
        if (S.searchT <= 0) {
          S.state = "COOLDOWN";
          S.stats.escapes++;
          for (const cop of S.cops) cop.mode = "leave";
        }
      } else if (S.state === "COOLDOWN") {
        S.heat = Math.max(0, S.heat - W.decayPerSec * dt);
        S.stars = starsFor(S.heat);
        if (S.stars === 0) { S.state = "CALM"; S.heat = 0; }
      }
    }
    // Spawning trickle.
    const activeCops = S.cops.filter((c) => c.mode !== "leave").length;
    if ((S.state === "ACTIVE" || S.state === "SEARCH") && activeCops < W.carCap[S.stars]) {
      S.spawnT -= dt;
      if (S.spawnT <= 0) { spawnCop(world); S.spawnT = W.spawnInterval[Math.max(1, S.stars)]; }
    }
    // Drive and clean up.
    for (let i = S.cops.length - 1; i >= 0; i--) {
      const cop = S.cops[i];
      driveCop(cop, dt, world);
      const d = Math.hypot(cop.x - player.x, cop.y - player.y);
      if ((cop.mode === "leave" && d > 200) || d > 320 || cop.hp <= 0) {
        if (cop.hp <= 0) addCrime("carDestroyed", cop.x, cop.y, world);
        S.cops.splice(i, 1);
      }
    }
    // Bust: sustained proximity to a nearly stopped player.
    const slow = !world.playerCar || Math.abs(world.playerCar.velFwd) < 3;
    let near = false;
    if (S.stars > 0 && slow) {
      for (const cop of S.cops) {
        if (Math.hypot(cop.x - player.x, cop.y - player.y) < 3.4) { near = true; break; }
      }
    }
    if (near) {
      S.bustMeter += dt / 1.2;
      if (S.bustMeter >= 1) {
        S.bustMeter = 0;
        S.stats.busts++;
        world.onBusted();
      }
    } else {
      S.bustMeter = Math.max(0, S.bustMeter - dt * 3 / 1.2);
    }
  }

  function reset() {
    S.heat = 0; S.stars = 0; S.state = "CALM";
    S.cops = []; S.reports = []; S.recent = []; S.bustMeter = 0;
  }

  return { S, addCrime, update, setFloor, clearFloor, forceCooldown, reset, losClear };
})();

window.SBWanted = SBWanted;
