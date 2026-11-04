import * as THREE from 'three';
import { getColliders } from './room.js';
import { fbm, smooth } from './floor.js';

// ---- Props (tweak here): a clutter corner by the front-left wall, beyond the couch. Positions are world x / z. -------------
export const PROPS = {
  barrels: [
    { x: -3.72, z: 2.74, color: 0x3f6f7e }, // teal
    { x: -3.28, z: 2.76, color: 0x8a3a30 }, // red
    { x: -2.84, z: 2.74, color: 0x59683f }, // olive
  ],
  crates: [
    { x: -2.2, z: 2.68, size: 0.52, rot: 0.08 },
    { x: -2.2, z: 2.68, size: 0.42, rot: 0.55, stacked: true }, // sits on the first
  ],
  cable: { x: -2.55, z: 2.12 },
};

// Weathered texture shared by the barrels: white-ish base with vertical rust streaks and grime toward the bottom,
// multiplied by each barrel's paint color.
function barrelTexture() {
  const W = 128, H = 128;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++) {
    const y = 1 - j / H;
    for (let i = 0; i < W; i++) {
      const u = i / W;
      let v = 0.92 - 0.25 * (1 - smooth(0, 0.35, y)) - 0.3 * smooth(0.55, 0.8, fbm(u * 14, y * 1.2, 5, 3)); // grime + streaks
      v *= 0.9 + 0.2 * fbm(u * 24, y * 24, 8, 2);
      const rust = smooth(0.66, 0.8, fbm(u * 8, y * 6, 21, 3));
      const o = (j * W + i) * 4;
      data[o] = Math.min(255, 255 * (v + 0.15 * rust));
      data[o + 1] = Math.min(255, 255 * (v - 0.12 * rust));
      data[o + 2] = Math.min(255, 255 * (v - 0.3 * rust));
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// Plank crate texture: boards with dark gaps, grain, and a frame with a diagonal brace.
function crateTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7b5836';
  ctx.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 6; p++) {
    const y = p * (256 / 6);
    ctx.fillStyle = `hsl(${28 + p * 2}, 38%, ${34 + (p % 3) * 4}%)`;
    ctx.fillRect(0, y + 2, 256, 256 / 6 - 4);
    ctx.strokeStyle = 'rgba(40,24,12,0.35)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 7; g++) {
      ctx.beginPath();
      const gy = y + 6 + g * 6;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(80, gy + 2, 170, gy - 2, 256, gy + 1);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#4a3320';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 240, 240);
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(242, 242);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// An oil drum: lathe profile with three rolled ribs and a recessed lid.
function barrelGeometry() {
  const pts = [
    [0, 0], [0.19, 0], [0.205, 0.015], [0.205, 0.12], [0.19, 0.135], [0.19, 0.165], [0.205, 0.18], [0.205, 0.28], [0.19, 0.295],
    [0.19, 0.325], [0.205, 0.34], [0.205, 0.44], [0.19, 0.455], [0.19, 0.485], [0.205, 0.5], [0.205, 0.585], [0.19, 0.6],
    [0.17, 0.6], [0.16, 0.585], [0, 0.585],
  ].map(([r, y]) => new THREE.Vector2(r, y * 1.15));
  return new THREE.LatheGeometry(pts, 18);
}

// A coil of cable lying on the floor, with a loose tail.
function cableGeometry() {
  const pts = [];
  const turns = 4.2;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const a = t * turns * Math.PI * 2;
    const r = 0.2 - t * 0.08 + 0.004 * Math.sin(a * 3);
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.014 + Math.floor(t * turns) * 0.026 + (t * turns % 1) * 0.026, Math.sin(a) * r));
  }
  // the tail: leaves the outer turn, wanders across the floor
  const last = pts[0];
  const tail = [];
  for (let i = 1; i <= 14; i++) tail.push(new THREE.Vector3(last.x + i * 0.05, 0.014, last.z + Math.sin(i * 0.5) * 0.06 + i * 0.03));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...tail.reverse(), ...pts]), 110, 0.014, 5, false);
}

export function buildProps() {
  const g = new THREE.Group();
  g.name = 'props';
  const colliders = getColliders();

  const barrelTex = barrelTexture();
  const barrelGeo = barrelGeometry();
  for (const b of PROPS.barrels) {
    const m = new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: b.color, map: barrelTex, roughness: 0.55, metalness: 0.55 }));
    m.position.set(b.x, 0, b.z);
    m.rotation.y = (b.x * 7.1) % 6.28; // so the streaks don't all line up
    m.name = 'barrel';
    g.add(m);
    colliders.push({ minX: b.x - 0.21, maxX: b.x + 0.21, minZ: b.z - 0.21, maxZ: b.z + 0.21 });
  }

  const crateMat = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.8, metalness: 0.05 });
  let base = 0;
  for (const c of PROPS.crates) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(c.size, c.size * 0.9, c.size), crateMat);
    const y = c.stacked ? base + (c.size * 0.9) / 2 : (c.size * 0.9) / 2;
    m.position.set(c.x + (c.stacked ? 0.03 : 0), y, c.z);
    m.rotation.y = c.rot;
    m.name = 'crate';
    g.add(m);
    if (!c.stacked) {
      base = c.size * 0.9;
      const r = (c.size / 2) * 1.05;
      colliders.push({ minX: c.x - r, maxX: c.x + r, minZ: c.z - r, maxZ: c.z + r });
    }
  }

  const cable = new THREE.Mesh(cableGeometry(), new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.45, metalness: 0.1 }));
  cable.position.set(PROPS.cable.x, 0, PROPS.cable.z);
  cable.name = 'cable-coil'; // walk-over: no collider
  g.add(cable);

  g.traverse((o) => {
    if (o.isMesh) o.raycast = () => {}; // decor: never blocks the interaction ray
  });
  return g;
}
