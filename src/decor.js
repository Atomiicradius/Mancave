import * as THREE from 'three';

// Non-interactive decor: neon signs and lamps. Everything tweakable is in SIGNS / LAMP below.
export const SIGNS = {
  // The sign-set glb has plain emissive colors; at 1.0 they barely clear the bloom threshold, so they are pushed up and the
  // diffuse color is darkened (otherwise the white base color washes the tube colors out).
  emissive: 2.2,
  baseDark: 0.05,
  // The animated sign's frames are emissive textures.
  animatedEmissive: 1.6,
  animatedSpeed: 1, // playback speed of its 6.5 s loop
};

export const LAMP = {
  color: 0xffd7a0, // warm white
  bulbEmissive: 1.2, // bulbs/shades glow (and bloom a little)
  glassEmissive: 0.5, // see-through glass parts
};

export function createDecor() {
  const mixers = [];

  return {
    // The multi-sign set: make every neon tube glow.
    attachSigns(model) {
      const done = new Set();
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (done.has(m)) continue;
          done.add(m);
          m.color.setScalar(SIGNS.baseDark);
          m.emissiveIntensity = SIGNS.emissive;
          m.roughness = 0.5;
          m.metalness = 0;
        }
      });
    },

    // The animated sign: boost its emissive frames and loop its animation clip(s).
    attachAnimatedSign(model) {
      const done = new Set();
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (done.has(m)) continue;
          done.add(m);
          m.emissiveIntensity = SIGNS.animatedEmissive;
        }
      });
      if (!model.animations?.length) return;
      const mixer = new THREE.AnimationMixer(model);
      mixer.timeScale = SIGNS.animatedSpeed;
      for (const clip of model.animations) mixer.clipAction(clip).play();
      mixers.push(mixer);
    },

    // A lamp: bulb glow plus a real (short-range) point light so it actually lights its surroundings.
    // `distance` is kept short so a lamp never reaches the car (see the lighting notes in lighting.js).
    attachLamp(model, scene, { intensity = 2.5, distance = 1.5 } = {}) {
      const done = new Set();
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (done.has(m)) continue;
          done.add(m);
          if (/bulb|light/i.test(m.name)) m.emissiveIntensity = m.transparent ? LAMP.glassEmissive : LAMP.bulbEmissive;
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const c = box.getCenter(new THREE.Vector3());
      const light = new THREE.PointLight(LAMP.color, intensity, distance, 2);
      light.position.set(c.x, box.max.y - 0.04, c.z);
      light.name = 'lamp-light';
      scene.add(light);
    },

    update(dt) {
      for (const m of mixers) m.update(dt);
    },
  };
}
