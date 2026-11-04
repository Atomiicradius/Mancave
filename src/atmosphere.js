import * as THREE from 'three';
import { QUALITY } from './quality.js';

// ---- Atmosphere (tweak here) ------------------------------------------------------------------------------------------
export const FOG = {
  color: 0x1a0f36, // dark purple-blue; it also tints the far walls slightly
  // Exponential fog: how much of the fog color is mixed in at distance d is 1 - exp(-(d * density)^2).
  // 0.028 -> ~3% at 6 m and ~8% at the far corner (10 m). Set 0 to turn it off.
  density: 0.028,
};

export function applyFog(scene) {
  if (!QUALITY.fog || FOG.density <= 0) return;
  scene.fog = new THREE.FogExp2(FOG.color, FOG.density);
}
