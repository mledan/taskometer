/**
 * useTaskNotifications
 *
 * Surfaces a browser notification when a scheduled task's start time
 * arrives. Keeps a tick loop at 30s resolution so a notification fires
 * within a minute of the scheduled start. Already-fired notifications
 * are tracked in a ref, not state, so we never re-notify.
 *
 * The hook is opt-in (`enabled`) so it stays silent until the user turns
 * notifications on in Settings. Permission is requested lazily the first
 * time `enabled` flips true.
 */

import { useEffect, useRef } from 'react';
import notifications from '../services/notifications';

export default function useTaskNotifications({ tasks = [], enabled = false, lookAheadMin = 5 } = {}) {
  const firedRef = useRef(new Set());

  // Clean the fired set when the task list shrinks so removed/rescheduled
  // tasks can notify again if they come back.
  useEffect(() => {
    const ids = new Set(tasks.map(t => t.id || t.key).filter(Boolean));
    for (const id of firedRef.current) {
      if (!ids.has(id)) firedRef.current.delete(id);
    }
  }, [tasks]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;

    // Lazily request permission so the harness doesn't pop a dialog at
    // page load.
    if (Notification.permission === 'default') {
      notifications.requestPermission().catch(() => {});
    }

    const tick = () => {
      if (Notification.permission !== 'granted') return;
      const now = Date.now();
      for (const t of tasks) {
        if (!t?.scheduledTime) continue;
        if (t.status === 'completed' || t.status === 'cancelled') continue;
        const id = t.id || t.key;
        if (firedRef.current.has(id)) continue;
        const startMs = new Date(t.scheduledTime).getTime();
        if (Number.isNaN(startMs)) continue;
        // Fire from lookAhead minutes before start through 2 minutes after
        if (startMs - now <= lookAheadMin * 60 * 1000 && startMs - now > -2 * 60 * 1000) {
          const mins = Math.max(0, Math.round((startMs - now) / 60000));
          const title = mins === 0 ? `now · ${t.text || t.title || 'task'}` : `in ${mins} min · ${t.text || t.title || 'task'}`;
          notifications.showNotification(title, {
            body: `${t.primaryType || t.taskType || 'task'} · ${t.duration || 30}m`,
            tag: `taskometer-${id}`,
          });
          firedRef.current.add(id);
        }
      }
    };

    tick();
    const iv = setInterval(tick, 30 * 1000);
    return () => clearInterval(iv);
  }, [enabled, tasks, lookAheadMin]);
}
