/**
 * /api/day-assignments — provenance for which routine was painted
 * on which date.
 *
 * GET    /api/day-assignments?date=YYYY-MM-DD     one
 * GET    /api/day-assignments?from=&to=           range (year canvas)
 * DELETE /api/day-assignments?date=YYYY-MM-DD     clear (without nuking blocks)
 *
 * Creates happen as a side effect of POST /api/routines?op=paint —
 * never directly POSTed by clients.
 */

import { repos } from '../_lib/repo/index.js';
import { resolveOwner, requireOwner } from '../_lib/identity.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  switch (req.method) {
    case 'GET':    return handleGet(req, res);
    case 'DELETE': return handleDelete(req, res);
    default:
      res.setHeader('Allow', 'GET, DELETE');
      return res.status(405).json({ error: 'method not allowed' });
  }
}

async function handleGet(req, res) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });

  const date = typeof req.query?.date === 'string' ? req.query.date : null;
  const from = typeof req.query?.from === 'string' ? req.query.from : null;
  const to   = typeof req.query?.to   === 'string' ? req.query.to   : null;

  if (date) {
    if (!YMD_RE.test(date)) return res.status(400).json({ error: 'invalid date' });
    const [doc] = await repos().dayAssignments.list({
      ownerId,
      where: (a) => a.date === date,
    });
    return res.status(200).json({ assignment: doc || null });
  }

  if (from && to) {
    if (!YMD_RE.test(from) || !YMD_RE.test(to)) return res.status(400).json({ error: 'invalid from/to' });
    const items = await repos().dayAssignments.list({
      ownerId,
      where: (a) => a.date >= from && a.date <= to,
    });
    items.sort((a, b) => a.date.localeCompare(b.date));
    return res.status(200).json({ assignments: items });
  }

  return res.status(400).json({ error: 'date OR from+to required' });
}

async function handleDelete(req, res) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const date = typeof req.query?.date === 'string' ? req.query.date : null;
  if (!date || !YMD_RE.test(date)) return res.status(400).json({ error: 'date required' });

  const removed = await repos().dayAssignments.removeWhere({
    ownerId,
    where: (a) => a.date === date,
  });
  if (removed === 0) return res.status(404).json({ error: 'no assignment on that date' });
  return res.status(204).end();
}
