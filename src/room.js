import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Room dimensions in meters. Centered on x/z origin, floor at y=0.
export const ROOM = { w: 8, d: 6, h: 3, wall: 0.2 };

// The car bay: two openings centered on the origin. The floor opening (= the platform) is wider than the car (4.4 x 1.9) so there
// is a ~0.8 m lane to walk around it on the platform. The floor one (the platform's footprint) is the pit the next car rises from;
// the ceiling one lets the old car leave. Hatch panels slide into the slab around each opening (see interactables/car.js).
export const BAY = {
  floor: { w: 5.4, d: 3.4, pit: 2.0, slab: 0.2 }, // pit = depth below the floor; slab = floor thickness (the platform halves hide inside it)
  ceil: { w: 4.8, d: 2.3, shaft: 2.4 }, // shaft = height of the dark void above the ceiling
};

const colliders = []; // XZ-plane AABBs: { minX, maxX, minZ, maxZ }

export function getColliders() {
  return colliders;
}

// Adds a box mesh to `parent`; if `solid`, registers it as a collider.
export function addBox(parent, { size, pos, color = 0x444444, solid = false, name = '' }) {
  const [sx, sy, sz] = size;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  mesh.position.set(...pos);
  mesh.name = name;
  parent.add(mesh);
  if (solid) {
    colliders.push({
      minX: pos[0] - sx / 2, maxX: pos[0] + sx / 2,
      minZ: pos[2] - sz / 2, maxZ: pos[2] + sz / 2,
    });
  }
  return mesh;
}

// Small procedural brick tile (256px, repeats seamlessly), tinted dark so neon light reads on it.
function brickTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1220';
  ctx.fillRect(0, 0, 256, 256);
  const rows = 8, bw = 64, bh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = -1; i < 4; i++) {
      const x = i * bw + (r % 2 ? bw / 2 : 0);
      const l = 28 + Math.random() * 14;
      ctx.fillStyle = `hsl(${350 + Math.random() * 20}, 28%, ${l}%)`;
      ctx.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Dark glossy floor: a planar reflection (so neon strips and the car mirror in it), tinted dark.
// Flat rectangle with a rectangular hole (the pit opening), in the XY plane like PlaneGeometry.
function rectWithHole(w, d, hole) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2);
  shape.lineTo(w / 2, -d / 2);
  shape.lineTo(w / 2, d / 2);
  shape.lineTo(-w / 2, d / 2);
  shape.closePath();
  const cut = new THREE.Path();
  cut.moveTo(-hole.w / 2, -hole.d / 2);
  cut.lineTo(-hole.w / 2, hole.d / 2);
  cut.lineTo(hole.w / 2, hole.d / 2);
  cut.lineTo(hole.w / 2, -hole.d / 2);
  cut.closePath();
  shape.holes.push(cut);
  return new THREE.ShapeGeometry(shape);
}

// Four slabs around a rectangular opening (so hatch panels can slide into the slab and a car can pass through the hole).
function slabsAround(room, name, y, thickness, color, hole) {
  const { w, d } = ROOM;
  const hw = hole.w / 2, hd = hole.d / 2;
  addBox(room, { name: `${name}-left`, size: [w / 2 - hw, thickness, d], pos: [-(hw + w / 2) / 2, y, 0], color });
  addBox(room, { name: `${name}-right`, size: [w / 2 - hw, thickness, d], pos: [(hw + w / 2) / 2, y, 0], color });
  addBox(room, { name: `${name}-front`, size: [hole.w, thickness, d / 2 - hd], pos: [0, y, (hd + d / 2) / 2], color });
  addBox(room, { name: `${name}-back`, size: [hole.w, thickness, d / 2 - hd], pos: [0, y, -(hd + d / 2) / 2], color });
}

function glossyFloor(w, d, renderScale) {
  const floor = new Reflector(rectWithHole(w, d, BAY.floor), {
    color: 0x3a3548,
    textureWidth: Math.round(1024 * renderScale),
    textureHeight: Math.round(768 * renderScale),
    clipBias: 0.003,
  });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.name = 'floor-reflector';
  return floor;
}

// Low-tier floor: no second scene render; glossy PBR material that picks up the scene's environment map instead.
function cheapFloor(w, d) {
  const floor = new THREE.Mesh(
    rectWithHole(w, d, BAY.floor),
    new THREE.MeshStandardMaterial({ color: 0x1b1824, roughness: 0.25, metalness: 0.6 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.name = 'floor-glossy';
  return floor;
}

// reflectionScale: planar reflection render scale (0 = use the cheap floor).
export function buildRoom({ reflectionScale = 0.6 } = {}) {
  const room = new THREE.Group();
  const { w, d, h, wall: t } = ROOM;

  slabsAround(room, 'floor', -BAY.floor.slab / 2, BAY.floor.slab, 0x0c0a12, BAY.floor);
  room.add(reflectionScale > 0 ? glossyFloor(w, d, reflectionScale) : cheapFloor(w, d));
  slabsAround(room, 'ceiling', h + 0.05, 0.1, 0x15121c, BAY.ceil);

  // Walls sit just outside the interior volume so the interior is exactly w x d.
  const bricks = brickTexture();
  const wallTex = (sx, sy) => {
    const tex = bricks.clone();
    tex.needsUpdate = true;
    tex.repeat.set(sx / 1.2, sy / 1.2);
    return tex;
  };
  const wall = (name, size, pos) => {
    const m = addBox(room, { name, size, pos, color: 0xffffff, solid: true });
    m.material.map = wallTex(Math.max(size[0], size[2]), size[1]);
    m.material.roughness = 0.9;
  };
  wall('wall-back',  [w + 2 * t, h, t], [0, h / 2, -d / 2 - t / 2]);
  wall('wall-front', [w + 2 * t, h, t], [0, h / 2,  d / 2 + t / 2]);
  wall('wall-left',  [t, h, d], [-w / 2 - t / 2, h / 2, 0]);
  wall('wall-right', [t, h, d], [ w / 2 + t / 2, h / 2, 0]);

  return room;
}
