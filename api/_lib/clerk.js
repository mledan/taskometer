/**
 * Server-side Clerk helpers. Lives under api/_lib so Vercel doesn't
 * try to expose it as a route (anything starting with _ is ignored
 * by the file-based router).
 *
 * verifyAuth(req) returns { userId, email } when the request carries
 * a valid Clerk session token in the Authorization header. Returns
 * null when the request is anonymous, the token is invalid, or
 * Clerk isn't configured on this deployment. Callers decide whether
 * that's acceptable for their endpoint.
 */

import { createClerkClient, verifyToken } from '@clerk/backend';

let _client = null;
function clerk() {
  if (!process.env.CLERK_SECRET_KEY) return null;
  if (!_client) {
    _client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  }
  return _client;
}

export function isClerkConfigured() {
  return !!process.env.CLERK_SECRET_KEY;
}

/**
 * Verify the Authorization: Bearer <token> header on an incoming
 * request. Resolves to { userId, email } on success, null otherwise.
 *
 * Email is fetched from the Clerk users.get() call when verification
 * succeeds — useful for pre-filling Stripe Checkout.
 */
export async function verifyAuth(req) {
  if (!isClerkConfigured()) return null;
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const userId = claims?.sub;
    if (!userId) return null;

    let email = null;
    try {
      const user = await clerk().users.getUser(userId);
      email = user?.primaryEmailAddress?.emailAddress
        || user?.emailAddresses?.[0]?.emailAddress
        || null;
    } catch (_) {
      // User-info fetch is best-effort. We still trust the token's
      // userId even if the email lookup fails.
    }

    return { userId, email };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('verifyAuth failed:', err?.message);
    return null;
  }
}
