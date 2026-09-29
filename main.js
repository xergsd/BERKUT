// main.js — связывает всё вместе: рендер, цикл, биомы, камера
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { BIOMES, createSky, applyBiome, createPostFX } from './visuals.js';
import { World, height } from './world.js';
import { Player } from './player.js';
import { Game } from './game.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 2000);

const sky = createSky(scene);
const world = new World(scene);
const player = new Player(scene, window);
const game = new Game();
const fx = createPostFX(renderer, scene, camera);

let biomeStage = 0;

function startRun() {
  world.setBiome(BIOMES[0]);
  applyBiome(scene, 0, 1);
  biomeStage = 0;
  player.reset();
  world.reset();
  game.start();
}
addEventListener('pointerdown', () => { if (game.state !== 'playing') startRun(); });
addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && game.state !== 'playing') { e.preventDefault(); startRun(); }
});

// Биом по дистанции: stage 0 = Степь, дальше по кругу с плавным переходом
function updateBiome(dist) {
  const stage = Math.floor(dist / CONFIG.biomeEvery);
  const idx = stage % BIOMES.length;
  if (stage !== biomeStage) { biomeStage = stage; world.setBiome(BIOMES[idx]); }
  const t = stage === 0 ? 1 : Math.min(1, (dist - stage * CONFIG.biomeEvery) / CONFIG.biomeBlend);
  applyBiome(scene, idx, t);
  return BIOMES[idx].name;
}

const camTarget = new THREE.Vector3();
let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;

  const step = game.tick(dt);
  if (game.state !== 'over') player.update(dt, time, step);

  if (game.state === 'playing') {
    const hit = world.collides(player.pos, CONFIG.eagleRadius);
    if (hit) game.crash(hit);
  } else if (game.state === 'ready') {
    // на стартовом экране не даём беркуту уйти в землю
    player.pos.y = Math.max(player.pos.y, height(player.pos.x, player.pos.z) + 8);
  }

  world.update(player.pos, game.dist);
  const biomeName = updateBiome(game.dist);
  sky.update(player.pos, 0);

  // камера сзади и чуть сверху
  const p = player.pos;
  camTarget.set(p.x * 0.7, p.y + 9, p.z + 18);
  camera.position.lerp(camTarget, Math.min(1, dt * 3));
  camera.lookAt(p.x * 0.85, p.y + 1, p.z - 30);

  game.updateHud(biomeName);
  fx.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fx.setSize(innerWidth, innerHeight);
});
