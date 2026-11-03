import * as THREE from 'three';
import { addBox } from '../room.js';
import { PORTFOLIO_URL } from '../config.js';

// Desk on the back wall with a monitor (box + emissive screen plane).
export function buildComputer() {
  const g = new THREE.Group();
  g.name = 'computer';

  addBox(g, { name: 'desk', size: [2.0, 0.75, 0.8], pos: [0, 0.375, -2.6], color: 0x1c1626, solid: true });
  const monitor = addBox(g, { name: 'monitor', size: [0.9, 0.5, 0.05], pos: [0, 1.25, -2.8], color: 0x0a0a0a });
  monitor.userData.interactable = 'computer';

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x001018, emissive: 0x00c8ff, emissiveIntensity: 0.8 })
  );
  screen.position.set(0, 1.25, -2.774);
  screen.userData.interactable = 'computer';
  g.add(screen);
  addBox(g, { name: 'monitor-stand', size: [0.08, 0.25, 0.08], pos: [0, 0.88, -2.8], color: 0x0a0a0a });
  return g;
}

export function registerComputer(interaction) {
  let opening = false;
  interaction.register('computer', {
    label: () => 'Open portfolio',
    onInteract() {
      if (opening) return;
      opening = true;
      interaction.toast('Opening portfolio...', 1200);
      setTimeout(() => {
        window.open(PORTFOLIO_URL, '_blank', 'noopener');
        opening = false;
      }, 900);
    },
  });
}
