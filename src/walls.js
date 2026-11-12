import * as THREE from 'three';
import { fbm, smooth } from './floor.js';

// ---- Wall look (tweak here) -------------------------------------------------------------------------------------------
export const WALLS = {
  grimeHeight: 1.05, // meters up the wall the floor grime reaches (it is ragged, so this is the average)
  grimeStrength: 0.75, // 0-1 darkness at the very bottom
  stain: 0.42, // darkness of the stained patches
  streak: 0.11, // darkness of the faint vertical water streaks
  seed: 3,
  // Left wall: painted concrete panels instead of brick.
  plaster: {
    color: [92, 98, 120], // base paint color (r, g, b); lit by the neon so it reads cooler/brighter than it looks here
    mottle: 0.1, // paint unevenness
    panel: 1.5, // meters between the panel seams
    cracks: 4, // hairline cracks
    peel: 0.55, // how much paint is peeling off in patches (0 = none)
  },
};

// Dark overlay with an alpha channel: floor grime, stained patches and faint streaks. Used as a transparent plane in front of a wall.
// wm x hm are the wall's size in meters; `px` pixels per meter (low: the features are soft).
export function grimeTexture(wm, hm, seed, px = 90) {
  const W = Math.round(wm * px), H = Math.round(hm * px);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++) {
    const y = (1 - j / H) * hm; // meters above the floor
    for (let i = 0; i < W; i++) {
      const u = (i / W) * wm;
      const gh = WALLS.grimeHeight * (0.55 + 0.9 * fbm(u * 1.4, 3.1, seed));
      let a = WALLS.grimeStrength * Math.pow(1 - smooth(0, gh, y), 1.4);
      a *= 0.7 + 0.6 * fbm(u * 6, y * 6, seed + 1, 3); // blotchy, not a clean gradient
      a += 0.22 * (1 - smooth(0, 0.18, y)); // splash zone right at the floor
      const patch = smooth(0.58, 0.74, fbm(u * 0.8 + 5, y * 0.9, seed + 2));
      a += WALLS.stain * patch * (0.55 + 0.45 * fbm(u * 8, y * 8, seed + 3, 3));
      const streak = smooth(0.6, 0.8, fbm(u * 16, y * 0.6, seed + 4, 3));
      a += WALLS.streak * streak * smooth(0.15, 0.9, y / hm);
      a = Math.min(0.85, Math.max(0, a));
      const o = (j * W + i) * 4;
      const warm = fbm(u * 3, y * 3, seed + 6, 2);
      data[o] = 14 + warm * 14;
      data[o + 1] = 10 + warm * 8;
      data[o + 2] = 10 + warm * 6;
      data[o + 3] = a * 255;
    }
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

// Painted concrete: mottled paint, board-formed panel seams, tie holes, hairline cracks and peeling patches.
export function plasterTexture(wm, hm, seed) {
  const PX = 160;
  const W = Math.round(wm * PX), H = Math.round(hm * PX);
  const P = WALLS.plaster;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++) {
    const y = (1 - j / H) * hm;
    for (let i = 0; i < W; i++) {
      const u = (i / W) * wm;
      const m = 1 + P.mottle * (fbm(u * 1.2, y * 1.2, seed, 4) - 0.5) * 2 + 0.05 * (fbm(u * 18, y * 18, seed + 1, 2) - 0.5);
      let r = P.color[0] * m, g = P.color[1] * m, b = P.color[2] * m;
      // peeling paint: patches where the bare, warmer concrete shows, mostly near the edges and the bottom
      const edge = Math.max(smooth(0.6, 0, y / hm), smooth(wm - 0.7, wm, u), smooth(0.7, 0, u));
      const peel = smooth(0.62, 0.72, fbm(u * 1.9 + 4, y * 1.9, seed + 2)) * P.peel * (0.35 + 0.65 * edge);
      r += (150 - r) * peel * 0.7; g += (140 - g) * peel * 0.7; b += (128 - b) * peel * 0.7;
      const o = (j * W + i) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(data, W, H), 0, 0);
  // panel seams: a dark groove with a light lip
  const seam = (x0, y0, x1, y1) => {
    ctx.strokeStyle = 'rgba(10,12,20,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,205,225,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0 + 3, y0 + 3); ctx.lineTo(x1 + 3, y1 + 3); ctx.stroke();
  };
  for (let u = P.panel; u < wm - 0.01; u += P.panel) seam(u * PX, 0, u * PX, H);
  for (let y = P.panel; y < hm - 0.01; y += P.panel) seam(0, H - y * PX, W, H - y * PX);
  // tie holes
  ctx.fillStyle = 'rgba(8,10,18,0.75)';
  for (let u = P.panel / 2; u < wm; u += P.panel)
    for (let y = P.panel / 2 - 0.35; y < hm; y += P.panel / 2 + 0.2) {
      ctx.beginPath(); ctx.arc(u * PX, H - y * PX, 3.2, 0, Math.PI * 2); ctx.fill();
    }
  // hairline cracks: random walks
  ctx.strokeStyle = 'rgba(8,10,16,0.55)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < P.cracks; k++) {
    let x = (0.1 + 0.8 * Math.abs(Math.sin(seed * 12.9 + k * 78.2))) * W, y = (0.15 + 0.7 * Math.abs(Math.sin(seed * 4.1 + k * 39.3))) * H;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 40; s++) { x += (fbm(s * 0.3, k, seed + 5) - 0.5) * 16; y += 5 + fbm(s * 0.3, k + 9, seed + 6) * 6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Four transparent grime planes just in front of the walls (they only darken, so they work with any wall material and need no lights).
export function addWallGrime(parent, ROOM) {
  const { w, d, h } = ROOM;
  const specs = [
    { name: 'grime-back', size: [w, h], pos: [0, h / 2, -d / 2 + 0.004], ry: 0, seed: WALLS.seed },
    { name: 'grime-front', size: [w, h], pos: [0, h / 2, d / 2 - 0.004], ry: Math.PI, seed: WALLS.seed + 20 },
    { name: 'grime-left', size: [d, h], pos: [-w / 2 + 0.004, h / 2, 0], ry: Math.PI / 2, seed: WALLS.seed + 40 },
    { name: 'grime-right', size: [d, h], pos: [w / 2 - 0.004, h / 2, 0], ry: -Math.PI / 2, seed: WALLS.seed + 60 },
  ];
  for (const s of specs) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(...s.size),
      new THREE.MeshBasicMaterial({
        map: grimeTexture(s.size[0], s.size[1], s.seed),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        fog: true,
      })
    );
    m.position.set(...s.pos);
    m.rotation.y = s.ry;
    m.name = s.name;
    m.renderOrder = -10; // before the other transparent things (glass, glows)
    m.raycast = () => {}; // never block the interaction ray
    parent.add(m);
  }
}
