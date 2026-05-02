/**
 * Single source of truth for whether Clerk is wired into this build.
 *
 *   VITE_CLERK_PUBLISHABLE_KEY  — set at build time → CLERK_ENABLED true
 *   (unset)                     → CLERK_ENABLED false; the app behaves
 *                                 the same as before this integration.
 *
 * Components that gate behavior on the auth provider import these
 * constants and short-circuit when Clerk is off. Server-side, the
 * checkout / webhook routes do the same with CLERK_SECRET_KEY.
 *
 * The integration philosophy: never make auth a hard dependency. The
 * solo / local-first product works fine without an account; Clerk
 * shows up only when a user wants to share, upgrade, or sync.
 */

export const CLERK_PUBLISHABLE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY) || null;

export const CLERK_ENABLED = !!CLERK_PUBLISHABLE_KEY;

/** Convenience for code that wants to short-circuit before importing Clerk components. */
export function isClerkConfigured() {
  return CLERK_ENABLED;
}
