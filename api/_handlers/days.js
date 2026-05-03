/**
 * GET /api/days?date=YYYY-MM-DD
 *
 * Composite endpoint: one round trip for the day view's full payload.
 *
 *   {
 *     date,
 *     assignment: { date, routineId } | null,
 *     blocks: [...],                       // all snapshot + ad-hoc + broken-out blocks on this date
 *     recurringBlockOccurrences: [         // virtual — not stored, derived from cadences
 *       { recurringBlockId, startTime, endTime, label, category, color, isRecurring: true }
 *     ],
 *     exception: { id, type, label, ... } | null    // first matching exception
 *   }
 *
 * The SPA uses this on every day-navigation. The pure resource routes
 * (/api/blocks?date=, /api/recurring-blocks?op=occurrences, etc.) stay
 * for finer queries; this is the convenience layer.
 */

import { repos } from '../_lib/repo/index.js';
import { resolveOwner } from '../_lib/identity.js';
import { occurrencesInRange } from '../../src/services/rhythms.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });

  const date = typeof req.query?.date === 'string' ? req.query.date : null;
  if (!date || !YMD_RE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

  // Snapshot + ad-hoc + broken-out blocks on this exact date.
  const blocks = repos().blocks.list({ ownerId, where: (b) => b.date === date });
  blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Day assignment (which routine was painted here, if any).
  const [assignment] = repos().dayAssignments.list({
    ownerId,
    where: (a) => a.date === date,
  });

  // First exception covering this date, if any.
  const [exception] = repos().exceptions.list({
    ownerId,
    where: (e) => e.startDate <= date && e.endDate >= date,
  });

  // Recurring blocks that fire on this date (suppressed if exception covers it).
  const recurringOccurrences = [];
  if (!exception) {
    const allRecurring = repos().recurringBlocks.list({ ownerId });
    for (const r of allRecurring) {
      const dates = occurrencesInRange(r, date, date);
      if (dates.includes(date)) {
        // Skip recurring blocks that have been broken out for THIS date —
        // their concrete Block already shows up in `blocks` above.
        const brokenOut = blocks.some(b => b.sourceRecurringBlockId === r.id);
        if (brokenOut) continue;
        recurringOccurrences.push({
          recurringBlockId: r.id,
          startTime: r.startTime,
          endTime: r.endTime,
          label: r.label || r.name,
          category: r.category || null,
          color: r.color || null,
          isRecurring: true,
        });
      }
    }
    recurringOccurrences.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return res.status(200).json({
    date,
    assignment: assignment || null,
    blocks,
    recurringBlockOccurrences: recurringOccurrences,
    exception: exception || null,
  });
}
