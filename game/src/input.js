// input.js — keyboard and mouse state. One job: track held keys, edge
// presses (consumed once per frame by main), and the mouse in both screen
// and world coordinates.

export function createInput(canvas) {
  const I = {
    keys: new Set(), pressed: new Set(),
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false },
  };
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) I.pressed.add(e.code);
    I.keys.add(e.code);
  });
  window.addEventListener('keyup', e => I.keys.delete(e.code));
  window.addEventListener('blur', () => { I.keys.clear(); I.mouse.down = false; });
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    I.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    I.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', e => { if (e.button === 0) I.mouse.down = true; });
  window.addEventListener('mouseup', e => { if (e.button === 0) I.mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  return I;
}

// Convert the stored screen mouse into world coordinates for this frame.
export function updateMouseWorld(I, cam, cw, ch) {
  const vh = cam.viewW * (ch / cw);
  I.mouse.worldX = cam.x - cam.viewW / 2 + (I.mouse.x / cw) * cam.viewW;
  I.mouse.worldY = cam.y - vh / 2 + (I.mouse.y / ch) * vh;
}
