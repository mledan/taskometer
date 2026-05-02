import React from 'react';
import '../taskometer/taskometer.css';
import './marketing.css';

/**
 * Two-page legal surface — Privacy and Terms. The actual content here
 * matters because taskometer is genuinely local-only today; we're not
 * dressing up a tracking SaaS, we're stating what the app does.
 *
 * If/when a backend ships, both pages need a hard rewrite — see the
 * "What changes when we add accounts" section in each.
 */

export function Privacy() {
  return (
    <LegalShell title="Privacy" subtitle="Updated 2026-04-30">
      <Section heading="What we collect">
        <p>
          Today, <strong>nothing leaves your browser</strong>. Taskometer is a
          single-page app that stores everything — wheels, blocks, tasks,
          settings — in your browser's <code>localStorage</code> on the
          device you're using.
        </p>
        <p>
          We don't run a backend. We don't have a database. We can't read
          your data because we never receive it.
        </p>
      </Section>

      <Section heading="What we don't collect">
        <ul>
          <li>No accounts, no passwords, no email lists.</li>
          <li>No third-party analytics scripts. No Google, Meta, Mixpanel, etc.</li>
          <li>No cookies (other than what your browser may set on its own).</li>
          <li>No advertising, no ad targeting, ever.</li>
          <li>No content of your wheels, rhythms, or tasks — those stay in your browser.</li>
          <li>No IP-address logging, no user agents stored.</li>
        </ul>
      </Section>

      <Section heading="What we collect — feature-usage telemetry">
        <p>
          When you use the app on the deployed site, we log a small set
          of <strong>feature-usage events</strong> to our server logs:
          which feature was triggered (e.g. <code>rhythm:added</code>,
          <code>wheel:applied</code>, <code>task:add</code>), a timestamp,
          and a per-tab session id that lives only in your browser's
          <code>sessionStorage</code>.
        </p>
        <p>
          We do <strong>not</strong> log the contents of your wheels,
          rhythms, or tasks. We don't log your IP address, user agent,
          or any personal identifier. Logs are written to Vercel function
          logs and rotate automatically.
        </p>
        <p>
          The same in-memory ring buffer is still available in DevTools
          via <code>__tm.dump()</code> for bug reports. In local
          development (<code>localhost</code>) nothing leaves your
          machine.
        </p>
      </Section>

      <Section heading="Hosting and processors">
        <p>
          The site is hosted on Vercel. Vercel sees standard request
          metadata (IP address, user agent) for HTTP requests, governed by{' '}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Vercel's privacy policy
          </a>.
        </p>
        <p>
          When you sign in to a paid plan we use{' '}
          <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">
            Clerk
          </a>{' '}
          to manage authentication and{' '}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
            Stripe
          </a>{' '}
          to handle payments. They store the data they need (your email
          address with Clerk; your payment method with Stripe) and we
          store only the minimum identifiers needed to associate your
          plan with your account.
        </p>
      </Section>

      <Section heading="What changes when we add accounts">
        <p>
          When taskometer ships real auth and cloud sync, this page will
          change to disclose what we collect, where it lives, and how to
          delete it. We'll also notify existing users in-app before any
          data leaves your browser.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions: open an issue on{' '}
          <a href="https://github.com/mledan/taskometer" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>
      </Section>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms" subtitle="Updated 2026-04-30">
      <Section heading="The short version">
        <p>
          Taskometer is provided <strong>as-is</strong>, free, with no
          warranty. Use it for any lawful purpose. If your data disappears,
          we feel bad but cannot replace it — see "Backups" below.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <ul>
          <li>Anything legal in your jurisdiction.</li>
          <li>Don't use the app to plan or coordinate harm.</li>
          <li>Don't try to break the hosted site for other users.</li>
        </ul>
      </Section>

      <Section heading="Backups">
        <p>
          Your data lives in your browser. Clearing site data, switching
          browsers, or losing your device deletes it. Use Settings → Export
          (.ics) to back up your schedule periodically.
        </p>
      </Section>

      <Section heading="No warranty, no liability">
        <p>
          The app is provided without warranty of any kind, express or
          implied. The authors are not liable for any damages arising from
          its use.
        </p>
      </Section>

      <Section heading="Future paid plans">
        <p>
          If we ship paid plans (Team, Enterprise), those will have separate
          terms governing the parts of the service that involve money or
          server-side data. Today there are no paid plans.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms. Material changes will be flagged on the
          marketing page for at least 30 days before taking effect.
        </p>
      </Section>
    </LegalShell>
  );
}

function LegalShell({ title, subtitle, children }) {
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
        <h1 className="mk-h2" style={{ marginBottom: 4 }}>{title}</h1>
        <div className="mk-mono" style={{ marginBottom: 32 }}>{subtitle}</div>
        <div style={{ maxWidth: 720, fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
          {children}
        </div>
      </section>

      <footer className="mk-footer">
        <div className="mk-mono">© taskometer · local-first scheduling</div>
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

function Section({ heading, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontFamily: 'Caveat, cursive',
        fontSize: 30,
        lineHeight: 1.1,
        color: 'var(--ink)',
        margin: '0 0 10px',
        fontWeight: 600,
      }}>
        {heading}
      </h2>
      {children}
    </div>
  );
}
