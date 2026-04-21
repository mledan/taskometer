/**
 * Pure selectors — (state) → view-model.
 *
 * These functions are the *only* place where domain semantics get turned
 * into view data. Keeping them pure means:
 *   - Views never branch on storage details.
 *   - They can be unit tested without React.
 *   - Swapping the storage layer doesn't touch them.
 */

import { getSlotDuration } from '../../models/CalendarSlot';

// ---------- tiny helpers -------------------------------------------------

export function ymd(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function startOfWeek(d = new Date()) {
  const out = new Date(d);
  const day = out.getDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day; // Monday-start
  out.setDate(out.getDate() + offset);
  out.setHours(0, 0, 0, 0);
  return out;
}

function weekdayChar(d) {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
}

function parseSlotStart(slot) {
  if (!slot?.date || !slot?.startTime) return null;
  return new Date(`${slot.date}T${slot.startTime}:00`);
}
function parseSlotEnd(slot) {
  if (!slot?.date || !slot?.endTime) return null;
  const [sH] = slot.startTime.split(':').map(Number);
  const [eH] = slot.endTime.split(':').map(Number);
  let endDate = slot.date;
  if (eH < sH) {
    const next = new Date(slot.date);
    next.setDate(next.getDate() + 1);
    endDate = ymd(next);
  }
  return new Date(`${endDate}T${slot.endTime}:00`);
}

function slotTypeLabel(slot) {
  return slot.label || slot.slotType || 'block';
}

function classifyKind(label = '') {
  const l = label.toLowerCase();
  if (/deep|focus|flow|build/.test(l)) return 'hot';
  if (/sleep|rest|wind/.test(l)) return 'rest';
  if (/lunch|break/.test(l)) return 'blank';
  if (/morning|meet|mtgs|admin|calls?|errand|workout|routine/.test(l)) return 'light';
  if (/family|play|personal/.test(l)) return 'soft';
  return 'light';
}

// ---------- load ---------------------------------------------------------

/**
 * Compute today's load %:
 *   scheduled minutes on today's tasks ÷ total slot minutes today × 100.
 *
 * Clamps 0..120. With no slots today, load is 0.
 */
export function deriveLoad({ tasks = [], slots = [], date = new Date() }) {
  const dayKey = ymd(date);
  const todaySlots = slots.filter(s => s?.date === dayKey);
  const capacity = todaySlots.reduce((sum, s) => sum + (getSlotDuration(s) || 0), 0);

  if (capacity <= 0) return 0;

  const scheduled = tasks
    .filter(t => {
      if (!t?.scheduledTime) return false;
      const d = new Date(t.scheduledTime);
      return !Number.isNaN(d.getTime()) && ymd(d) === dayKey;
    })
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    .reduce((sum, t) => sum + (typeof t.duration === 'number' ? t.duration : 30), 0);

  const pct = (scheduled / capacity) * 100;
  return Math.max(0, Math.min(120, Math.round(pct)));
}

// ---------- next task ----------------------------------------------------

/**
 * "Next" task = the task being worked on now (earliest scheduled pending
 * today whose window contains now, else the next pending task by time).
 */
export function deriveNextTask({ tasks = [], now = new Date() }) {
  const pending = tasks
    .filter(t => t?.status !== 'completed' && t?.status !== 'cancelled')
    .filter(t => !!t.scheduledTime)
    .map(t => ({ t, start: new Date(t.scheduledTime).getTime() }))
    .filter(x => !Number.isNaN(x.start));

  const nowMs = now.getTime();
  pending.sort((a, b) => a.start - b.start);

  // In-progress (started but unfinished, window contains now).
  const live = pending.find(x => {
    const dur = typeof x.t.duration === 'number' ? x.t.duration : 30;
    return x.start <= nowMs && nowMs < x.start + dur * 60 * 1000;
  });
  if (live) return live.t;

  const upcoming = pending.find(x => x.start >= nowMs);
  if (upcoming) return upcoming.t;

  // No scheduled pending task — return first unscheduled pending.
  const unscheduled = tasks.find(t =>
    t?.status !== 'completed' && t?.status !== 'cancelled' && !t.scheduledTime
  );
  return unscheduled || null;
}

// ---------- pressure history --------------------------------------------

/**
 * Last 14 days of load%, with today marked `now: true`.
 *
 * Hot = load > 85 (overflow threshold matches the arc band).
 */
export function derivePressureHistory({ tasks = [], slots = [], today = new Date(), days = 14 }) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const load = deriveLoad({ tasks, slots, date: d });
    out.push({
      d: weekdayChar(d),
      h: Math.max(6, load), // minimum visible nub
      hot: load > 85,
      now: i === 0,
      date: ymd(d),
    });
  }
  return out;
}

// ---------- today timeline ----------------------------------------------

/**
 * Horizontal strip of slot blocks from 6a..11p for the gauge view.
 */
export function deriveDayTimeline({ slots = [], tasks = [], date = new Date(), now = new Date() }) {
  const dayKey = ymd(date);
  const today = slots.filter(s => s?.date === dayKey);
  if (today.length === 0) return [];

  const nowHr = sameDay(date, now) ? now.getHours() + now.getMinutes() / 60 : -1;
  return today
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(s => {
      const start = parseSlotStart(s);
      const end = parseSlotEnd(s);
      const startH = start.getHours() + start.getMinutes() / 60;
      const endH = end.getHours() + end.getMinutes() / 60 + (end.getDate() !== start.getDate() ? 24 : 0);
      const label = slotTypeLabel(s);
      return {
        id: s.id,
        label,
        start: startH,
        end: endH,
        kind: classifyKind(label),
        current: nowHr >= startH && nowHr < endH,
      };
    });
}

// ---------- wheel wedges -------------------------------------------------

/**
 * 24-hour wheel wedges: every slot becomes a wedge; unused hours fall
 * through as implicit gaps (the svg just renders what we return).
 *
 * `count` is the number of pending tasks whose scheduledTime lands inside
 * the wedge's window.
 */
export function deriveWheelWedges({ slots = [], tasks = [], date = new Date(), now = new Date() }) {
  const dayKey = ymd(date);
  const today = slots.filter(s => s?.date === dayKey);
  if (today.length === 0) return [];

  const nowHr = sameDay(date, now) ? now.getHours() + now.getMinutes() / 60 : -1;
  const wedges = today
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(s => {
      const start = parseSlotStart(s);
      const end = parseSlotEnd(s);
      const startH = start.getHours() + start.getMinutes() / 60;
      const endH = end.getHours() + end.getMinutes() / 60 + (end.getDate() !== start.getDate() ? 24 : 0);
      const label = slotTypeLabel(s);

      const count = tasks.filter(t => {
        if (!t?.scheduledTime) return false;
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        const d = new Date(t.scheduledTime);
        if (Number.isNaN(d.getTime())) return false;
        if (ymd(d) !== dayKey) return false;
        const h = d.getHours() + d.getMinutes() / 60;
        return h >= startH && h < endH;
      }).length;

      return {
        id: s.id,
        label,
        start: startH,
        end: Math.min(24, endH),
        kind: classifyKind(label),
        count: count || undefined,
        current: nowHr >= startH && nowHr < endH,
      };
    });
  return wedges;
}

// ---------- task lists for wheel + backlog ------------------------------

export function deriveNowTask({ tasks = [], date = new Date(), now = new Date() }) {
  const t = deriveNextTask({ tasks, now });
  if (!t) return null;
  if (!t.scheduledTime) return null;
  const start = new Date(t.scheduledTime).getTime();
  const dur = typeof t.duration === 'number' ? t.duration : 30;
  const end = start + dur * 60 * 1000;
  const nowMs = now.getTime();
  const inWindow = start <= nowMs && nowMs < end;
  return inWindow ? t : null;
}

export function deriveUpcoming({ tasks = [], date = new Date(), now = new Date(), limit = 3 }) {
  const dayKey = ymd(date);
  return tasks
    .filter(t =>
      t?.status !== 'completed' &&
      t?.status !== 'cancelled' &&
      t.scheduledTime &&
      ymd(new Date(t.scheduledTime)) === dayKey &&
      new Date(t.scheduledTime).getTime() > now.getTime()
    )
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
    .slice(0, limit);
}

export function derivePushed({ tasks = [], date = new Date(), limit = 3 }) {
  const todayKey = ymd(date);
  return tasks
    .filter(t =>
      t?.status === 'paused' ||
      (t?.scheduledTime && ymd(new Date(t.scheduledTime)) > todayKey && t.status !== 'completed')
    )
    .sort((a, b) => {
      const ta = a.scheduledTime ? new Date(a.scheduledTime).getTime() : Infinity;
      const tb = b.scheduledTime ? new Date(b.scheduledTime).getTime() : Infinity;
      return ta - tb;
    })
    .slice(0, limit);
}

export function deriveBacklog({ tasks = [], limit = 10 }) {
  return tasks
    .filter(t => t?.status !== 'completed' && t?.status !== 'cancelled' && !t.scheduledTime)
    .slice(0, limit);
}

// ---------- current slot + today's scheduled tasks ----------------------

/**
 * The slot currently active (now falls inside its [start, end) window).
 * Returns { id, label, slotType, color, startTime, endTime, startH, endH }
 * or null when no slot is active.
 */
export function deriveCurrentSlot({ slots = [], date = new Date(), now = new Date() }) {
  const dayKey = ymd(date);
  if (!sameDay(date, now)) return null;
  const today = slots.filter(s => s?.date === dayKey);
  const nowHr = now.getHours() + now.getMinutes() / 60;
  for (const s of today) {
    const start = parseSlotStart(s);
    const end = parseSlotEnd(s);
    if (!start || !end) continue;
    const startH = start.getHours() + start.getMinutes() / 60;
    const endH = end.getHours() + end.getMinutes() / 60 + (end.getDate() !== start.getDate() ? 24 : 0);
    if (nowHr >= startH && nowHr < endH) {
      return {
        id: s.id,
        label: slotTypeLabel(s),
        slotType: s.slotType || null,
        color: s.color || null,
        startTime: s.startTime,
        endTime: s.endTime,
        startH,
        endH,
      };
    }
  }
  return null;
}

/**
 * All pending tasks whose scheduledTime lands inside the active slot's
 * window (or whose scheduledSlotId matches it). Sorted by time.
 */
export function deriveCurrentSlotTasks({ tasks = [], slots = [], date = new Date(), now = new Date() }) {
  const slot = deriveCurrentSlot({ slots, date, now });
  if (!slot) return { slot: null, tasks: [] };

  const dayKey = ymd(date);
  const matched = tasks
    .filter(t => t?.status !== 'completed' && t?.status !== 'cancelled')
    .filter(t => {
      if (t.scheduledSlotId && t.scheduledSlotId === slot.id) return true;
      if (!t.scheduledTime) return false;
      const d = new Date(t.scheduledTime);
      if (Number.isNaN(d.getTime())) return false;
      if (ymd(d) !== dayKey) return false;
      const h = d.getHours() + d.getMinutes() / 60;
      return h >= slot.startH && h < slot.endH;
    })
    .sort((a, b) => {
      const ta = a.scheduledTime ? new Date(a.scheduledTime).getTime() : Infinity;
      const tb = b.scheduledTime ? new Date(b.scheduledTime).getTime() : Infinity;
      return ta - tb;
    });

  return { slot, tasks: matched };
}

/**
 * All non-completed tasks scheduled for today, sorted by scheduledTime.
 * Each entry carries a computed `state`: 'done' | 'live' | 'past' | 'upcoming'.
 */
export function deriveTodayTasks({ tasks = [], date = new Date(), now = new Date() }) {
  const dayKey = ymd(date);
  const nowMs = now.getTime();
  return tasks
    .filter(t => t?.status !== 'cancelled')
    .filter(t => t.scheduledTime && ymd(new Date(t.scheduledTime)) === dayKey)
    .slice()
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
    .map(t => {
      const start = new Date(t.scheduledTime).getTime();
      const dur = typeof t.duration === 'number' ? t.duration : 30;
      const end = start + dur * 60 * 1000;
      let state;
      if (t.status === 'completed') state = 'done';
      else if (start <= nowMs && nowMs < end) state = 'live';
      else if (end <= nowMs) state = 'past';
      else state = 'upcoming';
      return { task: t, state, start, end, duration: dur };
    });
}

// ---------- week fit grid -----------------------------------------------

const DEFAULT_ROWS = ['deep', 'mtgs', 'admin', 'calls', 'play'];

/**
 * Bucket each scheduled task into (row=primaryType mapped → rowIndex,
 * col=dayIndex). Returns row labels, day labels, and cell placements.
 */
export function deriveWeekFit({ tasks = [], slots = [], today = new Date() }) {
  const weekStart = startOfWeek(today);
  const dayLabels = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dayChar = d.toLocaleDateString('en', { weekday: 'short' }).charAt(0).toUpperCase();
    dayLabels.push({
      label: `${dayChar} ${d.getDate()}`,
      date: ymd(d),
      today: ymd(d) === ymd(today),
    });
  }

  const rowMap = {
    deep: 0, 'deep work': 0, focus: 0, flow: 0, build: 0,
    mtgs: 1, meetings: 1, meeting: 1, meet: 1,
    admin: 2, errand: 2, errands: 2, work: 2,
    calls: 3, call: 3, comms: 3, communication: 3,
    play: 4, personal: 4, family: 4, workout: 4, health: 4,
  };
  const resolveRow = (key = '') => {
    const k = key.toLowerCase();
    if (rowMap[k] != null) return rowMap[k];
    for (const name in rowMap) if (k.includes(name)) return rowMap[name];
    return 2; // default to "admin" bucket
  };

  const placed = [];
  const weekDates = dayLabels.map(d => d.date);
  for (const t of tasks) {
    if (!t?.scheduledTime) continue;
    if (t.status === 'completed' || t.status === 'cancelled') continue;
    const d = new Date(t.scheduledTime);
    if (Number.isNaN(d.getTime())) continue;
    const col = weekDates.indexOf(ymd(d));
    if (col < 0) continue;
    const row = resolveRow(t.primaryType || t.taskType || '');
    const isNow = weekDates[col] === ymd(today) && isInProgress(t, today);
    placed.push({
      id: t.id || t.key,
      row,
      col,
      label: truncate(t.text || t.title || 'task', 22),
      kind: isNow ? 'now' : 'routed',
    });
  }

  // Capacity: sum slot minutes across the week vs. scheduled task minutes
  const weekSlotMinutes = slots
    .filter(s => weekDates.includes(s.date))
    .reduce((sum, s) => sum + (getSlotDuration(s) || 0), 0);
  const placedMinutes = tasks
    .filter(t =>
      t?.scheduledTime &&
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      weekDates.includes(ymd(new Date(t.scheduledTime)))
    )
    .reduce((sum, t) => sum + (typeof t.duration === 'number' ? t.duration : 30), 0);

  const incomingMinutes = tasks
    .filter(t =>
      t?.status !== 'completed' &&
      t?.status !== 'cancelled' &&
      !t.scheduledTime
    )
    .reduce((sum, t) => sum + (typeof t.duration === 'number' ? t.duration : 30), 0);

  const bufferMinutes = Math.max(0, weekSlotMinutes - placedMinutes - incomingMinutes);

  return {
    rowLabels: DEFAULT_ROWS,
    dayLabels,
    placed,
    capacity: {
      slotted: minutesToHoursLabel(placedMinutes),
      incoming: minutesToHoursLabel(incomingMinutes),
      buffer: minutesToHoursLabel(bufferMinutes),
      fits: bufferMinutes >= 0,
      // Raw flex values for the capacity bar
      placedMin: placedMinutes,
      incomingMin: incomingMinutes,
      bufferMin: bufferMinutes,
    },
  };
}

// ---------- misc ---------------------------------------------------------

export function deriveStats({ tasks = [], date = new Date() }) {
  const dayKey = ymd(date);
  const today = tasks.filter(t =>
    t?.scheduledTime && ymd(new Date(t.scheduledTime)) === dayKey
  );
  const done = today.filter(t => t.status === 'completed').length;
  const pushed = tasks.filter(t => t?.status === 'paused').length;
  return { todayTotal: today.length, todayDone: done, pushed };
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isInProgress(t, now) {
  if (!t?.scheduledTime) return false;
  const start = new Date(t.scheduledTime).getTime();
  const dur = typeof t.duration === 'number' ? t.duration : 30;
  const end = start + dur * 60 * 1000;
  const nowMs = now.getTime();
  return start <= nowMs && nowMs < end;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function minutesToHoursLabel(mins) {
  if (!Number.isFinite(mins) || mins <= 0) return '0h';
  const h = mins / 60;
  if (h === Math.floor(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}
