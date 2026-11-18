// main.js — the game loop and everything that ties the systems together:
// player on foot and in cars, camera, collisions, HUD, title screen, the
// sunset grade pass, screenshot staging hooks, and the window.SB test API
// the headless harness drives.

(() => {
  const C = window.SBConfig;
  const City = window.SBCity;
  const V = window.SBVehicles;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const VW = canvas.width, VH = canvas.height;

  const spawnAt = (a, back) => ({ x: a.x + (a.dx || 0) * back, y: a.y + (a.dy || 1) * back });
  const spawn0 = spawnAt(City.anchors.cafeAlba, 2.5);
  const player = {
    x: spawn0.x, y: spawn0.y,
    heading: -Math.PI / 2, health: 100, cash: 250, armed: false, lastHurtAt: -99,
  };

  const world = {
    time: 0,
    player,
    playerCar: null,
    extraCars: [],
    get peds() { return SBPedestrians.peds; },
    get trafficCars() { return V.traffic; },
    get wanted() { return SBWanted.S; },
    rng: Math.random,
    allCars() {
      return [...V.traffic, ...world.extraCars, ...SBWanted.S.cops];
    },
    onBusted() { respawn("BUSTED", "The SBPD took you in. Fine paid, car impounded, mission scrapped."); },
    onWasted() { respawn("WASTED", "You woke up outside Taller Ferrer. The Bay is not done with you."); },
    saveGame() {
      SBSave.write({
        nextMission: SBMissions.S.index,
        storyDone: SBMissions.S.storyDone,
        cash: player.cash, armed: player.armed,
        x: player.x, y: player.y,
        stats: SBWanted.S.stats,
      });
    },
  };

  // Parked cars from generation become real, stealable car objects.
  for (const p of City.parked) {
    const car = V.makeCar(p.x, p.y, p.heading, { archetype: p.archetype, color: p.color, parked: true });
    car.parked = true;
    world.extraCars.push(car);
  }

  let mode = "title"; // 'title' | 'play'
  let notice = "";
  let noticeUntil = 0;
  let grade = "sunset";
  const GRADES = {
    sunset: ["rgba(255,116,38,0.10)", "rgba(64,16,84,0.18)", 0.16],
    day: ["rgba(255,240,200,0.05)", "rgba(30,60,90,0.08)", 0.07],
    golden: ["rgba(255,150,40,0.16)", "rgba(90,30,10,0.14)", 0.12],
    dusk: ["rgba(70,60,160,0.14)", "rgba(10,8,40,0.30)", 0.26],
  };
  const cam = { x: player.x, y: player.y, scale: 4.4 };
  let timeScale = 1;

  function respawn(title, text) {
    const fine = Math.min(player.cash, 150);
    player.cash -= fine;
    player.health = 100;
    world.playerCar = null;
    player.x = City.anchors.safehouse.x + 3;
    player.y = City.anchors.safehouse.y + 6;
    SBWanted.reset();
    SBMissions.failCurrent(world, title + " — the mission starts over.");
    notice = text;
    noticeUntil = world.time + 4.5;
    world.saveGame();
  }

  // ---- player ----------------------------------------------------------
  function stepPlayerOnFoot(dt) {
    const ax = SBInput.axis();
    const sprint = SBInput.keys.has("ShiftLeft") || SBInput.keys.has("ShiftRight");
    const speed = sprint ? 6.4 : 4.2;
    if (ax.x !== 0 || ax.y !== 0) {
      const len = Math.hypot(ax.x, ax.y);
      const dx = (ax.x / len) * speed * dt, dy = (ax.y / len) * speed * dt;
      player.heading = Math.atan2(dy, dx);
      moveFoot(dx, 0);
      moveFoot(0, dy);
    }
  }
  function moveFoot(dx, dy) {
    const nx = player.x + dx, ny = player.y + dy;
    if (City.isWater(nx, ny) || !City.isLand(nx, ny)) return;
    if (City.buildingHit(nx, ny, 0.5)) return;
    player.x = nx; player.y = ny;
  }

  function nearestCar(maxD) {
    let best = null, bd = maxD;
    for (const car of world.allCars()) {
      if (car === world.playerCar) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    const ti = V.traffic.indexOf(car);
    if (ti >= 0) { V.traffic.splice(ti, 1); world.extraCars.push(car); }
    world.playerCar = car;
    car.parked = false;
    if (!car.everStolen) {
      car.everStolen = true;
      SBWanted.addCrime("theft", car.x, car.y, world);
    }
    if (window.SBAudio) SBAudio.click();
  }
  function exitCar() {
    const car = world.playerCar;
    if (!car) return;
    world.playerCar = null;
    player.x = car.x - Math.sin(car.heading) * 2.4;
    player.y = car.y + Math.cos(car.heading) * 2.4;
    if (City.buildingHit(player.x, player.y, 0.5) || City.isWater(player.x, player.y)) {
      player.x = car.x; player.y = car.y;
    }
    if (window.SBAudio) SBAudio.setEngine(false, 0);
  }

  function stepDriving(dt) {
    const car = world.playerCar;
    const ax = SBInput.axis();
    const input = {
      throttle: ax.y < 0 ? 1 : ax.y > 0 ? -1 : 0,
      steer: ax.x,
      handbrake: SBInput.keys.has("Space"),
    };
    const before = { x: car.x, y: car.y };
    V.stepCar(car, input, dt);
    player.x = car.x; player.y = car.y; player.heading = car.heading;
    // Hitting a pedestrian in the car is a crime, witnessed or not by luck.
    if (Math.abs(car.velFwd) > 2) {
      for (const p of world.peds) {
        if (p.down) continue;
        if (Math.hypot(p.x - car.x, p.y - car.y) < 1.6) {
          p.down = true; p.downFor = 7;
          p.hp = 0;
          SBWanted.addCrime(Math.abs(car.velFwd) > 9 ? "pedKill" : "pedHit", p.x, p.y, world);
          if (window.SBAudio) SBAudio.thud();
        }
      }
    }
    // Car-to-car contact: shove, damage, crimes.
    for (const other of world.allCars()) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 3.6 && d > 0.01) {
        const rel = Math.abs(car.velFwd - (other.velFwd || 0));
        const push = (3.6 - d) / 2;
        const ux = (other.x - car.x) / d, uy = (other.y - car.y) / d;
        const ti = V.traffic.indexOf(other);
        let carPush = push;
        if (ti >= 0) {
          // Traffic cars live in lane space: shove them along their lane
          // (and re-derive their pose) instead of treating them as walls.
          const along = ux * Math.cos(other.heading) + uy * Math.sin(other.heading);
          other.s += push * along * 2.2;
          const pose = City.lanePose(City.edges[other.edge], other.dir, other.lane, other.s);
          other.x = pose.x; other.y = pose.y;
        } else if (other.parked) {
          // A parked car is handbraked to the kerb: it does not move, the
          // moving car takes the whole push.
          carPush = push * 2;
        } else {
          other.x += ux * push; other.y += uy * push;
        }
        car.x -= ux * carPush; car.y -= uy * carPush;
        if (rel > 3) {
          other.hp -= rel * 2.2;
          car.hp -= rel * 1.2;
          if (window.SBAudio) SBAudio.thud();
          if (other.police) SBWanted.addCrime("copRam", other.x, other.y, world);
          else SBWanted.addCrime("collision", other.x, other.y, world);
          if (other.hp <= 0 && !other.dead) { other.dead = true; SBWanted.addCrime("carDestroyed", other.x, other.y, world); }
        }
        car.velFwd *= 0.72;
      }
    }
    void before;
    if (window.SBAudio) SBAudio.setEngine(true, Math.abs(car.velFwd) / car.top);
  }

  // ---- per-frame update --------------------------------------------------
  function update(dt) {
    world.time += dt;
    const inDialogue = !!SBMissions.S.dialogue;
    if (mode === "play" && !inDialogue) {
      if (world.playerCar) stepDriving(dt);
      else stepPlayerOnFoot(dt);
      // Enter / exit cars.
      if (SBInput.pressed.has("KeyE")) {
        if (world.playerCar) exitCar();
        else {
          const offer = SBMissions.offerAt(world);
          const car = nearestCar(3.4);
          if (offer && (!car || Math.hypot(player.x - City.anchors.mercado.x, player.y - City.anchors.mercado.y) < 9 || Math.hypot(player.x - City.anchors.dockLot.x, player.y - City.anchors.dockLot.y) < 9)) {
            SBMissions.startSide(world, offer);
          } else if (car) enterCar(car);
        }
      }
      // Combat: click shoots (armed) or punches; Space punches too.
      const clicked = SBInput.consumeClick();
      if (clicked || SBInput.pressed.has("Space")) {
        const mwx = cam.x + (SBInput.mouse.x - VW / 2) / cam.scale;
        const mwy = cam.y + (SBInput.mouse.y - VH / 2) / cam.scale;
        if (player.armed && clicked) SBCombat.shoot(world, mwx, mwy);
        else if (!world.playerCar) SBCombat.punch(world);
      }
      // Story auto-start: walking up to the giver opens the first talk.
      if (!SBMissions.S.active && !SBMissions.S.storyDone) {
        const first = SBMissions.MISSIONS[SBMissions.S.index].steps[0];
        if (!world.playerCar && Math.hypot(player.x - first.at.x, player.y - first.at.y) < 4.2) {
          SBMissions.startMission(world);
        }
      }
    }
    if (inDialogue && (SBInput.consumeAdvance() || SBInput.consumeClick())) {
      SBMissions.advanceDialogue();
    }
    if (SBInput.keys.has("KeyT") && !update.tHeld) {
      update.tHeld = true;
      const order = ["sunset", "day", "golden", "dusk"];
      grade = order[(order.indexOf(grade) + 1) % order.length];
    }
    if (!SBInput.keys.has("KeyT")) update.tHeld = false;

    V.stepTraffic(dt, world);
    SBPedestrians.stepPeds(dt, world);
    SBWanted.update(dt, world);
    SBCombat.update(dt, world);
    if (mode === "play") SBMissions.update(dt, world);
    if (window.SBAudio) SBAudio.setSiren(SBWanted.S.stars > 0 && mode === "play");

    // Camera follows the player; cars pull the view out with speed.
    const targetScale = world.playerCar
      ? 4.4 - Math.min(1.15, Math.abs(world.playerCar.velFwd) / world.playerCar.top) * 1.15
      : 4.4;
    cam.scale += (targetScale - cam.scale) * Math.min(1, dt * 2.2);
    const tx = mode === "title" ? 560 + Math.sin(world.time * 0.05) * 130 : player.x;
    const ty = mode === "title" ? 300 + Math.cos(world.time * 0.04) * 60 : player.y;
    cam.x += (tx - cam.x) * Math.min(1, dt * 3.2);
    cam.y += (ty - cam.y) * Math.min(1, dt * 3.2);
  }

  // ---- rendering ---------------------------------------------------------
  function applyGrade() {
    const [top, bottom, vig] = GRADES[grade];
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VH * 0.95);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(10,4,18," + vig + ")");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VW, VH);
  }

  function starPath(cx, cy, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) { ctx.fillStyle = "#ffd93d"; ctx.fill(); }
    ctx.strokeStyle = "#0c1016";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (!filled) { ctx.fillStyle = "rgba(20,24,32,0.55)"; ctx.fill(); }
  }

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = "rgba(10,14,20," + (alpha || 0.72) + ")";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
  }

  function drawHUD() {
    const W = SBWanted.S;
    // Top-left: mission counter, cash, health.
    panel(14, 12, 268, 86);
    ctx.fillStyle = "#ffd93d";
    ctx.font = "bold 19px Arial, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(SBMissions.counterText(), 26, 38);
    ctx.fillStyle = "#7bf1a8";
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("$" + player.cash.toLocaleString("en-US"), 26, 64);
    ctx.fillStyle = "#3a3f46";
    ctx.fillRect(128, 50, 132, 13);
    ctx.fillStyle = player.health > 30 ? "#51cf66" : "#ff6b6b";
    ctx.fillRect(128, 50, 132 * Math.max(0, player.health) / 100, 13);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10.5px Arial, sans-serif";
    ctx.fillText("HEALTH", 128, 47);
    if (player.armed) {
      ctx.fillStyle = "#e8ecf1";
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillText("PISTOL READY", 26, 88);
    }
    // Top-center: objective.
    const obj = SBMissions.objective();
    if (obj && mode === "play") {
      ctx.font = "bold 16.5px Arial, sans-serif";
      const w = Math.min(560, ctx.measureText(obj.label).width + 44);
      panel(VW / 2 - w / 2, 12, w, 40);
      ctx.fillStyle = "#ffe9a8";
      ctx.textAlign = "center";
      ctx.fillText(obj.label, VW / 2, 39);
      if (SBMissions.S.active && SBMissions.currentStepType === "timer") void 0;
    }
    if (SBMissions.S.active && SBMissions.S.timer > 0 && SBMissions.MISSIONS[SBMissions.S.index].steps[SBMissions.S.step].type === "timer") {
      ctx.fillStyle = SBMissions.S.timer < 15 ? "#ff6b6b" : "#ffffff";
      ctx.font = "bold 20px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(Math.ceil(SBMissions.S.timer) + "s", VW / 2, 74);
    }
    // Top-right: wanted stars.
    if (W.stars > 0 || W.state !== "CALM") {
      panel(VW - 218, 12, 204, 62);
      const blinkOff = W.state === "SEARCH" && Math.floor(world.time * 1.4) % 2 === 0;
      for (let i = 0; i < 5; i++) {
        starPath(VW - 188 + i * 38, 38, 15.5, i < W.stars && !blinkOff);
      }
      ctx.fillStyle = "#aeb9c4";
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "center";
      const label = W.state === "SEARCH" ? "SEARCHING" : W.state === "COOLDOWN" ? "COOLING DOWN" : "SBPD PURSUIT";
      ctx.fillText(label, VW - 116, 66);
      if (W.bustMeter > 0.02) {
        ctx.fillStyle = "#3a3f46";
        ctx.fillRect(VW - 196, 82, 160, 8);
        ctx.fillStyle = "#ff3b30";
        ctx.fillRect(VW - 196, 82, 160 * Math.min(1, W.bustMeter), 8);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Arial, sans-serif";
        ctx.fillText("BUSTED?", VW - 116, 79);
      }
    }
    // Dispatch line, above the minimap.
    if (W.dispatch.until > world.time && W.dispatch.text) {
      ctx.fillStyle = "rgba(160,200,255,0.95)";
      ctx.font = "italic 13.5px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(W.dispatch.text, 18, VH - 262);
    }
    // Minimap (bottom-left) — the v6 street-accurate map.
    if (mode === "play") {
      SBMinimap.draw(ctx, {
        player: { x: player.x, y: player.y, heading: player.heading },
        cops: SBWanted.S.cops,
        objective: obj ? { x: obj.x, y: obj.y } : null,
        search: SBWanted.S.state === "SEARCH" ? { x: SBWanted.S.lkp.x, y: SBWanted.S.lkp.y, r: SBWanted.S.searchR } : null,
      }, 14, VH - 248, 248, world.time);
    }
    // Bottom-right: speed + hints.
    ctx.textAlign = "right";
    if (world.playerCar) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px Arial, sans-serif";
      ctx.fillText(Math.round(Math.abs(world.playerCar.velFwd) * 3.6) + "", VW - 52, VH - 24);
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillStyle = "#aeb9c4";
      ctx.fillText("km/h", VW - 16, VH - 24);
    }
    ctx.fillStyle = "rgba(230,236,241,0.66)";
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText(world.playerCar ? "WASD drive · E exit · Space handbrake · T light" : "WASD walk · E enter car / work · Shift sprint · T light", VW - 16, VH - 46);
    // Toast message.
    const msg = SBMissions.S.message && SBMissions.S.messageUntil > world.time ? SBMissions.S.message : (noticeUntil > world.time ? notice : "");
    if (msg) {
      ctx.font = "bold 17px Arial, sans-serif";
      const w = ctx.measureText(msg).width + 40;
      panel(VW / 2 - w / 2, 92, w, 38);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(msg, VW / 2, 117);
    }
    // Side-job offer prompt.
    const offer = mode === "play" && !SBMissions.S.dialogue ? SBMissions.offerAt(world) : null;
    if (offer && !world.playerCar) {
      ctx.font = "bold 15px Arial, sans-serif";
      const label = offer === "courier" ? "Press E — Courier job (Mercado Central)" : "Press E — Repo job (Dockside lot)";
      const w = ctx.measureText(label).width + 36;
      panel(VW / 2 - w / 2, VH - 128, w, 34);
      ctx.fillStyle = "#7bf1a8";
      ctx.textAlign = "center";
      ctx.fillText(label, VW / 2, VH - 106);
    }
    // Dialogue box.
    const dlg = SBMissions.S.dialogue;
    if (dlg) {
      panel(240, VH - 118, VW - 480, 96);
      ctx.fillStyle = "#ffd93d";
      ctx.font = "bold 15px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(dlg.speaker, 262, VH - 90);
      ctx.fillStyle = "#f2f4f6";
      ctx.font = "16.5px Arial, sans-serif";
      wrapText(dlg.lines[dlg.idx], 262, VH - 64, VW - 524, 21);
      ctx.fillStyle = "#aeb9c4";
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Enter ▸", VW - 262, VH - 34);
    }
    // Damage flash.
    if (world.time - player.lastHurtAt < 0.35) {
      ctx.fillStyle = "rgba(255,30,30,0.16)";
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function wrapText(text, x, y, maxW, lh) {
    const words = text.split(" ");
    let line = "", yy = y;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = word; yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function drawTitle() {
    ctx.fillStyle = "rgba(8,8,20,0.42)";
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd93d";
    ctx.font = "bold 84px Arial, sans-serif";
    ctx.strokeStyle = "#0c1016";
    ctx.lineWidth = 8;
    ctx.strokeText("SOLANO BAY", VW / 2, 268);
    ctx.fillText("SOLANO BAY", VW / 2, 268);
    ctx.fillStyle = "#f2f4f6";
    ctx.font = "19px Arial, sans-serif";
    ctx.fillText("One wheelman, one fixer, five jobs — and a whole bay that wants him caught.", VW / 2, 308);
    const has = SBSave.has();
    ctx.font = "bold 25px Arial, sans-serif";
    ctx.fillStyle = "#7bf1a8";
    ctx.fillText(has ? "Press ENTER — Continue" : "Press ENTER — New Game", VW / 2, 396);
    if (has) {
      ctx.fillStyle = "#aeb9c4";
      ctx.font = "bold 17px Arial, sans-serif";
      ctx.fillText("N — start over", VW / 2, 428);
    }
    ctx.fillStyle = "rgba(230,236,241,0.85)";
    ctx.font = "15px Arial, sans-serif";
    ctx.fillText("WASD / arrows — walk & drive · E — enter car, talk, work · Shift — sprint", VW / 2, 486);
    ctx.fillText("Mouse click — punch / shoot · Space — handbrake · T — time of day", VW / 2, 510);
    ctx.fillText("An original city: Aurora Heights · El Mercado · Puerto Viejo · Costa Serena · Palma Verde · Dockside", VW / 2, 548);
  }

  function draw() {
    const view = { cx: cam.x, cy: cam.y, scale: cam.scale, w: VW, h: VH };
    ctx.fillStyle = "#175d6e";
    ctx.fillRect(0, 0, VW, VH);
    SBRender.drawWorld(ctx, view, world.time);
    // Entities under the same camera transform.
    ctx.save();
    ctx.translate(VW / 2, VH / 2);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.x, -cam.y);
    for (const car of world.extraCars) SBRender.drawCarBody(ctx, car, world.time);
    for (const car of V.traffic) SBRender.drawCarBody(ctx, car, world.time);
    for (const cop of SBWanted.S.cops) SBRender.drawCarBody(ctx, cop, world.time);
    for (const p of world.peds) {
      if (p.down) {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 1.1, 0.55, p.heading, 0, Math.PI * 2); ctx.fill();
      } else SBRender.drawPedFigure(ctx, p);
    }
    // The mission giver stands at the talk point.
    const st = SBMissions.S.active ? SBMissions.MISSIONS[SBMissions.S.index].steps[SBMissions.S.step] : null;
    const talkAt = st && st.type === "talk" ? st.at : (SBMissions.S.dialogue ? null : null);
    if (talkAt && mode === "play") {
      SBRender.drawPedFigure(ctx, { x: talkAt.x, y: talkAt.y - 2.6, color: "#c2255c", skin: "#f2c094" });
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 2.6px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(st.speaker.split(" ")[0].toUpperCase(), talkAt.x, talkAt.y - 4.6);
    }
    if (world.playerCar) { /* the player is inside the car, already drawn */ }
    else SBRender.drawPlayerFigure(ctx, player, world.time);
    // Objective beacon: a pillar of light at the target.
    const obj = SBMissions.objective();
    if (obj && mode === "play") {
      const pulse = 0.55 + Math.sin(world.time * 4) * 0.2;
      ctx.fillStyle = "rgba(255,217,61," + pulse * 0.35 + ")";
      ctx.beginPath(); ctx.arc(obj.x, obj.y, 5.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,217,61,0.95)";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(obj.x, obj.y, 5.2 + Math.sin(world.time * 4) * 0.7, 0, Math.PI * 2); ctx.stroke();
    }
    SBCombat.drawEffects(ctx, world);
    ctx.restore();
    applyGrade();
    if (mode === "play") drawHUD();
    else drawTitle();
  }

  // ---- staging + test API --------------------------------------------------
  function stageCop(x, y, heading) {
    const cop = V.makeCar(x, y, heading, { archetype: 1, color: "#f4f6f8", police: true });
    cop.mode = "chase"; cop.route = []; cop.routeT = 0; cop.stuckFor = 0; cop.reverseFor = 0; cop.searchNode = null;
    SBWanted.S.cops.push(cop);
    return cop;
  }
  function setStars(n) {
    SBWanted.S.heat = n === 0 ? 0 : C.wanted.thresholds[n - 1] + 5;
    SBWanted.S.stars = n;
    SBWanted.S.state = n === 0 ? "CALM" : "ACTIVE";
    SBWanted.S.lastSpottedAt = world.time;
    // Stage the last known position on the player as well: SEARCH steering
    // and police spawning both anchor on the LKP, and a level set from
    // outside must not leave them pointing at a stale point (0,0 at boot).
    SBWanted.S.lkp = { x: player.x, y: player.y };
  }
  function placePedNear(x, y) {
    // Find the edge along y=320 near x and drop a pedestrian on its sidewalk.
    let best = null, bd = Infinity;
    for (const e of City.edges) {
      const mx = (e.ax + e.bx) / 2, my = (e.ay + e.by) / 2;
      const d = (mx - x) * (mx - x) + (my - y) * (my - y);
      if (d < bd) { bd = d; best = e; }
    }
    const p = {
      edge: best.id, side: 1, s: Math.max(4, Math.min(best.len - 4, best.len / 2)), along: 1,
      speed: 1.4, state: "walk", fleeFor: 0, x: 0, y: 0, heading: 0,
      color: "#fd79a8", skin: "#f2c094", down: false, downFor: 0, threatX: 0, threatY: 0,
    };
    SBPedestrians.peds.push(p);
    return p;
  }

  const shots = {
    cover() {
      mode = "play"; grade = "sunset";
      SBMissions.S.index = 0; SBMissions.S.active = true; SBMissions.S.step = 1;
      const car = V.makeCar(1004, 330, Math.PI / 2, { archetype: 1, color: "#b7950b", parked: true });
      car.parked = true;
      world.extraCars.push(car);
      SBMissions.S.markedCar = car;
      const mine = V.makeCar(958, 321, 0, { archetype: 3, color: "#c0392b", parked: false });
      world.extraCars.push(mine);
      world.playerCar = mine;
      player.x = mine.x; player.y = mine.y; player.heading = 0;
      player.cash = 1400; player.armed = true;
      stageCop(984, 319, Math.PI);
      stageCop(938, 317.5, 0);
      stageCop(942, 327, 0);
      setStars(3);
      SBWanted.S.lkp = { x: player.x, y: player.y };
      for (let i = 0; i < 5; i++) placePedNear(936 + i * 16, 320);
      cam.x = 962; cam.y = 322; cam.scale = 5.0;
    },
    street() {
      mode = "play"; grade = "day";
      const ca = City.anchors.cafeAlba;
      player.x = ca.x + (ca.dx || 0) * 1.2 - (ca.dy || 0) * 1.6;
      player.y = ca.y + (ca.dy || 1) * 1.2 + (ca.dx || 0) * 1.6;
      player.heading = Math.atan2(-(ca.dy || 1), -(ca.dx || 0));
      player.cash = 250;
      SBMissions.startMission(world);
      cam.x = player.x - 6; cam.y = player.y + 4; cam.scale = 5.1;
    },
    drive() {
      mode = "play"; grade = "golden";
      SBMissions.S.index = 3; SBMissions.S.active = true; SBMissions.S.step = 1;
      const mine = V.makeCar(545, 712.5, 0, { archetype: 3, color: "#2471a3", parked: false });
      mine.velFwd = 13;
      world.extraCars.push(mine);
      world.playerCar = mine;
      player.x = mine.x; player.y = mine.y; player.heading = 0;
      player.cash = 3860; player.armed = true;
      cam.x = mine.x - 16; cam.y = mine.y; cam.scale = 3.9;
    },
    start() {
      mode = "title"; grade = "dusk";
    },
  };

  window.SB = {
    world, player,
    state() {
      return {
        mode, time: world.time,
        player: { x: player.x, y: player.y, heading: player.heading, health: player.health, cash: player.cash, armed: player.armed, inCar: !!world.playerCar },
        wanted: { stars: SBWanted.S.stars, state: SBWanted.S.state, heat: SBWanted.S.heat, cops: SBWanted.S.cops.length, bust: SBWanted.S.bustMeter },
        missions: { index: SBMissions.S.index, step: SBMissions.S.step, stepType: SBMissions.stepType(), active: SBMissions.S.active, storyDone: SBMissions.S.storyDone, side: SBMissions.S.side ? SBMissions.S.side.kind : null, dialogue: !!SBMissions.S.dialogue },
        objective: SBMissions.objective(),
        save: SBSave.read(),
      };
    },
    teleport(x, y) { player.x = x; player.y = y; if (world.playerCar) { world.playerCar.x = x; world.playerCar.y = y; } },
    setStars,
    stageCop,
    hurt(n) { player.health -= n; player.lastHurtAt = world.time; if (player.health <= 0) world.onWasted(); },
    enterNearest() { const c = nearestCar(6); if (c) { enterCar(c); return true; } return false; },
    exitCar,
    setGrade(g) { grade = g; },
    setTimeScale(k) { timeScale = k; },
    startPlay(newGame) {
      mode = "play";
      SBAudio.resume(); SBAudio.startMusic();
      if (newGame) {
        SBSave.clear();
        player.cash = 250; player.armed = false; player.health = 100;
        SBMissions.S.index = 0; SBMissions.S.storyDone = false;
        const sp = spawnAt(City.anchors.cafeAlba, 2.5);
        player.x = sp.x; player.y = sp.y;
      } else {
        const s = SBSave.read();
        if (s) {
          player.cash = s.cash; player.armed = s.armed;
          player.x = s.x; player.y = s.y;
          SBMissions.S.index = s.nextMission; SBMissions.S.storyDone = s.storyDone;
          Object.assign(SBWanted.S.stats, s.stats || {});
        }
      }
    },
    audioTest() { return SBAudio.testHooks(); },
    shot(name) { if (shots[name]) shots[name](); },
    missions: SBMissions, wanted: SBWanted, city: City,
  };

  // ---- boot ---------------------------------------------------------------
  SBInput.bind(canvas);
  addEventListener("keydown", (ev) => {
    if (mode === "title" && ev.code === "Enter") window.SB.startPlay(false);
    if (mode === "title" && ev.code === "KeyN") window.SB.startPlay(true);
  });
  canvas.addEventListener("mousedown", () => { if (mode === "play") SBAudio.resume(); });

  const params = new URLSearchParams(location.search);
  if (params.get("autostart") === "1") window.SB.startPlay(params.get("fresh") === "1");
  if (params.get("shot")) {
    const name = params.get("shot");
    setTimeout(() => { if (shots[name]) shots[name](); }, 350);
  }

  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    dt *= timeScale;
    update(dt);
    SBInput.endFrame();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
