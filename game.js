// game.js — состояние игры, счёт, рекорд, HUD
import { CONFIG } from './config.js';

const BEST_KEY = 'berkut_best';
function loadBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
function saveBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* приватный режим и т.п. */ } }

export class Game {
  constructor() {
    this.state = 'ready'; // ready -> playing -> over -> playing ...
    this.best = loadBest();
    this.el = {
      dist: document.getElementById('dist'),
      best: document.getElementById('best'),
      biome: document.getElementById('biome'),
      overlay: document.getElementById('overlay'),
      title: document.getElementById('ov-title'),
      text: document.getElementById('ov-text'),
    };
    this.resetRun();
    this.showOverlay('БЕРКУТ', 'Клик или пробел — взлететь<br>Мышь, палец или WASD — управление');
  }

  resetRun() {
    this.dist = 0;
    this.speed = CONFIG.startSpeed;
  }

  start() {
    this.resetRun();
    this.state = 'playing';
    this.el.overlay.classList.add('hidden');
  }

  crash(reason) {
    if (this.state !== 'playing') return;
    this.state = 'over';
    const d = Math.floor(this.dist);
    const record = d > this.best;
    if (record) { this.best = d; saveBest(d); }
    const why = reason === 'rock' ? 'Врезался в скалу' : 'Задел землю';
    this.showOverlay(record ? 'Новый рекорд!' : why,
      `${d} м · рекорд ${this.best} м<br>Клик или пробел — ещё раз`);
  }

  showOverlay(title, html) {
    this.el.title.textContent = title;
    this.el.text.innerHTML = html;
    this.el.overlay.classList.remove('hidden');
  }

  // возвращает, сколько метров пролететь за этот кадр
  tick(dt) {
    if (this.state === 'playing') {
      this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.speedGain * dt);
      const step = this.speed * dt;
      this.dist += step;
      return step;
    }
    if (this.state === 'ready') return CONFIG.idleSpeed * dt;
    return 0; // over — мир замирает
  }

  updateHud(biomeName) {
    this.el.dist.textContent = `${Math.floor(this.dist)} м`;
    this.el.best.textContent = `Рекорд: ${this.best} м`;
    this.el.biome.textContent = biomeName;
  }
}
