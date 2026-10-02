// regions.js — регионы Казахстана по маршруту полёта. Всё, чем регион отличается, — здесь:
// цвета неба и земли, рельеф, скалы, растительность, добыча и место на карте.
// Беркут облетает их по кругу: после последнего снова первый. Добавить регион — добавить запись.
//
// Поля:
//   map      — [долгота, широта] точки на карте маршрута; label — с какой стороны от точки подпись (below | right)
//   relief   — функция рельефа из world.js; strata — насколько заметны полосы пород на склонах
//   fog, skyTop, skyMid, sun — небо; ground — 4 цвета земли от низа к верху (низина, склон, скала, снег)
//   rocks    — скалы (rocks.js): color, tall (высота столбов), profile (форма столба: crag | mesa | peak),
//              bands (полосы пород), snow (снег на вершинах), moss (цвет на пологих гранях или null),
//              shelves (полки у подножия, как в Чарыне), kinds (доли арок / валунов / расколотых столбов, остальное — гребни),
//              density (плотность скал: 1 — как везде, 0.5 — вдвое реже; по умолчанию 1)
//   flora    — растительность (nature.js): grass (цвета), grassShare (доля травы), flowers, stone (цвет камней),
//              tree (leaf | pine | saxaul | null), treeSize, crown (цвет кроны), bush (цвет кустов)
//   prey     — добыча: marmot — world.js; keklik, ibex — prey.js; hare, ular, gerbil, gazelle — critters.js; null — нет
//   night    — ночной регион (звёзды, светлячки, тусклый свет, силы тают медленнее). Сейчас ночи нет.
export const REGIONS = [
  { id: 'saryarka', name: 'Сарыарка', map: [72, 48.5], relief: 'steppe', strata: 0,
    fog: '#e7c99e', skyTop: '#477ba2', skyMid: '#dfc7a6', sun: '#fff1c9',
    ground: ['#78974f', '#b2aa6b', '#8e7854', '#fff4ea'],
    rocks: { color: '#998368', tall: 25, profile: 'crag', moss: '#89905d', kinds: [0.10, 0.38, 0.72] },
    flora: { grass: ['#749342', '#99ae5f', '#b5b478', '#8b9b52'], grassShare: 1, flowers: true, stone: '#8b8a71',
      tree: 'leaf', treeSize: 1, crown: '#64834c', bush: '#718554' },
    prey: 'marmot' },

  { id: 'burabay', name: 'Бурабай', map: [70.3, 53.1], relief: 'burabay', strata: 0.2,
    fog: '#cfe0d6', skyTop: '#3f78b0', skyMid: '#bcd7dc', sun: '#fff4d8',
    ground: ['#4f7d45', '#6f8f58', '#9a8f8a', '#b8b0a6'], // вершины — серый гранит, не снег
    rocks: { color: '#a0948c', tall: 22, profile: 'crag', moss: '#6f8a55', kinds: [0.04, 0.62, 0.84] },
    flora: { grass: ['#4f7d3c', '#6a9448', '#7fa156', '#5c8a45'], grassShare: 1, flowers: true, stone: '#9a8f8a',
      tree: 'pine', treeSize: 1.3, crown: '#2f5e43', bush: '#4f6e45' },
    prey: 'hare' },

  { id: 'altai', name: 'Алтай', map: [84.0, 49.3], relief: 'altai', strata: 0.3,
    fog: '#c8d6e0', skyTop: '#335f94', skyMid: '#b0c6d6', sun: '#fff6e8',
    ground: ['#4d7348', '#5f7a5c', '#6f7880', '#ffffff'],
    rocks: { color: '#7d868c', tall: 30, profile: 'peak', snow: true, moss: '#5f7a5c', kinds: [0.02, 0.30, 0.66] },
    flora: { grass: ['#5c8a45', '#6f9a52', '#86a866', '#4f7a3c'], grassShare: 1, flowers: true, stone: '#7d868c',
      tree: 'pine', treeSize: 1.2, crown: '#2b5a45', bush: '#48664a' },
    prey: 'ular' },

  { id: 'charyn', name: 'Чарын', map: [79.1, 43.35], label: 'right', relief: 'charyn', strata: 1,
    fog: '#f2a07a', skyTop: '#6a5aa8', skyMid: '#f0806a', sun: '#ffe2b0',
    ground: ['#d9894a', '#c8603a', '#9c3d2c', '#f5d6c0'],
    rocks: { color: '#bd6945', tall: 29, profile: 'mesa', bands: true, shelves: true, kinds: [0.10, 0.38, 0.72] },
    flora: { grass: ['#ab8655', '#c4a369', '#957346'], grassShare: 1, flowers: 'dry', stone: '#ad795b',
      tree: 'leaf', treeSize: 0.55, crown: '#7d8052', bush: '#9b8d5a' },
    prey: 'keklik' },

  { id: 'tianshan', name: 'Тянь-Шань', map: [76.9, 43.0], relief: 'tianshan', strata: 0.3,
    fog: '#b9cfda', skyTop: '#386d9a', skyMid: '#a5c5d5', sun: '#fff6e8',
    ground: ['#779775', '#8d9a95', '#71828d', '#ffffff'],
    rocks: { color: '#87929b', tall: 31, profile: 'peak', snow: true, kinds: [0.10, 0.38, 0.72] },
    flora: { grass: ['#749342', '#99ae5f', '#b5b478', '#8b9b52'], grassShare: 1, flowers: true, stone: '#8b8a71',
      tree: 'pine', treeSize: 1, crown: '#386e5c', bush: '#718554' },
    prey: 'ibex' },

  { id: 'kyzylkum', name: 'Кызылкум', map: [65.5, 42.5], relief: 'desert', strata: 0.15,
    fog: '#f0d6a8', skyTop: '#4f86b8', skyMid: '#f2d9aa', sun: '#fff0c0',
    ground: ['#e3c07e', '#d9a75f', '#b98449', '#fff4ea'],
    rocks: { color: '#b88a5a', tall: 18, profile: 'mesa', bands: true, kinds: [0.06, 0.50, 0.70] },
    flora: { grass: ['#b8a46a', '#a89458', '#c9b77e'], grassShare: 0.25, flowers: false, stone: '#c49a66',
      tree: 'saxaul', treeSize: 0.5, crown: '#8a9a6a', bush: '#a39a6a' },
    prey: 'gerbil' },

  { id: 'mangystau', name: 'Мангистау', map: [54.5, 43.4], relief: 'mangystau', strata: 1,
    fog: '#eee4d4', skyTop: '#5a86b0', skyMid: '#e8dcc8', sun: '#fff4dc',
    ground: ['#d8cdb8', '#efe8dc', '#f3ede2', '#ffffff'],
    rocks: { color: '#e6ddcc', tall: 30, profile: 'mesa', bands: true, shelves: true, kinds: [0.22, 0.34, 0.70],
      density: 0.5 }, // столы огромные — иначе к стаду джейранов не подлететь
    flora: { grass: ['#b9b48a', '#c9c29a', '#a8a47a'], grassShare: 0.2, flowers: false, stone: '#d8d0c0',
      tree: null, treeSize: 0, crown: '#8a9a6a', bush: '#a8a07a' },
    prey: 'gazelle' },
];

// Контур Казахстана для карты маршрута: [долгота, широта], упрощённо
export const KAZAKHSTAN = [
  [46.6, 48.4], [46.8, 49.5], [47.5, 50.4], [48.7, 50.6], [50.0, 51.6], [51.5, 51.5], [53.0, 51.2],
  [55.0, 50.8], [57.0, 51.0], [59.0, 50.6], [60.5, 51.8], [61.5, 52.8], [62.0, 53.9], [65.0, 54.6],
  [68.0, 55.4], [70.5, 55.2], [73.5, 54.0], [76.5, 54.2], [77.8, 53.3], [80.0, 51.3], [82.0, 50.8],
  [83.5, 51.0], [85.0, 49.8], [87.3, 49.1], [85.5, 47.1], [83.0, 47.2], [82.3, 45.5], [80.2, 45.0],
  [80.3, 42.9], [79.2, 42.8], [76.0, 43.0], [74.3, 43.2], [73.5, 42.5], [71.0, 42.8], [69.0, 41.4],
  [68.2, 40.7], [66.5, 41.9], [66.0, 43.5], [64.0, 43.7], [62.0, 44.0], [61.0, 44.4], [58.5, 45.5],
  [56.0, 45.0], [56.0, 41.3], [55.0, 41.3], [53.0, 42.1], [52.8, 41.8], [52.5, 42.8], [51.3, 43.2],
  [51.0, 44.5], [50.2, 44.6], [50.3, 45.2], [51.3, 45.3], [53.0, 46.0], [53.0, 46.8], [51.2, 47.1],
  [49.2, 46.3], [47.9, 47.8],
];
