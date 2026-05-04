/**
 * Sleep-cycle helpers — the math sleepyti.me popularised.
 *
 * Two assumptions, both standard in the literature and what
 * sleepyti.me uses:
 *   - It takes ~14 minutes to fall asleep ("sleep latency").
 *   - One sleep cycle is ~90 minutes; waking at the end of a cycle
 *     (rather than mid-cycle) feels less groggy.
 *
 * APIs
 *   wakeTimesFromBedtime(bedtimeMinutes) → array of suggested wake
 *     times, expressed as minutes-from-midnight (mod 1440), for
 *     4–6 cycles after fall-asleep.
 *
 *   bedtimesFromWake(wakeMinutes) → array of suggested bedtimes
 *     expressed as minutes-from-midnight, for 6→4 cycles before
 *     wake (so user picks the duration that fits).
 *
 * Inputs/outputs are in minutes-since-midnight. Wraparound at
 * 24*60 is preserved so a bedtime of 23:00 returns wake times that
 * may land in the next day's morning.
 */

export const FALL_ASLEEP_MIN = 14;
export const CYCLE_MIN = 90;
const DAY = 24 * 60;
const wrap = (m) => ((m % DAY) + DAY) % DAY;

export function wakeTimesFromBedtime(bedtimeMin) {
  const fellAsleep = bedtimeMin + FALL_ASLEEP_MIN;
  // 4 cycles = 6h, 5 cycles = 7.5h, 6 cycles = 9h. These are the
  // commonly recommended targets; anything else is groggy or excess.
  return [4, 5, 6].map((cycles) => ({
    cycles,
    hours: (cycles * CYCLE_MIN) / 60,
    wakeMin: wrap(fellAsleep + cycles * CYCLE_MIN),
  }));
}

export function bedtimesFromWake(wakeMin) {
  // Return latest-bedtime-first so the user sees the "if you have to
  // sleep less" option at the top.
  return [4, 5, 6].map((cycles) => ({
    cycles,
    hours: (cycles * CYCLE_MIN) / 60,
    bedtimeMin: wrap(wakeMin - FALL_ASLEEP_MIN - cycles * CYCLE_MIN),
  }));
}

const SLEEP_RE = /\b(sleep|rest|nap|knock\s*out|knockout|bed|crash|sack|kip|shut[-\s]*eye|siesta|hibernate|snooze)\b/i;

/**
 * Returns true if a slot looks like a sleep/rest block based on its
 * slotType or label. Used by the day view to hang sleep-cycle hints
 * off any matching slot.
 */
export function isSleepSlot(slot) {
  if (!slot) return false;
  if (slot.slotType === 'sleep') return true;
  if (typeof slot.label === 'string' && SLEEP_RE.test(slot.label)) return true;
  if (typeof slot.slotType === 'string' && SLEEP_RE.test(slot.slotType)) return true;
  return false;
}

export function fmtClock(min) {
  const m = wrap(min);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'a' : 'p';
  return mm === 0 ? `${hr}${ampm}` : `${hr}:${mm < 10 ? '0' + mm : mm}${ampm}`;
}

export function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
