/**
 * /api/recurring-blocks — blocks that fire on a cadence forever.
 *
 * GET    /api/recurring-blocks                                       list
 * POST   /api/recurring-blocks                                       create
 * GET    /api/recurring-blocks?id=                                   one
 * PATCH  /api/recurring-blocks?id=                                   edit (ripples forward)
 * DELETE /api/recurring-blocks?id=                                   hard delete
 * GET    /api/recurring-blocks?id=&op=occurrences&from=&to=          resolve cadence
 * POST   /api/recurring-blocks?id=&op=break-out&date=YYYY-MM-DD      materialize one-off
 *
 * Cadence shape (matches src/services/rhythms.js):
 *   { kind: 'weekly' | 'biweekly' | 'monthly_nth' | 'monthly_date'
 *         | 'quarterly_week' | 'project' | 'oneoff' | 'custom',
 *     daysOfWeek?: [0..6, ...],   // weekly / biweekly / monthly_nth
 *     dayOfWeek?: 0..6,           // legacy single (still supported)
 *     nth?: 1..5 | -1, monthDate?: 1..31, weekOfQuarter?: 1..13,
 *     anchor?: 'YYYY-MM-DD', end?: 'YYYY-MM-DD',
 *     dates?: ['YYYY-MM-DD', ...] }
 */

import { repos } from '../_lib/repo/index.js';
import { resolveOwner, requireOwner } from '../_lib/identity.js';
import { occurrencesInRange } from '../../src/services/rhythms.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^\d{2}:\d{2}$/;
const VALID_KINDS = new Set([
  'weekly', 'biweekly', 'monthly_nth', 'monthly_date',
  'quarterly_week', 'project', 'oneoff', 'custom',
]);

export default async function handler(req, res) {
  const id = typeof req.query?.id === 'string' ? req.query.id : null;
  const op = typeof req.query?.op === 'string' ? req.query.op : null;

  if (id && op === 'occurrences' && req.method === 'GET') return handleOccurrences(req, res, id);
  if (id && op === 'break-out' && req.method === 'POST') return handleBreakOut(req, res, id);

  switch (req.method) {
    case 'GET':    return id ? handleGetOne(req, res, id) : handleList(req, res);
    case 'POST':   return handleCreate(req, res);
    case 'PATCH':  return id ? handleUpdate(req, res, id) : missing(res);
    case 'DELETE': return id ? handleDelete(req, res, id) : missing(res);
    default:
      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return res.status(405).json({ error: 'method not allowed' });
  }
}

function missing(res) { return res.status(400).json({ error: 'id required' }); }

async function handleList(req, res) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const items = await repos().recurringBlocks.list({ ownerId });
  items.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
  return res.status(200).json({ recurringBlocks: items });
}

async function handleGetOne(req, res, id) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const doc = await repos().recurringBlocks.get({ ownerId, id });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ recurringBlock: doc });
}

async function handleCreate(req, res) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const v = validateRecurringShape(body);
  if (v) return res.status(400).json({ error: v });

  const data = {
    name: String(body.name || '').slice(0, 80),
    startTime: body.startTime,
    endTime: body.endTime,
    label: String(body.label || body.name || '').slice(0, 60),
    category: body.category ? String(body.category).slice(0, 40) : null,
    color: body.color ? String(body.color).slice(0, 32) : null,
    cadence: body.cadence,
  };
  const doc = await repos().recurringBlocks.create({ ownerId, data });
  return res.status(201).json({ recurringBlock: doc });
}

async function handleUpdate(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const patch = {};
  for (const k of ['name', 'startTime', 'endTime', 'label', 'category', 'color', 'cadence']) {
    if (k in body) patch[k] = body[k];
  }
  if ('cadence' in patch && !VALID_KINDS.has(patch.cadence?.kind)) {
    return res.status(400).json({ error: 'invalid cadence.kind' });
  }
  if ('startTime' in patch && !HHMM_RE.test(patch.startTime)) {
    return res.status(400).json({ error: 'invalid startTime' });
  }
  if ('endTime' in patch && !HHMM_RE.test(patch.endTime)) {
    return res.status(400).json({ error: 'invalid endTime' });
  }
  const doc = await repos().recurringBlocks.update({ ownerId, id, patch });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ recurringBlock: doc });
}

async function handleDelete(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const ok = await repos().recurringBlocks.remove({ ownerId, id });
  if (!ok) return res.status(404).json({ error: 'not found' });
  return res.status(204).end();
}

async function handleOccurrences(req, res, id) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const doc = await repos().recurringBlocks.get({ ownerId, id });
  if (!doc) return res.status(404).json({ error: 'not found' });

  const from = typeof req.query?.from === 'string' ? req.query.from : null;
  const to   = typeof req.query?.to   === 'string' ? req.query.to   : null;
  if (!from || !to || !YMD_RE.test(from) || !YMD_RE.test(to)) {
    return res.status(400).json({ error: 'from + to (YYYY-MM-DD) required' });
  }
  const dates = occurrencesInRange(doc, from, to);
  return res.status(200).json({ recurringBlockId: id, from, to, occurrences: dates });
}

/**
 * Materialize a single occurrence as a one-off Block. The recurring
 * block continues to fire on every other date; the new Block carries
 * sourceRecurringBlockId so the UI knows where it came from.
 *
 * No-op if a block with that provenance already exists on that date
 * (idempotent — repeat calls don't duplicate).
 */
async function handleBreakOut(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const doc = await repos().recurringBlocks.get({ ownerId, id });
  if (!doc) return res.status(404).json({ error: 'not found' });

  const date = typeof req.query?.date === 'string' ? req.query.date : null;
  if (!date || !YMD_RE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

  // Idempotent — if we already broke this out, return the existing block.
  const existing = await repos().blocks.list({
    ownerId,
    where: (b) => b.date === date && b.sourceRecurringBlockId === id,
  });
  if (existing.length > 0) {
    return res.status(200).json({ block: existing[0], created: false });
  }

  const block = await repos().blocks.create({
    ownerId,
    data: {
      date,
      startTime: doc.startTime,
      endTime: doc.endTime,
      label: doc.label || doc.name,
      category: doc.category,
      color: doc.color,
      sourceRoutineId: null,
      sourceBlockId: null,
      sourceRecurringBlockId: id,
    },
  });
  return res.status(201).json({ block, created: true });
}

function validateRecurringShape(b) {
  if (!b.name || typeof b.name !== 'string') return 'name required';
  if (!b.startTime || !HHMM_RE.test(b.startTime)) return 'startTime required (HH:MM)';
  if (!b.endTime || !HHMM_RE.test(b.endTime)) return 'endTime required (HH:MM)';
  if (!b.cadence || typeof b.cadence !== 'object') return 'cadence required';
  if (!VALID_KINDS.has(b.cadence.kind)) return `cadence.kind must be one of: ${[...VALID_KINDS].join(', ')}`;
  return null;
}
