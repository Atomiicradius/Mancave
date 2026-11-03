import * as THREE from 'three';

const REACH = 3;
const HIGHLIGHT = new THREE.Color(0xffb060);

// Shared hover/click system. Interactables are meshes tagged with userData.interactable = '<id>'.
// Each id gets a handler: { label(mesh) -> string, onInteract(mesh), onExit?() }.
export function createInteraction({ scene, camera, controls }) {
  const handlers = new Map();
  const raycaster = new THREE.Raycaster(undefined, undefined, 0.05, REACH);
  const center = new THREE.Vector2(0, 0);

  const promptEl = document.getElementById('prompt');
  const toastEl = document.getElementById('toast');
  let toastTimer;

  let hovered = null;
  let saved = null; // original emissive of the hovered mesh
  let active = null; // handler of the interaction in progress, if any

  function setHovered(mesh) {
    if (mesh === hovered) return;
    if (hovered) {
      hovered.material.emissive.copy(saved.color);
      hovered.material.emissiveIntensity = saved.intensity;
    }
    hovered = mesh;
    if (mesh) {
      saved = { color: mesh.material.emissive.clone(), intensity: mesh.material.emissiveIntensity };
      mesh.material.emissive.copy(HIGHLIGHT);
      mesh.material.emissiveIntensity = 0.7;
      promptEl.textContent = `[E] ${handlers.get(mesh.userData.interactable).label(mesh)}`;
      promptEl.style.display = 'block';
    } else {
      promptEl.style.display = 'none';
    }
  }

  function pick() {
    raycaster.setFromCamera(center, camera);
    // Cast against everything so walls/props occlude objects behind them.
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.isMesh);
    const id = hit?.object.userData.interactable;
    return id && handlers.has(id) ? hit.object : null;
  }

  function interact() {
    if (!controls.isLocked || !hovered) return;
    active = handlers.get(hovered.userData.interactable);
    active.onInteract(hovered);
  }

  function exit() {
    if (active?.onExit) active.onExit();
    active = null;
  }

  addEventListener('mousedown', (e) => e.button === 0 && interact());
  addEventListener('keydown', (e) => e.code === 'KeyE' && !e.repeat && interact());
  controls.addEventListener('unlock', () => {
    setHovered(null);
    // Handlers flagged `unlocks` release the pointer on purpose (e.g. a 2D overlay) and close themselves.
    if (!active?.unlocks) exit();
  });

  return {
    controls,
    // True while an interaction owns the screen (pointer released on purpose).
    holdsPointer: () => !!active?.unlocks,
    // Ends the active interaction and hands control back to the player.
    resume() {
      exit();
      document.getElementById('overlay').style.display = 'flex'; // fallback if re-lock is refused
      try {
        controls.lock();
      } catch {
        /* needs a user gesture; clicking the overlay covers it */
      }
    },
    register(id, handler) {
      handlers.set(id, handler);
    },
    toast(text, ms = 2000) {
      toastEl.textContent = text;
      toastEl.style.opacity = 1;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toastEl.style.opacity = 0), ms);
    },
    update() {
      setHovered(controls.isLocked ? pick() : null);
    },
  };
}
