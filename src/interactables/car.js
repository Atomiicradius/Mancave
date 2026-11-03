import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { addBox } from '../room.js';

// ---- Car paint (tweak here) -------------------------------------------------------------------------------------
export const CAR = {
  // Multiplier on the scene's environment reflection for the car only (scene.environmentIntensity is 0.25, so 0.6 = 0.15 overall).
  envMapIntensity: 0.6,
  // The NSX paint is near-mirror (roughness 0.07), which is what throws hard white glints; this is the minimum roughness it gets.
  paintRoughness: 0.28,
  // Floor for EVERY car material. The glb has several near-mirror ones (paint 0.07, chrome trim 0.08, glass 0.0) and any of them
  // can catch the spotlight as a bright dot; nothing on the car gets sharper than this.
  minRoughness: 0.2,
  // Clearcoat stays; its roughness is raised to at least this so highlights are soft instead of pin-sharp (glb has 0.04).
  clearcoatRoughness: 0.2,
};

// ---- Platform (tweak here) --------------------------------------------------------------------------------------
export const PLATFORM = {
  w: 5.2, // x
  d: 2.6, // z
  h: 0.08, // height off the floor; the car is lifted by this much (assets.js car.fit.pos y)
  bevel: 0.025, // edge rounding
  body: 0x0b0a12, // side/body color
  topTint: 0x2c2c3a, // mirror tint on the top: darker = fainter car reflection (overlay-blends the reflection with this color)
  reflectionScale: 0.4, // resolution of the car reflection in the top surface (relative to 1024x768); 0 = no reflection pass
  stripCyan: 1.7, // emissive strength of the long-side strips (bloom threshold is ~1.0, so >1 just starts to glow)
  stripMagenta: 2.2, // emissive strength of the short-side strips (magenta has lower luminance, so it needs a bit more)
  gridOpacity: 0.4, // inset grid / brackets on the top surface
  glowOpacity: 0.3, // soft glow decal on the floor around the platform
  glowSpread: 1.2, // meters the floor glow fades out over
};

const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k); // color pushed above 1.0 so the bloom pass picks it up

// Thin grid + inset border + corner brackets drawn in a canvas; used as a transparent overlay on the top surface.
function gridTexture(w, d) {
  const PX = 200; // pixels per meter
  const c = document.createElement('canvas');
  c.width = Math.round(w * PX);
  c.height = Math.round(d * PX);
  const ctx = c.getContext('2d');
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,229,255,0.22)';
  ctx.beginPath();
  for (let x = c.width / 2 % (PX / 2); x <= c.width; x += PX / 2) { ctx.moveTo(x, 0); ctx.lineTo(x, c.height); }
  for (let y = c.height / 2 % (PX / 2); y <= c.height; y += PX / 2) { ctx.moveTo(0, y); ctx.lineTo(c.width, y); }
  ctx.stroke();
  // inset border
  const m = 0.14 * PX;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,229,255,0.55)';
  ctx.strokeRect(m, m, c.width - 2 * m, c.height - 2 * m);
  // corner brackets in magenta
  ctx.strokeStyle = 'rgba(255,79,216,0.8)';
  ctx.lineWidth = 5;
  const L = 0.3 * PX, o = 0.09 * PX;
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = o + sx * (c.width - 2 * o), y = o + sy * (c.height - 2 * o);
    const dx = sx ? -1 : 1, dy = sy ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x + dx * L, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * L);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Soft cyan -> magenta glow that fades outward from the platform's outline (rounded-rect distance field, per pixel,
// so it doesn't depend on canvas blur filters that Safari lacks).
function glowTexture(w, d, spread) {
  const PX = 60;
  const W = w + 2 * spread, D = d + 2 * spread;
  const cw = Math.round(W * PX), ch = Math.round(D * PX);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(cw, ch);
  const r = 0.12;
  const hx = w / 2 - r, hz = d / 2 - r;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const px = (i / cw - 0.5) * W, pz = (j / ch - 0.5) * D;
      const qx = Math.abs(px) - hx, qz = Math.abs(pz) - hz;
      const dist = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
      const a = dist <= 0 ? 0 : Math.pow(Math.max(0, 1 - dist / spread), 2.2);
      const k = (px / w + 0.5); // 0 (cyan, -x) .. 1 (magenta, +x)
      const o = (j * cw + i) * 4;
      img.data[o] = 255 * (0.1 + 0.9 * k);
      img.data[o + 1] = 255 * (0.9 - 0.65 * k);
      img.data[o + 2] = 255;
      img.data[o + 3] = 255 * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPlatform(parent, reflectionScale) {
  const { w, d, h, bevel } = PLATFORM;
  const g = new THREE.Group();
  g.name = 'car-platform';

  // Body: dark, glossy, beveled slab.
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, 3, bevel),
    new THREE.MeshStandardMaterial({ color: PLATFORM.body, roughness: 0.3, metalness: 0.6 })
  );
  body.position.y = h / 2;
  g.add(body);

  // Top surface: a dim planar reflection (shows the car), or on the low tier a glossy material without the extra render pass.
  const topW = w - 2 * bevel, topD = d - 2 * bevel;
  let top;
  if (reflectionScale > 0) {
    top = new Reflector(new THREE.PlaneGeometry(topW, topD), {
      color: PLATFORM.topTint,
      textureWidth: Math.round(1024 * reflectionScale),
      textureHeight: Math.round(768 * reflectionScale),
      clipBias: 0.003,
    });
  } else {
    top = new THREE.Mesh(
      new THREE.PlaneGeometry(topW, topD),
      new THREE.MeshStandardMaterial({ color: 0x0c0b14, roughness: 0.12, metalness: 0.7 })
    );
  }
  top.rotation.x = -Math.PI / 2;
  top.position.y = h + 0.0006;
  top.name = 'platform-top';
  g.add(top);

  // Faint inset grid + brackets on top of that.
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(topW, topD),
    new THREE.MeshBasicMaterial({
      map: gridTexture(topW, topD),
      transparent: true,
      opacity: PLATFORM.gridOpacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = h + 0.0012;
  g.add(grid);

  // Thin emissive edge strips around the top perimeter: cyan on the long sides, magenta on the short ones.
  const inset = 0.07, t = 0.022, tall = 0.012;
  const strip = (hex, k, size, pos) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: hdr(hex, k) }));
    m.position.set(...pos);
    g.add(m);
  };
  const y = h + tall / 2;
  for (const s of [-1, 1]) {
    strip(0x00e5ff, PLATFORM.stripCyan, [w - 2 * inset, tall, t], [0, y, s * (d / 2 - inset)]);
    strip(0xff2fd0, PLATFORM.stripMagenta, [t, tall, d - 2 * inset - 2 * t], [s * (w / 2 - inset), y, 0]);
  }

  // Soft glow decal on the floor around the platform (additive, so it only ever brightens the floor).
  const spread = PLATFORM.glowSpread;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 2 * spread, d + 2 * spread),
    new THREE.MeshBasicMaterial({
      map: glowTexture(w, d, spread),
      transparent: true,
      opacity: PLATFORM.glowOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.004;
  glow.name = 'platform-glow';
  g.add(glow);

  parent.add(g);
}

// Placeholder NSX (a box + cabin, retired once the real model loads) on the raised platform. Non-interactive.
export function buildCar({ reflectionScale = PLATFORM.reflectionScale } = {}) {
  const g = new THREE.Group();
  g.name = 'car';

  buildPlatform(g, reflectionScale);

  addBox(g, { name: 'car-body', size: [4.4, 0.6, 1.9], pos: [0, 0.5, 0], color: 0xff6a00, solid: true });
  addBox(g, { name: 'car-cabin', size: [1.8, 0.5, 1.6], pos: [-0.2, 1.05, 0], color: 0xcc5500 });
  return g;
}

// Softens the car's reflections (hook for the loaded NSX model; see CAR above).
export function tuneCar(model, scene) {
  const seen = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (seen.has(m)) continue;
      seen.add(m);
      // Per-material env intensity only applies when the material has its own envMap, so point it at the scene's.
      if (scene.environment) {
        m.envMap = scene.environment;
        m.envMapIntensity = CAR.envMapIntensity * scene.environmentIntensity;
      }
      if (/paint/i.test(m.name)) m.roughness = Math.max(m.roughness, CAR.paintRoughness);
      m.roughness = Math.max(m.roughness, CAR.minRoughness);
      if (m.clearcoat > 0) m.clearcoatRoughness = Math.max(m.clearcoatRoughness, CAR.clearcoatRoughness);
      m.needsUpdate = true;
    }
  });
}
