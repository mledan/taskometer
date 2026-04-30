import { useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import Taskometer from './taskometer/Taskometer.jsx';
import { AppStateProvider, useAppState } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import Landing from './marketing/Landing.jsx';
import TeamsDemo from './marketing/TeamsDemo.jsx';
import { Privacy, Terms } from './marketing/Legal.jsx';
import YearCanvas from './taskometer/year/YearCanvas.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import './components/CommandPalette.css';
import { runStorageMigrations } from './storage-migrations.js';

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

/**
 * Tiny pathname router. Three routes only — no need for react-router.
 *   /          → Landing (marketing)
 *   /teams     → TeamsDemo (mocked enterprise dashboard)
 *   /app/*     → Taskometer (the actual product)
 *
 * Marketing routes don't mount AppStateProvider so they stay snappy and
 * don't trigger the guest-reset that the app expects.
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

function App() {
  // Run on every mount — the migration is idempotent and gives tests
  // (which clear localStorage between runs) a deterministic starting
  // point that mirrors what main.jsx does in production.
  runStorageMigrations();
  const path = useRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd+K (or Ctrl+K on non-mac) toggles the palette globally.
  // Bound at the App level so it works regardless of which route is
  // active. Marketing routes get a smaller command set.
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

  const commands = [
    { id: 'go-year',   label: 'Go to Year canvas',     hint: 'Plan the whole year', shortcut: 'G Y', run: () => { window.location.href = '/app/year'; } },
    { id: 'go-day',    label: 'Go to Day view',        hint: 'See today',           shortcut: 'G D', run: () => { window.location.href = '/app'; } },
    { id: 'go-today',  label: 'Jump to today',         hint: 'Day view, today',     shortcut: 'T',   run: () => { window.location.href = '/app'; } },
    { id: 'go-home',   label: 'Go to landing page',    hint: 'Marketing',                            run: () => { window.location.href = '/'; } },
    { id: 'go-teams',  label: 'Go to Teams (preview)', hint: 'Concept dashboard',                    run: () => { window.location.href = '/teams'; } },
    { id: 'go-priv',   label: 'Privacy policy',        hint: 'How we handle data',                   run: () => { window.location.href = '/privacy'; } },
    { id: 'go-terms',  label: 'Terms of service',                                                    run: () => { window.location.href = '/terms'; } },
  ];

  // Render the route + the palette together. The palette is a fixed
  // overlay so it works the same on every page.
  const palette = (
    <CommandPalette
      open={paletteOpen}
      onClose={() => setPaletteOpen(false)}
      commands={commands}
    />
  );

  if (path === '/app/year' || path.startsWith('/app/year/')) {
    return (
      <ThemeProvider>
        <YearCanvas />
        {palette}
      </ThemeProvider>
    );
  }

  if (path.startsWith('/app')) {
    return (
      <ThemeProvider>
        <AppStateProvider>
          <AppContent />
          {palette}
        </AppStateProvider>
      </ThemeProvider>
    );
  }

  if (path === '/teams' || path.startsWith('/teams/')) {
    return (
      <ThemeProvider>
        <TeamsDemo />
        {palette}
      </ThemeProvider>
    );
  }

  if (path === '/privacy') {
    return <ThemeProvider><Privacy />{palette}</ThemeProvider>;
  }

  if (path === '/terms') {
    return <ThemeProvider><Terms />{palette}</ThemeProvider>;
  }

  return (
    <ThemeProvider>
      <Landing />
      {palette}
    </ThemeProvider>
  );
}

export default App;
