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

// The welcome popup opens 400ms after the (lazy) app chunk mounts; the
// first test to load that chunk also pays its transform cost.
const awaitWelcome = () => screen.findByText(/Capture as you go/i, {}, { timeout: 4000 });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  setPath('/');
});

// Routes are React.lazy, so every assertion awaits the chunk.
describe('routing', () => {
  test('/ renders the landing page (not the app)', async () => {
    setPath('/');
    render(<App />);
    // Archetype-focused hero copy.
    expect(await screen.findByText(/Find your schedule/i)).toBeInTheDocument();
    // The active-schedule chip only renders inside /app — its absence
    // confirms we're on marketing.
    expect(screen.queryByText(/pick a wheel/i)).not.toBeInTheDocument();
  });

  test('/teams renders the concept dashboard', async () => {
    setPath('/teams');
    render(<App />);
    // "Concept preview" appears in both the banner and the footer; we
    // just need to confirm the page is reachable.
    const matches = await screen.findAllByText(/concept preview/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText(/Acme Engineering/i)).toBeInTheDocument();
    // Waitlist replaced the fake pricing tiers — confirm.
    expect(screen.getByText(/Be first in line/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$8/)).not.toBeInTheDocument();
  });

  test('/privacy renders the privacy policy', async () => {
    setPath('/privacy');
    render(<App />);
    expect(await screen.findByText(/feature-usage telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing leaves your browser/i)).toBeInTheDocument();
  });

  test('/terms renders the terms of service', async () => {
    setPath('/terms');
    render(<App />);
    expect(await screen.findByText(/The short version/i)).toBeInTheDocument();
    expect(screen.getByText(/Acceptable use/i)).toBeInTheDocument();
  });

  test('/share renders the share landing page', async () => {
    setPath('/share');
    render(<App />);
    // Without a #w= fragment we show the empty/error state.
    expect(await screen.findByText(/someone shared a schedule/i)).toBeInTheDocument();
  });

  test('/pricing renders the three plan cards', async () => {
    setPath('/pricing');
    render(<App />);
    expect(await screen.findByText(/Simple, honest pricing/i)).toBeInTheDocument();
    // "Free" appears as both a tier name and the price-of-free; getAllBy
    // is the right matcher. Pro and Team only appear once each.
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    // The "why we charge" section should also be on the page.
    expect(screen.getByText(/Why we charge/i)).toBeInTheDocument();
  });

  test('/app renders the actual product (welcome popup on first load)', async () => {
    setPath('/app');
    render(<App />);
    // The welcome popup opens after a short grace period for Clerk's mirror.
    expect(await awaitWelcome()).toBeInTheDocument();
  });

  test('/app defaults to the day zoom + wheel lens for new users', async () => {
    setPath('/app');
    render(<App />);
    await awaitWelcome();
    const ui = JSON.parse(localStorage.getItem('tm.ui'));
    expect(ui.zoom).toBe('day');
    expect(ui.lens).toBe('wheel');
  });

  test('/app migrates a legacy tm.scale into zoom + lens', async () => {
    localStorage.setItem('tm.scale', 'spiral');
    setPath('/app');
    render(<App />);
    await screen.findByPlaceholderText(/capture anything/i);
    const ui = JSON.parse(localStorage.getItem('tm.ui'));
    expect(ui.zoom).toBe('day');
    expect(ui.lens).toBe('spiral');
    expect(localStorage.getItem('tm.scale')).toBeNull();
  });

  test('/app/year renders the annual canvas', async () => {
    setPath('/app/year');
    render(<App />);
    expect(await screen.findByText(String(new Date().getFullYear()))).toBeInTheDocument();
    expect(screen.getByText(/^Rhythms$/)).toBeInTheDocument();
    expect(screen.getByText(/^Exceptions$/)).toBeInTheDocument();
    expect(screen.getByText(/No rhythms yet/i)).toBeInTheDocument();
  });

  test('/app accepts a ?date= deep link', async () => {
    setPath('/app?date=2026-04-15');
    render(<App />);
    // April 15 2026 is a Wednesday — its label appears in multiple
    // places (header date nav, daily wrap card, etc). One match is
    // enough to confirm the deep link took effect.
    const matches = await screen.findAllByText(/wed.*apr.*15/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  test('Cmd+K opens the command palette', async () => {
    setPath('/');
    render(<App />);
    await screen.findByText(/Find your schedule/i);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText(/Type a command/i)).toBeInTheDocument();
    expect(screen.getByText(/Go to Year canvas/i)).toBeInTheDocument();
    // App-only actions are not offered on marketing routes.
    expect(screen.queryByText(/Capture task/i)).not.toBeInTheDocument();
  });

  test('Cmd+K inside /app offers app actions', async () => {
    setPath('/app');
    render(<App />);
    await awaitWelcome();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByText(/Capture task/i)).toBeInTheDocument();
    expect(screen.getByText(/Paint today/i)).toBeInTheDocument();
    expect(screen.getByText(/Toggle dark mode/i)).toBeInTheDocument();
  });
});

describe('SEC-1 — no password collection', () => {
  test('the signup form has no password input', async () => {
    setPath('/app');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /save a profile/i }));

    // Robust structural assertion: no password input should exist
    // anywhere in the rendered tree.
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(0);

    // The minimal local profile asks for a name and an optional email.
    expect(screen.getByText(/email \(optional\)/i)).toBeInTheDocument();
  });
});

describe('UX-1 — guest data persistence', () => {
  test('rendering /app does NOT wipe arbitrary localStorage keys', async () => {
    // A key the app does not touch — proves the load path doesn't blanket-clear.
    localStorage.setItem('user-data-do-not-touch', 'preserved');
    setPath('/app');
    render(<App />);
    await awaitWelcome();
    expect(localStorage.getItem('user-data-do-not-touch')).toBe('preserved');
  });

  test('choosing "continue without one" persists a guest marker', async () => {
    setPath('/app');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /continue without one/i }));
    const auth = JSON.parse(localStorage.getItem('taskometer.auth'));
    expect(auth?.mode).toBe('guest');
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
