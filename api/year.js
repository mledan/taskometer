/**
 * GET /api/year?year=YYYY
 *
 * Composite endpoint for the year canvas. One round trip returns
 * everything the canvas needs to paint:
 *
 *   {
 *     year,
 *     daysByKey: {
 *       'YYYY-MM-DD': {
 *         assignment: { routineId } | null,
 *         entries: [
 *           { source: 'block', color, label, isRecurring: false } |
 *           { source: 'recurring', recurringBlockId, color, label, isRecurring: true } |
 *           { source: 'exception', type, label }
 *         ]
 *       }
 *     },
 *     exceptions: [...]   // raw exceptions covering the year (for the rail)
 *   }
 *
 * Excepted days have their entries replaced with a single 'exception'
 * entry so the canvas can render them dashed/grey without checking
 * the exceptions list separately.
 */

import { repos } from './_lib/repo/index.js';
import { resolveOwner } from './_lib/identity.js';
import { occurrencesInRange } from '../src/services/rhythms.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });

  const yearStr = typeof req.query?.year === 'string' ? req.query.year : null;
  if (!yearStr || !/^\d{4}$/.test(yearStr)) {
    return res.status(400).json({ error: 'year (YYYY) required' });
  }
  const year = parseInt(yearStr, 10);
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;

  // Pull everything in the range in three queries.
  const blocks = repos().blocks.list({
    ownerId,
    where: (b) => b.date >= start && b.date <= end,
  });
  const assignments = repos().dayAssignments.list({
    ownerId,
    where: (a) => a.date >= start && a.date <= end,
  });
  const exceptions = repos().exceptions.list({
    ownerId,
    where: (e) => !(e.endDate < start || e.startDate > end),
  });
  const allRecurring = repos().recurringBlocks.list({ ownerId });

  // Index for fast lookups while building the daysByKey map.
  const exceptionByDate = new Map();
  for (const exc of exceptions) {
    const cur = new Date(exc.startDate < start ? `${start}T00:00:00` : `${exc.startDate}T00:00:00`);
    const stop = new Date(exc.endDate > end ? `${end}T00:00:00` : `${exc.endDate}T00:00:00`);
    while (cur.getTime() <= stop.getTime()) {
      exceptionByDate.set(ymd(cur), exc);
      cur.setDate(cur.getDate() + 1);
    }
  }
  const assignmentByDate = new Map(assignments.map(a => [a.date, a]));

  // Build the per-day map only for dates that have something on them.
  const daysByKey = {};

  // Add concrete blocks first.
  for (const b of blocks) {
    const day = ensureDay(daysByKey, b.date, assignmentByDate);
    if (exceptionByDate.has(b.date)) continue; // we'll mark the day excepted below
    day.entries.push({
      source: 'block',
      blockId: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      label: b.label,
      color: b.color,
      isRecurring: false,
    });
  }

  // Add recurring-block occurrences (filtered against exceptions and
  // already-broken-out concrete blocks so we don't double-render).
  const blocksByDate = new Map();
  for (const b of blocks) {
    if (!blocksByDate.has(b.date)) blocksByDate.set(b.date, []);
    blocksByDate.get(b.date).push(b);
  }

  for (const r of allRecurring) {
    const dates = occurrencesInRange(r, start, end);
    for (const d of dates) {
      if (exceptionByDate.has(d)) continue;
      const dayBlocks = blocksByDate.get(d) || [];
      if (dayBlocks.some(b => b.sourceRecurringBlockId === r.id)) continue;
      const day = ensureDay(daysByKey, d, assignmentByDate);
      day.entries.push({
        source: 'recurring',
        recurringBlockId: r.id,
        startTime: r.startTime,
        endTime: r.endTime,
        label: r.label || r.name,
        color: r.color,
        isRecurring: true,
      });
    }
  }

  // Stamp exception markers on excepted days (replacing entries).
  for (const [date, exc] of exceptionByDate.entries()) {
    daysByKey[date] = {
      assignment: assignmentByDate.get(date) || null,
      entries: [{
        source: 'exception',
        exceptionId: exc.id,
        type: exc.type,
        label: exc.label,
        color: exc.color,
      }],
    };
  }

  // Sort entries inside each day by start time (exceptions have none).
  for (const day of Object.values(daysByKey)) {
    day.entries.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  return res.status(200).json({ year, daysByKey, exceptions });
}

function ensureDay(map, date, assignmentByDate) {
  if (!map[date]) {
    map[date] = {
      assignment: assignmentByDate.get(date) || null,
      entries: [],
    };
  }
  return map[date];
}

function ymd(d) {
  const m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}
