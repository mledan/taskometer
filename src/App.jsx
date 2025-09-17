import { useState } from 'react';
import TodoDate from "./components/TodoDate.jsx";
import ItemList from "./components/ItemList.jsx";
import TaskTypeManager from "./components/TaskTypeManager.jsx";
import CalendarView from "./components/CalendarView.jsx";
import History from "./components/History.jsx";
import ScheduleLibrary from "./components/ScheduleLibrary.jsx";
import Community from "./components/Community.jsx";
import TabNavigation, { VIEWS } from "./components/TabNavigation.jsx";
import Notifications from "./components/Notifications.jsx";
import { AppStateProvider } from "./AppContext.jsx";
import styles from './App.module.css';

function App() {
	const [activeView, setActiveView] = useState(VIEWS.TODOS);

	return (
		<AppStateProvider>
			<div className={styles.app}>
				<TabNavigation activeView={activeView} onViewChange={setActiveView} />
				
				<div className={styles.content}>
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
							<ScheduleLibrary />
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
			</div>
		</AppStateProvider>
	);
}

export default App;
