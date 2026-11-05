import { Suspense, lazy, useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import { AppStateProvider, useAppState } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import './components/CommandPalette.css';
import Onboarding, { isOnboardingLive } from './taskometer/Onboarding.jsx';
import { emit, EVENTS } from './services/events.js';
import { CLERK_ENABLED } from './services/auth.js';

// Every route is lazy so a marketing visitor never downloads the app
// (or Clerk), and vice-versa.
const Taskometer = lazy(() => import('./taskometer/Taskometer.jsx'));
const YearCanvas = lazy(() => import('./taskometer/year/YearCanvas.jsx'));
const Landing = lazy(() => import('./marketing/Landing.jsx'));
const TeamsDemo = lazy(() => import('./marketing/TeamsDemo.jsx'));
const Pricing = lazy(() => import('./marketing/Pricing.jsx'));
const SharePage = lazy(() => import('./marketing/SharePage.jsx'));
const Privacy = lazy(() => import('./marketing/Legal.jsx').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('./marketing/Legal.jsx').then(m => ({ default: m.Terms })));
const ClerkShell = lazy(() => import('./auth/ClerkShell.jsx'));

function AppContent() {
  const { isLoading, error } = useAppState();
  return (
    <ErrorBoundary>
      {error && (
        <div style={statusBanner('var(--orange, #D4663A)', 'rgba(212,102,58,0.1)')}>
          data warning: {error}
        </div>
      )}
      {isLoading && (
        <div style={statusBanner('var(--ink-soft, #4A433C)', 'rgba(168,191,140,0.2)', 'dashed')}>
          loading workspace…
        </div>
      )}
      <Taskometer />
      <Notifications />
    </ErrorBoundary>
  );
}

function statusBanner(color, bg, borderStyle = 'solid') {
  return {
    position: 'fixed',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 12px',
    borderRadius: 8,
    background: bg,
    color,
    border: `1px ${borderStyle} ${color}`,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 12,
    zIndex: 200,
  };
}

function RouteFallback() {
  return (
    <div
      className="tm-paper"
      aria-busy="true"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
    >
      <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>loading…</span>
    </div>
  );
}

/**
 * Tiny pathname router — no react-router.
 *   /, /teams, /pricing, /share, /privacy, /terms → marketing
 *   /app, /app/year                               → the product
 *
 * Marketing routes don't mount AppStateProvider or Clerk so they stay
 * snappy and don't trigger the guest-reset that the app expects.
 */
function useRoute() {
  const [path, setPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

// App-level actions are dispatched as window CustomEvents so the palette
// (which lives outside Taskometer) can drive it without prop-drilling.
// Taskometer listens for each `tm:*` event.
function appEvent(name, detail) {
  if (!window.location.pathname.startsWith('/app')) {
    window.location.href = '/app';
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function focusQuickCapture() {
  appEvent('tm:capture-focus');
  const host = document.querySelector('[data-onboard="quick-capture"]');
  const input = host?.matches?.('input, textarea') ? host : host?.querySelector('input, textarea');
  input?.focus();
}

const SCALE_COMMANDS = [
  ['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter'],
  ['year', 'Year'], ['spiral', 'Spiral'], ['block', 'Block'], ['life', 'Life'],
];

function buildCommands(path) {
  const inApp = path.startsWith('/app');
  const appCommands = inApp ? [
    { id: 'capture',   label: 'Capture task',          hint: 'Focus the inbox input',      shortcut: 'N',   keywords: 'new add todo inbox', run: focusQuickCapture },
    { id: 'paint',     label: 'Paint today…',          hint: 'Pick a schedule for today',  keywords: 'schedule apply wheel', run: () => appEvent('tm:paint-today') },
    { id: 'today',     label: 'Go to today',           hint: 'Jump back to the current day', shortcut: 'T', run: () => appEvent('tm:go-today') },
    { id: 'schedules', label: 'Open schedule library', hint: 'Manage your schedules',      keywords: 'wheels templates', run: () => appEvent('tm:open-schedules') },
    { id: 'settings',  label: 'Open settings',         keywords: 'preferences',            run: () => appEvent('tm:open-settings') },
    { id: 'theme',     label: 'Toggle dark mode',      shortcut: 'D',                      keywords: 'theme light', run: () => window.dispatchEvent(new CustomEvent('tm:theme-toggle')) },
    ...SCALE_COMMANDS.map(([scale, label]) => ({
      id: `scale-${scale}`,
      label: `Switch to ${label} view`,
      hint: 'Change scale',
      keywords: `scale view ${scale}`,
      run: () => appEvent('tm:set-scale', { scale }),
    })),
  ] : [];

  return [
    ...appCommands,
    { id: 'go-year',    label: 'Go to Year canvas',     hint: 'Plan the whole year', shortcut: 'G Y', run: () => { window.location.href = '/app/year'; } },
    { id: 'go-day',     label: 'Go to Day view',        hint: 'See today',           shortcut: 'G D', run: () => (inApp ? appEvent('tm:set-scale', { scale: 'day' }) : (window.location.href = '/app')) },
    { id: 'go-home',    label: 'Go to landing page',    hint: 'Marketing',                            run: () => { window.location.href = '/'; } },
    { id: 'go-teams',   label: 'Go to Teams (preview)', hint: 'Concept dashboard',                    run: () => { window.location.href = '/teams'; } },
    { id: 'go-pricing', label: 'Pricing',                                                             run: () => { window.location.href = '/pricing'; } },
    { id: 'go-priv',    label: 'Privacy policy',        hint: 'How we handle data',                   run: () => { window.location.href = '/privacy'; } },
    { id: 'go-terms',   label: 'Terms of service',                                                    run: () => { window.location.href = '/terms'; } },
  ];
}

function App() {
  const path = useRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd+K (or Ctrl+K on non-mac) toggles the palette globally.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const palette = (
    <CommandPalette
      open={paletteOpen}
      onClose={() => setPaletteOpen(false)}
      commands={buildCommands(path)}
    />
  );

  // Onboarding mounts globally (when active) so the tour survives
  // route navigation.
  const [onboardLive, setOnboardLive] = useState(() => isOnboardingLive());
  useEffect(() => {
    setOnboardLive(isOnboardingLive());
    if (path.startsWith('/app/year')) {
      emit(EVENTS.NAVIGATED_TO_YEAR, { path });
    }
  }, [path]);
  useEffect(() => {
    const onStart = () => setOnboardLive(true);
    window.addEventListener('taskometer:onboarding-start', onStart);
    return () => window.removeEventListener('taskometer:onboarding-start', onStart);
  }, []);
  const onboardSignals = {
    navigatedToYearCanvas: path.startsWith('/app/year') ? 1 : 0,
  };
  const onboardOverlay = onboardLive ? (
    <Onboarding
      onClose={() => setOnboardLive(false)}
      signals={onboardSignals}
    />
  ) : null;

  let page;
  let needsAuth = false;

  if (path === '/app/year' || path.startsWith('/app/year/')) {
    needsAuth = true;
    page = <YearCanvas />;
  } else if (path.startsWith('/app')) {
    needsAuth = true;
    page = (
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    );
  } else if (path === '/teams' || path.startsWith('/teams/')) {
    page = <TeamsDemo />;
  } else if (path === '/privacy') {
    page = <Privacy />;
  } else if (path === '/terms') {
    page = <Terms />;
  } else if (path === '/pricing') {
    page = <Pricing />;
  } else if (path === '/share') {
    page = <SharePage />;
  } else {
    page = <Landing />;
  }

  // Clerk wraps only the product routes; marketing never loads it.
  // Pricing mounts its own small Clerk island when it needs one.
  const body = needsAuth && CLERK_ENABLED
    ? <ClerkShell>{page}</ClerkShell>
    : page;

  return (
    <ThemeProvider>
      <Suspense fallback={<RouteFallback />}>{body}</Suspense>
      {palette}
      {onboardOverlay}
    </ThemeProvider>
  );
}

export default App;
