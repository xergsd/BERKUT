// upgrades.js — прокачка беркута за золотые перья (и купленные за них скины — см. skins.js).
// Очки забега превращаются в перья. В окне «Улучшения» игрок сам выбирает, что прокачать;
// у каждой характеристики 5 уровней. Уровень 0 — слабее прежнего беркута, 5 — сильнее.
// Характеристики записываются прямо в CONFIG — остальной код читает их оттуда как обычно.
import { CONFIG } from './config.js';
import { SKINS } from './skins.js';
import { REGIONS } from './regions.js';

const KEY = 'berkut_progress';
export const MAX_LEVEL = 5;

// параметр CONFIG: [улучшение, значение на уровне 0, на уровне 5]; между ними — поровну
const RANGE = {
  staminaDrainTime: ['stamina', 16, 42],  // секунд до нуля сил
  boostSpeedMult: ['boost', 1.25, 1.7],   // ускорение рывка...
  boostDrainMult: ['boost', 6, 2.5],      // ...и во сколько раз быстрее он тратит силы
  steerResponse: ['wings', 1.6, 3.4],     // повороты и набор высоты
  diveMaxFall: ['dive', 50, 88],          // м/с — предельная скорость пике
  clawMult: ['claws', 0.7, 1.3],          // радиус захвата и силы от добычи
};
function valueAt(key, level) {
  const [, from, to] = RANGE[key];
  return from + (to - from) * level / MAX_LEVEL;
}

// что показывать в окне: название, что даёт, значение на уровне
export const STATS = [
  { id: 'stamina', name: 'Выносливость', about: 'Дольше хватает сил',
    value: (l) => `${Math.round(valueAt('staminaDrainTime', l))} с` },
  { id: 'boost', name: 'Рывок', about: 'Рывок быстрее и тратит меньше сил',
    value: (l) => `×${valueAt('boostSpeedMult', l).toFixed(2).replace(/0$/, '').replace('.', ',')}` },
  { id: 'wings', name: 'Крылья', about: 'Быстрее повороты и набор высоты',
    value: (l) => `${Math.round(valueAt('steerResponse', l) / valueAt('steerResponse', 0) * 100)}%` },
  { id: 'dive', name: 'Пике', about: 'Быстрее падение в пике',
    value: (l) => `${Math.round(valueAt('diveMaxFall', l))} м/с` },
  { id: 'claws', name: 'Когти', about: 'Шире захват, больше сил от добычи',
    value: (l) => `${Math.round(valueAt('clawMult', l) * 100)}%` },
];

function load() {
  const levels = Object.fromEntries(STATS.map((s) => [s.id, 0]));
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    for (const s of STATS) levels[s.id] = Math.min(MAX_LEVEL, Math.max(0, Math.floor(Number(p?.levels?.[s.id]) || 0)));
    const skins = ['classic', ...(Array.isArray(p?.skins) ? p.skins : [])].filter((id, i, a) => SKINS.some((s) => s.id === id) && a.indexOf(id) === i);
    const skin = skins.includes(p?.skin) ? p.skin : 'classic';
    const first = REGIONS[0].id; // старт маршрута открыт всегда
    const regions = [first, ...(Array.isArray(p?.regions) ? p.regions : [])].filter((id, i, a) => REGIONS.some((r) => r.id === id) && a.indexOf(id) === i);
    return { feathers: Math.max(0, Math.floor(Number(p?.feathers) || 0)), levels, skins, skin, regions };
  } catch { return { feathers: 0, levels, skins: ['classic'], skin: 'classic', regions: [REGIONS[0].id] }; }
}

export class Progress {
  constructor() {
    // feathers — золотые перья, levels — уровень каждой характеристики, skins — купленные скины, skin — выбранный,
    // regions — регионы, до которых беркут уже долетал (карта маршрута)
    Object.assign(this, load());
    this.apply();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ feathers: this.feathers, levels: this.levels, skins: this.skins, skin: this.skin, regions: this.regions })); }
    catch { /* приватный режим */ }
  }

  level(id) { return this.levels[id]; }
  // цена следующего уровня; null — уже максимум
  price(id) { return this.levels[id] >= MAX_LEVEL ? null : CONFIG.upgradePrices[this.levels[id]]; }
  canBuy(id) { const p = this.price(id); return p !== null && this.feathers >= p; }

  // очки забега → перья; возвращает, сколько начислено
  earn(score) {
    const n = Math.floor(score / CONFIG.pointsPerFeather);
    this.feathers += n;
    this.save();
    return n;
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.feathers -= this.price(id);
    this.levels[id]++;
    this.save();
    this.apply();
    return true;
  }

  // впервые долетел до региона — открыть на карте; true, если он новый
  discover(id) {
    if (this.regions.includes(id)) return false;
    this.regions.push(id);
    this.save();
    return true;
  }

  ownsSkin(id) { return this.skins.includes(id); }

  // купленный скин сразу становится выбранным
  buySkin(id) {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin || this.ownsSkin(id) || this.feathers < skin.price) return false;
    this.feathers -= skin.price;
    this.skins.push(id);
    this.skin = id;
    this.save();
    return true;
  }

  selectSkin(id) {
    if (!this.ownsSkin(id)) return false;
    this.skin = id;
    this.save();
    return true;
  }

  apply() {
    for (const key of Object.keys(RANGE)) CONFIG[key] = valueAt(key, this.levels[RANGE[key][0]]);
  }
}
