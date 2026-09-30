// prey.js — добыча Чарына и Тянь-Шаня: кеклики в небе и козлята тау-теке на вершинах скальных выступов у стен.
// Сурки — в world.js, зайцы, улары, песчанки и джейраны — в critters.js. Кеклики и козлята не убегают.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { BIOMES, createKeklik, createIbexKid, createSpur, spurMaterial, SPUR_TOP, SPUR_BASE } from './visuals.js';
import { height, biomeAt } from './world.js';

const livesAt = (kind, z) => BIOMES[biomeAt(z)].prey === kind; // водится ли этот вид в регионе под z
const top = () => CONFIG.altitudeMid + CONFIG.altitudeRange; // потолок полёта
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

// Беркут близко и летит прямо на добычу — кеклик в панике, козлёнок пригибается
function eagleClose(k, p, speed) {
  const ahead = p.z - k.position.z;
  return ahead > 0 && ahead < Math.max(30, speed * CONFIG.strikeTime) && Math.abs(p.x - k.position.x) < 15;
}

export class Prey {
  constructor(scene, world) {
    this.world = world;
    this.kekliks = [];
    for (let i = 0; i < CONFIG.keklikCount; i++) {
      const k = createKeklik();
      scene.add(k);
      this.kekliks.push(k);
    }
    this.kids = [];
    for (let i = 0; i < CONFIG.ibexCount; i++) {
      const k = createIbexKid();
      // выступ, на вершине которого стоит козлёнок; геометрия строится заново при каждой расстановке
      k.userData.spur = new THREE.Mesh(new THREE.BufferGeometry(), spurMaterial);
      k.userData.spur.visible = false;
      scene.add(k, k.userData.spur);
      this.kids.push(k);
    }
    this.reset();
  }

  reset() {
    for (const k of this.kids) k.visible = false;
    let z = -200;
    for (const k of this.kekliks) {
      this.placeKeklik(k, z);
      z -= CONFIG.keklikSpacing * (0.7 + Math.random() * 0.6);
    }
    z = -200;
    for (const k of this.kids) {
      this.placeKid(k, z);
      z -= CONFIG.ibexSpacing * (0.7 + Math.random() * 0.6);
    }
  }

  // Кеклик летит поперёк каньона на высоте, до которой беркут дотягивается.
  // Высота — над самой высокой точкой пути, чтобы не пролетать сквозь столовые скалы.
  placeKeklik(k, z) {
    const u = k.userData;
    u.state = 'none'; // none | fly | caught
    u.checked = false;
    k.visible = false;
    k.position.z = z;
    if (!livesAt('keklik', z)) return;
    let ground = -Infinity;
    for (let x = -60; x <= 60; x += 10) ground = Math.max(ground, height(x, z));
    const lo = Math.max(20, ground + 10), hi = top() - 4;
    if (lo > hi) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    k.position.set(-side * (20 + Math.random() * 30), lo + Math.random() * (hi - lo), z);
    u.vx = side * CONFIG.keklikSpeed;
    u.baseY = k.position.y;
    u.phase = Math.random() * 6;
    u.cycle = Math.random() * CONFIG.keklikFlapCycle;
    u.state = 'fly';
    k.visible = true;
  }

  // Козлёнок стоит на вершине скального выступа: выступ растёт от подножия боковой стены
  // до края зоны, куда долетает беркут, вершина — на обычной высоте полёта (пике не нужно)
  placeKid(k, z) {
    const u = k.userData;
    u.state = 'none'; // none | up | caught
    u.checked = false;
    u.bleated = false;
    u.body.visible = true;
    u.body.position.y = 0;
    u.t = Math.random() * 10; // своё время — козлята двигаются не в такт
    u.crouch = 0;
    k.visible = false;
    u.spur.visible = false;
    k.position.z = z;
    if (!livesAt('ibex', z)) return;
    for (let i = 0; i < 12; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (49 + Math.random() * 5), mz = z + (Math.random() - 0.5) * 60;
      const lean = side * 6; // основание выступа — дальше, у стены
      const base = Math.min(height(x, mz), height(x + lean, mz)) - 2;
      const peak = Math.max(CONFIG.ibexSpurMin + Math.random() * (CONFIG.ibexSpurMax - CONFIG.ibexSpurMin), height(x, mz) + 6);
      if (peak > top() - 4) continue; // слишком высоко — не долететь
      u.spur.geometry.dispose();
      u.spur.geometry = createSpur(peak - base, lean, Math.floor(Math.random() * 4294967296));
      u.spur.position.set(x, base, mz);
      u.spur.userData = { h: peak - base, lean };
      u.spur.visible = true;
      k.position.set(x, peak, mz);
      k.rotation.y = -side * 0.5; // мордой навстречу беркуту и чуть к ущелью
      u.side = side;
      u.state = 'up';
      k.visible = true;
      for (const r of this.world.rocks) this.world.protectHuntingLane(r);
      break;
    }
  }

  // onBleat(side) — козлёнок заблеял: side -1 слева .. 1 справа от беркута; speed — скорость беркута, м/с
  update(dt, p, speed = 0) {
    for (const k of this.kekliks) {
      const u = k.userData;
      if (k.position.z > p.z + 30) {
        const farthest = Math.min(...this.kekliks.map((b) => b.position.z));
        this.placeKeklik(k, farthest - CONFIG.keklikSpacing * (0.7 + Math.random() * 0.6));
        continue;
      }
      if (u.state !== 'fly') continue;
      // долетел до края каньона — разворачивается
      if (Math.abs(k.position.x) > 60 && Math.sign(k.position.x) === Math.sign(u.vx)) u.vx = -u.vx;
      k.position.x += u.vx * dt;
      k.rotation.y = Math.sign(u.vx) * Math.PI / 2;
      this.animateKeklik(k, dt, eagleClose(k, p, speed));
    }

    for (const k of this.kids) {
      const u = k.userData;
      if (k.position.z > p.z + 30) {
        const farthest = Math.min(...this.kids.map((b) => b.position.z));
        this.placeKid(k, farthest - CONFIG.ibexSpacing * (0.7 + Math.random() * 0.6));
        continue;
      }
      const ahead = p.z - k.position.z;
      if (u.state === 'up' && !u.bleated && ahead > 0 && ahead < CONFIG.ibexBleatDist) {
        u.bleated = true;
        this.onBleat?.(Math.max(-1, Math.min(1, (k.position.x - p.x) / 40)));
      }
      if (u.state === 'up') this.animateKid(k, dt, eagleClose(k, p, speed));
    }
  }

  // Кеклик летит рывками: серия частых взмахов, потом скольжение на выгнутых вниз крыльях.
  // В панике машет без передышки и вдвое чаще.
  animateKeklik(k, dt, panic) {
    const u = k.userData;
    u.cycle = (u.cycle + dt) % CONFIG.keklikFlapCycle;
    const flapping = panic || u.cycle < CONFIG.keklikFlapCycle * 0.55;
    const rate = flapping ? (panic ? 32 : 20) : 0;
    u.phase += dt * rate;
    const beat = Math.sin(u.phase), lag = Math.sin(u.phase - 0.8);
    const lift = flapping ? 0.15 + beat * 0.75 : -0.22;    // плечо: + вверх
    const bend = flapping ? lag * 0.45 : -0.2;              // кисть догоняет плечо
    for (const [wing, side] of [[u.wingL, -1], [u.wingR, 1]]) {
      wing.rotation.z = damp(wing.rotation.z, side * lift, 25, dt);
      wing.userData.hand.rotation.z = damp(wing.userData.hand.rotation.z, side * bend, 25, dt);
    }
    // взмах вниз чуть подбрасывает, в скольжении медленно проседает и возвращается
    const bob = flapping ? -beat * 0.12 : -0.15 * Math.sin(Math.PI * (u.cycle / CONFIG.keklikFlapCycle - 0.55) / 0.45);
    k.position.y = u.baseY + bob;
    u.head.rotation.x = Math.sin(u.phase * 0.5) * 0.08;
    u.tail.rotation.x = 0.15 + (flapping ? 0 : 0.12);
  }

  // Козлёнок на уступе: вертит головой, дёргает ушами, машет хвостиком, иногда переступает.
  // Беркут близко — пригибается и прижимает уши.
  animateKid(k, dt, close) {
    const u = k.userData, b = u.body.userData;
    u.t += dt;
    const t = u.t;
    u.crouch = damp(u.crouch, close ? 1 : 0, 6, dt);
    u.body.position.y = -0.22 * u.crouch;
    b.neck.rotation.y = Math.sin(t * 0.6) * 0.45 * (1 - u.crouch);
    b.neck.rotation.x = Math.sin(t * 0.37 + 1) * 0.15 + 0.35 * u.crouch;  // пригнулся — голову вниз
    const flick = Math.max(0, Math.sin(t * 1.3)) ** 12;                     // короткое подёргивание раз в ~5 с
    b.ears.forEach((ear, i) => { ear.rotation.x = flick * (i ? 0.6 : -0.6) - 0.5 * u.crouch; });
    b.tail.rotation.x = Math.sin(t * 9) * 0.35 * (Math.sin(t * 0.8) > 0.6 ? 1 : 0.15);
    const step = Math.max(0, Math.sin(t * 0.9 + 2)) ** 20;                 // иногда переступает передней ногой
    b.legs[0].rotation.x = -0.45 * step * (1 - u.crouch);
  }

  // Есть ли впереди, ближе dist метров, добыча, до которой можно дотянуться, — пора выпускать когти
  preyAhead(pos, dist) {
    const near = (k, r, dy) => !k.userData.checked && pos.z - k.position.z > 0 && pos.z - k.position.z < dist &&
      Math.abs(pos.x - k.position.x) < r && Math.abs(pos.y - k.position.y) < dy;
    const kr = CONFIG.keklikCatchRadius * CONFIG.clawMult, ir = CONFIG.ibexCatchRadius * CONFIG.clawMult;
    return this.kekliks.some((k) => k.userData.state === 'fly' && near(k, kr * 2, kr * 2)) ||
      this.kids.some((k) => k.userData.state === 'up' && near(k, ir * 2, CONFIG.ibexCatchAlt * 2));
  }

  // Удар о скальный выступ под козлёнком — как о скалу. Выступ — наклонный усечённый конус.
  collides(pos, radius) {
    for (const k of this.kids) {
      const s = k.userData.spur;
      if (!s.visible || Math.abs(pos.z - s.position.z) > SPUR_BASE + radius) continue;
      const { h, lean } = s.userData, y = pos.y - s.position.y;
      if (y > h + radius * 0.5 || y < 0) continue;
      const t = y / h;
      const r = THREE.MathUtils.lerp(SPUR_BASE, SPUR_TOP, t) * 0.9 + radius; // чуть меньше модели — честнее
      if (Math.hypot(pos.x - (s.position.x + lean * (1 - t)), pos.z - s.position.z) < r) return true;
    }
    return false;
  }

  // Кого беркут только что схватил: список { kind: 'keklik' | 'ibex', pos }. Проверка в момент пролёта.
  catch(pos) {
    const caught = [];
    for (const k of this.kekliks) {
      const u = k.userData;
      if (u.checked || pos.z > k.position.z) continue;
      u.checked = true;
      if (u.state === 'fly' && pos.distanceTo(k.position) < CONFIG.keklikCatchRadius * CONFIG.clawMult) {
        u.state = 'caught';
        k.visible = false;
        caught.push({ kind: 'keklik', pos: k.position.clone() });
      }
    }
    for (const k of this.kids) {
      const u = k.userData;
      if (u.checked || pos.z > k.position.z) continue;
      u.checked = true;
      const dy = pos.y - k.position.y;
      if (u.state === 'up' && Math.abs(pos.x - k.position.x) < CONFIG.ibexCatchRadius * CONFIG.clawMult &&
          dy < CONFIG.ibexCatchAlt && dy > -2) {
        u.state = 'caught';
        u.body.visible = false;
        caught.push({ kind: 'ibex', pos: k.position.clone() });
      }
    }
    return caught;
  }
}
