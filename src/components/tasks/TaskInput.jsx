import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppReducer, useAppState } from '../../AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { createTask } from '../../models/Task';
import { previewTaskSchedule } from '../../utils/schedulingEngine';
import { TagSelector } from '../tags';
import styles from './TaskInput.module.css';

function TaskInput({ onTaskAdded }) {
  const dispatch = useAppReducer();
  const {
    taskTypes = [],
    tasks = [],
    slots = [],
    settings = {},
    palaces = [],
  } = useAppState();

  const inputRef = useRef();
  const [taskText, setTaskText] = useState('');
  const [taskType, setTaskType] = useState(taskTypes[0]?.id || 'work');
  const [duration, setDuration] = useState(30);
  const [locationKey, setLocationKey] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [preview, setPreview] = useState(null);
  const [justScheduled, setJustScheduled] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  const currentTypeConfig = useMemo(() => {
    return taskTypes.find(t => t.id === taskType) || { color: '#3B82F6', defaultDuration: 30 };
  }, [taskTypes, taskType]);

  useEffect(() => {
    if (taskTypes.length === 0) return;
    if (!taskTypes.some((type) => type.id === taskType)) {
      setTaskType(taskTypes[0].id);
    }
  }, [taskTypes, taskType]);

  const allLocations = useMemo(() => {
    return palaces.flatMap((palace) => {
      return (palace.locations || []).map((location) => ({
        key: `${palace.id}::${location.id}`,
        palaceId: palace.id,
        locationId: location.id,
        label: `${palace.name} / ${location.name}`
      }));
    });
  }, [palaces]);

  useEffect(() => {
    if (currentTypeConfig.defaultDuration) {
      setDuration(currentTypeConfig.defaultDuration);
    }
  }, [taskType, currentTypeConfig.defaultDuration]);

  useEffect(() => {
    if (!taskText.trim()) {
      setPreview(null);
      return;
    }

    const previewTask = {
      id: 'preview',
      taskType,
      primaryType: taskType,
      tags: selectedTags,
      duration,
    };

    const result = previewTaskSchedule(previewTask, {
      slots,
      tasks,
      settings,
      taskTypes,
    });

    setPreview(result);
  }, [taskText, taskType, duration, selectedTags, slots, tasks, settings, taskTypes]);

  const hasFramework = useMemo(() => {
    if (slots.length > 0) return true;
    const ds = settings?.defaultDaySlots;
    return Array.isArray(ds) && ds.length > 0;
  }, [slots, settings]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!taskText.trim()) return;

    const task = createTask({
      text: taskText.trim(),
      status: 'pending',
      primaryType: taskType,
      taskType,
      tags: selectedTags,
      duration,
      priority: 'medium',
      scheduledTime: null,
    });

    dispatch({
      type: ACTION_TYPES.ADD_TASK,
      payload: {
        ...task,
        autoSchedule: true,
      },
    });

    if (locationKey) {
      const [palaceId, locationId] = locationKey.split('::');
      const palace = palaces.find((entry) => entry.id === palaceId);
      const location = palace?.locations?.find((entry) => entry.id === locationId);
      if (palace && location) {
        const existingLinks = Array.isArray(location.linkedTaskIds) ? location.linkedTaskIds : [];
        const nextLinks = existingLinks.includes(task.id)
          ? existingLinks
          : [...existingLinks, task.id];

        dispatch({
          type: ACTION_TYPES.UPDATE_PALACE_LOCATION,
          payload: {
            palaceId,
            locationId,
            updates: { linkedTaskIds: nextLinks },
          },
        });
      }
    }

    if (onTaskAdded) onTaskAdded(task);

    setJustScheduled(preview);
    setTimeout(() => setJustScheduled(null), 3500);

    setTaskText('');
    setLocationKey('');
    setSelectedTags([]);
    inputRef.current?.focus();
  }

  function formatPreviewTime(result) {
    if (!result?.scheduledTime) return null;
    const date = new Date(result.scheduledTime);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    let dayLabel;
    if (date.toDateString() === now.toDateString()) {
      dayLabel = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayLabel = 'Tomorrow';
    } else {
      dayLabel = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    return { dayLabel, timeStr, full: `${dayLabel} at ${timeStr}` };
  }

  const previewInfo = preview ? formatPreviewTime(preview) : null;

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={handleSubmit}>
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
            placeholder="What needs to be done?"
            autoFocus
          />
          <button
            type="button"
            className={styles.optionsToggle}
            onClick={() => setShowOptions(v => !v)}
            title="Options"
            aria-label="Toggle options"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="3" cy="8" r="1.5" fill="currentColor" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="13" cy="8" r="1.5" fill="currentColor" />
            </svg>
          </button>
          <button type="submit" className={styles.submitButton} aria-label="Add task" />
        </div>

        {/* Live scheduling preview */}
        {taskText.trim() && (
          <div className={`${styles.previewBar} ${preview ? (preview.overflowed ? styles.previewBarOverflow : styles.previewBarActive) : styles.previewBarEmpty}`}>
            {preview ? (
              <>
                <span className={styles.previewIcon}>
                  {preview.overflowed ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <path d="M7 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M10 2l2 2M10 6l2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                    </svg>
                  ) : hasFramework ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="2" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1" />
                      <line x1="5" y1="5.5" x2="5" y2="12" stroke="currentColor" strokeWidth="1" />
                      <line x1="9" y1="5.5" x2="9" y2="12" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <line x1="7" y1="4" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="7" y1="7.5" x2="9.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                <span className={styles.previewText}>
                  <span className={styles.previewDay}>{previewInfo?.dayLabel}</span>
                  <span className={styles.previewTime}>{previewInfo?.timeStr}</span>
                </span>
                {preview.label && (
                  <span
                    className={styles.previewSlotBadge}
                    style={{ borderColor: preview.slotColor || currentTypeConfig.color }}
                  >
                    {preview.label}
                  </span>
                )}
                {preview.overflowed && (
                  <span className={styles.previewOverflowHint}>
                    Today is full — flows to {previewInfo?.dayLabel}
                  </span>
                )}
                {!hasFramework && !preview.overflowed && (
                  <span className={styles.previewHint}>no framework</span>
                )}
              </>
            ) : (
              <span className={styles.previewEmpty}>No available slot found</span>
            )}
          </div>
        )}

        {showOptions && (
          <div className={styles.options}>
            <label>
              <span className={styles.labelText}>Type</span>
              <select
                value={taskType}
                onChange={(event) => setTaskType(event.target.value)}
              >
                {taskTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={styles.labelText}>Duration</span>
              <div className={styles.durationRow}>
                {(() => {
                  const base = [15, 30, 60];
                  const typeDur = currentTypeConfig.defaultDuration;
                  const chips = typeDur && !base.includes(typeDur) ? [...base, typeDur].sort((a, b) => a - b) : base;
                  return chips.map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.durationChip} ${duration === d ? styles.durationChipActive : ''}`}
                      onClick={() => setDuration(d)}
                    >
                      {d >= 60 ? `${d / 60}h` : `${d}m`}
                    </button>
                  ));
                })()}
              </div>
            </label>

            {allLocations.length > 0 && (
              <label>
                <span className={styles.labelText}>Memory Palace</span>
                <select value={locationKey} onChange={(event) => setLocationKey(event.target.value)}>
                  <option value="">No linked location</option>
                  {allLocations.map((location) => (
                    <option key={location.key} value={location.key}>
                      {location.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className={styles.tagSelectorField}>
              <span className={styles.labelText}>Tags</span>
              <TagSelector
                selectedTags={selectedTags}
                onChange={setSelectedTags}
                placeholder="Add task tags"
                compact={true}
              />
            </label>
          </div>
        )}
      </form>

      {/* Post-schedule confirmation toast */}
      {justScheduled && (
        <div className={`${styles.toast} ${justScheduled.overflowed ? styles.toastOverflow : ''}`}>
          <span className={styles.toastCheck}>
            {justScheduled.overflowed ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#F59E0B" />
                <path d="M8 5v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.75" fill="white" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#10B981" />
                <path d="M5 8.5L7 10.5L11 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span>
            {justScheduled.overflowed ? (
              <>
                Flows to{' '}
                <strong>{formatPreviewTime(justScheduled)?.dayLabel}</strong>
                {' '}at {formatPreviewTime(justScheduled)?.timeStr}
                <span className={styles.toastOverflowMessage}>
                  — can't fit it all today, and that's okay. Time is cyclical.
                </span>
              </>
            ) : (
              <>
                Scheduled {justScheduled.label
                  ? <strong>{justScheduled.label}</strong>
                  : formatPreviewTime(justScheduled)?.full
                }
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export default TaskInput;
