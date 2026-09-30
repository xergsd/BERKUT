// world.js — бесконечная земля из чанков и скалы-препятствия
import * as THREE from 'three';
import { CONFIG, rockSpacing } from './config.js';
import { BIOMES, createMarmot } from './visuals.js';
import { makeFormation, touchesFormation } from './rocks.js';
const rockPoint = new THREE.Vector3();

// Сурки Сарыарки; остальная добыча со своим поведением — в prey.js и critters.js.
// hides — прячется в нору, если беркут летит высоко
const GROUND = {
  marmot: { make: () => createMarmot(), hides: true },
};

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
function burabay(x, z) { // лесистые холмы и округлые гранитные «шапки»
  let h = vnoise(x * 0.01, z * 0.01) * 16 + vnoise(x * 0.04, z * 0.04) * 5 - 4;
  h += ss(0.7, 0.85, vnoise(x * 0.03 + 7, z * 0.03 - 3)) * 10;
  return h + Math.max(0, Math.abs(x) - CONFIG.laneHalfWidth) * 0.6;
}
function altai(x, z) { // высокие горы с округлыми склонами, поросшими тайгой
  const r = 1 - Math.abs(2 * vnoise(x * 0.01, z * 0.01) - 1);
  const h = r * 22 + vnoise(x * 0.04, z * 0.04) * 6 - 6;
  return h + Math.max(0, Math.abs(x) - CONFIG.laneHalfWidth + 5) * (0.9 + vnoise(x * 0.02, z * 0.02) * 0.6);
}
function desert(x, z) { // барханы: гряды поперёк пути с острым гребнем, пологий подъём по краям
  const warp = vnoise(x * 0.01, z * 0.01) * 6;
  const dune = (0.5 + 0.5 * Math.sin(z * 0.035 + x * 0.012 + warp)) ** 2 * 9;
  return dune + vnoise(x * 0.008, z * 0.008) * 10 + 2 + Math.max(0, Math.abs(x) - CONFIG.laneHalfWidth) * 0.25;
}
function mangystau(x, z) { // плоское плато, столы-останцы и белые меловые обрывы-ступени по краям
  // плато на 8–12 м: по нему бежит стадо джейранов, беркут должен доставать без пике
  let h = vnoise(x * 0.015, z * 0.015) * 4 + 8;
  h += terrace(ss(0.66, 0.74, vnoise(x * 0.02 - 30, z * 0.02 + 11)) * 20, 10);
  const edge = CONFIG.laneHalfWidth - 6 + (vnoise(8.1, z * 0.01) - 0.5) * 20;
  return h + terrace(Math.max(0, Math.abs(x) - edge) * 1.3 + vnoise(x * 0.04, z * 0.04) * 4, 12);
}
// по полю relief региона (regions.js)
const RELIEF = { steppe, charyn, tianshan, burabay, altai, desert, mangystau };

// Какие два биома смешиваются в точке z: [предыдущий, текущий, t 0..1]
function biomeMix(z) {
  const d = Math.max(0, -z), n = BIOMES.length;
  const stage = Math.floor(d / CONFIG.biomeEvery), cur = stage % n;
  if (stage === 0) return [cur, cur, 1];
  const t = Math.min(1, (d - stage * CONFIG.biomeEvery) / CONFIG.biomeBlend);
  return [(cur + n - 1) % n, cur, t * t * (3 - 2 * t)];
}

function rawHeight(x, z) {
  const [a, b, t] = biomeMix(z);
  const hb = RELIEF[BIOMES[b].relief](x, z);
  if (t >= 1) return hb;
  return RELIEF[BIOMES[a].relief](x, z) * (1 - t) + hb * t;
}

// Река справа, за пределами коридора полёта. Вся растительность берёт высоту отсюда же.
export function riverCenter(z) { return 96 + Math.sin(z * 0.006) * 13 + Math.sin(z * 0.017) * 4; }
// Уровень воды идёт по дну долины (x = 0), а не по верху стен каньона
export function riverLevel(z) {
  return (rawHeight(0, z - 25) + rawHeight(0, z) * 2 + rawHeight(0, z + 25)) * 0.25 - 4;
}
export function height(x, z) {
  const h = rawHeight(x, z), d = Math.abs(x - riverCenter(z));
  if (d >= 22) return h;
  return THREE.MathUtils.lerp(riverLevel(z) - 3.5, h, ss(10, 22, d)); // русло
}

// Индекс региона (BIOMES / regions.js) в точке z, без учёта плавного перехода
export function biomeAt(z) { return Math.floor(Math.max(0, -z) / CONFIG.biomeEvery) % BIOMES.length; }

const _ca = new THREE.Color(), _cb = new THREE.Color();

export class World {
  constructor(scene) {
    this.scene = scene;
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.rockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.palettes = BIOMES.map((b) => b.ground.map((c) => new THREE.Color(c)));
    this.setBiome(BIOMES[0]);

    this.chunks = [];
    for (let i = 0; i < CONFIG.chunkCount; i++) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.terrainMat);
      scene.add(mesh);
      this.chunks.push(mesh);
    }
    this.rocks = [];
    for (let i = 0; i < CONFIG.rockCount; i++) {
      const r = new THREE.Mesh(new THREE.BufferGeometry(), this.rockMat);
      scene.add(r);
      this.rocks.push(r);
    }
    // добыча на земле: у каждого вида свой запас; появляется только в регионе, где этот вид живёт
    this.marmots = [];
    for (const [kind, { make }] of Object.entries(GROUND)) {
      for (let i = 0; i < CONFIG.marmotCount; i++) {
        const m = make();
        m.userData.kind = kind;
        scene.add(m);
        this.marmots.push(m);
      }
    }
    this.reset();
  }

  // Скалы сохраняют цвет биома под ними.
  setBiome(biome) { this.currentBiome = biome; }

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
    const strata = BIOMES[a].strata * (1 - t) + BIOMES[b].strata * t; // полосы пород
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
    this.onChunk?.(mesh, z); // растительность переставляется вместе с чанком
  }

  placeRock(r, z, playerX, dist) {
    const aimedChance = CONFIG.aimedRockChanceMax * Math.min(1, dist / CONFIG.aimedRockRampDist);
    const x = Math.random() < aimedChance
      ? playerX + (Math.random() - 0.5) * 16 // скала «на линии» игрока
      : (Math.random() - 0.5) * CONFIG.laneHalfWidth * 2;
    this.buildRock(r,x,z,Math.floor(Math.random()*4294967296));
    this.protectHuntingLane(r);
  }

  buildRock(r,x,z,seed) {
    const [a,b,t] = biomeMix(z), biome=t<.5?a:b;
    const floor=height(x,z);
    const formation=makeFormation(BIOMES[biome].rocks,seed,(dx,dz)=>height(x+dx,z+dz)-floor);
    r.geometry.dispose(); r.geometry=formation.geometry;
    r.position.set(x,floor,z); r.rotation.set(0,0,0); r.scale.set(1,1,1);
    r.userData={...formation,seed,near:false,passed:false};
  }

  // Flight is toward -Z: 110 m before prey, 85 m after, 28 m wide.
  // Include the entire formation (also rubble), plus the eagle's collision radius.
  protectHuntingLane(r) {
    const b=r.userData.bounds, pad=14+CONFIG.eagleRadius;
    const intervals=[];
    for(const m of [...this.marmots, ...(this.extraTargets?.() ?? [])]) {
      if(!m.visible || m.userData.state==='none')continue;
      if(r.position.z+b.max.z < m.position.z-85-CONFIG.eagleRadius ||
         r.position.z+b.min.z > m.position.z+110+CONFIG.eagleRadius)continue;
      intervals.push([m.position.x-pad-b.max.x,m.position.x+pad-b.min.x]);
    }
    const clear=x=>intervals.every(([lo,hi])=>x<lo || x>hi);
    if(clear(r.position.x))return;
    // The nearest free side keeps rock groups in the world, even for overlapping lanes.
    const candidates=intervals.flatMap(([lo,hi])=>[lo-.5,hi+.5]).filter(clear);
    candidates.sort((a,b)=>Math.abs(a-r.position.x)-Math.abs(b-r.position.x));
    const {seed,near,passed}=r.userData;
    this.buildRock(r,candidates[0],r.position.z,seed);
    r.userData.near=near;r.userData.passed=passed;
  }

  // Добыча сидит только на пригорке: беркут не опускается ниже altitudeMid - altitudeRange,
  // и над низиной до неё было бы не дотянуться. Не нашлось пригорка — место пустует.
  placeMarmot(m, z) {
    const minGround = CONFIG.altitudeMid - CONFIG.altitudeRange - CONFIG.marmotCatchAlt + 2;
    const u = m.userData;
    u.state = 'none'; // none | up | hiding | hidden | caught
    u.hide = 0;
    u.checked = false;
    u.body.position.y = 0;
    u.body.rotation.x = 0;
    u.body.visible = true;
    m.visible = false;
    m.position.z = z;
    if (BIOMES[biomeAt(z)].prey !== u.kind) return; // этот вид здесь не живёт
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * (CONFIG.controlRangeX - 5) * 2;
      const mz = z + (Math.random() - 0.5) * 60;
      const h = height(x, mz);
      if (h < minGround) continue;
      m.position.set(x, h, mz);
      m.rotation.y = (Math.random() - 0.5) * 0.8;
      m.visible = true;
      u.state = 'up';
      for(const r of this.rocks)this.protectHuntingLane(r);
      break;
    }
  }

  reset() {
    for(const m of this.marmots)m.visible=false;
    this.chunks.forEach((c, i) => this.setChunk(c, -i * CONFIG.chunkLen));
    let z = -80;
    for (const r of this.rocks) {
      this.placeRock(r, z, 0, 0);
      z -= rockSpacing(0) * (0.8 + Math.random() * 0.4);
    }
    z = -200;
    for (const m of this.marmots) {
      this.placeMarmot(m, z);
      z -= CONFIG.marmotSpacing * (0.7 + Math.random() * 0.6);
    }
  }

  // Добыча на земле: переносится вперёд; сурок и песчанка замечают беркута, летящего высоко, и прячутся.
  // speed — текущая скорость беркута, м/с; пикирующего беркута замечают позже
  updatePrey(dt, playerPos, speed, diving = false) {
    const alert = speed * CONFIG.marmotAlertTime * (diving ? CONFIG.diveAlertMult : 1);
    for (const m of this.marmots) {
      const u = m.userData;
      if (m.position.z > playerPos.z + 30) {
        const farthest = Math.min(...this.marmots.filter((k) => k.userData.kind === u.kind).map((k) => k.position.z));
        this.placeMarmot(m, farthest - CONFIG.marmotSpacing * (0.7 + Math.random() * 0.6));
        continue;
      }
      const ahead = playerPos.z - m.position.z;
      if (u.state === 'up' && GROUND[u.kind].hides && ahead > 0 && ahead < alert &&
          playerPos.y - m.position.y > CONFIG.marmotSneakAlt) u.state = 'hiding';
      // беркут близко, а добыча не спряталась — замирает и откидывается назад, глядя вверх
      const close = u.state === 'up' && ahead > 0 && ahead < Math.max(30, speed * CONFIG.strikeTime) &&
        Math.abs(playerPos.x - m.position.x) < 15;
      u.body.rotation.x += ((close ? -0.35 : 0) - u.body.rotation.x) * Math.min(1, dt * 6);
      if (u.state === 'hiding') {
        u.hide = Math.min(1, u.hide + dt / CONFIG.marmotHideTime);
        u.body.position.y = -3.2 * u.hide * u.hide;
        if (u.hide >= 1) u.state = 'hidden';
      }
    }
  }

  // Есть ли впереди, ближе dist метров, добыча на земле, до которой можно дотянуться, — пора выпускать когти
  preyAhead(pos, dist) {
    return this.marmots.some((m) => {
      const u = m.userData, ahead = pos.z - m.position.z;
      return (u.state === 'up' || u.state === 'hiding') && !u.checked && ahead > 0 && ahead < dist &&
        Math.abs(pos.x - m.position.x) < CONFIG.marmotCatchRadius * CONFIG.clawMult * 2 && pos.y - m.position.y < CONFIG.marmotCatchAlt * 2;
    });
  }

  // Кого беркут только что схватил на земле: список { kind, pos }. Проверка в момент пролёта над добычей.
  catchPrey(pos) {
    const caught = [];
    for (const m of this.marmots) {
      const u = m.userData;
      if (u.checked || pos.z > m.position.z) continue;
      u.checked = true;
      const catchable = u.state === 'up' || (u.state === 'hiding' && u.hide < CONFIG.marmotCatchHide);
      if (catchable && Math.abs(pos.x - m.position.x) < CONFIG.marmotCatchRadius * CONFIG.clawMult &&
          pos.y - m.position.y < CONFIG.marmotCatchAlt) {
        u.state = 'caught';
        u.body.visible = false;
        caught.push({ kind: u.kind, pos: m.position.clone() });
      }
    }
    return caught;
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

  // Скалы первыми: сохраняем правила удара о землю из этой версии игры.
  collides(pos, radius) {
    for (const r of this.rocks) {
      rockPoint.copy(pos).sub(r.position);
      if (touchesFormation(r.userData, rockPoint, radius)) return 'rock';
    }
    if (pos.y - radius < height(pos.x, pos.z)) return 'ground';
    return null;
  }

  nearMisses(pos, radius) {
    let n=0;
    for(const r of this.rocks) {
      const u=r.userData;
      if(u.passed) continue;
      rockPoint.copy(pos).sub(r.position);
      if(rockPoint.z<u.bounds.min.z-radius) {
        u.passed=true;
        if(u.near)n++;
      } else if(touchesFormation(u,rockPoint,radius+CONFIG.nearMissGap)) u.near=true;
    }
    return n;
  }
}
