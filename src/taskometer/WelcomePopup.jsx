import React, { useState } from 'react';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { CLERK_ENABLED } from '../services/auth.js';

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
  emitAuthChange();
}

export function clearAuth() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  emitAuthChange();
}

/**
 * Custom event other components listen for to re-read taskometer.auth.
 * The native `storage` event only fires across windows, not the
 * window that wrote — so we emit our own.
 */
export const AUTH_EVENT = 'taskometer:auth-changed';
function emitAuthChange() {
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new Event(AUTH_EVENT)); } catch (_) {}
  }
}

/**
 * First-visit welcome.
 *
 *   CLERK_ENABLED   → "Create account" opens Clerk's hosted sign-up
 *                     modal (real auth, real email verification, no
 *                     password handling on our side).
 *   CLERK disabled  → falls through to the legacy two-view flow:
 *                     name-only profile saved to localStorage. Keeps
 *                     zero-config local dev working.
 *
 * Either way "Continue as guest" leaves the user anonymous; the
 * server's ephemeral identity (X-Device-Id, 24h Cosmos TTL) covers
 * anything they create as a guest.
 */
export default function WelcomePopup({ onDone }) {
  const [view, setView] = useState('welcome');
  const [form, setForm] = useState({ firstName: '', email: '' });

  const pickGuest = () => onDone?.();
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
              {CLERK_ENABLED ? (
                <SignUpButton mode="modal" forceRedirectUrl="/app" signInForceRedirectUrl="/app">
                  <button className="tm-btn tm-primary">Create account</button>
                </SignUpButton>
              ) : (
                <button className="tm-btn tm-primary" onClick={() => setView('signup')}>
                  Create account
                </button>
              )}
              <button className="tm-btn tm-ghost" onClick={pickGuest}>
                Continue as guest
              </button>
            </div>
            {CLERK_ENABLED && (
              <>
                <div style={{ fontSize: 14, color: 'var(--ink-mute)', marginTop: 4 }}>
                  Already have an account?{' '}
                  <SignInButton mode="modal" forceRedirectUrl="/app" signUpForceRedirectUrl="/app">
                    <button
                      type="button"
                      className="tm-link-button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--orange)',
                        cursor: 'pointer',
                        font: 'inherit',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      Sign in
                    </button>
                  </SignInButton>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 8, lineHeight: 1.5 }}>
                  Guests can use everything. We hold the data for the day —
                  sign up before midnight to keep it.
                </div>
              </>
            )}
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
