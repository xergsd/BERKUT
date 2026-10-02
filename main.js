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
import { Critters } from './critters.js';
import { Menu } from './menu.js';
import { Effects, WindStreaks } from './effects.js';
import { Progress } from './upgrades.js';
import { applySkin } from './skins.js';
import { IS_TOUCH, TouchControls, TouchTips } from './touch.js';

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
const critters = new Critters(scene, world);
// скалы не должны загораживать подлёт ни к какой добыче
world.extraTargets = () => [...prey.kids, ...critters.targets()];
const player = new Player(scene, window);
// телефон: джойстик и кнопки вместо «палец = точка, куда лететь»
document.documentElement.classList.toggle('touch', IS_TOUCH);
const touch = IS_TOUCH ? new TouchControls() : null;
const tips = IS_TOUCH ? new TouchTips() : null;
player.touch = touch;
const game = new Game();
const fx = createPostFX(renderer, scene, camera);
const sound = new FlightAudio();
const effects = new Effects(scene);
const wind = new WindStreaks(scene); // полосы ветра в пике
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
  prey.reset(); // до world.reset: скалы расставляются в обход новой добычи
  critters.reset();
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
  // первый полёт на телефоне: игра стоит, пока не покажем джойстик и обе кнопки
  if (tips && !tips.seen) {
    game.paused = true;
    touch.setVisible(true);
    tips.start(() => { game.paused = false; });
  }
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

const progress = new Progress(); // золотые перья и улучшения; сразу выставляет характеристики беркута
applySkin(player.mesh, progress.skin);
let skinPreview = progress.skin; // окно «Облик»: какой скин примеряем

// после покупки перьев меньше — обновить обе кнопки и оба окна
function refreshShop() {
  menu.setProgress(progress);
  menu.setSkins(progress, skinPreview);
}

const menu = new Menu({
  hunt: () => startRun('hunt'),
  free: () => startRun('free'),
  resume: () => setPaused(false),
  restart: () => startRun(game.mode),
  menu: toMenu,
  upgrade: (id) => { if (progress.buy(id)) refreshShop(); },
  skinPreview: (id) => { skinPreview = id; applySkin(player.mesh, id); menu.setSkins(progress, id); },
  skinBuy: (id) => { if (progress.buySkin(id)) refreshShop(); },
  skinSelect: (id) => { if (progress.selectSkin(id)) refreshShop(); },
  skinsClosed: () => { skinPreview = progress.skin; applySkin(player.mesh, progress.skin); }, // примерка без покупки не остаётся
  quality: (q) => {
    nature.setQuality(q); // меньше травы, цветов и частиц
    renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'high' ? 2 : 1));
    renderer.setSize(innerWidth, innerHeight);
    fx.setSize(innerWidth, innerHeight);
  },
  keySens: (k) => { player.keySens = k; },
});
game.onOver = (result) => {
  result.feathers = progress.earn(result.score); // очки забега → золотые перья
  menu.setProgress(progress);
  menu.showOver(result);
};
menu.setBest(game.best);
refreshShop();
menu.setMap(progress);
// камера сразу на своём месте за беркутом — иначе первую секунду она «доезжает» и снизу виден беркут
camera.position.set(player.pos.x * 0.7, player.pos.y + 11, player.pos.z + cameraDistance());
camera.lookAt(player.pos.x * 0.85, player.pos.y + 1, player.pos.z - 30);
menu.show('main');

const pauseBtn = document.getElementById('pause-btn');
pauseBtn.addEventListener('click', () => setPaused(true));
// ушли со вкладки — пауза
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
// телефон повернули вертикально — пауза (поверх всего экран «Поверни телефон»)
const portrait = matchMedia('(orientation: portrait)');
portrait.addEventListener?.('change', () => { if (IS_TOUCH && portrait.matches) setPaused(true); });

addEventListener('pointerdown', () => sound.unlock());
addEventListener('keydown', (e) => {
  if (['Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) sound.unlock();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    e.preventDefault();
    if (game.state === 'playing' && !menu.current) setPaused(true);
    else if (menu.current === 'pause') setPaused(false);
    else if (['howto', 'settings', 'upgrades'].includes(menu.current)) menu.back();
    return;
  }
  // на кнопке пробел и Enter нажимают саму кнопку — не дублируем
  if ((e.code === 'Space' || e.code === 'Enter') && !e.target?.closest?.('button, input')) {
    if (menu.current === 'main') { e.preventDefault(); startRun('hunt'); }
    else if (menu.current === 'over') { e.preventDefault(); startRun(game.mode); }
  }
});

// Регион по дистанции: stage 0 — Сарыарка, дальше по маршруту по кругу с плавным переходом
function updateBiome(dist) {
  const stage = Math.floor(dist / CONFIG.biomeEvery);
  const idx = stage % BIOMES.length;
  if (stage !== biomeStage) {
    biomeStage = stage;
    world.setBiome(BIOMES[idx]);
    // впервые долетел — регион открывается на карте
    if (game.state === 'playing' && progress.discover(BIOMES[idx].id)) {
      game.popup(`Новый регион: ${BIOMES[idx].name}`);
      menu.setMap(progress);
    }
  }
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
let camSkin = 0;  // 0..1 — открыто окно «Облик»: камера показывает беркута спереди-сбоку, справа от панели
const camSide = new THREE.Vector3(), camLook = new THREE.Vector3(), eagleLook = new THREE.Vector3();
const camRight = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
let trails = null; // следы крыльев (их создаёт createPostFX при первом кадре)
let last = performance.now();

function loop(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // первый кадр может прийти «раньше» last
  last = now;
  pauseBtn.classList.toggle('hidden', game.state !== 'playing' || game.paused);
  touch?.setVisible(game.state === 'playing' && (!game.paused || tips.step >= 0));
  if (game.paused) { // мир замер, звук полёта затих
    sound.update({ active: false });
    fx.render();
    requestAnimationFrame(loop);
    return;
  }
  const time = now / 1000;

  // в окне «Облик» беркут не слушается мыши: летит ровно по центру, без крена
  if (menu.current === 'skins') { player.target.x = 0; player.target.y = 0; }
  const step = game.tick(dt, player.boostHeld, player.diveHeld);
  const playing = game.state === 'playing';
  // добыча близко впереди — беркут выпускает когти
  const reach = (dt > 0 ? step / dt : 0) * CONFIG.strikeTime;
  const preyAhead = (d) => world.preyAhead(player.pos, d) || prey.preyAhead(player.pos, d) || critters.preyAhead(player.pos, d);
  player.strikeWanted = playing && preyAhead(reach);
  player.lungeWanted = player.strikeWanted && preyAhead(reach * CONFIG.strikeLunge / CONFIG.strikeTime);
  if (game.state !== 'over') player.update(dt, time, step, playing && game.boosting, playing && game.exhausted, playing && game.diving);

  if (playing) {
    const p = player.pos;
    game.scoreDistance(step, p.y - height(p.x, p.z));
    const hit = prey.collides(p, CONFIG.eagleRadius) ? 'rock' : world.collides(p, CONFIG.eagleRadius);
    if (hit === 'rock' || (hit === 'ground' && !game.groundHit(player.vy < -CONFIG.diveHardFall))) game.crash(hit);
    else {
      if (hit === 'ground') player.bounce(height(p.x, p.z) + CONFIG.eagleRadius + 0.3);
      for (let n = world.nearMisses(p, CONFIG.eagleRadius); n > 0; n--) game.nearMiss();
      for (const c of world.catchPrey(p)) onCatch(c.kind, c.pos);
      for (const c of prey.catch(p)) onCatch(c.kind, c.pos);
      for (const c of critters.catch(p)) onCatch(c.kind, c.pos);
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
  critters.update(dt, player.pos, dt > 0 ? step / dt : 0);
  effects.update(dt);
  const biomeName = updateBiome(game.dist);
  if (game.state !== 'over') nature.update(dt, time, player.pos);
  sky.update(player.pos, 0);

  // камера сзади и чуть сверху
  const p = player.pos;
  camCarry += ((player.carryT > 0 ? 1 : 0) - camCarry) * Math.min(1, dt * 3);
  camTarget.set(p.x * 0.7, p.y + 11 - camCarry * 5, p.z + cameraDistance() - camDive * CONFIG.diveCamClose); // в пике — ближе
  camSkin += ((menu.current === 'skins' ? 1 : 0) - camSkin) * Math.min(1, dt * 3);
  // следы от кончиков крыльев при осмотре выглядят как белые линии — прячем
  trails ??= scene.getObjectByName('berkut-wing-trails');
  if (trails) trails.visible = camSkin < 0.05;
  // «Облик»: спереди-сбоку и чуть сверху, достаточно далеко, чтобы крылья помещались целиком
  if (camSkin > 0.001) {
    const k = cameraDistance() / 26; // на узком экране — дальше, иначе крылья не помещаются
    camSide.set(p.x + 12 * k, p.y + 4, p.z - 19 * k);
    camSide.y = Math.max(camSide.y, height(camSide.x, camSide.z) + 5); // не залезать в холм
    camTarget.lerp(camSide, camSkin);
  }
  // обычно камера догоняет с запаздыванием; в «Облике» — встаёт точно, иначе беркут «уплывает»
  camera.position.lerp(camTarget, Math.min(1, Math.max(dt * 3, camSkin ** 3)));
  if (camShake > 0) { // толчок при поимке
    camera.position.x += (Math.random() - 0.5) * 0.6 * camShake;
    camera.position.y += (Math.random() - 0.5) * 0.6 * camShake;
    camShake = Math.max(0, camShake - dt / 0.35);
  }
  camDive += (Math.min(1, Math.max(0, -player.vy / CONFIG.diveMaxFall)) - camDive) * Math.min(1, dt * 6);
  const diveShake = Math.max(0, camDive - 0.5) * 2 * CONFIG.diveShake; // тряска с середины разгона пике
  if (diveShake > 0) {
    camera.position.x += (Math.random() - 0.5) * diveShake;
    camera.position.y += (Math.random() - 0.5) * diveShake;
  }
  // полосы ветра — только в забеге и не в окне «Облик»
  wind.update(dt, p, dt > 0 ? step / dt : 0, player.vy, game.state === 'playing' ? camDive * (1 - camSkin) : 0);
  camLook.set(p.x * 0.85, p.y + 1 - camDive * 8, p.z - 30);
  // точка взгляда сдвинута так, что беркут оказывается справа от панели
  if (camSkin > 0.001) {
    // смотрим мимо беркута так, чтобы он оказался справа от панели, а на узком экране — над ней
    camRight.subVectors(p, camSide).normalize().cross(UP).normalize();
    eagleLook.copy(p);
    if (innerWidth > 760) eagleLook.addScaledVector(camRight, -9);
    else eagleLook.y -= 7;
    camLook.lerp(eagleLook, camSkin);
  }
  camera.lookAt(camLook);
  // во время рывка и пике угол обзора плавно расширяется
  const targetFov = (game.state === 'playing' && game.boosting ? 68 : 62) + camDive * CONFIG.diveFov - camShake * 5; // при поимке — короткое сужение
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
