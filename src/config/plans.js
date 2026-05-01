/**
 * Plan tier definitions. Single source of truth for what the free
 * tier covers, what Pro and Team unlock, and where Stripe lookups
 * find the price ids.
 *
 * Stripe price ids come from build-time env vars so we don't bake
 * actual ids into the bundle. Set them in Vercel → Project Settings:
 *   VITE_STRIPE_PRICE_PRO
 *   VITE_STRIPE_PRICE_TEAM
 *
 * Server-side (api/*) reads STRIPE_SECRET_KEY from the Vercel runtime
 * env — never exposed to the client.
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    headline: 'Solo, local-first.',
    monthlyUSD: 0,
    cadence: 'forever',
    stripePriceId: null,
    limits: {
      sharedWheels: 10,        // lifetime
      sharedRhythms: 5,        // lifetime
      apiRequestsPerHour: 60,
      teamSeats: 0,
      featuredPlacement: false,
      customProfile: false,
      outlookSync: false,
    },
    features: [
      'Unlimited local wheels and rhythms (your data stays on your device)',
      'Up to 10 publicly shared wheels',
      'Up to 5 publicly shared rhythms',
      'Apply any public wheel from the community',
      'iCalendar (.ics) export',
    ],
    cta: 'Try it free',
    href: '/app',
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    headline: 'For people who share a lot.',
    monthlyUSD: 5,
    cadence: 'per month',
    stripePriceId: env.VITE_STRIPE_PRICE_PRO || null,
    limits: {
      sharedWheels: Infinity,
      sharedRhythms: Infinity,
      apiRequestsPerHour: 600,
      teamSeats: 0,
      featuredPlacement: true,
      customProfile: true,
      outlookSync: false,
    },
    features: [
      'Everything in Free',
      'Unlimited shared wheels and rhythms',
      'Custom profile color and avatar',
      'Eligibility for Featured placement',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
  },

  team: {
    id: 'team',
    name: 'Team',
    headline: 'Shared rhythms across your group.',
    monthlyUSD: 12,
    cadence: 'per seat / month',
    stripePriceId: env.VITE_STRIPE_PRICE_TEAM || null,
    limits: {
      sharedWheels: Infinity,
      sharedRhythms: Infinity,
      apiRequestsPerHour: 6000,
      teamSeats: Infinity,
      featuredPlacement: true,
      customProfile: true,
      outlookSync: true,
    },
    features: [
      'Everything in Pro',
      'Shared rhythms across the whole team',
      'Outlook two-way sync (when it ships)',
      'Admin controls and role-based wedge colors',
      'Audit log',
    ],
    cta: 'Talk to us',
    href: 'mailto:hello@taskometer.app?subject=Team%20plan',
  },
};

export const PLAN_ORDER = ['free', 'pro', 'team'];

/** Whether a price id is wired up for the given plan in this build. */
export function planIsCheckoutReady(planId) {
  const p = PLANS[planId];
  return !!(p && p.stripePriceId);
}

/** Format the monthly price for display. */
export function formatPrice(plan) {
  if (plan.monthlyUSD === 0) return 'Free';
  return `$${plan.monthlyUSD}`;
}
