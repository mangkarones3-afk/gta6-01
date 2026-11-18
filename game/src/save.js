// save.js — localStorage persistence. Wanted state is never saved: a load
// always starts calm (genre convention, and it keeps a save from reloading
// into a pursuit the player did not choose). Progress, cash, position and
// wanted-derived stats are what persist.

const SBSave = (() => {
  const KEY = "solano-bay-save-v1";

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      // Storage can be unavailable (private mode); the game still runs.
    }
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
  }

  function has() {
    return read() !== null;
  }

  return { write, read, clear, has };
})();

window.SBSave = SBSave;
