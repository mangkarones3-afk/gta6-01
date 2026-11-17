// input.js — keyboard + mouse state. down() for held keys, hit() for
// edge-triggered presses (consumed once), axis() for WASD/arrows.
export class Input {
  constructor(canvas) {
    this.keys = new Set(); this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.key.toLowerCase()); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    if (canvas) {
      canvas.addEventListener('mousemove', e => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', e => { if (e.button === 0) this.mouse.down = true; });
      window.addEventListener('mouseup', () => { this.mouse.down = false; });
    }
  }
  down(...ks) { return ks.some(k => this.keys.has(k.toLowerCase())); }
  hit(k) {
    const key = k.toLowerCase();
    if (this.pressed.has(key)) { this.pressed.delete(key); return true; }
    return false;
  }
  axis() {
    let x = 0, y = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) y -= 1;
    if (this.down('s', 'arrowdown')) y += 1;
    return { x, y };
  }
  endFrame() { this.pressed.clear(); }
}
