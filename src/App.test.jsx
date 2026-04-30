import { afterEach, beforeEach, describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App.jsx';
import { runStorageMigrations } from './storage-migrations.js';

/**
 * App-level smoke tests. We exercise the pathname router by stubbing
 * window.location.pathname for each route. jsdom doesn't do real
 * navigation so window.history.pushState is enough to update the path.
 *
 * Tests double as regression guards for the BA audit fixes:
 *   - SEC-1 — no password field in the auth form
 *   - UX-1  — guest data isn't bulldozed on load
 *   - Routing — /, /teams, /privacy, /terms, /app render distinct pages
 */

function setPath(path) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  setPath('/');
});

describe('routing', () => {
  test('/ renders the landing page (not the app)', () => {
    setPath('/');
    render(<App />);
    // New annual-first hero copy.
    expect(screen.getByText(/Lay out your year\./i)).toBeInTheDocument();
    // The active-wheel chip ("pick a wheel") only renders inside /app —
    // its absence confirms we're on marketing.
    expect(screen.queryByText(/pick a wheel/i)).not.toBeInTheDocument();
  });

  test('/teams renders the concept dashboard', () => {
    setPath('/teams');
    render(<App />);
    // "Concept preview" appears in both the banner and the footer; we
    // just need to confirm the page is reachable.
    const matches = screen.getAllByText(/concept preview/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText(/Acme Engineering/i)).toBeInTheDocument();
    // Waitlist replaced the fake pricing tiers — confirm.
    expect(screen.getByText(/Be first in line/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$8/)).not.toBeInTheDocument();
  });

  test('/privacy renders the privacy policy', () => {
    setPath('/privacy');
    render(<App />);
    expect(screen.getByText(/Console telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing leaves your browser/i)).toBeInTheDocument();
  });

  test('/terms renders the terms of service', () => {
    setPath('/terms');
    render(<App />);
    expect(screen.getByText(/The short version/i)).toBeInTheDocument();
    expect(screen.getByText(/Acceptable use/i)).toBeInTheDocument();
  });

  test('/app renders the actual product (welcome modal on first load)', () => {
    setPath('/app');
    render(<App />);
    expect(screen.getByText(/Welcome to taskometer/i)).toBeInTheDocument();
  });

  test('/app/year renders the annual canvas', () => {
    setPath('/app/year');
    render(<App />);
    // Year title shows the current year
    expect(screen.getByText(String(new Date().getFullYear()))).toBeInTheDocument();
    // Rail headers
    expect(screen.getByText(/^Rhythms$/)).toBeInTheDocument();
    expect(screen.getByText(/^Exceptions$/)).toBeInTheDocument();
    // Empty-state copy
    expect(screen.getByText(/No rhythms yet/i)).toBeInTheDocument();
  });
});

describe('SEC-1 — no password collection', () => {
  test('the signup form has no password input', () => {
    setPath('/app');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    // Robust structural assertion: no password input should exist
    // anywhere in the rendered tree.
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(0);

    // The minimal local profile asks for a name and an optional email.
    expect(screen.getByText(/email \(optional\)/i)).toBeInTheDocument();
  });
});

describe('UX-1 — guest data persistence', () => {
  test('rendering /app does NOT wipe arbitrary localStorage keys', () => {
    // A key the app does not touch — proves the load path doesn't blanket-clear.
    localStorage.setItem('user-data-do-not-touch', 'preserved');
    setPath('/app');
    render(<App />);
    expect(localStorage.getItem('user-data-do-not-touch')).toBe('preserved');
  });

  test('runStorageMigrations moves legacy smartcircle.* keys to taskometer.*', () => {
    const legacy = JSON.stringify({ mode: 'account', profile: { firstName: 'Test' } });
    localStorage.setItem('smartcircle.auth', legacy);
    localStorage.setItem('smartcircle.onboarding.done', '1');

    runStorageMigrations();

    expect(localStorage.getItem('taskometer.auth')).toBe(legacy);
    expect(localStorage.getItem('taskometer.onboarding.done')).toBe('1');
    expect(localStorage.getItem('smartcircle.auth')).toBeNull();
    expect(localStorage.getItem('smartcircle.onboarding.done')).toBeNull();
  });

  test('runStorageMigrations is idempotent — running twice is safe', () => {
    const legacy = JSON.stringify({ mode: 'account', profile: { firstName: 'Test' } });
    localStorage.setItem('smartcircle.auth', legacy);

    runStorageMigrations();
    // Mutate the new value to confirm a second run doesn't clobber it.
    localStorage.setItem('taskometer.auth', '{"mode":"account","profile":{"firstName":"Updated"}}');
    runStorageMigrations();

    expect(localStorage.getItem('taskometer.auth')).toContain('Updated');
    expect(localStorage.getItem('smartcircle.auth')).toBeNull();
  });
});
