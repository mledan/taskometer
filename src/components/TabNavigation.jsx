import styles from './TabNavigation.module.css';
import ThemeToggle from './ThemeToggle';

export const VIEWS = {
  DEFAULTS: 'defaults',
  TASKS: 'tasks',
  CALENDAR: 'calendar',
  PALACE: 'palace',
};

function TabNavigation({ activeView, onViewChange }) {
  return (
    <nav className={styles.navigation}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeView === VIEWS.DEFAULTS ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.DEFAULTS)}
        >
          Defaults
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.TASKS ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.TASKS)}
        >
          Tasks
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.CALENDAR ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.CALENDAR)}
        >
          Calendar
        </button>
        <button
          className={`${styles.tab} ${activeView === VIEWS.PALACE ? styles.active : ''}`}
          onClick={() => onViewChange(VIEWS.PALACE)}
        >
          Palace
        </button>
      </div>
      <div className={styles.actions}>
        <ThemeToggle variant="cycle" />
      </div>
    </nav>
  );
}

export default TabNavigation;
