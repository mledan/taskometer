/**
 * WeekView Component
 *
 * Full week calendar view with slot management.
 * Displays 7 days with time slots, tasks, and slot editing capability.
 *
 * Features:
 * - Week navigation
 * - Current time indicator (on today's column)
 * - Slot display with type/tag coloring
 * - Task display with context menu
 * - Slot edit mode toggle
 * - Integration with SlotEditor for creating slots
 */

import { useState, useMemo, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { useAppState, useAppReducer, useSlots, useTaskTypes } from '../../context/AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { toLocalTime } from '../../utils/timeDisplay';
import SlotEditor from './SlotEditor';
import styles from './WeekView.module.css';

const TIME_SLOT_HEIGHT = 30; // pixels per 30-minute slot
const HOURS_IN_DAY = 24;

function WeekView({
  tasks = [],
  onTaskClick,
  showSlots = true,
  isSlotEditMode = false,
  onSlotEditModeChange,
  selectedWeek: externalSelectedWeek = null,
  onWeekChange
}) {
  const dispatch = useAppReducer();
  const { taskTypes = [] } = useAppState();
  const slots = useSlots();

  const [internalSelectedWeek, setInternalSelectedWeek] = useState(() => externalSelectedWeek || startOfWeek(new Date()));
  const [currentTime, setCurrentTime] = useState(new Date());
  const selectedWeek = externalSelectedWeek || internalSelectedWeek;

  useEffect(() => {
    if (externalSelectedWeek) {
      setInternalSelectedWeek(externalSelectedWeek);
    }
  }, [externalSelectedWeek]);

  // Task context menu state
  const [selectedTask, setSelectedTask] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    function handleClickOutside() {
      setShowContextMenu(false);
    }
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showContextMenu]);

  // Generate time slots for display
  const timeSlots = useMemo(() => {
    const result = [];
    for (let hour = 0; hour < HOURS_IN_DAY; hour++) {
      for (let minute of [0, 30]) {
        const hour24 = hour.toString().padStart(2, '0');
        const minute24 = minute.toString().padStart(2, '0');
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const displayTime = minute === 0 ? `${displayHour} ${ampm}` : '';

        result.push({
          time: `${hour24}:${minute24}`,
          displayTime,
          height: TIME_SLOT_HEIGHT
        });
      }
    }
    return result;
  }, []);

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(selectedWeek, i);
      return {
        date: day,
        dateStr: format(day, 'yyyy-MM-dd'),
        dayName: format(day, 'EEE'),
        dayNumber: format(day, 'd'),
        isToday: isSameDay(day, new Date())
      };
    });
  }, [selectedWeek]);

  /**
   * Get tasks for a specific day
   */
  function getTasksForDay(date) {
    return tasks.filter(task => {
      if (!task.scheduledTime) return false;
      const taskDate = toLocalTime(task.scheduledTime);
      return isSameDay(taskDate, date);
    });
  }

  /**
   * Get slots for a specific day
   */
  function getSlotsForDay(date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    return slots.filter(slot => slot.date === dateStr);
  }

  /**
   * Get display properties for a task
   */
  function getTaskDisplayProps(task) {
    const taskType = taskTypes.find(t => t.id === task.taskType) || {
      name: 'Task',
      color: 'var(--accent-color)'
    };

    const startTime = new Date(task.scheduledTime);
    const topPosition = (startTime.getHours() * 60 + startTime.getMinutes()) * (TIME_SLOT_HEIGHT / 30);
    const heightInPixels = (task.duration / 30) * TIME_SLOT_HEIGHT;

    const now = new Date();
    const endTime = new Date(startTime.getTime() + task.duration * 60000);

    return {
      title: task.text,
      type: taskType.name,
      color: taskType.color || 'var(--accent-color)',
      height: heightInPixels,
      top: topPosition,
      isPast: startTime < now,
      isCurrent: startTime <= now && endTime >= now,
      status: task.status
    };
  }

  /**
   * Handle task click - show context menu
   */
  function handleTaskClick(e, task) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTask(task);
    setShowContextMenu(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    if (onTaskClick) {
      onTaskClick(e, task);
    }
  }

  /**
   * Context menu actions
   */
  function handleCompleteTask() {
    if (selectedTask) {
      dispatch({
        type: ACTION_TYPES.COMPLETE_TASK,
        payload: { taskId: selectedTask.id || selectedTask.key }
      });
      setShowContextMenu(false);
    }
  }

  function handlePauseTask() {
    if (selectedTask) {
      dispatch({
        type: ACTION_TYPES.PAUSE_TASK,
        payload: { taskId: selectedTask.id || selectedTask.key }
      });
      setShowContextMenu(false);
    }
  }

  function handleSnooze(minutes) {
    if (selectedTask?.scheduledTime) {
      const newStart = new Date(selectedTask.scheduledTime);
      newStart.setMinutes(newStart.getMinutes() + minutes);
      dispatch({
        type: ACTION_TYPES.UPDATE_TASK,
        payload: {
          id: selectedTask.id || selectedTask.key,
          scheduledTime: newStart.toISOString()
        }
      });
      setShowContextMenu(false);
    }
  }

  function handleRescheduleTask() {
    if (selectedTask) {
      dispatch({
        type: ACTION_TYPES.UPDATE_TASK,
        payload: {
          id: selectedTask.id || selectedTask.key,
          scheduledTime: null
        }
      });
      setShowContextMenu(false);
    }
  }

  function handleDeleteTask() {
    if (selectedTask) {
      dispatch({
        type: ACTION_TYPES.DELETE_TASK,
        payload: { id: selectedTask.id || selectedTask.key }
      });
      setShowContextMenu(false);
    }
  }

  /**
   * Week navigation
   */
  function updateSelectedWeek(nextWeek) {
    if (onWeekChange) {
      onWeekChange(nextWeek);
    }
    if (!externalSelectedWeek) {
      setInternalSelectedWeek(nextWeek);
    }
  }

  function previousWeek() {
    updateSelectedWeek(addDays(selectedWeek, -7));
  }

  function nextWeek() {
    updateSelectedWeek(addDays(selectedWeek, 7));
  }

  function goToToday() {
    updateSelectedWeek(startOfWeek(new Date()));
  }

  return (
    <div className={styles.container}>
      {/* Navigation header */}
      <div className={styles.navigation}>
        <div className={styles.navLeft}>
          <button onClick={previousWeek} className={styles.navButton}>
            ← Prev
          </button>
          <button onClick={goToToday} className={styles.todayButton}>
            Today
          </button>
          <button onClick={nextWeek} className={styles.navButton}>
            Next →
          </button>
        </div>

        <div className={styles.navCenter}>
          <span className={styles.monthYear}>{format(selectedWeek, 'MMMM yyyy')}</span>
          <span className={styles.currentTimeDisplay}>
            {format(currentTime, 'h:mm a')}
          </span>
        </div>

        <div className={styles.navRight}>
          {onSlotEditModeChange && (
            <button
              className={`${styles.editModeButton} ${isSlotEditMode ? styles.active : ''}`}
              onClick={() => onSlotEditModeChange(!isSlotEditMode)}
            >
              {isSlotEditMode ? '✓ Done Editing' : '✏️ Edit Slots'}
            </button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className={styles.calendar}>
        {/* Time column */}
        <div className={styles.timeColumn}>
          <div className={styles.timeColumnHeader} />
          <div className={styles.timeColumnBody}>
            {timeSlots.map(slot => (
              <div
                key={slot.time}
                className={styles.timeSlot}
                style={{ height: `${slot.height}px` }}
              >
                {slot.displayTime}
              </div>
            ))}
          </div>
        </div>

        {/* Days container */}
        <div className={styles.daysContainer}>
          {weekDays.map(day => {
            const dayTasks = getTasksForDay(day.date);
            const daySlots = getSlotsForDay(day.date);

            return (
              <div
                key={day.dateStr}
                className={`${styles.dayColumn} ${day.isToday ? styles.today : ''}`}
              >
                {/* Day header */}
                <div className={styles.dayHeader}>
                  <span className={styles.dayName}>{day.dayName}</span>
                  <span className={`${styles.dayNumber} ${day.isToday ? styles.todayNumber : ''}`}>
                    {day.dayNumber}
                  </span>
                </div>

                {/* Day content */}
                <div className={styles.dayContent}>
                  {/* Time slot grid lines */}
                  {timeSlots.map((slot, index) => (
                    <div
                      key={slot.time}
                      className={`${styles.gridLine} ${index % 2 === 0 ? styles.hourLine : ''}`}
                      style={{ height: `${slot.height}px` }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {day.isToday && (
                    <div
                      className={styles.currentTimeWrapper}
                      style={{
                        top: `${(currentTime.getHours() * 60 + currentTime.getMinutes()) * (TIME_SLOT_HEIGHT / 30)}px`
                      }}
                    >
                      <div className={styles.currentTimeLine} />
                      <div className={styles.currentTimeDot} />
                    </div>
                  )}

                  {/* Slot editor (when in edit mode) */}
                  {showSlots && (
                    <SlotEditor
                      date={day.date}
                      dayOffset={weekDays.indexOf(day)}
                      isActive={isSlotEditMode}
                      existingSlots={daySlots}
                    />
                  )}

                  {/* Tasks */}
                  {dayTasks.map(task => {
                    const props = getTaskDisplayProps(task);
                    return (
                      <div
                        key={task.id || task.key}
                        className={`${styles.task}
                          ${props.status === 'completed' ? styles.taskCompleted : ''}
                          ${props.status === 'paused' ? styles.taskPaused : ''}
                          ${props.isCurrent ? styles.taskCurrent : ''}
                          ${props.isPast && props.status !== 'completed' ? styles.taskPast : ''}`
                        }
                        style={{
                          backgroundColor: props.color,
                          height: `${props.height}px`,
                          top: `${props.top}px`
                        }}
                        onClick={(e) => handleTaskClick(e, task)}
                        title={`${props.title} (${props.type})`}
                      >
                        <span className={styles.taskTitle}>{props.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && selectedTask && (
        <div
          className={styles.contextMenu}
          style={{
            position: 'fixed',
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            zIndex: 1000
          }}
        >
          <button onClick={handleCompleteTask}>✓ Complete</button>
          <button onClick={handlePauseTask}>⏸ Pause</button>
          <button onClick={handleRescheduleTask}>🔄 Reschedule</button>
          <button onClick={handleDeleteTask}>🗑 Delete</button>
          {selectedTask?.scheduledTime && (
            <div className={styles.snoozeGroup}>
              <span className={styles.snoozeLabel}>Snooze</span>
              <div className={styles.snoozeButtons}>
                <button onClick={() => handleSnooze(15)}>+15m</button>
                <button onClick={() => handleSnooze(30)}>+30m</button>
                <button onClick={() => handleSnooze(60)}>+1h</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WeekView;
