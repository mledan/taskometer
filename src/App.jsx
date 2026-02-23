import { useEffect, useState } from 'react';
import ItemList from './components/ItemList.jsx';
import CalendarView from './components/CalendarView.jsx';
import Dashboard from './components/Dashboard.jsx';
import History from './components/History.jsx';
import ScheduleSetup from './components/ScheduleSetup.jsx';
import CalendarSync from './components/CalendarSync.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import TabNavigation, { VIEWS } from './components/TabNavigation.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import PWAStatus from './components/PWAStatus.jsx';
import { AppStateProvider, useAppState } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import styles from './App.module.css';

const CANONICAL_VIEWS = new Set(['dashboard', 'schedule', 'tasks', 'calendar', 'history']);

function resolveView(raw) {
  if (!raw) return null;
  const mapped = {
    defaults: 'schedule',
    schedules: 'schedule',
    palace: 'dashboard',
    'task-types': 'dashboard',
    community: 'dashboard',
  };
  const resolved = mapped[raw] || raw;
  return CANONICAL_VIEWS.has(resolved) ? resolved : null;
}

function AppContent() {
  const [activeView, setActiveView] = useState(VIEWS.SCHEDULE);
  const { isLoading, error } = useAppState();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedAction = params.get('action');
    const requestedView = params.get('view');
    const requestedSchedule = params.get('schedule');

    if (requestedAction === 'add') {
      setActiveView(VIEWS.TASKS);
      return;
    }

    const resolved = resolveView(requestedView);
    if (resolved) {
      setActiveView(resolved);
      return;
    }

    if (requestedSchedule) {
      setActiveView(VIEWS.SCHEDULE);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === activeView) return;
    params.set('view', activeView);
    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [activeView]);

  return (
    <div className={styles.app}>
      <TabNavigation activeView={activeView} onViewChange={setActiveView} />

      {isLoading && (
        <div className={styles.statusBanner}>
          Loading your saved workspace...
        </div>
      )}
      {error && (
        <div className={`${styles.statusBanner} ${styles.errorBanner}`}>
          Data load warning: {error}
        </div>
      )}
      <ErrorBoundary>
        <div className={styles.content}>
          {activeView === VIEWS.DASHBOARD && (
            <div className={styles.dashboardView}>
              <Dashboard />
            </div>
          )}

          {activeView === VIEWS.SCHEDULE && (
            <div className={styles.schedulesView}>
              <ScheduleSetup
                onNavigateToTasks={() => setActiveView(VIEWS.TASKS)}
                onNavigateToCalendar={() => setActiveView(VIEWS.CALENDAR)}
              />
            </div>
          )}

          {activeView === VIEWS.TASKS && (
            <div className={styles.todosView}>
              <ItemList />
            </div>
          )}

          {activeView === VIEWS.CALENDAR && (
            <div className={styles.calendarView}>
              <CalendarView />
            </div>
          )}

          {activeView === VIEWS.HISTORY && (
            <div className={styles.historyView}>
              <History />
            </div>
          )}
        </div>
      </ErrorBoundary>
      <Notifications />
      <CalendarSync />
      <PWAStatus />
      <OnboardingTour />
    </div>
  );
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
