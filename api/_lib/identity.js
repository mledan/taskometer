/**
 * Resolve the caller's ownerId for a given request.
 *
 *   - Clerk configured AND token present → Clerk userId
 *   - Clerk configured AND no/invalid token → null (caller decides)
 *   - Clerk not configured → ANON_OWNER (so dev/pre-auth works end-to-end)
 *
 * Routes use:
 *   const ownerId = await resolveOwner(req);   // for reads
 *   const ownerId = await requireOwner(req, res);  // for writes
 */

import { isClerkConfigured, verifyAuth } from './clerk.js';

export const ANON_OWNER = 'anon';

export async function resolveOwner(req) {
  if (!isClerkConfigured()) return ANON_OWNER;
  const ident = await verifyAuth(req);
  return ident?.userId || null;
}

/** Convenience for write routes — sends 401 + returns null on failure. */
export async function requireOwner(req, res) {
  const owner = await resolveOwner(req);
  if (!owner) {
    res.status(401).json({ error: 'sign-in required' });
    return null;
  }
  return owner;
}
