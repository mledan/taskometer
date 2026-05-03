/**
 * /api/exceptions — date ranges that suppress recurring blocks.
 *
 * GET    /api/exceptions?from=&to=        list overlapping the range
 * POST   /api/exceptions                  create
 * GET    /api/exceptions?id=              one
 * PATCH  /api/exceptions?id=              update
 * DELETE /api/exceptions?id=              hard delete
 */

import { repos } from '../_lib/repo/index.js';
import { resolveOwner, requireOwner } from '../_lib/identity.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = new Set(['vacation', 'holiday', 'conference', 'sick', 'other']);

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

  const from = typeof req.query?.from === 'string' ? req.query.from : null;
  const to   = typeof req.query?.to   === 'string' ? req.query.to   : null;

  let where = null;
  if (from && to) {
    if (!YMD_RE.test(from) || !YMD_RE.test(to)) return res.status(400).json({ error: 'invalid from/to' });
    where = (e) => !(e.endDate < from || e.startDate > to);
  }

  const items = repos().exceptions.list({ ownerId, where });
  items.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return res.status(200).json({ exceptions: items });
}

async function handleGetOne(req, res, id) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const doc = repos().exceptions.get({ ownerId, id });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ exception: doc });
}

async function handleCreate(req, res) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  const startDate = String(body.startDate || '').trim();
  const endDate = String(body.endDate || '').trim();
  if (!YMD_RE.test(startDate) || !YMD_RE.test(endDate)) {
    return res.status(400).json({ error: 'startDate + endDate required (YYYY-MM-DD)' });
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: 'endDate must be >= startDate' });
  }
  const type = VALID_TYPES.has(body.type) ? body.type : 'other';

  const data = {
    type,
    label: String(body.label || type).slice(0, 60),
    startDate,
    endDate,
    color: body.color ? String(body.color).slice(0, 32) : null,
  };
  const doc = repos().exceptions.create({ ownerId, data });
  return res.status(201).json({ exception: doc });
}

async function handleUpdate(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const patch = {};
  for (const k of ['type', 'label', 'startDate', 'endDate', 'color']) {
    if (k in body) patch[k] = body[k];
  }
  if ('type' in patch && !VALID_TYPES.has(patch.type)) {
    return res.status(400).json({ error: 'invalid type' });
  }
  if ('startDate' in patch && !YMD_RE.test(patch.startDate)) return res.status(400).json({ error: 'invalid startDate' });
  if ('endDate' in patch && !YMD_RE.test(patch.endDate)) return res.status(400).json({ error: 'invalid endDate' });

  const doc = repos().exceptions.update({ ownerId, id, patch });
  if (!doc) return res.status(404).json({ error: 'not found' });
  if (doc.endDate < doc.startDate) {
    // restore would be ideal; for a memory repo just refuse + report
    return res.status(400).json({ error: 'endDate must be >= startDate after update' });
  }
  return res.status(200).json({ exception: doc });
}

async function handleDelete(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const ok = repos().exceptions.remove({ ownerId, id });
  if (!ok) return res.status(404).json({ error: 'not found' });
  return res.status(204).end();
}
