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
export function height(x, z) {
  let h = vnoise(x * 0.012, z * 0.012) * 28 + vnoise(x * 0.04, z * 0.04) * 8;
  h += Math.max(0, Math.abs(x) - CONFIG.laneHalfWidth) * 0.55; // стены каньона
  return h - 10;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.rockMat = new THREE.MeshLambertMaterial({ flatShading: true });
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

  // Новые чанки строятся в цветах текущего биома, скалы перекрашиваются сразу
  setBiome(biome) {
    this.ground = biome.ground.map((c) => new THREE.Color(c));
    this.rockMat.color.set(biome.rock);
  }

  colorAt(h) {
    const [low, slope, rock, snow] = this.ground;
    if (h < 0) return low.clone().lerp(slope, Math.min(1, (h + 10) / 10));
    if (h < 30) return slope.clone().lerp(rock, h / 30);
    if (h < 55) return rock.clone();
    return snow.clone();
  }

  buildChunk(zStart) {
    let g = new THREE.PlaneGeometry(CONFIG.chunkWidth, CONFIG.chunkLen, CONFIG.chunkSegX, CONFIG.chunkSegZ);
    g.rotateX(-Math.PI / 2);
    g = g.toNonIndexed(); // у каждого треугольника свой цвет — эффект low-poly
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i) + zStart));
    for (let i = 0; i < p.count; i += 3) {
      const h = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const c = this.colorAt(h).offsetHSL(0, 0, (hash(i, zStart) - 0.5) * 0.06);
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
