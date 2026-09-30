// main.js — связывает всё вместе: рендер, цикл, биомы, камера
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { BIOMES, createSky, applyBiome, createPostFX } from './visuals.js';
import { World, height } from './world.js';
import { Player } from './player.js';
import { Game } from './game.js';
import { FlightAudio } from './audio.js';
import { Nature } from './nature.js';
import { Prey } from './prey.js';
import { Menu } from './menu.js';
import { Effects } from './effects.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 2000);

const sky = createSky(scene);
const world = new World(scene);
const nature = new Nature(scene, world);
const prey = new Prey(scene, world);
const player = new Player(scene, window);
const game = new Game();
const fx = createPostFX(renderer, scene, camera);
const sound = new FlightAudio();
const effects = new Effects(scene);
let camShake = 0; // 0..1 — толчок камеры при поимке
prey.onBleat = (side) => { if (game.state === 'playing') sound.bleat(side); };

let biomeStage = 0;
// камера дальше, чтобы было видно окружение; на узком экране отходит ещё дальше
const cameraDistance = () => 26 / Math.min(1, (innerWidth / innerHeight) / 0.95);

// мир и беркут — в начало, первый ландшафт
function resetWorld() {
  world.setBiome(BIOMES[0]);
  applyBiome(scene, 0, 1);
  biomeStage = 0;
  player.reset();
  prey.reset(); // до world.reset: скалы расставляются в обход новых козлят
  world.reset();
  nature.reset();
  effects.clear();
  camShake = 0;
  camera.position.set(player.pos.x * 0.7, player.pos.y + 11, player.pos.z + cameraDistance());
}

function startRun(mode) {
  resetWorld();
  game.start(mode);
  menu.hide();
}

function toMenu() {
  resetWorld();
  game.toMenu();
  menu.setBest(game.best);
  menu.show('main');
}

function setPaused(on) {
  if (game.state !== 'playing' || game.paused === on) return;
  game.paused = on;
  if (on) menu.show('pause');
  else menu.hide();
}

const menu = new Menu({
  hunt: () => startRun('hunt'),
  free: () => startRun('free'),
  resume: () => setPaused(false),
  restart: () => startRun(game.mode),
  menu: toMenu,
  quality: (q) => {
    nature.setQuality(q); // меньше травы, цветов и частиц
    renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'high' ? 2 : 1));
    renderer.setSize(innerWidth, innerHeight);
    fx.setSize(innerWidth, innerHeight);
  },
  keySens: (k) => { player.keySens = k; },
});
game.onOver = (result) => menu.showOver(result);
menu.setBest(game.best);
menu.show('main');

const pauseBtn = document.getElementById('pause-btn');
pauseBtn.addEventListener('click', () => setPaused(true));
// ушли со вкладки — пауза
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

addEventListener('pointerdown', () => sound.unlock());
addEventListener('keydown', (e) => {
  if (['Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) sound.unlock();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    e.preventDefault();
    if (game.state === 'playing' && !menu.current) setPaused(true);
    else if (menu.current === 'pause') setPaused(false);
    else if (menu.current === 'howto' || menu.current === 'settings') menu.back();
    return;
  }
  // на кнопке пробел и Enter нажимают саму кнопку — не дублируем
  if ((e.code === 'Space' || e.code === 'Enter') && !e.target?.closest?.('button, input')) {
    if (menu.current === 'main') { e.preventDefault(); startRun('hunt'); }
    else if (menu.current === 'over') { e.preventDefault(); startRun(game.mode); }
  }
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

// Поимка: очки и силы, добыча в когтях, пыль или перья, звук, толчок камеры
function onCatch(kind, pos) {
  game.catchPrey(kind);
  player.grab(kind);
  effects.burst(kind, pos);
  sound.catchSound(kind);
  camShake = 1;
}

const camTarget = new THREE.Vector3();
let camDive = 0; // 0..1 — насколько быстро беркут падает; камера смотрит ниже, обзор шире
let camCarry = 0; // 0..1 — беркут несёт добычу: камера опускается, чтобы было видно когти
let last = performance.now();

function loop(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // первый кадр может прийти «раньше» last
  last = now;
  pauseBtn.classList.toggle('hidden', game.state !== 'playing' || game.paused);
  if (game.paused) { // мир замер, звук полёта затих
    sound.update({ active: false });
    fx.render();
    requestAnimationFrame(loop);
    return;
  }
  const time = now / 1000;

  const step = game.tick(dt, player.boostHeld, player.diveHeld);
  const playing = game.state === 'playing';
  // добыча близко впереди — беркут выпускает когти
  const reach = (dt > 0 ? step / dt : 0) * CONFIG.strikeTime;
  player.strikeWanted = playing && (world.preyAhead(player.pos, reach) || prey.preyAhead(player.pos, reach));
  const lunge = reach * CONFIG.strikeLunge / CONFIG.strikeTime;
  player.lungeWanted = player.strikeWanted && (world.preyAhead(player.pos, lunge) || prey.preyAhead(player.pos, lunge));
  if (game.state !== 'over') player.update(dt, time, step, playing && game.boosting, playing && game.exhausted, playing && game.diving);

  if (playing) {
    const p = player.pos;
    game.scoreDistance(step, p.y - height(p.x, p.z));
    const hit = prey.collides(p, CONFIG.eagleRadius) ? 'rock' : world.collides(p, CONFIG.eagleRadius);
    if (hit === 'rock' || (hit === 'ground' && !game.groundHit(player.vy < -CONFIG.diveHardFall))) game.crash(hit);
    else {
      if (hit === 'ground') player.bounce(height(p.x, p.z) + CONFIG.eagleRadius + 0.3);
      for (let n = world.nearMisses(p, CONFIG.eagleRadius); n > 0; n--) game.nearMiss();
      for (const pos of world.catchPrey(p)) onCatch('marmot', pos);
      for (const c of prey.catch(p)) onCatch(c.kind, c.pos);
    }
  } else if (game.state === 'ready') {
    // на стартовом экране не даём беркуту уйти в землю
    player.pos.y = Math.max(player.pos.y, height(player.pos.x, player.pos.z) + 8);
  }

  // после удара о землю беркут мигает, пока неуязвим
  player.mesh.visible = !(game.state === 'playing' && game.invuln > 0 && Math.floor(time * 12) % 2 === 1);

  world.update(player.pos, game.dist);
  world.updatePrey(dt, player.pos, dt > 0 ? step / dt : 0, game.diving);
  prey.update(dt, player.pos, dt > 0 ? step / dt : 0);
  effects.update(dt);
  const biomeName = updateBiome(game.dist);
  if (game.state !== 'over') nature.update(dt, time, player.pos);
  sky.update(player.pos, 0);

  // камера сзади и чуть сверху
  const p = player.pos;
  camCarry += ((player.carryT > 0 ? 1 : 0) - camCarry) * Math.min(1, dt * 3);
  camTarget.set(p.x * 0.7, p.y + 11 - camCarry * 5, p.z + cameraDistance());
  camera.position.lerp(camTarget, Math.min(1, dt * 3));
  if (camShake > 0) { // толчок при поимке
    camera.position.x += (Math.random() - 0.5) * 0.6 * camShake;
    camera.position.y += (Math.random() - 0.5) * 0.6 * camShake;
    camShake = Math.max(0, camShake - dt / 0.35);
  }
  camDive += (Math.min(1, Math.max(0, -player.vy / CONFIG.diveMaxFall)) - camDive) * Math.min(1, dt * 4);
  camera.lookAt(p.x * 0.85, p.y + 1 - camDive * 8, p.z - 30);
  // во время рывка и пике угол обзора плавно расширяется
  const targetFov = (game.state === 'playing' && game.boosting ? 68 : 62) + camDive * 12 - camShake * 5; // при поимке — короткое сужение
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }

  game.updateHud(biomeName);
  sound.update({ active: game.state !== 'over', speed: dt > 0 ? step / dt : 0,
    boosting: game.state === 'playing' && game.boosting, dive: camDive,
    downstroke: player.flight.downstroke, turn: -player.mesh.rotation.z / 0.65 });
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
