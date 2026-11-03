import * as THREE from 'three';

const SENSITIVITY = 0.0042; // radians per pixel of drag
const JOY_RADIUS = 56; // px of thumb travel for full speed
const TAP_MAX_MOVE = 12; // px
const TAP_MAX_MS = 300;

// Drop-in for PointerLockControls on touch devices (same isLocked / lock() / unlock() / 'lock' / 'unlock' surface):
// left thumb = floating joystick (exposed as `move`), right thumb drag = look, short tap = `onTap(x, y)`.
export function createTouchControls(camera) {
  const ctl = new THREE.EventDispatcher();
  ctl.isLocked = false;
  ctl.move = { x: 0, y: 0 }; // x: strafe right +, y: forward +
  ctl.onTap = null;
  camera.rotation.order = 'YXZ';

  const base = Object.assign(document.createElement('div'), { id: 'joy' });
  const knob = Object.assign(document.createElement('div'), { id: 'joyKnob' });
  base.appendChild(knob);
  const menu = Object.assign(document.createElement('button'), { id: 'menuBtn', textContent: '☰', ariaLabel: 'Menu' });
  document.body.append(base, menu);

  ctl.lock = () => {
    if (ctl.isLocked) return;
    ctl.isLocked = true;
    menu.style.display = 'block';
    ctl.dispatchEvent({ type: 'lock' });
  };
  ctl.unlock = () => {
    if (!ctl.isLocked) return;
    ctl.isLocked = false;
    ctl.move.x = ctl.move.y = 0;
    base.style.display = menu.style.display = 'none';
    moveId = lookId = null;
    ctl.dispatchEvent({ type: 'unlock' });
  };
  menu.addEventListener('click', () => ctl.unlock());

  let moveId = null;
  let lookId = null;
  let origin = null; // joystick center
  let look = null; // { x, y, t, moved }

  const overUI = (e) => e.target.closest?.('#overlay, #chess, #menuBtn, #carnav');

  addEventListener(
    'touchstart',
    (e) => {
      if (!ctl.isLocked || overUI(e)) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && moveId === null) {
          moveId = t.identifier;
          origin = { x: t.clientX, y: t.clientY };
          base.style.cssText = `display:block;left:${origin.x - JOY_RADIUS}px;top:${origin.y - JOY_RADIUS}px`;
          knob.style.transform = 'translate(0,0)';
        } else if (lookId === null) {
          lookId = t.identifier;
          look = { x: t.clientX, y: t.clientY, t: performance.now(), moved: 0 };
        }
      }
      e.preventDefault();
    },
    { passive: false }
  );

  addEventListener(
    'touchmove',
    (e) => {
      if (!ctl.isLocked) return;
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          let dx = t.clientX - origin.x, dy = t.clientY - origin.y;
          const len = Math.hypot(dx, dy);
          if (len > JOY_RADIUS) { dx *= JOY_RADIUS / len; dy *= JOY_RADIUS / len; }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          ctl.move.x = dx / JOY_RADIUS;
          ctl.move.y = -dy / JOY_RADIUS;
        } else if (t.identifier === lookId) {
          const dx = t.clientX - look.x, dy = t.clientY - look.y;
          look.x = t.clientX; look.y = t.clientY;
          look.moved += Math.abs(dx) + Math.abs(dy);
          camera.rotation.y -= dx * SENSITIVITY;
          camera.rotation.x = Math.max(-1.45, Math.min(1.45, camera.rotation.x - dy * SENSITIVITY));
        }
      }
      e.preventDefault();
    },
    { passive: false }
  );

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) {
        moveId = null;
        ctl.move.x = ctl.move.y = 0;
        base.style.display = 'none';
      } else if (t.identifier === lookId) {
        const quick = performance.now() - look.t < TAP_MAX_MS;
        if (e.type === 'touchend' && quick && look.moved < TAP_MAX_MOVE) ctl.onTap?.(t.clientX, t.clientY);
        lookId = null;
      }
    }
  };
  addEventListener('touchend', end);
  addEventListener('touchcancel', end);

  return ctl;
}
