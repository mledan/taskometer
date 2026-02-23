import { useState, useMemo } from 'react';
import { useAppState, useAppReducer, useItems } from '../AppContext.jsx';
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from 'date-fns';
import { getActiveSchedule } from '../utils/scheduleTemplates.js';
import { formatLocalTime, toLocalTime } from '../utils/timeDisplay.js';
import CircularSchedule from './CircularSchedule.jsx';
import Progress from './Progress.jsx';
import styles from './Dashboard.module.css';

/**
 * Dashboard Component
 * 
 * Unified overview of the LifeOS productivity system:
 * - Today's schedule with current/upcoming tasks
 * - Pending tasks by type/priority
 * - Progress meter
 * - Quick add task
 * - Active schedule preview
 * - Memory Palace summary (when available)
 */
function Dashboard() {
  const { items = [], taskTypes = [], activeSchedule } = useAppState();
  const dispatch = useAppReducer();
  const { pending, paused, completed } = useItems();
  const [quickTaskText, setQuickTaskText] = useState('');
  const [quickTaskType, setQuickTaskType] = useState('work');

  // Get today's tasks
  const todaysTasks = useMemo(() => {
    return items.filter(item => {
      if (!item.scheduledTime) return false;
      const taskDate = toLocalTime(item.scheduledTime);
      return isToday(taskDate);
    }).sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  }, [items]);

  // Get upcoming tasks (next 7 days, excluding today)
  const upcomingTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const weekFromNow = addDays(today, 7);
    return items.filter(item => {
      if (!item.scheduledTime) return false;
      const taskDate = toLocalTime(item.scheduledTime);
      return taskDate > endOfDay(today) && taskDate < weekFromNow;
    }).sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  }, [items]);

  // Group pending tasks by type
  const tasksByType = useMemo(() => {
    const grouped = {};
    pending.forEach(task => {
      const type = task.taskType || task.primaryType || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(task);
    });
    return grouped;
  }, [pending]);

  // Get current task (if any)
  const currentTask = useMemo(() => {
    const now = new Date();
    return todaysTasks.find(task => {
      if (task.status === 'completed') return false;
      const start = new Date(task.scheduledTime);
      const end = new Date(start.getTime() + (task.duration || 30) * 60000);
      return now >= start && now <= end;
    });
  }, [todaysTasks]);

  // Get next task
  const nextTask = useMemo(() => {
    const now = new Date();
    return todaysTasks.find(task => {
      if (task.status === 'completed') return false;
      const start = new Date(task.scheduledTime);
      return start > now;
    });
  }, [todaysTasks]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = items.length;
    const completedCount = completed.length;
    const pendingCount = pending.length;
    const pausedCount = paused.length;
    const todayTotal = todaysTasks.length;
    const todayCompleted = todaysTasks.filter(t => t.status === 'completed').length;

    return {
      total,
      completed: completedCount,
      pending: pendingCount,
      paused: pausedCount,
      todayTotal,
      todayCompleted,
      todayProgress: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0
    };
  }, [items, pending, paused, completed, todaysTasks]);

  // Get active schedule template
  const schedule = activeSchedule || getActiveSchedule();

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
    dispatch({ type: 'SCHEDULE_TASKS', tasks: [newTask] });
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
      {/* Header with date and greeting */}
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
            <span className={styles.statValue}>{stats.pending}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.completed}</span>
            <span className={styles.statLabel}>Done</span>
          </div>
        </div>
      </header>

      {/* Main dashboard grid */}
      <div className={styles.grid}>
        {/* Current Focus */}
        <section className={styles.currentFocus}>
          <h2>Current Focus</h2>
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
                  ✓ Complete
                </button>
                <button
                  onClick={() => dispatch({ type: 'PAUSE_TASK', payload: { taskId: currentTask.id || currentTask.key?.toString() } })}
                  className={styles.pauseBtn}
                >
                  ⏸ Pause
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
              <p className={styles.hint}>Add a task below to get started</p>
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
          </form>
        </section>

        {/* Today's Schedule */}
        <section className={styles.todaySchedule}>
          <h2>Today&apos;s Schedule</h2>
          <div className={styles.progressWrapper}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${stats.todayProgress}%` }}
              />
            </div>
            <span className={styles.progressText}>{stats.todayProgress}% complete</span>
          </div>
          <div className={styles.taskList}>
            {todaysTasks.length > 0 ? (
              todaysTasks.slice(0, 6).map(task => (
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
                  {task.status === 'completed' && <span className={styles.checkmark}>✓</span>}
                </div>
              ))
            ) : (
              <p className={styles.emptyList}>No tasks scheduled for today</p>
            )}
            {todaysTasks.length > 6 && (
              <p className={styles.moreCount}>+{todaysTasks.length - 6} more tasks</p>
            )}
          </div>
        </section>

        {/* Tasks by Type */}
        <section className={styles.byType}>
          <h2>Pending by Type</h2>
          <div className={styles.typeGrid}>
            {Object.entries(tasksByType).map(([typeId, tasks]) => {
              const typeInfo = getTypeInfo(typeId);
              return (
                <div key={typeId} className={styles.typeCard}>
                  <div className={styles.typeHeader} style={{ backgroundColor: typeInfo.color }}>
                    <span>{typeInfo.name}</span>
                    <span className={styles.typeCount}>{tasks.length}</span>
                  </div>
                  <ul className={styles.typeList}>
                    {tasks.slice(0, 3).map(task => (
                      <li key={task.key}>{task.text}</li>
                    ))}
                    {tasks.length > 3 && (
                      <li className={styles.moreItems}>+{tasks.length - 3} more</li>
                    )}
                  </ul>
                </div>
              );
            })}
            {Object.keys(tasksByType).length === 0 && (
              <p className={styles.emptyList}>All caught up! 🎉</p>
            )}
          </div>
        </section>

        {/* Active Schedule Preview */}
        {schedule && (
          <section className={styles.schedulePreview}>
            <h2>Active Schedule</h2>
            <div className={styles.scheduleCard}>
              <div className={styles.scheduleInfo}>
                <h3>{schedule.name}</h3>
                <p>by {schedule.author}</p>
              </div>
              <div className={styles.scheduleViz}>
                <CircularSchedule 
                  timeBlocks={schedule.timeBlocks} 
                  showLegend={false} 
                  showNow={true}
                  title="" 
                />
              </div>
            </div>
          </section>
        )}

        {/* Upcoming Tasks */}
        <section className={styles.upcoming}>
          <h2>Coming Up</h2>
          <div className={styles.upcomingList}>
            {upcomingTasks.length > 0 ? (
              upcomingTasks.slice(0, 5).map(task => (
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
              ))
            ) : (
              <p className={styles.emptyList}>No upcoming tasks scheduled</p>
            )}
          </div>
        </section>

        {/* Overall Progress */}
        <section className={styles.palacePreview}>
          <h2>Overall Progress</h2>
          <Progress />
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
