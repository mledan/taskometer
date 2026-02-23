import styles from './TabNavigation.module.css';
import ThemeToggle from './ThemeToggle';

export const VIEWS = {
  DASHBOARD: 'dashboard',
  SCHEDULE: 'schedule',
  TASKS: 'tasks',
  CALENDAR: 'calendar',
  HISTORY: 'history',
  // Legacy aliases kept for URL backwards-compatibility
  SCHEDULES: 'schedule',
  DEFAULTS: 'schedule',
  PALACE: 'dashboard',
  TASK_TYPES: 'dashboard',
  COMMUNITY: 'dashboard',
};

function TabNavigation({ activeView, onViewChange }) {
  const tabs = [
    { view: VIEWS.DASHBOARD, label: 'Dashboard', tour: 'dashboard' },
    { view: VIEWS.SCHEDULE, label: 'Schedule', tour: 'schedules' },
    { view: VIEWS.TASKS, label: 'Tasks', tour: 'add-task' },
    { view: VIEWS.CALENDAR, label: 'Calendar', tour: 'calendar' },
    { view: VIEWS.HISTORY, label: 'History', tour: 'history' },
  ];

  return (
    <nav className={styles.navigation}>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.view}
            data-tour={tab.tour}
            className={`${styles.tab} ${activeView === tab.view ? styles.active : ''}`}
            onClick={() => onViewChange(tab.view)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        <ThemeToggle variant="cycle" />
      </div>
    </nav>
  );
}

export default TabNavigation;
