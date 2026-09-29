// Все числа баланса игры — в одном месте. Крути их, не трогая остальной код.
export const CONFIG = {
  // скорость
  startSpeed: 55,        // м/с на старте
  speedGain: 0.8,        // прирост скорости в секунду
  maxSpeed: 150,
  idleSpeed: 22,         // скорость полёта на стартовом экране

  // мир
  chunkLen: 220,
  chunkWidth: 520,
  chunkSegX: 52,
  chunkSegZ: 22,
  chunkCount: 4,
  laneHalfWidth: 60,     // ширина «коридора», где появляются скалы

  // скалы и сложность
  rockCount: 40,
  rockSpacingStart: 24,  // расстояние между скалами в начале
  rockSpacingMin: 8,     // минимальное расстояние на высокой сложности
  rockSpacingDropPer: 250, // каждые N метров расстояние уменьшается на 1
  aimedRockChanceMax: 0.45, // доля скал, которые ставятся «на линию» игрока
  aimedRockRampDist: 4000,  // к этой дистанции доля достигает максимума

  // игрок
  eagleRadius: 1.8,
  controlRangeX: 55,
  altitudeMid: 34,
  altitudeRange: 18,
  steerResponse: 2.5,
  keyboardSpeed: 1.6,

  // биомы
  biomeEvery: 1500,      // метров на один биом
  biomeBlend: 250,       // метров на плавный переход
};

// Сколько метров между скалами на текущей дистанции
export function rockSpacing(dist) {
  return Math.max(CONFIG.rockSpacingMin, CONFIG.rockSpacingStart - dist / CONFIG.rockSpacingDropPer);
}
