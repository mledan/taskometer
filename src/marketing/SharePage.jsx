import React, { useEffect, useMemo, useState } from 'react';
import { MiniWheel } from '../taskometer/WheelView.jsx';
import { readSharedWheelFromHash } from '../services/wheelShare.js';
import '../taskometer/taskometer.css';
import './marketing.css';

/**
 * Per-wheel comment thread. The thread key is the share-fragment hash
 * itself — same wheel link → same thread. Today comments are stored
 * locally; when the community backend ships the same UI flips to
 * real persistence by swapping the readThread/writeThread functions.
 */
const COMMENT_KEY_PREFIX = 'taskometer.comments.';

function threadKeyFromHash() {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/[#&]w=([A-Za-z0-9_-]+)/);
  return m ? m[1].slice(0, 32) : null;
}
function readThread(key) {
  try {
    const raw = localStorage.getItem(COMMENT_KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}
function writeThread(key, list) {
  try { localStorage.setItem(COMMENT_KEY_PREFIX + key, JSON.stringify(list)); } catch (_) {}
}

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

      {wheel && (
        <section className="mk-section" style={{ paddingTop: 30 }}>
          <Comments />
        </section>
      )}

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

/**
 * Comments thread for the currently-shared wheel. Local-only for now;
 * the UI is the contract that won't change when the backend lands.
 *
 * Notes on the local-only mode:
 *   - Comments only persist on the device that wrote them.
 *   - The "scaffold" banner is honest about that.
 *   - The thread key is the URL fragment so opening the same share
 *     link comes back to the same comments — locally.
 */
function Comments() {
  const [thread, setThread] = useState([]);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('taskometer.comments.name') || ''; } catch (_) { return ''; }
  });
  const [body, setBody] = useState('');
  const key = useMemo(threadKeyFromHash, []);

  useEffect(() => {
    if (key) setThread(readThread(key));
  }, [key]);

  if (!key) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    const entry = {
      id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: (name || 'Anonymous').trim().slice(0, 40),
      body: body.trim().slice(0, 1000),
      ts: new Date().toISOString(),
    };
    const next = [...thread, entry];
    setThread(next);
    writeThread(key, next);
    try { localStorage.setItem('taskometer.comments.name', entry.name); } catch (_) {}
    setBody('');
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 className="mk-h2" style={{ marginBottom: 6 }}>What do you think?</h2>
      <p className="mk-mono mk-fineprint" style={{ marginBottom: 18 }}>
        Comments scaffold — stored on this device only for now. When the
        community feature ships these become a real shared thread per
        wheel link.
      </p>

      <form onSubmit={submit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 14,
        border: '1.5px solid var(--rule)',
        borderRadius: 12,
        background: 'var(--paper)',
        marginBottom: 18,
      }}>
        <input
          className="tm-composer-input"
          placeholder="your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          style={{ fontSize: 14, padding: '6px 8px' }}
        />
        <textarea
          className="tm-composer-input"
          placeholder='what works? what would you tweak? "I love how the morning is broken into…"'
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
          style={{ fontSize: 14, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span className="mk-mono" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
            {body.length}/1000
          </span>
          <button
            type="submit"
            className="tm-btn tm-primary"
            disabled={!body.trim()}
          >
            Post comment
          </button>
        </div>
      </form>

      {thread.length === 0 ? (
        <div className="mk-mono" style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>
          No comments yet — be the first.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {thread.slice().reverse().map(c => (
            <div
              key={c.id}
              style={{
                padding: '12px 14px',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                background: 'var(--paper)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'baseline' }}>
                <strong style={{ fontFamily: 'Caveat, cursive', fontSize: 20, color: 'var(--ink)' }}>
                  {c.name || 'Anonymous'}
                </strong>
                <span className="mk-mono" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                  {new Date(c.ts).toLocaleString('en', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  }).toLowerCase()}
                </span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {c.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
