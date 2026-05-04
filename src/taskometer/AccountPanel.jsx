import React, { useState } from 'react';
import { SignInButton, SignUpButton, useClerk } from '@clerk/clerk-react';
import { readAuth, writeAuth, clearAuth } from './WelcomePopup.jsx';
import { CLERK_ENABLED } from '../services/auth.js';

/**
 * Account modal. Two faces:
 *  - Guest:    "you're browsing as a guest" + create-account CTA
 *  - Account:  profile fields (editable), member-since, sign out, delete
 */
export default function AccountPanel({
  onClose,
  onSignOut,
  onCreateAccount,
  onOpenSettings,
  onManageWheels,
  onExportIcs,
  onReplayTour,
}) {
  const auth = readAuth();
  const isAccount = auth?.mode === 'account' || auth?.mode === 'clerk';
  const isClerkAccount = auth?.mode === 'clerk';
  const [profile, setProfile] = useState(auth?.profile || {
    username: '', firstName: '', lastName: '', birthday: '', email: '',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // useClerk() requires ClerkProvider in the tree. When Clerk isn't
  // wired (zero-config local dev) we render this panel without the
  // provider — so we delegate the Clerk-specific actions to a small
  // sub-component (<ClerkActions />) that only mounts when enabled.
  // For Clerk users that's where signOut + openUserProfile live; the
  // panel itself just sets a target via refs.
  const clerkActionsRef = React.useRef({ signOut: null, openUserProfile: null });

  const setField = (k) => (e) => setProfile(p => ({ ...p, [k]: e.target.value }));

  const save = (e) => {
    e?.preventDefault?.();
    // Clerk-managed profiles can't be edited inline — that's a Clerk
    // feature (avatar upload, email verification, password). For
    // those, defer to clerk.openUserProfile().
    if (isClerkAccount) {
      clerkActionsRef.current.openUserProfile?.();
      setEditing(false);
      return;
    }
    writeAuth({ ...auth, profile });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const signOut = async () => {
    if (isClerkAccount) {
      // Sign-out is reversible — data lives under the Clerk userId,
      // not the device, so signing back in restores everything.
      await clerkActionsRef.current.signOut?.();
      onSignOut?.();
      return;
    }
    if (!window.confirm('sign out? guest sessions reset on refresh — your data may not persist.')) return;
    clearAuth();
    onSignOut?.();
  };

  const deleteAccount = () => {
    if (isClerkAccount) {
      // Clerk's UserProfile dialog has a "Delete account" section
      // (security tab). Account deletion has to go through Clerk so
      // their identity record is destroyed too — wiping just the
      // local mirror would leave a zombie Clerk account behind.
      clerkActionsRef.current.openUserProfile?.();
      return;
    }
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
        {CLERK_ENABLED && <ClerkActions actionsRef={clerkActionsRef} />}
        <div className="tm-modal-head">
          <div className="tm-modal-title">{isAccount ? 'Your Account' : 'Guest Session'}</div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose} aria-label="close">close</button>
        </div>

        {!isAccount && (
          <>
            <div style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 14 }}>
              You're browsing as a guest. Your data is held for the day —
              sign up before midnight to keep it.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="tm-btn tm-ghost" onClick={onClose}>
                keep browsing
              </button>
              {CLERK_ENABLED ? (
                <SignUpButton mode="modal" forceRedirectUrl="/app">
                  <button type="button" className="tm-btn tm-primary">
                    Create an Account
                  </button>
                </SignUpButton>
              ) : (
                <button
                  type="button"
                  className="tm-btn tm-primary"
                  onClick={() => { onClose?.(); onCreateAccount?.(); }}
                >
                  Create an Account
                </button>
              )}
            </div>
            {CLERK_ENABLED && (
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 10, textAlign: 'right' }}>
                Already have an account?{' '}
                <SignInButton mode="modal" forceRedirectUrl="/app">
                  <button
                    type="button"
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
            )}

            <ActionList
              onClose={onClose}
              onOpenSettings={onOpenSettings}
              onManageWheels={onManageWheels}
              onExportIcs={onExportIcs}
              onReplayTour={onReplayTour}
            />
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
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  width={56}
                  height={56}
                  style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'var(--orange)', color: 'var(--paper)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Inter, system-ui, sans-serif', fontSize: 32, fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {(profile.firstName?.[0] || profile.username?.[0] || '?').toUpperCase()}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 26, lineHeight: 1, color: 'var(--ink)' }}>
                  {profile.firstName} {profile.lastName}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-mute)', marginTop: 2 }}>
                  {isClerkAccount ? profile.email : `@${profile.username}`}
                </div>
              </div>
              <button
                type="button"
                className="tm-btn tm-sm"
                onClick={
                  isClerkAccount
                    ? () => clerkActionsRef.current.openUserProfile?.()
                    : () => setEditing(v => !v)
                }
              >
                {isClerkAccount ? 'manage' : (editing ? 'cancel' : 'edit')}
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

            <ActionList
              onClose={onClose}
              onOpenSettings={onOpenSettings}
              onManageWheels={onManageWheels}
              onExportIcs={onExportIcs}
              onReplayTour={onReplayTour}
            />

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

/**
 * Shared action list — same row group used in both guest and signed-in
 * views. Each entry self-renders if its callback is supplied; the
 * whole block is suppressed if there's nothing to show.
 *
 * The actions came from the header's `⋯` overflow menu (manage wheels,
 * export .ics, replay tour) plus the App-settings deep link. The
 * overflow menu was retired in favor of this consolidated home.
 */
function ActionList({ onClose, onOpenSettings, onManageWheels, onExportIcs, onReplayTour }) {
  const items = [
    onOpenSettings && {
      key: 'settings',
      label: 'App settings — look & feel, behavior, backup',
      run: onOpenSettings,
    },
    onManageWheels && {
      key: 'wheels',
      label: 'Manage schedules',
      run: onManageWheels,
    },
    onExportIcs && {
      key: 'ics',
      label: 'Export calendar (.ics)',
      run: onExportIcs,
    },
    onReplayTour && {
      key: 'tour',
      label: 'Replay tour',
      run: onReplayTour,
    },
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <>
      <hr style={{ border: 'none', borderTop: '1px dashed var(--rule)', margin: '20px 0 14px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(({ key, label, run }) => (
          <button
            key={key}
            type="button"
            className="tm-btn tm-sm"
            onClick={() => { onClose?.(); run(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              textAlign: 'left',
            }}
          >
            <span>{label}</span>
            <span aria-hidden style={{ color: 'var(--ink-mute)' }}>→</span>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Tiny invisible component that publishes Clerk's signOut +
 * openUserProfile fns into a ref so the parent panel (which can't
 * call useClerk conditionally) can use them. Mounted only when
 * CLERK_ENABLED so we never call useClerk without ClerkProvider.
 */
function ClerkActions({ actionsRef }) {
  const clerk = useClerk();
  React.useEffect(() => {
    actionsRef.current = {
      signOut: () => clerk.signOut(),
      openUserProfile: () => clerk.openUserProfile(),
    };
  }, [clerk, actionsRef]);
  return null;
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
