import { useEffect, useState } from 'react';
import ItemList from './components/ItemList.jsx';
import CalendarView from './components/CalendarView.jsx';
import DefaultSchedulePlanner from './components/DefaultSchedulePlanner.jsx';
import Dashboard from './components/Dashboard.jsx';
import History from './components/History.jsx';
import ScheduleLibrary from './components/ScheduleLibrary.jsx';
import Community from './components/Community.jsx';
import TaskTypeManager from './components/TaskTypeManager.jsx';
import CalendarSync from './components/CalendarSync.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import { MemoryPalaceEditor } from './components/palace';
import TabNavigation, { VIEWS } from './components/TabNavigation.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import PWAStatus from './components/PWAStatus.jsx';
import { AppStateProvider, useAppState } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import styles from './App.module.css';

// Inner app component that uses hooks
function AppContent() {
	const [activeView, setActiveView] = useState(VIEWS.DEFAULTS);
  const { isLoading, error } = useAppState();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedAction = params.get('action');
    const requestedView = params.get('view');
    const requestedSchedule = params.get('schedule');
    const validViews = new Set(Object.values(VIEWS));

    if (requestedAction === 'add') {
      setActiveView(VIEWS.TASKS);
      return;
    }

    if (requestedView && validViews.has(requestedView)) {
      setActiveView(requestedView);
      return;
    }

    if (requestedSchedule) {
      setActiveView(VIEWS.SCHEDULES);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === activeView) {
      return;
    }

    params.set('view', activeView);
    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [activeView]);

	return (
		<>
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

            {activeView === VIEWS.SCHEDULES && (
              <div className={styles.schedulesView}>
                <ScheduleLibrary onNavigateToTasks={() => setActiveView(VIEWS.TASKS)} />
              </div>
            )}

            {activeView === VIEWS.DEFAULTS && (
              <div className={styles.defaultsView}>
                <DefaultSchedulePlanner
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

            {activeView === VIEWS.PALACE && (
              <div className={styles.palaceView}>
                <MemoryPalaceEditor />
              </div>
            )}

            {activeView === VIEWS.TASK_TYPES && (
              <div className={styles.taskTypesView}>
                <TaskTypeManager />
              </div>
            )}

            {activeView === VIEWS.HISTORY && (
              <div className={styles.historyView}>
                <History />
              </div>
            )}

            {activeView === VIEWS.COMMUNITY && (
              <div className={styles.communityView}>
                <Community />
              </div>
            )}
          </div>
        </ErrorBoundary>
				<Notifications />
        <CalendarSync />
				<PWAStatus />
        <OnboardingTour />
			</div>
		</>
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
