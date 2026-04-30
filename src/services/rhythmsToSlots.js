/**
 * Bridge between the new Rhythms layer and the existing Slot data
 * model. Given a date and a list of rhythms, computes the slot objects
 * that would be created if the user applied those rhythms to that day.
 *
 * Used by the day view to:
 *   1. Show which rhythms fire today that aren't materialized yet
 *   2. Materialize them on demand (the "Apply rhythms" CTA)
 *
 * Pure functions — no IO. The api.slots.add() side-effect happens in
 * Taskometer.jsx where the api handle is in scope.
 */

import { occurrencesInRange, ymd, parseYMD } from './rhythms.js';

/**
 * Return a slot-shaped projection of every rhythm firing on `dateKey`,
 * filtering out any rhythm that already has a matching concrete slot
 * on that date (matched by startTime + endTime + label).
 *
 * Each entry has the shape api.slots.add() expects, plus a `_rhythmId`
 * so the caller can show "from rhythm X" attribution.
 */
export function pendingRhythmSlotsForDate(rhythms, existingSlots, dateKey) {
  if (!dateKey || !Array.isArray(rhythms) || rhythms.length === 0) return [];
  const date = parseYMD(dateKey);
  if (!date) return [];

  const existingForDate = (existingSlots || []).filter(s => s.date === dateKey);
  const has = (proj) => existingForDate.some(s =>
    s.startTime === proj.startTime &&
    s.endTime === proj.endTime &&
    (s.label === proj.label || s.slotType === proj.slotType)
  );

  const out = [];
  for (const r of rhythms) {
    const dates = occurrencesInRange(r, date, date);
    if (!dates.includes(dateKey)) continue;
    const proj = {
      date: dateKey,
      startTime: r.startTime || '09:00',
      endTime: r.endTime || '10:00',
      slotType: r.slotType || null,
      label: r.name,
      color: r.color || '#A8BF8C',
      _rhythmId: r.id,
      _rhythmName: r.name,
    };
    if (!has(proj)) out.push(proj);
  }
  return out;
}

export { ymd };
