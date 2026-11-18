// input.js — keyboard and mouse state. Everything else reads intents from
// here; raw events never leak into the systems.

const SBInput = (() => {
  const keys = new Set();
  const pressed = new Set(); // keydown edges since the last frame — a fast
  // tap can fall entirely between two frames, so polling `keys` alone
  // would miss it; one-shot interactions consume edges instead.
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let advancePressed = false;

  function bind(canvas) {
    addEventListener("keydown", (ev) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(ev.code)) ev.preventDefault();
      if (!ev.repeat && (ev.code === "Enter" || ev.code === "Space")) advancePressed = true;
      if (!ev.repeat) pressed.add(ev.code);
      keys.add(ev.code);
    });
    addEventListener("keyup", (ev) => keys.delete(ev.code));
    canvas.addEventListener("mousemove", (ev) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (ev.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (ev.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener("mousedown", () => { mouse.down = true; mouse.clicked = true; });
    addEventListener("mouseup", () => { mouse.down = false; });
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }

  function axis() {
    const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const y = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
    return { x, y };
  }
  function consumeAdvance() {
    const a = advancePressed;
    advancePressed = false;
    return a;
  }
  function consumeClick() {
    const c = mouse.clicked;
    mouse.clicked = false;
    return c;
  }
  function endFrame() { pressed.clear(); }

  return { bind, keys, pressed, mouse, axis, consumeAdvance, consumeClick, endFrame };
})();

window.SBInput = SBInput;
