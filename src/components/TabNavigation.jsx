import styles from './TabNavigation.module.css';
import ThemeToggle from './ThemeToggle';

export const VIEWS = {
  DASHBOARD: 'dashboard',
  TODOS: 'todos',
  TASK_TYPES: 'taskTypes',
  CALENDAR: 'calendar',
  SCHEDULES: 'schedules',
  PALACE: 'palace',
  COMMUNITY: 'community',
  HISTORY: 'history',
};

function TabNavigation({ activeView, onViewChange }) {
  return (
    <nav className={styles.navigation}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeView === VIEWS.SCHEDULES ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.SCHEDULES)}
          data-tour="schedules"
        >
          Schedules
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.TODOS ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.TODOS)}
          data-tour="add-task"
        >
          Tasks
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.CALENDAR ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.CALENDAR)}
          data-tour="calendar"
        >
          Calendar
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.DASHBOARD ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.DASHBOARD)}
          data-tour="dashboard"
        >
          Dashboard
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.PALACE ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.PALACE)}
          data-tour="palace"
        >
          Palace
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.TASK_TYPES ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.TASK_TYPES)}
          data-tour="task-types"
        >
          Types
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.HISTORY ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.HISTORY)}
          data-tour="history"
        >
          History
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.COMMUNITY ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.COMMUNITY)}
          data-tour="community"
        >
          Community
        </button>
      </div>
      <div className={styles.actions} data-tour="theme">
        <ThemeToggle variant="cycle" />
      </div>
    </nav>
  );
}

export default TabNavigation;
