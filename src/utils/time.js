// Time utility helpers: UTC storage, local display, and YMD date keys.

export function toUTCISOString(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toISOString();
}

export function addMinutesUTC(isoOrDate, minutes) {
  const d = isoOrDate instanceof Date ? new Date(isoOrDate) : new Date(isoOrDate || Date.now());
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export function nowUTC() {
  return new Date().toISOString();
}

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

export function formatYMD(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseYMD(key) {
  const [y, m, d] = String(key || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function sameDayKey(date, key) {
  return formatYMD(date) === key;
}

export function formatDateLabel(d) {
  const wk = d.toLocaleDateString('en', { weekday: 'short' }).toLowerCase();
  const mo = d.toLocaleDateString('en', { month: 'short' }).toLowerCase();
  return `${wk} · ${mo} ${d.getDate()}`;
}

export function monthRangeFor(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return { startKey: formatYMD(new Date(y, m, 1)), endKey: formatYMD(new Date(y, m + 1, 0)) };
}

export function quarterRangeFor(date) {
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3);
  return { startKey: formatYMD(new Date(y, q * 3, 1)), endKey: formatYMD(new Date(y, q * 3 + 3, 0)) };
}

export function quarterLabel(date) {
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

export function yearRangeFor(date) {
  const y = date.getFullYear();
  return { startKey: `${y}-01-01`, endKey: `${y}-12-31` };
}

// ISO-8601 week number (Monday-first, week 1 contains Jan 4th).
export function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function formatRolloverLabel(dateKey) {
  if (!dateKey) return '';
  const date = parseYMD(dateKey);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(date);
  cmp.setHours(0, 0, 0, 0);
  const diff = Math.round((cmp.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff <= 6) return date.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
  return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
}

export function minToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hLabel = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'a' : 'p';
  return m === 0 ? `${hLabel}${ampm}` : `${hLabel}:${pad2(m)}${ampm}`;
}

// Hours until today's sleep block starts (or midnight if there isn't one).
export function hoursLeftToday(slots, dateKey, now) {
  if (!sameDayKey(now, dateKey)) return null;
  const todays = (slots || []).filter(s => s?.date === dateKey);
  if (todays.length === 0) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let cutoff = 24 * 60;
  for (const s of todays) {
    const isSleep = s.slotType === 'sleep' || /sleep/i.test(s.label || '');
    if (!isSleep) continue;
    const [h, m] = (s.startTime || '23:00').split(':').map(Number);
    const start = (h || 0) * 60 + (m || 0);
    if (start > nowMin && start < cutoff) cutoff = start;
  }
  return Math.max(0, cutoff - nowMin) / 60;
}
