import { useEffect, useState } from 'react';
import ItemList from './components/ItemList.jsx';
import CalendarView from './components/CalendarView.jsx';
import Dashboard from './components/Dashboard.jsx';
import ScheduleSetup from './components/ScheduleSetup.jsx';
import TabNavigation, { VIEWS } from './components/TabNavigation.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import { AppStateProvider, useAppState } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import styles from './App.module.css';

const CANONICAL_VIEWS = new Set(['today', 'plan', 'tasks']);

function resolveView(raw) {
  if (!raw) return null;
  const mapped = {
    dashboard: 'today',
    schedule: 'plan',
    schedules: 'plan',
    calendar: 'plan',
    community: 'plan',
    history: 'today',
    defaults: 'plan',
    palace: 'today',
    'task-types': 'today',
  };
  const resolved = mapped[raw] || raw;
  return CANONICAL_VIEWS.has(resolved) ? resolved : null;
}

function AppContent() {
  const [activeView, setActiveView] = useState(VIEWS.TODAY);
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
      setActiveView(VIEWS.PLAN);
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
          {activeView === VIEWS.TODAY && (
            <div className={styles.todayView}>
              <Dashboard />
            </div>
          )}

          {activeView === VIEWS.PLAN && (
            <div className={styles.planView}>
              <div className={styles.planCalendar}>
                <CalendarView />
              </div>
              <div className={styles.planSchedule}>
                <ScheduleSetup
                  onNavigateToTasks={() => setActiveView(VIEWS.TASKS)}
                  onNavigateToCalendar={() => {}}
                />
              </div>
            </div>
          )}

          {activeView === VIEWS.TASKS && (
            <div className={styles.tasksView}>
              <ItemList />
            </div>
          )}
        </div>
      </ErrorBoundary>
      <Notifications />
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
