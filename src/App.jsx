import { useState } from 'react';
import ItemList from './components/ItemList.jsx';
import CalendarView from './components/CalendarView.jsx';
import DefaultSchedulePlanner from './components/DefaultSchedulePlanner.jsx';
import { MemoryPalaceEditor } from './components/palace';
import TabNavigation, { VIEWS } from './components/TabNavigation.jsx';
import Notifications from './components/Notifications.jsx';
import PWAStatus from './components/PWAStatus.jsx';
import { AppStateProvider } from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import styles from './App.module.css';

// Inner app component that uses hooks
function AppContent() {
	const [activeView, setActiveView] = useState(VIEWS.DEFAULTS);

	return (
		<>
			<div className={styles.app}>
				<TabNavigation activeView={activeView} onViewChange={setActiveView} />

				<div className={styles.content}>
					{activeView === VIEWS.DEFAULTS && (
						<div className={styles.defaultsView}>
							<DefaultSchedulePlanner />
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
				</div>
				<Notifications />
				<PWAStatus />
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
