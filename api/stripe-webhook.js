/**
 * POST /api/stripe-webhook
 *
 * Handles Stripe lifecycle events:
 *   - checkout.session.completed         → grant Pro/Team access
 *   - customer.subscription.updated      → propagate plan changes
 *   - customer.subscription.deleted      → revoke access
 *   - invoice.payment_failed             → flag dunning state
 *
 * Env vars:
 *   STRIPE_SECRET_KEY        — server-only
 *   STRIPE_WEBHOOK_SECRET    — whsec_xxx, signs every payload
 *
 * IMPORTANT: Stripe webhooks must be verified by signature. We read
 * the raw request body to compute the HMAC; Vercel's body parser
 * doesn't expose raw bytes by default, so we set
 *   export const config = { api: { bodyParser: false } };
 * and read the stream ourselves.
 *
 * Until accounts and a real users database exist this handler logs
 * a structured event instead of mutating user state. Once the user
 * model lands, swap the TODO blocks for actual writes.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    return res.status(503).end();
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'missing stripe-signature' });
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ kind: 'stripe-webhook-bad-signature', message: err?.message }));
    return res.status(400).json({ error: 'invalid signature' });
  }

  // Log every event as structured JSON so the Vercel function log
  // becomes a passive audit trail until we have a real DB.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    kind: 'stripe-event',
    type: event.type,
    id: event.id,
    customer: event.data?.object?.customer || null,
    metadata: event.data?.object?.metadata || null,
  }));

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const clerkUserId = session?.metadata?.clerkUserId
        || session?.client_reference_id
        || null;
      const planId = session?.metadata?.planId || null;
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({
        kind: 'plan-upgrade',
        clerkUserId,
        planId,
        stripeCustomerId: session?.customer || null,
        subscriptionId: session?.subscription || null,
      }));
      // TODO: when the user store ships, attach planId to the user
      // identified by clerkUserId here. Until then this log line is
      // the source of truth.
      break;
    }

    case 'customer.subscription.updated': {
      // TODO: propagate plan price changes / quantity updates.
      break;
    }

    case 'customer.subscription.deleted': {
      // TODO: downgrade user to free.
      break;
    }

    case 'invoice.payment_failed': {
      // TODO: flag the user as in dunning, surface a banner in the SPA.
      break;
    }

    default:
      break;
  }

  return res.status(200).json({ received: true });
}
