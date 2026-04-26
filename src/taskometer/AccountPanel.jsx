import React, { useState } from 'react';
import { readAuth, writeAuth, clearAuth } from './WelcomePopup.jsx';

/**
 * Account modal. Two faces:
 *  - Guest:    "you're browsing as a guest" + create-account CTA
 *  - Account:  profile fields (editable), member-since, sign out, delete
 */
export default function AccountPanel({ onClose, onSignOut, onCreateAccount }) {
  const auth = readAuth();
  const isAccount = auth?.mode === 'account';
  const [profile, setProfile] = useState(auth?.profile || {
    username: '', firstName: '', lastName: '', birthday: '', email: '',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (k) => (e) => setProfile(p => ({ ...p, [k]: e.target.value }));

  const save = (e) => {
    e?.preventDefault?.();
    writeAuth({ ...auth, profile });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const signOut = () => {
    if (!window.confirm('sign out? guest sessions reset on refresh — your data may not persist.')) return;
    clearAuth();
    onSignOut?.();
  };

  const deleteAccount = () => {
    const ok = window.confirm('delete your account? this clears your profile and local data. this cannot be undone.');
    if (!ok) return;
    try {
      // Wipe profile and any taskometer-* data, mirror of guest reset
      clearAuth();
      const tmKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('taskometer-') || k.startsWith('smartcircle.') || k === 'state')) tmKeys.push(k);
      }
      for (const k of tmKeys) localStorage.removeItem(k);
    } catch (_) {}
    window.location.reload();
  };

  return (
    <div
      className="tm-modal-backdrop"
      role="dialog"
      aria-label="account"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="tm-modal" style={{ maxWidth: 520, padding: '24px 28px' }}>
        <div className="tm-modal-head">
          <div className="tm-modal-title">{isAccount ? 'Your Account' : 'Guest Session'}</div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose} aria-label="close">close</button>
        </div>

        {!isAccount && (
          <>
            <div style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 14 }}>
              You're browsing as a guest. Anything you build will reset the next time you refresh.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="tm-btn tm-ghost" onClick={onClose}>
                keep browsing
              </button>
              <button
                type="button"
                className="tm-btn tm-primary"
                onClick={() => { onClose?.(); onCreateAccount?.(); }}
              >
                Create an Account
              </button>
            </div>
          </>
        )}

        {isAccount && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                background: 'var(--paper-warm, #FAF5EC)',
                border: '1.5px solid var(--rule)',
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--orange)', color: 'var(--paper)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Caveat, cursive', fontSize: 32, fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {(profile.firstName?.[0] || profile.username?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'Caveat, cursive', fontSize: 26, lineHeight: 1, color: 'var(--ink)' }}>
                  {profile.firstName} {profile.lastName}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-mute)', marginTop: 2 }}>
                  @{profile.username}
                </div>
              </div>
              <button
                type="button"
                className="tm-btn tm-sm"
                onClick={() => setEditing(v => !v)}
              >
                {editing ? 'cancel' : 'edit'}
              </button>
            </div>

            <form onSubmit={save}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Username" value={profile.username} onChange={setField('username')} disabled={!editing} />
                <Field label="Email" type="email" value={profile.email} onChange={setField('email')} disabled={!editing} />
                <Field label="First Name" value={profile.firstName} onChange={setField('firstName')} disabled={!editing} />
                <Field label="Last Name" value={profile.lastName} onChange={setField('lastName')} disabled={!editing} />
                <Field label="Birthday" type="date" value={profile.birthday} onChange={setField('birthday')} disabled={!editing} />
                <ReadOnlyField
                  label="Member since"
                  value={auth?.createdAt ? new Date(auth.createdAt).toLocaleDateString() : '—'}
                />
              </div>
              {editing && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button type="submit" className="tm-btn tm-primary tm-sm">save changes</button>
                </div>
              )}
              {saved && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-mute)', textAlign: 'right' }}>
                  saved ✓
                </div>
              )}
            </form>

            <hr style={{ border: 'none', borderTop: '1px dashed var(--rule)', margin: '20px 0 14px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
                Manage your session.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="tm-btn tm-sm" onClick={signOut}>
                  sign out
                </button>
                <button
                  type="button"
                  className="tm-btn tm-sm tm-danger"
                  onClick={deleteAccount}
                >
                  delete account
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: 0.6 }}>
        {label}
      </span>
      <input
        className="tm-composer-input"
        type={type}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        style={{
          fontSize: 15,
          padding: '6px 8px',
          opacity: disabled ? 0.85 : 1,
          background: disabled ? 'transparent' : 'var(--paper)',
        }}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: 0.6 }}>
        {label}
      </span>
      <div
        style={{
          fontSize: 15,
          padding: '6px 8px',
          color: 'var(--ink-mute)',
          fontFamily: 'inherit',
        }}
      >
        {value}
      </div>
    </div>
  );
}
