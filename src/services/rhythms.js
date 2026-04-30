/**
 * Rhythms — the data layer for "Build your year" mode.
 *
 * A Rhythm is a recurring time block. Unlike Wheels (which are 24-hour
 * day templates), Rhythms span the year and carry their own cadence.
 *
 *   {
 *     id,
 *     name,                    // "All-hands"
 *     color,                   // hex
 *     cadence: {
 *       kind: 'weekly' | 'biweekly' | 'monthly_nth' | 'monthly_date'
 *           | 'quarterly_week' | 'project' | 'oneoff',
 *       dayOfWeek?: 0..6,      // 0=Sun..6=Sat (weekly, biweekly, monthly_nth)
 *       nth?: 1..5 | -1,       // monthly_nth: 1st, 2nd ... 5th, or -1 for last
 *       monthDate?: 1..31,     // monthly_date
 *       weekOfQuarter?: 1..13, // quarterly_week (1 = first week of Q)
 *       anchor?: 'YYYY-MM-DD', // biweekly anchor; project/oneoff start
 *       end?: 'YYYY-MM-DD',    // project end
 *     },
 *     startTime, endTime,      // 'HH:MM' — within the day
 *     slotType?: string,       // optional category (deep, mtgs, ...)
 *   }
 *
 * Exceptions are date ranges that suppress rhythms underneath:
 *
 *   {
 *     id,
 *     type: 'vacation' | 'holiday' | 'conference' | 'sick' | 'other',
 *     label,
 *     startDate: 'YYYY-MM-DD',
 *     endDate:   'YYYY-MM-DD',
 *     color?: hex,
 *   }
 *
 * Storage is at `taskometer.rhythms` and `taskometer.exceptions` —
 * separate from the existing wheel/slot data so this module ships
 * without touching the legacy state machine.
 */

const RHYTHMS_KEY = 'taskometer.rhythms';
const EXCEPTIONS_KEY = 'taskometer.exceptions';

// ───────────────────────── localStorage CRUD ─────────────────────────

function safeRead(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function safeWrite(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (_) { /* quota / disabled */ }
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function listRhythms() { return safeRead(RHYTHMS_KEY); }
export function listExceptions() { return safeRead(EXCEPTIONS_KEY); }

export function addRhythm(rhythm) {
  const list = listRhythms();
  const r = { id: rhythm.id || genId('rhy'), ...rhythm };
  list.push(r);
  safeWrite(RHYTHMS_KEY, list);
  return r;
}

export function updateRhythm(id, patch) {
  const list = listRhythms();
  const next = list.map(r => r.id === id ? { ...r, ...patch } : r);
  safeWrite(RHYTHMS_KEY, next);
  return next.find(r => r.id === id) || null;
}

export function removeRhythm(id) {
  safeWrite(RHYTHMS_KEY, listRhythms().filter(r => r.id !== id));
}

export function addException(exc) {
  const list = listExceptions();
  const e = { id: exc.id || genId('exc'), ...exc };
  list.push(e);
  safeWrite(EXCEPTIONS_KEY, list);
  return e;
}

export function removeException(id) {
  safeWrite(EXCEPTIONS_KEY, listExceptions().filter(e => e.id !== id));
}

// ───────────────────────── date helpers ─────────────────────────

export function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export function parseYMD(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function daysBetween(a, b) {
  const A = new Date(a); A.setHours(0, 0, 0, 0);
  const B = new Date(b); B.setHours(0, 0, 0, 0);
  return Math.round((B.getTime() - A.getTime()) / 86400000);
}

function startOfMonth(y, m) { return new Date(y, m, 1); }
function endOfMonth(y, m)   { return new Date(y, m + 1, 0); }

// Return the date of the Nth occurrence of `dow` in month (y,m).
// nth is 1..5 or -1 for last.
function nthWeekdayOfMonth(y, m, dow, nth) {
  if (nth === -1) {
    const last = endOfMonth(y, m);
    const offset = (last.getDay() - dow + 7) % 7;
    return new Date(y, m, last.getDate() - offset);
  }
  const first = startOfMonth(y, m);
  const offset = (dow - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  if (day > endOfMonth(y, m).getDate()) return null; // 5th doesn't exist
  return new Date(y, m, day);
}

// ───────────────────────── occurrence engine ─────────────────────────

/**
 * Return an array of `YYYY-MM-DD` strings on which `rhythm` fires
 * within [startDate, endDate] inclusive. Pure function — no IO.
 */
export function occurrencesInRange(rhythm, startDate, endDate) {
  const start = startDate instanceof Date ? startDate : parseYMD(startDate);
  const end   = endDate instanceof Date ? endDate : parseYMD(endDate);
  if (!start || !end || end.getTime() < start.getTime()) return [];
  const cad = rhythm?.cadence || {};
  const out = [];

  switch (cad.kind) {
    case 'weekly': {
      const cur = new Date(start);
      while (cur.getTime() <= end.getTime()) {
        if (cur.getDay() === cad.dayOfWeek) out.push(ymd(cur));
        cur.setDate(cur.getDate() + 1);
      }
      break;
    }

    case 'biweekly': {
      const anchor = parseYMD(cad.anchor) || start;
      const cur = new Date(start);
      while (cur.getTime() <= end.getTime()) {
        if (cur.getDay() === cad.dayOfWeek) {
          const weeksFromAnchor = Math.floor(daysBetween(anchor, cur) / 7);
          if (weeksFromAnchor % 2 === 0) out.push(ymd(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
      break;
    }

    case 'monthly_nth': {
      // Iterate months in range and pick the nth weekday of each.
      const sY = start.getFullYear(), sM = start.getMonth();
      const eY = end.getFullYear(),   eM = end.getMonth();
      for (let y = sY, m = sM; (y < eY) || (y === eY && m <= eM); ) {
        const d = nthWeekdayOfMonth(y, m, cad.dayOfWeek, cad.nth);
        if (d && d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
          out.push(ymd(d));
        }
        m += 1;
        if (m > 11) { m = 0; y += 1; }
      }
      break;
    }

    case 'monthly_date': {
      const sY = start.getFullYear(), sM = start.getMonth();
      const eY = end.getFullYear(),   eM = end.getMonth();
      for (let y = sY, m = sM; (y < eY) || (y === eY && m <= eM); ) {
        const lastDay = endOfMonth(y, m).getDate();
        const day = Math.min(cad.monthDate, lastDay);
        const d = new Date(y, m, day);
        if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
          out.push(ymd(d));
        }
        m += 1;
        if (m > 11) { m = 0; y += 1; }
      }
      break;
    }

    case 'quarterly_week': {
      // weekOfQuarter: 1 = first week of Q (first Monday on/after Q start)
      const quarters = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11],
      ];
      const sY = start.getFullYear();
      const eY = end.getFullYear();
      for (let y = sY; y <= eY; y++) {
        for (const months of quarters) {
          const qStart = new Date(y, months[0], 1);
          // Find first Monday on/after qStart.
          const offsetToMon = (1 - qStart.getDay() + 7) % 7;
          const firstMon = new Date(y, months[0], 1 + offsetToMon);
          const target = new Date(firstMon);
          target.setDate(firstMon.getDate() + (Math.max(1, cad.weekOfQuarter) - 1) * 7);
          if (target.getTime() >= start.getTime() && target.getTime() <= end.getTime()) {
            out.push(ymd(target));
          }
        }
      }
      break;
    }

    case 'project': {
      const pStart = parseYMD(cad.anchor);
      const pEnd = parseYMD(cad.end);
      if (!pStart || !pEnd) break;
      const cur = new Date(Math.max(start.getTime(), pStart.getTime()));
      const stop = new Date(Math.min(end.getTime(), pEnd.getTime()));
      while (cur.getTime() <= stop.getTime()) {
        // Skip weekends by default for project rhythms — most projects
        // are weekday-bound. Could be made configurable later.
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) out.push(ymd(cur));
        cur.setDate(cur.getDate() + 1);
      }
      break;
    }

    case 'oneoff': {
      const d = parseYMD(cad.anchor);
      if (d && d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
        out.push(ymd(d));
      }
      break;
    }

    default:
      break;
  }

  return out;
}

/**
 * Is the given date inside any exception range?
 */
export function dateIsExcepted(dateKey, exceptions) {
  for (const e of exceptions || []) {
    if (dateKey >= e.startDate && dateKey <= e.endDate) return e;
  }
  return null;
}

/**
 * Compute a derived map of date → array of rhythm occurrences across a
 * year, honoring exceptions. The shape is:
 *   { 'YYYY-MM-DD': [{ rhythm, suppressed }, ...] }
 * `suppressed` is the exception object if the rhythm was suppressed
 * that day, else null.
 */
export function buildYearMap(year, rhythms, exceptions) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const map = new Map();
  for (const r of rhythms || []) {
    const dates = occurrencesInRange(r, start, end);
    for (const dk of dates) {
      const exc = dateIsExcepted(dk, exceptions);
      if (!map.has(dk)) map.set(dk, []);
      map.get(dk).push({ rhythm: r, suppressed: exc });
    }
  }
  return map;
}
