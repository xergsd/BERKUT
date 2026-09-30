// critters.js — добыча с характером: зайцы Бурабая, улары Алтая, песчанки Кызылкума, джейраны Мангистау.
// Каждый вид ведёт себя по-своему, но поймать его легко: захват шире, чем у сурка, а поведение
// работает на игрока — заяц замирает, улары взлетают к линии полёта, песчанки чаще наверху,
// стадо бежит медленнее беркута.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { BIOMES, createHare, createUlar, createMarmot, createGazelle, createGazelleAdult, GERBIL } from './visuals.js';
import { height, biomeAt } from './world.js';

const livesAt = (kind, z) => BIOMES[biomeAt(z)].prey === kind;
// ниже этой земли беркут без пике не дотянется: он летает не ниже altitudeMid - altitudeRange
const minGround = () => CONFIG.altitudeMid - CONFIG.altitudeRange - CONFIG.critterCatchAlt + 2;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const lane = () => CONFIG.controlRangeX - 4; // куда беркут долетает по x
const jitter = (spacing) => spacing * (0.7 + Math.random() * 0.6);

// Беркут близко и летит прямо на зверя
function eagleClose(obj, p, speed, dx = 15) {
  const ahead = p.z - obj.position.z;
  return ahead > 0 && ahead < Math.max(30, speed * CONFIG.strikeTime) && Math.abs(p.x - obj.position.x) < dx;
}
// Можно ли схватить: по горизонтали близко, по высоте — от чуть ниже зверя до critterCatchAlt над ним
function inReach(pos, obj, groundY, scale = 1) {
  const r = CONFIG.critterCatchRadius * CONFIG.clawMult * scale, dy = pos.y - groundY;
  return Math.abs(pos.x - obj.position.x) < r && dy > -3 && dy < CONFIG.critterCatchAlt * scale;
}

export class Critters {
  constructor(scene, world) {
    this.world = world;
    const add = (make) => { const o = make(); o.visible = false; scene.add(o); return o; };
    this.hares = Array.from({ length: CONFIG.hareCount }, () => ({ z: 0, hare: add(createHare) }));
    this.coveys = Array.from({ length: CONFIG.ularCoveys }, () => ({
      z: 0, state: 'none', birds: Array.from({ length: CONFIG.ularPerCovey }, () => add(createUlar)) }));
    this.colonies = Array.from({ length: CONFIG.gerbilColonies }, () => ({
      z: 0, gerbils: Array.from({ length: CONFIG.gerbilPerColony }, () => add(() => createMarmot(GERBIL))) }));
    this.herds = Array.from({ length: CONFIG.herdCount }, () => ({
      z: 0, state: 'none', fawns: [add(createGazelle), add(createGazelle)],
      adults: Array.from({ length: 4 }, () => add(createGazelleAdult)) }));
    this.reset();
  }

  // группы одного вида: [список, как поставить, расстояние между группами]
  get groups() {
    return [[this.hares, (g, z) => this.placeHare(g, z), CONFIG.hareSpacing],
      [this.coveys, (g, z) => this.placeCovey(g, z), CONFIG.ularSpacing],
      [this.colonies, (g, z) => this.placeColony(g, z), CONFIG.gerbilSpacing],
      [this.herds, (g, z) => this.placeHerd(g, z), CONFIG.herdSpacing]];
  }

  reset() {
    for (const [list, place, spacing] of this.groups) {
      let z = -200;
      for (const g of list) { place(g, z); z -= jitter(spacing); }
    }
  }

  // все, кого можно поймать, — для когтей и чтобы скалы не загораживали подлёт (world.protectHuntingLane)
  targets() {
    return [...this.hares.map((g) => g.hare), ...this.coveys.flatMap((c) => c.birds),
      ...this.colonies.flatMap((c) => c.gerbils), ...this.herds.flatMap((h) => h.fawns)]
      .filter((o) => o.visible && o.userData.state !== 'none' && o.userData.state !== 'caught');
  }

  protectLanes() { for (const r of this.world.rocks) this.world.protectHuntingLane(r); }

  // точка на пригорке, до которого беркут дотягивается; null — не нашлось
  spot(z, spreadX = lane(), spreadZ = 60) {
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 2 * spreadX, mz = z + (Math.random() - 0.5) * spreadZ;
      if (height(x, mz) >= minGround()) return [x, mz];
    }
    return null;
  }

  // ---------- заяц: скачет зигзагом поперёк поляны, рядом с беркутом замирает ----------
  placeHare(g, z) {
    const h = g.hare, u = h.userData;
    g.z = z;
    h.visible = false; u.state = 'none'; u.checked = false;
    u.body.visible = true; u.body.position.y = 0; u.body.scale.y = 1;
    if (!livesAt('hare', z)) return;
    const at = this.spot(z, lane() - 8);
    if (!at) return;
    h.position.set(at[0], height(at[0], at[1]), at[1]);
    Object.assign(u, { state: 'hop', from: at[0], to: at[0], t: 1, wait: Math.random(), dir: Math.random() < 0.5 ? -1 : 1 });
    h.visible = true;
    this.protectLanes();
  }

  animateHare(h, dt, close) {
    const u = h.userData;
    if (u.state === 'hop' && close) u.state = 'freeze';
    if (u.state === 'freeze') { // прижался к земле и не шевелится — хватай
      u.body.position.y = damp(u.body.position.y, 0, 12, dt);
      u.body.scale.y = damp(u.body.scale.y, 0.7, 8, dt);
      h.rotation.y = damp(h.rotation.y, 0, 8, dt);
      return;
    }
    if (u.t < 1) {
      u.t = Math.min(1, u.t + dt / CONFIG.hareHopTime);
      const e = u.t * u.t * (3 - 2 * u.t);
      h.position.x = u.from + (u.to - u.from) * e;
      u.body.position.y = Math.sin(Math.PI * u.t) * 0.8;
    } else if ((u.wait -= dt) <= 0) { // следующий прыжок — в другую сторону
      u.dir = -u.dir;
      const to = h.position.x + u.dir * (CONFIG.hareHopMin + Math.random() * (CONFIG.hareHopMax - CONFIG.hareHopMin));
      if (Math.abs(to) < lane() && height(to, h.position.z) >= minGround()) Object.assign(u, { from: h.position.x, to, t: 0 });
      u.wait = CONFIG.harePause;
    }
    h.position.y = height(h.position.x, h.position.z);
    h.rotation.y = damp(h.rotation.y, u.t < 1 ? Math.sign(u.to - u.from) * Math.PI / 2 : 0, 10, dt);
  }

  // ---------- улары: стайка на склоне; беркут близко — вспархивают и планируют к линии его полёта ----------
  placeCovey(c, z) {
    c.z = z; c.state = 'none';
    for (const b of c.birds) { b.visible = false; b.userData.state = 'none'; b.userData.checked = false; b.userData.body.visible = true; }
    if (!livesAt('ular', z)) return;
    const at = this.spot(z, lane() - 6, 40);
    if (!at) return;
    c.state = 'sit';
    c.birds.forEach((b, i) => {
      const x = at[0] + (i - 1) * 2.5, mz = at[1] + (i % 2) * 2.2;
      b.position.set(x, height(x, mz), mz);
      b.rotation.y = (Math.random() - 0.5) * 1.2;
      Object.assign(b.userData, { state: 'sit', t: 0, lift: 0, phase: Math.random() * 6 });
      b.visible = true;
    });
    this.protectLanes();
  }

  animateCovey(c, dt, p, speed) {
    // беркут в ularFlushTime секундах и не дальше 30 м в сторону — стайка вспархивает
    const near = (b) => { const ahead = p.z - b.position.z; return ahead > 0 && ahead < Math.max(40, speed * CONFIG.ularFlushTime) && Math.abs(p.x - b.position.x) < 30; };
    if (c.state === 'sit' && c.birds.some((b) => b.userData.state === 'sit' && near(b))) {
      c.state = 'fly';
      for (const b of c.birds) {
        if (b.userData.state !== 'sit') continue;
        const toEagle = Math.sign(p.x - b.position.x) || 1; // вниз по склону — к середине ущелья, где летит беркут
        Object.assign(b.userData, { state: 'fly', t: 0,
          vx: toEagle * CONFIG.ularFlySpeed * (0.8 + Math.random() * 0.4), vz: -CONFIG.ularFlySpeed * 0.4 });
      }
    }
    for (const b of c.birds) {
      const u = b.userData, bird = u.body, wings = [[bird.userData.wingL, -1], [bird.userData.wingR, 1]];
      if (u.state === 'fly') {
        u.t += dt;
        b.position.x += u.vx * dt; b.position.z += u.vz * dt;
        // взлёт на ~5 м, потом скольжение вниз, к концу — у самой земли
        const k = Math.min(1, u.t / CONFIG.ularFlyTime);
        u.lift = 5 * Math.sin(Math.min(1, u.t / 0.4) * Math.PI / 2) * (1 - 0.7 * k);
        b.rotation.y = Math.atan2(u.vx, u.vz);
        u.phase += dt * 22;
        for (const [wing, side] of wings) {
          wing.rotation.y = damp(wing.rotation.y, 0, 10, dt); // крылья раскрылись
          wing.rotation.z = side * (u.t < 0.8 ? 0.2 + Math.sin(u.phase) * 0.7 : -0.15); // взмахи, потом планирует
        }
        if (u.t >= CONFIG.ularFlyTime) u.state = 'sit'; // сел на новом месте
      } else if (u.state === 'sit') {
        u.lift = damp(u.lift, 0, 6, dt);
        for (const [wing, side] of wings) { wing.rotation.y = damp(wing.rotation.y, side * 1.4, 8, dt); wing.rotation.z = damp(wing.rotation.z, -side * 0.1, 8, dt); }
        bird.userData.head.rotation.x = Math.max(0, Math.sin((u.phase += dt * 1.3))) * 0.5; // клюёт
      }
      b.position.y = height(b.position.x, b.position.z) + u.lift;
    }
  }

  // ---------- песчанки: колония нор, выглядывают и прячутся по очереди, сами по себе ----------
  placeColony(c, z) {
    c.z = z;
    for (const g of c.gerbils) { g.visible = false; g.userData.state = 'none'; g.userData.checked = false; g.userData.body.visible = true; }
    if (!livesAt('gerbil', z)) return;
    const at = this.spot(z, lane() - 10, 40);
    if (!at) return;
    for (const g of c.gerbils) {
      const x = at[0] + (Math.random() - 0.5) * 20, mz = at[1] + (Math.random() - 0.5) * 24;
      if (Math.abs(x) > lane() || height(x, mz) < minGround() - 2) continue; // нора в низине — пропускаем
      g.position.set(x, height(x, mz), mz);
      g.rotation.y = (Math.random() - 0.5) * 0.8;
      Object.assign(g.userData, { state: 'live', clock: Math.random() * (CONFIG.gerbilUp + CONFIG.gerbilDown), hide: 0 });
      g.visible = true;
    }
    this.protectLanes();
  }

  animateGerbil(g, dt) {
    const u = g.userData, cycle = CONFIG.gerbilUp + CONFIG.gerbilDown;
    u.clock = (u.clock + dt) % cycle;
    u.hide = damp(u.hide, u.clock < CONFIG.gerbilUp ? 0 : 1, 8, dt);
    u.body.position.y = -3.2 * u.hide * u.hide;
  }

  // ---------- джейраны: стадо бежит вперёд по плато; догнать и выхватить джейранёнка ----------
  placeHerd(h, z) {
    h.z = z; h.state = 'none';
    for (const m of [...h.fawns, ...h.adults]) { m.visible = false; m.userData.state = 'none'; m.userData.checked = false; m.userData.body.visible = true; }
    if (!livesAt('gazelle', z)) return;
    const at = this.spot(z, lane() - 18, 20);
    if (!at) return;
    h.x = at[0]; h.z = at[1]; h.state = 'graze'; h.t = Math.random() * 10;
    // взрослые по краям, джейранята в середине
    const spots = [[-2, 1], [2, 2], [-6, -3], [6, -3], [-4, 6], [4, 6]];
    [...h.fawns, ...h.adults].forEach((m, i) => {
      m.userData.offset = spots[i];
      m.userData.state = 'live';
      m.visible = true;
    });
    this.placeHerdMembers(h, 0);
    this.protectLanes();
  }

  placeHerdMembers(h, dt) {
    const running = h.state === 'run';
    h.t += dt;
    [...h.fawns, ...h.adults].forEach((m, i) => {
      if (!m.visible) return;
      const [ox, oz] = m.userData.offset, b = m.userData.body.userData;
      const x = h.x + ox, z = h.z + oz;
      m.position.set(x, height(x, z), z);
      m.rotation.y = damp(m.rotation.y, running ? Math.PI : (i % 3 - 1) * 0.8, 6, dt); // бегут от беркута, по ходу полёта
      const gallop = h.t * 13 + i * 1.3;
      b.legs.forEach((leg, k) => { leg.rotation.x = running ? Math.sin(gallop + (k < 2 ? 0 : Math.PI)) * 0.7 : 0; });
      m.userData.body.position.y = running ? Math.abs(Math.sin(gallop)) * 0.15 : 0;
      b.neck.rotation.x = damp(b.neck.rotation.x, running ? -0.1 : 0.7, 5, dt); // пасутся — голова вниз
    });
  }

  // speed — скорость беркута, м/с
  update(dt, p, speed = 0) {
    // группа осталась позади — переносится вперёд, за самую дальнюю своего вида
    for (const [list, place, spacing] of this.groups) {
      for (const g of list) {
        if (g.z <= p.z + 40) continue;
        place(g, Math.min(...list.map((k) => k.z)) - jitter(spacing));
      }
    }
    for (const g of this.hares) if (g.hare.visible) this.animateHare(g.hare, dt, eagleClose(g.hare, p, speed));
    for (const c of this.coveys) if (c.state !== 'none') this.animateCovey(c, dt, p, speed);
    for (const c of this.colonies) for (const g of c.gerbils) if (g.userData.state === 'live') this.animateGerbil(g, dt);
    for (const h of this.herds) {
      if (h.state === 'none') continue;
      if (h.state === 'graze' && p.z - h.z > 0 && p.z - h.z < CONFIG.herdStartDist) h.state = 'run';
      if (h.state === 'run') h.z -= CONFIG.herdSpeed * dt;
      this.placeHerdMembers(h, dt);
    }
  }

  // Есть ли впереди, ближе dist метров, добыча, до которой можно дотянуться, — пора выпускать когти
  preyAhead(pos, dist) {
    return this.targets().some((o) => {
      const ahead = pos.z - o.position.z;
      return ahead > 0 && ahead < dist && inReach(pos, o, o.position.y, 2);
    });
  }

  // Кого беркут только что схватил: список { kind, pos }
  catch(pos) {
    const caught = [];
    const take = (o, kind) => {
      o.userData.state = 'caught';
      o.userData.body.visible = false;
      caught.push({ kind, pos: o.position.clone() });
    };
    // сидячие — проверка в момент пролёта над ними (как у сурка)
    const passOver = (o) => {
      if (o.userData.checked || pos.z > o.position.z) return false;
      o.userData.checked = true;
      return true;
    };
    for (const { hare } of this.hares)
      if (hare.visible && hare.userData.state !== 'caught' && hare.userData.state !== 'none' && passOver(hare) &&
          inReach(pos, hare, hare.position.y)) take(hare, 'hare');
    for (const c of this.colonies) for (const g of c.gerbils)
      if (g.userData.state === 'live' && passOver(g) && g.userData.hide < 0.75 && inReach(pos, g, g.position.y)) take(g, 'gerbil');
    // движущиеся (улары в полёте, бегущие джейранята) — пока беркут рядом по z
    for (const c of this.coveys) for (const b of c.birds)
      if (b.visible && (b.userData.state === 'sit' || b.userData.state === 'fly') &&
          Math.abs(pos.z - b.position.z) < 5 && inReach(pos, b, b.position.y)) take(b, 'ular');
    for (const h of this.herds) for (const f of h.fawns)
      if (f.visible && f.userData.state === 'live' && Math.abs(pos.z - f.position.z) < 5 &&
          inReach(pos, f, f.position.y)) take(f, 'gazelle');
    return caught;
  }
}
