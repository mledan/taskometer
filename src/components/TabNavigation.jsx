import styles from './TabNavigation.module.css';
import ThemeToggle from './ThemeToggle';

export const VIEWS = {
  DASHBOARD: 'dashboard',
  SCHEDULES: 'schedules',
  DEFAULTS: 'defaults',
  TASKS: 'tasks',
  CALENDAR: 'calendar',
  PALACE: 'palace',
  TASK_TYPES: 'task-types',
  HISTORY: 'history',
  COMMUNITY: 'community',
};

function TabNavigation({ activeView, onViewChange }) {
  const tabs = [
    { view: VIEWS.DASHBOARD, label: 'Dashboard', tour: 'dashboard' },
    { view: VIEWS.SCHEDULES, label: 'Schedules', tour: 'schedules' },
    { view: VIEWS.DEFAULTS, label: 'Defaults', tour: 'defaults' },
    { view: VIEWS.TASKS, label: 'Tasks', tour: 'add-task' },
    { view: VIEWS.CALENDAR, label: 'Calendar', tour: 'calendar' },
    { view: VIEWS.PALACE, label: 'Palace', tour: 'palace' },
    { view: VIEWS.TASK_TYPES, label: 'Task Types', tour: 'task-types' },
    { view: VIEWS.HISTORY, label: 'History', tour: 'history' },
    { view: VIEWS.COMMUNITY, label: 'Community', tour: 'community' },
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
