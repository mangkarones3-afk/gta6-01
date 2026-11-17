// save.js — localStorage persistence: cash, mission progress,
// stats, settings. Versioned key; corrupt saves fall back to fresh.
const KEY = 'solano-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}
export function storeSave(game) {
  try {
    const d = {
      v: 1,
      cash: game.player.cash,
      missions: game.missions.serialize(),
      stats: game.wanted.stats,
      stolen: game.player.stolenCount,
    };
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
