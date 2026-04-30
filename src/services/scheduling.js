/**
 * Forward-rolling scheduler. Given a task's type + duration and the
 * current state, decide where the task should land — today's preferred
 * slot, today's other matching slot, tomorrow's matching slot, or a
 * rhythm projection further out.
 *
 * Replaces the old "clamp to today's slot end" behavior that produced
 * overlapping tasks when a block filled up. Now we walk forward up to
 * `lookAheadDays` looking for a real fit. Rhythms are evaluated even
 * if their concrete slot doesn't exist yet — the caller materializes
 * the slot once a target is chosen.
 *
 * Pure function. No IO. The caller (Taskometer.jsx) is responsible for
 * api.slots.add() if we return a 'rhythm' kind target.
 */

import { listRhythms, listExceptions, dateIsExcepted, occurrencesInRange, parseYMD } from './rhythms.js';

const DAY_MIN = 24 * 60;

function ymdHelper(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function slotDurationMin(startTime, endTime) {
  const s = hhmmToMin(startTime);
  let e = hhmmToMin(endTime);
  if (e <= s) e += DAY_MIN;
  return e - s;
}

/**
 * Where in `slot` could a task of `duration` minutes start without
 * extending past slot end? Returns `{ startMin }` or null if it
 * doesn't fit.
 *
 * Existing tasks in the slot block off time. We pick the earliest
 * minute past the latest-ending existing task.
 */
function tryFitInSlot(slot, tasks, duration) {
  const slotStart = hhmmToMin(slot.startTime);
  let slotEnd = hhmmToMin(slot.endTime);
  if (slotEnd <= slotStart) slotEnd += DAY_MIN;

  const inSlot = tasks.filter(t => {
    if (t.scheduledSlotId === slot.id) return true;
    if (!t.scheduledTime) return false;
    const ts = new Date(t.scheduledTime);
    if (ymdHelper(ts) !== slot.date) return false;
    const m = ts.getHours() * 60 + ts.getMinutes();
    return m >= slotStart && m < slotEnd;
  });

  let nextMin = slotStart;
  for (const t of inSlot) {
    const ts = new Date(t.scheduledTime);
    const start = ts.getHours() * 60 + ts.getMinutes();
    const end = start + (t.duration || 30);
    if (end > nextMin) nextMin = end;
  }

  if (nextMin + duration <= slotEnd) return { startMin: nextMin };
  return null;
}

/**
 * Find a place for a task. Returns:
 *   { kind: 'concrete', slot, date, startMin }      — existing slot has room
 *   { kind: 'rhythm', rhythm, slotShape, date, startMin } — materialize a rhythm slot
 *   null                                             — give up; caller falls back
 *
 * Search order:
 *   1. preferSlotId (the wedge the user clicked, if it has room)
 *   2. Each day from preferDate forward, up to lookAheadDays:
 *      a. Concrete slots whose slotType matches taskType
 *      b. Rhythms projecting on that day with matching slotType
 *   3. If no type filter applies, any matching slot/rhythm.
 *
 * Excepted days (vacation, holiday, conference, sick) are skipped
 * automatically.
 */
export function findScheduleTarget({
  taskType,
  duration = 30,
  state,
  preferDate,
  preferSlotId = null,
  lookAheadDays = 60,
  rhythms,
  exceptions,
}) {
  const slots = state?.slots || [];
  const tasks = (state?.tasks || []).filter(t => t?.status !== 'cancelled');
  const rhythmList = rhythms || listRhythms();
  const exceptionList = exceptions || listExceptions();
  const triedSlotIds = new Set();

  // 1. Preferred slot first.
  if (preferSlotId) {
    const slot = slots.find(s => s.id === preferSlotId);
    if (slot) {
      triedSlotIds.add(slot.id);
      const fit = tryFitInSlot(slot, tasks, duration);
      if (fit) return { kind: 'concrete', slot, date: slot.date, startMin: fit.startMin };
    }
  }

  const startDate = parseYMD(preferDate);
  if (!startDate) return null;

  // 2. Walk forward day by day.
  for (let off = 0; off < lookAheadDays; off++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + off);
    const dateKey = ymdHelper(d);

    if (dateIsExcepted(dateKey, exceptionList)) continue;

    const daySlots = slots
      .filter(s => s.date === dateKey)
      .slice()
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Concrete slots — matching type first, then unspecified.
    const matchingConcrete = taskType
      ? daySlots.filter(s => s.slotType === taskType)
      : daySlots;
    for (const slot of matchingConcrete) {
      if (triedSlotIds.has(slot.id)) continue;
      triedSlotIds.add(slot.id);
      const fit = tryFitInSlot(slot, tasks, duration);
      if (fit) return { kind: 'concrete', slot, date: dateKey, startMin: fit.startMin };
    }

    // Rhythms projecting on this day. Skip those that already match a
    // concrete slot today (same start/end/type) — that means the slot
    // exists and we already tried it above.
    const concreteSig = new Set(daySlots.map(s =>
      `${s.startTime}|${s.endTime}|${s.slotType || ''}`
    ));
    for (const r of rhythmList) {
      const occ = occurrencesInRange(r, d, d);
      if (!occ.includes(dateKey)) continue;
      const sig = `${r.startTime || ''}|${r.endTime || ''}|${r.slotType || ''}`;
      if (concreteSig.has(sig)) continue;
      if (taskType && r.slotType && r.slotType !== taskType) continue;

      const dur = slotDurationMin(r.startTime || '09:00', r.endTime || '10:00');
      if (dur >= duration) {
        return {
          kind: 'rhythm',
          rhythm: r,
          date: dateKey,
          startMin: hhmmToMin(r.startTime || '09:00'),
          slotShape: {
            date: dateKey,
            startTime: r.startTime || '09:00',
            endTime: r.endTime || '10:00',
            slotType: r.slotType || null,
            label: r.name,
            color: r.color || '#A8BF8C',
          },
        };
      }
    }
  }

  return null;
}

// Exported for the test harness.
export const __test = { tryFitInSlot, slotDurationMin, hhmmToMin, ymdHelper };
