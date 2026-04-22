/**
 * Lightweight console telemetry for taskometer.
 *
 * Why it exists: the UI flow has a lot of moving pieces (views, composers,
 * onboarding, auto-schedule, wheels…) and we want a simple, copy-pasteable
 * transcript of what the user did so we can iterate on UX.
 *
 * Usage (from DevTools console):
 *   __tm.dump()       — print the ring buffer as a single plain-text block
 *   __tm.snapshot()   — print the current state shape (counts, flags)
 *   __tm.buffer()     — the raw in-memory entries
 *   __tm.clear()      — reset the buffer
 *
 * Every entry is also printed live with a `[tm]` tag so you can copy
 * individual lines directly from the console.
 */

const MAX_ENTRIES = 500;
const buffer = [];

const STYLE_EVT = 'color:#D4663A;font-weight:600';
const STYLE_MUTED = 'color:#8A8078';

function stamp() {
  const d = new Date();
  return d.toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function safeJson(v) {
  if (v === undefined) return '';
  if (v === null) return 'null';
  try {
    return JSON.stringify(v);
  } catch (_) {
    return String(v);
  }
}

export function log(event, data) {
  const entry = { t: stamp(), event, data: data ?? null };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  if (data === undefined || data === null) {
    // eslint-disable-next-line no-console
    console.log(`%c[tm] ${event}`, STYLE_EVT);
  } else {
    // eslint-disable-next-line no-console
    console.log(`%c[tm] ${event}`, STYLE_EVT, data);
  }
  return entry;
}

/** Snapshot the app state into a stable, tiny shape for logging. */
export function snapshotState(state) {
  if (!state) return null;
  return {
    tasks: (state.tasks || []).length,
    slots: (state.slots || []).length,
    taskTypes: (state.taskTypes || []).length,
    wheels: (state.settings?.wheels || []).length,
    rules: (state.settings?.scheduleRules || []).length,
    dayAssignments: Object.keys(state.settings?.dayAssignments || {}).length,
    dayOverrides: Object.keys(state.settings?.dayOverrides || {}).length,
    autoSchedule: state.settings?.autoSchedule !== false,
    isLoading: !!state.isLoading,
    isInitialized: !!state.isInitialized,
    hasError: !!state.error,
  };
}

function formatEntry(entry) {
  const d = entry.data;
  if (d === null || d === undefined) return `${entry.t}  ${entry.event}`;
  return `${entry.t}  ${entry.event}  ${safeJson(d)}`;
}

/**
 * Print the ring buffer as a single plain-text block suitable for
 * copy/paste into a bug report or chat message. Returns the string too.
 */
export function dump({ silent = false } = {}) {
  const text = buffer.map(formatEntry).join('\n');
  if (!silent) {
    // eslint-disable-next-line no-console
    console.log(`%c── taskometer telemetry (${buffer.length} entries) ──`, STYLE_MUTED);
    // eslint-disable-next-line no-console
    console.log(text || '(empty)');
  }
  return text;
}

export function clearBuffer() {
  buffer.length = 0;
  // eslint-disable-next-line no-console
  console.log('%c[tm] buffer cleared', STYLE_MUTED);
}

if (typeof window !== 'undefined') {
  window.__tm = {
    log,
    dump,
    snapshot: snapshotState,
    buffer: () => buffer.slice(),
    clear: clearBuffer,
  };
  // Announce once so first-time users know it's there.
  if (!window.__tm_announced) {
    // eslint-disable-next-line no-console
    console.log(
      '%c[tm] telemetry ready — run __tm.dump() in the console to copy the session log',
      STYLE_MUTED,
    );
    window.__tm_announced = true;
  }
}

export default { log, dump, snapshotState, clearBuffer };
