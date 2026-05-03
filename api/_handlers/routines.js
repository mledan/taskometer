/**
 * /api/routines — named day-shape bundles + the snapshot operations.
 *
 * GET    /api/routines                                list mine
 * POST   /api/routines                                create
 * GET    /api/routines?id=                            one
 * PATCH  /api/routines?id=                            edit (past paints unaffected)
 * DELETE /api/routines?id=                            hard delete
 *
 * Compound ops:
 * POST   /api/routines?id=&op=paint                   snapshot onto dates
 * POST   /api/routines?id=&op=re-paint                re-snapshot existing painted dates
 * POST   /api/routines?id=&op=update-from-date        promote a day's edits up
 */

import { repos } from '../_lib/repo/index.js';
import { resolveOwner, requireOwner } from '../_lib/identity.js';
import { isValidLifestyle } from '../_lib/lifestyles.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^\d{2}:\d{2}$/;

export default async function handler(req, res) {
  const id = typeof req.query?.id === 'string' ? req.query.id : null;
  const op = typeof req.query?.op === 'string' ? req.query.op : null;

  if (id && req.method === 'POST') {
    if (op === 'paint') return handlePaint(req, res, id);
    if (op === 're-paint') return handleRepaint(req, res, id);
    if (op === 'update-from-date') return handleUpdateFromDate(req, res, id);
  }

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

// ───── CRUD ──────────────────────────────────────────────────────

async function handleList(req, res) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const items = repos().routines.list({ ownerId });
  items.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
  return res.status(200).json({ routines: items });
}

async function handleGetOne(req, res, id) {
  const ownerId = await resolveOwner(req);
  if (!ownerId) return res.status(401).json({ error: 'sign-in required' });
  const doc = repos().routines.get({ ownerId, id });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ routine: doc });
}

async function handleCreate(req, res) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const v = validateRoutineShape(body);
  if (v) return res.status(400).json({ error: v });

  const data = {
    name: String(body.name).trim().slice(0, 80),
    color: body.color ? String(body.color).slice(0, 32) : '#A8BF8C',
    lifestyle: body.lifestyle && isValidLifestyle(body.lifestyle) ? body.lifestyle : null,
    blocks: body.blocks.map(cleanBlock),
    isPublic: !!body.isPublic,
  };
  const doc = repos().routines.create({ ownerId, data });
  return res.status(201).json({ routine: doc });
}

async function handleUpdate(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const patch = {};
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 80);
  if (typeof body.color === 'string') patch.color = body.color.slice(0, 32);
  if ('lifestyle' in body) {
    patch.lifestyle = body.lifestyle && isValidLifestyle(body.lifestyle) ? body.lifestyle : null;
  }
  if (Array.isArray(body.blocks)) patch.blocks = body.blocks.map(cleanBlock);
  if ('isPublic' in body) patch.isPublic = !!body.isPublic;

  const doc = repos().routines.update({ ownerId, id, patch });
  if (!doc) return res.status(404).json({ error: 'not found' });
  return res.status(200).json({ routine: doc });
}

async function handleDelete(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const ok = repos().routines.remove({ ownerId, id });
  if (!ok) return res.status(404).json({ error: 'not found' });
  return res.status(204).end();
}

// ───── compound ops ─────────────────────────────────────────────

async function handlePaint(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const routine = repos().routines.get({ ownerId, id });
  if (!routine) return res.status(404).json({ error: 'routine not found' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const dates = resolveDateList(body);
  if (dates.length === 0) {
    return res.status(400).json({ error: 'no dates resolved — provide `dates` or `range`' });
  }

  return res.status(200).json(snapshotRoutineToDates({ ownerId, routine, dates }));
}

async function handleRepaint(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const routine = repos().routines.get({ ownerId, id });
  if (!routine) return res.status(404).json({ error: 'routine not found' });

  // Re-paint = repaint every date that ALREADY has this routine assigned.
  // Body can pass an explicit subset to only touch certain dates.
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const allAssignments = repos().dayAssignments.list({
    ownerId,
    where: (a) => a.routineId === id,
  });
  let targetDates = allAssignments.map(a => a.date);
  if (Array.isArray(body.dates) && body.dates.length > 0) {
    const filter = new Set(body.dates.filter(d => YMD_RE.test(d)));
    targetDates = targetDates.filter(d => filter.has(d));
  }
  if (targetDates.length === 0) {
    return res.status(200).json({ wheelId: id, painted: [], blocksCreated: 0, blocksDeleted: 0, assignments: 0 });
  }
  return res.status(200).json(snapshotRoutineToDates({ ownerId, routine, dates: targetDates }));
}

async function handleUpdateFromDate(req, res, id) {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;
  const routine = repos().routines.get({ ownerId, id });
  if (!routine) return res.status(404).json({ error: 'routine not found' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const date = typeof body.date === 'string' ? body.date : null;
  if (!date || !YMD_RE.test(date)) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });

  // Take the live blocks on `date` that were sourced from this routine.
  // That becomes the new canonical block list for the routine.
  const blocksOnDate = repos().blocks.list({
    ownerId,
    where: (b) => b.date === date && b.sourceRoutineId === id,
  });
  if (blocksOnDate.length === 0) {
    return res.status(400).json({ error: 'no blocks on that date are sourced from this routine' });
  }
  blocksOnDate.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const newBlocks = blocksOnDate.map(b => ({
    startTime: b.startTime,
    endTime: b.endTime,
    label: b.label,
    category: b.category,
    color: b.color,
  }));
  const updated = repos().routines.update({ ownerId, id, patch: { blocks: newBlocks } });

  // Find other dates that still have the OLD snapshot (anyone whose
  // sourceBlockId no longer matches a block in the new routine).
  const otherAssignments = repos().dayAssignments.list({
    ownerId,
    where: (a) => a.routineId === id && a.date !== date,
  });
  const staleDates = otherAssignments.map(a => a.date).sort();

  return res.status(200).json({ routine: updated, staleDates });
}

// ───── shared helper for paint / re-paint ────────────────────────

function snapshotRoutineToDates({ ownerId, routine, dates }) {
  let blocksCreated = 0;
  let blocksDeleted = 0;
  let assignments = 0;

  for (const date of dates) {
    // Wipe existing snapshot blocks for this routine on this date.
    blocksDeleted += repos().blocks.removeWhere({
      ownerId,
      where: (b) => b.date === date && b.sourceRoutineId === routine.id,
    });

    // Snapshot fresh.
    for (const blk of (routine.blocks || [])) {
      repos().blocks.create({
        ownerId,
        data: {
          date,
          startTime: blk.startTime,
          endTime: blk.endTime,
          label: blk.label || '',
          category: blk.category || null,
          color: blk.color || routine.color || null,
          sourceRoutineId: routine.id,
          sourceBlockId: blk.id || null, // routine.blocks are inline, no id
          sourceRecurringBlockId: null,
        },
      });
      blocksCreated++;
    }

    // Upsert the day assignment.
    const existing = repos().dayAssignments.list({
      ownerId,
      where: (a) => a.date === date,
    });
    if (existing[0]) {
      repos().dayAssignments.update({
        ownerId,
        id: existing[0].id,
        patch: { routineId: routine.id },
      });
    } else {
      repos().dayAssignments.create({
        ownerId,
        data: { date, routineId: routine.id },
      });
    }
    assignments++;
  }

  return {
    wheelId: routine.id,
    painted: dates,
    blocksCreated,
    blocksDeleted,
    assignments,
  };
}

// ───── shape helpers ─────────────────────────────────────────────

function validateRoutineShape(b) {
  if (!b.name || typeof b.name !== 'string') return 'name required';
  if (!Array.isArray(b.blocks)) return 'blocks (array) required';
  for (const blk of b.blocks) {
    if (!blk?.startTime || !HHMM_RE.test(blk.startTime)) return 'each block needs startTime (HH:MM)';
    if (!blk?.endTime || !HHMM_RE.test(blk.endTime))     return 'each block needs endTime (HH:MM)';
  }
  return null;
}

function cleanBlock(b) {
  return {
    startTime: String(b?.startTime || '00:00').slice(0, 5),
    endTime:   String(b?.endTime   || '00:00').slice(0, 5),
    label:     String(b?.label     || '').slice(0, 60),
    category:  b?.category ? String(b.category).slice(0, 40) : null,
    color:     b?.color    ? String(b.color).slice(0, 32)    : null,
  };
}

function resolveDateList(body) {
  if (Array.isArray(body.dates) && body.dates.length > 0) {
    return body.dates.filter(d => YMD_RE.test(d));
  }
  const r = body.range;
  if (r && typeof r === 'object' && YMD_RE.test(r.start) && YMD_RE.test(r.end)) {
    const out = [];
    const cur = new Date(`${r.start}T00:00:00`);
    const end = new Date(`${r.end}T00:00:00`);
    while (cur.getTime() <= end.getTime()) {
      const dow = cur.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const skip = (r.weekdaysOnly && isWeekend) || (r.weekendsOnly && !isWeekend);
      if (!skip) {
        const m = cur.getMonth() + 1, d = cur.getDate();
        out.push(`${cur.getFullYear()}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }
  return [];
}
