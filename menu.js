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

const PREY_NAMES = [['marmot', 'Сурки'], ['keklik', 'Кеклики'], ['ibex', 'Козлята']];

export class Menu {
  // handlers: hunt, free, resume, restart, menu — действия кнопок; quality(q), keySens(k) — настройки
  constructor(handlers) {
    this.h = handlers;
    const $ = (id) => document.getElementById(id);
    this.root = $('ui');
    this.screens = { main: $('menu-main'), howto: $('menu-howto'), settings: $('menu-settings'),
      pause: $('menu-pause'), over: $('menu-over') };
    this.el = { best: $('menu-best'), keySens: $('key-sens'), overRecord: $('over-record'), overTitle: $('over-title'),
      overScore: $('over-score'), overStats: $('over-stats'), overBest: $('over-best') };
    this.current = null; // открытый экран или null, если меню скрыто
    this.prev = null;    // куда вернуться из «Как играть» и настроек

    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.go) this.show(b.dataset.go, true);
      else if ('back' in b.dataset) this.back();
      else if (b.dataset.quality) this.setQuality(b.dataset.quality);
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
    this.root.classList.add('hidden');
    this.current = null;
    this.prev = null;
    document.activeElement?.blur?.(); // иначе пробел в полёте снова «нажмёт» кнопку
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
    const prey = PREY_NAMES.map(([k, name]) => `${name}: ${r.caught[k]}`).join(' · ');
    e.overStats.innerHTML = [
      `${r.dist} м · дальше всего: ${r.biome}`,
      prey,
      `Поймано в пике: ${r.diveCatches}`,
      `Пролётов «Близко!»: ${r.nearMisses}`,
    ].map((line) => `<li>${line}</li>`).join('');
    e.overBest.textContent = `Рекорд: ${r.best.score} очков · ${r.best.dist} м`;
    this.show('over');
  }
}
