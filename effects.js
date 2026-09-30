// effects.js — короткие эффекты поимки: пыль с земли или скалы, разлетающиеся перья кеклика
import * as THREE from 'three';

const DUST = 14, FEATHERS = 12;
const DUST_COLOR = { marmot: '#b89a6e', ibex: '#9aa3ab' };

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

  // Облачко пыли у сурка и козлёнка, перья у кеклика
  burst(kind, pos) {
    if (kind === 'keklik') {
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
