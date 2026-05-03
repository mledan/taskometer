/**
 * /api/blocks — one-off + snapshotted blocks on specific dates.
 *
 * GET    /api/blocks?date=YYYY-MM-DD     list blocks on a date
 * GET    /api/blocks?from=&to=           range (year canvas)
 * POST   /api/blocks                     create ad-hoc (no provenance)
 * GET    /api/blocks?id=                 one
 * PATCH  /api/blocks?id=                 edit (this date only)
 * DELETE /api/blocks?id=                 hard delete
 *
 * Provenance fields (sourceRoutineId, sourceBlockId,
 * sourceRecurringBlockId) are set by the routine paint op and the
 * recurring-block break-out op — not by clients directly. PATCH
 * preserves them when present.
 */

import { repos } from './_lib/repo/index.js';
import { resolveOwner, requireOwner } from './_lib/identity.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^\d{2}:\d{2}$/;

export default async function handler(req, res) {
  const id = strQuery(req, 'id');
  switch (req.method) {
    case 'GET':    return id ? handleGetOne(req, res, id) : handleList(req, res);
    case 'POST':   return handleCreate(req, res);
    case 'PATCH':  return id ? handleUpdate(req, res, id) : missingId(res);
    case 'DELETE': return id ? handleDelete(req, res, id) : missingId(res);
    default:
      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return res.status(405).json({ error: 'method not allowed' });
  }
}

function missingId(res) { return res.status(400).json({ error: 'id required' }); }
function strQuery(req, k) { return typeof req.query?.[k] === 'string' ? req.query[k] : null; }

async function handleList(req, res) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });

  const date = strQuery(req, 'date');
  const from = strQuery(req, 'from');
  const to   = strQuery(req, 'to');

  let where = null;
  if (date) {
    if (!YMD_RE.test(date)) return res.status(400).json({ error: 'invalid date' });
    where = (b) => b.date === date;
  } else if (from && to) {
    if (!YMD_RE.test(from) || !YMD_RE.test(to)) return res.status(400).json({ error: 'invalid from/to' });
    where = (b) => b.date >= from && b.date <= to;
  }

  const items = repos().blocks.list({ ownerId, where });
  items.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  return res.status(200).json({ blocks: items });
}

async function handleGetOne(req, res, id) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const doc = repos().blocks.get({ ownerId, id });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ block: doc });
}

async function handleCreate(req, res) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const validation = validateBlockShape(body);
  if (validation) return res.status(400).json({ error: validation });

  const data = {
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    label: String(body.label || '').slice(0, 60),
    category: body.category ? String(body.category).slice(0, 40) : null,
    color: body.color ? String(body.color).slice(0, 32) : null,
    sourceRoutineId: null,           // ad-hoc — no provenance
    sourceBlockId: null,
    sourceRecurringBlockId: null,
  };
  const doc = repos().blocks.create({ ownerId, data });
  return res.status(201).json({ block: doc });
}

async function handleUpdate(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  const patch = {};
  for (const k of ['date', 'startTime', 'endTime', 'label', 'category', 'color']) {
    if (k in body) patch[k] = body[k];
  }
  if ('date' in patch && !YMD_RE.test(patch.date)) {
    return res.status(400).json({ error: 'invalid date' });
  }
  if ('startTime' in patch && !HHMM_RE.test(patch.startTime)) {
    return res.status(400).json({ error: 'invalid startTime' });
  }
  if ('endTime' in patch && !HHMM_RE.test(patch.endTime)) {
    return res.status(400).json({ error: 'invalid endTime' });
  }
  if ('label' in patch) patch.label = String(patch.label).slice(0, 60);

  const doc = repos().blocks.update({ ownerId, id, patch });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ block: doc });
}

async function handleDelete(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const ok = repos().blocks.remove({ ownerId, id });
  if (!ok) return res.status(404).json({ error: 'not found' });
  return res.status(204).end();
}

function validateBlockShape(b) {
  if (!b.date || !YMD_RE.test(b.date)) return 'date required (YYYY-MM-DD)';
  if (!b.startTime || !HHMM_RE.test(b.startTime)) return 'startTime required (HH:MM)';
  if (!b.endTime || !HHMM_RE.test(b.endTime)) return 'endTime required (HH:MM)';
  return null;
}
