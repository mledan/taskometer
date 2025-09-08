import { useEffect, useState } from 'react';
import { useAppState } from '../AppContext.jsx';
import { format, addDays, startOfWeek, isWithinInterval } from 'date-fns';
import styles from './CalendarView.module.css';

const HOURS_IN_DAY = 24;
const TIME_SLOT_HEIGHT = 30; // pixels per 30-minute slot

function CalendarView() {
  const { items = [], taskTypes = [] } = useAppState();
  const dispatch = useAppReducer();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [timeSlots, setTimeSlots] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  function handleTaskClick(task) {
    if (task.status === 'completed') {
      dispatch({
        type: 'UPDATE_ITEM',
        item: { ...task, status: 'pending' }
      });
    } else {
      const taskStartTime = new Date(task.scheduledTime);
      const now = new Date();
      
      if (taskStartTime < now && task.status === 'pending') {
        dispatch({
          type: 'UPDATE_ITEM',
          item: { ...task, status: 'paused' }
        });
      } else {
        dispatch({
          type: 'UPDATE_ITEM',
          item: { ...task, status: 'completed' }
        });
      }
    }
  }

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
        slots.push({
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
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
    slotTime.setHours(hours, minutes);

    return items
      .filter(item => item.scheduledTime && item.status !== 'completed')
      .filter(item => {
        const taskStart = new Date(item.scheduledTime);
        const taskEnd = new Date(taskStart.getTime() + item.duration * 60000);

        return isWithinInterval(slotTime, { start: taskStart, end: taskEnd });
      });
  }

  // Calculate task display properties
  function getTaskDisplayProps(task) {
    const taskType = taskTypes.find(t => t.id === task.taskType) || { 
      name: 'Default',
      color: 'var(--accent-color)'
    };

    const startTime = new Date(task.scheduledTime);
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
          {timeSlots.map(slot => (
            <div
              key={slot.time}
              className={styles.timeSlot}
              style={{ height: `${slot.height}px` }}
            >
              {slot.time}
            </div>
          ))}
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
                            onClick={() => handleTaskClick(task)}
                          >
                            <span className={styles.taskTitle}>{title} - {type}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
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
    </div>
  );
}

export default CalendarView;
