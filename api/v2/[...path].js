/**
 * /api/v2/[...path] — single-function dispatcher for the v2 surface.
 *
 * Required catchall (single brackets). Double-bracket optional
 * catchall ([[...path]].js) is Next.js syntax and does NOT populate
 * req.query.path in plain Vercel serverless functions — every request
 * comes in with path: undefined and the dispatcher 404s for "no
 * resource". Single-bracket required catchall is the supported
 * Vercel pattern and fills req.query.path correctly.
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
  // Try req.query.path first (Vercel catchall convention). If that's
  // empty/missing, fall back to parsing req.url — works regardless of
  // how Vercel populates query params for catchall routes.
  let segments = Array.isArray(req.query?.path) ? req.query.path : [];
  if (segments.length === 0 && req.url) {
    // req.url is like "/api/v2/health?foo=bar" — strip the prefix
    // and the querystring, then split.
    const pathPart = req.url.split('?')[0];
    const afterPrefix = pathPart.replace(/^\/api\/v2\/?/, '');
    segments = afterPrefix.length > 0 ? afterPrefix.split('/').filter(Boolean) : [];
  }
  const resource = segments[0];

  if (!resource) {
    return res.status(404).json({
      error: 'no resource',
      hint: 'try /api/v2/health',
      debug: { url: req.url, queryPath: req.query?.path },
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
