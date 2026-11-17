// config.js — world geometry, districts, POIs and tuning for Solano Bay.
// One job: hold every constant the other modules agree on.

// ---- world geometry (units are world pixels at zoom 1) ----
export const ROAD_W = 30;            // road width
export const BLOCK = 128;            // block interior size
export const PITCH = BLOCK + ROAD_W; // 158 — node spacing
export const COLS = 15;              // road nodes across
export const ROWS = 15;              // road nodes down
export const WORLD_W = (COLS - 1) * PITCH;
export const WORLD_H = (ROWS - 1) * PITCH;
export const BAY_X = -70;            // water starts west of this x
export const PIER_Y_ROW = 7;         // grid row the marina pier extends from
export const PIER_LEN = 500;         // pier deck length into the bay
export const CITY_SEED = 20261117;   // fixed: the city is the same every load

// ---- districts: name, tint for minimap/ground, building palette ----
// Rectangles are in block coordinates (bx 0..13, by 0..13).
export const DISTRICTS = [
  { id: 'marina',  name: 'Marina',       bx0: 0,  by0: 5,  bx1: 3,  by1: 9,  ground: '#8d7a5e', tint: '#2e7f86' },
  { id: 'playa',   name: 'Playa',        bx0: 0,  by0: 10, bx1: 5,  by1: 13, ground: '#99835f', tint: '#d9a441' },
  { id: 'downtown',name: 'Downtown',     bx0: 6,  by0: 5,  bx1: 9,  by1: 9,  ground: '#7f6f5a', tint: '#b5523c' },
  { id: 'mercado', name: 'Mercado',      bx0: 6,  by0: 10, bx1: 10, by1: 13, ground: '#8a7050', tint: '#c96f4a' },
  { id: 'palmera', name: 'Palmera Park', bx0: 10, by0: 1,  bx1: 13, by1: 4,  ground: '#6b7f50', tint: '#4d8f4a' },
  { id: 'alto',    name: 'Alto',         bx0: 11, by0: 5,  bx1: 13, by1: 13, ground: '#847052', tint: '#7a5fa0' },
];

// Park blocks (no buildings): pond + palms, inside Palmera Park district.
export const PARK_BLOCKS = [ { bx: 10, by: 2 }, { bx: 11, by: 2 }, { bx: 10, by: 3 }, { bx: 11, by: 3 } ];

// ---- points of interest: name, district, block + lot to occupy ----
// lot: 0=NW 1=NE 2=SW 3=SE inside the block.
export const POIS = [
  { id: 'mercado-central', name: 'Mercado Central', bx: 8,  by: 11, lot: 0, color: '#c9542e' },
  { id: 'banco-del-sol',   name: 'Banco del Sol',   bx: 7,  by: 6,  lot: 1, color: '#2e7f86' },
  { id: 'hotel-paloma',    name: 'Hotel Paloma',    bx: 2,  by: 12, lot: 1, color: '#e8c07a' },
  { id: 'cine-solano',     name: 'Cine Solano',     bx: 9,  by: 12, lot: 2, color: '#8a3b5c' },
  { id: 'taller-brisa',    name: 'Taller Brisa',    bx: 12, by: 8,  lot: 0, color: '#5c7a3a' },
  { id: 'farmacia-luz',    name: 'Farmacia Luz',    bx: 8,  by: 7,  lot: 3, color: '#e6e2d5' },
  { id: 'marina-club',     name: 'Marina Club',     bx: 1,  by: 6,  lot: 2, color: '#20606e' },
  { id: 'sbpd-central',    name: 'SBPD Central',    bx: 6,  by: 5,  lot: 0, color: '#3a4a6b' },
  { id: 'mirador-cafe',    name: 'Mirador Café',    bx: 12, by: 1,  lot: 3, color: '#d9905f' },
  { id: 'almacen-gris',    name: 'Almacén Gris',    bx: 2,  by: 9,  lot: 3, color: '#6b6f75' },
];

// Generic shop signs for commercial lots (drawn on the building face).
export const SHOP_SIGNS = [
  'PANADERIA', 'JOYERIA LUZ', 'CAFE AZAHAR', 'LICORES MAR', 'BAR LA OLA',
  'TAPAS SOL', 'FLORERIA', 'PELUQUERIA', 'FERRETERIA', 'LIBRERIA SOL',
  'CARNICERIA', 'HELADERIA', 'TINTORERIA', 'ZAPATERIA', 'OPTICA MAR',
];

// Building wall palettes per district (saturated sunset tones).
export const WALLS = {
  marina:   ['#2e7f86', '#3f959b', '#c96f4a', '#e0b96f'],
  playa:    ['#e8c07a', '#d9905f', '#e6e2d5', '#c96f4a'],
  downtown: ['#b5523c', '#c96f4a', '#2e7f86', '#8a3b5c', '#d9905f'],
  mercado:  ['#c9542e', '#d9905f', '#c96f4a', '#e8c07a', '#7a9a3a'],
  palmera:  ['#7a9a3a', '#e8c07a', '#d9905f', '#3f959b'],
  alto:     ['#9a7ab5', '#c96f4a', '#e0b96f', '#5c7a3a'],
};

// ---- player / vehicle tuning ----
export const WALK_SPEED = 92;         // units/s on foot
export const SPRINT_MULT = 1.55;
export const PLAYER_R = 6;            // collision radius
export const CAR_R = 9;
export const CAR_LEN = 17, CAR_WID = 9;
export const CAR_ACCEL = 130, CAR_MAXV = 235, CAR_REVERSE = 80;
export const CAR_TURN = 2.6;          // rad/s at speed

// ---- wanted model ----
export const HEAT_MAX = 500;
export const STAR_THRESHOLDS = [40, 100, 180, 280, 400]; // heat at 1..5 stars
export const HEAT_DECAY_UNSEEN = 9;   // heat/s while police have no eyes on you
export const COPS_PER_STAR = 2;       // active pursuers ≈ stars * this (capped)
export const COP_MAX = 9;

// ---- weapons ----
export const WEAPONS = [
  { id: 'fists',  name: 'FISTS',  mag: Infinity, damage: 12, rate: 0.34, range: 20,  speed: 0,    auto: false },
  { id: 'pistol', name: 'PISTOL', mag: 12,       damage: 26, rate: 0.26, range: 340, speed: 720,  auto: false },
  { id: 'smg',    name: 'SMG',    mag: 30,       damage: 17, rate: 0.09, range: 300, speed: 780,  auto: true },
];

// ---- camera ----
export const VIEW_FOOT = 250;   // view width in units on foot
export const VIEW_DRIVE = 330;  // view width in units while driving
export const VIEW_SHOT = 300;   // view width for staged screenshots
