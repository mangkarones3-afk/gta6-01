// config.js — world constants, the district table, name pools and tunables.
// One source of truth: generation, traffic, wanted and the minimap all read
// their numbers from here.

const SBConfig = {
  seed: 20261117,
  world: { minX: -40, minY: -40, maxX: 1160, maxY: 800 },
  shoreY: 800, // water fills y > shoreY, except the pier rectangle
  pier: { minX: 884, maxX: 916, minY: 800, maxY: 908 },
  boardwalkY: 770, // promenade band shoreY-30 .. shoreY, walkable, not drivable

  // Street centrelines. Vertical streets run along y, horizontal along x.
  vStreets: [
    { x: 60, cls: "local" },
    { x: 200, cls: "collector" },
    { x: 340, cls: "arterial" },
    { x: 480, cls: "collector" },
    { x: 620, cls: "arterial" },
    { x: 760, cls: "collector" },
    { x: 900, cls: "arterial" },
    { x: 1040, cls: "local" },
  ],
  hStreets: [
    { y: 60, cls: "local" },
    { y: 190, cls: "collector" },
    { y: 320, cls: "arterial" },
    { y: 450, cls: "collector" },
    { y: 580, cls: "arterial" },
    { y: 710, cls: "collector" },
  ],
  road: {
    arterial: { halfW: 10, lanes: 2, speed: 17 },
    collector: { halfW: 8, lanes: 1, speed: 13 },
    local: { halfW: 6.5, lanes: 1, speed: 10 },
  },
  sidewalk: 2.6,

  districts: [
    {
      id: "palma", name: "PALMA VERDE", rect: [-40, -40, 270, 390],
      tint: "#5d8a4a", labelAt: [110, 190],
      palette: ["#e8d8b0", "#d9a066", "#b7c9a8", "#e3b7a0", "#cfe0ea"],
      roof: "#8a5a3c", hMin: 5, hMax: 9, signShare: 0.25,
    },
    {
      id: "aurora", name: "AURORA HEIGHTS", rect: [270, -40, 830, 390],
      tint: "#7d84a8", labelAt: [545, 165],
      palette: ["#aec6d8", "#d8dee6", "#f0e6d2", "#9fb4c8", "#e8d0b0"],
      roof: "#5a6070", hMin: 26, hMax: 88, signShare: 0.8,
    },
    {
      id: "mercado", name: "EL MERCADO", rect: [830, -40, 1160, 390],
      tint: "#b07a3f", labelAt: [985, 190],
      palette: ["#e8b04b", "#d97b4f", "#f0d089", "#c95f3d", "#e8e0c8"],
      roof: "#96502e", hMin: 10, hMax: 30, signShare: 0.85,
    },
    {
      id: "viejo", name: "PUERTO VIEJO", rect: [-40, 390, 400, 800],
      tint: "#a86a5a", labelAt: [175, 590],
      palette: ["#f0c8a0", "#e8a0a8", "#a8c8b8", "#f0e0b0", "#d88868"],
      roof: "#7a4a3a", hMin: 6, hMax: 14, signShare: 0.6,
    },
    {
      id: "serena", name: "COSTA SERENA", rect: [400, 390, 830, 800],
      tint: "#c9a86a", labelAt: [610, 600],
      palette: ["#f4f1e8", "#a8d8d0", "#f0a8a0", "#f8e8c0", "#b8e0e8"],
      roof: "#c96f4a", hMin: 8, hMax: 24, signShare: 0.7,
    },
    {
      id: "dock", name: "DOCKSIDE", rect: [830, 390, 1160, 800],
      tint: "#6a7078", labelAt: [990, 590],
      palette: ["#9aa0a8", "#b0563a", "#7a8a9a", "#c8c0b0", "#5f7a8a"],
      roof: "#4a4d52", hMin: 8, hMax: 15, signShare: 0.5,
    },
  ],

  signNames: {
    palma: ["PANADERÍA LUNA", "FLORISTERÍA VERDE", "CAFÉ DEL ROBLE", "LAVANDERÍA AZUL", "TIENDA PALMA", "PELUQUERÍA SOL"],
    aurora: ["HOTEL ALBA GRANDE", "BANCO DEL SOL", "JOYERÍA REY", "CAFÉ ALBA", "TORRE OFICINAS", "GALERÍA PRISMA", "RESTAURANTE CIELO", "FARMACIA NOVA", "CINE AURORA", "LIBRERÍA FARO"],
    mercado: ["MERCADO CENTRAL", "CARNICERÍA PEPE", "PESCADERÍA MAR", "FRUTERÍA DULCE", "TALLER RÁPIDO", "ZAPATERÍA ANDAR", "PANADERÍA ORO", "BAR EL PUERTO"],
    viejo: ["BAR LA ESQUINA", "CAFÉ VIEJO", "ANTIGÜEDADES MAR", "TALLER FERRER", "HOSTAL BRISA", "VINOS DEL PUERTO", "SASTRERÍA LEÓN"],
    serena: ["HOTEL SERENA", "CHIRINGUITO SOL", "HELADERÍA BRISA", "SURF SERENA", "MARISQUERÍA PERLA", "CAFÉ DE LA PLAYA", "TIENDA ARENA"],
    dock: ["ALMACÉN MUELLE 3", "NAVAL REPARACIONES", "PESCA INDUSTRIAL", "ADUANAS SOLANO", "DEPÓSITO FRÍO", "ASTILLERO BRAVO"],
  },

  carColors: ["#c0392b", "#2471a3", "#f0f0e8", "#2e4053", "#b7950b", "#7d3c98", "#148f77", "#e67e22", "#aeb6bf", "#6e2c00", "#1a5276", "#f5b7d0"],
  carNames: ["Vireo", "Caspián", "Tornado", "Brisa", "Halcyon", "Meridian", "Picante", "Alisio"],

  wanted: {
    thresholds: [40, 100, 180, 280, 400],
    carCap: [0, 2, 3, 5, 7, 9],
    spawnInterval: [0, 6, 5, 4, 3, 2.5],
    searchTime: [0, 20, 30, 45, 60, 80],
    speedFactor: [1, 0.98, 1.0, 1.02, 1.04, 1.06],
    decayPerSec: 8,
    loseSightDelay: 4,
  },

  crimes: {
    collision: 8, theft: 25, gunshot: 15, pedHit: 30, pedKill: 60,
    copRam: 50, carDestroyed: 80, officerDown: 120,
  },
};

window.SBConfig = SBConfig;
