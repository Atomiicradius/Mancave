import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { reflectionSize } from './quality.js';

// ---- Floor look (tweak here) ------------------------------------------------------------------------------------------
export const FLOOR = {
  wetReflect: 0.8, // reflectivity of puddles / smooth wet concrete (0-1)
  dryReflect: 0.1, // reflectivity of dry, rough concrete patches
  blur: 1.0, // reflection blur multiplier (rough concrete blurs more than puddles); 0 = razor sharp
  tint: 0x9a94b4, // color the reflection is multiplied by (cool purple keeps it in the neon palette)
  baseColor: 0x45405a, // the concrete itself, before stains and reflection (unlit: this is its final brightness)
  stain: 0.55, // how dark the stains get (0 = none)
  seed: 7, // change to get different puddle / stain patches
  // Deliberate puddles so a few are always in view: [world x, world z, radius x, radius z]
  puddles: [
    [-3.25, -0.8, 0.5, 0.6], // in front of the vinyl console: reflects the album wall
    [-3.3, -2.3, 0.65, 0.4],
    [1.6, 2.6, 0.85, 0.25],
    [-1.2, 2.65, 0.6, 0.22],
    [3.4, 0.2, 0.3, 0.9],
  ],
};

// ---- Procedural maps ---------------------------------------------------------------------------------------------------
function hash(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s, oct = 4) {
  let amp = 0.5, f = 1, t = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    t += amp * vnoise(x * f, y * f, s + i * 17);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return t / n;
}
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Roughness (puddles low, dry concrete high) and stain (darkening) maps covering the whole floor, 64 px per ~meter / 4.
// Texture coords: u = world x / w + 0.5, v = -world z / d + 0.5.
export function makeFloorMaps(w, d, bay) {
  const W = 384, H = 288, s = FLOOR.seed;
  const rough = new Uint8Array(W * H * 4);
  const stain = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const px = (i / W - 0.5) * w, py = (j / H - 0.5) * d; // plane coords (py = -world z)
      const dry = smooth(0.5, 0.68, fbm(px * 0.45 + 3, py * 0.45 + 7, s + 11));
      // natural puddles, kept mostly off the platform footprint (it hides the floor there)
      const onBay = 1 - smooth(0, 0.35, Math.max(Math.abs(px) - bay.w / 2, Math.abs(py) - bay.d / 2) + 0.2);
      let pud = smooth(0.6, 0.72, fbm(px * 0.6 + 9, py * 0.6, s + 31)) * (1 - 0.85 * onBay);
      for (const [cx, cz, rx, rz] of FLOOR.puddles) {
        const dd = Math.hypot((px - cx) / rx, (py + cz) / rz) + (fbm(px * 4, py * 4, s + 9) - 0.5) * 0.6;
        pud = Math.max(pud, 1 - smooth(0.55, 1.0, dd));
      }
      let r = 0.42 + 0.46 * dry + (fbm(px * 9, py * 9, s + 3, 3) - 0.5) * 0.18;
      r = r + (0.05 - r) * Math.min(1, pud * 1.15);
      let st = 1 - FLOOR.stain * smooth(0.6, 0.8, fbm(px * 1.1 + 5, py * 1.1, s + 51)) * 0.8;
      st *= 1 - FLOOR.stain * 0.5 * smooth(0.7, 0.85, fbm(px * 3.2, py * 3.2 + 2, s + 71)); // small oil blots
      st *= 0.96 + 0.08 * fbm(px * 30, py * 30, s + 91, 2); // fine speckle
      const o = (j * W + i) * 4;
      const rv = Math.round(Math.min(1, Math.max(0, r)) * 255);
      const sv = Math.round(Math.min(1, Math.max(0, st)) * 255);
      rough[o] = rough[o + 1] = rough[o + 2] = rv;
      stain[o] = stain[o + 1] = stain[o + 2] = sv;
      rough[o + 3] = stain[o + 3] = 255;
    }
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  return { rough: tex(rough, false), stain: tex(stain, true) };
}

// ---- High tier: planar reflection with roughness-dependent blur --------------------------------------------------------
const floorShader = {
  name: 'GlossyFloorShader',
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      color: { value: new THREE.Color(FLOOR.tint) },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      tRough: { value: null },
      tStain: { value: null },
      uSize: { value: new THREE.Vector2(8, 6) },
      uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 768) },
      uBase: { value: new THREE.Color(FLOOR.baseColor) },
      uWet: { value: FLOOR.wetReflect },
      uDry: { value: FLOOR.dryReflect },
      uBlur: { value: FLOOR.blur },
    },
  ]),
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vPlane;
    #include <common>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vPlane = position.xy;
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform vec3 uBase;
    uniform sampler2D tDiffuse;
    uniform sampler2D tRough;
    uniform sampler2D tStain;
    uniform vec2 uSize;
    uniform vec2 uTexel;
    uniform float uWet;
    uniform float uDry;
    uniform float uBlur;
    varying vec4 vUv;
    varying vec2 vPlane;
    #include <common>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>

    // 12 taps on two rings + center: smooth enough that the blur doesn't read as grain.
    const int TAPS = 12;
    vec2 tap( int i ) {
      float a = float( i ) * 2.39996; // golden angle
      float r = sqrt( ( float( i ) + 0.5 ) / float( TAPS ) );
      return vec2( cos( a ), sin( a ) ) * r;
    }

    void main() {
      #include <logdepthbuf_fragment>
      vec2 muv = vPlane / uSize + 0.5;
      float rough = texture2D( tRough, muv ).r;
      float stain = texture2D( tStain, muv ).r;

      vec2 uv = vUv.xy / vUv.w;
      // blur radius in reflection-target texels: ~1 for puddles, up to ~9 for dry concrete
      float radius = ( 1.0 + smoothstep( 0.05, 0.9, rough ) * 8.0 ) * uBlur;
      vec3 acc = vec3( 0.0 );
      for ( int i = 0; i < TAPS; i ++ ) acc += texture2D( tDiffuse, uv + tap( i ) * radius * uTexel ).rgb;
      vec3 refl = acc / float( TAPS );

      float wet = 1.0 - smoothstep( 0.05, 0.6, rough );
      float reflectivity = mix( uDry, uWet, wet );
      vec3 base = uBase * stain * ( 1.0 - 0.35 * wet ); // wet concrete is a little darker
      gl_FragColor = vec4( base + refl * color * reflectivity, 1.0 );

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

// A floor of size w x d with a rectangular hole (the pit opening). `geometry` is that geometry (ShapeGeometry: uv = plane meters).
// reflectionScale > 0: planar-reflection floor. 0: cheap glossy standard material using the same maps (no extra render pass).
export function buildFloor(geometry, w, d, bay, reflectionScale) {
  const maps = makeFloorMaps(w, d, bay);
  let mesh;
  if (reflectionScale > 0) {
    const [tw, th] = reflectionSize(reflectionScale);
    mesh = new Reflector(geometry, { shader: floorShader, textureWidth: tw, textureHeight: th, clipBias: 0.003 });
    const u = mesh.material.uniforms;
    u.tRough.value = maps.rough;
    u.tStain.value = maps.stain;
    u.uSize.value.set(w, d);
    u.uTexel.value.set(1 / tw, 1 / th);
    mesh.material.fog = true;
    mesh.name = 'floor-reflector';
    // keep the reflection as sharp as the screen after a resize
    mesh.userData.resize = () => {
      const [rw, rh] = reflectionSize(reflectionScale);
      mesh.getRenderTarget().setSize(rw, rh);
      u.uTexel.value.set(1 / rw, 1 / rh);
    };
  } else {
    // uv is in meters; remap to 0..1 over the floor so the maps line up with the high tier
    for (const t of [maps.rough, maps.stain]) {
      t.repeat.set(1 / w, 1 / d);
      t.offset.set(0.5, 0.5);
    }
    mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0xb8b4c8, // multiplies the stain map (which is the albedo here)
        map: maps.stain,
        roughnessMap: maps.rough, // uses the green channel
        roughness: 1,
        metalness: 0.55,
      })
    );
    mesh.material.color.multiplyScalar(0.08);
    mesh.name = 'floor-glossy';
  }
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  return mesh;
}
