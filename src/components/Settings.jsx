import { useState, useCallback } from 'react';
import { useSettings, useAppState, useAppReducer } from '../context/AppContext';
import styles from './Settings.module.css';

function Settings({ isOpen, onClose }) {
  const [settings, updateSettings] = useSettings();
  const { tasks = [], slots = [], tags = [], taskTypes = [], schedules = [] } = useAppState();
  const dispatch = useAppReducer();
  const [showExportModal, setShowExportModal] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  if (!isOpen) return null;

  function handleExport() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      slots,
      tags,
      taskTypes,
      schedules,
      settings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskometer-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version || !data.tasks) {
          setImportError('Invalid backup file format.');
          return;
        }
        dispatch({
          type: 'INIT_STATE',
          payload: {
            tasks: data.tasks || [],
            slots: data.slots || [],
            tags: data.tags || [],
            taskTypes: data.taskTypes || [],
            schedules: data.schedules || [],
            settings: { ...settings, ...(data.settings || {}) },
            date: { current: new Date().toISOString() }
          }
        });
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        setImportError('Could not parse file. Make sure it\'s a valid JSON backup.');
      }
    };
    reader.readAsText(file);
  }

  function handleResetTour() {
    localStorage.removeItem('taskometer-tour-completed');
    window.restartOnboardingTour?.();
    onClose();
  }

  function requestNotificationPermission() {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => {
        updateSettings({ notificationsEnabled: perm === 'granted' });
      });
    }
  }

  const notifSupported = 'Notification' in window;
  const notifPermission = notifSupported ? Notification.permission : 'denied';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>x</button>
        </div>

        {/* Scheduling */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Scheduling</h3>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={settings.autoSchedule !== false}
              onChange={e => updateSettings({ autoSchedule: e.target.checked })}
            />
            <span>Auto-schedule new tasks into available slots</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={settings.showCompletedTasks || false}
              onChange={e => updateSettings({ showCompletedTasks: e.target.checked })}
            />
            <span>Show completed tasks in task list</span>
          </label>
        </section>

        {/* Notifications */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Notifications</h3>
          {notifSupported ? (
            <>
              {notifPermission === 'granted' ? (
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={settings.notificationsEnabled !== false}
                    onChange={e => updateSettings({ notificationsEnabled: e.target.checked })}
                  />
                  <span>Desktop notifications for upcoming tasks</span>
                </label>
              ) : (
                <button className={styles.actionBtn} onClick={requestNotificationPermission}>
                  Enable Desktop Notifications
                </button>
              )}
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.reminderMinutes != null}
                  onChange={e => updateSettings({ reminderMinutes: e.target.checked ? 5 : null })}
                />
                <span>Remind me before tasks start</span>
              </label>
              {settings.reminderMinutes != null && (
                <div className={styles.inlineField}>
                  <span>Minutes before:</span>
                  <select
                    value={settings.reminderMinutes || 5}
                    onChange={e => updateSettings({ reminderMinutes: parseInt(e.target.value) })}
                  >
                    <option value={1}>1 min</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
              )}
            </>
          ) : (
            <p className={styles.muted}>Desktop notifications not supported in this browser.</p>
          )}
        </section>

        {/* Data */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Data</h3>
          <div className={styles.dataStats}>
            <span>{tasks.length} tasks</span>
            <span>{slots.length} slots</span>
            <span>{schedules.length} schedules</span>
          </div>
          <div className={styles.dataActions}>
            <button className={styles.actionBtn} onClick={handleExport}>
              Export Backup
            </button>
            <label className={styles.actionBtn}>
              Import Backup
              <input type="file" accept=".json" onChange={handleImport} hidden />
            </label>
          </div>
          {importError && <p className={styles.error}>{importError}</p>}
          {importSuccess && <p className={styles.success}>Data imported successfully!</p>}
        </section>

        {/* Help */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Help</h3>
          <button className={styles.actionBtn} onClick={handleResetTour}>
            Replay Onboarding Tour
          </button>
          <div className={styles.shortcutHint}>
            Press <kbd>?</kbd> to view keyboard shortcuts
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
