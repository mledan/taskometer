/**
 * /api/tasks — todos that drop into blocks.
 *
 * GET    /api/tasks                         filters: ?date= ?blockId= ?recurringBlockId= ?status=
 * POST   /api/tasks                         create
 * GET    /api/tasks?id=                     one
 * PATCH  /api/tasks?id=                     update
 * DELETE /api/tasks?id=[&hard=1]            soft default (status='cancelled')
 */

import { repos } from '../_lib/repo/index.js';
import { resolveOwner, requireOwner } from '../_lib/identity.js';

const VALID_STATUSES = new Set(['pending', 'completed', 'cancelled']);

function ymd(d) {
  const m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export default async function handler(req, res) {
  const id = typeof req.query?.id === 'string' ? req.query.id : null;
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

  const date = typeof req.query?.date === 'string' ? req.query.date : null;
  const blockId = typeof req.query?.blockId === 'string' ? req.query.blockId : null;
  const recurringBlockId = typeof req.query?.recurringBlockId === 'string' ? req.query.recurringBlockId : null;
  const status = typeof req.query?.status === 'string' ? req.query.status : null;

  let items = repos().tasks.list({ ownerId });

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    items = items.filter(t => t.scheduledTime && ymd(new Date(t.scheduledTime)) === date);
  }
  if (blockId) items = items.filter(t => t.scheduledBlockId === blockId);
  if (recurringBlockId) items = items.filter(t => t.scheduledRecurringBlockId === recurringBlockId);
  if (status && VALID_STATUSES.has(status)) items = items.filter(t => (t.status || 'pending') === status);

  items.sort((a, b) => (a.scheduledTime || a.ts).localeCompare(b.scheduledTime || b.ts));
  return res.status(200).json({ tasks: items });
}

async function handleGetOne(req, res, id) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const doc = repos().tasks.get({ ownerId, id });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ task: doc });
}

async function handleCreate(req, res) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const text = String(body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'text required' });

  const data = {
    text,
    duration: typeof body.duration === 'number' ? body.duration : 30,
    priority: body.priority ?? 'medium',
    status: 'pending',
    scheduledTime: body.scheduledTime ?? null,
    scheduledBlockId: body.scheduledBlockId ?? null,
    scheduledRecurringBlockId: body.scheduledRecurringBlockId ?? null,
  };
  const doc = repos().tasks.create({ ownerId, data });
  return res.status(201).json({ task: doc });
}

async function handleUpdate(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const patch = {};
  for (const k of ['text', 'duration', 'priority', 'status',
                   'scheduledTime', 'scheduledBlockId', 'scheduledRecurringBlockId']) {
    if (k in body) patch[k] = body[k];
  }
  if (patch.status && !VALID_STATUSES.has(patch.status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  if ('text' in patch) patch.text = String(patch.text).slice(0, 500);

  const doc = repos().tasks.update({ ownerId, id, patch });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ task: doc });
}

async function handleDelete(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const hard = req.query?.hard === '1';
  if (hard) {
    const ok = repos().tasks.remove({ ownerId, id });
    if (!ok) return res.status(404).json({ error: 'not found' });
    return res.status(204).end();
  }
  const doc = repos().tasks.update({ ownerId, id, patch: { status: 'cancelled' } });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ task: doc });
}
