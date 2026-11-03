import * as THREE from 'three';
import { addBox } from '../room.js';

// Placeholder NSX: low body + cabin on a glowing floor panel. Non-interactive for now.
export function buildCar() {
  const g = new THREE.Group();
  g.name = 'car';

  const panel = addBox(g, { name: 'floor-panel', size: [5.2, 0.02, 2.6], pos: [0, 0.01, 0], color: 0x00e5ff });
  panel.material.emissive.set(0x00a0c0);

  addBox(g, { name: 'car-body', size: [4.4, 0.6, 1.9], pos: [0, 0.5, 0], color: 0xff6a00, solid: true });
  addBox(g, { name: 'car-cabin', size: [1.8, 0.5, 1.6], pos: [-0.2, 1.05, 0], color: 0xcc5500 });
  return g;
}
