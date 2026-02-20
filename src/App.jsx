import { useState, useCallback } from 'react';
import TodoDate from "./components/TodoDate.jsx";
import ItemList from "./components/ItemList.jsx";
import TaskTypeManager from "./components/TaskTypeManager.jsx";
import CalendarView from "./components/CalendarView.jsx";
import History from "./components/History.jsx";
import ScheduleLibrary from "./components/ScheduleLibrary.jsx";
import Community from "./components/Community.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { MemoryPalaceEditor } from "./components/palace";
import TabNavigation, { VIEWS } from "./components/TabNavigation.jsx";
import Notifications from "./components/Notifications.jsx";
import PWAStatus from "./components/PWAStatus.jsx";
import OnboardingTour from "./components/OnboardingTour.jsx";
import KeyboardShortcuts from "./components/KeyboardShortcuts.jsx";
import { AppStateProvider } from "./AppContext.jsx";
import { ThemeProvider, useTheme } from "./context/ThemeContext.jsx";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import styles from './App.module.css';

// Inner app component that uses hooks
function AppContent() {
	const [activeView, setActiveView] = useState(VIEWS.SCHEDULES);
	const [showShortcuts, setShowShortcuts] = useState(false);
	const { toggleTheme } = useTheme();
	const goToTasks = useCallback(() => setActiveView(VIEWS.TODOS), []);

	// Keyboard shortcuts handlers
	const shortcutHandlers = {
		goToDashboard: () => setActiveView(VIEWS.DASHBOARD),
		goToTodos: () => setActiveView(VIEWS.TODOS),
		goToCalendar: () => setActiveView(VIEWS.CALENDAR),
		goToSchedules: () => setActiveView(VIEWS.SCHEDULES),
		goToPalace: () => setActiveView(VIEWS.PALACE),
		goToHistory: () => setActiveView(VIEWS.HISTORY),
		goToTaskTypes: () => setActiveView(VIEWS.TASK_TYPES),
		goToCommunity: () => setActiveView(VIEWS.COMMUNITY),
		toggleDarkMode: () => toggleTheme(),
		showHelp: () => setShowShortcuts(true),
		cancel: () => setShowShortcuts(false),
	};

	useKeyboardShortcuts(shortcutHandlers);

	return (
		<>
			<div className={styles.app}>
				<TabNavigation activeView={activeView} onViewChange={setActiveView} />

				<div className={styles.content}>
					{activeView === VIEWS.DASHBOARD && (
						<div className={styles.dashboardView}>
							<Dashboard />
						</div>
					)}

					{activeView === VIEWS.TODOS && (
						<div className={styles.todosView}>
							<TodoDate />
							<ItemList />
						</div>
					)}

					{activeView === VIEWS.TASK_TYPES && (
						<div className={styles.taskTypesView}>
							<TaskTypeManager />
						</div>
					)}

					{activeView === VIEWS.CALENDAR && (
						<div className={styles.calendarView}>
							<CalendarView />
						</div>
					)}

					{activeView === VIEWS.SCHEDULES && (
						<div className={styles.schedulesView}>
							<ScheduleLibrary onNavigateToTasks={goToTasks} />
						</div>
					)}

					{activeView === VIEWS.PALACE && (
						<div className={styles.palaceView}>
							<MemoryPalaceEditor />
						</div>
					)}

					{activeView === VIEWS.COMMUNITY && (
						<div className={styles.schedulesView}>
							<Community />
						</div>
					)}

					{activeView === VIEWS.HISTORY && (
						<div className={styles.historyView}>
							<History />
						</div>
					)}
				</div>
				<Notifications />
				<PWAStatus />
			</div>
			<OnboardingTour />
			<KeyboardShortcuts
				isOpen={showShortcuts}
				onClose={() => setShowShortcuts(false)}
			/>
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
