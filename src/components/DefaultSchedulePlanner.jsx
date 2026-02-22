import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ACTION_TYPES, useAppReducer, useAppState } from '../AppContext.jsx';
import styles from './DefaultSchedulePlanner.module.css';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_SOURCE_ID = 'default-day-slots';

function createTemplateId() {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hasValidTimeRange(startTime, endTime) {
  return typeof startTime === 'string' &&
    typeof endTime === 'string' &&
    startTime < endTime;
}

function buildUpcomingBlocks(defaultDaySlots, daysAhead = 21) {
  const blocks = [];
  const today = new Date();

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset += 1) {
    const targetDate = addDays(today, dayOffset);
    const dayName = format(targetDate, 'EEEE');
    const dateString = format(targetDate, 'yyyy-MM-dd');

    defaultDaySlots
      .filter((slot) => slot.day === dayName)
      .forEach((slot) => {
        blocks.push({
          date: dateString,
          start: slot.startTime,
          end: slot.endTime,
          slotType: slot.slotType,
          label: slot.label,
          color: slot.color,
          flexibility: slot.flexibility,
          sourceScheduleId: DEFAULT_SOURCE_ID,
          sourceBlockId: slot.id
        });
      });
  }

  return blocks;
}

function DefaultSchedulePlanner() {
  const dispatch = useAppReducer();
  const { taskTypes = [], settings = {}, slots = [] } = useAppState();

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [slotType, setSlotType] = useState(taskTypes[0]?.id || 'work');
  const [label, setLabel] = useState('');
  const [flexibility, setFlexibility] = useState('fixed');
  const [message, setMessage] = useState('');

  const defaultDaySlots = Array.isArray(settings.defaultDaySlots) ? settings.defaultDaySlots : [];
  const todayString = format(new Date(), 'yyyy-MM-dd');

  const selectedType = taskTypes.find((type) => type.id === slotType);

  useEffect(() => {
    if (taskTypes.length === 0) return;
    if (!taskTypes.some((type) => type.id === slotType)) {
      setSlotType(taskTypes[0].id);
    }
  }, [taskTypes, slotType]);
  const slotsForSelectedDay = useMemo(() => {
    return defaultDaySlots
      .filter((slot) => slot.day === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [defaultDaySlots, selectedDay]);

  const activeGeneratedSlots = useMemo(() => {
    return slots.filter(
      (slot) => slot.sourceScheduleId === DEFAULT_SOURCE_ID && slot.date >= todayString
    );
  }, [slots, todayString]);

  function saveDefaultSlots(nextSlots) {
    dispatch({
      type: ACTION_TYPES.UPDATE_SETTINGS,
      payload: {
        defaultDaySlots: nextSlots
      }
    });
  }

  function handleAddSlot(event) {
    event.preventDefault();

    if (!hasValidTimeRange(startTime, endTime)) {
      setMessage('End time must be after start time.');
      return;
    }

    const newSlot = {
      id: createTemplateId(),
      day: selectedDay,
      startTime,
      endTime,
      slotType,
      label: label.trim() || selectedType?.name || 'Task slot',
      flexibility,
      color: selectedType?.color || '#3B82F6'
    };

    saveDefaultSlots([...defaultDaySlots, newSlot]);
    setLabel('');
    setMessage(`Added ${selectedDay} slot: ${newSlot.startTime}-${newSlot.endTime}.`);
  }

  function handleDeleteSlot(slotId) {
    const nextSlots = defaultDaySlots.filter((slot) => slot.id !== slotId);
    saveDefaultSlots(nextSlots);
    setMessage('Removed default slot.');
  }

  function applyDefaultsToUpcomingDays(daysAhead = 21) {
    if (defaultDaySlots.length === 0) {
      setMessage('Add at least one default day slot first.');
      return;
    }

    const blocks = buildUpcomingBlocks(defaultDaySlots, daysAhead);
    dispatch({
      type: ACTION_TYPES.APPLY_SCHEDULE,
      payload: {
        blocks,
        options: { mergeWithExisting: true }
      }
    });
    setMessage(`Applied ${blocks.length} slots to the next ${daysAhead} days.`);
  }

  function clearUpcomingGeneratedSlots(daysAhead = 21) {
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset += 1) {
      const date = format(addDays(new Date(), dayOffset), 'yyyy-MM-dd');
      dispatch({
        type: ACTION_TYPES.CLEAR_SLOTS_FOR_DATE,
        payload: {
          date,
          sourceScheduleId: DEFAULT_SOURCE_ID
        }
      });
    }
    setMessage(`Cleared generated default slots for the next ${daysAhead} days.`);
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Default Schedule by Day</h2>
        <p>
          Step 1: define weekly defaults. Step 2: add typed slots.
          Step 3: tasks auto-route to the next matching slot.
        </p>
      </header>

      <section className={styles.section}>
        <div className={styles.controls}>
          <label>
            Day
            <select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>
              {DAY_NAMES.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form className={styles.form} onSubmit={handleAddSlot}>
          <label>
            Start
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label>
            End
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>
          <label>
            Type
            <select value={slotType} onChange={(event) => setSlotType(event.target.value)}>
              {taskTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.icon} {type.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input
              type="text"
              placeholder="Optional label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label>
            Rule
            <select
              value={flexibility}
              onChange={(event) => setFlexibility(event.target.value)}
            >
              <option value="fixed">Fixed (type only)</option>
              <option value="preferred">Preferred</option>
              <option value="flexible">Flexible</option>
            </select>
          </label>
          <button type="submit">Add Default Slot</button>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>{selectedDay} defaults</h3>
          <span>{slotsForSelectedDay.length} slot(s)</span>
        </div>
        <div className={styles.slotList}>
          {slotsForSelectedDay.length === 0 && (
            <p className={styles.empty}>No defaults for this day yet.</p>
          )}
          {slotsForSelectedDay.map((slot) => (
            <div key={slot.id} className={styles.slotRow}>
              <div>
                <strong>{slot.startTime} - {slot.endTime}</strong>
                <span>{slot.label}</span>
              </div>
              <div className={styles.slotMeta}>
                <span>{slot.slotType}</span>
                <button type="button" onClick={() => handleDeleteSlot(slot.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.applyActions}>
          <button type="button" onClick={() => applyDefaultsToUpcomingDays(21)}>
            Generate Next 21 Days on Calendar
          </button>
          <button type="button" className={styles.secondary} onClick={() => clearUpcomingGeneratedSlots(21)}>
            Clear Generated Defaults
          </button>
        </div>
        <p className={styles.helper}>
          Generated upcoming slots: {activeGeneratedSlots.length}
        </p>
      </section>

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}

export default DefaultSchedulePlanner;
