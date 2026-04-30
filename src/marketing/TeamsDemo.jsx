import React, { useMemo, useState } from 'react';
import { MiniWheel } from '../taskometer/WheelView.jsx';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import '../taskometer/taskometer.css';
import './marketing.css';

/**
 * Mocked enterprise dashboard. Read-only — no backend wired up. Shows
 * what a Teams plan would look like: shared wheels, per-member rhythms,
 * aggregate "where the team's time goes" bar, an Outlook-sync teaser.
 *
 * Data is hand-built here so the page stands alone. When we ship a real
 * Teams plan, this becomes the demo route for prospects.
 */

const TEAM = [
  { name: 'Aly Chen',     role: 'Eng Lead',    wheelId: 'famous_buffett',     focus: 'Architecture · 1:1s' },
  { name: 'Marcus Reyes', role: 'PM',          wheelId: 'famous_cook',        focus: 'Roadmap · Standups' },
  { name: 'Priya Shah',   role: 'Designer',    wheelId: 'famous_kafka',       focus: 'Deep work · Reviews' },
  { name: 'Jules Park',   role: 'Eng',         wheelId: 'system_pomodoro',    focus: 'Coding · Pairing' },
  { name: 'Sam Okafor',   role: 'Eng',         wheelId: 'system_early_bird',  focus: 'Backend · Oncall' },
  { name: 'Rae Lin',      role: 'Customer',    wheelId: 'famous_franklin',    focus: 'Calls · Demos' },
];

const TEAM_AGGREGATE = [
  { id: 'deep',     name: 'Deep work',    color: '#D4663A', mins: 1820 },
  { id: 'meetings', name: 'Meetings',     color: '#A8BF8C', mins: 1140 },
  { id: 'admin',    name: 'Admin',        color: '#D9C98C', mins: 540 },
  { id: 'breaks',   name: 'Breaks',       color: '#C7BEDD', mins: 320 },
  { id: 'planning', name: 'Planning',     color: '#F2C4A6', mins: 480 },
  { id: 'oncall',   name: 'On-call',      color: '#6B46C1', mins: 200 },
];

function fmtH(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TeamsDemo() {
  const [scope, setScope] = useState('week');
  const wheelById = useMemo(() => {
    const map = new Map();
    for (const w of FAMOUS_WHEELS) map.set(w.id, w);
    return map;
  }, []);

  const totalMins = TEAM_AGGREGATE.reduce((acc, t) => acc + t.mins, 0);

  return (
    <div className="tm-paper mk-page">
      <header className="mk-nav">
        <a href="/" className="mk-brand">taskometer</a>
        <nav className="mk-nav-links">
          <a href="/">Home</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#sync">Outlook sync</a>
          <a href="#pricing">Pricing</a>
          <a href="/app" className="tm-btn tm-primary tm-sm mk-cta-link">Open app →</a>
        </nav>
      </header>

      {/* HERO ──────────────────────────────────────────────────────────── */}
      <section className="mk-hero">
        <div className="mk-hero-text">
          <div className="mk-mono mk-eyebrow">taskometer · teams</div>
          <h1 className="mk-h1">
            Your team's day,<br />
            <span className="mk-h1-accent">in one wheel.</span>
          </h1>
          <p className="mk-lede">
            Shared rhythms beat shared calendars. Paint a "no-meeting Tuesday"
            once and the whole team sees it. Sync to Outlook so meetings
            can't crash your focus blocks. See where the team's time actually
            went — not where it was supposed to go.
          </p>
          <div className="mk-cta-row">
            <a href="#pricing" className="tm-btn tm-primary mk-cta">
              See pricing
            </a>
            <a href="/app" className="tm-btn tm-ghost mk-cta">
              Try the solo app first →
            </a>
          </div>
          <div className="mk-mono mk-fineprint">
            demo dashboard below — data is illustrative · live product coming soon
          </div>
        </div>
      </section>

      {/* DASHBOARD ─────────────────────────────────────────────────────── */}
      <section id="dashboard" className="mk-section mk-dashboard">
        <div className="mk-dash-head">
          <div>
            <h2 className="mk-h2 mk-h2-tight">Acme Engineering · this week</h2>
            <div className="mk-mono mk-section-sub">6 teammates · 4,500 minutes scheduled</div>
          </div>
          <div className="tm-seg">
            {['day', 'week', 'month', 'quarter'].map(s => (
              <button
                key={s}
                type="button"
                className={scope === s ? 'tm-on' : ''}
                onClick={() => setScope(s)}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Aggregate bar */}
        <div className="mk-card">
          <div className="mk-card-head">
            <span className="mk-card-title">Where the team's time goes</span>
            <span className="mk-mono">{fmtH(totalMins)} this {scope}</span>
          </div>
          <div className="mk-stack">
            {TEAM_AGGREGATE.map(c => (
              <div
                key={c.id}
                className="mk-stack-seg"
                style={{ flex: c.mins, background: c.color }}
                title={`${c.name} — ${fmtH(c.mins)} (${Math.round(c.mins / totalMins * 100)}%)`}
              />
            ))}
          </div>
          <div className="mk-legend">
            {TEAM_AGGREGATE.map(c => (
              <div key={c.id} className="mk-legend-item">
                <span className="mk-legend-dot" style={{ background: c.color }} />
                <span>{c.name}</span>
                <span className="mk-mono mk-legend-pct">{Math.round(c.mins / totalMins * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team grid */}
        <div className="mk-card">
          <div className="mk-card-head">
            <span className="mk-card-title">Team rhythms</span>
            <span className="mk-mono">tap a teammate to view their week</span>
          </div>
          <div className="mk-team-grid">
            {TEAM.map(member => {
              const wheel = wheelById.get(member.wheelId);
              const slotsForMini = (wheel?.blocks || []).map(b => ({
                startTime: b.startTime, endTime: b.endTime, color: b.color,
              }));
              return (
                <div key={member.name} className="mk-team-card">
                  <MiniWheel slots={slotsForMini} size={72} thickness={9} />
                  <div className="mk-team-card-text">
                    <div className="mk-team-card-name">{member.name}</div>
                    <div className="mk-mono mk-team-card-role">{member.role}</div>
                    <div className="mk-team-card-focus">{member.focus}</div>
                    <div className="mk-mono mk-team-card-shape">shape · {wheel?.name || 'Custom'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shared shapes */}
        <div className="mk-card">
          <div className="mk-card-head">
            <span className="mk-card-title">Shared shapes</span>
            <span className="mk-mono">applied across the team's calendars</span>
          </div>
          <div className="mk-shared">
            {[
              { name: 'No-Meeting Tuesday',  color: '#A8BF8C', desc: 'Heads-down. No internal meetings 9–4.' },
              { name: 'Sprint Demo Friday',  color: '#D4663A', desc: 'Demo at 11, retro at 2, beers at 4.' },
              { name: 'On-Call Rotation',    color: '#6B46C1', desc: 'Pager block 9–9 for the on-call eng.' },
              { name: 'All-Hands Wednesday', color: '#F2C4A6', desc: 'Company sync 10–11. No 1:1s before.' },
            ].map(s => (
              <div key={s.name} className="mk-shared-card" style={{ borderColor: s.color }}>
                <div className="mk-shared-head">
                  <span className="mk-shared-dot" style={{ background: s.color }} />
                  <span className="mk-shared-name">{s.name}</span>
                </div>
                <div className="mk-shared-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OUTLOOK SYNC ──────────────────────────────────────────────────── */}
      <section id="sync" className="mk-section">
        <h2 className="mk-h2">Two-way Outlook sync</h2>
        <div className="mk-syncgrid">
          <SyncCard
            title="Pull meetings into the wheel"
            body="Outlook events appear as wedges on your day, automatically. See your real day, not the planned one."
          />
          <SyncCard
            title="Push focus blocks to Outlook"
            body="Paint a deep-work block in taskometer. It writes to Outlook as a tentative event so colleagues can't book over it."
          />
          <SyncCard
            title="Team-wide rules"
            body="Shared shapes apply to every team member's calendar. Change once, sync everywhere."
          />
        </div>
      </section>

      {/* PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="mk-section">
        <h2 className="mk-h2">Pricing</h2>
        <div className="mk-pricing">
          <PriceCard
            tier="Solo"
            price="$0"
            cadence="forever"
            features={[
              'Unlimited wheels',
              'Day, week, month, quarter, year views',
              'iCalendar export',
              'Local-only — your data stays on your device',
            ]}
            cta="Try free"
            href="/app"
            ghost
          />
          <PriceCard
            tier="Team"
            price="$8"
            cadence="per seat / month"
            features={[
              'Everything in Solo',
              'Shared shapes across the team',
              'Two-way Outlook & Google Calendar sync',
              'Team rhythm dashboard',
              'Admin controls',
            ]}
            cta="Coming soon — join waitlist"
            href="mailto:hello@taskometer.app?subject=Team plan waitlist"
            featured
          />
          <PriceCard
            tier="Enterprise"
            price="Custom"
            cadence="annual contracts"
            features={[
              'Everything in Team',
              'SSO (Okta, Azure AD)',
              'SCIM provisioning',
              'Audit logs & data residency',
              'Dedicated success manager',
            ]}
            cta="Contact sales"
            href="mailto:sales@taskometer.app?subject=Enterprise inquiry"
          />
        </div>
      </section>

      <footer className="mk-footer">
        <div className="mk-mono">© taskometer · for teams that share a rhythm</div>
        <div className="mk-footer-links">
          <a href="/">Home</a>
          <a href="/app">App</a>
          <a href="https://github.com/mledan/taskometer" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  );
}

function SyncCard({ title, body }) {
  return (
    <div className="mk-sync-card">
      <div className="mk-sync-title">{title}</div>
      <div className="mk-sync-body">{body}</div>
    </div>
  );
}

function PriceCard({ tier, price, cadence, features, cta, href, featured, ghost }) {
  return (
    <div className={`mk-price-card${featured ? ' mk-price-card-featured' : ''}`}>
      <div className="mk-price-tier">{tier}</div>
      <div className="mk-price-amount">{price}</div>
      <div className="mk-mono mk-price-cadence">{cadence}</div>
      <ul className="mk-price-features">
        {features.map(f => <li key={f}>{f}</li>)}
      </ul>
      <a
        href={href}
        className={`tm-btn ${featured ? 'tm-primary' : ghost ? 'tm-ghost' : ''} mk-cta`}
      >
        {cta}
      </a>
    </div>
  );
}
