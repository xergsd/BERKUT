// menu.js — экраны меню: главное, «Как играть», настройки, пауза, «Игра окончена».
// Кнопки с data-act вызывают обработчики из main.js, data-go открывает другой экран, data-back — назад.

const SETTINGS_KEY = 'berkut_settings';
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { quality: s?.quality === 'low' ? 'low' : 'high', keySens: Number(s?.keySens) || 1 };
  } catch { return { quality: 'high', keySens: 1 }; }
}
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* приватный режим */ } }

import { STATS, MAX_LEVEL } from './upgrades.js';
import { SKINS } from './skins.js';
import { REGIONS, KAZAKHSTAN } from './regions.js';

const PREY_NAMES = [['marmot', 'Сурки'], ['hare', 'Зайцы'], ['ular', 'Улары'], ['keklik', 'Кеклики'],
  ['ibex', 'Козлята'], ['gerbil', 'Песчанки'], ['gazelle', 'Джейранята']];

// карта маршрута: [долгота, широта] → точка в viewBox 0 0 1000 570
const project = ([lon, lat]) => [((lon - 46) * 24).toFixed(1), ((55.8 - lat) * 37).toFixed(1)];

// 1 перо, 2 пера, 5 перьев
function feathers(n) {
  const d = n % 10, dd = n % 100;
  const word = d === 1 && dd !== 11 ? 'перо' : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'пера' : 'перьев';
  return `${n} ${word}`;
}

export class Menu {
  // handlers: hunt, free, resume, restart, menu, upgrade(id) — действия кнопок; quality(q), keySens(k) — настройки;
  // skinPreview(id), skinBuy(id), skinSelect(id), skinsClosed() — окно «Облик»
  constructor(handlers) {
    this.h = handlers;
    const $ = (id) => document.getElementById(id);
    this.root = $('ui');
    this.screens = { main: $('menu-main'), howto: $('menu-howto'), settings: $('menu-settings'), upgrades: $('menu-upgrades'), skins: $('menu-skins'), map: $('menu-map'),
      pause: $('menu-pause'), over: $('menu-over') };
    this.el = { best: $('menu-best'), keySens: $('key-sens'), overRecord: $('over-record'), overTitle: $('over-title'),
      overScore: $('over-score'), overStats: $('over-stats'), overBest: $('over-best'), overFeathers: $('over-feathers'),
      upFeathers: $('up-feathers'), upList: $('up-list'), skinFeathers: $('skin-feathers'), skinList: $('skin-list'),
      map: $('map-svg'), mapCount: $('map-count') };
    this.current = null; // открытый экран или null, если меню скрыто
    this.prev = null;    // куда вернуться из «Как играть» и настроек

    this.root.addEventListener('click', (e) => {
      const card = e.target.closest('.skin-card');
      if (card) this.h.skinPreview?.(card.dataset.skin); // примерить — и при нажатии на кнопку карточки
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.go) this.show(b.dataset.go, true);
      else if ('back' in b.dataset) this.back();
      else if (b.dataset.quality) this.setQuality(b.dataset.quality);
      else if (b.dataset.up) this.h.upgrade?.(b.dataset.up);
      else if (b.dataset.skinBuy) this.h.skinBuy?.(b.dataset.skinBuy);
      else if (b.dataset.skinSelect) this.h.skinSelect?.(b.dataset.skinSelect);
      else if (b.dataset.act) this.h[b.dataset.act]?.();
    });

    this.settings = loadSettings();
    this.el.keySens.value = String(Math.round(this.settings.keySens * 100));
    this.el.keySens.addEventListener('input', () => {
      this.settings.keySens = Number(this.el.keySens.value) / 100;
      saveSettings(this.settings);
      this.h.keySens?.(this.settings.keySens);
    });
    this.h.keySens?.(this.settings.keySens);
    this.setQuality(this.settings.quality);
  }

  setQuality(q) {
    this.settings.quality = q;
    saveSettings(this.settings);
    for (const b of this.root.querySelectorAll('[data-quality]')) b.classList.toggle('on', b.dataset.quality === q);
    this.h.quality?.(q);
  }

  // remember — запомнить текущий экран, чтобы «Назад» вернул на него
  show(name, remember = false) {
    if (this.current === 'skins' && name !== 'skins') this.h.skinsClosed?.();
    if (remember) this.prev = this.current;
    for (const [key, s] of Object.entries(this.screens)) s.classList.toggle('active', key === name);
    this.root.classList.remove('hidden');
    this.current = name;
  }

  back() {
    this.show(this.prev ?? 'main');
    this.prev = null;
  }

  hide() {
    if (this.current === 'skins') this.h.skinsClosed?.();
    this.root.classList.add('hidden');
    this.current = null;
    this.prev = null;
    document.activeElement?.blur?.(); // иначе пробел в полёте снова «нажмёт» кнопку
  }

  // Кнопки «Улучшения» с запасом перьев и окно улучшений: карточка на каждую характеристику
  setProgress(progress) {
    for (const b of this.root.querySelectorAll('button.upgrade'))
      b.innerHTML = `<span>Улучшения</span><span class="up-cost">${feathers(progress.feathers)}</span>`;
    this.el.upFeathers.textContent = progress.feathers;
    this.el.upList.innerHTML = STATS.map((s) => {
      const l = progress.level(s.id), price = progress.price(s.id);
      const dots = '●'.repeat(l) + '○'.repeat(MAX_LEVEL - l);
      const value = price === null ? s.value(l) : `${s.value(l)} → ${s.value(l + 1)}`;
      const label = price === null ? 'Максимум' : feathers(price);
      return `<div class="up-card"><div class="up-text">
          <div class="up-title">${s.name} <span class="dots">${dots}</span></div>
          <div class="up-about">${s.about} · ${value}</div></div>
        <button type="button" data-up="${s.id}" ${progress.canBuy(s.id) ? '' : 'disabled'}>${label}</button></div>`;
    }).join('');
  }

  // Окно «Облик»: карточка на каждый скин; preview — примеряемый сейчас
  setSkins(progress, preview) {
    this.el.skinFeathers.textContent = progress.feathers;
    this.el.skinList.innerHTML = SKINS.map((s) => {
      const owned = progress.ownsSkin(s.id), chosen = progress.skin === s.id;
      const status = chosen ? 'Выбран' : owned ? 'Куплен' : feathers(s.price);
      const button = chosen ? '<button type="button" disabled>Выбран ✓</button>'
        : owned ? `<button type="button" data-skin-select="${s.id}">Выбрать</button>`
        : `<button type="button" data-skin-buy="${s.id}" ${progress.feathers >= s.price ? '' : 'disabled'}>Купить</button>`;
      const swatches = s.palette.map((c) => `<i style="background:${c}"></i>`).join('');
      return `<div class="up-card skin-card${s.id === preview ? ' on' : ''}" data-skin="${s.id}">
        <div class="swatches">${swatches}</div>
        <div class="up-text"><div class="up-title">${s.name}</div><div class="up-about">${status}</div></div>${button}</div>`;
    }).join('');
  }

  // Карта маршрута: контур Казахстана, путь по кругу со стрелками, регионы — открытые золотые, остальные тусклые
  setMap(progress) {
    const pts = REGIONS.map((r) => project(r.map));
    const route = pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length], mid = [(+a[0] + +b[0]) / 2, (+a[1] + +b[1]) / 2];
      return `<path class="route" d="M${a}L${mid}L${b}" marker-mid="url(#arrow)"/>`;
    }).join('');
    const nodes = REGIONS.map((r, i) => {
      const [x, y] = pts[i], open = progress.regions.includes(r.id);
      const [tx, ty, anchor] = r.label === 'right' ? [+x + 16, +y + 5, 'start'] : [x, +y + 30, 'middle'];
      return `<g class="node${open ? ' open' : ''}"><circle cx="${x}" cy="${y}" r="9"/>
        <text x="${tx}" y="${ty}" text-anchor="${anchor}">${r.name}</text></g>`;
    }).join('');
    this.el.map.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,1 L9,5 L0,9 Z" class="arrow"/></marker></defs>
      <path class="land" d="M${KAZAKHSTAN.map(project).join('L')}Z"/>${route}${nodes}`;
    this.el.mapCount.textContent = `Открыто регионов: ${progress.regions.length} из ${REGIONS.length}`;
  }

  setBest(best) {
    this.el.best.textContent = best.score ? `Рекорд: ${best.score} очков · ${best.dist} м` : 'Рекорда пока нет';
  }

  // r — итог забега из Game.crash
  showOver(r) {
    const e = this.el;
    e.overRecord.classList.toggle('hidden', !r.record);
    e.overTitle.textContent = r.reason === 'rock' ? 'Врезался в скалу' : 'Упал без сил';
    e.overScore.textContent = r.score;
    const prey = PREY_NAMES.filter(([k]) => r.caught[k] > 0).map(([k, name]) => `${name}: ${r.caught[k]}`).join(' · ') || 'Добычи нет';
    e.overStats.innerHTML = [
      `${r.dist} м · дальше всего: ${r.biome}`,
      prey,
      `Поймано в пике: ${r.diveCatches}`,
      `Пролётов «Близко!»: ${r.nearMisses}`,
    ].map((line) => `<li>${line}</li>`).join('');
    e.overBest.textContent = `Рекорд: ${r.best.score} очков · ${r.best.dist} м`;
    e.overFeathers.textContent = `+${feathers(r.feathers)}`;
    this.show('over');
  }
}
