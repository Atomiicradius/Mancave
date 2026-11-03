import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getColliders } from './room.js';
import { createTouchControls } from './touch.js';

const EYE_HEIGHT = 1.65;
const RADIUS = 0.3;
const SPEED = 3.2;
const SPRINT = 1.8;
const STEP_RATE = 14; // per second: how quickly the eye height eases up/down a step (a quick climb, not a snap)

const keys = new Set();

function circleHitsBox(x, z, b) {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < RADIUS * RADIUS;
}

function blocked(x, z) {
  return getColliders().some((b) => circleHitsBox(x, z, b));
}

export function createPlayer(camera, domElement, { touch = false } = {}) {
  const controls = touch ? createTouchControls(camera) : new PointerLockControls(camera, domElement);
  camera.position.set(0, EYE_HEIGHT, 2);

  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let ground = () => 0; // (x, z) -> floor height under the player; set with setGround()
  let eyeLift = 0;
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  function update(dt) {
    if (!controls.isLocked) return;

    // Follow the floor height (e.g. the car platform is 8 cm up): the eyes ease up when you step onto it.
    eyeLift += (ground(camera.position.x, camera.position.z) - eyeLift) * Math.min(1, dt * STEP_RATE);
    camera.position.y = EYE_HEIGHT + eyeLift;

    // Keyboard is full-strength; the touch joystick (controls.move) is analog.
    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + (controls.move?.y ?? 0);
    const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + (controls.move?.x ?? 0);
    const strength = Math.min(1, Math.hypot(f, r));
    if (strength < 0.05) return;

    // Horizontal basis from camera yaw only.
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();

    const move = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, r);
    move.normalize().multiplyScalar(SPEED * strength * (keys.has('ShiftLeft') ? SPRINT : 1) * dt);

    // Resolve axes separately so the player slides along walls.
    const p = camera.position;
    if (!blocked(p.x + move.x, p.z)) p.x += move.x;
    if (!blocked(p.x, p.z + move.z)) p.z += move.z;
  }

  return {
    controls,
    update,
    setGround(fn) {
      ground = fn;
    },
  };
}
