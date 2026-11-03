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

export function buildLighting({ neonLights = 4 } = {}) {
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
  // Low tier keeps the first two (diagonal corners) and boosts them to compensate.
  const fill = [
    [NEON.magenta, 7, [-2.6, 2.5, -2.0]],
    [NEON.cyan, 7, [2.6, 2.5, 2.0]],
    [NEON.purple, 7, [2.6, 2.5, -2.0]],
    [NEON.cyan, 5, [-2.6, 2.5, 2.0]],
  ];
  const boost = neonLights < fill.length ? 1.5 : 1;
  fill.slice(0, neonLights).forEach(([color, intensity, pos]) => pointLight(g, color, intensity * boost, 0, pos));

  // --- ONE warm hero light on the car.
  const spot = new THREE.SpotLight(0xffb070, 28, 9, 0.5, 0.6, 2);
  spot.position.set(0.4, 2.9, 1.6);
  spot.target.position.set(0, 0.5, 0);
  g.add(spot, spot.target);

  // --- Small warm accents on the interactables: desk lamp, turntable console, chess board.
  pointLight(g, 0xffa860, 2.5, 3.5, [0.7, 1.75, -1.9]); // desk glow (no visible bulb; kept above the desk so the white top doesn't blow out)
  pointLight(g, 0xffa860, 2, 2.5, [-3.4, 1.15, -0.8]); // glow over the turntable console (no visible bulb)
  pointLight(g, 0xffa860, 2, 2.5, [3.2, 1.55, 0]); // glow over the chess table (no visible bulb)

  // --- Warm spotlight on the album wall so covers stay readable under the neon.
  const albumLight = new THREE.SpotLight(0xffc890, 14, 6, 0.42, 0.7, 2);
  albumLight.position.set(-2.3, 2.7, -0.8);
  albumLight.target.position.set(-4, 1.75, -0.8);
  g.add(albumLight, albumLight.target);

  return g;
}
