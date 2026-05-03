/**
 * /api/v2/[[...path]] — single-function dispatcher for the v2 surface.
 *
 * Vercel's Hobby tier caps a deployment at ~12 serverless functions.
 * Each api/*.js file counts as one. Rather than ship one function per
 * resource (which blew the cap), we route every v2 endpoint through
 * this catchall and dispatch to the per-resource handler in
 * api/_handlers/ (the underscore prefix means Vercel doesn't expose
 * it as a route).
 *
 * URL shape:
 *   /api/v2                 → 404 (no resource)
 *   /api/v2/health          → handlers.health
 *   /api/v2/blocks?date=…   → handlers.blocks
 *   /api/v2/routines?id=&op=paint  → handlers.routines
 *   /api/v2/days?date=…     → handlers.days
 *
 * The handlers themselves are unchanged — they're still plain
 * (req, res) => Promise functions. This file just sits in front and
 * picks the right one based on the first path segment.
 *
 * Vercel populates req.query.path with the catchall segments as an
 * array, e.g. ['routines'] for /api/v2/routines.
 */

import blocks         from '../_handlers/blocks.js';
import dayAssignments from '../_handlers/day-assignments.js';
import days           from '../_handlers/days.js';
import exceptions     from '../_handlers/exceptions.js';
import health         from '../_handlers/health.js';
import lifestyles     from '../_handlers/lifestyles.js';
import recurringBlocks from '../_handlers/recurring-blocks.js';
import routines       from '../_handlers/routines.js';
import tasks          from '../_handlers/tasks.js';
import year           from '../_handlers/year.js';

const HANDLERS = {
  'health':            health,
  'lifestyles':        lifestyles,
  'blocks':            blocks,
  'recurring-blocks':  recurringBlocks,
  'routines':          routines,
  'tasks':             tasks,
  'exceptions':        exceptions,
  'day-assignments':   dayAssignments,
  'days':              days,
  'year':              year,
};

export default async function handler(req, res) {
  // req.query.path is an array of catchall segments. The first one
  // is the resource name; the rest (if any) are passed through to the
  // handler via the URL but the handlers only inspect req.query for
  // ?id, ?op, etc. — they don't care about extra path segments.
  const segments = Array.isArray(req.query?.path) ? req.query.path : [];
  const resource = segments[0];

  if (!resource) {
    return res.status(404).json({
      error: 'no resource',
      hint: 'try /api/v2/health',
    });
  }

  const fn = HANDLERS[resource];
  if (!fn) {
    return res.status(404).json({
      error: `unknown resource: ${resource}`,
      available: Object.keys(HANDLERS),
    });
  }

  return fn(req, res);
}
