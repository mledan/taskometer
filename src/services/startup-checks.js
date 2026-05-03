/**
 * Boot-time configuration checks.
 *
 * Runs once on app start, walks the env vars we care about, and
 * console.warns the operator about anything missing. Each warning
 * names the variable, what feature it unlocks, and which section of
 * SETUP.md to follow.
 *
 * Does not throw — every degradation is graceful at runtime. The
 * warnings just save the operator from wondering why the "Sign in"
 * button does nothing.
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

const CHECKS = [
  {
    key: 'VITE_CLERK_PUBLISHABLE_KEY',
    feature: 'Clerk authentication',
    section: 'SETUP.md §2 — Clerk',
    impact: 'sign-in button is hidden; checkout falls back to anonymous email entry',
    present: () => !!env.VITE_CLERK_PUBLISHABLE_KEY,
  },
  {
    key: 'VITE_STRIPE_PRICE_PRO',
    feature: 'Stripe Pro plan checkout',
    section: 'SETUP.md §1 — Stripe',
    impact: '/pricing Pro CTA falls back to a mailto',
    present: () => !!env.VITE_STRIPE_PRICE_PRO,
  },
  {
    key: 'VITE_STRIPE_PRICE_TEAM',
    feature: 'Stripe Team plan checkout',
    section: 'SETUP.md §1 — Stripe',
    impact: 'Team CTA stays as a mailto (it does anyway in v1)',
    present: () => !!env.VITE_STRIPE_PRICE_TEAM,
    severity: 'info', // expected for now
  },
  // The comments backend is detected at request time, not at build,
  // so we can't hard-check it from the SPA. We rely on /api/comments
  // returning 503 to flip SharePage into local-only mode and show
  // the disclosure copy there. No frontend env var needed.
];

const STYLE_HEAD = 'color:#D4663A;font-weight:700;font-size:13px';
const STYLE_KEY  = 'color:#D4663A;font-family:JetBrains Mono,monospace';
const STYLE_DIM  = 'color:#8A8078';

export function runStartupChecks() {
  if (typeof window === 'undefined' || typeof console === 'undefined') return;

  // Skip in jsdom / vitest unless explicitly opted in.
  if (env.MODE === 'test' && !env.VITE_VERBOSE_STARTUP) return;

  const missing = CHECKS.filter(c => !c.present());
  if (missing.length === 0) {
    // eslint-disable-next-line no-console
    console.log('%c[taskometer] all configured surfaces are wired up', STYLE_HEAD);
    return;
  }

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[taskometer] startup config — ${missing.length} feature${missing.length === 1 ? '' : 's'} not wired up`,
    STYLE_HEAD,
  );
  for (const check of missing) {
    // eslint-disable-next-line no-console
    console.warn(
      `%c${check.key}%c is unset → %c${check.feature}%c disabled.\n  Effect: ${check.impact}\n  Fix: ${check.section}`,
      STYLE_KEY,
      STYLE_DIM,
      STYLE_KEY,
      STYLE_DIM,
    );
  }
  // eslint-disable-next-line no-console
  console.log('%cSee SETUP.md at the repo root for step-by-step instructions.', STYLE_DIM);
  // eslint-disable-next-line no-console
  console.groupEnd();
}
