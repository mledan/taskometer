/**
 * /api/v2/claim — promote an ephemeral device's data to a Clerk user.
 *
 * POST /api/v2/claim
 *   headers: Authorization: Bearer <clerk-token>
 *   body:    { deviceId: "eph_<uuid>" }
 *
 * Triggered by the SPA the moment a user finishes Clerk sign-up. We
 * walk all 6 v2 containers, find every doc with ownerId === deviceId,
 * rewrite each to ownerId === clerkUserId, and strip the TTL so the
 * data sticks permanently.
 *
 * Returns:
 *   { claimed: { blocks: 12, routines: 3, ... }, totalDocs: 27 }
 *
 * Idempotent: re-running with the same deviceId is a no-op (the docs
 * have already moved partitions).
 */

import { repos } from '../_lib/repo/index.js';
import { verifyAuth, isClerkConfigured } from '../_lib/clerk.js';
import { isEphemeralOwner } from '../_lib/identity.js';

const RESOURCE_KEYS = [
  'blocks', 'recurringBlocks', 'routines',
  'tasks', 'dayAssignments', 'exceptions',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  // Claim requires real auth — no anon fallback. If Clerk isn't
  // configured the endpoint refuses outright (there's no real user
  // to claim FOR).
  if (!isClerkConfigured()) {
    return res.status(503).json({ error: 'auth not configured' });
  }
  const ident = await verifyAuth(req);
  if (!ident?.userId) {
    return res.status(401).json({ error: 'sign-in required' });
  }
  const clerkUserId = ident.userId;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  if (!isEphemeralOwner(deviceId)) {
    return res.status(400).json({ error: 'deviceId required (eph_*)' });
  }

  // Walk every container in parallel — all reassignOwner calls are
  // independent partition operations.
  const r = repos();
  const results = await Promise.all(
    RESOURCE_KEYS.map(async (k) => {
      const count = await r[k].reassignOwner({
        fromOwnerId: deviceId,
        toOwnerId: clerkUserId,
      });
      return [k, count];
    }),
  );

  const claimed = Object.fromEntries(results);
  const totalDocs = results.reduce((sum, [, c]) => sum + c, 0);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    kind: 'claim',
    deviceId,
    clerkUserId,
    totalDocs,
    claimed,
  }));

  return res.status(200).json({ claimed, totalDocs });
}
