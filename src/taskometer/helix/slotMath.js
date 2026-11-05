export const SNAP_MIN = 15;
export const DEFAULT_LEN_MIN = 60;
export const MIN_LEN_MIN = 15;
export const DAY_MIN = 24 * 60;

export function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function snapMin(min) { return Math.round(min / SNAP_MIN) * SNAP_MIN; }

export function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minToHHMM(min) {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function isOvernightSlot(slot) {
  return hhmmToMin(slot.endTime) <= hhmmToMin(slot.startTime);
}

/** Minutes from midnight; the end is unwrapped past 1440 for overnight blocks. */
export function slotSpan(slot) {
  const sMin = hhmmToMin(slot.startTime);
  const eRaw = hhmmToMin(slot.endTime);
  return { sMin, eMin: eRaw <= sMin ? eRaw + DAY_MIN : eRaw };
}

export function fmtMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtHr(h) {
  const base = Math.floor(h) % 24;
  const mins = Math.round((h - Math.floor(h)) * 60);
  const hr = ((base % 12) || 12);
  const ampm = base < 12 ? 'a' : 'p';
  return mins ? `${hr}:${mins < 10 ? '0' + mins : mins}${ampm}` : `${hr}${ampm}`;
}

export function fmtClock(d) {
  const h = d.getHours();
  const hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'a' : 'p';
  const m = d.getMinutes();
  return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
}

export function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}
