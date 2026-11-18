// pedestrians.js — sidewalk crowds. A pedestrian lives on a sidewalk path
// (edge + side + arclength), walks it, picks a new edge at each junction,
// and flees threats as free movement before snapping back to a path.
// States: walk, flee, down. Cars never win an argument with a pedestrian
// who is actually hit — the hit is reported as a crime by the caller.

const SBPedestrians = (() => {
  const C = window.SBConfig;
  const City = window.SBCity;
  const R = window.SBRng;
  const rng = R.streamFor(C.seed, "peds");
  const SHIRTS = ["#e74c3c", "#f39c12", "#27ae60", "#8e44ad", "#fd79a8", "#00b8d4", "#f5f0e6", "#5d6d7e", "#e67e22", "#a3e635"];
  const SKINS = ["#f2c094", "#c68642", "#8d5524", "#ffdbac", "#6b4423"];

  const peds = [];

  function poseOnPath(p) {
    const e = City.edges[p.edge];
    const ux = (e.bx - e.ax) / e.len, uy = (e.by - e.ay) / e.len;
    const off = e.halfW + 1.5;
    return {
      x: e.ax + ux * p.s + -uy * p.side * off,
      y: e.ay + uy * p.s + ux * p.side * off,
      heading: Math.atan2(uy * p.along, ux * p.along),
    };
  }

  function spawnPed(player) {
    if (peds.length >= 30) return;
    for (let tries = 0; tries < 6; tries++) {
      const e = City.edges[Math.floor(rng() * City.edges.length)];
      const mid = Math.hypot((e.ax + e.bx) / 2 - player.x, (e.ay + e.by) / 2 - player.y);
      if (mid < 70 || mid > 190) continue;
      const p = {
        edge: e.id, side: rng() > 0.5 ? 1 : -1,
        s: R.range(rng, 6, e.len - 6), along: rng() > 0.5 ? 1 : -1,
        speed: R.range(rng, 1.2, 1.7), state: "walk", fleeFor: 0,
        x: 0, y: 0, heading: 0, color: R.pick(rng, SHIRTS), skin: R.pick(rng, SKINS),
        down: false, downFor: 0, threatX: 0, threatY: 0,
      };
      const pose = poseOnPath(p);
      p.x = pose.x; p.y = pose.y; p.heading = pose.heading;
      if (City.buildingHit(p.x, p.y, 0.6)) continue;
      peds.push(p);
      return;
    }
  }

  function fleeFrom(p, x, y, seconds) {
    if (p.down) return;
    p.state = "flee";
    p.fleeFor = Math.max(p.fleeFor, seconds || 4);
    p.threatX = x; p.threatY = y;
  }

  function stepPeds(dt, world) {
    const player = world.player;
    spawnPed(player);
    for (let i = peds.length - 1; i >= 0; i--) {
      const p = peds[i];
      const distP = Math.hypot(p.x - player.x, p.y - player.y);
      if (distP > 240 && p.state !== "flee") { peds.splice(i, 1); continue; }
      if (p.down) {
        p.downFor -= dt;
        if (p.downFor <= 0) { p.down = false; p.state = "walk"; }
        continue;
      }
      if (p.state === "flee") {
        p.fleeFor -= dt;
        const dx = p.x - p.threatX, dy = p.y - p.threatY;
        const d = Math.hypot(dx, dy) || 1;
        const nx = p.x + (dx / d) * 4.4 * dt, ny = p.y + (dy / d) * 4.4 * dt;
        if (!City.buildingHit(nx, ny, 0.5) && City.isLand(nx, ny)) { p.x = nx; p.y = ny; }
        p.heading = Math.atan2(dy, dx);
        if (p.fleeFor <= 0) {
          // Snap back to the nearest edge's sidewalk.
          let best = null, bd = Infinity;
          for (const e of City.edges) {
            const mx = (e.ax + e.bx) / 2, my = (e.ay + e.by) / 2;
            const dd = (mx - p.x) * (mx - p.x) + (my - p.y) * (my - p.y);
            if (dd < bd) { bd = dd; best = e; }
          }
          p.edge = best.id; p.side = 1; p.along = 1;
          p.s = Math.max(4, Math.min(best.len - 4, best.len / 2));
          p.state = "walk";
        }
        continue;
      }
      // Walk the sidewalk path.
      p.s += p.speed * p.along * dt;
      const e = City.edges[p.edge];
      if (p.s >= e.len - 1 || p.s <= 1) {
        const nodeId = p.s >= e.len - 1 ? (p.along > 0 ? e.b : e.a) : (p.along > 0 ? e.a : e.b);
        const node = City.nodes[nodeId];
        const options = node.edges.map((eid) => City.edges[eid]);
        const next = options[Math.floor(rng() * options.length)];
        p.edge = next.id;
        if (next.a === nodeId) { p.s = 1.5; p.along = 1; }
        else { p.s = next.len - 1.5; p.along = -1; }
        if (rng() < 0.3) p.side = -p.side;
      }
      const pose = poseOnPath(p);
      p.x = pose.x; p.y = pose.y; p.heading = pose.heading;
    }
  }

  return { peds, spawnPed, stepPeds, fleeFrom };
})();

window.SBPedestrians = SBPedestrians;
