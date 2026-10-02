// effects.js — короткие эффекты поимки: пыль с земли или скалы, разлетающиеся перья птиц; полосы ветра в пике
import * as THREE from 'three';
import { CONFIG } from './config.js';

const DUST = 14, FEATHERS = 12;
const DUST_COLOR = { marmot: '#b89a6e', ibex: '#9aa3ab', gerbil: '#d6b27a', hare: '#8a7a5a', gazelle: '#d8cdb8' };
const BIRDS = ['keklik', 'ular']; // у птиц — перья, у зверей — пыль

function softTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Effects {
  constructor(scene) {
    const tex = softTexture();
    this.dust = [];
    for (let i = 0; i < DUST; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false;
      s.userData = { v: new THREE.Vector3(), life: 0, max: 1, size: 1 };
      scene.add(s);
      this.dust.push(s);
    }
    const plume = new THREE.PlaneGeometry(0.35, 1);
    this.feathers = [];
    for (let i = 0; i < FEATHERS; i++) {
      const f = new THREE.Mesh(plume, new THREE.MeshLambertMaterial({
        color: i % 3 ? '#9a8d80' : '#e2cfa6', side: THREE.DoubleSide, transparent: true }));
      f.visible = false;
      f.userData = { v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 };
      scene.add(f);
      this.feathers.push(f);
    }
  }

  // Облачко пыли у зверей, перья у птиц
  burst(kind, pos) {
    if (BIRDS.includes(kind)) {
      for (const f of this.feathers) {
        const u = f.userData;
        f.position.copy(pos);
        u.v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 5);
        u.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
        u.life = 1.6;
        f.material.opacity = 1;
        f.visible = true;
      }
      return;
    }
    for (const s of this.dust) {
      const u = s.userData, a = Math.random() * Math.PI * 2;
      s.position.set(pos.x + Math.cos(a), pos.y + 0.5, pos.z + Math.sin(a));
      u.v.set(Math.cos(a) * (3 + Math.random() * 3), 1.5 + Math.random() * 1.5, Math.sin(a) * (3 + Math.random() * 3));
      u.max = u.life = 0.7 + Math.random() * 0.4;
      u.size = 1.5 + Math.random();
      s.material.color.set(DUST_COLOR[kind]);
      s.visible = true;
    }
  }

  clear() {
    for (const o of [...this.dust, ...this.feathers]) { o.visible = false; o.userData.life = 0; }
  }

  update(dt) {
    for (const s of this.dust) {
      const u = s.userData;
      if (!s.visible) continue;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      const t = 1 - u.life / u.max; // 0 → 1: растёт и тает
      s.position.addScaledVector(u.v, dt);
      u.v.multiplyScalar(Math.exp(-2 * dt));
      s.scale.setScalar(u.size + t * 4);
      s.material.opacity = 0.55 * (1 - t);
    }
    for (const f of this.feathers) {
      const u = f.userData;
      if (!f.visible) continue;
      u.life -= dt;
      if (u.life <= 0) { f.visible = false; continue; }
      u.v.x *= Math.exp(-1.5 * dt); u.v.z *= Math.exp(-1.5 * dt);
      u.v.y = Math.max(-2, u.v.y - 6 * dt); // перо падает медленно
      f.position.addScaledVector(u.v, dt);
      f.rotation.x += u.spin.x * dt; f.rotation.y += u.spin.y * dt; f.rotation.z += u.spin.z * dt;
      f.material.opacity = Math.min(1, u.life / 0.5);
    }
  }
}

// ---------- полосы ветра в пике ----------
// Тонкие светлые черты вокруг беркута летят навстречу и вверх — воздух проносится мимо падающей птицы.
// Координаты черт — относительно беркута; рядом с ним (ближе STREAK_MIN м) их нет, чтобы не мешать смотреть.
const STREAKS = 48, STREAK_MIN = 5, STREAK_SPREAD = 12;
const _dir = new THREE.Vector3();

export class WindStreaks {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    this.positions = new Float32Array(STREAKS * 6);
    this.fade = new Float32Array(STREAKS * 2); // у головы черты — яркость, у хвоста — 0
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('fade', new THREE.BufferAttribute(this.fade, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { opacity: { value: 0 }, color: { value: new THREE.Color('#f4f8ff') } },
      vertexShader: `attribute float fade; varying float vFade;
        void main() { vFade = fade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float opacity; uniform vec3 color; varying float vFade;
        void main() { gl_FragColor = vec4(color, opacity * vFade); }`,
    });
    this.lines = new THREE.LineSegments(g, this.material);
    this.lines.frustumCulled = false; this.lines.renderOrder = 3; this.lines.visible = false;
    scene.add(this.lines);
    this.streaks = Array.from({ length: STREAKS }, () => ({ x: 0, y: 0, z: 0, k: 1 }));
    this.ready = false;
  }

  // anywhere — по всей глубине (первое появление), иначе — далеко впереди;
  // чем быстрее падение, тем ниже появляются: оттуда их несёт вверх
  spawn(s, anywhere, fall) {
    const a = Math.random() * Math.PI * 2, r = STREAK_MIN + Math.random() * STREAK_SPREAD;
    s.x = Math.cos(a) * r;
    s.y = Math.sin(a) * r * 0.8 - fall * 12;
    s.z = anywhere ? -10 - Math.random() * 70 : -60 - Math.random() * 25;
    s.k = 0.6 + Math.random() * 0.8;
  }

  // eagle — позиция беркута, speed — скорость вперёд, vy — вертикальная (в пике < 0), amount — 0..1 сила эффекта
  update(dt, eagle, speed, vy, amount) {
    this.material.uniforms.opacity.value = CONFIG.diveWind * amount;
    this.lines.visible = amount > 0.02;
    if (!this.lines.visible) { this.ready = false; return; }
    const fall = Math.min(1, Math.max(0, -vy / CONFIG.diveMaxFall));
    if (!this.ready) { for (const s of this.streaks) this.spawn(s, true, fall); this.ready = true; }
    _dir.set(0, -vy, speed); // воздух относительно беркута: навстречу и вверх
    const v = _dir.length() || 1;
    _dir.divideScalar(v);
    const p = this.positions;
    this.streaks.forEach((s, i) => {
      s.z += speed * dt; s.y -= vy * dt;
      if (s.z > 12 || s.y > 22) this.spawn(s, false, fall); // пролетела мимо камеры
      const len = s.k * (3 + v * 0.07), j = i * 6;
      p[j] = eagle.x + s.x; p[j + 1] = eagle.y + s.y; p[j + 2] = eagle.z + s.z;
      p[j + 3] = p[j] - _dir.x * len; p[j + 4] = p[j + 1] - _dir.y * len; p[j + 5] = p[j + 2] - _dir.z * len;
      this.fade[i * 2] = Math.min(1, (s.z + 85) / 30); // далёкие проявляются постепенно
    });
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.fade.needsUpdate = true;
  }
}
