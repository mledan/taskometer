import React, { useState } from 'react';
import { PLANS, PLAN_ORDER, planIsCheckoutReady, formatPrice } from '../config/plans.js';
import { CLERK_ENABLED } from '../services/auth.js';
import '../taskometer/taskometer.css';
import './marketing.css';
// These imports are tree-shaken when CLERK_ENABLED is false at runtime,
// but the static import is required so the bundle compiles either way.
// Only the components that actually render touch the Clerk runtime.
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth as useClerkAuth,
} from '@clerk/clerk-react';

/**
 * Public pricing page at /pricing.
 *
 * The "Upgrade" buttons POST to /api/checkout-session which redirects
 * the user to Stripe Checkout. If Stripe isn't wired up in this build
 * the buttons fall back to a friendly "Coming soon — get notified"
 * mailto so the page never has dead CTAs in production.
 */
export default function Pricing() {
  return (
    <div className="tm-paper mk-page">
      <header className="mk-nav">
        <a href="/" className="mk-brand">taskometer</a>
        <nav className="mk-nav-links">
          <a href="/">Home</a>
          <a href="/teams">Teams</a>
          <a href="/app" className="tm-btn tm-primary tm-sm mk-cta-link">Open app →</a>
        </nav>
      </header>

      <section className="mk-section" style={{ borderTop: 'none', paddingTop: 60 }}>
        <h1 className="mk-h2" style={{ marginBottom: 4 }}>Simple, honest pricing.</h1>
        <p className="mk-lede" style={{ maxWidth: 640 }}>
          Start free. The local app is genuinely free forever — your data lives in
          your browser, no account required. If you want to share schedules with
          the community or your team, the paid plans cover the cost of running
          the cloud side.
        </p>

        <div className="mk-pricing">
          {PLAN_ORDER.map(id => (
            <PlanCard key={id} plan={PLANS[id]} featured={id === 'pro'} />
          ))}
        </div>

        <p className="mk-mono mk-fineprint" style={{ marginTop: 24 }}>
          No long contracts · cancel anytime · usage above plan limits is metered
          and billed monthly via Stripe.
        </p>
      </section>

      <section className="mk-section">
        <h2 className="mk-h2">Why we charge for sharing.</h2>
        <p className="mk-lede" style={{ maxWidth: 720 }}>
          The local app costs us nothing to run because it runs on your machine.
          The community feature — publishing wheels, browsing what others share,
          team-wide rhythms — runs on Azure. Cosmos DB, Functions, Application
          Insights. Those bills come due. The paid plans are how we pay for the
          consumption your usage drives without selling your data or running
          ads.
        </p>
        <p className="mk-lede" style={{ maxWidth: 720 }}>
          We use <strong>serverless tiers</strong> on the backend so the cost
          scales with your usage automatically. Quiet weeks cost us
          (and therefore you) almost nothing.
        </p>
      </section>

      <footer className="mk-footer">
        <div className="mk-mono">© taskometer · pricing that mirrors actual cost</div>
        <div className="mk-footer-links">
          <a href="/">Home</a>
          <a href="/app">App</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({ plan, featured }) {
  const ready = planIsCheckoutReady(plan.id);
  const isPaid = plan.monthlyUSD > 0;

  // Free → renders an <a> to /app, no special handling.
  if (!isPaid) {
    return <CardShell plan={plan} featured={featured}>
      <a href={plan.href} className="tm-btn tm-ghost mk-cta">{plan.cta}</a>
    </CardShell>;
  }

  // Team → mailto, no checkout flow yet.
  if (plan.id === 'team') {
    return <CardShell plan={plan} featured={featured}>
      <a href={plan.href} className="tm-btn mk-cta">{plan.cta}</a>
    </CardShell>;
  }

  // Pro path. Auth gate when Clerk is on; otherwise checkout-or-mailto.
  return <CardShell plan={plan} featured={featured}>
    {CLERK_ENABLED ? (
      <>
        <SignedIn>
          <ProCheckoutButton plan={plan} ready={ready} featured={featured} />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" forceRedirectUrl="/pricing">
            <button type="button" className={`tm-btn ${featured ? 'tm-primary' : ''} mk-cta`}>
              Sign in to upgrade
            </button>
          </SignInButton>
        </SignedOut>
      </>
    ) : (
      <ProCheckoutButton plan={plan} ready={ready} featured={featured} />
    )}
    {!ready && (
      <div className="mk-mono" style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)' }}>
        (early access — email us to start a subscription)
      </div>
    )}
  </CardShell>;
}

function CardShell({ plan, featured, children }) {
  return (
    <div className={`mk-price-card${featured ? ' mk-price-card-featured' : ''}`}>
      <div className="mk-price-tier">{plan.name}</div>
      <div className="mk-price-amount">{formatPrice(plan)}</div>
      <div className="mk-mono mk-price-cadence">{plan.cadence}</div>
      <div className="mk-mono" style={{ color: 'var(--ink-mute)', marginTop: 4 }}>
        {plan.headline}
      </div>
      <ul className="mk-price-features">
        {plan.features.map(f => <li key={f}>{f}</li>)}
      </ul>
      {children}
    </div>
  );
}

/**
 * Authenticated checkout starter. When Clerk is wired, we POST to
 * /api/checkout-session with the user's session token in the
 * Authorization header so the server can attach userId to Stripe
 * metadata. Falls back to a mailto when STRIPE_PRICE_PRO isn't set.
 */
function ProCheckoutButton({ plan, ready, featured }) {
  const [busy, setBusy] = useState(false);
  // useClerkAuth is only safe when ClerkProvider is mounted. The
  // <SignedIn> wrapper above guarantees that; the non-Clerk branch
  // calls this component without a wrapper, so we guard here too.
  const clerkAuth = CLERK_ENABLED ? useClerkAuth() : null;

  const handleClick = async (e) => {
    e.preventDefault();
    if (busy) return;

    if (!ready) {
      window.location.href = `mailto:hello@taskometer.app?subject=Notify%20me%20when%20${encodeURIComponent(plan.name)}%20launches`;
      return;
    }

    setBusy(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (clerkAuth?.getToken) {
        const token = await clerkAuth.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId: plan.id }),
      });
      if (!res.ok) throw new Error(`checkout failed: ${res.status}`);
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(
        'We couldn\'t start the checkout. Email hello@taskometer.app and we\'ll set you up manually.',
      );
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
      {busy ? 'redirecting…' : plan.cta}
    </button>
  );
}
