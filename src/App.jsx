import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import Taskometer from './taskometer/Taskometer.jsx';
import { AppStateProvider, useAppState } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

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

function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </ThemeProvider>
  );
}

export default App;
