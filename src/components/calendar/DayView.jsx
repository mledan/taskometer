/**
 * DayView Component
 *
 * Single day calendar view with slot management.
 * Displays time slots, scheduled tasks, and allows slot editing.
 *
 * Features:
 * - Hourly/half-hourly time grid
 * - Current time indicator
 * - Slot display with type coloring
 * - Task display within slots
 * - Click-to-create new slots (when editing enabled)
 */

import { useMemo, useState, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { useAppState, useSlots, useTaskTypes } from '../../context/AppContext';
import { toLocalTime } from '../../utils/timeDisplay';
import SlotEditor from './SlotEditor';
import styles from './DayView.module.css';

const TIME_SLOT_HEIGHT = 30; // pixels per 30-minute slot
const HOURS_IN_DAY = 24;

function DayView({
  date,
  tasks = [],
  onTaskClick,
  isSlotEditMode = false,
  onSlotChange
}) {
  const { taskTypes = [] } = useAppState();
  const slots = useSlots();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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

  // Filter tasks for this day
  const dayTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.scheduledTime) return false;
      const taskDate = toLocalTime(task.scheduledTime);
      return isSameDay(taskDate, date);
    });
  }, [tasks, date]);

  // Filter slots for this day
  const daySlots = useMemo(() => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return slots.filter(slot => slot.date === dateStr);
  }, [slots, date]);

  // Check if current time indicator should show
  const isToday = isSameDay(date, new Date());
  const currentTimePosition = useMemo(() => {
    if (!isToday) return null;
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return minutes * (TIME_SLOT_HEIGHT / 30);
  }, [isToday, currentTime]);

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
   * Format date for header
   */
  function formatDateHeader(d) {
    const dayName = format(d, 'EEEE');
    const dateDisplay = format(d, 'MMMM d, yyyy');
    return { dayName, dateDisplay };
  }

  const { dayName, dateDisplay } = formatDateHeader(date);

  return (
    <div className={styles.container}>
      {/* Day header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <span className={styles.dayName}>{dayName}</span>
          <span className={styles.dateDisplay}>{dateDisplay}</span>
        </div>
        {isToday && (
          <span className={styles.todayBadge}>Today</span>
        )}
      </div>

      {/* Time grid */}
      <div className={styles.grid}>
        {/* Time labels column */}
        <div className={styles.timeColumn}>
          {timeSlots.map(slot => (
            <div
              key={slot.time}
              className={styles.timeLabel}
              style={{ height: `${slot.height}px` }}
            >
              {slot.displayTime}
            </div>
          ))}
        </div>

        {/* Main content area */}
        <div className={styles.contentColumn}>
          {/* Time slot lines */}
          {timeSlots.map((slot, index) => (
            <div
              key={slot.time}
              className={`${styles.timeSlotLine} ${index % 2 === 0 ? styles.hourLine : ''}`}
              style={{ height: `${slot.height}px` }}
            />
          ))}

          {/* Current time indicator */}
          {currentTimePosition !== null && (
            <div
              className={styles.currentTimeWrapper}
              style={{ top: `${currentTimePosition}px` }}
            >
              <div className={styles.currentTimeLine} />
              <div className={styles.currentTimeDot} />
              <span className={styles.currentTimeLabel}>
                {format(currentTime, 'h:mm a')}
              </span>
            </div>
          )}

          {/* Slot editor overlay */}
          <SlotEditor
            date={date}
            isActive={isSlotEditMode}
            existingSlots={daySlots}
            onSlotCreated={onSlotChange}
            onSlotUpdated={onSlotChange}
            onSlotDeleted={onSlotChange}
          />

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
                onClick={(e) => onTaskClick && onTaskClick(e, task)}
                title={`${props.title} (${props.type}) - ${props.status}`}
              >
                <span className={styles.taskTitle}>{props.title}</span>
                <span className={styles.taskType}>{props.type}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DayView;
