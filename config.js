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

  // рывок (Shift или второй палец) и выносливость
  staminaMax: 100,
  boostSpeedMult: 1.5,   // во сколько раз быстрее во время рывка
  boostScoreMult: 1.5,   // множитель очков за дистанцию во время рывка
  boostDuration: 4,      // секунд рывка с полной полоски
  staminaRefillTime: 8,  // секунд на восстановление с нуля до полной

  // очки
  pointsPerMeter: 1,
  lowAlt: 10,            // ниже стольких метров над землёй — бонус
  lowAltMult: 1.5,       // множитель очков за дистанцию в низком полёте
  nearMissGap: 6,        // пролёт в пределах N м от скалы — «Близко!»
  nearMissPoints: 100,
  comboStep: 0.5,        // каждый трюк подряд добавляет к множителю комбо
  comboMax: 4,
  comboTime: 3,          // секунд на следующий трюк, иначе комбо сгорает

  // биомы
  biomeEvery: 1500,      // метров на один биом
  biomeBlend: 250,       // метров на плавный переход
};

// Сколько метров между скалами на текущей дистанции
export function rockSpacing(dist) {
  return Math.max(CONFIG.rockSpacingMin, CONFIG.rockSpacingStart - dist / CONFIG.rockSpacingDropPer);
}
