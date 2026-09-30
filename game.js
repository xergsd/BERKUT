// game.js — состояние игры, очки, выносливость, рекорд, HUD
// Режимы: 'hunt' — охота (обычная игра), 'free' — свободный полёт: без смерти, сил и очков.
import { CONFIG } from './config.js';

// Добыча по ландшафтам: сколько сил и очков даёт
const PREY = {
  marmot: { name: 'Сурок', stamina: CONFIG.marmotStamina, points: CONFIG.marmotPoints },
  keklik: { name: 'Кеклик', stamina: CONFIG.keklikStamina, points: CONFIG.keklikPoints },
  ibex: { name: 'Козлёнок', stamina: CONFIG.ibexStamina, points: CONFIG.ibexPoints },
};

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
    this.state = 'ready'; // ready (главное меню) -> playing -> over -> playing ...
    this.mode = 'hunt';
    this.paused = false;
    this.best = loadBest();
    this.onOver = null;   // (итог забега) => void — показать экран «Игра окончена»
    this.biomeName = '';
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), score: $('score'), mult: $('mult'), dist: $('dist'), best: $('best'), biome: $('biome'),
      stamina: $('stamina'), staminaFill: $('stamina-fill'), popups: $('popups'),
    };
    this.resetRun();
  }

  get free() { return this.mode === 'free'; }

  resetRun() {
    this.dist = 0;
    this.speed = CONFIG.startSpeed;
    this.score = 0;
    this.stamina = CONFIG.staminaMax;
    this.boosting = false;
    this.boostLocked = false; // полоска опустела — рывок снова только после отпускания Shift
    this.diving = false;
    this.diveLocked = true;   // пробел или клик, которым начали забег, — не пике: сначала отпустить
    this.diveSpeed = 0;       // прибавка к скорости от пике, доля
    this.diveTimer = 0;       // секунд после выхода из пике, пока добыча считается пойманной в пике
    this.exhausted = false;   // сил нет — беркут не может набрать высоту
    this.invuln = 0;          // секунд неуязвимости к земле после удара
    this.lowAlt = false;
    this.combo = 0;           // трюков подряд
    this.comboTimer = 0;
    this.nearMisses = 0;
    this.caught = { marmot: 0, keklik: 0, ibex: 0 };
    this.diveCatches = 0;
  }

  get comboMult() { return Math.min(CONFIG.comboMax, 1 + this.combo * CONFIG.comboStep); }
  // множитель очков за дистанцию
  get distMult() {
    return (this.lowAlt ? CONFIG.lowAltMult : 1) * (this.boosting ? CONFIG.boostScoreMult : 1) * this.comboMult;
  }

  start(mode = 'hunt') {
    this.resetRun();
    this.mode = mode;
    this.paused = false;
    this.state = 'playing';
  }

  // вернуться в главное меню: беркут снова кружит на фоне
  toMenu() {
    this.resetRun();
    this.paused = false;
    this.state = 'ready';
  }

  crash(reason) {
    if (this.state !== 'playing' || this.free) return;
    this.state = 'over';
    const d = Math.floor(this.dist), s = Math.floor(this.score);
    const record = s > this.best.score;
    if (record) { this.best = { score: s, dist: d }; saveBest(this.best); }
    this.onOver?.({ reason, score: s, dist: d, biome: this.biomeName, record, best: this.best,
      caught: { ...this.caught }, diveCatches: this.diveCatches, nearMisses: this.nearMisses });
  }

  // возвращает, сколько метров пролететь за этот кадр
  tick(dt, boostHeld, diveHeld = false) {
    if (this.state === 'playing') {
      if (!diveHeld) this.diveLocked = false;
      this.diving = diveHeld && !this.diveLocked;
      if (!boostHeld) this.boostLocked = false;
      this.boosting = boostHeld && !this.boostLocked && this.stamina > 0 && !this.diving;
      // пике разгоняет вперёд, после выхода прибавка тает
      this.diveSpeed = this.diving
        ? Math.min(CONFIG.diveSpeedMax, this.diveSpeed + CONFIG.diveSpeedGain * dt)
        : Math.max(0, this.diveSpeed - CONFIG.diveSpeedDecay * dt);
      this.diveTimer = this.diving ? CONFIG.diveCatchWindow : Math.max(0, this.diveTimer - dt);
      if (this.free) this.stamina = CONFIG.staminaMax; // в свободном полёте силы не кончаются
      // силы тратятся всегда, рывок — быстрее, пике — медленнее, ночью — медленнее; восполняет только добыча
      const night = Math.floor(this.dist / CONFIG.biomeEvery) % 4 === 3; // 4-й ландшафт — Ночь
      const drain = (CONFIG.staminaMax / CONFIG.staminaDrainTime) *
        (this.diving ? CONFIG.diveDrainMult : this.boosting ? CONFIG.boostDrainMult : 1) *
        (night ? CONFIG.nightDrainMult : 1);
      this.stamina -= drain * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        if (this.boosting) this.boostLocked = true;
        if (!this.exhausted) this.popup('Нет сил! Лови добычу');
      }
      this.exhausted = this.stamina <= 0;
      if (this.combo > 0 && (this.comboTimer -= dt) <= 0) this.combo = 0;
      if (this.invuln > 0) this.invuln -= dt;

      this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.speedGain * dt);
      const step = this.speed * (this.boosting ? CONFIG.boostSpeedMult : 1) * (1 + this.diveSpeed) * dt;
      this.dist += step;
      return step;
    }
    if (this.state === 'ready') return CONFIG.idleSpeed * dt;
    return 0; // over — мир замирает
  }

  // очки за пролетевшие метры; agl — высота над землёй
  scoreDistance(step, agl) {
    if (this.state !== 'playing' || this.free) return;
    this.lowAlt = agl < CONFIG.lowAlt;
    this.score += step * CONFIG.pointsPerMeter * this.distMult;
  }

  // пролёт рядом со скалой
  nearMiss() {
    if (this.state !== 'playing' || this.free) return;
    this.combo++;
    this.comboTimer = CONFIG.comboTime;
    this.nearMisses++;
    const pts = Math.round(CONFIG.nearMissPoints * this.comboMult);
    this.score += pts;
    this.popup(`Близко! +${pts}`);
  }

  // Удар о землю: отнимает силы и сжигает комбо. Возвращает false, если сил не было — это смерть.
  // hard — удар на скорости пике, отнимает больше сил
  groundHit(hard = false) {
    if (this.state !== 'playing' || this.invuln > 0) return true;
    if (this.free) { this.invuln = CONFIG.groundInvuln; return true; } // просто отскок
    if (this.exhausted) return false;
    const loss = CONFIG.groundHitStamina * (hard ? CONFIG.diveGroundMult : 1);
    this.stamina = Math.max(0, this.stamina - loss);
    this.combo = 0;
    this.invuln = CONFIG.groundInvuln;
    this.popup(`${hard ? 'Не вышел из пике!' : 'Удар о землю!'} −${loss} сил`);
    return true;
  }

  // поймана добыча (kind — ключ PREY): силы, очки и +1 к комбо; в пике или сразу после — больше очков
  catchPrey(kind = 'marmot') {
    if (this.state !== 'playing') return;
    const prey = PREY[kind], dive = this.diveTimer > 0;
    this.caught[kind]++;
    if (dive) this.diveCatches++;
    if (this.free) { this.popup(`${prey.name}!`); return; }
    this.stamina = Math.min(CONFIG.staminaMax, this.stamina + prey.stamina);
    this.exhausted = false;
    this.combo++;
    this.comboTimer = CONFIG.comboTime;
    const pts = Math.round(prey.points * this.comboMult * (dive ? CONFIG.divePreyMult : 1));
    this.score += pts;
    this.popup(dive ? `Пике! ${prey.name} +${pts}` : `${prey.name}! +${pts}`);
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
    this.biomeName = biomeName;
    e.hud.classList.toggle('hidden', !playing);
    e.hud.classList.toggle('free', this.free);
    e.score.textContent = Math.floor(this.score);
    e.dist.textContent = `${Math.floor(this.dist)} м`;
    e.best.textContent = `Рекорд: ${this.best.score} очков · ${this.best.dist} м`;
    e.biome.textContent = biomeName;

    const parts = [];
    if (this.exhausted) parts.push('без сил');
    if (this.lowAlt) parts.push('низко');
    if (this.boosting) parts.push('рывок');
    if (this.diving) parts.push('пике');
    if (this.combo > 0) parts.push(`комбо ×${this.comboMult.toFixed(1)}`);
    e.mult.textContent = playing && parts.length ? `×${this.distMult.toFixed(2).replace(/\.?0+$/, '')} · ${parts.join(' · ')}` : '';

    e.staminaFill.style.width = `${(this.stamina / CONFIG.staminaMax) * 100}%`;
    e.stamina.classList.toggle('locked', this.boostLocked);
    e.stamina.classList.toggle('low', this.stamina < CONFIG.staminaLow);
    e.stamina.classList.toggle('empty', playing && this.exhausted); // анимация не должна перебить .hidden
    e.stamina.classList.toggle('hidden', !playing || this.free);
  }
}
