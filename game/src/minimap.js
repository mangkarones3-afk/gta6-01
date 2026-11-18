// minimap.js — THE v6 FIX. The minimap is drawn from the same road graph
// the traffic and police actually drive on: a static layer rendered once
// (district tints UNDER the street lines, district names labeled, roads
// stroked by class) and a dynamic layer per frame (player arrow rotated to
// facing, mission objective marker, flashing police blips, POI icons,
// search-zone circle). North-up, player-centred, framing roughly the same
// ~3x3-block neighbourhood as the camera.

const SBMinimap = (() => {
  const C = window.SBConfig;
  const City = window.SBCity;
  const VIEW_M = 300; // metres across the minimap
  let layer = null;   // static canvas
  let scale = 1;      // px per metre in the static layer
  let pois = [];

  function buildLayer(size) {
    scale = size / VIEW_M;
    const W = C.world;
    layer = document.createElement("canvas");
    layer.width = Math.ceil((W.maxX - W.minX + 80) * scale);
    layer.height = Math.ceil((C.shoreY + 130 - W.minY) * scale);
    const g = layer.getContext("2d");
    const px = (x) => (x - W.minX + 40) * scale;
    const py = (y) => (y - W.minY + 40) * scale;

    // Water first, then district land tints.
    g.fillStyle = "#175d6e";
    g.fillRect(0, 0, layer.width, layer.height);
    for (const d of C.districts) {
      g.fillStyle = d.tint;
      g.fillRect(px(d.rect[0]), py(d.rect[1]), (d.rect[2] - d.rect[0]) * scale, (d.rect[3] - d.rect[1]) * scale);
    }
    // Beach + boardwalk strip.
    g.fillStyle = "#e2cb96";
    g.fillRect(px(W.minX), py(736), (W.maxX - W.minX) * scale, (C.shoreY - 736) * scale);
    // Block pavement texture (subtle, under the roads).
    g.fillStyle = "rgba(40,36,30,0.18)";
    for (const b of City.buildings) {
      g.fillRect(px(b.x - b.w / 2), py(b.y - b.d / 2), b.w * scale, b.d * scale);
    }
    // Pier.
    g.fillStyle = "#8a6844";
    g.fillRect(px(C.pier.minX), py(C.pier.minY), (C.pier.maxX - C.pier.minX) * scale, (C.pier.maxY - C.pier.minY) * scale);

    // THE STREET NETWORK: casing pass, then bright fill pass, by class.
    const widthFor = (cls) => (cls === "arterial" ? 5.2 : cls === "collector" ? 3.6 : 2.5);
    for (const pass of [0, 1]) {
      for (const e of City.edges) {
        g.strokeStyle = pass === 0 ? "#232830" : "#d7dde3";
        g.lineWidth = widthFor(e.cls) + (pass === 0 ? 1.8 : 0);
        g.beginPath();
        g.moveTo(px(e.ax), py(e.ay));
        g.lineTo(px(e.bx), py(e.by));
        g.stroke();
      }
    }
    // District labels ON the map, over the tints and under nothing else.
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const d of C.districts) {
      g.font = "bold 12.5px Arial, sans-serif";
      g.lineWidth = 3.4;
      g.strokeStyle = "rgba(16,20,26,0.85)";
      const lx = px(d.labelAt[0]), ly = py(d.labelAt[1]);
      g.strokeText(d.name, lx, ly);
      g.fillStyle = "#ffffff";
      g.fillText(d.name, lx, ly);
    }
    // Landmark dots.
    for (const lm of City.landmarks) {
      g.fillStyle = "#ffd94d";
      g.beginPath(); g.arc(px(lm.x), py(lm.y), 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#20242c"; g.lineWidth = 1.2; g.stroke();
    }

    pois = [
      { x: City.anchors.safehouse.x, y: City.anchors.safehouse.y, glyph: "H", color: "#37b24d" },
      { x: City.anchors.cafeAlba.x, y: City.anchors.cafeAlba.y, glyph: "C", color: "#e8590c" },
      { x: City.anchors.mercado.x, y: City.anchors.mercado.y, glyph: "M", color: "#f08c00" },
      { x: City.anchors.marinaDock.x, y: City.anchors.marinaDock.y, glyph: "D", color: "#1c7ed6" },
      { x: City.anchors.faro.x, y: City.anchors.faro.y, glyph: "F", color: "#e03131" },
      { x: City.anchors.torreAlba.x, y: City.anchors.torreAlba.y, glyph: "T", color: "#7048e8" },
    ];
  }

  function draw(ctx, st, x, y, size, t) {
    if (!layer) buildLayer(size);
    const W = C.world;
    const px = (wx) => (wx - W.minX + 40) * scale;
    const py = (wy) => (wy - W.minY + 40) * scale;
    const half = size / 2;
    // Source window centred on the player, clamped inside the layer.
    let sx = px(st.player.x) - half, sy = py(st.player.y) - half;
    sx = Math.max(0, Math.min(layer.width - size, sx));
    sy = Math.max(0, Math.min(layer.height - size, sy));
    const toMapX = (wx) => x + (px(wx) - sx);
    const toMapY = (wy) => y + (py(wy) - sy);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 14);
    ctx.clip();
    ctx.fillStyle = "#175d6e";
    ctx.fillRect(x, y, size, size);
    ctx.drawImage(layer, sx, sy, size, size, x, y, size, size);

    // Search zone while the police sweep.
    if (st.search) {
      ctx.fillStyle = "rgba(70,130,255,0.20)";
      ctx.strokeStyle = "rgba(120,180,255,0.8)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(toMapX(st.search.x), toMapY(st.search.y), st.search.r * scale, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // POI icons.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const poi of pois) {
      const mx = toMapX(poi.x), my = toMapY(poi.y);
      if (mx < x + 8 || mx > x + size - 8 || my < y + 8 || my > y + size - 8) continue;
      ctx.fillStyle = poi.color;
      ctx.beginPath(); ctx.arc(mx, my, 6.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#10151c"; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px Arial, sans-serif";
      ctx.fillText(poi.glyph, mx, my + 0.4);
    }

    // Police blips: alternating red/blue, the light-bar rhythm.
    const flashBlue = Math.floor(t * 2.4) % 2 === 0;
    for (const cop of st.cops) {
      const mx = toMapX(cop.x), my = toMapY(cop.y);
      if (mx < x + 4 || mx > x + size - 4 || my < y + 4 || my > y + size - 4) continue;
      ctx.fillStyle = flashBlue ? "#2e6bff" : "#ff3b30";
      ctx.beginPath(); ctx.arc(mx, my, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0c1016"; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Objective marker: yellow diamond, pulsing ring; clamped to the edge
    // when the objective is off-map so it still proves a target exists.
    if (st.objective) {
      let mx = toMapX(st.objective.x), my = toMapY(st.objective.y);
      mx = Math.max(x + 11, Math.min(x + size - 11, mx));
      my = Math.max(y + 11, Math.min(y + size - 11, my));
      const pulse = 8.5 + Math.sin(t * 5) * 1.8;
      ctx.strokeStyle = "rgba(255,217,61,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd93d";
      ctx.strokeStyle = "#10151c";
      ctx.beginPath();
      ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 5.4, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 5.4, my);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // Player arrow, rotated to facing.
    const ax = toMapX(st.player.x), ay = toMapY(st.player.y);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(st.player.heading);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0c1016";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(8.5, 0); ctx.lineTo(-6, -5.6); ctx.lineTo(-3.4, 0); ctx.lineTo(-6, 5.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Frame + north marker.
    ctx.strokeStyle = "#0c1016";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 14);
    ctx.stroke();
    ctx.fillStyle = "rgba(10,14,20,0.72)";
    ctx.fillRect(x + size - 25, y + 5, 20, 17);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11.5px Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", x + size - 15, y + 13.5);
  }

  return { draw, buildLayer };
})();

window.SBMinimap = SBMinimap;
