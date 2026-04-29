import React, { useState } from 'react';

const STORAGE_KEY = 'smartcircle.auth';

export function readAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function writeAuth(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

export function clearAuth() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

const RHYTHMS = [
  {
    id: 'lion',
    name: 'Lion',
    tagline: 'Up before sunrise. Crushes mornings.',
    wheelId: 'system_early_bird',
    color: '#F59E0B',
    icon: '🦁',
  },
  {
    id: 'bear',
    name: 'Bear',
    tagline: 'Steady, sun-aligned. The classic 9-to-5.',
    wheelId: 'default_weekday',
    color: '#A8BF8C',
    icon: '🐻',
  },
  {
    id: 'wolf',
    name: 'Wolf',
    tagline: "Comes alive at night. Best work after dark.",
    wheelId: 'system_night_owl',
    color: '#7C3AED',
    icon: '🐺',
  },
  {
    id: 'dolphin',
    name: 'Dolphin',
    tagline: 'Bursty, rhythmic. Pomodoros in short waves.',
    wheelId: 'system_pomodoro',
    color: '#06B6D4',
    icon: '🐬',
  },
];

export default function WelcomePopup({ onDone, onPickWheel }) {
  const [view, setView] = useState('welcome');
  const [form, setForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    birthday: '',
    email: '',
    password: '',
  });

  const pickGuest = () => {
    // Intentionally NOT persisted — guest state is session-only, so refreshing
    // re-prompts and resets the workspace.
    onDone?.();
  };

  const pickRhythm = (rhythm) => {
    if (rhythm?.wheelId) onPickWheel?.(rhythm.wheelId);
    onDone?.();
  };

  const setField = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const required = ['username', 'firstName', 'lastName', 'birthday', 'email', 'password'];
    for (const k of required) {
      if (!form[k]?.trim()) return;
    }
    writeAuth({
      mode: 'account',
      profile: {
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthday: form.birthday,
        email: form.email.trim(),
      },
      createdAt: new Date().toISOString(),
    });
    onDone?.();
  };

  return (
    <div className="tm-modal-backdrop" role="dialog" aria-modal="true" aria-label="welcome">
      <div
        className="tm-modal"
        style={{
          maxWidth: 560,
          width: 'min(560px, 92vw)',
          minHeight: 'min(560px, 88vh)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '32px 36px',
        }}
      >
        {view === 'welcome' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="tm-modal-title" style={{ fontSize: 42 }}>
              Welcome to Smart Circle!
            </div>
            <div style={{ fontSize: 26 }}>The Better Scheduler.</div>
            <div style={{ fontSize: 16, color: 'var(--ink-mute)', maxWidth: 400, margin: '0 auto', fontFamily: 'inherit' }}>
              Browse as a Guest, or create an account to save your selections.
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
              <button className="tm-btn tm-primary" onClick={() => setView('signup')}>
                Log In / Create Account
              </button>
              <button className="tm-btn tm-ghost" onClick={() => setView('rhythm')}>
                Continue as Guest
              </button>
            </div>
          </div>
        )}

        {view === 'rhythm' && (
          <div>
            <div className="tm-modal-head">
              <div className="tm-modal-title">What's your rhythm?</div>
              <button
                type="button"
                className="tm-btn tm-sm"
                onClick={() => setView('welcome')}
                aria-label="back"
              >
                ← Back
              </button>
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-mute)', marginBottom: 14, lineHeight: 1.45 }}>
              Pick the chronotype that sounds most like you. We'll load a matching wheel — you can change it anytime.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {RHYTHMS.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickRhythm(r)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '14px 14px',
                    border: `2px solid ${r.color}`,
                    borderRadius: 12,
                    background: 'var(--paper)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transition: 'transform 0.1s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-warm, #FAF5EC)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--paper)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{r.icon}</span>
                    <span style={{ fontFamily: 'Caveat, cursive', fontSize: 26, color: r.color, lineHeight: 1 }}>
                      {r.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.35 }}>
                    {r.tagline}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="tm-btn tm-ghost tm-sm" onClick={pickGuest}>
                skip — I'll pick my own
              </button>
            </div>
          </div>
        )}

        {view === 'signup' && (
          <form onSubmit={submit}>
            <div className="tm-modal-head">
              <div className="tm-modal-title">Create Your Account</div>
              <button
                type="button"
                className="tm-btn tm-sm"
                onClick={() => setView('welcome')}
                aria-label="back"
              >
                ← Back
              </button>
            </div>
            <div style={{ fontSize: 16, color: 'var(--ink-mute)', marginBottom: 14 }}>
              Tell us only the basics.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Username" value={form.username} onChange={setField('username')} autoFocus />
              <Field label="Email" type="email" value={form.email} onChange={setField('email')} />
              <Field label="First Name" value={form.firstName} onChange={setField('firstName')} />
              <Field label="Last Name" value={form.lastName} onChange={setField('lastName')} />
              <Field label="Birthday" type="date" value={form.birthday} onChange={setField('birthday')} />
              <Field label="Password" type="password" value={form.password} onChange={setField('password')} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
              <button type="button" className="tm-btn tm-ghost" onClick={pickGuest}>
                Skip — Continue as Guest
              </button>
              <button type="submit" className="tm-btn tm-primary">
                Create Account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', autoFocus }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>{label}</span>
      <input
        className="tm-composer-input"
        type={type}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        required
        style={{ fontSize: 16, padding: '6px 8px' }}
      />
    </label>
  );
}
