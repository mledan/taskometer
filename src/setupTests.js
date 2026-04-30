import '@testing-library/jest-dom'

// Mock matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// In-memory localStorage shim. The previous version of this file
// installed no-op stubs which silently swallowed every write, masking
// real bugs in storage-aware code paths (auth, onboarding, migrations).
// This shim is a deterministic, working in-memory backing store that
// behaves like the real Storage API.
const memStore = new Map();
const memLocalStorage = {
  getItem: (k) => (memStore.has(String(k)) ? memStore.get(String(k)) : null),
  setItem: (k, v) => { memStore.set(String(k), String(v)); },
  removeItem: (k) => { memStore.delete(String(k)); },
  clear: () => { memStore.clear(); },
  key: (i) => Array.from(memStore.keys())[i] ?? null,
  get length() { return memStore.size; },
};
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: memLocalStorage,
});
