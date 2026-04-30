import React, { useState } from 'react';

const STORAGE_KEY = 'taskometer.auth';

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

export default function WelcomePopup({ onDone }) {
  const [view, setView] = useState('welcome');
  // Local-only profile. We do not collect a password because we have no
  // server to store it on. When auth ships for real, this form swaps to
  // an OAuth handoff — no plaintext credentials in localStorage.
  const [form, setForm] = useState({
    firstName: '',
    email: '',
  });

  const pickGuest = () => {
    onDone?.();
  };

  const setField = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    writeAuth({
      mode: 'account',
      profile: {
        firstName: form.firstName.trim(),
        email: form.email.trim() || null,
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
              Welcome to taskometer.
            </div>
            <div style={{ fontSize: 22, color: 'var(--ink-mute)' }}>Shape your day. Loop it forward.</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
              <button className="tm-btn tm-primary" onClick={() => setView('signup')}>
                Create account
              </button>
              <button className="tm-btn tm-ghost" onClick={pickGuest}>
                Continue as guest
              </button>
            </div>
          </div>
        )}

        {view === 'signup' && (
          <form onSubmit={submit}>
            <div className="tm-modal-head">
              <div className="tm-modal-title">Save your profile</div>
              <button
                type="button"
                className="tm-btn tm-sm"
                onClick={() => setView('welcome')}
                aria-label="back"
              >
                ← Back
              </button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-mute)', marginBottom: 14, lineHeight: 1.5 }}>
              Just a name so the app feels like yours. Email is optional — we'll use it
              if we ever ship cloud sync.
              <br/>
              <strong style={{ color: 'var(--ink)' }}>No password.</strong> Your data lives in this browser, on this device.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="First name" value={form.firstName} onChange={setField('firstName')} autoFocus />
              <Field label="Email (optional)" type="email" value={form.email} onChange={setField('email')} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
              <button type="button" className="tm-btn tm-ghost" onClick={pickGuest}>
                Skip — continue as guest
              </button>
              <button type="submit" className="tm-btn tm-primary" disabled={!form.firstName.trim()}>
                Save profile
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
