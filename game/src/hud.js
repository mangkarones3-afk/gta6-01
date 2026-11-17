// hud.js — HUD and minimap, DOM-based so text stays crisp.
// HUD: cash, wanted stars, health bar, weapon + ammo, objective line
// with the MISSION n/5 counter (F6), dispatch ticker, banners.
// Minimap: district tints, the bay, POI dots, objective diamond,
// police blips, safehouse and the player arrow — populated, labelled,
// and nothing ever drawn outside its own frame (F5/F7).
import { STORY, WORLD } from './config.js';

const $ = id => document.getElementById(id);

export class HUD {
  constructor() {
    this.cash = $('hud-cash'); this.stars = $('hud-stars');
    this.hpFill = $('hud-hp-fill'); this.weapon = $('hud-weapon');
    this.objective = $('hud-objective'); this.dispatch = $('hud-dispatch');
    this.banner = $('hud-banner'); this.dialogue = $('hud-dialogue');
    this.minimap = $('minimap').getContext('2d');
    this._dispatchT = 0; this._lastDispatch = '';
    this._flashT = 0;
  }
  flashDispatch(text) { this._lastDispatch = text; this._dispatchT = 6; }
  update(game, dt) {
    const p = game.player, w = game.wanted;
    this.cash.textContent = '$' + Math.floor(p.cash);
    let starStr = '';
    for (let i = 0; i < 5; i++) starStr += i < w.stars ? '★' : '☆';
    this.stars.textContent = starStr;
    this.stars.className = w.stars > 0 ? 'on' : '';
    this.hpFill.style.width = Math.max(0, p.hp) + '%';
    this.hpFill.style.background = p.hp < 30 ? '#c93d2a' : '#57c04a';
    const cb = game.combat;
    this.weapon.textContent = `${cb.weapon.toUpperCase()} ${cb.mag}/${cb.ammo[cb.weapon]}` +
      (cb.reloadT > 0 ? ' RELOADING' : '');
    // objective with progression (F6): MISSION n/5 + live distance
    const label = game.missions.currentLabel();
    const obj = game.missions.stepObj();
    let prefix = '';
    if (game.missions.state === 'active' && game.missions.def) {
      prefix = `MISSION ${Math.min(game.missions.index + 1, 5)}/5 · ${game.missions.def.title} — `;
    }
    let suffix = '';
    if (obj && obj.kind !== 'heat') {
      const d = Math.hypot(p.x - obj.x, p.z - obj.z);
      suffix = ` · ${Math.round(d)}m`;
    }
    this.objective.textContent = prefix + label + suffix;
    // dispatch ticker
    if (w.dispatch && w.dispatch !== this._lastDispatch) this.flashDispatch(w.dispatch);
    if (this._dispatchT > 0) {
      this._dispatchT -= dt;
      this.dispatch.textContent = this._lastDispatch;
      this.dispatch.style.opacity = this._dispatchT > 0 ? 1 : 0;
    } else this.dispatch.style.opacity = 0;
    // banners + dialogue
    if (game.missions.bannerT > 0) {
      this.banner.textContent = game.missions.banner;
      this.banner.style.opacity = 1;
    } else this.banner.style.opacity = 0;
    if (game.missions.dialogueT > 0) {
      this.dialogue.textContent = game.missions.dialogue;
      this.dialogue.style.opacity = 1;
    } else this.dialogue.style.opacity = 0;
    this.drawMinimap(game);
  }
  drawMinimap(game) {
    const ctx = this.minimap, S = 150;
    const city = game.city, p = game.player;
    const world = WORLD.half + 200;
    const toM = (x, z) => ({ x: (x + world) / (world * 2) * S, y: (z + world) / (world * 2) * S });
    ctx.clearRect(0, 0, S, S);
    // land + bay
    ctx.fillStyle = '#d9bd8a'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2b93a8';
    const wx = toM(WORLD.waterX, 0).x;
    ctx.fillRect(0, 0, wx, S);
    // district tints (F5): colour wash + name for the player's district
    const tints = { downtown: 'rgba(62,111,158,0.30)', marina: 'rgba(46,139,133,0.30)',
      oldtown: 'rgba(194,106,42,0.28)', harbor: 'rgba(110,120,130,0.30)',
      beachfront: 'rgba(238,217,160,0.35)', hills: 'rgba(93,162,78,0.28)' };
    for (const bl of city.blocks) {
      const t = tints[bl.district];
      if (!t) continue;
      const a = toM(bl.poly[0][0], bl.poly[0][1]), b = toM(bl.poly[2][0], bl.poly[2][1]);
      ctx.fillStyle = t; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    // roads as faint lines
    ctx.strokeStyle = 'rgba(60,50,30,0.35)'; ctx.lineWidth = 1;
    for (const e of city.edges) {
      const a = toM(e.pts[0][0], e.pts[0][1]), b = toM(e.pts[1][0], e.pts[1][1]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // safehouse (the garage)
    const g = toM(-300, 300);
    ctx.fillStyle = '#57c04a'; ctx.fillRect(g.x - 3, g.y - 3, 6, 6);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('G', g.x, g.y + 2.5);
    // POI dots (F5)
    ctx.fillStyle = '#8a5a12';
    for (const poi of city.pois) {
      const m = toM(poi.x, poi.z);
      ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, 6.29); ctx.fill();
    }
    // objective diamond
    const obj = game.missions.stepObj();
    if (obj && obj.kind !== 'heat') {
      const m = toM(obj.x, obj.z);
      ctx.fillStyle = '#e8c93d'; ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    // police blips
    for (const c of game.wanted.cops) {
      const m = toM(c.x, c.z);
      ctx.fillStyle = game.wanted._sirenPhase ? '#ff3b30' : '#2a6aff';
      ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, 6.29); ctx.fill();
    }
    for (const f of game.wanted.footCops) {
      const m = toM(f.x, f.z);
      ctx.fillStyle = '#274b8f'; ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, 6.29); ctx.fill();
    }
    // player arrow
    const m = toM(p.x, p.z);
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(p.car ? p.car.angle : p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // district label, bottom-centre, clamped inside the frame (F7)
    const name = game.wanted.districtName.toUpperCase();
    ctx.font = 'bold 8px sans-serif';
    const tw = ctx.measureText(name).width;
    const lx = Math.min(Math.max(m.x, tw / 2 + 3), S - tw / 2 - 3);
    ctx.fillStyle = 'rgba(20,16,8,0.72)';
    ctx.fillRect(lx - tw / 2 - 4, S - 14, tw + 8, 11);
    ctx.fillStyle = '#f2e7c8'; ctx.textAlign = 'center';
    ctx.fillText(name, lx, S - 5.5);
    ctx.textAlign = 'left';
  }
}
