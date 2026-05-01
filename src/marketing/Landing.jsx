import React from 'react';
import { MiniWheel } from '../taskometer/WheelView.jsx';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import '../taskometer/taskometer.css';
import './marketing.css';

/**
 * Marketing landing page. Lives at `/`. Two CTAs: try the app free,
 * or look at the team product. Uses the same paper aesthetic as the app
 * so the brand reads consistent across surfaces.
 */
export default function Landing() {
  // Pick three recognizable wheels for the hero strip — Buffett (CEO),
  // Pomodoro (system), Franklin (historical). Real shapes, not faked.
  const showcase = ['famous_buffett', 'system_pomodoro', 'famous_franklin']
    .map(id => FAMOUS_WHEELS.find(w => w.id === id))
    .filter(Boolean);

  return (
    <div className="tm-paper mk-page">
      <header className="mk-nav">
        <a href="/" className="mk-brand">taskometer</a>
        <nav className="mk-nav-links">
          <a href="#how">How it works</a>
          <a href="#shapes">Shapes</a>
          <a href="/teams">For teams</a>
          <a href="/app" className="tm-btn tm-primary tm-sm mk-cta-link">Open app →</a>
        </nav>
      </header>

      {/* HERO ──────────────────────────────────────────────────────────── */}
      <section className="mk-hero">
        <div className="mk-hero-text">
          <h1 className="mk-h1">
            Lay out your year.<br/>
            <span className="mk-h1-accent">Live the days.</span>
          </h1>
          <p className="mk-lede">
            Most calendars start at "today" and ask you to fill it in.
            Taskometer starts at "your year" and asks what repeats. Define
            your rhythms once — weekly standups, monthly reviews, quarterly
            planning — and the year paints itself. Then drop tasks on top.
          </p>
          <div className="mk-cta-row">
            <a href="/app/year" className="tm-btn tm-primary mk-cta">
              Build your year →
            </a>
            <a href="/teams" className="tm-btn tm-ghost mk-cta">
              For teams →
            </a>
          </div>
          <div className="mk-mono mk-fineprint">
            free forever for solo · team plans for shared rhythms
          </div>
        </div>

        <div className="mk-hero-art">
          <div className="mk-hero-bigwheel">
            <MiniWheel
              slots={(showcase[0]?.blocks || []).map(b => ({
                startTime: b.startTime, endTime: b.endTime, color: b.color,
              }))}
              size={280}
              thickness={32}
            />
            <div className="mk-hero-bigwheel-label">{showcase[0]?.name || 'Workday'}</div>
          </div>
          <div className="mk-hero-mini">
            {showcase.slice(1).map(w => (
              <div key={w.id} className="mk-hero-mini-card">
                <MiniWheel
                  slots={(w.blocks || []).map(b => ({
                    startTime: b.startTime, endTime: b.endTime, color: b.color,
                  }))}
                  size={84}
                  thickness={11}
                />
                <span className="mk-mono mk-hero-mini-name">{w.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how" className="mk-section">
        <h2 className="mk-h2">Three moves. That's it.</h2>
        <div className="mk-steps">
          <Step
            n="01"
            title="Pick a shape"
            body="Workday, weekend, travel day, sprint week. Pre-built wheels from Buffett to Pomodoro, or roll your own."
          />
          <Step
            n="02"
            title="Paint your week"
            body="Drag a shape onto any day. Apply to all weekdays. Override Friday for that conference. The wheel makes it visual."
          />
          <Step
            n="03"
            title="Drop in tasks"
            body="Type what you need to do — taskometer slots it into the right block automatically. Your day fills itself."
          />
        </div>
      </section>

      {/* SHAPES SHOWCASE ───────────────────────────────────────────────── */}
      <section id="shapes" className="mk-section">
        <div className="mk-section-head">
          <h2 className="mk-h2">A shape for every kind of day.</h2>
          <p className="mk-mono mk-section-sub">
            Famous wheels, productivity systems, and your own — all clickable in the picker.
          </p>
        </div>
        <div className="mk-grid">
          {FAMOUS_WHEELS.slice(0, 12).map(w => (
            <div key={w.id} className="mk-grid-card">
              <MiniWheel
                slots={(w.blocks || []).map(b => ({
                  startTime: b.startTime, endTime: b.endTime, color: b.color,
                }))}
                size={72}
                thickness={9}
              />
              <div className="mk-grid-card-text">
                <div className="mk-grid-card-name">{w.name}</div>
                <div className="mk-mono mk-grid-card-cat">{w.category}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="/app" className="tm-btn tm-primary mk-cta">
            See all shapes in the app →
          </a>
        </div>
      </section>

      {/* TEAMS TEASER ──────────────────────────────────────────────────── */}
      <section className="mk-section mk-teams-teaser">
        <div>
          <div className="mk-mono mk-eyebrow">For teams</div>
          <h2 className="mk-h2">Your team's rhythm, in one wheel.</h2>
          <p className="mk-lede">
            Shared shapes. Outlook two-way sync. A dashboard showing where
            the team's time actually went. No more "Tuesday is no-meeting
            day" buried in a Slack pinned message.
          </p>
          <a href="/teams" className="tm-btn tm-primary mk-cta">
            See the team dashboard →
          </a>
        </div>
        <div className="mk-teams-art">
          <MiniWheel
            slots={(FAMOUS_WHEELS.find(w => w.id === 'famous_cook')?.blocks || []).map(b => ({
              startTime: b.startTime, endTime: b.endTime, color: b.color,
            }))}
            size={200}
            thickness={22}
          />
        </div>
      </section>

      <footer className="mk-footer">
        <div className="mk-mono">© taskometer · shape your day, loop it forward</div>
        <div className="mk-footer-links">
          <a href="/app">App</a>
          <a href="/teams">Teams</a>
          <a href="/pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div className="mk-step">
      <div className="mk-step-n">{n}</div>
      <div className="mk-step-title">{title}</div>
      <div className="mk-step-body">{body}</div>
    </div>
  );
}
