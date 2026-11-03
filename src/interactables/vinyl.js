import * as THREE from 'three';
import { addBox } from '../room.js';
import { ASSETS } from '../assets.js';

// Layout (left wall interior face is x = -4): a low wood console with the turntable on top, six album ledges above it.
const CX = -3.8; // console center x
const CZ = -0.8; // console center z
const CON = { d: 0.4, w: 1.0, h: 0.7, t: 0.03 }; // depth (x), width (z), height, panel thickness
const LEDGE_Y = [1.95, 1.45]; // ledge surface heights: top row first, so tracks read left-to-right, top-to-bottom
const PITCH = 0.47; // album center spacing: 0.32 ledge + 0.15 gap
const ALBUM = 0.3;
const TILT = (5 * Math.PI) / 180; // albums lean back against the wall
const LIFT = 0.04; // hover lift, meters out from the wall

const PLATTER_SPEED = 3.5; // rad/s, roughly 33 rpm
const ARM_REST = 0.47; // rad the tonearm is parked away from the record
const ARM_PIVOT = [0.1375, 0.082]; // tonearm bearing, in the turntable mesh's local xy (z is up there)

const albumGroups = [];

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8e5329';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '60,30,10' : '190,120,60'},${0.05 + Math.random() * 0.12})`;
    ctx.fillRect(0, Math.random() * 256, 256, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Gradient cover with the title, used until (or instead of) public/covers/<name>.jpg.
function placeholderCover(i, title) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const h = (i * 57 + 300) % 360;
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, `hsl(${h},75%,52%)`);
  g.addColorStop(1, `hsl(${(h + 50) % 360},80%,18%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.arc(128, 118, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${h},80%,60%)`;
  ctx.beginPath();
  ctx.arc(128, 118, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 128, 230);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildConsole(g) {
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55 });
  const part = (name, size, pos, solid = false) => {
    const m = addBox(g, { name, size, pos, solid });
    m.material.dispose();
    m.material = wood;
    return m;
  };
  const { d, w, h, t } = CON;
  const floorY = 0.115;
  part('console-top', [d, t, w], [CX, h - t / 2, CZ], true);
  part('console-bottom', [d, 0.025, w - 2 * t], [CX, floorY, CZ]);
  for (const s of [-1, 1]) part('console-side', [d, h - 0.1 - t, t], [CX, 0.1 + (h - 0.1 - t) / 2, CZ + s * (w / 2 - t / 2)]);
  const cubbyH = h - t - floorY - 0.0125; // interior height between the bottom panel and the top slab
  const cubbyY = floorY + 0.0125 + cubbyH / 2;
  part('console-back', [0.02, cubbyH, w - 2 * t], [CX - d / 2 + 0.01, cubbyY, CZ]);
  part('console-divider', [d - 0.04, cubbyH, t * 0.7], [CX + 0.01, cubbyY, CZ - 0.05]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) part('console-foot', [0.04, 0.1, 0.04], [CX + sx * (d / 2 - 0.05), 0.05, CZ + sz * (w / 2 - 0.05)]);

  // Upright record sleeves in the cubbies, spines facing the room (+x).
  const spines = [0x20304a, 0x5a2a3a, 0x2c2c34, 0x6a4a2a, 0x1f4a4a, 0x4a3a6a, 0x7a2f2f, 0x303a2a, 0xd8d0c0, 0x2a2a2a];
  const sleeve = (z, i, lean = 0) => {
    const m = addBox(g, {
      name: 'sleeve',
      size: [0.3, 0.31, 0.008],
      pos: [CX + 0.005, floorY + 0.0125 + 0.155, z],
      color: spines[i % spines.length],
    });
    m.rotation.x = lean; // leaning sleeves tilt about the x axis (toward +/-z)
  };
  for (let i = 0; i < 13; i++) sleeve(CZ - 0.07 - 0.055 - i * 0.0115 - 0.2, i * 3);
  for (let i = 0; i < 8; i++) sleeve(CZ + 0.04 + i * 0.0115 + 0.28, i * 7 + 1);
  sleeve(CZ + 0.04 + 8 * 0.0115 + 0.3, 5, 0.18);
}

function buildPlant(g) {
  const px = CX, pz = CZ + 0.38, top = CON.h;
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.04, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: 0xb4592f, roughness: 0.85 })
  );
  pot.position.set(px, top + 0.045, pz);
  g.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8a52, roughness: 0.7 });
  const leafGeo = new THREE.SphereGeometry(1, 8, 6);
  for (let k = 0; k < 9; k++) {
    const pivot = new THREE.Group();
    pivot.position.set(px, top + 0.09, pz);
    pivot.rotation.y = k * 2.4;
    const lean = new THREE.Group();
    lean.rotation.z = -(0.3 + (k % 3) * 0.25);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.scale.set(0.016, 0.075 + (k % 4) * 0.012, 0.038);
    leaf.position.y = 0.075;
    lean.add(leaf);
    pivot.add(lean);
    g.add(pivot);
  }
}

function buildAlbums(g) {
  const black = 0x0b0b10;
  const loader = new THREE.TextureLoader();
  ASSETS.tracks.forEach((track, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    const z = CZ - (col - 1) * PITCH; // viewed from the room (+x) the wall's left is +z
    const y = LEDGE_Y[row];

    // Ledge: thin black shelf with a small front lip.
    addBox(g, { name: 'ledge', size: [0.05, 0.015, 0.32], pos: [-3.975, y - 0.0075, z], color: black });
    addBox(g, { name: 'ledge-lip', size: [0.008, 0.03, 0.32], pos: [-3.954, y + 0.0075, z], color: black });

    // Album: thin backing + textured cover plane, tilted back about its bottom edge.
    const album = new THREE.Group();
    album.name = `album-${i}`;
    album.position.set(-3.966, y, z);
    album.rotation.z = TILT;
    album.userData.baseX = album.position.x;
    album.userData.baseY = y;
    album.userData.lift = 0;
    album.userData.liftNow = 0;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.01, ALBUM, ALBUM), new THREE.MeshStandardMaterial({ color: 0x15151a }));
    back.position.y = ALBUM / 2;
    const mat = new THREE.MeshStandardMaterial({ map: placeholderCover(i, track.title), roughness: 0.5 });
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(ALBUM, ALBUM), mat);
    cover.rotation.y = Math.PI / 2;
    cover.position.set(0.0055, ALBUM / 2, 0);
    cover.userData.interactable = 'vinyl';
    cover.userData.track = i;
    cover.userData.album = album;
    album.add(back, cover);
    g.add(album);
    albumGroups.push(album);

    loader.load(
      track.cover,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        mat.map = tex;
        mat.needsUpdate = true;
      },
      undefined,
      () => {} // no cover file yet: keep the gradient
    );
  });
}

// Vinyl corner: wood console with turntable + plant, and the album wall above it.
export function buildVinylWall() {
  const g = new THREE.Group();
  g.name = 'vinyl-wall';
  buildConsole(g);
  buildPlant(g);
  buildAlbums(g);

  // Placeholder deck, retired once the turntable model loads (see assets.js `hide`).
  const deck = addBox(g, { name: 'turntable-placeholder', size: [0.4, 0.06, 0.5], pos: [CX, CON.h + 0.03, -1.0], color: 0x3a2412 });
  deck.userData.interactable = 'turntable';
  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  platter.name = 'platter-placeholder';
  platter.position.set(CX, CON.h + 0.07, -1.0);
  g.add(platter);
  return g;
}

// Moves triangles whose centroid (mesh-local x, y) satisfies `want` into a new sibling mesh sharing the material.
function splitOff(mesh, want) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index.array;
  const keep = [], take = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(pos, idx[i]);
    b.fromBufferAttribute(pos, idx[i + 1]);
    c.fromBufferAttribute(pos, idx[i + 2]);
    (want((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3) ? take : keep).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const picked = new THREE.Mesh(geo.clone(), mesh.material);
  picked.geometry.setIndex(take);
  geo.setIndex(keep);
  picked.name = `${mesh.name}-split`;
  picked.position.copy(mesh.position);
  picked.quaternion.copy(mesh.quaternion);
  picked.scale.copy(mesh.scale);
  picked.userData = { ...mesh.userData };
  mesh.parent.add(picked);
  return picked;
}

// Re-centers a mesh's geometry on mesh-local (x, y) so rotation.z spins/swings it about that point.
function pivotAt(mesh, x, y) {
  mesh.geometry.translate(-x, -y, 0);
  mesh.position.add(new THREE.Vector3(x, y, 0).applyQuaternion(mesh.quaternion).multiply(mesh.scale));
}

// Clicking an album starts it: the record on the platter spins up, the tonearm swings on, audio plays.
// Clicking the turntable pauses/resumes. Returns the per-frame update and the turntable model hook.
export function registerVinyl(interaction) {
  const audio = new Audio();
  audio.loop = true;
  const label = document.getElementById('nowplaying');
  let current = -1;
  let fileIdx = 0;
  let spin = 0;
  let armAngle = ARM_REST;
  const parts = { disc: null, arm: null };

  const playing = () => current >= 0 && !audio.paused;
  const show = () => {
    label.textContent = `♪ Now playing: ${ASSETS.tracks[current].title}${audio.paused ? ' (paused)' : ''}`;
    label.style.display = 'block';
  };
  const start = () => audio.play().catch(() => {});

  // Try each candidate file in order (mp3 first, then the placeholder wav).
  audio.addEventListener('error', () => {
    const files = ASSETS.tracks[current]?.audio ?? [];
    if (fileIdx < files.length - 1) {
      audio.src = files[++fileIdx];
      start();
    } else {
      interaction.toast('Could not load this track');
    }
  });

  const toggle = () => {
    if (audio.paused) start();
    else audio.pause();
    show();
  };
  audio.addEventListener('pause', () => current >= 0 && show());
  audio.addEventListener('play', () => current >= 0 && show());

  interaction.register('vinyl', {
    label: (m) => {
      const t = ASSETS.tracks[m.userData.track];
      return m.userData.track === current && playing() ? `Pause: ${t.title}` : `Play: ${t.title}`;
    },
    onInteract(m) {
      const i = m.userData.track;
      if (i === current) return toggle();
      current = i;
      fileIdx = 0;
      audio.src = ASSETS.tracks[i].audio[0];
      start();
      show();
    },
    onHover(m, over) {
      m.userData.album.userData.lift = over ? 1 : 0;
    },
  });

  interaction.register('turntable', {
    label: () => (current < 0 ? 'Turntable (pick an album)' : playing() ? 'Pause' : 'Resume'),
    onInteract() {
      if (current < 0) return interaction.toast('Pick an album from the wall first');
      toggle();
    },
  });

  return {
    // Splits the record and tonearm out of the merged turntable meshes so they can move independently.
    attachTurntable(model) {
      const plastic = model.getObjectByName('Object_6');
      const arm = model.getObjectByName('Object_9');
      if (plastic) {
        const disc = splitOff(plastic, (x) => x < 0.1);
        disc.geometry.computeBoundingBox();
        const c = disc.geometry.boundingBox.getCenter(new THREE.Vector3());
        pivotAt(disc, c.x, c.y);
        parts.disc = disc;
      }
      if (arm) {
        pivotAt(arm, ...ARM_PIVOT);
        arm.rotation.z = armAngle;
        parts.arm = arm;
      }
    },
    update(dt) {
      const on = playing();
      spin += ((on ? PLATTER_SPEED : 0) - spin) * Math.min(1, dt * 2.5);
      if (parts.disc) parts.disc.rotation.z -= spin * dt; // clockwise seen from above
      armAngle += ((on ? 0 : ARM_REST) - armAngle) * Math.min(1, dt * 2.2);
      if (parts.arm) parts.arm.rotation.z = armAngle;

      for (const a of albumGroups) {
        const u = a.userData;
        u.liftNow += (u.lift - u.liftNow) * Math.min(1, dt * 12);
        a.position.x = u.baseX + u.liftNow * LIFT;
        a.position.y = u.baseY + u.liftNow * 0.015;
      }
    },
  };
}
