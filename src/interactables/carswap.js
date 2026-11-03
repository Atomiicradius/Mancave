import * as THREE from 'three';
import { CARS, CAR_FIT } from '../cars.js';
import { ROOM, BAY, getColliders } from '../room.js';
import { QUALITY } from '../quality.js';
import { fit, loadGLTF } from '../models.js';
import { PLATFORM, makeBoxCar, tuneCar, disposeCar } from './car.js';

// ---- Swap timeline (tweak here). Seconds from the start of a swap; each [start, end] is eased in-out. -----------------
export const TOTAL = 4.6;
export const TL = {
  ceilOpen: [0, 0.9], // ceiling panels slide apart
  floorDrop: [0, 0.4], // platform halves drop below floor level...
  floorSlide: [0.4, 1.0], // ...then slide out under the floor slab, uncovering the pit
  oldLift: [0.6, 2.5], // old car rises through the ceiling hatch
  newRise: [1.7, 3.5], // new car rises out of the pit onto the platform (eased out, with a slight turn)
  ceilClose: [2.7, 3.5], // ceiling panels close once the old car is clear
  floorSlideBack: [3.5, 4.1], // platform halves slide back in under the new car...
  floorRaise: [4.1, 4.5], // ...and rise back to platform height
};
const CARD_MS = 7000; // how long the info card stays up
const CEIL_TOP = ROOM.h + 0.1;
const UP_Y = CEIL_TOP + 0.25; // old car's final base height: fully above the ceiling slab, inside the dark shaft
const REST_PAD = 0.002; // gap above the platform so tires don't z-fight with it

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const range = (t, [a, b]) => clamp01((t - a) / (b - a));
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out = (x) => 1 - Math.pow(1 - x, 3);

// ---- Sound: synthesized with WebAudio (no files): clunks, hatch rumble, a lift motor with a rising whine. --------------
let audioCtx = null;
function mechSound() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    ctx.resume?.();
    const t0 = ctx.currentTime + 0.03;
    const master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    const rumble = (start, dur, freq, gain) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(gain, t0 + start + 0.12);
      g.gain.setValueAtTime(gain, t0 + start + dur - 0.15);
      g.gain.linearRampToValueAtTime(0, t0 + start + dur);
      src.connect(bp).connect(g).connect(master);
      src.start(t0 + start);
      src.stop(t0 + start + dur + 0.05);
    };
    const clunk = (start, freq, gain = 0.8) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.35, t0 + start + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + 0.22);
      osc.connect(g).connect(master);
      osc.start(t0 + start);
      osc.stop(t0 + start + 0.25);
      rumble(start, 0.07, 2200, gain * 0.5); // the metallic tick on top of the thud
    };
    const motor = (start, dur) => {
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.setValueAtTime(55, t0 + start);
      saw.frequency.linearRampToValueAtTime(95, t0 + start + dur * 0.5);
      saw.frequency.linearRampToValueAtTime(60, t0 + start + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      const whine = ctx.createOscillator();
      whine.type = 'sine';
      whine.frequency.setValueAtTime(320, t0 + start);
      whine.frequency.linearRampToValueAtTime(640, t0 + start + dur * 0.5);
      whine.frequency.linearRampToValueAtTime(360, t0 + start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(0.16, t0 + start + 0.25);
      g.gain.setValueAtTime(0.16, t0 + start + dur - 0.3);
      g.gain.linearRampToValueAtTime(0, t0 + start + dur);
      const wg = ctx.createGain();
      wg.gain.value = 0.035;
      saw.connect(lp).connect(g);
      whine.connect(wg).connect(g);
      g.connect(master);
      for (const o of [saw, whine]) { o.start(t0 + start); o.stop(t0 + start + dur + 0.05); }
    };

    clunk(0, 90); // hatch latches release
    rumble(0.05, 1.0, 180, 0.5); // hatch slide
    clunk(1.05, 70, 0.6); // hatches fully open
    motor(0.6, 2.9); // lift motor
    clunk(2.75, 80, 0.5); // ceiling starts to close
    rumble(2.7, 0.8, 200, 0.4);
    clunk(3.5, 75, 0.6);
    rumble(3.5, 1.0, 180, 0.5); // floor hatch closes
    clunk(4.5, 60, 1.0); // final lock
  } catch {
    /* audio blocked or unsupported: the swap just runs silently */
  }
}

// ---- In-world console -------------------------------------------------------------------------------------------
function drawScreen(canvas, { title, name, count, busy }) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#02131a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = busy ? '#ff4fd8' : '#00e5ff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(busy ? 'SWAPPING…' : title, 18, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.fillText(name, 18, 76);
  ctx.fillStyle = '#7fe9ff';
  ctx.font = '20px monospace';
  ctx.fillText(count, 18, 108);
}

function arrowTexture(dir) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff9a3c';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#2a1204';
  ctx.beginPath();
  if (dir > 0) { ctx.moveTo(22, 14); ctx.lineTo(48, 32); ctx.lineTo(22, 50); } else { ctx.moveTo(42, 14); ctx.lineTo(16, 32); ctx.lineTo(42, 50); }
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A small pedestal near the platform's front-right corner: a screen with the current car, and previous / next buttons.
// The screen and buttons are clickable (id 'carswap'; userData.dir = -1 / +1).
export function buildCarConsole() {
  const group = new THREE.Group();
  group.name = 'car-console';
  const px = 2.9, pz = 2.15;
  group.position.set(px, 0, pz);
  group.rotation.y = Math.atan2(-px, -pz); // faces the platform
  getColliders().push({ minX: px - 0.3, maxX: px + 0.3, minZ: pz - 0.3, maxZ: pz + 0.3 });

  const metal = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.4, metalness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.36), metal);
  base.position.y = 0.425;
  group.add(base);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.38), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(1.5) }));
  trim.position.y = 0.84;
  group.add(trim);

  const panel = new THREE.Group();
  panel.position.set(0, 0.9, 0.02);
  panel.rotation.x = 0.5; // tilted toward the player
  group.add(panel);
  panel.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.32), metal));

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const screenTex = new THREE.CanvasTexture(canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.11),
    new THREE.MeshStandardMaterial({ color: 0x000000, map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.9 })
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 0.028, -0.07);
  screen.userData = { interactable: 'carswap', dir: 1 };
  panel.add(screen);

  for (const dir of [-1, 1]) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.04, 0.1),
      new THREE.MeshStandardMaterial({ map: arrowTexture(dir), roughness: 0.5, emissive: 0xff6a00, emissiveIntensity: 0.35 })
    );
    b.position.set(dir * 0.15, 0.04, 0.06);
    b.userData = { interactable: 'carswap', dir };
    panel.add(b);
  }

  const state = { title: 'CAR SELECT', name: '', count: '', busy: false };
  const redraw = () => {
    drawScreen(canvas, state);
    screenTex.needsUpdate = true;
  };
  redraw();
  return {
    group,
    setCar(def, index, total) {
      state.name = def.name.length > 16 ? `${def.name.slice(0, 15)}…` : def.name;
      state.count = `${index + 1} / ${total}`;
      redraw();
    },
    setBusy(busy) {
      state.busy = busy;
      redraw();
    },
  };
}

// ---- The swap controller -------------------------------------------------------------------------------------------
// bay: { setFloor, setCeiling } from buildCar(); ui: from buildCarConsole().
export function createCarSwap({ scene, camera, interaction, bay, ui }) {
  const n = CARS.length;
  const cache = new Map(); // index -> Promise<slot>
  const ready = new Set(); // indices whose model has finished loading
  let cur = 0;
  let current = null;
  let busy = false;
  let anim = null;
  let cardShown = false;

  // The platform opens into a pit, so nobody may be on it when a swap starts, and while it runs the area is a solid block.
  const PLAYER_R = 0.3;
  const onPlatform = () =>
    Math.abs(camera.position.x) < BAY.floor.w / 2 + PLAYER_R && Math.abs(camera.position.z) < BAY.floor.d / 2 + PLAYER_R;
  const platformBlock = { minX: -BAY.floor.w / 2, maxX: BAY.floor.w / 2, minZ: -BAY.floor.d / 2, maxZ: BAY.floor.d / 2 };
  const blockPlatform = (on) => {
    const list = getColliders();
    const i = list.indexOf(platformBlock);
    if (on && i < 0) list.push(platformBlock);
    if (!on && i >= 0) list.splice(i, 1);
  };

  const card = document.getElementById('carcard');
  const loadEl = document.getElementById('carload');
  let cardTimer;

  // Touch devices get on-screen prev/next arrows (shown only while playing).
  const nav = document.createElement('div');
  nav.id = 'carnav';
  nav.innerHTML = '<button type="button" data-dir="-1" aria-label="Previous car">‹</button><button type="button" data-dir="1" aria-label="Next car">›</button>';
  document.body.appendChild(nav);
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) request(Number(b.dataset.dir));
  });
  const syncNav = () => {
    nav.style.display = QUALITY.touch && interaction.controls.isLocked && n > 1 ? 'flex' : 'none';
    nav.classList.toggle('busy', busy);
  };
  interaction.controls.addEventListener('lock', () => {
    syncNav();
    if (!cardShown && current) showCard(current.userData.def);
  });
  interaction.controls.addEventListener('unlock', syncNav);

  function showCard(def) {
    cardShown = true;
    card.querySelector('#carname').textContent = def.name;
    card.querySelector('#caryear').textContent = def.year ?? '';
    card.querySelector('#cardesc').textContent = def.description;
    card.classList.add('show');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => card.classList.remove('show'), CARD_MS);
  }

  const setLoading = (on, name = '') => {
    loadEl.textContent = on ? `Loading ${name}…` : '';
    loadEl.classList.toggle('show', on);
  };

  // Loads one car into a hidden "slot" group parked in the pit. A missing/broken file falls back to a placeholder box car.
  async function build(def, onProgress) {
    let model = null;
    if (def.file) {
      try {
        const gltf = await loadGLTF(def.file, (e) => e.lengthComputable && onProgress?.(e.loaded / e.total));
        model = gltf.scene;
      } catch (err) {
        console.warn(`Car "${def.id}" failed to load (${def.file}); using a placeholder box.`, err);
      }
    }
    const placeholder = !model;
    if (placeholder) model = makeBoxCar(def);
    fit(model, { size: CAR_FIT.size.map((v) => v * def.scale), pos: [0, 0, 0], rotY: placeholder ? 0 : def.rotationY });
    tuneCar(model, scene);
    const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    const [ox, oy, oz] = def.positionOffset;
    const slot = new THREE.Group();
    slot.name = `car-${def.id}`;
    slot.add(model);
    slot.userData = { def, height, rest: new THREE.Vector3(ox, PLATFORM.h + REST_PAD + oy, oz) };
    slot.position.set(ox, -(height + 0.3), oz); // parked in the pit, hidden, until its swap
    slot.visible = false;
    scene.add(slot);
    return slot;
  }

  function ensure(i, onProgress) {
    if (!cache.has(i)) {
      cache.set(i, build(CARS[i], onProgress).then((slot) => { ready.add(i); return slot; }));
    }
    return cache.get(i);
  }

  // Keep only the current car and the one preloaded next; anything else (e.g. a stale preload after going backwards) is freed.
  const pruneCache = () => {
    const keep = new Set([cur, (cur + 1) % n]);
    for (const [i, promise] of cache) {
      if (keep.has(i)) continue;
      cache.delete(i);
      ready.delete(i);
      promise.then((slot) => disposeCar(slot, scene));
    }
  };

  const preloadNext = () => {
    if (n > 1) ensure((cur + 1) % n);
    pruneCache();
  };

  async function init(onProgress) {
    current = await ensure(0, onProgress);
    current.position.copy(current.userData.rest);
    current.visible = true;
    bay.setFloor(0, 0);
    bay.setCeiling(0);
    ui.setCar(CARS[0], 0, n);
    syncNav();
    preloadNext();
  }

  // One frame of the swap at time t (seconds).
  function frame(t) {
    const { old, next } = anim;
    const ceil = inOut(range(t, TL.ceilOpen)) * (1 - inOut(range(t, TL.ceilClose)));
    const drop = inOut(range(t, TL.floorDrop)) * (1 - inOut(range(t, TL.floorRaise)));
    const slide = inOut(range(t, TL.floorSlide)) * (1 - inOut(range(t, TL.floorSlideBack)));
    bay.setCeiling(ceil);
    bay.setFloor(drop, slide);

    const o = old.userData.rest;
    old.position.y = o.y + (UP_Y - o.y) * inOut(range(t, TL.oldLift));
    old.visible = t < TL.ceilClose[1]; // gone once the ceiling has closed behind it

    const r = next.userData.rest;
    const pitY = -(next.userData.height + 0.3);
    const rise = out(range(t, TL.newRise));
    next.position.y = pitY + (r.y - pitY) * rise;
    next.rotation.y = (1 - rise) * -0.7; // a slight turn as it rises
  }

  function begin(idx, next, freeze = null) {
    blockPlatform(true);
    next.visible = true;
    anim = { old: current, next, idx, t: 0, freeze, last: performance.now() };
    frame(freeze ?? 0);
    ui.setBusy(true);
    syncNav();
    if (freeze === null) mechSound();
  }

  function finish() {
    const { old, next, idx } = anim;
    frame(TOTAL);
    const oldIdx = cur;
    disposeCar(old, scene); // free geometry, materials and textures; the old car is gone for good
    cache.delete(oldIdx);
    ready.delete(oldIdx);
    current = next;
    cur = idx;
    anim = null;
    blockPlatform(false);
    busy = false;
    ui.setBusy(false);
    ui.setCar(CARS[cur], cur, n);
    showCard(CARS[cur]);
    syncNav();
    preloadNext();
  }

  async function request(dir) {
    if (n < 2) return interaction.toast('No other cars yet');
    if (busy) return interaction.toast('Swap in progress…', 1200);
    if (onPlatform()) return interaction.toast('Step off the platform first', 1800);
    busy = true;
    ui.setBusy(true);
    syncNav();
    const idx = (cur + dir + n) % n;
    const promise = ensure(idx);
    if (!ready.has(idx)) setLoading(true, CARS[idx].name);
    const next = await promise;
    setLoading(false);
    if (onPlatform()) {
      // walked onto the platform while the next car was loading
      busy = false;
      ui.setBusy(false);
      syncNav();
      return interaction.toast('Step off the platform first', 1800);
    }
    begin(idx, next);
  }

  interaction.register('carswap', {
    label: (m) => (busy ? 'Swapping…' : (m.userData.dir ?? 1) < 0 ? 'Previous car' : 'Next car'),
    onInteract: (m) => request(m.userData.dir ?? 1),
  });

  return {
    init,
    update() {
      if (!anim) return;
      if (anim.freeze !== null) return frame(anim.freeze);
      // Real elapsed time (capped), not the game loop's 0.05 s step: a slow phone still finishes a swap in ~5 s, just choppier.
      const now = performance.now();
      anim.t += Math.min((now - anim.last) / 1000, 0.2);
      anim.last = now;
      frame(Math.min(anim.t, TOTAL));
      if (anim.t >= TOTAL) finish();
    },
    isBusy: () => busy,
    swap: request, // swap(+1 | -1), same as pressing the console button
    state: () => ({ current: cur, name: CARS[cur].name, busy, loaded: [...ready].sort() }),
    // Test hook: start a swap and hold it at time t (seconds) so a single frame can be inspected.
    async debugSwapAt(t, dir = 1) {
      if (busy) return;
      busy = true;
      const idx = (cur + dir + n) % n;
      begin(idx, await ensure(idx), t);
    },
  };
}
