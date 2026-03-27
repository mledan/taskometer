import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../AppContext.jsx';
import styles from './Notifications.module.css';

function Notification({ message, type, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`${styles.notification} ${styles[type]}`}>
      <span>{message}</span>
      <button onClick={onDismiss}>&times;</button>
    </div>
  );
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const { items = [], settings = {} } = useAppState();
  const notifiedRef = useRef(new Set());

  // Add a new notification
  window.showNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    return id;
  };

  // Remove a notification
  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Desktop notification helper
  function sendDesktopNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted' && settings.notificationsEnabled !== false) {
      try {
        new Notification(title, {
          body,
          icon: '/logo128.png',
          tag: `task-${Date.now()}`,
        });
      } catch (e) {
        // Silent fail on desktop notification error
      }
    }
  }

  // Task reminder scheduler - checks every 30 seconds
  useEffect(() => {
    if (!settings.reminderMinutes) return;

    const interval = setInterval(() => {
      const now = new Date();
      const reminderMs = (settings.reminderMinutes || 5) * 60000;

      items.forEach(task => {
        if (task.status !== 'pending' || !task.scheduledTime) return;

        const start = new Date(task.scheduledTime);
        const diff = start.getTime() - now.getTime();
        const taskId = task.id || task.key;

        // Within reminder window and not already notified
        if (diff > 0 && diff <= reminderMs && !notifiedRef.current.has(taskId)) {
          notifiedRef.current.add(taskId);

          const minutesLeft = Math.ceil(diff / 60000);
          const message = `"${task.text}" starts in ${minutesLeft} min`;

          window.showNotification?.(message, 'info');
          sendDesktopNotification('Upcoming Task', message);
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [items, settings.reminderMinutes, settings.notificationsEnabled]);

  // Clean up old notification IDs daily
  useEffect(() => {
    const cleanup = setInterval(() => {
      notifiedRef.current.clear();
    }, 24 * 60 * 60 * 1000);
    return () => clearInterval(cleanup);
  }, []);

  return (
    <div className={styles.container}>
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onDismiss={() => dismissNotification(notification.id)}
        />
      ))}
    </div>
  );
}

export default Notifications;
