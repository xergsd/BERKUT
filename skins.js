// skins.js — облик беркута: перекраска оперения. Узор перьев сохраняется: тёмные и светлые места
// исходной модели переводятся в тёмный и светлый цвет скина, золотистый затылок — в цвет акцента.
// Клюв, глаза и лапы не меняются. На характеристики облик не влияет.
import * as THREE from 'three';

// palette: [тёмный, светлый, акцент] — ими же рисуются кружки в окне «Облик»
export const SKINS = [
  { id: 'classic', name: 'Беркут', price: 0, palette: ['#514639', '#8a7055', '#87623a'] },
  { id: 'steppe', name: 'Степной', price: 300, palette: ['#7a5a36', '#e0bf86', '#f0d9a8'] },
  { id: 'dark', name: 'Тёмный', price: 500, palette: ['#15120f', '#3d3129', '#7a5a2e'] },
  { id: 'snow', name: 'Снежный', price: 800, palette: ['#b4bac2', '#ffffff', '#ffffff'] },
  { id: 'sky', name: 'Небесный', price: 1000, palette: ['#0f5e7a', '#35b3c9', '#e2b156'] },
  { id: 'gold', name: 'Золотой', price: 1500, palette: ['#b07a1a', '#ffd257', '#fff3c4'], metal: true },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, v) => { const t = clamp01((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const _c = new THREE.Color(), _dark = new THREE.Color(), _light = new THREE.Color(), _accent = new THREE.Color();
const lum = (a, i) => a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11;

export function applySkin(eagle, id) {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0];
  const u = eagle.userData;
  if (!u.skin) {
    // оперение — меши с текстурой пера; запоминаем исходные цвета и разброс яркости
    const parts = [];
    eagle.traverse((o) => {
      if (o.isMesh && o.material?.map && o.material.vertexColors && o.geometry.attributes.color)
        parts.push({ mesh: o, original: o.geometry.attributes.color.array.slice() });
    });
    let lo = Infinity, hi = -Infinity;
    for (const p of parts) for (let i = 0; i < p.original.length; i += 3) {
      const l = lum(p.original, i);
      lo = Math.min(lo, l); hi = Math.max(hi, l);
    }
    const materials = [...new Set(parts.map((p) => p.mesh.material))];
    u.skin = { parts, lo, hi, materials: materials.map((m) => ({ m, metalness: m.metalness, roughness: m.roughness, emissive: m.emissive.clone() })) };
  }
  const { parts, lo, hi, materials } = u.skin;
  _dark.set(skin.palette[0]); _light.set(skin.palette[1]); _accent.set(skin.palette[2]);
  for (const p of parts) {
    const col = p.mesh.geometry.attributes.color, a = p.original;
    if (skin.id === 'classic') col.array.set(a);
    else for (let i = 0; i < a.length; i += 3) {
      // золотистый затылок заметно «теплее» остального оперения: красный сильно больше синего
      _c.copy(_dark).lerp(_light, clamp01((lum(a, i) - lo) / (hi - lo))).lerp(_accent, smooth(0.2, 0.28, a[i] - a[i + 2]));
      col.array[i] = _c.r; col.array[i + 1] = _c.g; col.array[i + 2] = _c.b;
    }
    col.needsUpdate = true;
  }
  // золотой — с лёгким металлическим блеском и тёплым свечением (сильный металл без карты окружения темнеет),
  // остальные — как исходное перо
  for (const { m, metalness, roughness, emissive } of materials) {
    m.metalness = skin.metal ? 0.3 : metalness;
    m.roughness = skin.metal ? 0.35 : roughness;
    m.emissive.copy(skin.metal ? _c.set('#5a3a00') : emissive);
  }
}
