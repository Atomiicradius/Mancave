import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Look controls (tweak here). ACES filmic tone mapping is always on.
//  exposure       lower = darker/less blown-out highlights on the white paint (was 1.0)
//  bloomStrength  glow amount (was 0.9)
//  bloomRadius    how far the glow spreads
//  bloomThreshold HDR luminance a pixel needs before it glows. Neon strips are ~1.0-2.5 in HDR, white paint under a light is
//                 ~0.5-1.0 after exposure, so 1.0 lets only the strips bloom. Going below 1.0 makes the paint glow too, and
//                 going much above it starts to kill the magenta strips (their luminance is only just over 1).
//  vignette       corner darkening, 0 = off, ~0.3 = subtle. (Applied after tone mapping, so it never changes what blooms.)
//  vignetteStart  distance from the center (0 = center, 1 = corner) where the darkening begins
//  grain          film grain amplitude, 0 = off, ~0.03 = subtle. Animated, and strongest in the midtones.
export const POST = { exposure: 0.8, bloomStrength: 0.4, bloomRadius: 0.5, bloomThreshold: 1.0, vignette: 0.3, vignetteStart: 0.42, grain: 0.03 };

// Final pass, after OutputPass (so it works on display-ready sRGB color): vignette + film grain.
const FinishShader = {
  name: 'FinishShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: POST.vignette },
    uVignetteStart: { value: POST.vignetteStart },
    uGrain: { value: POST.grain },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uVignetteStart;
    uniform float uGrain;
    varying vec2 vUv;
    float hash( vec2 p ) {
      vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
      p3 += dot( p3, p3.yzx + 33.33 );
      return fract( ( p3.x + p3.y ) * p3.z );
    }
    void main() {
      vec3 col = texture2D( tDiffuse, vUv ).rgb;
      // vignette: radial, aspect-corrected so it is round
      vec2 c = vUv - 0.5;
      float d = length( c * vec2( 1.0, 0.82 ) ) * 1.6;
      col *= 1.0 - uVignette * smoothstep( uVignetteStart, 1.0, d );
      // grain: fresh noise each frame, strongest in the midtones, weak in pure black and pure white
      float n = hash( gl_FragCoord.xy + fract( uTime ) * 311.0 ) - 0.5;
      float luma = dot( col, vec3( 0.299, 0.587, 0.114 ) );
      col += n * uGrain * ( 0.35 + 1.3 * ( 1.0 - abs( luma * 2.0 - 1.0 ) ) );
      gl_FragColor = vec4( col, 1.0 );
    }`,
};

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
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);

  return {
    render: () => {
      finish.uniforms.uTime.value = performance.now() / 1000;
      composer.render();
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
