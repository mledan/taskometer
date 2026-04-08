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

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { useAppState, useAppReducer, useSlots, useTaskTypes } from '../../context/AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { toLocalTime } from '../../utils/timeDisplay';
import SlotEditor from './SlotEditor';
import styles from './WeekView.module.css';

const TIME_SLOT_HEIGHT = 30; // pixels per 30-minute slot
const HOURS_IN_DAY = 24;
const SNAP_MINUTES = 15;
const PIXELS_PER_MINUTE = TIME_SLOT_HEIGHT / 30;

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

  const [selectedTask, setSelectedTask] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ text: '', taskType: '', duration: 30, priority: 'medium' });

  // Drag-and-drop state
  const dragRef = useRef(null);
  const daysContainerRef = useRef(null);
  const [dragGhost, setDragGhost] = useState(null); // { task, top, dayIndex, minutes, displayTime }

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
      const taskForReschedule = {
        ...selectedTask,
        scheduledTime: null,
        scheduledFor: null,
        specificTime: null,
        specificDay: null,
        schedulingPreference: 'immediate'
      };
      dispatch({
        type: ACTION_TYPES.SCHEDULE_TASKS,
        payload: { tasks: [taskForReschedule] }
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

  function handleEditTask() {
    if (selectedTask) {
      setEditingTask(selectedTask);
      setEditForm({
        text: selectedTask.text || '',
        taskType: selectedTask.taskType || selectedTask.primaryType || '',
        duration: selectedTask.duration || 30,
        priority: selectedTask.priority || 'medium',
      });
      setShowContextMenu(false);
    }
  }

  function handleSaveEdit() {
    if (!editingTask || !editForm.text.trim()) return;
    dispatch({
      type: ACTION_TYPES.UPDATE_TASK,
      payload: {
        id: editingTask.id || editingTask.key,
        text: editForm.text.trim(),
        taskType: editForm.taskType,
        primaryType: editForm.taskType,
        duration: editForm.duration,
        priority: editForm.priority,
      }
    });
    setEditingTask(null);
  }

  function handleCancelEdit() {
    setEditingTask(null);
  }

  /**
   * Drag-and-drop handlers
   */
  function getMinutesFromY(y, containerRect) {
    const relativeY = y - containerRect.top;
    const totalMinutes = relativeY / PIXELS_PER_MINUTE;
    return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  }

  function getDayIndexFromX(x, containerRect) {
    const relativeX = x - containerRect.left;
    const columnWidth = containerRect.width / 7;
    return Math.max(0, Math.min(6, Math.floor(relativeX / columnWidth)));
  }

  function formatMinutesToTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  function handleDragStart(e, task) {
    if (e.button !== 0) return; // left-click only
    e.preventDefault();
    e.stopPropagation();

    const container = daysContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const minutes = getMinutesFromY(e.clientY, containerRect);
    const dayIndex = getDayIndexFromX(e.clientX, containerRect);

    const startTime = new Date(task.scheduledTime);
    const taskStartMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const offsetMinutes = minutes - taskStartMinutes;

    dragRef.current = {
      task,
      offsetMinutes,
      containerRect,
      startedDrag: false,
      startX: e.clientX,
      startY: e.clientY
    };

    function onMouseMove(ev) {
      const dr = dragRef.current;
      if (!dr) return;

      // Require 5px movement before starting drag (to allow clicks)
      if (!dr.startedDrag) {
        const dx = ev.clientX - dr.startX;
        const dy = ev.clientY - dr.startY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        dr.startedDrag = true;
      }

      const rect = dr.containerRect;
      const rawMinutes = getMinutesFromY(ev.clientY, rect) - dr.offsetMinutes;
      const snappedMinutes = Math.max(0, Math.min(24 * 60 - dr.task.duration, rawMinutes));
      const newDayIndex = getDayIndexFromX(ev.clientX, rect);
      const topPx = snappedMinutes * PIXELS_PER_MINUTE;

      setDragGhost({
        task: dr.task,
        top: topPx,
        dayIndex: newDayIndex,
        minutes: snappedMinutes,
        displayTime: formatMinutesToTime(snappedMinutes)
      });
    }

    function onMouseUp(ev) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const dr = dragRef.current;
      dragRef.current = null;

      if (!dr || !dr.startedDrag) {
        setDragGhost(null);
        return;
      }

      const rect = dr.containerRect;
      const rawMinutes = getMinutesFromY(ev.clientY, rect) - dr.offsetMinutes;
      const snappedMinutes = Math.max(0, Math.min(24 * 60 - dr.task.duration, rawMinutes));
      const newDayIndex = getDayIndexFromX(ev.clientX, rect);
      const targetDate = weekDays[newDayIndex].date;

      const newScheduledTime = new Date(targetDate);
      newScheduledTime.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);

      dispatch({
        type: ACTION_TYPES.RESCHEDULE_TASK,
        payload: {
          taskId: dr.task.id || dr.task.key,
          scheduledTime: newScheduledTime.toISOString()
        }
      });

      setDragGhost(null);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Resize handle drag
  function handleResizeStart(e, task) {
    e.preventDefault();
    e.stopPropagation();

    const container = daysContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const startTime = new Date(task.scheduledTime);
    const taskStartMinutes = startTime.getHours() * 60 + startTime.getMinutes();

    function onMouseMove(ev) {
      const endMinutes = getMinutesFromY(ev.clientY, containerRect);
      const newDuration = Math.max(SNAP_MINUTES, endMinutes - taskStartMinutes);
      const snappedDuration = Math.round(newDuration / SNAP_MINUTES) * SNAP_MINUTES;
      const props = getTaskDisplayProps({ ...task, duration: snappedDuration });

      setDragGhost({
        task: { ...task, duration: snappedDuration },
        top: props.top,
        dayIndex: weekDays.findIndex(d => isSameDay(d.date, startTime)),
        minutes: taskStartMinutes,
        displayTime: `${snappedDuration}m`,
        isResize: true
      });
    }

    function onMouseUp(ev) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const endMinutes = getMinutesFromY(ev.clientY, containerRect);
      const newDuration = Math.max(SNAP_MINUTES, endMinutes - taskStartMinutes);
      const snappedDuration = Math.round(newDuration / SNAP_MINUTES) * SNAP_MINUTES;

      dispatch({
        type: ACTION_TYPES.UPDATE_TASK,
        payload: {
          id: task.id || task.key,
          duration: snappedDuration
        }
      });

      setDragGhost(null);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

        <div className={styles.navRight} />
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
        <div className={styles.daysContainer} ref={daysContainerRef}>
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

                  {/* Slot framework - always visible and interactive */}
                  {showSlots && (
                    <SlotEditor
                      date={day.date}
                      dayOffset={weekDays.indexOf(day)}
                      isActive={true}
                      existingSlots={daySlots}
                    />
                  )}

                  {/* Tasks */}
                  {dayTasks.map(task => {
                    const props = getTaskDisplayProps(task);
                    const isDragging = dragGhost && (dragGhost.task.id === task.id || dragGhost.task.key === task.key);
                    return (
                      <div
                        key={task.id || task.key}
                        className={`${styles.task}
                          ${props.status === 'completed' ? styles.taskCompleted : ''}
                          ${props.status === 'paused' ? styles.taskPaused : ''}
                          ${props.isCurrent ? styles.taskCurrent : ''}
                          ${props.isPast && props.status !== 'completed' ? styles.taskPast : ''}
                          ${isDragging ? styles.taskDragging : ''}`
                        }
                        style={{
                          backgroundColor: props.color,
                          height: `${props.height}px`,
                          top: `${props.top}px`
                        }}
                        onMouseDown={(e) => handleDragStart(e, task)}
                        onClick={(e) => {
                          if (!dragRef.current?.startedDrag) handleTaskClick(e, task);
                        }}
                        title={`${props.title} (${props.type})`}
                      >
                        <span className={styles.taskTitle}>{props.title}</span>
                        {/* Resize handle */}
                        <div
                          className={styles.resizeHandle}
                          onMouseDown={(e) => handleResizeStart(e, task)}
                        />
                      </div>
                    );
                  })}

                  {/* Drag ghost */}
                  {dragGhost && dragGhost.dayIndex === weekDays.indexOf(day) && (
                    <div
                      className={styles.dragGhost}
                      style={{
                        top: `${dragGhost.top}px`,
                        height: `${(dragGhost.task.duration / 30) * TIME_SLOT_HEIGHT}px`,
                        backgroundColor: (taskTypes.find(t => t.id === dragGhost.task.taskType) || {}).color || 'var(--accent-color)'
                      }}
                    >
                      <span className={styles.dragGhostTime}>{dragGhost.displayTime}</span>
                      <span className={styles.taskTitle}>{dragGhost.task.text}</span>
                    </div>
                  )}
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
          <button onClick={handleEditTask}>✏️ Edit</button>
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

      {/* Edit Task Modal */}
      {editingTask && (
        <div className={styles.editOverlay} onClick={handleCancelEdit}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.editTitle}>Edit Task</h3>
            <div className={styles.editField}>
              <label>Task</label>
              <input
                type="text"
                value={editForm.text}
                onChange={(e) => setEditForm(prev => ({ ...prev, text: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                autoFocus
              />
            </div>
            <div className={styles.editRow}>
              <div className={styles.editField}>
                <label>Type</label>
                <select
                  value={editForm.taskType}
                  onChange={(e) => setEditForm(prev => ({ ...prev, taskType: e.target.value }))}
                >
                  <option value="">None</option>
                  {taskTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.editField}>
                <label>Duration</label>
                <div className={styles.editDurationRow}>
                  {[15, 30, 60, 90, 120].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.editDurationChip} ${editForm.duration === d ? styles.editDurationActive : ''}`}
                      onClick={() => setEditForm(prev => ({ ...prev, duration: d }))}
                    >{d}m</button>
                  ))}
                </div>
              </div>
              <div className={styles.editField}>
                <label>Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className={styles.editActions}>
              <button className={styles.editSaveBtn} onClick={handleSaveEdit}>Save</button>
              <button className={styles.editCancelBtn} onClick={handleCancelEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeekView;
