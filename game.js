// game.js — состояние игры, очки, выносливость, рекорд, HUD
import { CONFIG } from './config.js';

// Рекорд — лучший по очкам забег: { score, dist }
const BEST_KEY = 'berkut_best_run';
function loadBest() {
  try {
    const b = JSON.parse(localStorage.getItem(BEST_KEY));
    return { score: Number(b?.score) || 0, dist: Number(b?.dist) || 0 };
  } catch { return { score: 0, dist: 0 }; }
}
function saveBest(v) { try { localStorage.setItem(BEST_KEY, JSON.stringify(v)); } catch { /* приватный режим и т.п. */ } }

export class Game {
  constructor() {
    this.state = 'ready'; // ready -> playing -> over -> playing ...
    this.best = loadBest();
    const $ = (id) => document.getElementById(id);
    this.el = {
      score: $('score'), mult: $('mult'), dist: $('dist'), best: $('best'), biome: $('biome'),
      stamina: $('stamina'), staminaFill: $('stamina-fill'), popups: $('popups'),
      overlay: $('overlay'), title: $('ov-title'), text: $('ov-text'),
    };
    this.resetRun();
    this.showOverlay('БЕРКУТ',
      'Клик или пробел — взлететь<br>Мышь, палец или WASD — управление<br>' +
      'Shift или второй палец — рывок');
  }

  resetRun() {
    this.dist = 0;
    this.speed = CONFIG.startSpeed;
    this.score = 0;
    this.stamina = CONFIG.staminaMax;
    this.boosting = false;
    this.boostLocked = false; // полоска опустела — рывок снова только после отпускания Shift
    this.lowAlt = false;
    this.combo = 0;           // трюков подряд
    this.comboTimer = 0;
    this.nearMisses = 0;
  }

  get comboMult() { return Math.min(CONFIG.comboMax, 1 + this.combo * CONFIG.comboStep); }
  // множитель очков за дистанцию
  get distMult() {
    return (this.lowAlt ? CONFIG.lowAltMult : 1) * (this.boosting ? CONFIG.boostScoreMult : 1) * this.comboMult;
  }

  start() {
    this.resetRun();
    this.state = 'playing';
    this.el.overlay.classList.add('hidden');
  }

  crash(reason) {
    if (this.state !== 'playing') return;
    this.state = 'over';
    const d = Math.floor(this.dist), s = Math.floor(this.score);
    const record = s > this.best.score;
    if (record) { this.best = { score: s, dist: d }; saveBest(this.best); }
    const why = reason === 'rock' ? 'Врезался в скалу' : 'Задел землю';
    this.showOverlay(record ? 'Новый рекорд!' : why,
      `${s} очков · ${d} м · трюков: ${this.nearMisses}<br>` +
      `Рекорд: ${this.best.score} очков · ${this.best.dist} м<br>Клик или пробел — ещё раз`);
  }

  showOverlay(title, html) {
    this.el.title.textContent = title;
    this.el.text.innerHTML = html;
    this.el.overlay.classList.remove('hidden');
  }

  // возвращает, сколько метров пролететь за этот кадр
  tick(dt, boostHeld) {
    if (this.state === 'playing') {
      if (!boostHeld) this.boostLocked = false;
      this.boosting = boostHeld && !this.boostLocked && this.stamina > 0;
      if (this.boosting) {
        this.stamina -= (CONFIG.staminaMax / CONFIG.boostDuration) * dt;
        if (this.stamina <= 0) { this.stamina = 0; this.boostLocked = true; }
      } else {
        this.stamina = Math.min(CONFIG.staminaMax, this.stamina + (CONFIG.staminaMax / CONFIG.staminaRefillTime) * dt);
      }
      if (this.combo > 0 && (this.comboTimer -= dt) <= 0) this.combo = 0;

      this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.speedGain * dt);
      const step = this.speed * (this.boosting ? CONFIG.boostSpeedMult : 1) * dt;
      this.dist += step;
      return step;
    }
    if (this.state === 'ready') return CONFIG.idleSpeed * dt;
    return 0; // over — мир замирает
  }

  // очки за пролетевшие метры; agl — высота над землёй
  scoreDistance(step, agl) {
    if (this.state !== 'playing') return;
    this.lowAlt = agl < CONFIG.lowAlt;
    this.score += step * CONFIG.pointsPerMeter * this.distMult;
  }

  // пролёт рядом со скалой
  nearMiss() {
    if (this.state !== 'playing') return;
    this.combo++;
    this.comboTimer = CONFIG.comboTime;
    this.nearMisses++;
    const pts = Math.round(CONFIG.nearMissPoints * this.comboMult);
    this.score += pts;
    this.popup(`Близко! +${pts}`);
  }

  popup(text) {
    const d = document.createElement('div');
    d.className = 'popup';
    d.textContent = text;
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  updateHud(biomeName) {
    const e = this.el, playing = this.state === 'playing';
    e.score.textContent = Math.floor(this.score);
    e.dist.textContent = `${Math.floor(this.dist)} м`;
    e.best.textContent = `Рекорд: ${this.best.score} очков · ${this.best.dist} м`;
    e.biome.textContent = biomeName;

    const parts = [];
    if (this.lowAlt) parts.push('низко');
    if (this.boosting) parts.push('рывок');
    if (this.combo > 0) parts.push(`комбо ×${this.comboMult.toFixed(1)}`);
    e.mult.textContent = playing && parts.length ? `×${this.distMult.toFixed(2).replace(/\.?0+$/, '')} · ${parts.join(' · ')}` : '';

    e.staminaFill.style.width = `${(this.stamina / CONFIG.staminaMax) * 100}%`;
    e.stamina.classList.toggle('locked', this.boostLocked);
    e.stamina.classList.toggle('hidden', !playing);
  }
}
