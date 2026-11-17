// render.js — canvas drawing of the world. One job: paint the city, actors
// and effects in camera space with the sunset grade. No state mutation.

import { ROAD_W, PITCH, COLS, ROWS, BAY_X } from './config.js';
import { districtOfBlock } from './city.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawWorld(ctx, S, cw, ch) {
  const cam = S.cam;
  const scale = cw / cam.viewW;
  const vh = cam.viewW * (ch / cw);
  const x0 = cam.x - cam.viewW / 2, y0 = cam.y - vh / 2;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-x0, -y0);
  const vx0 = x0 - 40, vy0 = y0 - 40, vx1 = x0 + cam.viewW + 40, vy1 = y0 + vh + 40;

  // --- water (whole background) + bay gradient ---
  const wg = ctx.createLinearGradient(vx0, 0, Math.max(vx1, BAY_X + 500), 0);
  wg.addColorStop(0, '#0d4a5c'); wg.addColorStop(1, '#166b7a');
  ctx.fillStyle = wg; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // landmass
  ctx.fillStyle = '#937e5c';
  ctx.fillRect(BAY_X, -60, S.city.w - BAY_X + 80, S.city.h + 120);
  // beach strip along the bay
  ctx.fillStyle = '#e0b96f'; ctx.fillRect(BAY_X, -60, 16, S.city.h + 120);

  // --- district ground blocks ---
  for (let by = 0; by < ROWS - 1; by++) for (let bx = 0; bx < COLS - 1; bx++) {
    const x = bx * PITCH + ROAD_W / 2, y = by * PITCH + ROAD_W / 2;
    if (x + 128 < vx0 || y + 128 < vy0 || x > vx1 || y > vy1) continue;
    const d = districtOfBlock(bx, by);
    ctx.fillStyle = d.ground; ctx.fillRect(x, y, 128, 128);
  }
  // park grass
  const pr = S.city.parkRect;
  ctx.fillStyle = '#55853e'; ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  ctx.fillStyle = '#4d8f4a';
  ctx.fillRect(pr.x + 6, pr.y + 6, pr.w - 12, pr.h - 12);
  // pond
  ctx.fillStyle = '#1b7f8c';
  ctx.beginPath(); ctx.ellipse(S.city.pond.x, S.city.pond.y, S.city.pond.rx, S.city.pond.ry, 0, 0, Math.PI * 2); ctx.fill();

  // --- roads: sidewalk underlay then asphalt, with dashes ---
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    for (const e of S.city.edges) {
      const a = S.city.nodes[e.a], b = S.city.nodes[e.b];
      if (Math.max(a.x, b.x) < vx0 || Math.min(a.x, b.x) > vx1 || Math.max(a.y, b.y) < vy0 || Math.min(a.y, b.y) > vy1) continue;
      ctx.strokeStyle = pass === 0 ? '#a8946f' : '#46536f';
      ctx.lineWidth = pass === 0 ? ROAD_W + 7 : ROAD_W;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(232,192,122,0.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([10, 12]);
  for (const e of S.city.edges) {
    const a = S.city.nodes[e.a], b = S.city.nodes[e.b];
    if (Math.max(a.x, b.x) < vx0 || Math.min(a.x, b.x) > vx1 || Math.max(a.y, b.y) < vy0 || Math.min(a.y, b.y) > vy1) continue;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // --- pier deck, boats, lighthouse ---
  const pier = S.city.pier;
  ctx.fillStyle = '#8a6a48'; ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 1.4;
  for (let x = pier.x + 12; x < pier.x + pier.w; x += 18) {
    ctx.beginPath(); ctx.moveTo(x, pier.y + 2); ctx.lineTo(x, pier.y + pier.h - 2); ctx.stroke();
  }
  for (const bt of S.city.boats) {
    ctx.save(); ctx.translate(bt.x, bt.y);
    ctx.fillStyle = 'rgba(6,30,40,0.35)'; // waterline shadow
    ctx.beginPath(); ctx.ellipse(1.5, 2.5, bt.w / 2, bt.h / 2 + 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bt.color; // hull with a pointed bow
    ctx.beginPath();
    ctx.moveTo(-bt.w / 2, -bt.h / 2);
    ctx.lineTo(bt.w / 4, -bt.h / 2); ctx.lineTo(bt.w / 2, 0); ctx.lineTo(bt.w / 4, bt.h / 2);
    ctx.lineTo(-bt.w / 2, bt.h / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; rr(ctx, -bt.w / 5, -bt.h / 4, bt.w / 2.6, bt.h / 2, 2.5); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,0.8)'; ctx.lineWidth = 1.3; // mast
    ctx.beginPath(); ctx.moveTo(-bt.w / 3.4, 0); ctx.lineTo(-bt.w / 3.4, -bt.h * 0.95); ctx.stroke();
    ctx.restore();
  }
  const lh = S.city.lighthouse;
  ctx.fillStyle = '#e6e2d5'; ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c22f2f'; ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r * 0.3, 0, Math.PI * 2); ctx.fill();

  // --- palms ---
  for (const p of S.city.palms) {
    ctx.fillStyle = 'rgba(30,80,30,0.9)';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + p.x;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 6 * p.s, p.y + Math.sin(a) * 6 * p.s, 5.4 * p.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#6b4a2c'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * p.s, 0, Math.PI * 2); ctx.fill();
  }

  // --- buildings: shadow, walls, roof, signs ---
  for (const b of S.city.buildings) {
    if (b.x + b.w < vx0 || b.y + b.h < vy0 || b.x > vx1 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(20,10,20,0.30)'; ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,235,200,0.28)'; ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = 'rgba(40,16,8,0.25)';
    const rows = Math.min(b.floors, 6);
    for (let f = 1; f < rows; f++) ctx.fillRect(b.x + 4, b.y + (b.h / rows) * f, b.w - 8, 1.6);
    if (b.sign) {
      // shopfront band: sized to the building, font shrunk to fit so a
      // sign never spills onto the neighbours or off the roof
      let fs = 7.4;
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      let tw = ctx.measureText(b.sign).width;
      const maxW = b.w - 2;
      if (tw > maxW) { fs = Math.max(4.4, fs * maxW / tw); ctx.font = `700 ${fs}px system-ui, sans-serif`; tw = ctx.measureText(b.sign).width; }
      const bw = tw + 8, bh = fs + 5;
      const bx = b.x + b.w / 2 - bw / 2, by = b.y + 1.5;
      ctx.fillStyle = b.poi ? '#7a1f1f' : 'rgba(24,16,28,0.88)';
      rr(ctx, bx, by, bw, bh, 2.5); ctx.fill();
      ctx.fillStyle = '#ffe9c4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.sign, b.x + b.w / 2, by + bh / 2 + 0.5);
    }
  }

  // --- roadblocks: twin striped bars on posts, cones at the ends ---
  for (const rb of S.wanted.roadblocks) {
    ctx.save(); ctx.translate(rb.x, rb.y); ctx.rotate(rb.angle);
    for (const off of [-5.5, 5.5]) {
      ctx.fillStyle = '#e6e2d5'; rr(ctx, -23, off - 2.6, 46, 5.2, 2); ctx.fill();
      ctx.fillStyle = '#c22f2f';
      for (let i = -22; i < 22; i += 11) ctx.fillRect(i, off - 2.6, 5.5, 5.2);
    }
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(-24.5, -8, 3, 16); ctx.fillRect(21.5, -8, 3, 16);
    for (const cx of [-17, 17]) { // traffic cones
      ctx.fillStyle = '#e86a17';
      ctx.beginPath(); ctx.moveTo(cx, -11); ctx.lineTo(cx + 3.4, -4); ctx.lineTo(cx - 3.4, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - 2.2, -7.6, 4.4, 1.8);
    }
    ctx.restore();
    ctx.font = '700 8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText('ROADBLOCK').width + 9;
    ctx.fillStyle = 'rgba(122,31,31,0.92)'; rr(ctx, rb.x - tw / 2, rb.y - 25, tw, 13, 3); ctx.fill();
    ctx.fillStyle = '#ffe9c4'; ctx.fillText('ROADBLOCK', rb.x, rb.y - 18.5);
  }

  // --- bullets & particles under actors ---
  ctx.fillStyle = '#ffe9a0';
  for (const bl of S.bullets) ctx.fillRect(bl.x - 1.6, bl.y - 1.6, 3.2, 3.2);
  for (const pt of S.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color; ctx.fillRect(pt.x - pt.s / 2, pt.y - pt.s / 2, pt.s, pt.s);
  }
  ctx.globalAlpha = 1;

  // --- pedestrians ---
  for (const p of S.peds) {
    if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
    ctx.fillStyle = 'rgba(20,10,20,0.25)'; ctx.beginPath(); ctx.arc(p.x + 1.5, p.y + 2, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2); ctx.fill();
  }

  // --- cars ---
  for (const c of S.cars) drawCar(ctx, S, c);

  // --- player on foot ---
  const P = S.player;
  if (!P.car) {
    ctx.fillStyle = 'rgba(20,10,20,0.3)'; ctx.beginPath(); ctx.arc(P.x + 2, P.y + 2.5, 6.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#17301e'; ctx.beginPath(); ctx.arc(P.x, P.y, 6.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e33f2e'; ctx.beginPath(); ctx.arc(P.x, P.y, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(P.x, P.y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe9c4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + Math.cos(P.aim) * 11, P.y + Math.sin(P.aim) * 11); ctx.stroke();
  }

  ctx.restore();

  // --- sunset grade: warm wash, warm top light, dusk bottom, vignette ---
  ctx.fillStyle = 'rgba(255,176,92,0.07)'; ctx.fillRect(0, 0, cw, ch);
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, 'rgba(255,138,54,0.11)');
  g.addColorStop(0.5, 'rgba(255,170,80,0.02)');
  g.addColorStop(1, 'rgba(38,16,66,0.09)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  const v = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.42, cw / 2, ch / 2, ch * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(16,6,24,0.13)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);
}

export function drawCar(ctx, S, c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(20,10,20,0.30)'; rr(ctx, -6.5, -3.5, 19, 11, 3); ctx.fill();
  const isCop = c.kind === 'cop';
  ctx.fillStyle = isCop ? '#eef0f2' : c.color;
  rr(ctx, -8.5, -4.5, 17, 9, 2.6); ctx.fill();
  ctx.strokeStyle = 'rgba(10,12,20,0.45)'; ctx.lineWidth = 0.8; rr(ctx, -8.5, -4.5, 17, 9, 2.6); ctx.stroke();
  if (isCop) {
    ctx.fillStyle = '#2456c8'; ctx.fillRect(-2.5, -4.5, 4.5, 9);
    const flash = Math.floor(S.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2e6bff';
    ctx.fillRect(-1.7, -3.6, 3.4, 3.1);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff3b30';
    ctx.fillRect(-1.7, 0.5, 3.4, 3.1);
  }
  ctx.fillStyle = 'rgba(16,24,38,0.85)'; rr(ctx, -5.4, -3.6, 4.6, 7.2, 1.4); ctx.fill(); // windshield
  ctx.fillStyle = isCop ? '#dfe5ea' : c.roof; rr(ctx, -0.4, -3.7, 5.4, 7.4, 1.4); ctx.fill(); // roof
  ctx.fillStyle = 'rgba(16,24,38,0.6)'; rr(ctx, 5.4, -3.4, 2.2, 6.8, 1); ctx.fill(); // rear glass
  if (c === (S.player.car || null)) {
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 1.4; rr(ctx, -9.6, -5.6, 19.2, 11.2, 3.4); ctx.stroke();
  }
  if (c.marked) { // mission target car: amber beacon
    const pulse = 1 + Math.sin(S.time * 5) * 0.25;
    ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(0, 0, 3.4 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff2cf'; ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (c.kind === 'cop') {
    ctx.font = '700 7.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(238,240,242,0.95)';
    ctx.fillText('SBPD', c.x, c.y - 9.5);
  }
}
