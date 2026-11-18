// combat.js — fists, the pistol, officer return fire, and damage. Combat
// never touches heat directly: every violent act is reported through
// wanted.addCrime and the wanted system decides what it costs.

const SBCombat = (() => {
  const City = window.SBCity;
  const effects = []; // {kind:'tracer'|'flash'|'ring', ... , until}

  function punch(world) {
    const pl = world.player;
    let hitAny = false;
    for (const p of world.peds) {
      if (p.down) continue;
      const d = Math.hypot(p.x - pl.x, p.y - pl.y);
      if (d < 2.1) {
        p.hp = (p.hp === undefined ? 30 : p.hp) - 16;
        hitAny = true;
        if (p.hp <= 0) { p.down = true; p.downFor = 6; SBWanted.addCrime("pedHit", p.x, p.y, world); }
        else SBPedestrians.fleeFrom(p, pl.x, pl.y, 4);
      }
    }
    for (const cop of SBWanted.S.cops) {
      if (Math.hypot(cop.x - pl.x, cop.y - pl.y) < 2.6) {
        cop.hp -= 10;
        hitAny = true;
      }
    }
    if (hitAny && window.SBAudio) SBAudio.thud();
    return hitAny;
  }

  function shoot(world, tx, ty) {
    const pl = world.player;
    if (!pl.armed) return false;
    if (window.SBAudio) SBAudio.gunshot();
    SBWanted.addCrime("gunshot", pl.x, pl.y, world);
    for (const p of world.peds) {
      if (Math.hypot(p.x - pl.x, p.y - pl.y) < 26) SBPedestrians.fleeFrom(p, pl.x, pl.y, 5);
    }
    // Hitscan: nearest target along the ray wins.
    const dx = tx - pl.x, dy = ty - pl.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const maxD = Math.min(len, 65);
    let bestD = maxD, bestPed = null, bestCop = null;
    const testTarget = (o, r) => {
      const ox = o.x - pl.x, oy = o.y - pl.y;
      const along = ox * ux + oy * uy;
      if (along < 0 || along > bestD) return -1;
      const perp = Math.abs(-ox * uy + oy * ux);
      return perp < r ? along : -1;
    };
    for (const p of world.peds) {
      if (p.down) continue;
      const d = testTarget(p, 0.8);
      if (d > 0) { bestD = d; bestPed = p; bestCop = null; }
    }
    for (const cop of SBWanted.S.cops) {
      const d = testTarget(cop, 1.5);
      if (d > 0) { bestD = d; bestCop = cop; bestPed = null; }
    }
    // Buildings block the shot.
    const steps = Math.floor(bestD / 2);
    for (let i = 1; i < steps; i++) {
      if (City.buildingHit(pl.x + ux * i * 2, pl.y + uy * i * 2, -0.2)) { bestPed = null; bestCop = null; bestD = i * 2; break; }
    }
    effects.push({ kind: "tracer", x1: pl.x + ux * 1.2, y1: pl.y + uy * 1.2, x2: pl.x + ux * bestD, y2: pl.y + uy * bestD, until: world.time + 0.07 });
    effects.push({ kind: "flash", x: pl.x + ux * 1.3, y: pl.y + uy * 1.3, until: world.time + 0.05 });
    if (bestPed) {
      bestPed.hp = (bestPed.hp === undefined ? 30 : bestPed.hp) - 34;
      if (bestPed.hp <= 0) { bestPed.down = true; bestPed.downFor = 8; SBWanted.addCrime("pedKill", bestPed.x, bestPed.y, world); }
    }
    if (bestCop) {
      bestCop.hp -= 34;
      if (bestCop.hp <= 0) SBWanted.addCrime("officerDown", bestCop.x, bestCop.y, world);
    }
    return true;
  }

  // Officer return fire at 3+ stars, plus player damage bookkeeping.
  function update(dt, world) {
    const pl = world.player;
    if (pl.lastHurtAt === undefined) pl.lastHurtAt = -99;
    if (world.time - pl.lastHurtAt > 6 && pl.health < 100) {
      pl.health = Math.min(100, pl.health + 5 * dt);
    }
    if (SBWanted.S.stars < 3 || world.playerCar) return;
    for (const cop of SBWanted.S.cops) {
      if (cop.mode === "leave") continue;
      cop.fireT = (cop.fireT || 0) - dt;
      const d = Math.hypot(cop.x - pl.x, cop.y - pl.y);
      if (d > 30 || d < 4) continue;
      if (!SBWanted.losClear(cop.x, cop.y, pl.x, pl.y)) continue;
      if (cop.fireT <= 0) {
        cop.fireT = 1.15;
        if (window.SBAudio) SBAudio.gunshot(true);
        effects.push({ kind: "tracer", x1: cop.x, y1: cop.y, x2: pl.x, y2: pl.y, until: world.time + 0.06, enemy: true });
        const hitChance = Math.max(0.15, 0.62 - d * 0.014);
        if (world.rng() < hitChance) {
          pl.health -= 6;
          pl.lastHurtAt = world.time;
          if (pl.health <= 0) world.onWasted();
        }
      }
    }
  }

  function drawEffects(ctx, world) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      if (world.time > e.until) { effects.splice(i, 1); continue; }
      if (e.kind === "tracer") {
        ctx.strokeStyle = e.enemy ? "rgba(255,90,70,0.85)" : "rgba(255,230,150,0.9)";
        ctx.lineWidth = 0.22;
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      } else if (e.kind === "flash") {
        ctx.fillStyle = "rgba(255,210,90,0.9)";
        ctx.beginPath(); ctx.arc(e.x, e.y, 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  return { punch, shoot, update, drawEffects, effects };
})();

window.SBCombat = SBCombat;
