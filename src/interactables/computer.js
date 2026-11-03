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
  screen.name = 'monitor-screen';
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

  return {
    // The model's monitor is switched off; give its screen the cyan glow the placeholder had so it reads as clickable.
    attach(model) {
      // three.js strips dots from node names, so the glTF node "monitor_Material.002_0" is "monitor_Material002_0" here.
      let screen = null;
      model.traverse((o) => o.isMesh && /^monitor_Material.?002/.test(o.name) && (screen = o));
      if (!screen) return;
      screen.material = screen.material.clone(); // don't touch materials shared with other parts
      Object.assign(screen.material, { map: null, emissiveMap: null, color: new THREE.Color(0x001018), emissive: new THREE.Color(0x00c8ff), emissiveIntensity: 0.9 });
    },
  };
}
