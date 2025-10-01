import { useEffect, useState } from 'react';
import { useAppState, useAppReducer } from '../AppContext.jsx';
import { format, addDays, startOfWeek, isWithinInterval, isSameDay } from 'date-fns';
import { toLocalTime, formatLocalTime } from '../utils/timeDisplay.js';
import CalendarSync from './CalendarSync.jsx';
import styles from './CalendarView.module.css';

const HOURS_IN_DAY = 24;
const TIME_SLOT_HEIGHT = 30; // pixels per 30-minute slot

function CalendarView() {
  const { items = [], taskTypes = [] } = useAppState();
  const dispatch = useAppReducer();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [timeSlots, setTimeSlots] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [selectedTask, setSelectedTask] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  function handleTaskClick(e, task) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTask(task);
    setShowContextMenu(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }

  function handleCompleteTask() {
    if (selectedTask) {
      dispatch({
        type: 'UPDATE_ITEM',
        item: { ...selectedTask, status: 'completed' }
      });
      setShowContextMenu(false);
    }
  }

  function handlePauseTask() {
    if (selectedTask) {
      dispatch({
        type: 'UPDATE_ITEM',
        item: { ...selectedTask, status: 'paused' }
      });
      setShowContextMenu(false);
    }
  }

  function handleSnooze(minutes) {
    if (selectedTask && selectedTask.scheduledTime) {
      const newStart = new Date(selectedTask.scheduledTime);
      newStart.setMinutes(newStart.getMinutes() + minutes);
      dispatch({
        type: 'UPDATE_ITEM',
        item: { ...selectedTask, scheduledTime: newStart.toISOString() }
      });
      setShowContextMenu(false);
    }
  }

  function handleRescheduleTask() {
    if (selectedTask) {
      // Clear the scheduled time so it can be rescheduled
      dispatch({
        type: 'UPDATE_ITEM',
        item: { ...selectedTask, scheduledTime: null }
      });
      setShowContextMenu(false);
    }
  }

  function handleDeleteTask() {
    if (selectedTask) {
      dispatch({
        type: 'DELETE_ITEM',
        item: selectedTask
      });
      setShowContextMenu(false);
    }
  }

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

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(selectedWeek, i);
    return {
      date: day,
      dayName: format(day, 'EEEE'),
      dayDisplay: format(day, 'MMM d'),
    };
  });

  // Generate time slots for the week
  useEffect(() => {
    const slots = [];
    for (let hour = 0; hour < HOURS_IN_DAY; hour++) {
      for (let minute of [0, 30]) {
        // Store both 24-hour format for calculations and display format for UI
        const hour24 = hour.toString().padStart(2, '0');
        const minute24 = minute.toString().padStart(2, '0');
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const displayTime = minute === 0 ? `${displayHour} ${ampm}` : '';
        
        slots.push({
          time: `${hour24}:${minute24}`,  // Keep 24-hour format for calculations
          displayTime: displayTime,  // Human-readable format for display
          height: TIME_SLOT_HEIGHT,
        });
      }
    }
    setTimeSlots(slots);
  }, []);

  // Get scheduled tasks for each day/slot
  function getTasksForSlot(day, timeSlot) {
    const slotTime = new Date(day);
    const [hours, minutes] = timeSlot.time.split(':').map(Number);
    slotTime.setHours(hours, minutes, 0, 0);

    return items
      .filter(item => item.scheduledTime && item.status !== 'completed')
      .filter(item => {
        // Convert UTC stored time to local time for comparison
        const taskStart = toLocalTime(item.scheduledTime);
        const taskEnd = new Date(taskStart.getTime() + item.duration * 60000);

        // Check if task is on the same day AND overlaps with this time slot
        return isSameDay(taskStart, day) && isWithinInterval(slotTime, { start: taskStart, end: taskEnd });
      });
  }

  // Calculate task display properties
  function getTaskDisplayProps(task) {
    const taskType = taskTypes.find(t => t.id === task.taskType) || { 
      name: 'Default',
      color: 'var(--accent-color)'
    };

    // Convert UTC stored time to local time for display
    const startTime = toLocalTime(task.scheduledTime);
    const endTime = new Date(startTime.getTime() + task.duration * 60000);
    const now = new Date();

    const startSlotIndex = startTime.getHours() * 2 + (startTime.getMinutes() >= 30 ? 1 : 0);
    const durationSlots = Math.ceil(task.duration / 30);

    return {
      title: task.text,
      type: taskType.name,
      color: taskType.color || 'var(--accent-color)', // Fallback color
      height: durationSlots * TIME_SLOT_HEIGHT,
      top: startSlotIndex * TIME_SLOT_HEIGHT,
      isPast: startTime < now,
      status: task.status
    };
  }

  // Previous/Next week navigation
  function previousWeek() {
    setSelectedWeek(prev => addDays(prev, -7));
  }

  function nextWeek() {
    setSelectedWeek(prev => addDays(prev, 7));
  }

  return (
    <div className={styles.container}>
      {/* Week navigation */}
      <div className={styles.navigation}>
        <button onClick={previousWeek}>&larr; Previous Week</button>
        <div className={styles.dateTimeInfo}>
          <span>{format(selectedWeek, 'MMMM yyyy')}</span>
          <span className={styles.currentTime}>{format(currentTime, 'h:mm a')}</span>
        </div>
        <button onClick={nextWeek}>Next Week &rarr;</button>
      </div>

      <div className={styles.calendar}>
        {/* Time slots column */}
        <div className={styles.timeColumn}>
          {/* Empty header to align with day headers */}
          <div className={styles.timeHeader}></div>
          {/* Time slots */}
          <div className={styles.timeSlots}>
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

        {/* Days columns */}
        <div className={styles.daysContainer}>
          {weekDays.map(day => (
            <div key={day.dayName} className={styles.dayColumn}>
              <div className={styles.dayHeader}>
                <div className={styles.dayName}>{day.dayName}</div>
                <div className={styles.dayDate}>{day.dayDisplay}</div>
              </div>

              {/* Time slots for this day */}
              <div className={styles.daySlots}>
                {/* Current time indicator for today */}
                {format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                  <div
                    className={styles.currentTimeIndicator}
                    style={{ top: `${(currentTime.getHours() * 2 + (currentTime.getMinutes() >= 30 ? 1 : 0)) * TIME_SLOT_HEIGHT}px` }}
                  />
                )}
                {timeSlots.map(slot => {
                  const tasksInSlot = getTasksForSlot(day.date, slot);
                  return (
                    <div
                      key={slot.time}
                      className={styles.slot}
                      style={{ height: `${slot.height}px` }}
                    >
                      {tasksInSlot.map(task => {
                        const { title, type, color, height, top, status } = getTaskDisplayProps(task);
                        return (
                          <div
                            key={task.key}
                            className={`${styles.task} 
                              ${status === 'completed' ? styles.taskCompleted : ''}
                              ${status === 'paused' ? styles.taskPaused : ''}`
                            }
                            style={{
                              backgroundColor: color,
                              height: `${height}px`,
                              top: `${top}px`,
                            }}
                            title={`${title} (${type}) - ${status}`}
                            onClick={(e) => handleTaskClick(e, task)}
                          >
                            <span className={styles.taskTitle}>{title} - {type}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className={styles.contextMenu}
          style={{
            position: 'fixed',
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            zIndex: 1000,
          }}
        >
          <button onClick={handleCompleteTask}>✓ Complete</button>
          <button onClick={handlePauseTask}>⏸ Pause</button>
          <button onClick={handleRescheduleTask}>🔄 Reschedule</button>
          <button onClick={handleDeleteTask}>🗑 Delete</button>
          {selectedTask?.scheduledTime && (
            <div className={styles.contextMenuGroup}>
              <span style={{ padding: '6px 8px', display: 'block', color: '#666' }}>Snooze</span>
              <button onClick={() => handleSnooze(15)}>+15 min</button>
              <button onClick={() => handleSnooze(30)}>+30 min</button>
              <button onClick={() => handleSnooze(60)}>+1 hr</button>
            </div>
          )}
        </div>
      )}
      <CalendarSync />
    </div>
  );
}

export default CalendarView;
