/**
 * AuthCorner — minimal sign-in / user-menu pair for the marketing
 * nav and app header.
 *
 *   signed out → "Sign in" + "Sign up" buttons (Clerk modals)
 *   signed in  → Clerk's <UserButton /> avatar/menu
 *
 * Renders nothing if Clerk isn't configured (lets builds without
 * VITE_CLERK_PUBLISHABLE_KEY keep working).
 *
 * Dev-only debug: a tiny "device id" chip is shown to anonymous
 * users when ?debug=1 is in the URL — handy for poking around the
 * ephemeral flow without inspecting localStorage.
 */

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { CLERK_ENABLED } from '../services/auth.js';
import { getDeviceId } from '../services/identity.js';

export default function AuthCorner({ compact = false } = {}) {
  if (!CLERK_ENABLED) return null;

  const showDebug = typeof window !== 'undefined'
    && window.location?.search?.includes('debug=1');

  const linkStyle = {
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    textDecoration: 'underline dotted',
    padding: 0,
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 8 : 12 }}>
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" style={linkStyle} aria-label="Sign in">Sign in</button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className="tm-btn tm-primary tm-sm">Sign up</button>
        </SignUpButton>
        {showDebug && <DeviceChip />}
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  );
}

function DeviceChip() {
  const id = getDeviceId();
  if (!id) return null;
  return (
    <code
      title="ephemeral device id (X-Device-Id) — auto-expires in 24h unless you sign up"
      style={{
        fontSize: 11,
        opacity: 0.55,
        padding: '2px 6px',
        border: '1px solid var(--rule-soft, #ddd)',
        borderRadius: 4,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {id.slice(0, 12)}…
    </code>
  );
}
