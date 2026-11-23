// Keyboard + mouse input for Neon Tide.
// Keys are tracked as a live set; edge-triggered actions (E, Space, M, P)
// are consumed by the game loop through pressed().
export function makeInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) justPressed.add(e.key.toLowerCase());
    keys.add(e.key.toLowerCase());
  }
  function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  }
  function onMouseDown(e) { onMouseMove(e); mouse.down = true; mouse.clicked = true; }
  function onMouseUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys, mouse,
    down(k) { return keys.has(k); },
    pressed(k) { return justPressed.has(k); },
    axis() {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      return { x, y };
    },
    endFrame() { justPressed.clear(); mouse.clicked = false; },
  };
}
