import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppReducer, useAppState } from '../../AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { createTask } from '../../models/Task';
import { getSlotStartDateTime } from '../../models/CalendarSlot';
import { findOptimalSlot } from '../../utils/slotMatcher';
import { TagSelector } from '../tags';
import styles from './TaskInput.module.css';

function TaskInput({ onTaskAdded }) {
  const dispatch = useAppReducer();
  const { taskTypes = [], tasks = [], slots = [], palaces = [] } = useAppState();

  const inputRef = useRef();

  const [taskText, setTaskText] = useState('');
  const [taskType, setTaskType] = useState(taskTypes[0]?.id || 'work');
  const [duration, setDuration] = useState(30);
  const [locationKey, setLocationKey] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [previewSlot, setPreviewSlot] = useState(null);

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
      setPreviewSlot(null);
      return;
    }

    if (slots.length === 0) {
      setPreviewSlot(null);
      return;
    }

    const previewTask = {
      id: 'preview',
      taskType,
      primaryType: taskType,
      tags: selectedTags,
      duration
    };
    const match = findOptimalSlot(previewTask, slots, tasks);
    setPreviewSlot(match?.slot || null);
  }, [taskText, taskType, duration, selectedTags, slots, tasks]);

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
      scheduledTime: null
    });

    dispatch({
      type: ACTION_TYPES.ADD_TASK,
      payload: {
        ...task,
        autoSchedule: true
      }
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
            updates: {
              linkedTaskIds: nextLinks
            }
          }
        });
      }
    }

    if (onTaskAdded) {
      onTaskAdded(task);
    }

    setTaskText('');
    setLocationKey('');
    setSelectedTags([]);
    inputRef.current?.focus();
  }

  function formatPreviewTime(slot) {
    if (!slot) return '';
    const date = getSlotStartDateTime(slot);
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
        <button type="submit" className={styles.submitButton} aria-label="Add task" />
      </div>

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
          <span className={styles.labelText}>Duration (minutes)</span>
          <input
            type="number"
            value={duration}
            min="5"
            max="480"
            onChange={(event) => setDuration(parseInt(event.target.value, 10) || 30)}
          />
        </label>

        <label>
          <span className={styles.labelText}>Memory Palace location (optional)</span>
          <select value={locationKey} onChange={(event) => setLocationKey(event.target.value)}>
            <option value="">No linked location</option>
            {allLocations.map((location) => (
              <option key={location.key} value={location.key}>
                {location.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.tagSelectorField}>
          <span className={styles.labelText}>Tags (optional)</span>
          <TagSelector
            selectedTags={selectedTags}
            onChange={setSelectedTags}
            placeholder="Add task tags"
            compact={true}
          />
        </label>
      </div>

      <div className={styles.slotPreview}>
        {previewSlot
          ? `Next slot: ${formatPreviewTime(previewSlot)}`
          : 'No future matching slot found. Add slots in Defaults or Calendar.'}
      </div>
    </form>
  );
}

export default TaskInput;
