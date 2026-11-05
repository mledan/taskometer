import { useState } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
import { CLERK_PUBLISHABLE_KEY } from '../services/auth.js';
import { startCheckout } from './checkout.js';

/**
 * The only Clerk-aware piece of /pricing. Lazy-loaded by Pricing.jsx so
 * the marketing bundle stays Clerk-free; mounts its own ClerkProvider
 * because marketing routes are not wrapped in one.
 */
export default function PricingAuthIsland({ plan, ready, featured }) {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <SignedIn>
        <SignedInCheckoutButton plan={plan} ready={ready} featured={featured} />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal" forceRedirectUrl="/pricing">
          <button type="button" className={`tm-btn ${featured ? 'tm-primary' : ''} mk-cta`}>
            Sign in to upgrade
          </button>
        </SignInButton>
      </SignedOut>
    </ClerkProvider>
  );
}

function SignedInCheckoutButton({ plan, ready, featured }) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await startCheckout({ plan, ready, getToken });
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert("We couldn't start the checkout. Email hello@taskometer.app and we'll set you up manually.");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`tm-btn ${featured ? 'tm-primary' : ''} mk-cta`}
      disabled={busy}
    >
      {busy ? 'Redirecting…' : plan.cta}
    </button>
  );
}
