import { useState, useEffect } from 'react';
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
