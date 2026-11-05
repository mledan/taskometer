/**
 * Idempotent storage-key migrations. main.jsx calls this once before the
 * first render; tests call it directly. Each migration self-checks and
 * no-ops if it has already run.
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
