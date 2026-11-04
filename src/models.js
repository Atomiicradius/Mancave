import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ASSETS } from './assets.js';
import { getColliders } from './room.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
loader.setDRACOLoader(draco);

// Scales `model` uniformly to fit inside `size`, then puts its bottom-center at `pos` (y rotation first).
export function fit(model, { size, pos, rotY = 0 }) {
  model.rotation.y = rotY;
  model.updateMatrixWorld(true);
  // `precise`: measure the actual vertices. The default box-of-boxes method inflates parts that are modeled on a diagonal.
  const box = new THREE.Box3().setFromObject(model, true);
  const dim = box.getSize(new THREE.Vector3());
  const s = Math.min(size[0] / dim.x, size[1] / dim.y, size[2] / dim.z);
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  box.setFromObject(model, true);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(pos[0] - c.x, pos[1] - box.min.y, pos[2] - c.z);
}

// Loads a .glb through the shared Draco-enabled loader (used for the swappable cars too).
export const loadGLTF = (url, onProgress) => loader.loadAsync(url, onProgress);

// With no `match`, every mesh in the model is clickable; otherwise only meshes whose own or ancestor node name matches.
function isClickable(mesh, root, match) {
  if (!match) return true;
  for (let n = mesh; n && n !== root; n = n.parent) if (match.test(n.name)) return true;
  return false;
}

// Placeholder meshes stay in the scene (their colliders are separate) but stop rendering and being hit by rays.
function retire(scene, names) {
  for (const n of names) {
    const m = scene.getObjectByName(n);
    if (!m) continue;
    m.visible = false;
    m.raycast = () => {};
  }
}

// Loads every manifest entry that has a file and swaps it in for its placeholder.
// Entries without a file (or that fail to load) keep their placeholder. `onProgress(fraction 0..1)` across all entries.
// `hooks[key](model, scene)` runs after a model is fitted and added, for per-model setup (e.g. splitting out moving parts).
export async function applyModels(scene, { onProgress = () => {}, hooks = {} } = {}) {
  const entries = Object.entries(ASSETS.models).filter(([, e]) => e.file);
  const fractions = entries.map(() => 0);
  const report = () => onProgress(fractions.reduce((a, b) => a + b, 0) / Math.max(1, entries.length));
  report();
  await Promise.all(
    entries.map(async ([key, entry], i) => {
      try {
        // Download progress counts for 90%; fitting/splitting/adding the model is the rest.
        const gltf = await loader.loadAsync(entry.file, (e) => {
          if (!e.lengthComputable) return;
          fractions[i] = (e.loaded / e.total) * 0.9;
          report();
        });
        const model = gltf.scene;
        model.animations = gltf.animations; // so hooks can play them (e.g. the animated neon sign)
        fit(model, entry.fit);
        model.name = `model-${key}`;
        model.traverse((o) => {
          if (!o.isMesh) return;
          if (entry.interactable && isClickable(o, model, entry.interactableMatch)) o.userData.interactable = entry.interactable;
          if (o.material?.map) o.material.map.anisotropy = 4;
        });
        if (entry.collider) {
          // Solid footprint from the fitted model (XZ), for props that stick out into the room.
          const b = new THREE.Box3().setFromObject(model, true);
          getColliders().push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
        }
        retire(scene, entry.hide ?? []);
        scene.add(model);
        hooks[key]?.(model, scene);
      } catch (err) {
        console.warn(`Model "${key}" failed to load; keeping placeholder.`, err);
      }
      fractions[i] = 1;
      report();
    })
  );
}
