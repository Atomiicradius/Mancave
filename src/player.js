import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getColliders } from './room.js';

const EYE_HEIGHT = 1.65;
const RADIUS = 0.3;
const SPEED = 3.2;
const SPRINT = 1.8;

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

export function createPlayer(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);
  camera.position.set(0, EYE_HEIGHT, 2);

  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  function update(dt) {
    if (!controls.isLocked) return;

    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    if (!f && !r) return;

    // Horizontal basis from camera yaw only.
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();

    const move = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, r);
    move.normalize().multiplyScalar(SPEED * (keys.has('ShiftLeft') ? SPRINT : 1) * dt);

    // Resolve axes separately so the player slides along walls.
    const p = camera.position;
    if (!blocked(p.x + move.x, p.z)) p.x += move.x;
    if (!blocked(p.x, p.z + move.z)) p.z += move.z;
  }

  return { controls, update };
}
