/**
 * Resolve the caller's ownerId for a given request.
 *
 * Three identity tiers, in order of preference:
 *
 *   1. Clerk session — Authorization: Bearer <token>
 *      → ownerId = clerk userId, persistent
 *   2. Ephemeral device — X-Device-Id: eph_<uuid>
 *      → ownerId = "eph_<uuid>", auto-expires (Cosmos TTL)
 *   3. Anonymous fallback — only when Clerk isn't configured
 *      → ownerId = "anon" (dev / pre-auth)
 *
 * Routes use:
 *   const ownerId = await resolveOwner(req);   // for reads
 *   const ownerId = await requireOwner(req, res);  // for writes
 *
 * The repos read `ownerId` to scope every operation. Ephemeral and
 * Clerk owners never collide because of the prefix scheme:
 *   "user_2abc..."   → Clerk
 *   "eph_<uuid>"     → ephemeral device
 *   "anon"           → dev
 */

import { isClerkConfigured, verifyAuth } from './clerk.js';

export const ANON_OWNER = 'anon';
export const EPH_PREFIX = 'eph_';
const EPH_RE = /^eph_[A-Za-z0-9_-]{8,64}$/;

/** True when an ownerId belongs to an ephemeral (auto-expiring) device. */
export function isEphemeralOwner(ownerId) {
  return typeof ownerId === 'string' && ownerId.startsWith(EPH_PREFIX);
}

/**
 * Pull the device id from the X-Device-Id header. Returns null unless
 * it matches the expected eph_<id> shape — anything else is rejected
 * to keep clients from minting arbitrary owner ids.
 */
function readDeviceId(req) {
  const raw = req.headers?.['x-device-id'] || req.headers?.['X-Device-Id'];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return EPH_RE.test(trimmed) ? trimmed : null;
}

export async function resolveOwner(req) {
  // Tier 1: Clerk-authenticated user
  if (isClerkConfigured()) {
    const ident = await verifyAuth(req);
    if (ident?.userId) return ident.userId;
  }
  // Tier 2: Ephemeral device id
  const device = readDeviceId(req);
  if (device) return device;
  // Tier 3: Pre-auth fallback (only when Clerk isn't configured at all)
  if (!isClerkConfigured()) return ANON_OWNER;
  return null;
}

/** Convenience for write routes — sends 401 + returns null on failure. */
export async function requireOwner(req, res) {
  const owner = await resolveOwner(req);
  if (!owner) {
    res.status(401).json({ error: 'sign-in or device-id required' });
    return null;
  }
  return owner;
}

