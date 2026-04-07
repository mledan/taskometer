import { useState, useMemo } from 'react';
import { useAppState, useAppReducer, useItems } from '../AppContext.jsx';
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from 'date-fns';
import { formatLocalTime, toLocalTime } from '../utils/timeDisplay.js';
import Progress from './Progress.jsx';
import styles from './Dashboard.module.css';

/**
 * Today View
 *
 * A focused, single-day view that answers: "What should I be doing right now?"
 * - Current/next task with actions
 * - Day timeline with all scheduled tasks
 * - Quick add
 * - Simple stats
 */
function Dashboard() {
  const { items = [], taskTypes = [] } = useAppState();
  const dispatch = useAppReducer();
  const { pending, paused, completed } = useItems();
  const [quickTaskText, setQuickTaskText] = useState('');
  const [quickTaskType, setQuickTaskType] = useState('work');

  const todaysTasks = useMemo(() => {
    return items.filter(item => {
      if (!item.scheduledTime) return false;
      const taskDate = toLocalTime(item.scheduledTime);
      return isToday(taskDate);
    }).sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  }, [items]);

  const upcomingTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const weekFromNow = addDays(today, 7);
    return items.filter(item => {
      if (!item.scheduledTime) return false;
      const taskDate = toLocalTime(item.scheduledTime);
      return taskDate > endOfDay(today) && taskDate < weekFromNow;
    }).sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  }, [items]);

  const currentTask = useMemo(() => {
    const now = new Date();
    return todaysTasks.find(task => {
      if (task.status === 'completed') return false;
      const start = new Date(task.scheduledTime);
      const end = new Date(start.getTime() + (task.duration || 30) * 60000);
      return now >= start && now <= end;
    });
  }, [todaysTasks]);

  const nextTask = useMemo(() => {
    const now = new Date();
    return todaysTasks.find(task => {
      if (task.status === 'completed') return false;
      const start = new Date(task.scheduledTime);
      return start > now;
    });
  }, [todaysTasks]);

  const stats = useMemo(() => {
    const todayTotal = todaysTasks.length;
    const todayCompleted = todaysTasks.filter(t => t.status === 'completed').length;
    const todayPending = todaysTasks.filter(t => t.status === 'pending');
    const remainingMinutes = todayPending.reduce((sum, t) => sum + (t.duration || 30), 0);
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = remainingMinutes % 60;
    const remainingLabel = remainingHours > 0
      ? `${remainingHours}h ${remainingMins}m`
      : `${remainingMins}m`;

    return {
      todayTotal,
      todayCompleted,
      pending: pending.length,
      todayProgress: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0,
      remainingLabel
    };
  }, [pending, todaysTasks]);

  function handleQuickAdd(e) {
    e.preventDefault();
    if (!quickTaskText.trim()) return;

    const newTask = {
      text: quickTaskText,
      key: Date.now(),
      status: 'pending',
      taskType: quickTaskType,
      duration: taskTypes.find(t => t.id === quickTaskType)?.defaultDuration || 30,
      priority: 'medium',
      scheduledTime: null,
    };

    dispatch({ type: 'ADD_ITEM', item: newTask });
    setQuickTaskText('');
  }

  function getTypeInfo(typeId) {
    const type = taskTypes.find(t => t.id === typeId);
    return type || { name: typeId, color: '#6b7280' };
  }

  function formatTaskTime(task) {
    if (!task.scheduledTime) return 'Unscheduled';
    return formatLocalTime(task.scheduledTime, 'h:mm a');
  }

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.dateInfo}>
          <h1>{format(new Date(), 'EEEE')}</h1>
          <p className={styles.fullDate}>{format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.todayCompleted}/{stats.todayTotal}</span>
            <span className={styles.statLabel}>Today</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.remainingLabel}</span>
            <span className={styles.statLabel}>Remaining</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.pending}</span>
            <span className={styles.statLabel}>Backlog</span>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Current Focus - the hero section */}
        <section className={styles.currentFocus}>
          {currentTask ? (
            <div className={styles.focusCard} style={{ borderColor: getTypeInfo(currentTask.taskType).color }}>
              <div className={styles.focusType} style={{ backgroundColor: getTypeInfo(currentTask.taskType).color }}>
                {getTypeInfo(currentTask.taskType).name}
              </div>
              <h3>{currentTask.text}</h3>
              <p className={styles.focusTime}>
                {formatTaskTime(currentTask)} · {currentTask.duration} min
              </p>
              <div className={styles.focusActions}>
                <button
                  onClick={() => dispatch({ type: 'COMPLETE_TASK', payload: { taskId: currentTask.id || currentTask.key?.toString() } })}
                  className={styles.completeBtn}
                >
                  Complete
                </button>
                <button
                  onClick={() => dispatch({ type: 'PAUSE_TASK', payload: { taskId: currentTask.id || currentTask.key?.toString() } })}
                  className={styles.pauseBtn}
                >
                  Pause
                </button>
              </div>
            </div>
          ) : nextTask ? (
            <div className={styles.upNextCard}>
              <span className={styles.upNextLabel}>Up Next</span>
              <h3>{nextTask.text}</h3>
              <p className={styles.focusTime}>
                Starts at {formatTaskTime(nextTask)} · {nextTask.duration} min
              </p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>No tasks scheduled right now</p>
              <p className={styles.hint}>Add a task or go to Plan to schedule your day</p>
            </div>
          )}
        </section>

        {/* Quick Add */}
        <section className={styles.quickAdd}>
          <h2>Quick Add</h2>
          <form onSubmit={handleQuickAdd} className={styles.quickForm}>
            <input
              type="text"
              value={quickTaskText}
              onChange={(e) => setQuickTaskText(e.target.value)}
              placeholder="What needs to be done?"
              className={styles.quickInput}
            />
            <div className={styles.quickRow}>
              <select
                value={quickTaskType}
                onChange={(e) => setQuickTaskType(e.target.value)}
                className={styles.quickSelect}
              >
                {taskTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <button type="submit" className={styles.quickBtn}>Add</button>
            </div>
          </form>
        </section>

        {/* Day Timeline */}
        <section className={styles.todaySchedule}>
          <div className={styles.sectionHeader}>
            <h2>Today&apos;s Timeline</h2>
            <div className={styles.progressWrapper}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${stats.todayProgress}%` }}
                />
              </div>
              <span className={styles.progressText}>{stats.todayProgress}%</span>
            </div>
          </div>
          <div className={styles.taskList}>
            {todaysTasks.length > 0 ? (
              todaysTasks.map(task => {
                const taskId = task.id || task.key?.toString();
                return (
                  <div
                    key={task.key}
                    className={`${styles.taskItem} ${task.status === 'completed' ? styles.completed : ''} ${task === currentTask ? styles.current : ''}`}
                  >
                    <span
                      className={styles.taskDot}
                      style={{ backgroundColor: getTypeInfo(task.taskType).color }}
                    />
                    <span className={styles.taskTime}>{formatTaskTime(task)}</span>
                    <span className={styles.taskText}>{task.text}</span>
                    <span className={styles.taskDuration}>{task.duration}m</span>
                    {task.status === 'completed' ? (
                      <span className={styles.checkmark}>✓</span>
                    ) : task.status === 'pending' && (
                      <div className={styles.taskActions}>
                        <button
                          className={styles.taskCompleteBtn}
                          onClick={() => dispatch({ type: 'COMPLETE_TASK', payload: { taskId } })}
                          title="Complete"
                        >✓</button>
                        <button
                          className={styles.taskPauseBtn}
                          onClick={() => dispatch({ type: 'PAUSE_TASK', payload: { taskId } })}
                          title="Pause"
                        >⏸</button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className={styles.emptyList}>No tasks scheduled for today</p>
            )}
          </div>
        </section>

        {/* Coming Up */}
        {upcomingTasks.length > 0 && (
          <section className={styles.upcoming}>
            <h2>Coming Up</h2>
            <div className={styles.upcomingList}>
              {upcomingTasks.slice(0, 5).map(task => (
                <div key={task.key} className={styles.upcomingItem}>
                  <span className={styles.upcomingDate}>
                    {isTomorrow(toLocalTime(task.scheduledTime))
                      ? 'Tomorrow'
                      : format(toLocalTime(task.scheduledTime), 'EEE, MMM d')}
                  </span>
                  <span className={styles.upcomingText}>{task.text}</span>
                  <span
                    className={styles.upcomingType}
                    style={{ color: getTypeInfo(task.taskType).color }}
                  >
                    {getTypeInfo(task.taskType).name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Progress */}
        <section className={styles.progressSection}>
          <Progress />
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
