// touch.js — управление на телефоне: джойстик на левой половине экрана, кнопки «Рывок» и «Пике» справа,
// подсказки при первом запуске. Включается только на сенсорных экранах (html.touch).

export const IS_TOUCH = matchMedia('(pointer: coarse)').matches; // основной ввод — палец (телефон, планшет)

const TIPS_KEY = 'berkut_touch_tips';

export class TouchControls {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.root = $('touch');
    this.zone = $('stick-zone');
    this.base = $('stick');
    this.knob = $('stick-knob');
    this.stick = { x: 0, y: 0 }; // -1..1 — отклонение джойстика
    this.held = false;           // палец на джойстике
    this.boost = false;
    this.dive = false;
    this.id = null;              // какой палец ведёт джойстик
    this.ox = 0; this.oy = 0;    // где палец коснулся — центр джойстика

    // preventDefault: иначе браузер следом пришлёт «мышиные» события, и беркут прыгнет под палец
    this.zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.id !== null) return;
      const t = e.changedTouches[0];
      this.id = t.identifier; this.ox = t.clientX; this.oy = t.clientY;
      this.base.style.left = `${t.clientX}px`; this.base.style.top = `${t.clientY}px`;
      this.base.classList.add('on');
      this.knob.style.transform = '';
      this.held = true;
    }, { passive: false });
    this.zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = Array.from(e.changedTouches).find((touch) => touch.identifier === this.id);
      if (!t) return;
      const r = this.base.offsetWidth / 2;
      let x = t.clientX - this.ox, y = t.clientY - this.oy;
      const d = Math.hypot(x, y);
      if (d > r) { x *= r / d; y *= r / d; }
      this.knob.style.transform = `translate(${x}px, ${y}px)`;
      this.stick.x = x / r; this.stick.y = y / r;
    }, { passive: false });
    const end = (e) => {
      if (!Array.from(e.changedTouches).some((t) => t.identifier === this.id)) return;
      this.releaseStick();
    };
    this.zone.addEventListener('touchend', end);
    this.zone.addEventListener('touchcancel', end);

    this.hold($('btn-boost'), (on) => { this.boost = on; });
    this.hold($('btn-dive'), (on) => { this.dive = on; });
  }

  // кнопка работает, пока на ней палец
  hold(el, set) {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('held'); set(true); }, { passive: false });
    const up = (e) => { if (e.touches && Array.from(e.touches).some((t) => t.target === el)) return; el.classList.remove('held'); set(false); };
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault()); // долгое нажатие — не меню
  }

  releaseStick() {
    this.id = null; this.held = false;
    this.stick.x = 0; this.stick.y = 0;
    this.base.classList.remove('on');
  }

  // в меню и на паузе управление скрыто — и всё отпущено
  setVisible(on) {
    if (this.root.classList.contains('hidden') !== on) return;
    this.root.classList.toggle('hidden', !on);
    if (!on) {
      this.releaseStick();
      this.boost = this.dive = false;
      for (const b of this.root.querySelectorAll('.held')) b.classList.remove('held');
    }
  }
}

// Три подсказки при первом полёте: полёт, пике, рывок. Игра стоит, следующая — по касанию.
const TIPS = [
  { title: 'Полёт', text: 'Зажми палец на левой половине экрана и веди — беркут полетит туда', target: 'stick-zone' },
  { title: 'Пике', text: 'Держи, чтобы нырнуть за добычей. Добыча, пойманная в пике, — очки ×2', target: 'btn-dive' },
  { title: 'Рывок', text: 'Держи, чтобы лететь быстрее. Рывок тратит силы — следи за полоской внизу', target: 'btn-boost' },
];

export class TouchTips {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.root = $('tips');
    this.ring = $('tips-ring');
    this.title = $('tips-title');
    this.text = $('tips-text');
    this.step = -1;
    this.onDone = null;
    this.root.addEventListener('click', () => this.next());
    addEventListener('resize', () => { if (this.step >= 0) this.place(); });
  }

  get seen() { try { return localStorage.getItem(TIPS_KEY) === '1'; } catch { return false; } }

  start(onDone) {
    this.onDone = onDone;
    this.step = -1;
    this.root.classList.remove('hidden');
    this.next();
  }

  next() {
    this.step++;
    if (this.step >= TIPS.length) {
      this.root.classList.add('hidden');
      this.step = -1;
      try { localStorage.setItem(TIPS_KEY, '1'); } catch { /* приватный режим */ }
      this.onDone?.();
      return;
    }
    const tip = TIPS[this.step];
    this.title.textContent = tip.title;
    this.text.textContent = tip.text;
    this.root.dataset.step = String(this.step);
    this.place();
  }

  // кольцо вокруг кнопки; для джойстика — там, где обычно лежит большой палец
  place() {
    const tip = TIPS[this.step], r = document.getElementById(tip.target).getBoundingClientRect();
    const box = tip.target === 'stick-zone'
      ? { x: r.left + r.width * 0.32, y: r.top + r.height * 0.68, size: Math.min(innerWidth, innerHeight) * 0.38 }
      : { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width + 24 };
    Object.assign(this.ring.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.size}px`, height: `${box.size}px` });
  }
}
