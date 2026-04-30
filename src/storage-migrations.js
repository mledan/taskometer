/**
 * Idempotent storage-key migrations. Self-runs on import so both
 * `main.jsx` and `App.jsx` (and the test harness, via App.jsx) get
 * the migration without any caller needing to remember to invoke it.
 *
 * Each migration self-checks and no-ops if it has already run.
 */

export function runStorageMigrations() {
  if (typeof localStorage === 'undefined') return;
  try {
    const moves = [
      ['smartcircle.auth', 'taskometer.auth'],
      ['smartcircle.onboarding.done', 'taskometer.onboarding.done'],
    ];
    for (const [oldKey, newKey] of moves) {
      const v = localStorage.getItem(oldKey);
      if (v != null && localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, v);
        localStorage.removeItem(oldKey);
      }
    }
  } catch (_) {
    /* localStorage may be disabled — no-op */
  }
}

// Run on first import so callers don't have to.
runStorageMigrations();
