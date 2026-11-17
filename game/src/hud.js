// hud.js — screen-space interface. One job: draw the HUD (cash, health,
// wanted stars, objective banner, weapon/speed), the populated minimap,
// dialogue and dispatch lines, and the title screen. Reads state, never
// mutates it.

import { STAR_THRESHOLDS, WEAPONS, BAY_X } from './config.js';
import { DISTRICTS } from './config.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(14,12,22,0.78)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,130,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawMinimap(ctx, S, cw) {
  const MW = 196, MH = 196, MX = cw - MW - 14, MY = 14;
  const minX = S.city.pier.x - 20, maxX = S.city.w + 30;
  const minY = -30, maxY = S.city.h + 30;
  const sx = MW / (maxX - minX), sy = MH / (maxY - minY);
  const px = x => MX + (x - minX) * sx, py = y => MY + (y - minY) * sy;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 8); ctx.clip();
  ctx.fillStyle = '#14606e'; ctx.fillRect(MX, MY, MW, MH);
  // district tints
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.tint; ctx.globalAlpha = 0.55;
    ctx.fillRect(px(d.bx0 * 158 + 15), py(d.by0 * 158 + 15), (d.bx1 - d.bx0 + 1) * 158 * sx - 30 * sx, (d.by1 - d.by0 + 1) * 158 * sy - 30 * sy);
  }
  ctx.globalAlpha = 1;
  // park + pier
  ctx.fillStyle = '#4d8f4a';
  ctx.fillRect(px(S.city.parkRect.x), py(S.city.parkRect.y), S.city.parkRect.w * sx, S.city.parkRect.h * sy);
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(px(S.city.pier.x), py(S.city.pier.y), S.city.pier.w * sx, Math.max(2, S.city.pier.h * sy));
  // POI dots
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const p of S.city.pois) { ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 2, 0, Math.PI * 2); ctx.fill(); }
  // police blips (flash)
  const flash = Math.floor(S.time * 3) % 2 === 0;
  for (const c of S.cars) {
    if (c.kind !== 'cop') continue;
    ctx.fillStyle = flash ? '#ff5040' : '#4d8dff';
    ctx.beginPath(); ctx.arc(px(c.x), py(c.y), 3, 0, Math.PI * 2); ctx.fill();
  }
  // objective diamond
  const ob = S.mission.objective;
  if (ob) {
    const ox = px(ob.x), oy = py(ob.y);
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd76a'; const s = 5 + Math.sin(S.time * 5) * 1.1;
    ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
  }
  // player arrow
  const P = S.player, a = P.car ? P.car.angle : P.aim;
  ctx.save(); ctx.translate(px(P.x), py(P.y)); ctx.rotate(a);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -3.6); ctx.lineTo(-4, 3.6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,214,130,0.5)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 8); ctx.stroke();
  // district label, clamped fully inside the frame below the map
  const dn = S.districtName.toUpperCase();
  ctx.font = '700 12px system-ui, sans-serif';
  const tw = ctx.measureText(dn).width + 18;
  const lx = Math.min(cw - 14 - tw, Math.max(14, MX + MW - tw));
  panel(ctx, lx, MY + MH + 6, tw, 22);
  ctx.fillStyle = '#ffe9c4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(dn, lx + tw / 2, MY + MH + 17.5);
  return { x: MX, y: MY, w: MW, h: MH };
}

export function drawHud(ctx, S, cw, ch) {
  const P = S.player;
  ctx.textBaseline = 'middle';

  // --- top-left: cash, health, wanted ---
  panel(ctx, 14, 14, 208, 86);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd76a'; ctx.font = '800 25px system-ui, sans-serif';
  ctx.fillText('$' + P.cash.toLocaleString('en-US'), 26, 38);
  // health bar
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(26, 56, 120, 9);
  ctx.fillStyle = P.hp > 30 ? '#53d769' : '#ff5040';
  ctx.fillRect(26, 56, 120 * Math.max(0, P.hp) / 100, 9);
  // stars
  const stars = S.wanted.stars;
  ctx.font = '19px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd76a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 152 + i * 15.5 - 6, 60);
  }
  ctx.fillStyle = 'rgba(255,233,196,0.85)'; ctx.font = '600 10.5px system-ui, sans-serif';
  ctx.fillText(stars > 0 ? 'HEAT ' + Math.round(S.wanted.heat) : 'NO HEAT', 26, 78);
  if (S.wanted.phase === 'search') ctx.fillText('SBPD SEARCHING…', 96, 78);
  if (S.wanted.phase === 'cooldown') ctx.fillText('LOSING THEM…', 96, 78);

  // --- minimap (top-right) ---
  drawMinimap(ctx, S, cw);

  // --- top-center: objective banner ---
  const M = S.mission;
  if (M.objective) {
    const title = M.side ? 'SIDE JOB · ' + M.name : `MISSION ${M.idx + 1}/5 · ${M.name}`;
    const dist = Math.round(Math.hypot(M.objective.x - P.x, M.objective.y - P.y));
    ctx.font = '800 15px system-ui, sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '600 13.5px system-ui, sans-serif';
    const w2 = ctx.measureText(`${M.objective.label} · ${dist} m`).width;
    const bw = Math.max(w1, w2) + 36;
    panel(ctx, cw / 2 - bw / 2, 14, bw, 52);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a'; ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText(title, cw / 2, 33);
    ctx.fillStyle = '#fff4dd'; ctx.font = '600 13.5px system-ui, sans-serif';
    ctx.fillText(`${M.objective.label} · ${dist} m`, cw / 2, 53);
  }

  // --- bottom-right: weapon + speed ---
  const wpn = WEAPONS[P.weapon];
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff4dd'; ctx.font = '800 16px system-ui, sans-serif';
  const ammo = wpn.mag === Infinity ? '' : `  ${P.mags[P.weapon]} / ${wpn.mag}`;
  ctx.fillText(wpn.name + ammo, cw - 16, ch - 52);
  if (P.car) {
    ctx.fillStyle = '#ffd76a'; ctx.font = '800 21px system-ui, sans-serif';
    ctx.fillText(Math.round(Math.abs(P.car.v) * 0.62) + ' km/h', cw - 16, ch - 26);
  } else {
    ctx.fillStyle = 'rgba(255,244,221,0.75)'; ctx.font = '600 12.5px system-ui, sans-serif';
    ctx.fillText('E — enter / steal car', cw - 16, ch - 26);
  }

  // --- bottom-center: dispatch line ---
  if (S.dispatch && S.time < S.dispatch.until) {
    ctx.font = '700 13px system-ui, sans-serif';
    const t = 'SBPD DISPATCH — ' + S.dispatch.text;
    const tw = ctx.measureText(t).width + 26;
    panel(ctx, cw / 2 - tw / 2, ch - 78, tw, 26);
    ctx.fillStyle = '#ffb0a0'; ctx.textAlign = 'center';
    ctx.fillText(t, cw / 2, ch - 64.5);
  }

  // --- bottom-left: dialogue panel (sized to content, always in frame) ---
  if (S.dialogue && S.time < S.dialogue.until) {
    ctx.font = '600 13.5px system-ui, sans-serif';
    const lines = [];
    for (const raw of S.dialogue.lines) lines.push(...wrap(ctx, raw, 400));
    const w = 428, lh = 17, h = 34 + lines.length * lh;
    const x = 14, y = ch - h - 30;
    panel(ctx, x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd76a'; ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText(S.dialogue.name, x + 14, y + 16);
    ctx.fillStyle = '#fff4dd'; ctx.font = '600 13.5px system-ui, sans-serif';
    lines.forEach((ln, i) => ctx.fillText(ln, x + 14, y + 36 + i * lh));
  }

  // --- controls footer (steps aside when the dialogue panel is open) ---
  const dlgOpen = S.dialogue && S.time < S.dialogue.until;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,244,221,0.66)'; ctx.font = '600 11.5px system-ui, sans-serif';
  ctx.fillText('WASD move · E enter/steal · mouse aim · click fire · 1/2/3 weapons · R reload · Shift sprint/handbrake · J side job · P mute', dlgOpen ? 458 : 14, ch - 13);

  // --- centre toast ---
  if (S.toast && S.time < S.toast.until) {
    ctx.textAlign = 'center';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(10,8,16,0.55)';
    const tw = ctx.measureText(S.toast.text).width + 44;
    ctx.beginPath(); ctx.roundRect(cw / 2 - tw / 2, ch * 0.30, tw, 52, 10); ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(S.toast.text, cw / 2, ch * 0.30 + 27);
  }
  // low-hp / busted flashes
  if (S.flashRed > 0) {
    ctx.fillStyle = `rgba(200,30,30,${0.18 * S.flashRed})`;
    ctx.fillRect(0, 0, cw, ch);
  }
}

export function drawTitle(ctx, S, cw, ch) {
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, 'rgba(24,10,36,0.88)');
  g.addColorStop(0.55, 'rgba(64,20,44,0.82)');
  g.addColorStop(1, 'rgba(10,8,20,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffb020'; ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText('SOLANO BAY', cw / 2, ch * 0.30);
  ctx.fillStyle = '#ffe9c4'; ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText('Five jobs. One debt. A whole city to outrun.', cw / 2, ch * 0.30 + 62);
  ctx.font = '500 16px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,244,221,0.88)';
  ctx.fillText('Reno Kade owes fixer Mara Voss $5,000. Work it off one wheel at a time —', cw / 2, ch * 0.30 + 92);
  ctx.fillText('steal, drive, fight and vanish across a living sun-soaked city.', cw / 2, ch * 0.30 + 116);
  ctx.font = '600 15px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,244,221,0.75)';
  ctx.fillText('WASD move · E enter/steal car · mouse aim · click to fire · 1/2/3 weapons', cw / 2, ch * 0.62);
  ctx.fillText('R reload · Shift sprint / handbrake · J side job · P mute · progress auto-saves', cw / 2, ch * 0.62 + 24);
  ctx.fillStyle = '#ffd76a'; ctx.font = '800 21px system-ui, sans-serif';
  ctx.fillText(S.hasSave ? 'ENTER — continue      N — new game' : 'ENTER — start the first job', cw / 2, ch * 0.76);
  ctx.fillStyle = 'rgba(255,244,221,0.5)'; ctx.font = '500 12.5px system-ui, sans-serif';
  ctx.fillText('An original open-world crime game. Every name, street and story here is its own.', cw / 2, ch * 0.90);
}
