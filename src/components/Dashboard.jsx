import { useState, useMemo, useEffect } from 'react';
import { useAppState, useAppReducer, useItems, useSlots } from '../AppContext.jsx';
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from 'date-fns';
import { formatLocalTime, toLocalTime } from '../utils/timeDisplay.js';
import Progress from './Progress.jsx';
import styles from './Dashboard.module.css';

/**
 * Today View
 *
 * Shows the full day schedule — slot framework with tasks filling in.
 * Empty slots are visible so users can see their day's structure.
 */
function Dashboard() {
  const { items = [], taskTypes = [], slots: allSlots = [], settings = {} } = useAppState();
  const dispatch = useAppReducer();
  const { pending } = useItems();
  const [quickTaskText, setQuickTaskText] = useState('');
  const [quickTaskType, setQuickTaskType] = useState('work');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Get today's slots from the slot framework
  const todaysSlots = useMemo(() => {
    return allSlots
      .filter(slot => slot.date === todayStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [allSlots, todayStr]);

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
    const unscheduled = items.filter(t => t.status === 'pending' && !t.scheduledTime).length;

    return {
      todayTotal,
      todayCompleted,
      unscheduled,
      todayProgress: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0,
      remainingLabel
    };
  }, [items, todaysTasks]);

  // Build the day schedule: merge slots with tasks
  const daySchedule = useMemo(() => {
    const schedule = [];

    if (todaysSlots.length > 0) {
      // Framework mode: show all slots with tasks inside them
      todaysSlots.forEach(slot => {
        const slotTasks = todaysTasks.filter(task => {
          if (task.scheduledSlotId === slot.id) return true;
          // Also match by time overlap
          if (!task.scheduledTime) return false;
          const taskStart = new Date(task.scheduledTime);
          const taskHHMM = `${String(taskStart.getHours()).padStart(2, '0')}:${String(taskStart.getMinutes()).padStart(2, '0')}`;
          return taskHHMM >= slot.startTime && taskHHMM < slot.endTime;
        });

        schedule.push({
          type: 'slot',
          slot,
          tasks: slotTasks,
          isEmpty: slotTasks.length === 0,
        });
      });

      // Tasks not in any slot
      const slotTaskIds = new Set(schedule.flatMap(s => s.tasks.map(t => t.id || t.key)));
      const orphanTasks = todaysTasks.filter(t => !slotTaskIds.has(t.id) && !slotTaskIds.has(t.key));
      orphanTasks.forEach(task => {
        schedule.push({ type: 'task', task });
      });

      // Sort by time
      schedule.sort((a, b) => {
        const aTime = a.type === 'slot' ? a.slot.startTime : formatTaskHHMM(a.task);
        const bTime = b.type === 'slot' ? b.slot.startTime : formatTaskHHMM(b.task);
        return aTime.localeCompare(bTime);
      });
    } else {
      // No framework: just show tasks
      todaysTasks.forEach(task => {
        schedule.push({ type: 'task', task });
      });
    }

    return schedule;
  }, [todaysSlots, todaysTasks]);

  function formatTaskHHMM(task) {
    if (!task.scheduledTime) return '23:59';
    const d = new Date(task.scheduledTime);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  function formatDuration(startTime, endTime) {
    const mins = parseTime(endTime) - parseTime(startTime);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim();
    return `${mins}m`;
  }

  function formatTimeDisplay(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
  }

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
    return type || { name: typeId || 'Task', color: '#6b7280', icon: '' };
  }

  function formatTaskTime(task) {
    if (!task.scheduledTime) return 'Unscheduled';
    return formatLocalTime(task.scheduledTime, 'h:mm a');
  }

  const hasFramework = todaysSlots.length > 0;

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
            <span className={styles.statValue}>{stats.unscheduled}</span>
            <span className={styles.statLabel}>Unscheduled</span>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Current Focus */}
        <section className={styles.currentFocus}>
          {currentTask ? (
            <div className={styles.focusCard} style={{ borderColor: getTypeInfo(currentTask.taskType).color }}>
              <div className={styles.focusType} style={{ backgroundColor: getTypeInfo(currentTask.taskType).color }}>
                {getTypeInfo(currentTask.taskType).icon} {getTypeInfo(currentTask.taskType).name}
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
              <p>{hasFramework ? 'All clear for now' : 'No tasks scheduled'}</p>
              <p className={styles.hint}>
                {hasFramework
                  ? 'Your next slot will appear when it starts'
                  : 'Set up a schedule in Plan, or add a task below'}
              </p>
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
                  <option key={type.id} value={type.id}>{type.icon} {type.name}</option>
                ))}
              </select>
              <button type="submit" className={styles.quickBtn}>Add</button>
            </div>
          </form>
        </section>

        {/* Day Schedule - the framework view */}
        <section className={styles.todaySchedule}>
          <div className={styles.sectionHeader}>
            <h2>{hasFramework ? "Today's Schedule" : "Today's Timeline"}</h2>
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

          <div className={styles.scheduleList}>
            {daySchedule.length > 0 ? (
              daySchedule.map((entry, idx) => {
                if (entry.type === 'slot') {
                  const { slot, tasks: slotTasks, isEmpty } = entry;
                  const typeInfo = getTypeInfo(slot.slotType);
                  const slotColor = slot.color || typeInfo.color;
                  const now = currentTime;
                  const slotStartMin = parseTime(slot.startTime);
                  const slotEndMin = parseTime(slot.endTime);
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const isCurrent = nowMin >= slotStartMin && nowMin < slotEndMin;
                  const isPast = nowMin >= slotEndMin;

                  return (
                    <div
                      key={slot.id}
                      className={`${styles.slotBlock} ${isCurrent ? styles.slotCurrent : ''} ${isPast ? styles.slotPast : ''}`}
                      style={{
                        borderLeftColor: slotColor,
                        backgroundColor: `${slotColor}08`,
                      }}
                    >
                      <div className={styles.slotHeader}>
                        <div className={styles.slotInfo}>
                          <span className={styles.slotIcon} style={{ color: slotColor }}>
                            {typeInfo.icon || '◆'}
                          </span>
                          <span className={styles.slotLabel}>{slot.label || typeInfo.name}</span>
                          {isCurrent && <span className={styles.nowBadge}>NOW</span>}
                        </div>
                        <div className={styles.slotMeta}>
                          <span className={styles.slotTime}>
                            {formatTimeDisplay(slot.startTime)} – {formatTimeDisplay(slot.endTime)}
                          </span>
                          <span className={styles.slotDuration}>
                            {formatDuration(slot.startTime, slot.endTime)}
                          </span>
                        </div>
                      </div>

                      {/* Tasks inside this slot */}
                      {slotTasks.length > 0 ? (
                        <div className={styles.slotTasks}>
                          {slotTasks.map(task => {
                            const taskId = task.id || task.key?.toString();
                            const isCompleted = task.status === 'completed';
                            return (
                              <div
                                key={taskId}
                                className={`${styles.slotTask} ${isCompleted ? styles.slotTaskDone : ''}`}
                              >
                                <span className={styles.slotTaskText}>{task.text}</span>
                                <span className={styles.slotTaskDuration}>{task.duration}m</span>
                                {!isCompleted && (
                                  <button
                                    className={styles.slotTaskComplete}
                                    onClick={() => dispatch({ type: 'COMPLETE_TASK', payload: { taskId } })}
                                    title="Complete"
                                  >✓</button>
                                )}
                                {isCompleted && <span className={styles.checkmark}>✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={styles.slotEmpty}>
                          <span className={styles.slotEmptyText}>Available</span>
                        </div>
                      )}
                    </div>
                  );
                }

                // Standalone task (no slot)
                const { task } = entry;
                const taskId = task.id || task.key?.toString();
                return (
                  <div
                    key={taskId}
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
              <div className={styles.emptySchedule}>
                <p className={styles.emptyList}>
                  {hasFramework
                    ? 'Your schedule is clear — add tasks to fill your slots'
                    : 'No tasks scheduled for today'}
                </p>
              </div>
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
