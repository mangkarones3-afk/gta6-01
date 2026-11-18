// drive.mjs — headless end-to-end harness for Solano Bay (addendum tests).
// Drives the REAL game with keyboard input: all five story missions, both
// side jobs, the busted/respawn loop, continue-from-save after reload,
// shoreline/water collision around the whole bay, and the Web Audio graph.
// Usage: node playtest/drive.mjs [missions|side|busted|save|water|audio|all]

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/hatch/workspace/makefun/shots-tool/node_modules/playwright-core");
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL = "file://" + ROOT + "/game/index.html";

const results = [];
function report(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? " — " + detail : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let page, errors;
async function freshPage(query) {
  errors = [];
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(URL + (query || "?autostart=1&fresh=1"));
  await page.waitForFunction(() => window.SB && window.SB.state, null, { timeout: 20000 });
  await sleep(600);
  await page.evaluate(() => window.SB.setTimeScale(2));
}
const state = () => page.evaluate(() => window.SB.state());
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---- bot -----------------------------------------------------------------
const held = new Set();
async function hold(keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
async function releaseAll() { await hold([]); }

async function handleDialogue(st) {
  if (st.missions.dialogue) {
    await page.keyboard.press("Enter");
    await sleep(160);
    return true;
  }
  return false;
}

// Road-graph waypoints from the player to a target, read from the game's
// own city data. The bot still drives/walks every metre with real inputs —
// it just steers along streets instead of into building corners.
async function routeWaypoints(tx, ty) {
  return ev((arg) => {
    const C = window.SB.city;
    const p = window.SB.player;
    const a = C.nearestNode(p.x, p.y);
    const b = C.nearestNode(arg.tx, arg.ty);
    const ids = C.route(a, b);
    return ids.map((id) => ({ x: C.nodes[id].x, y: C.nodes[id].y }));
  }, { tx, ty });
}

// Walk (on foot) toward a point along streets until within r metres.
async function walkTo(tx, ty, r, timeoutMs) {
  const t0 = Date.now();
  let wps = await routeWaypoints(tx, ty);
  let wi = 0;
  let lastPos = null, stallSince = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await state();
    if (await handleDialogue(st)) continue;
    const p = st.player;
    if (Math.hypot(tx - p.x, ty - p.y) <= r) { await releaseAll(); return true; }
    while (wi < wps.length && Math.hypot(wps[wi].x - p.x, wps[wi].y - p.y) < 5) wi++;
    const wp = wi < wps.length ? wps[wi] : { x: tx, y: ty };
    const dx = wp.x - p.x, dy = wp.y - p.y;
    if (lastPos && Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 0.3) {
      if (Date.now() - stallSince > 5000) { await releaseAll(); return false; }
    } else { lastPos = { x: p.x, y: p.y }; stallSince = Date.now(); }
    const keys = ["ShiftLeft"];
    if (dx > 2.5) keys.push("KeyD"); else if (dx < -2.5) keys.push("KeyA");
    if (dy > 2.5) keys.push("KeyS"); else if (dy < -2.5) keys.push("KeyW");
    await hold(keys);
    await sleep(110);
  }
  await releaseAll();
  return false;
}

// Drive toward a point along the road graph. Waypoint onto the pier when
// the target is the boat. `urgent` (timed steps) trades corner polish for
// pace: wider waypoint capture, no handbrake corner braking, and a much
// shorter fuse on the stall-reverse — a queued or pinned second is gone
// for good when the tide clock is running.
async function driveTo(tx, ty, r, timeoutMs, urgent) {
  const t0 = Date.now();
  let wps = await routeWaypoints(tx, ty);
  let wi = 0;
  let lastPos = null, stallSince = Date.now(), reversingUntil = 0, stalls = 0;
  const wpRadius = urgent ? 9 : 5;
  const stallMs = urgent ? 1200 : 2200;
  while (Date.now() - t0 < timeoutMs) {
    const st = await state();
    if (await handleDialogue(st)) continue;
    const p = st.player;
    if (Math.hypot(tx - p.x, ty - p.y) <= r) { await releaseAll(); return true; }
    let wp = wi < wps.length ? wps[wi] : { x: tx, y: ty };
    // Pier approach: the override point is only for the final shore
    // approach. Applied cross-town it beelines the car through the
    // building grid (the M5 escape leg ground along block faces at
    // ~0.3 m/s for minutes) — follow the road graph until the shore
    // is actually near, then cut to the pier base.
    if (ty > 815 && p.y >= 700 && p.y < 798) wp = { x: 900, y: 784 };
    else while (wi < wps.length && Math.hypot(wps[wi].x - p.x, wps[wi].y - p.y) < wpRadius) { wi++; wp = wi < wps.length ? wps[wi] : { x: tx, y: ty }; }
    // Blocked twice: swing out around the queue — aim at a point just
    // ahead of the car, offset into the opposing lane, not at the far
    // waypoint (offsetting the waypoint barely bends the trajectory).
    if (stalls >= 2) {
      const ang = Math.atan2(wp.y - p.y, wp.x - p.x);
      wp = { x: p.x + Math.cos(ang) * 13 - Math.sin(ang) * 7, y: p.y + Math.sin(ang) * 13 + Math.cos(ang) * 7 };
    }
    const dx = wp.x - p.x, dy = wp.y - p.y;
    if (!driveTo.logAt || Date.now() - driveTo.logAt > 4000) {
      driveTo.logAt = Date.now();
      const diag = await ev(() => {
        try {
          const w = window.SB.world, pl = window.SB.player;
          let best = null;
          const cars = [...w.trafficCars, ...w.extraCars, ...(window.SB.wanted ? window.SB.wanted.S.cops : [])];
          for (const c of cars) {
            if (!c || c === w.playerCar) continue;
            const d = Math.hypot(c.x - pl.x, c.y - pl.y);
            if (!best || d < best.d) best = { d: d.toFixed(1), x: Math.round(c.x), y: Math.round(c.y), cop: !!c.police, traffic: !!c.traffic, parked: !!c.parked };
          }
          return { vel: w.playerCar ? w.playerCar.velFwd.toFixed(2) : null, stars: window.SB.state().wanted.stars, near: best };
        } catch (e) { return { vel: "?", stars: "?", near: "diag-error" }; }
      });
      console.log("  drive: pos (" + Math.round(p.x) + "," + Math.round(p.y) + ") wp " + wi + "/" + wps.length + " (" + Math.round(wp.x) + "," + Math.round(wp.y) + ") target (" + Math.round(tx) + "," + Math.round(ty) + ") stalls " + stalls + " vel " + diag.vel + " stars " + diag.stars + " near " + JSON.stringify(diag.near));
    }
    if (lastPos && Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 0.4 && Date.now() > reversingUntil) {
      if (Date.now() - stallSince > stallMs) {
        reversingUntil = Date.now() + 850;
        stalls++;
        if (stalls >= 3 && wi < wps.length) { wi++; stalls = 0; }
        if (stalls >= 5) {
          // Pinned (likely rammed against a wall): bail out, step a couple
          // of metres toward the target, get back in — breaks the pin.
          await releaseAll();
          const carPos = { x: p.x, y: p.y };
          await page.keyboard.press("KeyE");
          await sleep(300);
          const stNow = await state();
          if (!stNow.player.inCar) {
            // Walk back to the car's door (not toward the target — the
            // car is the thing we need, and E only reaches 3.4 m).
            await walkTo(carPos.x, carPos.y, 2.0, 3000);
            await page.keyboard.press("KeyE");
            await sleep(350);
          }
          stalls = 0;
          wps = await routeWaypoints(tx, ty);
          wi = 0;
        }
      }
    } else if (!lastPos || Math.hypot(p.x - lastPos.x, p.y - lastPos.y) >= 0.4) {
      lastPos = { x: p.x, y: p.y }; stallSince = Date.now();
    }
    let diff = Math.atan2(dy, dx) - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Bot-side speed estimate from successive positions.
    const nowMs = Date.now();
    let speed = 0;
    if (driveTo.lastSample) {
      const dtS = (nowMs - driveTo.lastSample.t) / 1000;
      if (dtS > 0.05) speed = Math.hypot(p.x - driveTo.lastSample.x, p.y - driveTo.lastSample.y) / dtS;
    }
    driveTo.lastSample = { x: p.x, y: p.y, t: nowMs };
    const keys = [];
    let steerKey = null, steerFrac = 0;
    if (Date.now() < reversingUntil) {
      keys.push("KeyS");
      steerKey = diff > 0 ? "KeyA" : "KeyD";
      steerFrac = 1;
    } else {
      // Slow for corners: full-speed full-lock turns swing wide into the
      // block corners; brake with the handbrake until the nose is round.
      // Urgent legs skip the braking — a wide line beats a late one.
      if (!urgent && Math.abs(diff) > 0.55 && speed > 6.5) keys.push("Space");
      else if (Math.abs(diff) < 1.05) keys.push("KeyW");
      // Pulse-width steering: a full-lock tap at speed yaws ~0.2 rad, far
      // more than small corrections need — hold the key for a fraction of
      // the tick proportional to the heading error instead.
      if (diff > 0.05) { steerKey = "KeyD"; steerFrac = Math.min(1, Math.abs(diff) / 0.5); }
      else if (diff < -0.05) { steerKey = "KeyA"; steerFrac = Math.min(1, Math.abs(diff) / 0.5); }
      if (Math.abs(diff) > 2.5) keys.push("KeyS");
    }
    await hold(keys);
    if (steerKey) {
      await page.keyboard.down(steerKey);
      await sleep(Math.max(15, steerFrac * 85));
      await page.keyboard.up(steerKey);
      await sleep(Math.max(0, (1 - steerFrac) * 85));
    } else {
      await sleep(85);
    }
    if (Date.now() - t0 < 2600) {
      const v = await ev(() => { const c = window.SB.world.playerCar; return c ? c.velFwd.toFixed(2) : null; });
      console.log("  tick: pos (" + Math.round(p.x) + "," + Math.round(p.y) + ") keys " + keys.join("+") + (steerKey ? "+" + steerKey + "@" + steerFrac.toFixed(2) : "") + " vel " + v + " diff " + diff.toFixed(2));
    }
  }
  await releaseAll();
  return false;
}

async function goToObjective(st, timeoutMs) {
  const obj = st.objective;
  if (!obj) return false;
  if (st.player.inCar) return driveTo(obj.x, obj.y, 6.5, timeoutMs, st.missions.stepType === "timer");
  return walkTo(obj.x, obj.y, 2.4, timeoutMs);
}

// ---- test: all five missions ----------------------------------------------
async function testMissions() {
  await freshPage();
  const maxMissions = parseInt(process.argv[3] || "5", 10);
  for (let m = 0; m < maxMissions; m++) {
    const t0 = Date.now();
    let done = false, lastStep = -1;
    while (Date.now() - t0 < 600000) {
      const st = await state();
      if (st.missions.index > m || (m === 4 && st.missions.storyDone)) { done = true; break; }
      if (await handleDialogue(st)) continue;
      if (st.missions.active && st.missions.step !== lastStep) {
        lastStep = st.missions.step;
        console.log("  mission " + (m + 1) + " step " + (lastStep + 1) + " — objective: " + (st.objective ? st.objective.label : "none"));
      }
      if (Math.floor((Date.now() - t0) / 20000) !== Math.floor((Date.now() - t0 - 200) / 20000)) {
        console.log("  [t+" + Math.round((Date.now() - t0) / 1000) + "s] step " + (st.missions.step + 1) + " pos (" + Math.round(st.player.x) + "," + Math.round(st.player.y) + ") inCar " + st.player.inCar + " stars " + st.wanted.stars + "/" + st.wanted.state);
      }
      const before = st.missions.step + "|" + st.missions.active;
      if (!st.player.inCar && st.objective && st.missions.stepType !== "talk") {
        // Mobility: after a talk step the bot is on foot, and walking a
        // cross-town goto/deliver leg eats the whole mission budget (and
        // walkTo logs nothing while it grinds). A player would take a
        // car — so does the bot, whenever the objective is far away.
        const dObj = Math.hypot(st.player.x - st.objective.x, st.player.y - st.objective.y);
        if (dObj > 45) await getInAnyCar();
      }
      await goToObjective(st, 45000);
      const st2 = await state();
      if (st2.missions.stepType === "steal" && st2.objective) {
        // A steal step completes only by entering THE marked car on foot.
        // If we're still far away in some other car, keep driving — the
        // exit/walk/E sequence only makes sense at the target itself.
        const dObj = Math.hypot(st2.player.x - st2.objective.x, st2.player.y - st2.objective.y);
        if (dObj <= 30) {
          if (st2.player.inCar) { await page.keyboard.press("KeyE"); await sleep(350); }
          const arrived = await walkTo(st2.objective.x, st2.objective.y, 2.2, 25000);
          if (arrived) {
            await page.keyboard.press("KeyE");
            await sleep(400);
          }
        }
      }
      const isTalk = st2.missions.stepType === "talk" ||
        (!st2.missions.active && !st2.missions.storyDone && !!st2.objective);
      if (isTalk && st2.objective) {
        // A talk step completes only on foot within 4.2 m of the giver —
        // and an unstarted mission auto-starts the same way, which is why
        // stepType is null here: currentStep() is null until S.active.
        // Arriving by car (the normal case after a delivery) the bot must
        // park, get out and walk the last metres — otherwise it sits in
        // the car at the anchor forever while the heat builds.
        const dObj = Math.hypot(st2.player.x - st2.objective.x, st2.player.y - st2.objective.y);
        if (st2.player.inCar && dObj <= 14) {
          await page.keyboard.press("KeyE");
          await sleep(350);
          await walkTo(st2.objective.x, st2.objective.y, 2.4, 20000);
        }
      }
      if (st2.missions.stepType === "escape" && st2.objective && st2.player.inCar) {
        // The boat sits at the end of the pier: cars stop at the shoreline
        // (y = 800), ~96 m short of the target, so the last leg is on
        // foot down the pier boards.
        const dObj = Math.hypot(st2.player.x - st2.objective.x, st2.player.y - st2.objective.y);
        if (dObj < 115 && st2.player.y > 740) {
          await page.keyboard.press("KeyE");
          await sleep(350);
          await walkTo(st2.objective.x, st2.objective.y, 3, 40000);
        }
      }
      if ((st2.missions.stepType === "deliver" || st2.missions.stepType === "timer") && !st2.player.inCar) {
        // Deliver and timer steps complete only from the driver's seat.
        // A stall bail-out can leave the bot standing at the destination
        // on foot, where the mission loop would spin forever — get back
        // into a car: THE marked car for a plain deliver (a wrong car
        // never satisfies it), any car for anyCar steps.
        for (let attempt = 0; attempt < 3; attempt++) {
          const carPos = await ev(() => {
            const M = window.SB.missions;
            const stp = M.MISSIONS[M.S.index].steps[M.S.step];
            if (stp && stp.type === "deliver" && !stp.anyCar && M.S.markedCar) return { x: M.S.markedCar.x, y: M.S.markedCar.y };
            const p = window.SB.player;
            let best = null, bd = Infinity;
            for (const c of [...window.SB.world.extraCars, ...window.SB.world.trafficCars]) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
            return best ? { x: best.x, y: best.y } : null;
          });
          if (!carPos) break;
          if (!(await walkTo(carPos.x, carPos.y, 2.0, 30000))) break;
          await page.keyboard.press("KeyE");
          await sleep(400);
          const chk = await ev(() => {
            const M = window.SB.missions;
            const stp = M.MISSIONS[M.S.index].steps[M.S.step];
            const pc = window.SB.world.playerCar;
            if (!pc) return "none";
            if (stp && stp.type === "deliver" && !stp.anyCar) return pc === M.S.markedCar ? "marked" : "wrong";
            return "any";
          });
          if (chk === "marked" || chk === "any") break;
          if (chk === "wrong") { await page.keyboard.press("KeyE"); await sleep(350); }
        }
      }
      // No generic E fallback: talk/goto steps complete by proximity, and
      // pressing E near a parked car only puts the bot in the wrong car.
      void before;
    }
    const st = await state();
    report("mission " + (m + 1) + " end-to-end", done, "cash $" + st.player.cash + ", index " + st.missions.index);
    if (!done) return false;
  }
  if (maxMissions < 5) return true;
  const st = await state();
  report("story arc complete", st.missions.storyDone === true, "final cash $" + st.player.cash);
  return st.missions.storyDone === true;
}

// ---- test: side jobs --------------------------------------------------------
async function nearestCarPos() {
  return ev(() => {
    const cars = [...window.SB.world.extraCars, ...window.SB.world.trafficCars];
    const p = window.SB.player;
    let best = null, bd = Infinity;
    for (const c of cars) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
    return best ? { x: best.x, y: best.y, d: bd } : null;
  });
}
async function getInAnyCar() {
  const st = await state();
  if (st.player.inCar) return true;
  // Prefer parked cars: a traffic car's sampled position is stale before
  // the bot crosses the street (the ghost-target failure). Only when no
  // parked car exists do we chase traffic — re-sampling its live
  // position on every attempt — and entry is verified, never assumed.
  for (let attempt = 0; attempt < 4; attempt++) {
    const c = await ev(() => {
      const p = window.SB.player;
      let parked = null, pd = Infinity, moving = null, md = Infinity;
      for (const car of [...window.SB.world.extraCars, ...window.SB.world.trafficCars]) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (car.parked) { if (d < pd) { pd = d; parked = { x: car.x, y: car.y }; } }
        else if (d < md) { md = d; moving = { x: car.x, y: car.y }; }
      }
      return parked || moving;
    });
    if (!c) return false;
    if (!(await walkTo(c.x, c.y, 2.6, 45000))) continue;
    await page.keyboard.press("KeyE");
    await sleep(400);
    if ((await state()).player.inCar) return true;
  }
  return false;
}

async function testSideJobs() {
  // Continues on the story-complete page if present, else fresh + teleport.
  let st = await state();
  if (!st.missions.storyDone) {
    await ev(() => { window.SB.missions.S.storyDone = true; window.SB.missions.S.active = false; });
    st = await state();
  }
  // Courier from Mercado Central.
  let A = await ev(() => window.SB.city.anchors);
  await ev((a) => window.SB.teleport(a.mercado.x, a.mercado.y + 6), A);
  await walkTo(A.mercado.x, A.mercado.y, 3, 20000);
  await page.keyboard.press("KeyE");
  await sleep(400);
  st = await state();
  const courierStarted = st.missions.side === "courier";
  report("side job: courier starts", courierStarted, "");
  if (courierStarted) {
    let done = false;
    const t0 = Date.now();
    // Side-job caps are 600 s, not 300: the game itself sets no time
    // limit on side jobs, so the cap is pure harness patience — aligned
    // with the per-mission cap. Cross-town legs under competent police
    // (pins, a bust-and-return) do not fit in 300 s.
    while (Date.now() - t0 < 600000) {
      st = await state();
      if (await handleDialogue(st)) continue;
      if (!st.missions.side) { done = true; break; }
      if (!st.player.inCar) {
        // A failed car grab retries: breaking out here silently killed
        // the job in one run — the job stayed active, the loop just
        // gave up on it. The 600 s cap is the only way out.
        if (!(await getInAnyCar())) { await sleep(500); continue; }
      } else {
        const obj = st.objective;
        const dObj = obj ? Math.hypot(st.player.x - obj.x, st.player.y - obj.y) : Infinity;
        if (obj && dObj <= 14) {
          // Finish on foot: some parcel doors cannot be driven within
          // the 8 m completion radius — the car grinds on the
          // neighbouring lot building a few metres short. Park and walk
          // the last metres; on foot the door is reachable.
          await page.keyboard.press("KeyE");
          await sleep(350);
          await walkTo(obj.x, obj.y, 2.2, 20000);
        } else await goToObjective(st, 60000);
      }
    }
    report("side job: courier completes", done, "cash $" + (await state()).player.cash);
  }
  // Repo from the Dockside lot. A failed courier run can leave its job
  // active, and no job is offered while one is active (offerAt returns
  // null) — the repo section would sit at the lot forever. Start the
  // repo section from a fresh page in that case, keeping any page
  // errors already recorded so the zero-errors gate stays honest.
  st = await state();
  if (st.missions.side) {
    const priorErrors = errors;
    await freshPage();
    errors = priorErrors.concat(errors);
    await ev(() => { window.SB.missions.S.storyDone = true; window.SB.missions.S.active = false; });
    A = await ev(() => window.SB.city.anchors);
  }
  await ev((a) => { if (window.SB.state().player.inCar) window.SB.exitCar(); window.SB.teleport(a.dockLot.x, a.dockLot.y + 8); }, A);
  await walkTo(A.dockLot.x, A.dockLot.y, 3, 20000);
  await page.keyboard.press("KeyE");
  await sleep(400);
  st = await state();
  const repoStarted = st.missions.side === "repo";
  report("side job: repo starts", repoStarted, "");
  if (repoStarted) {
    let done = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 600000) {
      st = await state();
      if (await handleDialogue(st)) continue;
      if (!st.missions.side) { done = true; break; }
      const obj = st.objective;
      if (!obj) { await sleep(300); continue; }
      const inMarked = await ev(() => {
        const M = window.SB.missions;
        return !!(M.S.side && M.S.side.car && window.SB.world.playerCar === M.S.side.car);
      });
      if (inMarked) {
        // Deliver leg: drive the marked car to the Dockside lot.
        await goToObjective(st, 60000);
      } else if (st.player.inCar) {
        // Mobility leg: drive the borrowed car at the marked one, then
        // step out close — the steal completes only by entering the
        // marked car on foot.
        const dObj = Math.hypot(st.player.x - obj.x, st.player.y - obj.y);
        if (dObj <= 9) {
          await page.keyboard.press("KeyE");
          await sleep(350);
          if (await walkTo(obj.x, obj.y, 2.2, 20000)) {
            await page.keyboard.press("KeyE");
            await sleep(400);
          }
        } else await goToObjective(st, 60000);
      } else {
        // On foot: the marked car can be 400–900 m cross-town, far past
        // what one on-foot walk covers inside the cap. Take a car
        // first; a failed grab retries, never breaks (see courier).
        if (!(await getInAnyCar())) { await sleep(500); continue; }
      }
    }
    report("side job: repo completes", done, "cash $" + (await state()).player.cash);
  }
}

// ---- test: busted / respawn --------------------------------------------------
async function testBusted() {
  await freshPage();
  const A = await ev(() => window.SB.city.anchors);
  await ev(() => { window.SB.teleport(620, 330); window.SB.setStars(3); });
  const t0 = Date.now();
  let outcome = "timeout";
  while (Date.now() - t0 < 150000) {
    const st = await state();
    const nearSafe = Math.hypot(st.player.x - A.safehouse.x, st.player.y - A.safehouse.y) < 160;
    if (st.wanted.stars === 0 && nearSafe && st.player.health > 0) { outcome = "respawned"; break; }
    if (st.wanted.cops > 0) {
      // Stand still and let the bust meter do its work.
      await releaseAll();
    }
    await sleep(400);
  }
  const st = await state();
  report("busted/wasted respawn loop", outcome === "respawned",
    "pos (" + Math.round(st.player.x) + "," + Math.round(st.player.y) + "), stars " + st.wanted.stars + ", health " + Math.round(st.player.health));
}

// ---- test: save + continue ---------------------------------------------------
async function testSaveContinue() {
  const before = await state();
  const savedCash = before.player.cash;
  const savedIndex = before.missions.index;
  const wasDone = before.missions.storyDone;
  await page.goto(URL);
  await page.waitForFunction(() => window.SB && window.SB.state, null, { timeout: 20000 });
  await sleep(500);
  await page.keyboard.press("Enter");
  await sleep(800);
  const st = await state();
  const ok = st.mode === "play" && st.player.cash === savedCash && st.missions.index === savedIndex && st.missions.storyDone === wasDone;
  report("continue-from-save after reload", ok, "cash $" + st.player.cash + " (was $" + savedCash + "), index " + st.missions.index + ", storyDone " + st.missions.storyDone);
}

// ---- test: water ---------------------------------------------------------------
async function testWater() {
  await freshPage();
  // The spawn greeting dialogue is modal: while it is open the game
  // ignores movement keys, so the probes below would measure a frozen
  // player — the shoreline checks passing vacuously, the pier check
  // failing. Dismiss it first, as the missions loop does.
  for (let i = 0; i < 6; i++) {
    const st = await state();
    if (!st.missions.dialogue) break;
    await page.keyboard.press("Enter");
    await sleep(180);
  }
  const xs = [-20, 150, 350, 550, 750, 950, 1140];
  let allOk = true;
  for (const x of xs) {
    await ev((xx) => window.SB.teleport(xx, 794), x);
    await page.keyboard.down("KeyS");
    await sleep(1100);
    await page.keyboard.up("KeyS");
    const st = await state();
    const ok = st.player.y <= 801;
    if (!ok) allOk = false;
    console.log("  shore x=" + x + " -> y=" + st.player.y.toFixed(1) + (ok ? " (blocked)" : " (WADED IN!)"));
  }
  report("on-foot water block, whole shoreline", allOk, "");
  // The pier is land: the player must be able to walk onto it.
  await ev(() => window.SB.teleport(900, 794));
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyS");
  await sleep(2600);
  await page.keyboard.up("KeyS");
  await page.keyboard.up("ShiftLeft");
  let st = await state();
  report("pier is walkable land", st.player.y > 815, "y=" + st.player.y.toFixed(1));
  // Cars are stopped by the shoreline too (same collision path as play).
  const carY = await ev(() => {
    const car = window.SBVehicles.makeCar(500, 792, Math.PI / 2, {});
    for (let i = 0; i < 40; i++) window.SBVehicles.stepCar(car, { throttle: 1, steer: 0, handbrake: false }, 0.1);
    return car.y;
  });
  report("car water block at shoreline", carY <= 801.5, "car y=" + carY.toFixed(1));
}

// ---- test: audio -----------------------------------------------------------------
async function testAudio() {
  await freshPage();
  await page.keyboard.press("Enter");
  await sleep(600);
  const t1 = await ev(() => window.SB.audioTest());
  const startedBefore = t1.stats.started;
  await ev(() => { window.SBAudio.gunshot(); window.SBAudio.cash(); window.SBAudio.missionDone(); window.SBAudio.thud(); window.SBAudio.sirenBurst(); });
  await sleep(500);
  const t2 = await ev(() => window.SB.audioTest());
  const ok = t2.state === "running" && t2.stats.started > startedBefore && t2.stats.errors.length === 0 && t2.musicOn;
  report("web audio graph runs + SFX nodes start", ok,
    "state " + t2.state + ", nodes started " + startedBefore + " -> " + t2.stats.started + ", created " + t2.stats.created + ", music " + t2.musicOn + ", errors " + t2.stats.errors.length);
  console.log("  NOTE: literal ear-verification is impossible in headless Chromium; this verifies the graph, node creation and start calls only.");
}

// ---- main -------------------------------------------------------------------------
const which = process.argv[2] || "all";
var browser;
browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
try {
  if (which === "all" || which === "missions") {
    const okM = await testMissions();
    if (okM && (which === "all")) await testSideJobs();
    if (okM && (which === "all")) await testSaveContinue();
  }
  if (which === "side") { await freshPage(); await testSideJobs(); }
  if (which === "busted") await testBusted();
  if (which === "save") { await testMissions(); await testSaveContinue(); }
  if (which === "water") await testWater();
  if (which === "audio") await testAudio();
} finally {
  if (errors && errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
  report("zero page errors", !errors || errors.length === 0, errors ? errors.length + " errors" : "");
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log("\n" + (failed.length ? "HARNESS: " + failed.length + " FAILURE(S)" : "HARNESS: ALL PASS"));
process.exit(failed.length ? 1 : 0);
