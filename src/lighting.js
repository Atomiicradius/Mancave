import * as THREE from 'three';
import { ROOM } from './room.js';

const NEON = { magenta: 0xff2fd0, cyan: 0x00e5ff, purple: 0x8f4dff };

// Emissive bar. Color is pushed above 1.0 so the bloom pass (HDR) picks it up.
function strip(parent, color, size, pos) {
  const mat = new THREE.MeshBasicMaterial({ color });
  mat.color.multiplyScalar(2.5);
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  m.position.set(...pos);
  parent.add(m);
  return m;
}

function pointLight(parent, color, intensity, distance, pos) {
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(...pos);
  parent.add(l);
  return l;
}

// Small warm bulb + light. Warm = "this is clickable", against the cool neon palette.
function warmAccent(parent, pos, intensity, distance) {
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa860).multiplyScalar(2.5) })
  );
  bulb.position.set(...pos);
  parent.add(bulb);
  pointLight(parent, 0xffa860, intensity, distance, pos);
}

export function buildLighting() {
  const g = new THREE.Group();
  g.name = 'lighting';
  const { w, d, h } = ROOM;
  const hx = w / 2 - 0.03, hz = d / 2 - 0.03;

  // --- Neon strips: one per wall just under the ceiling, a frame of corner posts, two ceiling runs.
  strip(g, NEON.magenta, [w - 0.4, 0.06, 0.04], [0, h - 0.3, -hz]);
  strip(g, NEON.cyan, [w - 0.4, 0.06, 0.04], [0, h - 0.3, hz]);
  strip(g, NEON.cyan, [0.04, 0.06, d - 0.4], [-hx, h - 0.3, 0]);
  strip(g, NEON.purple, [0.04, 0.06, d - 0.4], [hx, h - 0.3, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      strip(g, (sx * sz > 0 ? NEON.cyan : NEON.magenta), [0.05, h - 0.5, 0.05], [sx * hx, h / 2, sz * hz]);
  strip(g, NEON.purple, [w - 2, 0.04, 0.06], [0, h - 0.02, -1.8]);
  strip(g, NEON.purple, [w - 2, 0.04, 0.06], [0, h - 0.02, 1.8]);

  // --- Cool fill: a handful of colored point lights near the strips (no shadows, cheap).
  g.add(new THREE.HemisphereLight(0x5a3d99, 0x0a0612, 0.6));
  pointLight(g, NEON.magenta, 7, 0, [-2.6, 2.5, -2.0]);
  pointLight(g, NEON.cyan, 7, 0, [2.6, 2.5, 2.0]);
  pointLight(g, NEON.purple, 7, 0, [2.6, 2.5, -2.0]);
  pointLight(g, NEON.cyan, 5, 0, [-2.6, 2.5, 2.0]);

  // --- ONE warm hero light on the car.
  const spot = new THREE.SpotLight(0xffb070, 45, 9, 0.5, 0.6, 2);
  spot.position.set(0.4, 2.9, 1.6);
  spot.target.position.set(0, 0.5, 0);
  g.add(spot, spot.target);

  // --- Small warm accents on the interactables: desk lamp, turntable, chess board.
  warmAccent(g, [0.85, 1.05, -2.55], 3, 3);
  warmAccent(g, [-3.45, 1.3, 1.9], 2.5, 2.5);
  warmAccent(g, [3.45, 1.45, 0], 2.5, 2.5);

  return g;
}
