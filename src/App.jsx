import { useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import Taskometer from './taskometer/Taskometer.jsx';
import { AppStateProvider, useAppState } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import Landing from './marketing/Landing.jsx';
import TeamsDemo from './marketing/TeamsDemo.jsx';
import { Privacy, Terms } from './marketing/Legal.jsx';
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

  if (path.startsWith('/app')) {
    return (
      <ThemeProvider>
        <AppStateProvider>
          <AppContent />
        </AppStateProvider>
      </ThemeProvider>
    );
  }

  if (path === '/teams' || path.startsWith('/teams/')) {
    return (
      <ThemeProvider>
        <TeamsDemo />
      </ThemeProvider>
    );
  }

  if (path === '/privacy') {
    return <ThemeProvider><Privacy /></ThemeProvider>;
  }

  if (path === '/terms') {
    return <ThemeProvider><Terms /></ThemeProvider>;
  }

  return (
    <ThemeProvider>
      <Landing />
    </ThemeProvider>
  );
}

export default App;
