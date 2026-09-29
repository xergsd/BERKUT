// ================================================================
//  visuals.js — ЗОНА НАПАРНИКА (визуал). Геймплей этот файл не трогает.
//  Сейчас здесь рабочие заглушки из демо. Сигнатуры экспортов менять нельзя:
//  от них зависит остальной код.
// ================================================================
import * as THREE from 'three';

// ---------- палитры биомов ----------
// ground: 4 цвета от низа к верху (низина, склон, скала, снег)
export const BIOMES = [
  { name: 'Степь',     fog: '#f6c08e', skyTop: '#5b6fb8', skyMid: '#f39a8a',
    ground: ['#a9b957', '#e7b35a', '#b86a4b', '#fff4ea'], rock: '#8f4f3c', sun: '#fff1c9' },
  { name: 'Чарын',     fog: '#f2a07a', skyTop: '#6a5aa8', skyMid: '#f0806a',
    ground: ['#d9894a', '#c8603a', '#9c3d2c', '#f5d6c0'], rock: '#6e2e22', sun: '#ffe2b0' },
  { name: 'Тянь-Шань', fog: '#c9b6d8', skyTop: '#4d5fa8', skyMid: '#d8a0c0',
    ground: ['#8fae6a', '#a58fb0', '#7d6390', '#ffffff'], rock: '#5a4870', sun: '#fff6e8' },
  { name: 'Ночь',      fog: '#2a3358', skyTop: '#0b1030', skyMid: '#34406e',
    ground: ['#3d4a5e', '#4d5670', '#3a3f5c', '#c8d4f0'], rock: '#252a44', sun: '#e8eeff' },
];

// ---------- беркут ----------
// Возвращает Group, «нос» смотрит в -Z. Внутри wingL / wingR — точки вращения у плеча.
export function createEagle() {
  const eagle = new THREE.Group();
  const m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const brown = m('#5a3a24'), gold = m('#c98b3a'), beakM = m('#f2c14e');

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), brown);
  body.scale.set(0.9, 0.7, 2.4); body.name = 'body'; eagle.add(body);
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), gold);
  head.position.set(0, 0.35, -2.1); eagle.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 4), beakM);
  beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.25, -2.8); eagle.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), brown);
  tail.rotation.x = Math.PI / 2; tail.scale.set(1, 1, 0.25); tail.position.set(0, 0, 2.6); eagle.add(tail);

  function makeWing(side) {
    const pivot = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, -1.1); shape.lineTo(4.8 * side, -0.2); shape.lineTo(6.2 * side, 1.3);
    shape.lineTo(2.6 * side, 1.5); shape.lineTo(0, 1.2);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    const wingMat = new THREE.MeshLambertMaterial({ color: '#4a2e1c', flatShading: true, side: THREE.DoubleSide });
    pivot.add(new THREE.Mesh(g, wingMat));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 3), m('#2c1a10'));
    tip.rotation.z = -Math.PI / 2 * side; tip.position.set(6.3 * side, 0, 0.6);
    pivot.add(tip);
    pivot.position.set(0.5 * side, 0.2, 0);
    return pivot;
  }
  const wingL = makeWing(-1); wingL.name = 'wingL';
  const wingR = makeWing(1);  wingR.name = 'wingR';
  eagle.add(wingL, wingR);
  eagle.userData.wingL = wingL;
  eagle.userData.wingR = wingR;
  eagle.scale.setScalar(1.9);
  return eagle;
}

// ---------- небо, солнце, горы, свет, туман ----------
export function createSky(scene) {
  const b = BIOMES[0];
  scene.fog = new THREE.Fog(new THREE.Color(b.fog), 120, 520);

  const uniforms = {
    top: { value: new THREE.Color(b.skyTop) },
    mid: { value: new THREE.Color(b.skyMid) },
    bot: { value: new THREE.Color(b.fog) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 top,mid,bot; varying vec3 vP;
        void main(){ float h=vP.y;
          vec3 c = h>0.08 ? mix(mid,top,smoothstep(0.08,0.55,h)) : mix(bot,mid,smoothstep(-0.05,0.08,h));
          gl_FragColor=vec4(c,1.0);}`,
    })
  );
  scene.add(sky);

  const sun = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: b.sun, fog: false }));
  scene.add(sun);

  const hemi = new THREE.HemisphereLight('#ffd9b0', '#6b4a7a', 0.75);
  const dir = new THREE.DirectionalLight('#ffd08a', 1.1);
  scene.add(hemi, dir, dir.target);

  // дальние горы-силуэты
  const mountMat = new THREE.MeshLambertMaterial({ color: '#9b6f8f', flatShading: true });
  const snowMat = new THREE.MeshLambertMaterial({ color: '#fff4ea', flatShading: true });
  const mountains = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const r = 40 + Math.random() * 60, h = 90 + Math.random() * 120;
    const seg = 5 + Math.floor(Math.random() * 3);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1), mountMat);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, seg, 1), snowMat);
    cap.position.y = h * 0.34 + 0.5; mesh.add(cap);
    mesh.position.set((Math.random() - 0.5) * 1400, h / 2 - 20, -700 - Math.random() * 250);
    mesh.rotation.y = Math.random() * Math.PI;
    mountains.add(mesh);
  }
  scene.add(mountains);

  const api = {
    uniforms, sun, hemi, dir, mountMat,
    update(playerPos /* , timeOfDay01 */) {
      sky.position.set(playerPos.x, 0, playerPos.z);
      sun.position.set(playerPos.x - 160, 170, playerPos.z - 900);
      mountains.position.set(playerPos.x * 0.3, 0, playerPos.z);
      dir.position.set(playerPos.x - 80, 120, playerPos.z - 200);
      dir.target.position.copy(playerPos);
    },
  };
  scene.userData.sky = api;
  return api;
}

// ---------- плавный переход между биомами ----------
// i — индекс нового биома, t — 0..1 (0 = ещё предыдущий, 1 = полностью новый)
const _a = new THREE.Color(), _b = new THREE.Color();
function mixHex(from, to, t, out) { return out.copy(_a.set(from)).lerp(_b.set(to), t); }

export function applyBiome(scene, i, t) {
  const sky = scene.userData.sky;
  if (!sky) return;
  const to = BIOMES[i % BIOMES.length];
  const from = BIOMES[(i - 1 + BIOMES.length) % BIOMES.length];
  mixHex(from.skyTop, to.skyTop, t, sky.uniforms.top.value);
  mixHex(from.skyMid, to.skyMid, t, sky.uniforms.mid.value);
  mixHex(from.fog, to.fog, t, sky.uniforms.bot.value);
  mixHex(from.fog, to.fog, t, scene.fog.color);
  mixHex(from.sun, to.sun, t, sky.sun.material.color);
  // ночью свет тусклее и холоднее
  const night = (n) => (n.name === 'Ночь' ? 1 : 0);
  const k = night(from) + (night(to) - night(from)) * t;
  sky.hemi.intensity = 0.75 - 0.35 * k;
  sky.dir.intensity = 1.1 - 0.6 * k;
  sky.dir.color.set('#ffd08a').lerp(_b.set('#9fb4ff'), k);
}

// ---------- постобработка ----------
// Заглушка: обычный рендер. Сюда добавляется bloom / виньетка / цветокоррекция.
export function createPostFX(renderer, scene, camera) {
  return {
    render() { renderer.render(scene, camera); },
    setSize(/* w, h */) {},
  };
}
