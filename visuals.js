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
  eagle.name = 'golden-eagle';
  // Vertex colours let all the feathers share one material: only three draw
  // calls, one for the body and one for each animated shoulder group.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const parts = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const colour = new THREE.Color();
  function add(list, geometry, color, position, scale = [1, 1, 1], angles = [0, 0, 0]) {
    rotation.setFromEuler(new THREE.Euler(...angles));
    matrix.compose(new THREE.Vector3(...position), rotation, new THREE.Vector3(...scale));
    geometry.applyMatrix4(matrix);
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.computeVertexNormals(); // faceted normals; compatible with Three.js r128
    colour.set(color);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = colour.r; colors[i + 1] = colour.g; colors[i + 2] = colour.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    list.push(g);
  }
  function finish(list, name) {
    const geometry = new THREE.BufferGeometry();
    for (const attribute of ['position', 'normal', 'color']) {
      const array = new Float32Array(list.reduce((n, g) => n + g.attributes[attribute].array.length, 0));
      let offset = 0;
      for (const g of list) { array.set(g.attributes[attribute].array, offset); offset += g.attributes[attribute].array.length; }
      geometry.setAttribute(attribute, new THREE.BufferAttribute(array, 3));
    }
    list.forEach((g) => g.dispose());
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    return mesh;
  }
  function oval(list, color, position, scale, angles = [0, 0, 0]) {
    add(list, new THREE.IcosahedronGeometry(1, 2), color, position, scale, angles);
  }
  // A closed, tapered feather with a raised shaft, not a flat triangle.
  function feather(list, base, tip, width, color) {
    const dx = tip[0] - base[0], dz = tip[2] - base[2];
    const length = Math.hypot(dx, dz), vertices = [], indices = [];
    const rings = [[0, 0.16], [0.22, 0.5], [0.68, 0.43], [0.93, 0.19], [1, 0.015]];
    rings.forEach(([t, w]) => {
      const y = (tip[1] - base[1]) * t;
      vertices.push(-w * width, y, t * length, 0, y + width * 0.13, t * length,
        w * width, y, t * length, 0, y - width * 0.045, t * length);
    });
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < 4; j++) {
        const a = i * 4 + j, b = i * 4 + (j + 1) % 4;
        indices.push(a, a + 4, b, b, a + 4, b + 4);
      }
    }
    indices.push(0, 1, 3, 1, 2, 3, 16, 19, 17, 17, 19, 18);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices); g.computeVertexNormals();
    add(list, g, color, base, [1, 1, 1], [0, Math.atan2(dx, dz), 0]);
  }

  oval(parts, '#4d3528', [0, 0, 0.15], [0.83, 0.66, 1.95]);
  oval(parts, '#654631', [0, -0.18, -0.55], [0.69, 0.55, 1.25]);
  oval(parts, '#785333', [0, 0.27, -1.65], [0.47, 0.47, 0.91]);
  oval(parts, '#956b3c', [0, 0.46, -2.12], [0.44, 0.42, 0.65]);
  // Golden nape and overlapping mantle feathers read from the chase camera.
  for (let row = 0; row < 4; row++) {
    for (let side = -1; side <= 1; side++) {
      const x = side * (0.19 + row * 0.04), z = -1.95 + row * 0.38;
      feather(parts, [x, 0.77 - row * 0.02, z], [x * 1.5, 0.57, z + 0.83],
        0.34, ['#bf9451', '#a77a42', '#89623b', '#745035'][row]);
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let side = -1; side <= 1; side++) {
      const x = side * 0.35, z = -0.25 + row * 0.57;
      feather(parts, [x, 0.62 - row * 0.07, z], [x * 1.15, 0.37 - row * 0.05, z + 0.9],
        0.48, side === 0 ? '#785439' : '#5c3e2c');
    }
  }
  // Dark eye sockets, amber irises, black pupils and a projecting brow.
  for (const side of [-1, 1]) {
    oval(parts, '#30251f', [side * 0.367, 0.52, -2.34], [0.11, 0.155, 0.19]);
    oval(parts, '#d49a37', [side * 0.451, 0.54, -2.38], [0.026, 0.076, 0.083]);
    oval(parts, '#101113', [side * 0.474, 0.542, -2.40], [0.015, 0.047, 0.048]);
    oval(parts, '#f7e6bd', [side * 0.485, 0.568, -2.418], [0.008, 0.014, 0.015]);
    oval(parts, '#745435', [side * 0.35, 0.68, -2.34], [0.15, 0.085, 0.27], [0, 0, side * 0.12]);
  }
  oval(parts, '#c6a054', [0, 0.32, -2.68], [0.245, 0.20, 0.28]);
  oval(parts, '#514b40', [0, 0.32, -2.92], [0.18, 0.17, 0.27]);
  // Curved downward hook, extruded across X from a side profile (Y/Z).
  const hookShape = new THREE.Shape();
  hookShape.moveTo(-3.01, 0.46); hookShape.lineTo(-3.23, 0.32);
  hookShape.lineTo(-3.28, 0.08); hookShape.lineTo(-3.17, -0.04);
  hookShape.lineTo(-3.12, 0.16); hookShape.lineTo(-2.91, 0.23);
  hookShape.closePath();
  const hook = new THREE.ExtrudeGeometry(hookShape, { depth: 0.21, bevelEnabled: false });
  hook.translate(0, 0, -0.105); hook.rotateY(-Math.PI / 2);
  add(parts, hook, '#282b2c', [0, 0, 0]);
  for (const side of [-1, 1]) {
    oval(parts, '#42392a', [side * 0.226, 0.37, -2.71], [0.014, 0.035, 0.065]);
    // Tucked feet stay below the belly rather than dangling during flight.
    oval(parts, '#957239', [side * 0.37, -0.57, 0.72], [0.15, 0.14, 0.35]);
    for (let toe = 0; toe < 3; toe++) {
      oval(parts, '#b08a46', [side * 0.37 + (toe - 1) * 0.085, -0.64, 0.98], [0.043, 0.06, 0.23]);
      oval(parts, '#292520', [side * 0.37 + (toe - 1) * 0.085, -0.68, 1.17], [0.033, 0.055, 0.09]);
    }
  }
  // A rounded fan of twelve tail feathers with a subtle warm centre.
  for (let i = 0; i < 12; i++) {
    const spread = (i - 5.5) / 5.5;
    feather(parts, [spread * 0.36, 0.0, 1.25],
      [spread * 1.38, -0.17, 3.66 - Math.abs(spread) * 0.35], 0.43,
      i % 3 === 0 ? '#79583c' : i % 2 === 0 ? '#4c3729' : '#392b24');
  }
  eagle.add(finish(parts, 'body'));

  function makeWing(side) {
    const pivot = new THREE.Group(), wingParts = [];
    // Broad shoulder, swept wrist, then individually splayed primary tips.
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.85); shape.lineTo(1.6 * side, -1.05);
    shape.lineTo(3.6 * side, -0.7); shape.lineTo(4.6 * side, 0.05);
    shape.lineTo(3.9 * side, 0.95); shape.lineTo(1.5 * side, 1.15);
    shape.lineTo(0, 0.9); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.20, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    add(wingParts, g, '#50382b', [0, 0, 0]);
    for (let i = 0; i < 11; i++) {
      const x = 0.35 + i * 0.33;
      feather(wingParts, [side * x, -0.06, 0.15],
        [side * (x + 0.36), -0.10, 2.02 - i * 0.038], 0.49,
        ['#392b24', '#503c2d', '#604731'][i % 3]);
    }
    const tips = [[6.18, -0.22], [6.52, 0.36], [6.49, 0.99],
      [6.17, 1.60], [5.68, 2.13], [5.07, 2.40], [4.38, 2.42]];
    tips.forEach(([x, z], i) => {
      feather(wingParts, [side * (3.72 - i * 0.095), 0.015, -0.40 + i * 0.205],
        [side * x, 0.10 + Math.sin(i * 0.5) * 0.11, z], 0.56,
        i % 2 ? '#302722' : '#3c2e26');
    });
    // Two overlapping rows of coverts conceal the quill roots.
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 12; i++) {
        const x = 0.2 + i * 0.34, z = -0.80 + row * 0.52 + Math.max(0, x - 2) * 0.15;
        feather(wingParts, [side * x, 0.12 + (1 - row) * 0.08, z],
          [side * (x + 0.37), 0.055 + (1 - row) * 0.06, z + 0.97], 0.48,
          (row === 0 ? ['#916940', '#805b39', '#a07948'] : ['#6f4e33', '#7d593a', '#60432e'])[i % 3]);
      }
    }
    pivot.add(finish(wingParts, side < 0 ? 'left-feathers' : 'right-feathers'));
    pivot.position.set(0.53 * side, 0.22, -0.45);
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
