// config.js — every tunable in one place. Solano Bay: an original
// sun-soaked coastal city at golden hour. Units are metres; the world
// origin is the city centre, the bay lies to the west.
export const SEED = 20261117;
export const WORLD = { half: 800, waterX: -640 }; // bay water west of waterX
export const ROAD_PITCH = 100;
export const LANE_W = 3.4;

// District palettes are saturated on purpose: dusk-warm walls, deep
// roofs. The first build's washed pastel (mean cover brightness 142)
// is the failure this palette answers — target ~105-125.
export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', cx: 0, cz: 0, r: 300, hMin: 26, hMax: 95,
    palette: ['#3e6f9e', '#c96f4a', '#e3d3ae', '#4f8577'], roof: '#2e3d4d', sig: 'tower' },
  { id: 'marina', name: 'Marina', cx: -560, cz: 0, r: 260, hMin: 8, hMax: 24,
    palette: ['#e2725b', '#f2ead8', '#2e8b9a', '#e8a13c'], roof: '#9a4632', sig: 'palms' },
  { id: 'oldtown', name: 'Old Town', cx: -120, cz: -520, r: 260, hMin: 6, hMax: 14,
    palette: ['#c96f3f', '#d9a441', '#a84f35', '#e0c084'], roof: '#7a3b26', sig: 'clocktower' },
  { id: 'hillside', name: 'Hillside', cx: 560, cz: -120, r: 280, hMin: 5, hMax: 9,
    palette: ['#d9b77c', '#a8a05a', '#c98a5a', '#8a9a5b'], roof: '#5f4630', sig: 'trees' },
  { id: 'harbor', name: 'Harbor', cx: 480, cz: 560, r: 280, hMin: 8, hMax: 15,
    palette: ['#9a4f3a', '#5f7184', '#7a6a58', '#b0714f'], roof: '#3c4148', sig: 'cranes' },
  { id: 'midtown', name: 'Midtown', cx: 0, cz: 0, r: 900, hMin: 12, hMax: 32,
    palette: ['#cf9457', '#b85c48', '#5f8f7a', '#e0cda3'], roof: '#54453a', sig: 'market' },
];

export const LANDMARKS = [
  { id: 'solano-tower', name: 'Solano Tower', district: 'downtown', x: 60, z: -40, h: 120 },
  { id: 'clock-tower', name: 'Old Clock Tower', district: 'oldtown', x: -140, z: -560, h: 46 },
  { id: 'harbor-cranes', name: 'Harbor Cranes', district: 'harbor', x: 560, z: 660, h: 60 },
  { id: 'observatory', name: 'Hillside Observatory', district: 'hillside', x: 660, z: -260, h: 26 },
  { id: 'market-hall', name: 'Market Hall', district: 'midtown', x: -260, z: 360, h: 18 },
];

// Named businesses. city.js pins each POI to the building nearest its
// anchor; render.js paints the sign on that building's street face.
// The first four anchors all fall inside the cover frame (F4).
export const POIS = [
  { name: 'BANCO DEL SOL', x: 30, z: 60, sign: '#1d3a5f' },
  { name: 'HOTEL PALOMA', x: 0, z: -80, sign: '#7a2e4f' },
  { name: 'CINE SOLANO', x: 150, z: 45, sign: '#8a2323' },
  { name: 'TALLER VOSS', x: -300, z: 300, sign: '#20503c' },
  { name: 'MERCADO CENTRAL', x: -260, z: 360, sign: '#96600f' },
  { name: 'CAFÉ LUMEN', x: -60, z: -420, sign: '#5f4630' },
  { name: 'IRON PALMS GYM', x: 160, z: 240, sign: '#37455a' },
  { name: 'FARMACIA SOL', x: 180, z: -160, sign: '#1f6a4a' },
  { name: 'CLUB VELERO', x: -520, z: 60, sign: '#4a2a6a' },
  { name: 'PUERTO BAR', x: 420, z: 480, sign: '#6a3a1f' },
];

export const WANTED = {
  thresholds: [0, 40, 100, 180, 280, 400], // heat at 1..5 stars
  heatMax: 500, decay: 8, loseSightDelay: 4,
  caps: [0, 2, 3, 5, 7, 9], footCaps: [0, 0, 2, 4, 6, 8],
  spawnInterval: [0, 6, 5, 4, 3, 2.5], searchTime: [0, 20, 30, 45, 60, 80],
  searchRadiusCap: [0, 80, 100, 120, 140, 160], copSpeed: [0, 0.98, 1.0, 1.02, 1.04, 1.06],
  crimes: { theft: 25, collision: 8, gunshot: 15, pedHit: 30, pedKill: 60, copRam: 50, explosion: 80, officerKill: 120 },
};

export const CARS = {
  sedan:   { name: 'Vireo Sedan',   top: 42, accel: 8.5, brake: 10, grip: 10, color: '#b83a2a' },
  sports:  { name: 'Kestrel GT',    top: 55, accel: 11.5, brake: 12, grip: 11, color: '#e8a317' },
  taxi:    { name: 'Bay Cab',       top: 40, accel: 7.5, brake: 10, grip: 10, color: '#e8c93d' },
  truck:   { name: 'Hauler',        top: 34, accel: 6, brake: 8, grip: 9, color: '#5f7184' },
  police:  { name: 'SBPD Interceptor', top: 52, accel: 11, brake: 12, grip: 11, color: '#274b8f' },
  van:     { name: 'Courier Van',   top: 38, accel: 7, brake: 9, grip: 9, color: '#8a6f4d' },
};

export const WEAPONS = {
  pistol: { name: 'P9 Pistol', damage: 34, rate: 0.22, range: 260, spread: 0.05, mag: 12, reload: 1.1, auto: false },
  smg:    { name: 'Vex SMG', damage: 18, rate: 0.09, range: 200, spread: 0.11, mag: 30, reload: 1.4, auto: true },
  shotgun:{ name: 'Boar-12', damage: 22, rate: 0.8, range: 120, spread: 0.22, mag: 6, reload: 2.0, auto: false, pellets: 6 },
};

export const PLAYER = {
  walkSpeed: 5.2, sprintSpeed: 7.4, hp: 100, radius: 6,
  carEnterRange: 26, pickupRange: 22,
};

export const TRAFFIC = { cars: 26, peds: 42, carSpeed: [9, 16], despawnR: 420, spawnR: 320 };

export const STORY = {
  hero: 'Reno Kade', contact: 'Mara Voss', crew: 'the Bay Rats',
  intro: 'Reno Kade came back to Solano Bay with a stolen sports car, a debt to the Harbor Kings, and one friend left: Mara Voss, who runs a garage on Canal Street and a plan to take the bay back.',
  pitch: 'Five jobs. One debt. Take the bay back.',
};
