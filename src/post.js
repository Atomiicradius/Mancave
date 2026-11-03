import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Look controls (tweak here). ACES filmic tone mapping is always on.
//  exposure       lower = darker/less blown-out highlights on the white paint (was 1.0)
//  bloomStrength  glow amount (was 0.9)
//  bloomRadius    how far the glow spreads
//  bloomThreshold HDR luminance a pixel needs before it glows. Neon strips are ~1.0-2.5 in HDR, white paint under a light is
//                 ~0.5-1.0 after exposure, so 1.0 lets only the strips bloom. Going below 1.0 makes the paint glow too, and
//                 going much above it starts to kill the magenta strips (their luminance is only just over 1).
export const POST = { exposure: 0.8, bloomStrength: 0.4, bloomRadius: 0.5, bloomThreshold: 1.0 };

// Scene -> bloom (only HDR-bright pixels: neon strips, bulbs, highlights) -> tone map + sRGB.
// `samples`: MSAA samples for the HDR render target (0 = off); the canvas's own antialiasing doesn't apply to it.
export function createPost(renderer, scene, camera, { samples = 0 } = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = POST.exposure;

  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), POST.bloomStrength, POST.bloomRadius, POST.bloomThreshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return {
    render: () => composer.render(),
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
