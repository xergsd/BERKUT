// Procedural wind and feather whooshes. No downloaded recordings or audio files.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ENABLED_KEY = 'berkut_sound_enabled', VOLUME_KEY = 'berkut_sound_volume';
function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* optional preference */ } }

// Also accepts OfflineAudioContext for repeatable audio checks.
export function createFlightAudioGraph(context) {
  const noise = context.createBuffer(2, Math.ceil(context.sampleRate * 4), context.sampleRate);
  let seed = 314159;
  for (let channel = 0; channel < 2; channel++) {
    const data = noise.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      low += (white - low) * 0.025;
      data[i] = white * 0.28 + low * 1.4;
    }
  }
  const source = () => {
    const node = context.createBufferSource(); node.buffer = noise; node.loop = true; return node;
  };
  const filter = (type, frequency, q = 0.5) => {
    const node = context.createBiquadFilter(); node.type = type; node.frequency.value = frequency; node.Q.value = q; return node;
  };
  const gain = () => { const node = context.createGain(); node.gain.value = 0; return node; };
  const wind = source(), feathers = source();
  const lowCut = filter('highpass', 90), windTone = filter('lowpass', 850);
  const airTone = filter('bandpass', 1400, 0.45), featherTone = filter('bandpass', 520, 0.55);
  const windGain = gain(), airGain = gain(), flapGain = gain(), master = gain();
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12; limiter.knee.value = 18; limiter.ratio.value = 4;
  limiter.attack.value = 0.005; limiter.release.value = 0.18;
  const pan = context.createStereoPanner ? context.createStereoPanner() : null;
  wind.connect(lowCut); lowCut.connect(windTone); windTone.connect(windGain);
  wind.connect(airTone); airTone.connect(airGain);
  feathers.connect(featherTone); featherTone.connect(flapGain);
  for (const node of [windGain, airGain, flapGain]) node.connect(pan || master);
  if (pan) pan.connect(master);
  master.connect(limiter); limiter.connect(context.destination);
  wind.start(); feathers.start(0, 0.731);
  const smooth = (parameter, value, time, tau) => parameter.setTargetAtTime(value, time, tau);
  let disposed = false;
  return {
    setVolume(volume, enabled = true, time = context.currentTime) {
      smooth(master.gain, enabled ? clamp(volume, 0, 1) : 0, time, 0.035);
    },
    update({ speed = 0, boosting = false, dive = 0, downstroke = 0, turn = 0, active = false }, time = context.currentTime) {
      if (disposed) return;
      const s = clamp(speed / 170, 0, 1), power = clamp(downstroke, 0, 1);
      const gust = 0.97 + 0.03 * Math.sin(time * 1.7);
      smooth(windGain.gain, active ? (0.10 + s * 0.25) * gust : 0, time, 0.15);
      smooth(airGain.gain, active ? 0.018 + s * 0.10 + (boosting ? 0.065 : 0) + dive * 0.09 : 0, time, 0.10);
      smooth(flapGain.gain, active ? power * power * 0.72 : 0, time, 0.028);
      smooth(windTone.frequency, 650 + s * 1100, time, 0.20);
      smooth(airTone.frequency, 1100 + s * 1200 + dive * 900, time, 0.20); // пике — свист выше
      smooth(featherTone.frequency, 320 + power * 650, time, 0.04);
      if (pan) smooth(pan.pan, clamp(turn, -1, 1) * 0.22, time, 0.16);
    },
    // Блеяние козлёнка: дрожащее «мэ-э». side: -1 слева .. 1 справа
    bleat(side = 0, time = context.currentTime) {
      if (disposed) return;
      const osc = context.createOscillator(), lfo = context.createOscillator(), depth = context.createGain();
      const tone = filter('bandpass', 1100, 1.2), env = context.createGain();
      const panner = context.createStereoPanner ? context.createStereoPanner() : null;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(560, time);
      osc.frequency.linearRampToValueAtTime(470, time + 0.55);
      lfo.frequency.value = 17; depth.gain.value = 35; // дрожь голоса
      lfo.connect(depth); depth.connect(osc.frequency);
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(0.22, time + 0.05);
      env.gain.setTargetAtTime(0, time + 0.35, 0.08);
      osc.connect(tone); tone.connect(env);
      if (panner) { panner.pan.value = clamp(side, -1, 1) * 0.8; env.connect(panner); panner.connect(master); }
      else env.connect(master);
      osc.start(time); lfo.start(time);
      osc.stop(time + 0.8); lfo.stop(time + 0.8);
    },
    // Поимка: свист крыльев, глухой удар и голос добычи
    catchSound(kind, time = context.currentTime) {
      if (disposed) return;
      const envelope = (node, peak, start, hold, tau) => {
        node.gain.setValueAtTime(0, start);
        node.gain.linearRampToValueAtTime(peak, start + 0.02);
        node.gain.setTargetAtTime(0, start + hold, tau);
      };
      // свист: шумовой всплеск, фильтр уходит вверх
      const rush = source(), rushTone = filter('bandpass', 700, 0.9), rushGain = context.createGain();
      rushTone.frequency.setValueAtTime(700, time);
      rushTone.frequency.exponentialRampToValueAtTime(2600, time + 0.22);
      envelope(rushGain, 0.35, time, 0.12, 0.06);
      rush.connect(rushTone); rushTone.connect(rushGain); rushGain.connect(master);
      rush.start(time, Math.random() * 3); rush.stop(time + 0.5);
      // удар
      const thud = context.createOscillator(), thudGain = context.createGain(), hit = time + 0.08;
      thud.frequency.setValueAtTime(120, hit);
      thud.frequency.exponentialRampToValueAtTime(55, hit + 0.17);
      envelope(thudGain, 0.5, hit, 0.03, 0.05);
      thud.connect(thudGain); thudGain.connect(master);
      thud.start(hit); thud.stop(hit + 0.4);
      // голос добычи
      const voice = time + 0.14;
      if (kind === 'ibex') { this.bleat(0, voice); return; }
      const calls = kind === 'keklik'
        ? [[voice, 'square', 1900, 1400, 0.07, 0.07], [voice + 0.11, 'square', 1900, 1400, 0.07, 0.07]] // «чак-чак»
        : [[voice, 'sine', 2700, 2300, 0.22, 0.15]];                                                      // свист сурка
      for (const [start, type, from, to, length, peak] of calls) {
        const osc = context.createOscillator(), g = context.createGain(), tone = filter('bandpass', (from + to) / 2, 1);
        osc.type = type;
        osc.frequency.setValueAtTime(from, start);
        osc.frequency.linearRampToValueAtTime(to, start + length);
        envelope(g, peak, start, length * 0.6, 0.03);
        osc.connect(tone); tone.connect(g); g.connect(master);
        osc.start(start); osc.stop(start + length + 0.2);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; wind.stop(); feathers.stop();
      for (const node of [wind, feathers, lowCut, windTone, airTone, featherTone, windGain, airGain, flapGain, master, limiter, pan]) {
        if (node) node.disconnect();
      }
    },
  };
}

export class FlightAudio {
  constructor() {
    this.enabled = read(ENABLED_KEY) !== 'false';
    const stored = read(VOLUME_KEY), volume = stored === null ? 0.45 : Number(stored);
    this.volume = Number.isFinite(volume) ? clamp(volume, 0, 1) : 0.45;
    this.context = null; this.graph = null; this.blocked = false;
    this.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.button = document.getElementById('sound-toggle');
    this.slider = document.getElementById('sound-volume');
    this.onToggle = () => {
      if (this.blocked) { this.enabled = true; this.blocked = false; }
      else this.enabled = !this.enabled;
      save(ENABLED_KEY, this.enabled);
      if (this.graph) this.graph.setVolume(this.volume, this.enabled);
      this.refresh(); if (this.enabled) this.unlock();
    };
    this.onVolume = () => {
      this.volume = Number(this.slider.value) / 100; save(VOLUME_KEY, this.volume);
      if (this.graph) this.graph.setVolume(this.volume, this.enabled);
      this.refresh(); this.unlock();
    };
    this.onKey = (e) => {
      if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey &&
          !e.target.closest?.('input,textarea,select,button,[contenteditable="true"]')) this.onToggle();
    };
    this.onVisibility = () => {
      if (!this.context) return;
      if (document.hidden) {
        this.graph.update({ active: false });
        this.context.suspend().catch(() => {});
      } else if (this.enabled) this.unlock();
    };
    this.button?.addEventListener('click', this.onToggle);
    this.slider?.addEventListener('input', this.onVolume);
    addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.refresh();
  }

  refresh() {
    if (this.button) {
      this.button.disabled = !this.AudioContext;
      this.button.textContent = !this.AudioContext ? 'Звук недоступен' : this.blocked ? 'Включить звук' : this.enabled ? 'Звук: вкл.' : 'Звук: выкл.';
      this.button.setAttribute('aria-pressed', String(this.enabled));
      this.button.title = 'Включить или выключить звук — M';
    }
    if (this.slider) {
      this.slider.value = String(Math.round(this.volume * 100));
      this.slider.disabled = !this.AudioContext;
      this.slider.setAttribute('aria-valuetext', `${Math.round(this.volume * 100)}%`);
    }
  }

  // Called synchronously from a click/key gesture, as required by browsers.
  async unlock() {
    if (!this.enabled || !this.AudioContext || document.hidden) return;
    try {
      if (!this.context) {
        this.context = new this.AudioContext();
        this.graph = createFlightAudioGraph(this.context);
      }
      this.graph.setVolume(this.volume, this.enabled);
      if (this.context.state !== 'running') await this.context.resume();
      this.blocked = this.context.state !== 'running';
    } catch {
      this.blocked = true;
    }
    this.refresh();
  }

  update(state) {
    if (!this.graph || this.context.state !== 'running') return;
    this.graph.update({ ...state, active: state.active && this.enabled && !document.hidden });
  }

  catchSound(kind) {
    if (!this.graph || this.context.state !== 'running' || !this.enabled || document.hidden) return;
    this.graph.catchSound(kind);
  }

  bleat(side) {
    if (!this.graph || this.context.state !== 'running' || !this.enabled || document.hidden) return;
    this.graph.bleat(side);
  }

  dispose() {
    this.button?.removeEventListener('click', this.onToggle);
    this.slider?.removeEventListener('input', this.onVolume);
    removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.graph?.dispose(); this.context?.close().catch(() => {});
  }
}
