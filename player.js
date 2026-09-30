// player.js — беркут: управление, движение, взмахи крыльев
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createEagle, createMarmot, createKeklik, createIbexKid, createHare, GERBIL, MARMOT, ULAR, GAZELLE } from './visuals.js';
import { height } from './world.js';
import { FlightMotion } from './flight-motion.js';

// Добыча в когтях: модель без норы, уступа и свечения, повёрнутая спиной вверх и головой вперёд.
// holder — точка хвата; model сдвинута так, что хват приходится на спину.
function carryModel(kind) {
  const holder = new THREE.Group();
  let model;
  if (kind === 'marmot' || kind === 'gerbil') { // стоит «столбиком» — кладём горизонтально
    model = createMarmot(kind === 'gerbil' ? GERBIL : MARMOT).userData.body;
    model.position.set(0, -1.4, 0.7);
    holder.rotation.set(-Math.PI / 2, Math.PI, 0);
    holder.scale.setScalar(kind === 'gerbil' ? 0.42 : 0.5); // песчанка меньше сурка: 1.1 против 1.3
  } else if (kind === 'ibex' || kind === 'gazelle') {
    model = createIbexKid(kind === 'gazelle' ? GAZELLE : undefined).userData.body;
    model.position.set(0, -1.83, 0);
    holder.rotation.y = Math.PI;
    holder.scale.setScalar(0.7);
  } else if (kind === 'hare') {
    model = createHare().userData.body;
    model.position.set(0, -1.35, 0);
    holder.rotation.y = Math.PI;
    holder.scale.setScalar(0.58);
  } else {
    model = createKeklik(kind === 'ular' ? ULAR : undefined); // свой масштаб 1.8 — хват на спине на высоте 0.45 × 1.8
    model.position.set(0, -0.8, 0);
    model.userData.wingL.rotation.z = 0.9; // крылья обвисли
    model.userData.wingR.rotation.z = -0.9;
    holder.rotation.y = Math.PI;
    holder.scale.setScalar(0.35);
  }
  const glow = [];
  model.traverse((o) => { if (o.isSprite) glow.push(o); });
  for (const g of glow) g.parent.remove(g);
  model.visible = true;
  holder.add(model);
  holder.userData.base = holder.scale.x;
  holder.userData.model = model;
  const materials=[];
  model.traverse(o=>{
    if(!o.isMesh)return;
    const clone=m=>{const c=m.clone();c.transparent=true;materials.push(c);return c;};
    o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
  });
  holder.userData.materials=materials;
  holder.visible = false;
  return holder;
}

export class Player {
  constructor(scene, dom) {
    this.mesh = createEagle();
    scene.add(this.mesh);
    this.wingL = this.mesh.userData.wingL || this.mesh.getObjectByName('wingL');
    this.wingR = this.mesh.userData.wingR || this.mesh.getObjectByName('wingR');
    this.motion = new FlightMotion();
    this.talons = this.mesh.userData.talons;
    this.carried = {};
    for (const kind of ['marmot', 'gerbil', 'hare', 'ular', 'keklik', 'ibex', 'gazelle']) {
      this.carried[kind] = carryModel(kind);
      this.mesh.userData.carry.add(this.carried[kind]);
    }
    this.strikeWanted = false; // впереди добыча — выпустить когти (ставит main.js)
    this.lungeWanted = false;  // добыча совсем рядом — удар лапами вперёд (ставит main.js)
    this.pos = new THREE.Vector3();
    this.target = { x: 0, y: 0 }; // -1..1 по обеим осям
    this.keys = new Set();
    this.touches = 0;
    this.mouseDown = false; // левая кнопка мыши — пике
    this.keySens = 1;       // множитель скорости WASD из настроек

    const onPointer = (cx, cy) => {
      this.target.x = (cx / innerWidth - 0.5) * 2;
      this.target.y = (cy / innerHeight - 0.5) * 2;
    };
    const isControl = (e) => e.target?.closest?.('.ui'); // меню и кнопка паузы
    dom.addEventListener('mousemove', (e) => { if (!isControl(e)) onPointer(e.clientX, e.clientY); });
    dom.addEventListener('touchmove', (e) => {
      if (isControl(e)) return;
      const t = Array.from(e.touches).find((touch) => !touch.target?.closest?.('.ui'));
      if (t) onPointer(t.clientX, t.clientY);
    }, { passive: true });
    const onTouches = (e) => { this.touches = Array.from(e.touches).filter((t) => !t.target?.closest?.('.ui')).length; };
    dom.addEventListener('touchstart', onTouches, { passive: true });
    dom.addEventListener('touchend', onTouches, { passive: true });
    dom.addEventListener('touchcancel', onTouches, { passive: true });
    dom.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0 && !isControl(e)) this.mouseDown = true; });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.mouseDown = false; });
    addEventListener('keydown', (e) => { if (!isControl(e)) this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.touches = 0; this.mouseDown = false; });
    this.reset();
  }

  // рывок: Shift или второй палец на экране
  get boostHeld() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touches >= 2;
  }

  // пике: пробел, левая кнопка мыши или палец у нижнего края экрана
  get diveHeld() {
    return this.keys.has('Space') || this.mouseDown || (this.touches >= 1 && this.target.y >= CONFIG.diveTouchEdge);
  }

  reset() {
    this.pos.set(0, CONFIG.altitudeMid, 0);
    this.target.x = 0; this.target.y = 0;
    this.ceiling = null;
    this.bounceY = 0;    // после удара о землю: ниже этой высоты нельзя...
    this.bounceT = 0;    // ...столько секунд
    this.vy = 0;         // м/с — скорость падения в пике и при выходе из него (вниз — минус)
    this.zoom = 0;       // 0..1 — после выхода из пике подъём быстрее
    this.anchor = null;  // { y, t }: после пике высота y соответствует положению мыши t
    this.strikeWanted=false;this.grip=0;this.carryAge=0;this.carryKind=null;this.visualTime=0;
    this.lungeWanted = false;
    this.lunge = 0;      // 0..1 — удар: корпус задран назад, лапы выброшены вперёд
    this.strike = 0;     // 0..1 — насколько выдвинуты когти
    this.legPose = 0.6;  // рад: 0.6 — когти вперёд к добыче, 0 — вниз, держат добычу
    this.carryT = 0;     // секунд ещё нести добычу
    for (const m of Object.values(this.carried)) m.visible = false;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.position.copy(this.pos);
    this.mesh.visible = true;
    this.motion.reset();
    this.flight = this.motion.pose;
    this.applyPose(this.flight);
    this.updateTalons(0);
  }

  // Поимка: добыча повисает в когтях, крылья тормозят, затем мощные взмахи и рывок вверх
  grab(kind) {
    for (const [k, m] of Object.entries(this.carried)) { m.visible = k === kind; m.scale.setScalar(m.userData.base); }
    if(!this.carried[kind])return;
    this.carryKind=kind;this.carryAge=0;
    for(const m of Object.values(this.carried))for(const material of m.userData.materials)material.opacity=1;
    this.carryT = CONFIG.carryTime;
    this.motion.grab();
    this.vy = Math.max(this.vy, 0) + CONFIG.grabLift;
  }

  // удар о землю: выталкиваем над землёй и подбрасываем вверх
  bounce(minY) {
    this.pos.y = Math.max(this.pos.y, minY);
    this.bounceY = minY + CONFIG.groundBounce;
    this.bounceT = CONFIG.groundBounceTime;
    this.vy = 0;
    if (this.anchor) this.anchor.y = Math.max(this.anchor.y, this.bounceY); // не тянуть снова к земле
  }

  // Высота, которую задаёт мышь (t: -1 верх .. 1 низ). После пике беркут держит высоту,
  // где выровнялся: она соответствует тому положению мыши, при котором пике закончилось.
  // Вверх от него — до обычного потолка, вниз — до обычного минимума (или ниже нельзя, если уже ниже).
  altitudeFor(t) {
    const top = CONFIG.altitudeMid + CONFIG.altitudeRange, a = this.anchor;
    if (!a) return CONFIG.altitudeMid - t * CONFIG.altitudeRange;
    const bottom = Math.min(CONFIG.altitudeMid - CONFIG.altitudeRange, a.y);
    if (t <= a.t) return a.t <= -1 ? a.y : THREE.MathUtils.lerp(top, a.y, (t + 1) / (a.t + 1));
    return a.t >= 1 ? a.y : THREE.MathUtils.lerp(a.y, bottom, (t - a.t) / (1 - a.t));
  }

  applyPose(p) {
    // sweep — крылья отведены назад в пике
    if (this.wingL) this.wingL.rotation.set(p.twist, p.sweep, -p.leftLift);
    if (this.wingR) this.wingR.rotation.set(p.twist, -p.sweep, p.rightLift);
    for (const [wing, side] of [[this.wingL, -1], [this.wingR, 1]]) {
      const wrist = wing?.userData.wrist;
      if (wrist) {
        wrist.rotation.set(p.twist * 0.5, -side * p.fold, side * p.wristLift);
        wrist.scale.z=1-(p.diveAmount||0)*.15+(p.recovery||0)*.10;
      }
    }
    const { tail, head } = this.mesh.userData;
    if (tail) { tail.rotation.set(p.tailPitch, p.tailYaw, 0); tail.scale.x = p.tailSpread; }
    if (head) head.rotation.set(-this.mesh.rotation.x * (.45-(p.diveAmount||0)*.27), -this.mesh.rotation.y * 0.35, -this.mesh.rotation.z * 0.55);
  }

  update(dt, time, forward, boosting = false, exhausted = false, diving = false) {
    // клавиатура: стрелки / WASD
    const k = this.keys, v = CONFIG.keyboardSpeed * this.keySens * dt;
    if (k.has('ArrowLeft') || k.has('KeyA')) this.target.x -= v;
    if (k.has('ArrowRight') || k.has('KeyD')) this.target.x += v;
    if (k.has('ArrowUp') || k.has('KeyW')) this.target.y -= v;
    if (k.has('ArrowDown') || k.has('KeyS')) this.target.y += v;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -1, 1);
    this.target.y = THREE.MathUtils.clamp(this.target.y, -1, 1);

    this.pos.z -= forward;
    const tx = this.target.x * CONFIG.controlRangeX;
    // после пике мышь у верхнего края — продолжаем подъём, двигать её выше уже некуда
    const top = CONFIG.altitudeMid + CONFIG.altitudeRange;
    if (this.anchor && !diving && this.vy >= -2 && this.target.y <= -0.95) {
      this.anchor.y += CONFIG.diveEdgeClimb * dt;
      if (this.anchor.y >= top) this.anchor = null; // дошли до потолка — обычное управление
    }
    let ty = this.altitudeFor(this.target.y);
    // без сил «потолок» — высота над землёй, и она опускается: беркут следует рельефу,
    // но через несколько секунд коснётся земли. Вниз — можно.
    if (exhausted) {
      const ahead = dt > 0 ? (forward / dt) * CONFIG.exhaustedLookAhead : 0;
      let ground = -Infinity;
      for (let k = 0; k <= 4; k++) ground = Math.max(ground, height(this.pos.x, this.pos.z - ahead * k / 4));
      if (this.ceiling === null) this.ceiling = THREE.MathUtils.clamp(this.pos.y - ground, 6, CONFIG.exhaustedMaxAgl);
      this.ceiling = Math.max(0, this.ceiling - CONFIG.exhaustedSink * dt);
      ty = Math.min(ty, ground + this.ceiling);
    } else this.ceiling = null;
    const a = Math.min(1, dt * CONFIG.steerResponse);
    const previousY = this.pos.y;
    this.pos.x += (tx - this.pos.x) * (diving ? a * CONFIG.diveSteerMult : a);
    // отскок после удара о землю: какое-то время снижаться нельзя
    if (this.bounceT > 0) { this.bounceT -= dt; ty = Math.max(ty, this.bounceY); diving = false; }
    if (diving) {
      // пике: падение разгоняется, высота мыши не важна
      this.vy = Math.max(-CONFIG.diveMaxFall, this.vy - CONFIG.diveAccel * dt);
      this.zoom = Math.min(1, -this.vy / CONFIG.diveMaxFall);
      this.pos.y += this.vy * dt;
    } else {
      // выход из пике: падение гасится не сразу — с полной скорости беркут ещё просядет;
      // накопленная скорость ненадолго ускоряет подъём
      this.vy *= Math.exp(-CONFIG.divePullOut * dt);
      this.zoom = Math.max(0, this.zoom - dt / CONFIG.diveZoomTime);
      const up = Math.min(1, a * (1 + this.zoom * CONFIG.diveZoom));
      const ay = ty < this.pos.y ? Math.min(1, dt * CONFIG.diveResponse) : up;
      this.pos.y += (ty - this.pos.y) * ay + this.vy * dt;
    }
    // пока падаем (пике и выход из него) — высота, где выровняемся, запоминается
    if (diving || this.vy < -2) this.anchor = { y: this.pos.y, t: this.target.y };

    this.mesh.position.copy(this.pos);
    const bank = THREE.MathUtils.clamp(-(tx - this.pos.x) * 0.02, -0.65, 0.65);
    let pitch = diving ? 0 : THREE.MathUtils.clamp((ty - this.pos.y) * 0.02, -0.30, 0.30);
    pitch = Math.min(pitch, (this.vy / CONFIG.diveMaxFall) * CONFIG.divePitch); // в пике — клювом вниз
    // удар: как настоящий беркут, в последний миг задирает корпус и выбрасывает лапы вперёд
    this.lunge += ((this.lungeWanted && this.carryT <= 0 ? 1 : 0) - this.lunge) * Math.min(1, dt * 12);
    pitch += this.lunge * 0.45;
    const smooth = 1 - Math.exp(-6 * dt);
    this.mesh.rotation.z += (bank - this.mesh.rotation.z) * smooth;
    this.mesh.rotation.x += (pitch - this.mesh.rotation.x) * smooth;
    this.mesh.rotation.y += (bank * 0.12 - this.mesh.rotation.y) * smooth;
    this.flight = this.motion.update(dt, { climb: dt > 0 ? (this.pos.y - previousY) / dt : 0,
      turn: -this.mesh.rotation.z / 0.65, boosting, diving, descent: Math.max(0,-this.vy)/CONFIG.diveMaxFall,
      brace: this.lunge });
    this.mesh.position.y += this.flight.bob;
    this.applyPose(this.flight);
    this.updateTalons(dt);
  }

  // Only the visual rig changes here; capture rewards and flight physics live elsewhere.
  updateTalons(dt) {
    const smooth=rate=>1-Math.exp(-rate*dt);
    this.visualTime+=dt;
    if(this.carryT>0){this.carryT=Math.max(0,this.carryT-dt);this.carryAge+=dt;}
    const carrying=this.carryT>0;
    const want=carrying||this.strikeWanted?1:0;
    this.strike+=(want-this.strike)*smooth(want?10:6);
    this.grip+=((carrying?1:0)-this.grip)*smooth(carrying?14:9);
    this.legPose+=((carrying?.04:THREE.MathUtils.lerp(.72,1.15,this.lunge))-this.legPose)*smooth(carrying?7:14);
    const width=this.carryKind==='ibex'||this.carryKind==='gazelle'?.43:this.carryKind==='keklik'||this.carryKind==='ular'?.25:.33;
    for(const hip of this.talons) {
      hip.visible=this.strike>.02;
      hip.position.x=hip.userData.side*THREE.MathUtils.lerp(.33,width,this.grip);
      hip.rotation.x=THREE.MathUtils.lerp(-1.3,this.legPose,this.strike);
      hip.rotation.z=hip.userData.side*.08*this.strike*(1-this.grip);
      hip.scale.setScalar(.5+.5*this.strike);
      for(const finger of hip.userData.fingers) {
        finger.root.rotation.y=finger.angle*(1+.22*(1-this.grip));
        finger.curl.rotation.x=THREE.MathUtils.lerp(.15,-.92,this.grip);
        finger.joint.rotation.x=THREE.MathUtils.lerp(-.12,-1.15,this.grip);
      }
    }
    const tucked=this.mesh.getObjectByName('tucked-feet');if(tucked)tucked.visible=this.strike<.35;
    const carry=this.mesh.userData.carry;
    // Follow the actual palms as the legs extend and retract.
    const center=new THREE.Vector3(),foot=new THREE.Vector3();
    this.mesh.updateMatrixWorld(true);
    for(const hip of this.talons){hip.userData.palm.getWorldPosition(foot);center.add(this.mesh.worldToLocal(foot));}
    carry.position.copy(center.multiplyScalar(.5));carry.position.y-=.10;
    const sway=Math.sin(this.carryAge*5)*.10*Math.exp(-this.carryAge*.8);
    carry.rotation.set(sway,-this.mesh.rotation.y*.2,-this.mesh.rotation.z*.25+sway*.4);
    const fade=THREE.MathUtils.smoothstep(this.carryT,0,.45)*THREE.MathUtils.smoothstep(this.carryAge,0,.12);
    for(const [kind,m] of Object.entries(this.carried)) {
      m.visible=carrying&&kind===this.carryKind;
      m.scale.setScalar(m.userData.base);
      for(const material of m.userData.materials)material.opacity=fade;
      if(m.visible)this.struggle(kind,m.userData.model);
    }
  }

  // Первые секунду добыча бьётся в когтях: птицы машут крыльями, козлёнок и джейранёнок дрыгают ногами,
  // остальные извиваются
  struggle(kind, model) {
    const a = this.carryAge, k = Math.exp(-a * 2.5), fight = Math.sin(a * 26);
    if (kind === 'keklik' || kind === 'ular') {
      model.userData.wingL.rotation.z = 0.9 - fight * 0.7 * k; // обвисшие крылья + взмахи
      model.userData.wingR.rotation.z = -0.9 + fight * 0.7 * k;
    } else if (kind === 'ibex' || kind === 'gazelle') {
      model.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(a * 22 + i * 1.7) * 0.6 * k; });
      model.userData.neck.rotation.x = 0.3 + fight * 0.25 * k;
    } else {
      model.rotation.z = fight * 0.2 * k;
    }
  }
}
