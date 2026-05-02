#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-shot Stripe setup. Idempotent.
 *
 * Creates the taskometer Pro and Team products + prices in whichever
 * Stripe account your STRIPE_SECRET_KEY belongs to. Safe to re-run:
 * looks up products by `metadata.tk_id` and reuses them if found,
 * otherwise creates fresh.
 *
 * Usage
 * -----
 *   # macOS / Linux
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/setup-stripe.js
 *
 *   # PowerShell
 *   $env:STRIPE_SECRET_KEY="sk_test_xxx"; node scripts/setup-stripe.js
 *
 * Output
 * ------
 *   Prints the price IDs you should set as Vercel env vars:
 *     STRIPE_PRICE_PRO=price_xxx
 *     STRIPE_PRICE_TEAM=price_xxx
 *     VITE_STRIPE_PRICE_PRO=price_xxx
 *     VITE_STRIPE_PRICE_TEAM=price_xxx
 *
 * The script makes no destructive changes — it never modifies an
 * existing product's price. If you want to change a price, archive
 * the old one in the dashboard first (Stripe convention).
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('STRIPE_SECRET_KEY is required. Set it in your shell and rerun.');
  process.exit(1);
}
if (!KEY.startsWith('sk_')) {
  console.error('STRIPE_SECRET_KEY does not look like a Stripe secret key (expected sk_test_... or sk_live_...).');
  process.exit(1);
}

const isLive = KEY.startsWith('sk_live_');
console.log(`Using ${isLive ? 'LIVE' : 'TEST'} mode key.`);
if (isLive) {
  console.log('⚠  Live mode — real money. Ctrl-C now if you meant test mode.');
}

const stripe = new Stripe(KEY, { apiVersion: '2024-06-20' });

// Idempotency tag: each product carries metadata.tk_id so re-runs
// find existing products instead of creating duplicates.
const SPECS = [
  {
    tkId: 'pro',
    name: 'taskometer Pro',
    description: 'Unlimited shared wheels and rhythms, custom profile, eligibility for Featured placement.',
    price: {
      currency: 'usd',
      unit_amount: 500, // $5.00
      recurring: { interval: 'month' },
      nickname: 'Pro · monthly',
    },
  },
  {
    tkId: 'team',
    name: 'taskometer Team',
    description: 'Shared rhythms across the team, Outlook sync (when shipped), admin controls, audit log. Per-seat billing.',
    price: {
      currency: 'usd',
      unit_amount: 1200, // $12.00
      recurring: { interval: 'month' },
      nickname: 'Team · per-seat / monthly',
    },
  },
];

async function findProductByTag(tkId) {
  // Stripe doesn't expose metadata search via the standard list call,
  // so we paginate — fine for a small catalog.
  for await (const product of stripe.products.list({ limit: 100, active: true })) {
    if (product.metadata?.tk_id === tkId) return product;
  }
  return null;
}

async function findActiveRecurringPrice(productId) {
  for await (const price of stripe.prices.list({ product: productId, active: true, limit: 100 })) {
    if (price.recurring) return price;
  }
  return null;
}

async function ensureProduct(spec) {
  let product = await findProductByTag(spec.tkId);
  if (product) {
    console.log(`✓ product exists: ${spec.name} (${product.id})`);
  } else {
    product = await stripe.products.create({
      name: spec.name,
      description: spec.description,
      metadata: { tk_id: spec.tkId },
    });
    console.log(`+ created product: ${spec.name} (${product.id})`);
  }

  let price = await findActiveRecurringPrice(product.id);
  if (price) {
    const matches =
      price.unit_amount === spec.price.unit_amount &&
      price.currency === spec.price.currency &&
      price.recurring?.interval === spec.price.recurring.interval;
    if (matches) {
      console.log(`✓ price exists:   ${price.id} (${price.unit_amount / 100} ${price.currency.toUpperCase()}/${price.recurring.interval})`);
    } else {
      console.log(`! price drift on ${spec.name}: kept existing ${price.id}. Archive it in the dashboard if you want to switch.`);
    }
  } else {
    price = await stripe.prices.create({
      product: product.id,
      currency: spec.price.currency,
      unit_amount: spec.price.unit_amount,
      recurring: spec.price.recurring,
      nickname: spec.price.nickname,
    });
    console.log(`+ created price:  ${price.id} (${price.unit_amount / 100} ${price.currency.toUpperCase()}/${price.recurring.interval})`);
  }

  return { product, price };
}

(async () => {
  const out = {};
  for (const spec of SPECS) {
    const { price } = await ensureProduct(spec);
    out[spec.tkId] = price.id;
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log('Set these in Vercel project settings:');
  console.log('─'.repeat(60));
  console.log(`STRIPE_PRICE_PRO=${out.pro}`);
  console.log(`STRIPE_PRICE_TEAM=${out.team}`);
  console.log(`VITE_STRIPE_PRICE_PRO=${out.pro}`);
  console.log(`VITE_STRIPE_PRICE_TEAM=${out.team}`);
  console.log('');
  console.log('Don\'t forget STRIPE_SECRET_KEY (server) and STRIPE_WEBHOOK_SECRET');
  console.log('(after you create the webhook in the Stripe dashboard).');
})().catch(err => {
  console.error('failed:', err.message);
  process.exit(1);
});
