import * as THREE from 'three';
import { buildRoom } from './room.js';
import { buildLighting } from './lighting.js';
import { createPost } from './post.js';
import { applyModels } from './models.js';
import { createPlayer } from './player.js';
import { createInteraction } from './interaction.js';
import { buildCar } from './interactables/car.js';
import { buildVinylWall, registerVinyl } from './interactables/vinyl.js';
import { buildChess, registerChess } from './interactables/chess.js';
import { buildComputer, registerComputer } from './interactables/computer.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030a);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50);
scene.add(camera);

scene.add(buildRoom(), buildCar(), buildVinylWall(), buildChess(), buildComputer());

applyModels(scene); // async; placeholders show until each model arrives
scene.add(buildLighting());
const post = createPost(renderer, scene, camera);
post.setSize(innerWidth, innerHeight);

const player = createPlayer(camera, renderer.domElement);
const interaction = createInteraction({ scene, camera, controls: player.controls });

const vinyl = registerVinyl(interaction);
registerChess(interaction);
registerComputer(interaction);

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => player.controls.lock());
player.controls.addEventListener('lock', () => (overlay.style.display = 'none'));
player.controls.addEventListener('unlock', () => {
  if (!interaction.holdsPointer()) overlay.style.display = 'flex';
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  interaction.update();
  vinyl.update(dt);
  player.update(dt);
  post.render();
});

// Test hook for headless checks.
window.__garage = { camera, player };
