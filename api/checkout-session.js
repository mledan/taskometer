/**
 * POST /api/checkout-session
 *
 * Body: { planId: 'pro' | 'team' }
 * Returns: { url: string } — Stripe-hosted checkout URL
 *
 * Env vars (set in Vercel):
 *   STRIPE_SECRET_KEY     — server-only, never exposed to the client
 *   STRIPE_PRICE_PRO      — price_xxx for the Pro plan
 *   STRIPE_PRICE_TEAM     — price_xxx for the Team plan (if used here)
 *   PUBLIC_BASE_URL       — e.g. https://taskometer.vercel.app
 *
 * If STRIPE_SECRET_KEY is not configured the endpoint returns 503 so
 * the client can fall back to a mailto. The pricing page checks
 * VITE_STRIPE_PRICE_PRO at build time and won't even POST if it's
 * missing — but the server check guards against a partial config.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(503).json({ error: 'billing not configured' });
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

  // Lazy-load the Stripe SDK so unconfigured deployments don't pay
  // the cold-start cost of importing it.
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/app?checkout=success`,
      cancel_url:  `${baseUrl}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      // Capture an email so the webhook can attach the subscription
      // to a user record once accounts ship.
      customer_creation: 'always',
      billing_address_collection: 'auto',
      metadata: { planId },
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ kind: 'checkout', planId, sessionId: session.id }));
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ kind: 'checkout-error', message: err?.message }));
    return res.status(500).json({ error: 'could not create checkout session' });
  }
}
