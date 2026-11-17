// save.js — localStorage persistence. One job: write and read the run's
// progress (cash, story position, health, place) so a reload can continue.

const KEY = 'solano-bay-save-v1';

export function saveGame(S) {
  try {
    const data = {
      cash: S.player.cash,
      missionIdx: S.mission.done ? 5 : Math.max(0, S.mission.idx),
      hp: Math.round(S.player.hp),
      x: Math.round(S.player.car ? S.player.x : S.player.x),
      y: Math.round(S.player.y),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    S.hasSave = true;
  } catch (e) { /* storage unavailable: play on without saving */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.missionIdx !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
