import React, { useEffect, useMemo, useState } from 'react';
import { MiniWheel } from '../taskometer/WheelView.jsx';
import { readSharedWheelFromHash } from '../services/wheelShare.js';
import '../taskometer/taskometer.css';
import './marketing.css';

/**
 * /share — landing page for a shared wheel link.
 *
 * Reads the URL fragment (#w=…), decodes the packed wheel, renders a
 * preview, and offers two paths:
 *   "Save to my taskometer" — drops the wheel into the user's
 *     localStorage wheel library and redirects to /app.
 *   "Open in app" — same redirect without saving (preview-only).
 *
 * No auth, no backend, no DB. Tier 0 of the community feature.
 */

const STORAGE_KEY = 'taskometer-settings';

export default function SharePage() {
  const [wheel, setWheel] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const decoded = readSharedWheelFromHash();
    if (!decoded) {
      setError("This link doesn't contain a valid shared wheel.");
      return;
    }
    setWheel(decoded);
  }, []);

  const slotsForMini = useMemo(
    () => (wheel?.blocks || []).map(b => ({
      startTime: b.startTime,
      endTime: b.endTime,
      color: b.color || wheel.color,
    })),
    [wheel],
  );

  const handleSave = () => {
    if (!wheel) return;
    try {
      // Read the existing settings blob, append the wheel, write back.
      // Mirrors the shape used by services/api/TaskometerAPI's wheels.add.
      const raw = localStorage.getItem(STORAGE_KEY);
      const settings = raw ? JSON.parse(raw) : {};
      const wheels = Array.isArray(settings.wheels) ? settings.wheels : [];
      const id = `shared_${Date.now().toString(36)}`;
      wheels.push({
        id,
        name: wheel.name,
        color: wheel.color,
        blocks: wheel.blocks,
        category: 'Shared',
      });
      settings.wheels = wheels;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      // Brief delay so the user sees the success state before redirecting.
      setTimeout(() => { window.location.href = '/app'; }, 700);
    } catch (err) {
      setError("Couldn't save — try opening the app and pasting the URL there.");
    }
  };

  return (
    <div className="tm-paper mk-page">
      <header className="mk-nav">
        <a href="/" className="mk-brand">taskometer</a>
        <nav className="mk-nav-links">
          <a href="/">Home</a>
          <a href="/app" className="tm-btn tm-primary tm-sm mk-cta-link">Open app →</a>
        </nav>
      </header>

      <section className="mk-hero" style={{ paddingTop: 60, paddingBottom: 40 }}>
        <div className="mk-hero-text">
          <div className="mk-mono mk-eyebrow">someone shared a wheel with you</div>
          {error ? (
            <>
              <h1 className="mk-h1" style={{ fontSize: 56 }}>Hmm.</h1>
              <p className="mk-lede">{error}</p>
              <a href="/app" className="tm-btn tm-primary mk-cta">Open the app anyway →</a>
            </>
          ) : !wheel ? (
            <>
              <h1 className="mk-h1" style={{ fontSize: 56 }}>Loading…</h1>
              <p className="mk-lede">Decoding the wheel from the link.</p>
            </>
          ) : (
            <>
              <h1 className="mk-h1" style={{ fontSize: 56 }}>
                "{wheel.name}"
              </h1>
              <p className="mk-lede">
                {wheel.blocks.length} block{wheel.blocks.length === 1 ? '' : 's'}.
                Save it to your library to apply it to a day or share it forward.
              </p>
              <div className="mk-cta-row">
                {saved ? (
                  <span
                    className="tm-btn tm-primary mk-cta"
                    style={{ pointerEvents: 'none' }}
                  >
                    ✓ saved — redirecting…
                  </span>
                ) : (
                  <button
                    type="button"
                    className="tm-btn tm-primary mk-cta"
                    onClick={handleSave}
                  >
                    Save to my taskometer →
                  </button>
                )}
                <a href="/app" className="tm-btn tm-ghost mk-cta">Open the app without saving</a>
              </div>
              <div className="mk-mono mk-fineprint">
                Saving stores a copy of this wheel in your browser's localStorage.
                Nothing is sent to a server.
              </div>
            </>
          )}
        </div>

        {wheel && (
          <div className="mk-hero-art">
            <div className="mk-hero-bigwheel">
              <MiniWheel slots={slotsForMini} size={280} thickness={32} />
              <div className="mk-hero-bigwheel-label">{wheel.name}</div>
            </div>
            {wheel.blocks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', maxWidth: 320 }}>
                {wheel.blocks.slice(0, 6).map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{b.startTime}–{b.endTime}</span>
                    <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.label}
                    </span>
                  </div>
                ))}
                {wheel.blocks.length > 6 && (
                  <div style={{ color: 'var(--ink-mute)' }}>+ {wheel.blocks.length - 6} more</div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="mk-footer">
        <div className="mk-mono">© taskometer · share schedules with the community</div>
        <div className="mk-footer-links">
          <a href="/">Home</a>
          <a href="/app">App</a>
          <a href="/pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
