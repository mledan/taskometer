import { useEffect, useState } from 'react';
import { AUTH_EVENT } from '../WelcomePopup.jsx';

function readSafeAuth() {
  try {
    // taskometer.auth is current; smartcircle.auth is the legacy key
    // migrated on first load. Read both for the overlap window.
    return JSON.parse(localStorage.getItem('taskometer.auth') || localStorage.getItem('smartcircle.auth') || 'null');
  } catch (_) { return null; }
}

/**
 * Reactive view of the local auth profile plus the "should we show the
 * welcome popup" decision. The popup only opens if auth is still
 * missing 400ms after mount — Clerk's mirror needs a beat to land.
 */
export function useAuthState() {
  const [auth, setAuth] = useState(() => readSafeAuth());
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    const onChange = () => setAuth(readSafeAuth());
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const isLoggedIn = auth?.mode === 'account' || auth?.mode === 'clerk';

  useEffect(() => {
    const t = setTimeout(() => { if (!readSafeAuth()) setWelcomeOpen(true); }, 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isLoggedIn && welcomeOpen) setWelcomeOpen(false);
  }, [isLoggedIn, welcomeOpen]);

  const accountInitial = (auth?.profile?.firstName?.[0] || auth?.profile?.username?.[0] || 'G').toUpperCase();

  return { auth, isLoggedIn, accountInitial, welcomeOpen, setWelcomeOpen };
}
