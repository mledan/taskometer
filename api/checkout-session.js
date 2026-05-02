/**
 * POST /api/checkout-session
 *
 * Body: { planId: 'pro' | 'team' }
 * Headers: Authorization: Bearer <Clerk session token> (required when
 *   CLERK_SECRET_KEY is configured)
 * Returns: { url: string } — Stripe-hosted checkout URL
 *
 * Env vars (set in Vercel):
 *   STRIPE_SECRET_KEY     — server-only, never exposed to the client
 *   STRIPE_PRICE_PRO      — price_xxx for the Pro plan
 *   STRIPE_PRICE_TEAM     — price_xxx for the Team plan (if used here)
 *   PUBLIC_BASE_URL       — e.g. https://taskometer.vercel.app
 *   CLERK_SECRET_KEY      — server-only, when auth is wired up
 *
 * Auth contract:
 *   - Without Clerk configured, anonymous checkout still works (the
 *     session has no client_reference_id; the webhook can't tie the
 *     subscription back to a user). Useful for very early stages and
 *     for the case where the operator hasn't wired Clerk yet.
 *   - With Clerk configured, we REQUIRE a verified token. Otherwise
 *     payments would arrive without an attribution path.
 */
import { isClerkConfigured, verifyAuth } from './_lib/clerk.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(503).json({ error: 'billing not configured' });
  }

  // Require Clerk auth when it's configured. Anonymous checkout is
  // only allowed in the auth-off mode.
  let identity = null;
  if (isClerkConfigured()) {
    identity = await verifyAuth(req);
    if (!identity) return res.status(401).json({ error: 'sign-in required' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const planId = String(body.planId || '');

  const priceMap = {
    pro: process.env.STRIPE_PRICE_PRO,
    team: process.env.STRIPE_PRICE_TEAM,
  };
  const priceId = priceMap[planId];
  if (!priceId) {
    return res.status(400).json({ error: 'unknown plan' });
  }

  const baseUrl = process.env.PUBLIC_BASE_URL
    || `https://${req.headers.host || 'taskometer.vercel.app'}`;

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  try {
    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/app?checkout=success`,
      cancel_url:  `${baseUrl}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      customer_creation: 'always',
      billing_address_collection: 'auto',
      metadata: { planId, ...(identity ? { clerkUserId: identity.userId } : {}) },
    };
    // When we know the email up-front, pre-fill it so the customer
    // doesn't have to retype it. Stripe still verifies it.
    if (identity?.email) sessionParams.customer_email = identity.email;
    if (identity?.userId) sessionParams.client_reference_id = identity.userId;

    const session = await stripe.checkout.sessions.create(sessionParams);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      kind: 'checkout',
      planId,
      sessionId: session.id,
      clerkUserId: identity?.userId || null,
    }));
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ kind: 'checkout-error', message: err?.message }));
    return res.status(500).json({ error: 'could not create checkout session' });
  }
}
