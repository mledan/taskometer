/**
 * TaskInput Component (Enhanced AddItemForm)
 *
 * Task creation form with multi-tag support and improved UX.
 * Replaces AddItemForm while maintaining backwards compatibility.
 *
 * Features:
 * - Task text input with auto-scheduling toggle
 * - Type selector with color preview
 * - Multi-tag selector
 * - Scheduling options (immediate, delay, specific)
 * - Duration and priority
 * - Preview of next available slot
 */

import { useRef, useState, useMemo, useEffect } from 'react';
import { useAppReducer, useAppState } from '../../AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { TagSelector } from '../tags';
import { createTask } from '../../models/Task';
import { findOptimalTimeSlot } from '../../utils/intelligentScheduler';
import { getActiveSchedule } from '../../utils/scheduleTemplates';
import styles from './TaskInput.module.css';

function TaskInput({ onTaskAdded }) {
  const dispatch = useAppReducer();
  const { taskTypes = [], tasks = [], activeSchedule, settings = {} } = useAppState();

  const inputRef = useRef();

  // Form state
  const [taskText, setTaskText] = useState('');
  const [taskType, setTaskType] = useState('work');
  const [selectedTags, setSelectedTags] = useState([]);
  const [schedulingPreference, setSchedulingPreference] = useState('immediate');
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState('medium');
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [specificDay, setSpecificDay] = useState('');
  const [specificTime, setSpecificTime] = useState('09:00');
  const [autoSchedule, setAutoSchedule] = useState(true);

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewSlot, setPreviewSlot] = useState(null);

  // Get the current task type config
  const currentTypeConfig = useMemo(() => {
    return taskTypes.find(t => t.id === taskType) || { color: '#3B82F6', defaultDuration: 30 };
  }, [taskTypes, taskType]);

  // Update duration when task type changes
  useEffect(() => {
    if (currentTypeConfig.defaultDuration) {
      setDuration(currentTypeConfig.defaultDuration);
    }
  }, [taskType, currentTypeConfig.defaultDuration]);

  // Preview next available slot
  useEffect(() => {
    if (!autoSchedule || !taskText || schedulingPreference !== 'immediate') {
      setPreviewSlot(null);
      return;
    }

    const schedule = activeSchedule || getActiveSchedule();
    if (!schedule) {
      setPreviewSlot(null);
      return;
    }

    const previewTask = {
      taskType,
      primaryType: taskType,
      duration,
      tags: selectedTags
    };

    const slot = findOptimalTimeSlot(previewTask, schedule, tasks, taskTypes);
    setPreviewSlot(slot);
  }, [taskText, taskType, duration, selectedTags, autoSchedule, schedulingPreference, activeSchedule, tasks, taskTypes]);

  function handleSubmit(e) {
    e.preventDefault();

    if (!taskText.trim()) return;

    const newTask = {
      ...createTask({
      text: taskText.trim(),
      status: 'pending',
      primaryType: taskType,
      taskType: taskType, // Legacy compatibility
      tags: selectedTags,
      duration,
      priority,
      schedulingPreference,
      delayMinutes: schedulingPreference === 'delay' ? delayMinutes : 0,
      specificDay: schedulingPreference === 'specific' ? specificDay : null,
      specificTime: schedulingPreference === 'specific' ? specificTime : null,
      scheduledTime: null
      }),
      autoSchedule
    };

    // Dispatch the add action (will auto-schedule based on context settings)
    dispatch({ type: ACTION_TYPES.ADD_TASK, payload: newTask });

    // Also trigger scheduling if preference requires it
    if (autoSchedule && (schedulingPreference === 'immediate' || schedulingPreference === 'specific' || schedulingPreference === 'delay')) {
      dispatch({ type: ACTION_TYPES.SCHEDULE_TASKS, payload: { tasks: [newTask] } });
    }

    // Callback for parent
    if (onTaskAdded) {
      onTaskAdded(newTask);
    }

    // Reset form
    setTaskText('');
    setSelectedTags([]);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    // Expand on first keystroke
    if (!isExpanded && e.key !== 'Escape') {
      setIsExpanded(true);
    }

    // Submit on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  }

  function formatPreviewTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${timeStr}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${timeStr}`;
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }) + ` at ${timeStr}`;
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {/* Main input */}
      <div className={styles.mainInput}>
        <div
          className={styles.typeIndicator}
          style={{ backgroundColor: currentTypeConfig.color }}
          title={`Type: ${currentTypeConfig.name || taskType}`}
        />
        <input
          ref={inputRef}
          type="text"
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsExpanded(true)}
          placeholder="What needs to be done?"
          autoFocus
        />
        <button type="submit" className={styles.submitButton} aria-label="Add task" />

        {/* Preview slot indicator */}
        {previewSlot && taskText && (
          <div className={styles.slotPreview}>
            → {formatPreviewTime(previewSlot.scheduledFor)}
          </div>
        )}
      </div>

      {/* Expanded options */}
      {isExpanded && (
        <div className={styles.options}>
          {/* Row 1: Type and Tags */}
          <div className={styles.optionsRow}>
            <label className={styles.typeLabel}>
              <span className={styles.labelText}>Type</span>
              <div className={styles.typeSelectWrapper}>
                <div
                  className={styles.typeColorDot}
                  style={{ backgroundColor: currentTypeConfig.color }}
                />
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className={styles.typeSelect}
                >
                  {taskTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className={styles.tagsWrapper}>
              <span className={styles.labelText}>Tags</span>
              <TagSelector
                selectedTags={selectedTags}
                onChange={setSelectedTags}
                placeholder="Add tags..."
                maxTags={5}
                compact
              />
            </div>
          </div>

          {/* Row 2: Scheduling options */}
          <div className={styles.optionsRow}>
            <label className={styles.scheduleLabel}>
              <span className={styles.labelText}>Schedule</span>
              <select
                value={schedulingPreference}
                onChange={(e) => setSchedulingPreference(e.target.value)}
              >
                <option value="immediate">Auto-schedule now</option>
                <option value="delay">Delay start</option>
                <option value="specific">Specific time</option>
              </select>
            </label>

            <label className={styles.durationLabel}>
              <span className={styles.labelText}>Duration</span>
              <div className={styles.durationInput}>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                  min="5"
                  max="480"
                />
                <span className={styles.durationUnit}>min</span>
              </div>
            </label>

            <label className={styles.priorityLabel}>
              <span className={styles.labelText}>Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </label>
          </div>

          {/* Conditional scheduling inputs */}
          {schedulingPreference === 'delay' && (
            <div className={styles.optionsRow}>
              <label className={styles.delayLabel}>
                <span className={styles.labelText}>Delay by</span>
                <div className={styles.delayInput}>
                  <input
                    type="number"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <span className={styles.delayUnit}>minutes</span>
                </div>
              </label>
            </div>
          )}

          {schedulingPreference === 'specific' && (
            <div className={styles.optionsRow}>
              <label className={styles.dateLabel}>
                <span className={styles.labelText}>Date</span>
                <input
                  type="date"
                  value={specificDay}
                  onChange={(e) => setSpecificDay(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </label>
              <label className={styles.timeLabel}>
                <span className={styles.labelText}>Time</span>
                <input
                  type="time"
                  value={specificTime}
                  onChange={(e) => setSpecificTime(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* Auto-schedule toggle */}
          <div className={styles.optionsFooter}>
            <label className={styles.autoScheduleToggle}>
              <input
                type="checkbox"
                checked={autoSchedule}
                onChange={(e) => setAutoSchedule(e.target.checked)}
              />
              <span>Auto-schedule to next available slot</span>
            </label>

            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setIsExpanded(false)}
            >
              Collapse options
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export default TaskInput;
