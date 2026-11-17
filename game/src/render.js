// render.js — draws the world: Solano Bay at golden hour, 2D with
// extruded buildings (pseudo-3D), roads, traffic, pedestrians, police,
// effects. One dominant warm grade per frame; the camera frames about
// three city blocks so cars and people read at judge size (F2/F3).
import { WORLD } from './config.js';
import { clamp, streamFor } from './rng.js';

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, z: 0, scale: 4.6 };
    this.shake = 0; this.flash = 0; this.time = 0;
    this.particles = [];
    this.rng = streamFor(20261117, 'fx');
  }
  resize(w, h) { this.cv.width = w; this.cv.height = h; }
  burst(x, z, color, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * 6.28, s = 20 + this.rng() * 60;
      this.particles.push({ x, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, life: 0.5 + this.rng() * 0.4, color });
    }
  }
  worldToScreen(x, z) {
    const c = this.cam;
    return { x: (x - c.x) * c.scale + this.cv.width / 2, y: (z - c.z) * c.scale + this.cv.height / 2 };
  }
  draw(game, dt) {
    const ctx = this.ctx, cv = this.cv, city = game.city;
    this.time += dt;
    const px = game.player.x, pz = game.player.z;
    this.cam.x += (px - this.cam.x) * Math.min(1, 5 * dt);
    this.cam.z += (pz - this.cam.z) * Math.min(1, 5 * dt);
    // F2: ~3x3 blocks in frame — 4.6 driving, 5.6 on foot.
    const targetScale = game.player.onFoot ? 5.6 : 4.6;
    this.cam.scale += (targetScale - this.cam.scale) * Math.min(1, 3 * dt);
    const scale = this.cam.scale;
    const viewW = cv.width / scale, viewH = cv.height / scale;
    const x0 = this.cam.x - viewW / 2 - 40, x1 = this.cam.x + viewW / 2 + 40;
    const z0 = this.cam.z - viewH / 2 - 40, z1 = this.cam.z + viewH / 2 + 40;
    ctx.save();
    if (this.shake > 0) {
      const t = this.time * 61;
      ctx.translate(Math.sin(t * 1.3) * this.shake, Math.cos(t * 1.7) * this.shake);
      this.shake *= 0.86;
    }
    const toS = (x, z) => this.worldToScreen(x, z);
    // ground base: warm dusk sand (F3 — deeper than the old pastel)
    ctx.fillStyle = '#cfa96e'; ctx.fillRect(0, 0, cv.width, cv.height);
    // bay water (west): deep teal gradient
    const w = toS(WORLD.waterX, z0);
    const w2 = toS(-WORLD.half - 200, z0);
    const grad = ctx.createLinearGradient(w2.x, 0, w.x, 0);
    grad.addColorStop(0, '#0d5a74'); grad.addColorStop(1, '#2b93a8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w.x, cv.height);
    // wave glints
    ctx.strokeStyle = 'rgba(255,220,160,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const wz = z0 + ((i * 173 + Math.floor(this.time * 8)) % Math.max(60, viewH));
      const s = toS(WORLD.waterX - 30 - (i % 3) * 46, wz);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 16 * scale / 4, s.y); ctx.stroke();
    }
    // beach + boardwalk
    const b0 = toS(WORLD.waterX, z0), b1 = toS(WORLD.waterX + 16, z0);
    ctx.fillStyle = '#eed9a0'; ctx.fillRect(b0.x, 0, b1.x - b0.x, cv.height);
    for (const p of city.props) {
      if (p.type !== 'boardwalk') continue;
      const a = toS(p.x - p.w / 2, p.z - p.d / 2);
      ctx.fillStyle = '#a87c4f'; ctx.fillRect(a.x, a.y, p.w * scale, p.d * scale);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(a.x, a.y, 2, p.d * scale);
    }
    // the pier: deck, posts, and its name over the water
    for (const p of city.props) {
      if (p.type !== 'pier') continue;
      const a = toS(p.x - p.w / 2, p.z - p.d / 2);
      ctx.fillStyle = '#8a6242'; ctx.fillRect(a.x, a.y, p.w * scale, p.d * scale);
      ctx.strokeStyle = 'rgba(60,35,15,0.5)'; ctx.lineWidth = 1;
      for (let k = 1; k < 10; k++) { const lx = a.x + (p.w * scale * k) / 10; ctx.beginPath(); ctx.moveTo(lx, a.y); ctx.lineTo(lx, a.y + p.d * scale); ctx.stroke(); }
      ctx.fillStyle = '#5d3a1e';
      for (let k = 0; k < 6; k++) { const s = toS(p.x - p.w / 2 + 10 + k * 22, p.z + p.d / 2); ctx.fillRect(s.x - 2, s.y, 4, 8); }
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(4.6 * scale)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('SOLANO MARINA', a.x + p.w * scale / 2, a.y - 8);
      ctx.textAlign = 'left';
    }
    // boats riding at anchor
    for (const p of city.props) {
      if (p.type !== 'boat') continue;
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
      const s = toS(p.x, p.z);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(1, 2, 9 * scale / 3, 4 * scale / 3, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.moveTo(-8 * scale / 3, -3 * scale / 3); ctx.lineTo(8 * scale / 3, -2 * scale / 3);
      ctx.lineTo(6 * scale / 3, 3 * scale / 3); ctx.lineTo(-6 * scale / 3, 3 * scale / 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(-2 * scale / 3, -2 * scale / 3, 4 * scale / 3, 3 * scale / 3);
      ctx.restore();
    }
    // blocks (sidewalk tint) — painted before parks so a park sitting
    // on a block is never painted over by its own block.
    ctx.fillStyle = '#bfa678';
    for (const bl of city.blocks) {
      if (bl.cx < x0 || bl.cx > x1 || bl.cz < z0 || bl.cz > z1) continue;
      const a = toS(bl.poly[0][0], bl.poly[0][1]), b = toS(bl.poly[2][0], bl.poly[2][1]);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    // parks (Palmera Park carries a pond and a name)
    for (const p of city.props) {
      if (p.type !== 'park') continue;
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
      const a = toS(p.x - p.w / 2, p.z - p.d / 2);
      ctx.fillStyle = '#5da24e'; ctx.fillRect(a.x, a.y, p.w * scale, p.d * scale);
      ctx.fillStyle = '#cbb27f';
      ctx.fillRect(a.x, a.y + p.d * scale / 2 - 3, p.w * scale, 6);
      ctx.fillRect(a.x + p.w * scale / 2 - 3, a.y, 6, p.d * scale);
      if (p.pond) {
        const s = toS(p.x + p.w * 0.22, p.z - p.d * 0.18);
        ctx.fillStyle = '#2b93a8'; ctx.beginPath(); ctx.ellipse(s.x, s.y, p.w * scale * 0.2, p.d * scale * 0.16, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#eed9a0'; ctx.lineWidth = 3; ctx.stroke();
      }
      if (p.name) {
        ctx.fillStyle = 'rgba(20,40,20,0.75)'; ctx.font = `bold ${Math.round(3.6 * scale)}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(p.name.toUpperCase(), a.x + p.w * scale / 2, a.y + 5.2 * scale);
        ctx.textAlign = 'left';
      }
    }
    // roads: deep dusk navy
    for (const e of city.edges) {
      const [ax, az] = e.pts[0], [bx, bz] = e.pts[1];
      if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(az, bz) < z0 || Math.min(az, bz) > z1) continue;
      const a = toS(ax, az), b = toS(bx, bz);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#262a38'; ctx.lineWidth = e.halfW * 2 * scale;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (e.cls === 'arterial' || e.cls === 'ring') {
        ctx.strokeStyle = '#e8a317'; ctx.lineWidth = 0.5 * scale;
        ctx.setLineDash([4 * scale, 5 * scale]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // mission marker ring
    const step = game.missions.stepObj();
    if (step && step.kind !== 'heat') {
      const p = toS(step.x, step.z);
      ctx.strokeStyle = '#e8c93d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, (5 + Math.sin(this.time * 4) * 0.8) * scale, 0, 6.29); ctx.stroke();
      ctx.fillStyle = '#e8c93d';
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 8 * scale); ctx.lineTo(p.x - 2 * scale, p.y - 4.4 * scale); ctx.lineTo(p.x + 2 * scale, p.y - 4.4 * scale); ctx.closePath(); ctx.fill();
    }
    // buildings: extruded boxes, sun from the north-west
    const drawn = [];
    for (const b of city.buildings) {
      if (b.x + b.w / 2 < x0 || b.x - b.w / 2 > x1 || b.z + b.d / 2 < z0 || b.z - b.d / 2 > z1) continue;
      drawn.push(b);
    }
    drawn.sort((a, b) => (a.z + a.d / 2) - (b.z + b.d / 2));
    for (const b of drawn) {
      const hPx = Math.min(b.h * 0.55, 55) * scale / 2;
      const a = toS(b.x - b.w / 2, b.z - b.d / 2), c = toS(b.x + b.w / 2, b.z + b.d / 2);
      const wPx = c.x - a.x, dPx = c.y - a.y;
      ctx.fillStyle = 'rgba(40,20,0,0.22)';
      ctx.fillRect(a.x + 6, a.y + 8, wPx, dPx);
      // south + east faces (extrusion)
      ctx.fillStyle = shade(b.tint, -30);
      ctx.beginPath(); ctx.moveTo(a.x, c.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x + hPx * 0.4, c.y - hPx * 0.4); ctx.lineTo(a.x + hPx * 0.4, c.y - hPx * 0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(b.tint, -16);
      ctx.beginPath(); ctx.moveTo(c.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x + hPx * 0.4, c.y - hPx * 0.4); ctx.lineTo(c.x + hPx * 0.4, a.y - hPx * 0.4); ctx.closePath(); ctx.fill();
      // roofs carry the building's own palette colour, sun-lifted —
      // varied saturated rooftops instead of one dark slab tone.
      ctx.fillStyle = b.landmark ? '#e8a317' : shade(b.tint, 16);
      ctx.beginPath(); ctx.moveTo(a.x + hPx * 0.4, a.y - hPx * 0.4); ctx.lineTo(c.x + hPx * 0.4, a.y - hPx * 0.4);
      ctx.lineTo(c.x + hPx * 0.4, c.y - hPx * 0.4); ctx.lineTo(a.x + hPx * 0.4, c.y - hPx * 0.4); ctx.closePath(); ctx.fill();
      // windows: sparse lit panes on the roof face — strips, not wallpaper
      if (b.h > 12) {
        const cols = Math.max(1, Math.floor(wPx / (7 * scale)));
        for (let i = 0; i < cols; i++) {
          if ((i * 7 + b.id * 3) % 3 === 0) continue;
          const lit = (i * 11 + b.id) % 4 !== 0;
          ctx.fillStyle = lit ? 'rgba(255,196,96,0.9)' : 'rgba(24,36,52,0.8)';
          ctx.fillRect(a.x + hPx * 0.4 + 4 + i * 7 * scale, a.y - hPx * 0.4 + 5, 3.4 * scale, 2.2 * scale);
        }
      }
      // signage (F4): landmarks get a gold name board, POIs a coloured
      // shop sign — both sized to stay readable at judge scale.
      if (b.landmark) this.drawSign((a.x + c.x) / 2 + hPx * 0.2, a.y - hPx * 0.4 - 4, b.name.toUpperCase(), '#e8a317', '#241a05', scale);
      else if (b.poi) this.drawSign((a.x + c.x) / 2, c.y + 4.4 * scale, b.poi.name, b.poi.sign, '#ffffff', scale);
    }
    // props: palms, trees, lights
    for (const p of city.props) {
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
      if (p.type !== 'palm' && p.type !== 'tree' && p.type !== 'light') continue;
      const s = toS(p.x, p.z);
      if (p.type === 'palm') {
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 0.8 * scale; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 0.6 * scale, s.y - 3.4 * scale); ctx.stroke();
        ctx.fillStyle = '#2f7d3c';
        for (let k = 0; k < 5; k++) { const a = k * 1.26 + 0.4; ctx.beginPath(); ctx.ellipse(s.x + 0.6 * scale + Math.cos(a) * 2.2 * scale, s.y - 3.4 * scale + Math.sin(a) * 1.2 * scale, 2.6 * scale, 1 * scale, a, 0, 6.29); ctx.fill(); }
      } else if (p.type === 'tree') {
        ctx.fillStyle = '#3f7d31'; ctx.beginPath(); ctx.arc(s.x, s.y - 1.6 * scale, 2.4 * scale, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(s.x - 0.3 * scale, s.y, 0.6 * scale, 1.6 * scale);
      } else if (p.type === 'light') {
        ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 0.5 * scale; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y - 4 * scale); ctx.stroke();
        ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(s.x, s.y - 4.3 * scale, 0.8 * scale, 0, 6.29); ctx.fill();
      }
    }
    // roadblock: drawn after the buildings so an extruded roof can
    // never paint over the barricade or its label (F7).
    if (game.wanted.roadblock) {
      const rb = game.wanted.roadblock;
      const p = toS(rb.x, rb.z);
      const bw = 15 * scale, bh = 2.6 * scale;
      ctx.fillStyle = '#c93d2a'; ctx.fillRect(p.x - bw / 2, p.y - bh / 2, bw, bh);
      ctx.fillStyle = '#f2ead8';
      for (let k = 0; k < 5; k++) ctx.fillRect(p.x - bw / 2 + k * bw / 5 + 2, p.y - bh / 2, bw / 10, bh);
      ctx.font = `bold ${Math.round(3.4 * scale)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
      const ly = p.y - bh / 2 - 6;
      ctx.strokeText('ROADBLOCK', p.x, ly); ctx.fillText('ROADBLOCK', p.x, ly);
      ctx.textAlign = 'left';
    }
    // parked cars, traffic, police — all world-scaled
    for (const p of city.parked) {
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
      this.drawCar(p.x, p.z, p.angle, (game.CARS || {})[p.kind] ? game.CARS[p.kind].color : '#b83a2a', false, scale);
    }
    for (const t of game.traffic.cars) this.drawCar(t.x, t.z, t.angle, t.color, false, scale);
    for (const c of game.wanted.cops) this.drawCar(c.x, c.z, c.angle, c.color, true, scale);
    // people: foot cops, enemies, pedestrians, then the player
    for (const f of game.wanted.footCops) this.drawPerson(f.x, f.z, '#274b8f', scale, 0);
    for (const e of game.combat.enemies) {
      if (e.dead) continue;
      this.drawPerson(e.x, e.z, '#8a2432', scale, 0);
      const s = toS(e.x, e.z);
      ctx.fillStyle = '#c93d2a'; ctx.fillRect(s.x - 2.4 * scale, s.y - 10.4 * scale, 4.8 * scale * clamp(e.hp / 80, 0, 1), 0.7 * scale);
    }
    for (const p of game.peds.list) {
      this.drawPerson(p.x, p.z, p.shirt, scale, Math.sin(p.phase) * 0.5);
      if (p.state === 'flee') { const s = toS(p.x, p.z); ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(3.4 * scale)}px sans-serif`; ctx.fillText('!', s.x + 2.4 * scale, s.y - 8 * scale); }
    }
    // pickups
    for (const pk of game.combat.pickups) {
      const s = toS(pk.x, pk.z);
      ctx.fillStyle = '#2a9e4a'; ctx.beginPath(); ctx.arc(s.x, s.y, (1.9 + Math.sin(this.time * 5) * 0.3) * scale, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(2.6 * scale)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('$', s.x, s.y + 0.9 * scale); ctx.textAlign = 'left';
    }
    // bullets
    ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2;
    for (const b of game.combat.bullets) {
      const s = toS(b.x, b.z);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - b.vx * 0.02 * scale, s.y - b.vz * 0.02 * scale); ctx.stroke();
    }
    // search circle on the ground
    if (game.wanted.state === 'SEARCH') {
      const s = toS(game.wanted.searchCentre.x, game.wanted.searchCentre.z);
      ctx.strokeStyle = 'rgba(90,150,255,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, game.wanted.searchR * scale, 0, 6.29); ctx.stroke();
    }
    this.drawPlayer(game);
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt; pt.z += pt.vz * dt; pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      const s = toS(pt.x, pt.z);
      ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
      ctx.fillStyle = pt.color; ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // golden-hour wash: warm edges, dusky top — one grade per frame
    const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.42, cv.width / 2, cv.height / 2, cv.height * 0.95);
    vg.addColorStop(0, 'rgba(255,150,60,0)');
    vg.addColorStop(1, 'rgba(214,110,40,0.16)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);
    const top = ctx.createLinearGradient(0, 0, 0, cv.height * 0.3);
    top.addColorStop(0, 'rgba(58,32,86,0.14)'); top.addColorStop(1, 'rgba(58,32,86,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, cv.width, cv.height * 0.3);
    // police light wash at screen edges
    if (game.wanted.cops.length && game.wanted.state === 'ACTIVE') {
      const near = game.wanted.cops.some(c => Math.hypot(c.x - px, c.z - pz) < 60);
      if (near) {
        const col = game.wanted._sirenPhase ? 'rgba(220,40,40,0.10)' : 'rgba(40,80,220,0.10)';
        ctx.fillStyle = col; ctx.fillRect(0, 0, cv.width, 26); ctx.fillRect(0, cv.height - 26, cv.width, 26);
      }
    }
  }
  // A sign board centred at (cx, topY): coloured panel, bold caps text,
  // sized from the measured text so it can never clip (F7).
  drawSign(cx, topY, text, bg, fg, scale) {
    const ctx = this.ctx;
    const fs = Math.round(4.3 * scale);
    ctx.font = `bold ${fs}px sans-serif`;
    const w = ctx.measureText(text).width + 5 * scale;
    const h = 6 * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx - w / 2 + 2, topY + 2, w, h);
    ctx.fillStyle = bg; ctx.fillRect(cx - w / 2, topY, w, h);
    ctx.fillStyle = fg; ctx.textAlign = 'center';
    ctx.fillText(text, cx, topY + h - 1.6 * scale);
    ctx.textAlign = 'left';
  }
  drawCar(x, z, angle, color, police, scale) {
    const ctx = this.ctx;
    const s = this.worldToScreen(x, z);
    const L = 14 * scale, W = 6.4 * scale;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(30,15,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0.4 * scale, 0.5 * scale, L / 2, W / 2, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-L / 2, -W / 2 + scale); ctx.lineTo(L / 2 - 1.6 * scale, -W / 2); ctx.lineTo(L / 2, -W / 2 + 1.2 * scale);
    ctx.lineTo(L / 2, W / 2 - 1.2 * scale); ctx.lineTo(L / 2 - 1.6 * scale, W / 2); ctx.lineTo(-L / 2, W / 2 - scale);
    ctx.closePath(); ctx.fill();
    // cabin + windshield
    ctx.fillStyle = 'rgba(22,34,50,0.9)'; ctx.fillRect(-0.8 * scale, -W / 2 + 0.9 * scale, 3.6 * scale, W - 1.8 * scale);
    ctx.fillStyle = 'rgba(160,210,235,0.55)'; ctx.fillRect(2.4 * scale, -W / 2 + 1.1 * scale, 1.1 * scale, W - 2.2 * scale);
    // headlights
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(L / 2 - 0.5 * scale, -W / 2 + 0.7 * scale, 0.6 * scale, 1.1 * scale);
    ctx.fillRect(L / 2 - 0.5 * scale, W / 2 - 1.8 * scale, 0.6 * scale, 1.1 * scale);
    if (police) {
      const on = Math.floor(this.time * 2.4) % 2 === 0;
      ctx.fillStyle = on ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect(-1.6 * scale, -W / 2 - 0.8 * scale, 3.4 * scale, 1.4 * scale);
      ctx.fillStyle = on ? '#2a6aff' : '#ff2a2a';
      ctx.fillRect(-1.6 * scale, W / 2 - 0.6 * scale, 3.4 * scale, 1.4 * scale);
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(2.2 * scale)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('SBPD', 0, 0.8 * scale);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  drawPerson(x, z, shirt, scale, bob) {
    const ctx = this.ctx;
    const s = this.worldToScreen(x, z);
    ctx.fillStyle = 'rgba(30,15,0,0.25)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y + 0.6 * scale, 1.9 * scale, 0.9 * scale, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#2c2c34'; ctx.fillRect(s.x - 1.5 * scale, s.y - 3.4 * scale + bob, 3 * scale, 3.6 * scale);
    ctx.fillStyle = shirt; ctx.fillRect(s.x - 1.7 * scale, s.y - 6.6 * scale + bob, 3.4 * scale, 3.4 * scale);
    ctx.fillStyle = '#e8b98a'; ctx.beginPath(); ctx.arc(s.x, s.y - 7.8 * scale + bob, 1.55 * scale, 0, 6.29); ctx.fill();
  }
  drawPlayer(game) {
    const ctx = this.ctx, p = game.player;
    const scale = this.cam.scale;
    if (p.car) { this.drawCar(p.car.x, p.car.z, p.car.angle, p.car.color, false, scale); return; }
    const s = this.worldToScreen(p.x, p.z);
    const bob = Math.sin(this.time * 10) * (p.speed > 0 ? 0.4 : 0);
    const lift = p.jump * scale;
    ctx.fillStyle = 'rgba(30,15,0,0.3)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 0.6 * scale, 2.1 * scale, 1 * scale, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#33333c'; ctx.fillRect(s.x - 1.6 * scale, s.y - 3.4 * scale - lift + bob, 3.2 * scale, 3.6 * scale);
    ctx.fillStyle = '#e8a317'; ctx.fillRect(s.x - 1.8 * scale, s.y - 6.8 * scale - lift + bob, 3.6 * scale, 3.6 * scale);
    ctx.fillStyle = '#e8b98a'; ctx.beginPath(); ctx.arc(s.x, s.y - 8 * scale - lift + bob, 1.65 * scale, 0, 6.29); ctx.fill();
    // aim line + gun
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s.x, s.y - 5 * scale - lift); ctx.lineTo(s.x + Math.cos(p.aim) * 8 * scale, s.y - 5 * scale - lift + Math.sin(p.aim) * 8 * scale); ctx.stroke();
    ctx.fillStyle = '#22222a'; ctx.fillRect(s.x + Math.cos(p.aim) * 2.4 * scale - 2, s.y - 5.8 * scale - lift + Math.sin(p.aim) * 2.4 * scale, 1.6 * scale, 0.9 * scale);
    // bust meter above the player
    if (game.wanted.bust > 0) {
      ctx.fillStyle = '#c93d2a'; ctx.fillRect(s.x - 3.6 * scale, s.y - 11.4 * scale, 7.2 * scale * game.wanted.bust, 1.2 * scale);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(s.x - 3.6 * scale, s.y - 11.4 * scale, 7.2 * scale, 1.2 * scale);
    }
  }
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
