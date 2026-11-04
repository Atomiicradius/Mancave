import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM } from './room.js';
import { QUALITY } from './quality.js';

// ---- Ceiling rig (tweak here) -----------------------------------------------------------------------------------------
export const CEILING = {
  steel: 0x2b2e38, // beam / truss color
  pipe: 0x5b3a30, // wall pipe color (rusty copper)
  trussZ: 2.25, // the two trusses run along x at z = +/- this (outside the hatch opening, so the lifted car never hits them)
  beamX: 3.3, // the two cross beams run along z at x = +/- this
  fixtureDrop: 0.4, // how far the tube fixtures hang below the lower truss chord
  tube: 2.2, // emissive strength of the tubes (the bloom threshold is ~1, so this just starts to glow)
  shaftOpacity: 0.055, // light shaft brightness (High only; 0 = off)
};

// Merge-ready box: size [x, y, z] centered at pos, optionally rotated about z (diagonals) or y.
function box(size, pos, rotZ = 0, rotY = 0) {
  const g = new THREE.BoxGeometry(...size);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(...pos);
  return g;
}
function cyl(r, len, pos, axis = 'x', seg = 12) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(...pos);
  return g;
}

// A lattice truss along x at z: top and bottom chords, verticals and alternating diagonals.
function truss(zc, yTop, yBot, x0, x1, step = 0.8) {
  const parts = [];
  const len = x1 - x0, h = yTop - yBot;
  parts.push(box([len, 0.07, 0.08], [(x0 + x1) / 2, yTop, zc]), box([len, 0.07, 0.08], [(x0 + x1) / 2, yBot, zc]));
  const n = Math.round(len / step);
  const dx = len / n;
  for (let i = 0; i <= n; i++) parts.push(box([0.04, h, 0.04], [x0 + i * dx, (yTop + yBot) / 2, zc]));
  const ang = Math.atan2(h, dx), dl = Math.hypot(h, dx);
  for (let i = 0; i < n; i++) parts.push(box([dl, 0.035, 0.035], [x0 + (i + 0.5) * dx, (yTop + yBot) / 2, zc], i % 2 ? ang : -ang));
  return parts;
}

// An I-beam along z at x.
function ibeam(xc, yc, z0, z1) {
  const len = z1 - z0, zm = (z0 + z1) / 2;
  return [
    box([0.16, 0.025, len], [xc, yc + 0.1, zm]),
    box([0.16, 0.025, len], [xc, yc - 0.1, zm]),
    box([0.03, 0.2, len], [xc, yc, zm]),
  ];
}

// Hanging tube fixture along x: housing, end caps, two rods up to the truss, and the tube. Returns { steel[], tube[] } geometry parts.
function fixture(x, y, z, yRod) {
  const steel = [
    box([1.35, 0.06, 0.17], [x, y + 0.03, z]),
    box([0.04, 0.12, 0.19], [x - 0.68, y, z]),
    box([0.04, 0.12, 0.19], [x + 0.68, y, z]),
    cyl(0.008, yRod - y, [x - 0.45, (yRod + y) / 2, z], 'y', 6),
    cyl(0.008, yRod - y, [x + 0.45, (yRod + y) / 2, z], 'y', 6),
  ];
  const tube = [cyl(0.022, 1.28, [x, y - 0.02, z], 'x', 10)];
  return { steel, tube };
}

// Soft-edged light shaft below a fixture: a frustum that fades with height and toward its silhouette.
function makeShaft(x, yTop, z, color) {
  const H = yTop, w0 = 1.3, d0 = 0.16, w1 = 2.5, d1 = 1.5;
  const idx = [];
  const corners = (w, d, y) => [[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]];
  const top = corners(w0, d0, 0), bot = corners(w1, d1, -H);
  const pos = [], fade = [];
  for (let s = 0; s < 4; s++) {
    const a = top[s], b = top[(s + 1) % 4], c = bot[(s + 1) % 4], e = bot[s];
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...e);
    fade.push(1, 1, 0, 0);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('fade', new THREE.Float32BufferAttribute(fade, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: CEILING.shaftOpacity } },
    vertexShader: /* glsl */ `
      attribute float fade;
      varying float vFade;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vFade = fade;
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vN = normalize( normalMatrix * normal );
        vView = normalize( -mv.xyz );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      varying float vFade;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float f = pow( abs( dot( normalize( vN ), normalize( vView ) ) ), 1.6 ); // soft silhouette
        float a = opacity * f * pow( vFade, 1.5 );
        gl_FragColor = vec4( color * a, 1.0 );
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, yTop, z);
  mesh.name = 'light-shaft';
  mesh.raycast = () => {};
  return mesh;
}

export function buildCeilingRig() {
  const g = new THREE.Group();
  g.name = 'ceiling-rig';
  const { w, d, h } = ROOM;
  const steelMat = new THREE.MeshStandardMaterial({ color: CEILING.steel, roughness: 0.55, metalness: 0.7 });
  const yTop = h - 0.04, yBot = h - 0.36; // truss chords just under the ceiling
  const steel = [];

  for (const s of [-1, 1]) steel.push(...truss(s * CEILING.trussZ, yTop, yBot, -w / 2 + 0.1, w / 2 - 0.1));
  for (const s of [-1, 1]) steel.push(...ibeam(s * CEILING.beamX, h - 0.14, -CEILING.trussZ, CEILING.trussZ));
  // (the hatch opening is |x| < BAY.ceil.w/2 and |z| < BAY.ceil.d/2; the rig stays outside it)

  // Hanging tube fixtures. Each hangs from a truss and sits clear of the hatch column.
  const spots = [
    [0, -CEILING.trussZ],
    [-2.5, CEILING.trussZ],
    [2.5, CEILING.trussZ],
  ];
  const yFix = yBot - CEILING.fixtureDrop;
  const tubes = [];
  for (const [fx, fz] of spots) {
    const f = fixture(fx, yFix, fz, yBot);
    steel.push(...f.steel);
    tubes.push(...f.tube);
  }

  // One pipe along the back wall with clamps, flanges and a valve, turning up into the ceiling at x = 2.9.
  const pz = -d / 2 + 0.12, py = 2.3;
  const pipeParts = [
    cyl(0.055, 6.8, [-0.5, py, pz]),
    cyl(0.055, h + 0.1 - py, [2.9, (py + h + 0.1) / 2, pz], 'y'),
  ];
  const sphere = new THREE.SphereGeometry(0.07, 12, 8);
  sphere.translate(2.9, py, pz);
  pipeParts.push(sphere);
  for (const x of [-3.1, -1.5, 0.1, 1.7]) pipeParts.push(cyl(0.065, 0.05, [x, py, pz]), box([0.04, 0.1, 0.07], [x, py, pz - 0.09])); // clamps + wall brackets
  for (const x of [-2.2, 0.9]) pipeParts.push(cyl(0.075, 0.04, [x, py, pz])); // flanges
  const valve = new THREE.TorusGeometry(0.07, 0.01, 6, 14);
  valve.rotateX(Math.PI / 2);
  valve.translate(-0.65, py + 0.17, pz);
  pipeParts.push(valve, cyl(0.012, 0.12, [-0.65, py + 0.1, pz], 'y', 6));

  const merged = (parts, mat, name) => {
    const m = new THREE.Mesh(mergeGeometries(parts), mat);
    m.name = name;
    m.raycast = () => {};
    g.add(m);
    return m;
  };
  merged(steel, steelMat, 'ceiling-steel');
  merged(pipeParts, new THREE.MeshStandardMaterial({ color: CEILING.pipe, roughness: 0.55, metalness: 0.6 }), 'wall-pipe');
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8f2ff).multiplyScalar(CEILING.tube) });
  merged(tubes, tubeMat, 'ceiling-tubes');

  // Faint light shafts (High only).
  const shafts = [];
  if (QUALITY.shafts && CEILING.shaftOpacity > 0) {
    for (const [fx, fz] of spots) {
      const s = makeShaft(fx, yFix - 0.06, fz, 0xcfe3ff);
      shafts.push(s);
      g.add(s);
    }
  }
  g.userData.shafts = shafts;
  return g;
}
