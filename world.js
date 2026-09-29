// world.js — бесконечная земля из чанков и скалы-препятствия
import * as THREE from 'three';
import { CONFIG, rockSpacing } from './config.js';
import { BIOMES } from './visuals.js';

// ---------- рельеф ----------
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const ss = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// ступеньки: ровные полки и крутые подъёмы между ними
function terrace(v, step) { const k = Math.floor(v / step), f = v / step - k; return (k + ss(0.75, 1, f)) * step; }

// Рельеф каждого биома. В коридоре высота держится примерно в -8..28, как раньше,
// чтобы не ломать баланс высоты полёта и бонус за низкий полёт.
function steppe(x, z) { // широкие пологие холмы
  const h = vnoise(x * 0.008, z * 0.008) * 22 + vnoise(x * 0.03, z * 0.03) * 6 - 6;
  return h + Math.max(0, Math.abs(x) - CONFIG.laneHalfWidth) * 0.4;
}
function charyn(x, z) { // каньон: ровное дно, столовые скалы, стены-террасы
  let h = vnoise(x * 0.02, z * 0.02) * 6 + 4;
  h += terrace(ss(0.62, 0.72, vnoise(x * 0.025 + 40, z * 0.025 - 17)) * 16, 8);
  const edge = CONFIG.laneHalfWidth + (vnoise(3.7, z * 0.012) - 0.5) * 16;
  const w = Math.max(0, Math.abs(x) - edge);
  return h + terrace(w * 1.6 + vnoise(x * 0.05, z * 0.05) * 6, 9);
}
function tianshan(x, z) { // острые хребты, высокие стены с пиками
  const r = 1 - Math.abs(2 * vnoise(x * 0.014, z * 0.014) - 1);
  const h = r * r * 30 + vnoise(x * 0.05, z * 0.05) * 6 - 8;
  const r2 = 1 - Math.abs(2 * vnoise(x * 0.02 + 9, z * 0.02) - 1);
  return h + Math.max(0, Math.abs(x) - CONFIG.laneHalfWidth + 5) * (0.7 + r2 * 0.8);
}
// по индексу BIOMES: Степь, Чарын, Тянь-Шань, Ночь (степной рельеф)
const RELIEF = [steppe, charyn, tianshan, steppe];
const STRATA = [0, 1, 0.3, 0]; // насколько заметны полосы пород на крутых склонах

// Какие два биома смешиваются в точке z: [предыдущий, текущий, t 0..1]
function biomeMix(z) {
  const d = Math.max(0, -z), n = BIOMES.length;
  const stage = Math.floor(d / CONFIG.biomeEvery), cur = stage % n;
  if (stage === 0) return [cur, cur, 1];
  const t = Math.min(1, (d - stage * CONFIG.biomeEvery) / CONFIG.biomeBlend);
  return [(cur + n - 1) % n, cur, t * t * (3 - 2 * t)];
}

export function height(x, z) {
  const [a, b, t] = biomeMix(z);
  const hb = RELIEF[b % RELIEF.length](x, z);
  if (t >= 1) return hb;
  return RELIEF[a % RELIEF.length](x, z) * (1 - t) + hb * t;
}

const _ca = new THREE.Color(), _cb = new THREE.Color();

export class World {
  constructor(scene) {
    this.scene = scene;
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.rockMat = new THREE.MeshLambertMaterial({ flatShading: true });
    this.palettes = BIOMES.map((b) => b.ground.map((c) => new THREE.Color(c)));
    this.setBiome(BIOMES[0]);

    this.chunks = [];
    for (let i = 0; i < CONFIG.chunkCount; i++) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.terrainMat);
      scene.add(mesh);
      this.chunks.push(mesh);
    }
    this.rocks = [];
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < CONFIG.rockCount; i++) {
      const r = new THREE.Mesh(rockGeo, this.rockMat);
      scene.add(r);
      this.rocks.push(r);
    }
    this.reset();
  }

  // Земля красится по месту (биом по z), скалы перекрашиваются при смене биома
  setBiome(biome) {
    this.rockMat.color.set(biome.rock);
  }

  // Цвет земли по высоте и крутизне. ny — вертикальная составляющая нормали (1 — ровно)
  groundColor(pal, h, ny, out) {
    const [low, slope, rock, snow] = pal;
    const steep = ss(0.18, 0.45, 1 - ny);
    out.copy(low).lerp(slope, ss(-8, 14, h));
    out.lerp(rock, Math.max(steep, ss(28, 45, h) * 0.8));
    return out.lerp(snow, ss(46, 60, h) * (1 - steep * 0.7));
  }

  colorAt(x, z, h, ny, out) {
    const [a, b, t] = biomeMix(z);
    this.groundColor(this.palettes[b], h, ny, out);
    if (t < 1) out.lerp(this.groundColor(this.palettes[a], h, ny, _ca), 1 - t);
    const strata = STRATA[a % STRATA.length] * (1 - t) + STRATA[b % STRATA.length] * t;
    const steep = ss(0.18, 0.45, 1 - ny);
    const patch = vnoise(x * 0.015 + 100, z * 0.015) - 0.5;     // крупные пятна
    let light = patch * 0.1 + strata * steep * Math.sin(h * 0.8) * 0.06; // полосы пород
    light -= 0.05 * ss(-2, -10, h);                            // тень в низинах
    return out.offsetHSL(patch * 0.02, 0, light);
  }

  buildChunk(zStart) {
    let g = new THREE.PlaneGeometry(CONFIG.chunkWidth, CONFIG.chunkLen, CONFIG.chunkSegX, CONFIG.chunkSegZ);
    g.rotateX(-Math.PI / 2);
    g = g.toNonIndexed(); // у каждого треугольника свой цвет — эффект low-poly
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i) + zStart));
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      va.fromBufferAttribute(p, i); vb.fromBufferAttribute(p, i + 1); vc.fromBufferAttribute(p, i + 2);
      const h = (va.y + vb.y + vc.y) / 3;
      const x = (va.x + vb.x + vc.x) / 3, z = (va.z + vb.z + vc.z) / 3 + zStart;
      vb.sub(va); vc.sub(va); vb.cross(vc).normalize(); // нормаль треугольника
      const c = this.colorAt(x, z, h, Math.abs(vb.y), _cb).offsetHSL(0, 0, (hash(i, zStart) - 0.5) * 0.04);
      for (let k = 0; k < 3; k++) cols.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  }

  setChunk(mesh, z) {
    mesh.geometry.dispose();
    mesh.geometry = this.buildChunk(z);
    mesh.position.z = z;
    mesh.userData.z = z;
  }

  placeRock(r, z, playerX, dist) {
    const aimedChance = CONFIG.aimedRockChanceMax * Math.min(1, dist / CONFIG.aimedRockRampDist);
    const x = Math.random() < aimedChance
      ? playerX + (Math.random() - 0.5) * 16 // скала «на линии» игрока
      : (Math.random() - 0.5) * CONFIG.laneHalfWidth * 2;
    const s = 4 + Math.random() * 9;
    r.scale.set(s * 0.8, s * (1.6 + Math.random()), s * 0.8);
    r.position.set(x, height(x, z) + r.scale.y * 0.6, z);
    r.rotation.set(Math.random() * 0.3, Math.random() * 6, Math.random() * 0.3);
    r.userData.near = false;   // беркут пролетал рядом
    r.userData.passed = false; // скала уже позади и учтена
  }

  reset() {
    this.chunks.forEach((c, i) => this.setChunk(c, -i * CONFIG.chunkLen));
    let z = -80;
    for (const r of this.rocks) {
      this.placeRock(r, z, 0, 0);
      z -= rockSpacing(0) * (0.8 + Math.random() * 0.4);
    }
  }

  update(playerPos, dist) {
    // чанки, оставшиеся позади, переносятся вперёд
    for (const c of this.chunks) {
      if (c.userData.z - CONFIG.chunkLen / 2 > playerPos.z + 60) {
        const minZ = Math.min(...this.chunks.map((k) => k.userData.z));
        this.setChunk(c, minZ - CONFIG.chunkLen);
      }
    }
    // скалы, оставшиеся позади, ставятся в конец очереди, плотнее с ростом сложности
    for (const r of this.rocks) {
      if (r.position.z > playerPos.z + 30) {
        const farthest = Math.min(...this.rocks.map((k) => k.position.z));
        this.placeRock(r, farthest - rockSpacing(dist) * (0.8 + Math.random() * 0.4), playerPos.x, dist);
      }
    }
  }

  // Столкновение: скала — эллипсоид, земля — высота рельефа
  collides(pos, radius) {
    if (pos.y - radius < height(pos.x, pos.z)) return 'ground';
    for (const r of this.rocks) {
      const dz = pos.z - r.position.z;
      if (Math.abs(dz) > 30) continue;
      const nx = (pos.x - r.position.x) / (r.scale.x + radius);
      const ny = (pos.y - r.position.y) / (r.scale.y + radius);
      const nz = dz / (r.scale.z + radius);
      if (nx * nx + ny * ny + nz * nz < 1) return 'rock';
    }
    return null;
  }

  // Сколько скал беркут только что миновал впритирку (в пределах nearMissGap).
  // Вызывать после collides(), когда столкновения нет.
  nearMisses(pos, radius) {
    let n = 0;
    for (const r of this.rocks) {
      const u = r.userData, dz = pos.z - r.position.z;
      if (u.passed || Math.abs(dz) > 40) continue;
      if (dz < -r.scale.z - radius) { // скала осталась позади
        u.passed = true;
        if (u.near) n++;
        continue;
      }
      // эллипсоид скалы, раздутый на величину зазора
      const g = radius + CONFIG.nearMissGap;
      const nx = (pos.x - r.position.x) / (r.scale.x + g);
      const ny = (pos.y - r.position.y) / (r.scale.y + g);
      const nz = dz / (r.scale.z + g);
      if (nx * nx + ny * ny + nz * nz < 1) u.near = true;
    }
    return n;
  }
}
