/**
 * Shared quick-add helpers for inline capture.
 */

export function ymd(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

/** Build a local ISO datetime for a given YYYY-MM-DD + minutes-from-midnight. */
export function isoAt(dayKey, startMin) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d, Math.floor(startMin / 60), Math.round(startMin) % 60, 0, 0);
  return dt.toISOString();
}

/**
 * Parse a quick-add string: trailing time token becomes the start time,
 * everything before it is the label. "gym 6pm", "lunch 12:30".
 */
export function parseQuickAdd(raw) {
  const text = (raw || '').trim();
  const m = text.match(/\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3] && m[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h <= 23 && min <= 59) {
      const label = text.slice(0, m.index).trim();
      if (label) return { label, startMin: h * 60 + min };
    }
  }
  return { label: text, startMin: null };
}

const WEEKDAYS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, wed: 3, thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};
const WEEKDAY_ALT = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(d, now) {
  const diff = Math.round((addDays(d, 0) - addDays(now, 0)) / 86400000);
  const short = `${DAY_SHORT[d.getDay()]} ${d.getDate()}`;
  if (diff === 0) return 'today';
  if (diff === 1) return `tomorrow · ${short}`;
  return short;
}

export function fmtDuration(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m}` : `${h} h`;
}

export function fmtTime(min) {
  const h24 = Math.floor(min / 60) % 24;
  const m = Math.round(min) % 60;
  const hr = (h24 % 12) || 12;
  return `${hr}:${m < 10 ? '0' + m : m} ${h24 < 12 ? 'am' : 'pm'}`;
}

/**
 * Parse a capture line into a task + placement hints.
 *   "Write investor update 45m"      → duration
 *   "Gym 6pm" / "Lunch at 12:30"     → start time (today unless a day is given)
 *   "Call mom tomorrow" / "fri"      → day
 *   "#deep Draft pricing page"       → tags
 * Anything it can't read stays in the title. `parts` is the chip preview.
 */
export function parseCapture(raw, now = new Date()) {
  let text = (raw || '').trim();
  const parts = [];
  const tags = [];
  let durationMin = null;
  let startMin = null;
  let date = null;
  let dateHint = null;

  const take = (re, fn) => {
    const m = text.match(re);
    if (!m) return false;
    if (fn(m) === false) return false;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`.trim();
    return true;
  };

  while (take(/(?:^|\s)#([\w-]+)(?=\s|$)/, (m) => { tags.push(m[1].toLowerCase()); }));

  take(/(?:^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?(?=\s|$)/i, (m) => {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (h < 1 || h > 12 || min > 59) return false;
    if (m[3].toLowerCase() === 'p' && h < 12) h += 12;
    if (m[3].toLowerCase() === 'a' && h === 12) h = 0;
    startMin = h * 60 + min;
  })
  || take(/(?:^|\s)at\s+(\d{1,2})(?::(\d{2}))?(?=\s|$)/i, (m) => {
    const h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (h > 23 || min > 59) return false;
    startMin = h * 60 + min;
  })
  || take(/(?:^|\s)(\d{1,2}):(\d{2})(?=\s|$)/, (m) => {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return false;
    startMin = h * 60 + min;
  })
  || take(/(?:^|\s)(?:at\s+)?(noon|midnight)(?=\s|$)/i, (m) => {
    startMin = m[1].toLowerCase() === 'noon' ? 720 : 0;
  });

  take(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)(?:\s*(\d{1,2})\s*(?:minutes?|mins?|m)?)?(?=\s|$)/i, (m) => {
    const h = parseFloat(m[1].replace(',', '.'));
    const extra = m[2] ? parseInt(m[2], 10) : 0;
    durationMin = Math.round(h * 60 + extra);
  })
  || take(/(?:^|\s)(\d+)\s*(?:minutes?|mins?|m)(?=\s|$)/i, (m) => {
    durationMin = parseInt(m[1], 10);
  });

  take(/(?:^|\s)(today|tonight|tomorrow|tmrw|tmw)(?=\s|$)/i, (m) => {
    const w = m[1].toLowerCase();
    date = addDays(now, w === 'today' || w === 'tonight' ? 0 : 1);
    if (w === 'tonight' && startMin == null) startMin = 20 * 60;
    dateHint = w;
  })
  || take(new RegExp(`(?:^|\\s)(?:on\\s+)?(next\\s+)?(${WEEKDAY_ALT})(?=\\s|$)`, 'i'), (m) => {
    const target = WEEKDAYS[m[2].toLowerCase()];
    let ahead = (target - now.getDay() + 7) % 7;
    if (ahead === 0) ahead = 7;
    if (m[1]) ahead += 7;
    date = addDays(now, ahead);
  })
  || take(/(?:^|\s)next\s+week(?=\s|$)/i, () => {
    let ahead = (1 - now.getDay() + 7) % 7;
    if (ahead === 0) ahead = 7;
    date = addDays(now, ahead);
  })
  || take(/(?:^|\s)in\s+(\d+)\s+days?(?=\s|$)/i, (m) => {
    date = addDays(now, parseInt(m[1], 10));
  })
  || take(/(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)/, (m) => {
    date = new Date(+m[1], +m[2] - 1, +m[3]);
  })
  || take(/(?:^|\s)(?:on\s+)?(\d{1,2})\/(\d{1,2})(?=\s|$)/, (m) => {
    const mo = +m[1]; const d = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    date = new Date(now.getFullYear(), mo - 1, d);
    if (date < addDays(now, 0)) date = new Date(now.getFullYear() + 1, mo - 1, d);
  });

  text = text
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:^|\s)(?:at|on|for|by|in)$/i, '')
    .replace(/^(?:at|on|for)\s+/i, '')
    .trim();

  if (durationMin) parts.push({ kind: 'duration', label: fmtDuration(durationMin) });
  if (startMin != null) parts.push({ kind: 'time', label: fmtTime(startMin) });
  if (date) parts.push({ kind: 'date', label: dateHint === 'tonight' ? 'tonight' : dayLabel(date, now) });
  for (const t of tags) parts.push({ kind: 'tag', label: `#${t}` });

  return {
    text,
    durationMin,
    startMin,
    dateKey: date ? ymd(date) : null,
    tags,
    parts,
    scheduled: startMin != null || !!date,
  };
}

/** Short clock label: 540 -> "9a", 780 -> "1p". */
export function fmtClock(min) {
  const h24 = Math.floor(min / 60) % 24;
  const m = Math.round(min) % 60;
  const hr = (h24 % 12) || 12;
  const ap = h24 < 12 ? 'a' : 'p';
  return `${hr}${m ? ':' + (m < 10 ? '0' + m : m) : ''}${ap}`;
}
