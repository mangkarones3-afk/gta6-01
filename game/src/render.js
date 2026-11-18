// render.js — draws the world of Solano Bay on a 2D canvas: district ground,
// water and boardwalk, the road network, buildings with diegetic signs,
// landmarks, props, and every entity. Everything is drawn in world metres
// under one camera transform; the sunset grade is a screen-space pass the
// main loop applies after the world.

const SBRender = (() => {
  const C = window.SBConfig;
  const City = window.SBCity;

  function viewRect(view) {
    const hw = view.w / 2 / view.scale, hh = view.h / 2 / view.scale;
    return { x0: view.cx - hw - 30, y0: view.cy - hh - 30, x1: view.cx + hw + 30, y1: view.cy + hh + 30 };
  }
  function inRect(vr, x, y, m) {
    return x > vr.x0 - m && x < vr.x1 + m && y > vr.y0 - m && y < vr.y1 + m;
  }

  function drawGround(ctx, view, t) {
    const W = C.world;
    // Land base: per-district tint, muted.
    for (const d of C.districts) {
      ctx.fillStyle = d.tint;
      ctx.fillRect(d.rect[0], d.rect[1], d.rect[2] - d.rect[0], d.rect[3] - d.rect[1]);
    }
    ctx.fillStyle = "#8f8672";
    ctx.fillRect(W.minX, W.minY, W.maxX - W.minX, W.maxY - W.minY - 0); // underlay edges
    for (const d of C.districts) {
      ctx.fillStyle = d.tint;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(d.rect[0], d.rect[1], d.rect[2] - d.rect[0], d.rect[3] - d.rect[1]);
      ctx.globalAlpha = 1;
    }
    // Block pavement: buildings sit on pavement, not on raw district tint.
    ctx.fillStyle = "#98907c";
    for (const r of City.blockRects) {
      ctx.fillRect(r.x - r.w / 2 - 1.6, r.y - r.d / 2 - 1.6, r.w + 3.2, r.d + 3.2);
    }
    // Beach sand and boardwalk along the shore strip.
    ctx.fillStyle = "#e2cb96";
    ctx.fillRect(W.minX, 736, W.maxX - W.minX, C.shoreY - 736);
    ctx.fillStyle = "#a9805a";
    ctx.fillRect(W.minX, C.boardwalkY, W.maxX - W.minX, C.shoreY - C.boardwalkY);
    ctx.strokeStyle = "rgba(90,60,30,0.35)";
    ctx.lineWidth = 0.5;
    for (let x = W.minX; x < W.maxX; x += 6) {
      ctx.beginPath(); ctx.moveTo(x, C.boardwalkY); ctx.lineTo(x, C.shoreY); ctx.stroke();
    }
    // Water: layered teal with slow moving glints.
    const grad = ctx.createLinearGradient(0, C.shoreY, 0, C.shoreY + 220);
    grad.addColorStop(0, "#2a9d8f");
    grad.addColorStop(1, "#14586e");
    ctx.fillStyle = grad;
    ctx.fillRect(W.minX - 200, C.shoreY, W.maxX - W.minX + 400, 320);
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 26; i++) {
      const y = C.shoreY + 8 + i * 9;
      const off = (t * 6 + i * 37) % 90;
      for (let x = W.minX - 60 + off; x < W.maxX + 60; x += 90) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y); ctx.stroke();
      }
    }
    // Pier: planks over the water, posts, and the escape boat at its end.
    ctx.fillStyle = "#8a6844";
    ctx.fillRect(C.pier.minX, C.pier.minY, C.pier.maxX - C.pier.minX, C.pier.maxY - C.pier.minY);
    ctx.fillStyle = "rgba(60,40,20,0.6)";
    for (let y = C.pier.minY + 6; y < C.pier.maxY; y += 12) {
      ctx.fillRect(C.pier.minX - 1.5, y, 1.8, 3);
      ctx.fillRect(C.pier.maxX - 0.3, y, 1.8, 3);
    }
    drawBoat(ctx, 900, 898);
    void view; void t;
  }

  function drawBoat(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#20455e";
    ctx.beginPath();
    ctx.moveTo(0, -11); ctx.lineTo(4.6, -4); ctx.lineTo(4.6, 8); ctx.lineTo(-4.6, 8); ctx.lineTo(-4.6, -4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f2ede2";
    ctx.fillRect(-3.4, -3, 6.8, 8);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-3.4, 3.4, 6.8, 1.6);
    ctx.fillStyle = "#bfe3ec";
    ctx.fillRect(-2.2, -1.4, 4.4, 3);
    ctx.restore();
  }

  function drawRoads(ctx, view) {
    const vr = viewRect(view);
    for (const e of City.edges) {
      const mx = (e.ax + e.bx) / 2, my = (e.ay + e.by) / 2;
      if (!inRect(vr, mx, my, e.len / 2)) continue;
      const ux = (e.bx - e.ax) / e.len, uy = (e.by - e.ay) / e.len;
      const px = -uy, py = ux;
      const sw = e.halfW + C.sidewalk;
      ctx.fillStyle = "#b3a58f";
      ctx.beginPath();
      ctx.moveTo(e.ax + px * sw - ux * 4, e.ay + py * sw - uy * 4);
      ctx.lineTo(e.bx + px * sw + ux * 4, e.by + py * sw + uy * 4);
      ctx.lineTo(e.bx - px * sw + ux * 4, e.by - py * sw + uy * 4);
      ctx.lineTo(e.ax - px * sw - ux * 4, e.ay - py * sw - uy * 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3d3a42";
      ctx.beginPath();
      ctx.moveTo(e.ax + px * e.halfW - ux * 4, e.ay + py * e.halfW - uy * 4);
      ctx.lineTo(e.bx + px * e.halfW + ux * 4, e.by + py * e.halfW + uy * 4);
      ctx.lineTo(e.bx - px * e.halfW + ux * 4, e.by - py * e.halfW + uy * 4);
      ctx.lineTo(e.ax - px * e.halfW - ux * 4, e.ay - py * e.halfW - uy * 4);
      ctx.closePath(); ctx.fill();
      // Lane divider dashes.
      ctx.strokeStyle = "rgba(230,220,160,0.55)";
      ctx.lineWidth = 0.35;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(e.ax, e.ay); ctx.lineTo(e.bx, e.by); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Crosswalks at junctions.
    ctx.fillStyle = "rgba(240,240,235,0.75)";
    for (const n of City.nodes) {
      if (!inRect(vr, n.x, n.y, 4)) continue;
      for (const eid of n.edges) {
        const e = City.edges[eid];
        const ux = (e.bx - e.ax) / e.len, uy = (e.by - e.ay) / e.len;
        const atA = e.a === n.id;
        const dirx = atA ? ux : -ux, diry = atA ? uy : -uy;
        const base = e.halfW + 0.8;
        for (let sIdx = -1; sIdx <= 1; sIdx++) {
          const cxp = n.x + dirx * base + -diry * sIdx * 3.4;
          const cyp = n.y + diry * base + dirx * sIdx * 3.4;
          ctx.save();
          ctx.translate(cxp, cyp);
          ctx.rotate(Math.atan2(diry, dirx));
          ctx.fillRect(-1.6, -1.1, 3.2, 2.2);
          ctx.restore();
        }
      }
    }
  }

  function drawSignFace(ctx, b, side) {
    const horiz = side === "N" || side === "S";
    const len = Math.min(horiz ? b.w : b.d, 6 + b.sign.length * 2.05);
    const thick = 4.4;
    let x = b.x, y = b.y;
    if (side === "N") y = b.y - b.d / 2 - thick / 2 - 0.4;
    if (side === "S") y = b.y + b.d / 2 + thick / 2 + 0.4;
    if (side === "W") x = b.x - b.w / 2 - thick / 2 - 0.4;
    if (side === "E") x = b.x + b.w / 2 + thick / 2 + 0.4;
    ctx.save();
    ctx.translate(x, y);
    if (!horiz) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#1d2733";
    ctx.fillRect(-len / 2, -thick / 2, len, thick);
    ctx.strokeStyle = "#f5c542";
    ctx.lineWidth = 0.28;
    ctx.strokeRect(-len / 2, -thick / 2, len, thick);
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "bold 2.9px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.sign, 0, 0.15);
    ctx.restore();
  }

  function drawSign(ctx, b) {
    if (!b.sign) return;
    drawSignFace(ctx, b, b.signSide);
    if (b.signBoth) {
      const opp = { N: "S", S: "N", E: "W", W: "E" }[b.signSide];
      drawSignFace(ctx, b, opp);
    }
  }

  function drawBuildings(ctx, view) {
    const vr = viewRect(view);
    for (const b of City.buildings) {
      if (!inRect(vr, b.x, b.y, Math.max(b.w, b.d))) continue;
      const shx = b.h * 0.16, shy = b.h * 0.22;
      ctx.fillStyle = "rgba(30,16,8,0.34)";
      ctx.fillRect(b.x - b.w / 2 + shx, b.y - b.d / 2 + shy, b.w, b.d);
      ctx.fillStyle = "#2c2620";
      ctx.fillRect(b.x - b.w / 2 - 0.5, b.y - b.d / 2 - 0.5, b.w + 1, b.d + 1);
      ctx.fillStyle = b.tint;
      ctx.fillRect(b.x - b.w / 2, b.y - b.d / 2, b.w, b.d);
      // Roof: district roof tint inset, plus a raised tier on tall blocks.
      ctx.fillStyle = b.roof;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(b.x - b.w / 2 + 1.6, b.y - b.d / 2 + 1.6, b.w - 3.2, b.d - 3.2);
      ctx.globalAlpha = 1;
      if (b.h > 24) {
        ctx.fillStyle = b.tint;
        ctx.fillRect(b.x - b.w / 4, b.y - b.d / 4, b.w / 2, b.d / 2);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 0.3;
        ctx.strokeRect(b.x - b.w / 4, b.y - b.d / 4, b.w / 2, b.d / 2);
      }
      if (b.landmark === "clocktower") {
        ctx.fillStyle = "#f4ead2";
        ctx.beginPath(); ctx.arc(b.x, b.y, 5.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#5a4632"; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.arc(b.x, b.y, 5.4, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#2c2620"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + 3.4, b.y - 1.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 1.2, b.y - 4.2); ctx.stroke();
      }
      if (b.landmark === "watertower") {
        ctx.fillStyle = "#7a8a94";
        ctx.beginPath(); ctx.arc(b.x, b.y, 7.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#aebfc8";
        ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
      }
      if (b.landmark === "market") {
        ctx.strokeStyle = "rgba(120,50,20,0.5)";
        ctx.lineWidth = 1.1;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(b.x - b.w / 2 + 3, b.y + k * 5);
          ctx.lineTo(b.x + b.w / 2 - 3, b.y + k * 5);
          ctx.stroke();
        }
      }
      drawSign(ctx, b);
    }
    // Shore landmarks with no building body.
    for (const lm of City.landmarks) {
      if (!inRect(vr, lm.x, lm.y, 30)) continue;
      if (lm.kind === "lighthouse") drawLighthouse(ctx, lm, view.time);
      if (lm.kind === "cranes") drawCranes(ctx, lm);
    }
  }

  function drawLighthouse(ctx, lm, t) {
    // Rotating beam first (under the tower), two opposed cones.
    const ang = t * 0.7;
    for (const flip of [0, Math.PI]) {
      const a = ang + flip;
      const g = ctx.createRadialGradient(lm.x, lm.y, 2, lm.x, lm.y, 46);
      g.addColorStop(0, "rgba(255,240,180,0.34)");
      g.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lm.x, lm.y);
      ctx.arc(lm.x, lm.y, 46, a - 0.24, a + 0.24);
      ctx.closePath(); ctx.fill();
    }
    // Cast shadow, offset down-sun: from the air a shadow is what makes
    // a tower read as tall instead of painted flat on the point.
    ctx.fillStyle = "rgba(24,30,38,0.35)";
    ctx.beginPath(); ctx.arc(lm.x + 3.4, lm.y + 4.6, 8.2, 0, Math.PI * 2); ctx.fill();
    // Rocky point.
    ctx.fillStyle = "#6a7076";
    ctx.beginPath(); ctx.arc(lm.x, lm.y, 9.5, 0, Math.PI * 2); ctx.fill();
    // Tower: the red/white paint wraps a cylinder in vertical stripes,
    // so from above the stripes radiate as wedges from the centre —
    // nested rings would read as a target, wedges read as a tower.
    const SECTORS = 12, towerR = 7.4;
    for (let i = 0; i < SECTORS; i++) {
      const a0 = -Math.PI / 2 + (i * Math.PI * 2) / SECTORS;
      const a1 = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / SECTORS;
      ctx.fillStyle = i % 2 ? "#f2ede2" : "#c0392b";
      ctx.beginPath();
      ctx.moveTo(lm.x, lm.y);
      ctx.arc(lm.x, lm.y, towerR, a0, a1);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "rgba(28,34,42,0.55)";
    ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.arc(lm.x, lm.y, towerR, 0, Math.PI * 2); ctx.stroke();
    // Gallery: a dark iron ring around the lamp room.
    ctx.fillStyle = "#232a33";
    ctx.beginPath(); ctx.arc(lm.x, lm.y, 3.5, 0, Math.PI * 2); ctx.fill();
    // Lamp: bright core with a white-hot centre.
    ctx.fillStyle = "#ffe9a0";
    ctx.beginPath(); ctx.arc(lm.x, lm.y, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fffbe8";
    ctx.beginPath(); ctx.arc(lm.x, lm.y, 1.0, 0, Math.PI * 2); ctx.fill();
    // Name board on the land side.
    ctx.fillStyle = "#1d2733";
    ctx.fillRect(lm.x - 11, lm.y - 15.5, 22, 4.2);
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "bold 2.9px Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("FARO SERENA", lm.x, lm.y - 13.3);
  }

  function drawCranes(ctx, lm) {
    for (const dx of [-26, 26]) {
      const x = lm.x + dx, y = lm.y;
      ctx.strokeStyle = "#d35400";
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x - 7, y + 6); ctx.lineTo(x, y - 12); ctx.lineTo(x + 7, y + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 20, y - 6); ctx.stroke();
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x + 17, y - 6.6); ctx.lineTo(x + 17, y + 2); ctx.stroke();
      ctx.fillStyle = "#7a4a21";
      ctx.fillRect(x + 14.6, y + 2, 4.8, 3.6);
    }
    ctx.fillStyle = "#1d2733";
    ctx.fillRect(lm.x - 14, lm.y - 24, 28, 4.4);
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "bold 3px Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("MARINA DOCK", lm.x, lm.y - 21.7);
  }

  function drawProps(ctx, view) {
    const vr = viewRect(view);
    for (const p of City.props) {
      if (!inRect(vr, p.x, p.y, 4)) continue;
      if (p.type === "palm") {
        ctx.strokeStyle = "#5a4632"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.8, p.y - 1.6); ctx.stroke();
        ctx.strokeStyle = "#2e7d46"; ctx.lineWidth = 0.9;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(p.x + 0.8, p.y - 1.6);
          ctx.lineTo(p.x + 0.8 + Math.cos(a) * 3.4, p.y - 1.6 + Math.sin(a) * 3.4);
          ctx.stroke();
        }
      } else if (p.type === "tree") {
        ctx.fillStyle = "#3f7a37";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#57984c";
        ctx.beginPath(); ctx.arc(p.x - 0.8, p.y - 0.8, 1.7, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#3a3f46";
        ctx.fillRect(p.x - 0.3, p.y - 0.3, 0.6, 0.6);
        ctx.fillStyle = "#ffd98a";
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.55, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCarBody(ctx, car, t) {
    const L = car.len || 4.5, Wd = 2.0;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    ctx.fillStyle = "rgba(20,10,5,0.35)";
    ctx.fillRect(-L / 2 + 0.7, -Wd / 2 + 0.9, L, Wd);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 0.55);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.18; ctx.stroke();
    ctx.fillStyle = "rgba(20,26,34,0.9)";
    ctx.fillRect(-0.4, -Wd / 2 + 0.28, 1.5, Wd - 0.56); // windshield + cabin glass
    ctx.fillStyle = car.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-1.5, -Wd / 2 + 0.34, 1.0, Wd - 0.68); // roof
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff6c8";
    ctx.fillRect(L / 2 - 0.25, -Wd / 2 + 0.25, 0.28, 0.42);
    ctx.fillRect(L / 2 - 0.25, Wd / 2 - 0.67, 0.28, 0.42);
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(-L / 2 - 0.03, -Wd / 2 + 0.25, 0.24, 0.4);
    ctx.fillRect(-L / 2 - 0.03, Wd / 2 - 0.65, 0.24, 0.4);
    if (car.police) {
      ctx.fillStyle = "#f4f6f8";
      ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
      ctx.fillStyle = "#2456a8";
      ctx.fillRect(-0.9, -Wd / 2, 1.7, Wd);
      ctx.fillStyle = car.color;
      ctx.fillRect(-1.5, -Wd / 2 + 0.34, 1.0, Wd - 0.68);
      const flash = Math.floor(t * 3) % 2 === 0;
      ctx.fillStyle = flash ? "#ff3b30" : "#5a1616";
      ctx.fillRect(-0.55, -0.62, 0.52, 0.5);
      ctx.fillStyle = flash ? "#2e6bff" : "#16265a";
      ctx.fillRect(-0.55, 0.12, 0.52, 0.5);
      ctx.fillStyle = "#12233d";
      ctx.font = "bold 0.95px Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("SBPD", 0.1, 0);
    }
    ctx.restore();
  }

  function drawPedFigure(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(20,10,5,0.3)";
    ctx.beginPath(); ctx.arc(0.3, 0.4, 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlayerFigure(ctx, pl, t) {
    ctx.save();
    ctx.translate(pl.x, pl.y);
    ctx.fillStyle = "rgba(20,10,5,0.35)";
    ctx.beginPath(); ctx.arc(0.35, 0.45, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(pl.heading);
    ctx.fillStyle = "#0f766e";
    ctx.beginPath(); ctx.arc(0, 0, 0.66, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2c094";
    ctx.beginPath(); ctx.arc(0.1, 0, 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.moveTo(0.95, 0); ctx.lineTo(0.35, -0.34); ctx.lineTo(0.35, 0.34);
    ctx.closePath(); ctx.fill();
    if (pl.armed) {
      ctx.fillStyle = "#22262b";
      ctx.fillRect(0.55, -0.09, 0.75, 0.18);
    }
    ctx.restore();
    void t;
  }

  function drawWorld(ctx, view, t) {
    ctx.save();
    ctx.translate(view.w / 2, view.h / 2);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.cx, -view.cy);
    view.time = t;
    drawGround(ctx, view, t);
    drawRoads(ctx, view);
    drawBuildings(ctx, view);
    drawProps(ctx, view);
    ctx.restore();
  }

  return { drawWorld, drawCarBody, drawPedFigure, drawPlayerFigure, viewRect };
})();

window.SBRender = SBRender;
