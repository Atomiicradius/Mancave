import * as THREE from 'three';
import { QUALITY, FLAGS, setQuality } from './quality.js';
import { buildRoom, getColliders } from './room.js';
import { buildLighting } from './lighting.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPost } from './post.js';
import { renderCredits } from './credits.js';
import { applyModels } from './models.js';
import { createPlayer } from './player.js';
import { createInteraction } from './interaction.js';
import { buildCar } from './interactables/car.js';
import { buildCarConsole, createCarSwap } from './interactables/carswap.js';
import { createDecor } from './decor.js';
import { buildCeilingRig } from './ceiling.js';
import { buildProps } from './props.js';
import { applyFog } from './atmosphere.js';
import { buildVinylWall, registerVinyl } from './interactables/vinyl.js';
import { buildChess, registerChess } from './interactables/chess.js';
import { buildComputer, registerComputer } from './interactables/computer.js';

const params = new URLSearchParams(location.search);

// The post-processing target does its own MSAA, so the canvas itself needs no antialiasing (unless ?post=off removes the composer).
const renderer = new THREE.WebGLRenderer({ antialias: FLAGS.postOff, powerPreference: 'high-performance' });
renderer.setPixelRatio(QUALITY.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.info.autoReset = false; // accumulate stats across the composer/reflector passes (reset once per frame)
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030a);
applyFog(scene);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50);
scene.add(camera);

const car = buildCar({ reflectionScale: QUALITY.reflectionScale > 0 ? undefined : 0 });
const carConsole = buildCarConsole();
scene.add(buildRoom({ reflectionScale: QUALITY.reflectionScale }), car, carConsole.group, buildVinylWall(), buildChess(), buildComputer());

scene.add(buildLighting({ neonLights: QUALITY.neonLights }));
scene.add(buildCeilingRig());
scene.add(buildProps());
// Dim studio environment so metallic/glossy models (turntable, car paint) have something to reflect.
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;
const post = createPost(renderer, scene, camera, { samples: QUALITY.msaaSamples, enabled: !FLAGS.postOff, bloom: !FLAGS.bloomOff });
post.setSize(innerWidth, innerHeight);

// ?debug=1: print the renderer's and every render target's size, now and after each resize.
function logSizes(label) {
  const sz = renderer.getSize(new THREE.Vector2());
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  const c = renderer.domElement;
  const rows = [...post.targets()];
  scene.traverse((o) => o.isReflector && rows.push([`reflector:${o.name || 'unnamed'}`, o.getRenderTarget()]));
  const lines = [
    `[garage:sizes] ${label}`,
    `  window ${innerWidth}x${innerHeight} | devicePixelRatio ${devicePixelRatio} | renderer.getPixelRatio() ${renderer.getPixelRatio()}`,
    `  renderer.getSize() ${sz.x}x${sz.y} | drawing buffer ${db.x}x${db.y} | canvas attr ${c.width}x${c.height} | canvas css ${c.clientWidth}x${c.clientHeight}`,
    ...(rows.length
      ? rows.map(([n, rt]) => {
          const type = { [THREE.HalfFloatType]: 'HalfFloat', [THREE.FloatType]: 'Float', [THREE.UnsignedByteType]: 'UnsignedByte' }[rt.texture.type] ?? rt.texture.type;
          // the two composer targets must equal the drawing buffer exactly (they are the full-resolution HDR scene buffers)
          const note = n.startsWith('composer.') ? (rt.width === db.x && rt.height === db.y ? ' == drawing buffer OK' : ' != DRAWING BUFFER (MISMATCH)') : '';
          return `  target ${n.padEnd(22)} ${rt.width}x${rt.height} ${type}${rt.samples ? ` MSAAx${rt.samples}` : ''}${note}`;
        })
      : ['  (no extra render targets)']),
    `  flags ${JSON.stringify(FLAGS)} | quality ${QUALITY.low ? 'low' : 'high'}`,
  ];
  console.info(lines.join('\n'));
}
if (FLAGS.debug) logSizes('startup');

const player = createPlayer(camera, renderer.domElement, { touch: QUALITY.touch });
const interaction = createInteraction({ scene, camera, controls: player.controls });
if (QUALITY.touch) player.controls.onTap = (x, y) => interaction.tapAt(x, y);

const vinyl = registerVinyl(interaction);
registerChess(interaction);
const computer = registerComputer(interaction);
const decor = createDecor();
player.setGround(car.userData.bay.groundAt); // the platform is walkable (8 cm step)
const carSwap = createCarSwap({ scene, camera, interaction, bay: car.userData.bay, ui: carConsole });

// --- Loading screen: bar tracks model downloads; "enter" unlocks once models are in and shaders are compiled.
const overlay = document.getElementById('overlay');
const loadBar = overlay.querySelector('#loadbar i');
const startMsg = document.getElementById('startmsg');
const setProgress = (p) => {
  loadBar.style.width = `${Math.round(p * 100)}%`;
  startMsg.textContent = `Loading… ${Math.round(p * 100)}%`;
};

(async () => {
  // The room's models and the first car load in parallel; the bar is a weighted mix of both.
  let pModels = 0, pCar = 0;
  const mix = () => setProgress((pModels * 0.35 + pCar * 0.55));
  await Promise.all([
    applyModels(scene, { hooks: {
        turntable: vinyl.attachTurntable,
        computer: computer.attach,
        neonSigns: decor.attachSigns,
        neonSignAnimated: decor.attachAnimatedSign,
        lampChess: (model, sc) => decor.attachLamp(model, sc, { intensity: 1.6, distance: 1.5 }),
        lampDesk: (model, sc) => decor.attachLamp(model, sc, { intensity: 0.7, distance: 1.6 }),
      }, onProgress: (p) => { pModels = p; mix(); } }),
    carSwap.init((p) => { pCar = p; mix(); }, Math.min(Math.max(0, Number(params.get('car')) || 0), 99)), // `?car=N` starts on car N (for testing)
  ]);
  setProgress(0.95);
  try {
    await renderer.compileAsync(scene, camera); // compile shaders now, not on the first frame the player sees
  } catch {
    /* first render compiles lazily instead */
  }
  setProgress(1);
  overlay.classList.remove('loading');
  startMsg.textContent = QUALITY.touch ? 'Tap to enter' : 'Click to enter';
  if (QUALITY.touch) document.getElementById('help').textContent = 'Left thumb: move · Right thumb: look · Tap objects to use them';
  if (params.has('debug')) {
    // Which meshes are clickable, by interactable id (checks that model tagging matched the right parts).
    const tally = {};
    scene.traverse((o) => o.isMesh && o.userData.interactable && (tally[o.userData.interactable] = (tally[o.userData.interactable] ?? 0) + 1));
    console.info('[garage] interactable meshes', JSON.stringify(tally));
  }
  // `?swapAt=2.2` starts a car swap and freezes it at that many seconds, for screenshots.
  if (params.has('swapAt')) carSwap.debugSwapAt(Number(params.get('swapAt')));
  console.info(`[garage] quality=${QUALITY.low ? 'low' : 'high'} touch=${QUALITY.touch} scene triangles=${countTriangles(scene)} (budget 150000)`);
})();

overlay.addEventListener('click', () => {
  if (!overlay.classList.contains('loading')) player.controls.lock();
});

// High/Low quality toggle on the start screen (remembered; reloads the page since the two tiers build different scenes).
const qBtn = document.getElementById('quality-toggle');
qBtn.textContent = `Quality: ${QUALITY.low ? 'Low' : 'High'} (tap to switch)`;
qBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setQuality(QUALITY.low ? 'high' : 'low');
});

// Credits panel on the start screen; clicks inside it must not start the game.
const creditsEl = document.getElementById('credits');
renderCredits(creditsEl);
document.getElementById('credits-link').addEventListener('click', (e) => {
  e.stopPropagation();
  creditsEl.hidden = false;
});
creditsEl.addEventListener('click', (e) => {
  e.stopPropagation();
  if (e.target.id === 'credits-close') creditsEl.hidden = true;
});
player.controls.addEventListener('lock', () => (overlay.style.display = 'none'));
player.controls.addEventListener('unlock', () => {
  if (!interaction.holdsPointer()) overlay.style.display = 'flex';
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
  scene.traverse((o) => o.userData.resize?.()); // reflections follow the canvas size
  if (FLAGS.debug) logSizes(`after resize to ${innerWidth}x${innerHeight}`);
});

// Triangles in the visible scene (one pass; the floor reflection renders it a second time).
function countTriangles(root) {
  let n = 0;
  root.traverseVisible((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return Math.round(n);
}

// `?fps` shows a small stats readout (fps, triangles actually drawn per frame, draw calls) for performance checks.
let fpsEl = null;
let frames = 0;
let fpsSince = performance.now();
if (params.has('fps')) {
  fpsEl = Object.assign(document.createElement('div'), { id: 'fps' });
  document.body.appendChild(fpsEl);
}

const timer = new THREE.Timer();
renderer.setAnimationLoop((now) => {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  interaction.update();
  vinyl.update(dt);
  carSwap.update(dt);
  decor.update(dt);
  player.update(dt);
  renderer.info.reset();
  post.render();

  if (fpsEl && ++frames && performance.now() - fpsSince > 500) {
    const { calls, triangles } = renderer.info.render;
    fpsEl.textContent = `${Math.round((frames * 1000) / (performance.now() - fpsSince))} fps\n${(triangles / 1000).toFixed(0)}k tris drawn\n${calls} calls\n${QUALITY.low ? 'low' : 'high'}`;
    frames = 0;
    fpsSince = performance.now();
  }
});

// Test hooks for headless checks. `?cam=x,y,z,tx,ty,tz` places the camera and hides the start overlay.
window.__garage = { camera, player, scene, renderer, carSwap, colliders: getColliders, stats: () => ({ triangles: countTriangles(scene) }) };
const cam = params.get('cam');
if (cam) {
  const [x, y, z, tx, ty, tz] = cam.split(',').map(Number);
  camera.position.set(x, y, z);
  camera.lookAt(tx, ty, tz);
  overlay.style.display = 'none';
}
