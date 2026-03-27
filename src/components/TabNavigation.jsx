import { useState, useEffect } from 'react';
import styles from './TabNavigation.module.css';
import ThemeToggle from './ThemeToggle';
import Settings from './Settings';
import KeyboardShortcuts from './KeyboardShortcuts';

export const VIEWS = {
  DASHBOARD: 'dashboard',
  SCHEDULE: 'schedule',
  TASKS: 'tasks',
  CALENDAR: 'calendar',
  COMMUNITY: 'community',
  HISTORY: 'history',
  // Legacy aliases kept for URL backwards-compatibility
  SCHEDULES: 'schedule',
  DEFAULTS: 'schedule',
  PALACE: 'dashboard',
  TASK_TYPES: 'dashboard',
};

function TabNavigation({ activeView, onViewChange }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Global ? shortcut to open keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setShowShortcuts(v => !v);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tabs = [
    { view: VIEWS.DASHBOARD, label: 'Today', tour: 'dashboard' },
    { view: VIEWS.SCHEDULE, label: 'Schedule', tour: 'schedules' },
    { view: VIEWS.TASKS, label: 'Tasks', tour: 'add-task' },
    { view: VIEWS.CALENDAR, label: 'Calendar', tour: 'calendar' },
    { view: VIEWS.COMMUNITY, label: 'Community', tour: 'community' },
    { view: VIEWS.HISTORY, label: 'History', tour: 'history' },
  ];

  return (
    <>
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
          <button
            className={styles.iconBtn}
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts (?)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
            </svg>
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => setShowSettings(true)}
            title="Settings"
            data-tour="settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <ThemeToggle variant="cycle" />
        </div>
      </nav>
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </>
  );
}

export default TabNavigation;
