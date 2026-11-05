/**
 * The one sanctioned door to browser storage. Everything outside
 * services/database/** goes through here (ESLint enforces it).
 *
 *   storage.get(key) / set(key, value) / remove(key)   JSON values
 *   storage.getRaw(key) / setRaw(key, string)           plain strings
 *   storage.session.getRaw / setRaw / remove            per-tab (sessionStorage)
 *
 * Every call is try/catch'd: private mode, quota, SSR all degrade to
 * null / no-op instead of throwing.
 */

/* eslint-disable no-restricted-globals */

function area(kind) {
  try {
    const s = kind === 'session' ? sessionStorage : localStorage;
    return s || null;
  } catch (_) {
    return null;
  }
}

function makeArea(kind) {
  return {
    getRaw(key) {
      try { return area(kind)?.getItem(key) ?? null; } catch (_) { return null; }
    },
    setRaw(key, value) {
      try { area(kind)?.setItem(key, String(value)); return true; } catch (_) { return false; }
    },
    remove(key) {
      try { area(kind)?.removeItem(key); } catch (_) { /* noop */ }
    },
    get(key) {
      try {
        const raw = area(kind)?.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.error(`Error reading ${key} from ${kind} storage:`, error);
        return null;
      }
    },
    set(key, value) {
      try {
        area(kind)?.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error(`Error writing ${key} to ${kind} storage:`, error);
        return false;
      }
    },
  };
}

const local = makeArea('local');

export const storage = {
  ...local,
  session: makeArea('session'),
};

export default storage;
