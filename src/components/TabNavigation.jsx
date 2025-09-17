import { useState } from 'react';
import styles from './TabNavigation.module.css';

export const VIEWS = {
  TODOS: 'todos',
  TASK_TYPES: 'taskTypes',
  CALENDAR: 'calendar',
  SCHEDULES: 'schedules',
  COMMUNITY: 'community',
  HISTORY: 'history',
};

function TabNavigation({ activeView, onViewChange }) {
  return (
    <nav className={styles.navigation}>
      <button
        className={`${styles.tab} ${activeView === VIEWS.TODOS ? styles.active : ''}`}
        onClick={() => onViewChange(VIEWS.TODOS)}
      >
        Todos
      </button>
      <button
        className={`${styles.tab} ${activeView === VIEWS.TASK_TYPES ? styles.active : ''}`}
        onClick={() => onViewChange(VIEWS.TASK_TYPES)}
      >
        Task Types
      </button>
      <button
        className={`${styles.tab} ${activeView === VIEWS.CALENDAR ? styles.active : ''}`}
        onClick={() => onViewChange(VIEWS.CALENDAR)}
      >
        Calendar
      </button>
      <button
        className={`${styles.tab} ${activeView === VIEWS.SCHEDULES ? styles.active : ''}`}
        onClick={() => onViewChange(VIEWS.SCHEDULES)}
      >
        Schedules
      </button>
      <button
        className={`${styles.tab} ${activeView === VIEWS.COMMUNITY ? styles.active : ''}`}
        onClick={() => onViewChange(VIEWS.COMMUNITY)}
      >
        Community
      </button>
      <button
        className={`${styles.tab} ${activeView === VIEWS.HISTORY ? styles.active : ''}`}
        onClick={() => onViewChange(VIEWS.HISTORY)}
      >
        History
      </button>
    </nav>
  );
}

export default TabNavigation;
