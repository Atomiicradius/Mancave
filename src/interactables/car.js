import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { addBox, ROOM, BAY } from '../room.js';

// ---- Car paint (tweak here; applies to every car in src/cars.js) -------------------------------------------------
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
  w: BAY.floor.w, // x (the platform fills the floor opening exactly)
  d: BAY.floor.d, // z
  h: 0.08, // height off the floor; the car sits on it (cars.js positionOffset y is added to this)
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

const strip = (parent, hex, k, size, pos) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: hdr(hex, k) }));
  m.position.set(...pos);
  parent.add(m);
  return m;
};

// ---- Floor: the platform is two halves (front z>0 / back z<0). To open, each drops below floor level, then slides outward
// into the floor slab, uncovering the pit. Both halves share ONE planar reflection (a single Reflector whose two quads are
// moved along with the halves), so the extra render pass costs the same as before.
function buildFloorHatch(parent, reflectionScale) {
  const { w, d, h, bevel } = PLATFORM;
  const half = d / 2;
  const SLIDE = half + 0.02; // far enough that a half sits entirely under the floor slab beside the opening
  const DROP = h + 0.04; // down until the half (and its raised strips) is fully inside the floor slab (BAY.floor.slab thick)
  const topW = w - 2 * bevel;
  const topD = half - 2 * bevel;
  const bodyMat = new THREE.MeshStandardMaterial({ color: PLATFORM.body, roughness: 0.3, metalness: 0.6 });
  const gridTex = gridTexture(topW, d - 2 * bevel);
  const inset = 0.07, t = 0.022, tall = 0.012;
  const shared = reflectionScale > 0;

  const halves = [1, -1].map((s) => {
    const g = new THREE.Group();
    g.name = s > 0 ? 'platform-front' : 'platform-back';
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, half, 3, bevel), bodyMat);
    body.position.set(0, h / 2, (s * half) / 2);
    g.add(body);

    if (!shared) {
      // Low tier: glossy PBR top with no extra render pass.
      const top = new THREE.Mesh(
        new THREE.PlaneGeometry(topW, topD),
        new THREE.MeshStandardMaterial({ color: 0x0c0b14, roughness: 0.12, metalness: 0.7 })
      );
      top.rotation.x = -Math.PI / 2;
      top.position.set(0, h + 0.0006, (s * half) / 2);
      g.add(top);
    }

    // Faint inset grid + brackets; each half shows its half of one shared texture.
    const tex = gridTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 0.5);
    tex.offset.set(0, s > 0 ? 0 : 0.5);
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(topW, topD),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: PLATFORM.gridOpacity, depthWrite: false })
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(0, h + 0.0012, (s * half) / 2);
    g.add(grid);

    // Emissive edge strips: cyan along this half's outer long side, magenta along its short ends.
    const y = h + tall / 2;
    strip(g, 0x00e5ff, PLATFORM.stripCyan, [w - 2 * inset, tall, t], [0, y, s * (d / 2 - inset)]);
    const len = half - inset - t - 0.04;
    for (const sx of [-1, 1]) strip(g, 0xff2fd0, PLATFORM.stripMagenta, [t, tall, len], [sx * (w / 2 - inset), y, s * (0.04 + len / 2)]);

    parent.add(g);
    return g;
  });

  // The shared reflection (high tier): two quads in the Reflector's local frame (local y = -world z, local z = world y).
  let geo = null;
  let base = null;
  if (shared) {
    const hw = topW / 2, y0 = bevel, y1 = half - bevel;
    base = new Float32Array([
      -hw, -y1, 0, hw, -y1, 0, hw, -y0, 0, -hw, -y0, 0, // front half (world z > 0)
      -hw, y0, 0, hw, y0, 0, hw, y1, 0, -hw, y1, 0, // back half
    ]);
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const mirror = new Reflector(geo, {
      color: PLATFORM.topTint,
      textureWidth: Math.round(1024 * reflectionScale),
      textureHeight: Math.round(768 * reflectionScale),
      clipBias: 0.003,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = h + 0.0006;
    mirror.frustumCulled = false; // its vertices move; the static bounding sphere would be wrong
    mirror.name = 'platform-top';
    parent.add(mirror);
  }

  // drop, slide: 0 = closed .. 1 = fully dropped / fully slid out.
  return function setFloor(drop, slide) {
    const dy = -drop * DROP;
    halves[0].position.set(0, dy, slide * SLIDE);
    halves[1].position.set(0, dy, -slide * SLIDE);
    if (!geo) return;
    const pos = geo.attributes.position;
    for (let i = 0; i < 4; i++) pos.setXYZ(i, base[i * 3], base[i * 3 + 1] - slide * SLIDE, dy);
    for (let i = 4; i < 8; i++) pos.setXYZ(i, base[i * 3], base[i * 3 + 1] + slide * SLIDE, dy);
    pos.needsUpdate = true;
  };
}

// Dark lift pit under the floor opening: walls, a floor and a few dim neon rings so it reads as a shaft when the hatch opens.
function buildPit(parent) {
  const { w, d, pit } = BAY.floor;
  const dark = new THREE.MeshBasicMaterial({ color: 0x05050a, side: THREE.DoubleSide });
  const wall = (pw, ph, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), dark);
    m.position.set(...pos);
    m.rotation.y = rotY;
    parent.add(m);
  };
  wall(d, pit, [w / 2, -pit / 2, 0], Math.PI / 2);
  wall(d, pit, [-w / 2, -pit / 2, 0], Math.PI / 2);
  wall(w, pit, [0, -pit / 2, d / 2], 0);
  wall(w, pit, [0, -pit / 2, -d / 2], 0);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = -pit;
  parent.add(bottom);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) strip(parent, 0xff2fd0, 1.6, [0.04, pit - 0.1, 0.04], [sx * (w / 2 - 0.03), -pit / 2, sz * (d / 2 - 0.03)]);
  for (const y of [-0.55, -1.2]) {
    for (const sz of [-1, 1]) strip(parent, 0x00e5ff, 1.2, [w - 0.1, 0.02, 0.02], [0, y, sz * (d / 2 - 0.025)]);
    for (const sx of [-1, 1]) strip(parent, 0x00e5ff, 1.2, [0.02, 0.02, d - 0.1], [sx * (w / 2 - 0.025), y, 0]);
  }
}

// ---- Ceiling: two panels flush in the opening; to open they slide outward into the slab. A black shaft above the ceiling
// is the "void" the old car lifts into.
function buildCeilingHatch(parent) {
  const { w, d, shaft } = BAY.ceil;
  const top = ROOM.h + 0.1; // ceiling slab top
  const yC = ROOM.h + 0.05;
  const half = d / 2;
  const SLIDE = half + 0.02;
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b1a26, roughness: 0.45, metalness: 0.5 });
  const panels = [1, -1].map((s) => {
    const g = new THREE.Group();
    g.name = s > 0 ? 'ceiling-hatch-front' : 'ceiling-hatch-back';
    const p = new THREE.Mesh(new THREE.BoxGeometry(w - 0.004, 0.08, half - 0.004), mat); // 0.01 m inside the slab faces: no z-fighting
    p.position.set(0, yC, (s * half) / 2);
    g.add(p);
    // seam (magenta) and outer edge (cyan) glow strips on the underside
    strip(g, 0xff2fd0, 1.8, [w - 0.3, 0.004, 0.02], [0, yC - 0.042, s * 0.03]);
    strip(g, 0x00e5ff, 1.3, [w - 0.3, 0.004, 0.02], [0, yC - 0.042, s * (half - 0.05)]);
    parent.add(g);
    return g;
  });
  for (const sx of [-1, 1]) strip(parent, 0x00e5ff, 1.3, [0.02, 0.004, d - 0.1], [sx * (w / 2 - 0.03), yC - 0.052, 0]);

  const black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const wall = (pw, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, shaft), black);
    m.position.set(...pos);
    m.rotation.y = rotY;
    parent.add(m);
  };
  wall(d, [w / 2, top + shaft / 2, 0], Math.PI / 2);
  wall(d, [-w / 2, top + shaft / 2, 0], Math.PI / 2);
  wall(w, [0, top + shaft / 2, d / 2], 0);
  wall(w, [0, top + shaft / 2, -d / 2], 0);
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(w, d), black);
  cap.rotation.x = Math.PI / 2;
  cap.position.y = top + shaft;
  parent.add(cap);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) strip(parent, 0x8f4dff, 1.1, [0.03, shaft - 0.1, 0.03], [sx * (w / 2 - 0.03), top + shaft / 2, sz * (d / 2 - 0.03)]);

  return function setCeiling(slide) {
    panels[0].position.z = slide * SLIDE;
    panels[1].position.z = -slide * SLIDE;
  };
}

// Soft glow decal on the floor around the platform (additive, so it only ever brightens the floor).
function buildFloorGlow(parent) {
  const { w, d } = PLATFORM;
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
  parent.add(glow);
}

// The car bay: raised platform (two sliding halves over a pit), ceiling hatch + shaft, floor glow.
// The returned group has `userData.bay = { setFloor(drop, slide), setCeiling(slide), groundAt(x, z) }`. The cars themselves are added by
// interactables/carswap.js; this only keeps an invisible collider where the car stands.
export function buildCar({ reflectionScale = PLATFORM.reflectionScale } = {}) {
  const g = new THREE.Group();
  g.name = 'car';

  const setFloor = buildFloorHatch(g, reflectionScale);
  buildPit(g);
  const setCeiling = buildCeilingHatch(g);
  buildFloorGlow(g);
  setFloor(0, 0);
  setCeiling(0);
  // Floor height at (x, z): the platform top over its footprint (it is only ever open during a swap, when the area is blocked).
  const groundAt = (x, z) => (Math.abs(x) <= PLATFORM.w / 2 && Math.abs(z) <= PLATFORM.d / 2 ? PLATFORM.h : 0);
  g.userData.bay = { setFloor, setCeiling, groundAt };

  const collider = addBox(g, { name: 'car-collider', size: [4.4, 0.6, 1.9], pos: [0, 0.5, 0], solid: true });
  collider.visible = false;
  collider.raycast = () => {};
  return g;
}

// ---- Cars ---------------------------------------------------------------------------------------------------------

// Placeholder car for entries with no model file: a box body, cabin and four wheels, long axis along x (so rotationY 0).
export function makeBoxCar(def) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: def.box?.color ?? 0x888888, roughness: 0.45, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.6 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 1.8), paint), 0, 0.42, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 1.5), glass), -0.2, 0.88, 0);
  const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16);
  for (const sx of [-1.35, 1.35])
    for (const sz of [-0.9, 0.9]) {
      const w = add(new THREE.Mesh(wheel, tire), sx, 0.34, sz);
      w.rotation.x = Math.PI / 2;
    }
  return g;
}

// Softens the car's reflections (applied to every car; see CAR above). Skips nothing: materials with no paint/clearcoat just
// get the roughness floor.
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

// Frees a car's GPU/CPU memory: geometry, materials and their textures. The scene's shared environment map is left alone
// (tuneCar points every car material at it).
export function disposeCar(root, scene) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) {
      for (const v of Object.values(m)) if (v && v.isTexture && v !== scene.environment) v.dispose();
      m.dispose();
    }
  });
  root.removeFromParent();
}
