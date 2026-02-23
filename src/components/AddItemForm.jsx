import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppReducer, useAppState } from '../AppContext.jsx';
import { previewTaskSchedule } from '../utils/schedulingEngine';
import styles from './AddItemForm.module.css';

function AddItemForm() {
  const dispatch = useAppReducer();
  const { taskTypes, tasks = [], slots = [], settings = {} } = useAppState();
  let inputRef = useRef();

  const [taskType, setTaskType] = useState('work');
  const [schedulingPreference, setSchedulingPreference] = useState('immediate');
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState('medium');
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [specificDay, setSpecificDay] = useState(null);
  const [specificTime, setSpecificTime] = useState('09:00');
  const [taskText, setTaskText] = useState('');
  const [preview, setPreview] = useState(null);
  const [justScheduled, setJustScheduled] = useState(null);

  const hasFramework = useMemo(() => {
    if (slots.length > 0) return true;
    const ds = settings?.defaultDaySlots;
    return Array.isArray(ds) && ds.length > 0;
  }, [slots, settings]);

  useEffect(() => {
    if (!taskText.trim()) {
      setPreview(null);
      return;
    }

    if (schedulingPreference !== 'immediate') {
      setPreview(null);
      return;
    }

    const previewTask = {
      id: 'preview',
      taskType,
      primaryType: taskType,
      tags: [],
      duration,
    };

    const result = previewTaskSchedule(previewTask, {
      slots,
      tasks,
      settings,
      taskTypes,
    });

    setPreview(result);
  }, [taskText, taskType, duration, schedulingPreference, slots, tasks, settings, taskTypes]);

  function formatPreviewTime(result) {
    if (!result?.scheduledTime) return '';
    const date = new Date(result.scheduledTime);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (date.toDateString() === now.toDateString()) {
      return `Today at ${timeStr}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${timeStr}`;
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }) + ` at ${timeStr}`;
    }
  }

  function addItem(e) {
    e.preventDefault();
    const text = inputRef.current?.value || taskText;
    const newItem = {
      text,
      key: Date.now(),
      status: 'pending',
      taskType,
      duration,
      schedulingPreference,
      priority,
      scheduledTime: null,
      delayMinutes: schedulingPreference === 'delay' ? delayMinutes : 0,
      specificDay: schedulingPreference === 'specific' ? specificDay : null,
      specificTime: schedulingPreference === 'specific' ? specificTime : null,
    };

    if (text.trim()) {
      dispatch({ type: 'ADD_ITEM', item: newItem });

      if (newItem.schedulingPreference === 'immediate' ||
          newItem.schedulingPreference === 'specific' ||
          newItem.schedulingPreference === 'delay') {
        dispatch({ type: 'SCHEDULE_TASKS', tasks: [newItem] });
      }

      setJustScheduled(preview);
      setTimeout(() => setJustScheduled(null), 3500);
    }

    if (inputRef.current) inputRef.current.value = '';
    setTaskText('');
    inputRef.current?.focus();
  }

  const currentTypeConfig = taskTypes.find(t => t.id === taskType) || { color: '#3B82F6' };

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={addItem}>
        <div className={styles.mainInput}>
          <div
            className={styles.typeIndicator}
            style={{ backgroundColor: currentTypeConfig.color }}
          />
          <input
            ref={inputRef}
            placeholder="Add new item"
            autoFocus
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
          />
          <button type="submit" className={styles.submitBtn} aria-label="Add" />
        </div>

        {/* Live scheduling preview for immediate mode */}
        {taskText.trim() && schedulingPreference === 'immediate' && (
          <div className={`${styles.previewBar} ${preview ? styles.previewActive : styles.previewEmpty}`}>
            {preview ? (
              <>
                <span className={styles.previewIcon}>
                  {hasFramework ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="2" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <line x1="7" y1="4" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="7" y1="7.5" x2="9.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                <span className={styles.previewText}>{formatPreviewTime(preview)}</span>
                {preview.label && (
                  <span
                    className={styles.previewSlotBadge}
                    style={{ borderColor: preview.slotColor || currentTypeConfig.color }}
                  >
                    {preview.label}
                  </span>
                )}
                {!hasFramework && (
                  <span className={styles.previewHint}>ad-hoc</span>
                )}
              </>
            ) : (
              <span className={styles.previewNoSlot}>No available slot found</span>
            )}
          </div>
        )}

        <div className={styles.options}>
          <label title="What kind of task is this?">
            Type
            <select
              value={taskType}
              onChange={(e) => {
                setTaskType(e.target.value);
                const typeConfig = taskTypes.find(t => t.id === e.target.value);
                setDuration(typeConfig?.defaultDuration || 30);
              }}
            >
              {taskTypes.map(type => (
                <option key={type.id} value={type.id}>{type.icon} {type.name}</option>
              ))}
            </select>
          </label>

          <label title="When should we schedule this?">
            Scheduling
            <select value={schedulingPreference} onChange={(e) => setSchedulingPreference(e.target.value)}>
              <option value="immediate">Next available slot</option>
              <option value="delay">Delay start</option>
              <option value="specific">Pick a date/time</option>
            </select>
          </label>

          <label title="How long should this take?">
            Duration
            <div className={styles.durationRow}>
              {[15, 30, 60].map(d => (
                <button
                  key={d}
                  type="button"
                  className={`${styles.durationChip} ${duration === d ? styles.durationChipActive : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d}m
                </button>
              ))}
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                min="5"
                max="480"
                className={styles.durationInput}
              />
            </div>
          </label>

          <label title="Task urgency">
            Priority
            <div className={styles.priorityRow}>
              {[
                { value: 'low', label: 'Low', color: '#94A3B8' },
                { value: 'medium', label: 'Med', color: '#F59E0B' },
                { value: 'high', label: 'High', color: '#EF4444' },
              ].map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`${styles.priorityChip} ${priority === p.value ? styles.priorityChipActive : ''}`}
                  style={priority === p.value ? { backgroundColor: p.color, borderColor: p.color } : {}}
                  onClick={() => setPriority(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </label>

          {schedulingPreference === 'delay' && (
            <label title="Delay the start by these minutes from now.">
              Delay (minutes)
              <input
                type="number"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                min="0"
                placeholder="15"
              />
            </label>
          )}

          {schedulingPreference === 'specific' && (
            <>
              <label title="Pick the calendar day to schedule on.">
                Date
                <input
                  type="date"
                  value={specificDay || ''}
                  onChange={(e) => setSpecificDay(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </label>
              <label title="Set the local time of day to start.">
                Time
                <input
                  type="time"
                  value={specificTime}
                  onChange={(e) => setSpecificTime(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      </form>

      {/* Post-schedule confirmation toast */}
      {justScheduled && (
        <div className={styles.toast}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="#10B981" />
            <path d="M5 8.5L7 10.5L11 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Scheduled for {formatPreviewTime(justScheduled)}</span>
        </div>
      )}
    </div>
  );
}

export default AddItemForm;
