import * as THREE from 'three';
import { addBox } from '../room.js';
import { ASSETS } from '../assets.js';

const ROWS = 2;
const COLS = 5;
export const TRACK_COUNT = ROWS * COLS;

let platter;

// Shelf unit on the left wall with a grid of thin box "records", plus a turntable on a stand.
export function buildVinylWall() {
  const g = new THREE.Group();
  g.name = 'vinyl-wall';

  const shelfX = -3.8;
  addBox(g, { name: 'shelf', size: [0.4, 2.0, 2.4], pos: [shelfX, 1.0, -0.8], color: 0x2a1f35, solid: true });

  const colors = [0xff4fd8, 0x00e5ff, 0x9b5cff, 0xffb347, 0x4fff9b];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const rec = addBox(g, {
        name: `vinyl-${i}`,
        size: [0.02, 0.3, 0.3],
        pos: [shelfX + 0.21, 1.0 + r * 0.45, -0.8 + (c - (COLS - 1) / 2) * 0.4],
        color: colors[(i + r) % colors.length],
      });
      rec.userData.interactable = 'vinyl';
      rec.userData.track = i;
    }
  }

  // Turntable stand + deck + platter
  addBox(g, { name: 'turntable-stand', size: [0.5, 0.9, 0.7], pos: [-3.7, 0.45, 1.9], color: 0x1c1626, solid: true });
  const deck = addBox(g, { name: 'turntable', size: [0.4, 0.06, 0.5], pos: [-3.7, 0.93, 1.9], color: 0x111111 });
  deck.userData.interactable = 'turntable';
  platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff8a2a, emissiveIntensity: 0.4 })
  );
  platter.name = 'platter';
  platter.position.set(-3.7, 0.97, 1.9);
  g.add(platter);
  return g;
}

// Clicking a record plays its track (switching if another is playing); the turntable pauses/resumes.
// Returns a per-frame update that spins the platter while music plays.
export function registerVinyl(interaction) {
  const audio = new Audio();
  audio.loop = true;
  const label = document.getElementById('nowplaying');
  let current = -1;

  const show = () => {
    label.textContent = `♪ Now playing: ${ASSETS.tracks[current].title}${audio.paused ? ' (paused)' : ''}`;
    label.style.display = 'block';
  };

  const toggle = () => {
    if (audio.paused) audio.play();
    else audio.pause();
    show();
  };

  interaction.register('vinyl', {
    label: (m) => (m.userData.track === current && !audio.paused ? 'Pause' : `Play: ${ASSETS.tracks[m.userData.track].title}`),
    onInteract(m) {
      const i = m.userData.track;
      if (i === current) return toggle();
      current = i;
      audio.src = ASSETS.tracks[i].file;
      audio.play();
      show();
    },
  });

  interaction.register('turntable', {
    label: () => (current < 0 ? 'Turntable (pick a record)' : audio.paused ? 'Resume' : 'Pause'),
    onInteract() {
      if (current < 0) return interaction.toast('Pick a record from the shelf first');
      toggle();
    },
  });

  return {
    update(dt) {
      if (platter && !audio.paused && current >= 0) platter.rotation.y += dt * 3.5;
    },
  };
}
