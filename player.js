// player.js — беркут: управление, движение, взмахи крыльев
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createEagle } from './visuals.js';

export class Player {
  constructor(scene, dom) {
    this.mesh = createEagle();
    scene.add(this.mesh);
    this.wingL = this.mesh.userData.wingL || this.mesh.getObjectByName('wingL');
    this.wingR = this.mesh.userData.wingR || this.mesh.getObjectByName('wingR');
    this.pos = new THREE.Vector3();
    this.target = { x: 0, y: 0 }; // -1..1 по обеим осям
    this.keys = new Set();

    const onPointer = (cx, cy) => {
      this.target.x = (cx / innerWidth - 0.5) * 2;
      this.target.y = (cy / innerHeight - 0.5) * 2;
    };
    dom.addEventListener('mousemove', (e) => onPointer(e.clientX, e.clientY));
    dom.addEventListener('touchmove', (e) => { const t = e.touches[0]; onPointer(t.clientX, t.clientY); }, { passive: true });
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.reset();
  }

  reset() {
    this.pos.set(0, CONFIG.altitudeMid, 0);
    this.target.x = 0; this.target.y = 0;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;
  }

  update(dt, time, forward) {
    // клавиатура: стрелки / WASD
    const k = this.keys, v = CONFIG.keyboardSpeed * dt;
    if (k.has('ArrowLeft') || k.has('KeyA')) this.target.x -= v;
    if (k.has('ArrowRight') || k.has('KeyD')) this.target.x += v;
    if (k.has('ArrowUp') || k.has('KeyW')) this.target.y -= v;
    if (k.has('ArrowDown') || k.has('KeyS')) this.target.y += v;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -1, 1);
    this.target.y = THREE.MathUtils.clamp(this.target.y, -1, 1);

    this.pos.z -= forward;
    const tx = this.target.x * CONFIG.controlRangeX;
    const ty = CONFIG.altitudeMid - this.target.y * CONFIG.altitudeRange;
    const a = Math.min(1, dt * CONFIG.steerResponse);
    this.pos.x += (tx - this.pos.x) * a;
    this.pos.y += (ty - this.pos.y) * a;

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.z = -(tx - this.pos.x) * 0.02; // крен в повороте
    this.mesh.rotation.x = (ty - this.pos.y) * 0.02;  // тангаж

    // взмахи — просто синус, без рига
    const flap = Math.sin(time * 6) * 0.45;
    if (this.wingL) this.wingL.rotation.z = flap;
    if (this.wingR) this.wingR.rotation.z = -flap;
  }
}
