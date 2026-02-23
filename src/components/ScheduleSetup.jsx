import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ACTION_TYPES, useAppReducer, useAppState } from '../AppContext.jsx';
import {
  FAMOUS_SCHEDULES,
  getSchedulesFromLocalStorage,
  setActiveSchedule as setActiveScheduleStorage,
  getActiveSchedule,
  ACTIVITY_TYPES,
  saveScheduleToLocalStorage,
  createScheduleTemplate,
} from '../utils/scheduleTemplates.js';
import {
  ENHANCED_FAMOUS_SCHEDULES,
  applyTemplateToDateRange,
} from '../utils/enhancedTemplates.js';
import { useAppContext } from '../context/AppContext.jsx';
import { getLikes, toggleLike } from '../utils/community.js';
import { buildTemplateApplicationSummary } from '../utils/templateApplicationSummary.js';
import CircularSchedule from './CircularSchedule.jsx';
import ClockFaceInput from './ClockFaceInput.jsx';
import styles from './ScheduleSetup.module.css';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_SOURCE_ID = 'default-day-slots';
const FALLBACK_RANGE = { start: 6 * 60, end: 23 * 60 };
const MIN_SLOT_MINUTES = 15;
const SNAP_MINUTES = 15;

function createTemplateId() {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseTimeToMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hour = Math.floor(clamped / 60).toString().padStart(2, '0');
  const minute = (clamped % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

function minutesToDisplay(minutes) {
  const totalMinutes = Math.round(minutes);
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const h12 = h24 % 12 || 12;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes) {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function sortByStart(slots = []) {
  return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function getDefaultMetadata() {
  return {
    slotType: null,
    label: 'Time slot',
    flexibility: 'fixed',
    color: '#3B82F6',
    allowedTags: [],
  };
}

function normalizeTemplateSlot(slot, day, taskTypes) {
  const defaultMeta = getDefaultMetadata();
  const startMinutes = parseTimeToMinutes(slot.startTime);
  const endMinutes = parseTimeToMinutes(slot.endTime);
  return {
    id: slot.id || createTemplateId(),
    day,
    startTime: minutesToTime(startMinutes ?? FALLBACK_RANGE.start),
    endTime: minutesToTime(endMinutes ?? FALLBACK_RANGE.end),
    slotType: slot.slotType || null,
    label: slot.label || defaultMeta.label,
    flexibility: slot.flexibility || 'fixed',
    color: slot.color || defaultMeta.color,
    allowedTags: Array.isArray(slot.allowedTags) ? Array.from(new Set(slot.allowedTags)) : [],
  };
}

function cleanBoundaries(boundaries = [], start, end) {
  const sorted = Array.from(new Set(boundaries))
    .filter((value) => value >= start && value <= end)
    .sort((a, b) => a - b);
  if (sorted[0] !== start) sorted.unshift(start);
  if (sorted[sorted.length - 1] !== end) sorted.push(end);
  const cleaned = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = cleaned[cleaned.length - 1];
    const candidate = Math.max(sorted[index], previous + (index === sorted.length - 1 ? 0 : MIN_SLOT_MINUTES));
    cleaned.push(candidate);
  }
  cleaned[cleaned.length - 1] = end;
  return cleaned;
}

function buildSlotsFromBoundaries({ boundaries, sourceSlots, day, taskTypes }) {
  const normalizedSource = sortByStart(sourceSlots);
  const result = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end - start < MIN_SLOT_MINUTES) continue;
    const exact = normalizedSource.find(
      (slot) => parseTimeToMinutes(slot.startTime) === start && parseTimeToMinutes(slot.endTime) === end
    );
    const inherited =
      exact ||
      normalizedSource.find((slot) => {
        const slotStart = parseTimeToMinutes(slot.startTime);
        const slotEnd = parseTimeToMinutes(slot.endTime);
        return slotStart !== null && slotEnd !== null && slotStart <= start && slotEnd >= end;
      });
    const defaults = getDefaultMetadata();
    const colorFromType = inherited?.slotType ? taskTypes.find((type) => type.id === inherited.slotType)?.color : null;
    result.push({
      id: exact?.id || createTemplateId(),
      day,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      slotType: inherited?.slotType || defaults.slotType,
      label: inherited?.label || defaults.label,
      flexibility: inherited?.flexibility || 'fixed',
      color: inherited?.color || colorFromType || defaults.color,
      allowedTags: Array.isArray(inherited?.allowedTags) ? Array.from(new Set(inherited.allowedTags)) : [],
    });
  }
  return sortByStart(result);
}

function sanitizeSlotsForDay(rawSlots, day, range, taskTypes) {
  const prepared = sortByStart(
    (rawSlots || [])
      .map((slot) => normalizeTemplateSlot(slot, day, taskTypes))
      .filter((slot) => {
        const start = parseTimeToMinutes(slot.startTime);
        const end = parseTimeToMinutes(slot.endTime);
        return start !== null && end !== null && start < end;
      })
  );
  if (prepared.length === 0) {
    const defaults = getDefaultMetadata();
    return [
      {
        id: createTemplateId(),
        day,
        startTime: minutesToTime(range.start),
        endTime: minutesToTime(range.end),
        slotType: defaults.slotType,
        label: defaults.label,
        flexibility: 'fixed',
        color: defaults.color,
        allowedTags: [],
      },
    ];
  }
  const rawBoundaries = [range.start, range.end];
  prepared.forEach((slot) => {
    const start = parseTimeToMinutes(slot.startTime);
    const end = parseTimeToMinutes(slot.endTime);
    if (start === null || end === null) return;
    if (start > range.start + MIN_SLOT_MINUTES) rawBoundaries.push(start);
    if (end < range.end - MIN_SLOT_MINUTES) rawBoundaries.push(end);
  });
  const boundaries = cleanBoundaries(rawBoundaries, range.start, range.end);
  return buildSlotsFromBoundaries({ boundaries, sourceSlots: prepared, day, taskTypes });
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
          allowedTags: Array.isArray(slot.allowedTags) ? slot.allowedTags : [],
          sourceScheduleId: DEFAULT_SOURCE_ID,
          sourceBlockId: slot.id,
        });
      });
  }
  return blocks;
}

function resolvePreferredRange(settings = {}, taskTypes = []) {
  const directStart = parseTimeToMinutes(settings.dayStartTime || settings.wakeTime || settings.preferredWakeTime);
  const directEnd = parseTimeToMinutes(settings.dayEndTime || settings.sleepTime || settings.preferredSleepTime);
  if (directStart !== null && directEnd !== null && directStart < directEnd) {
    return { start: directStart, end: directEnd };
  }
  return FALLBACK_RANGE;
}

function timeToMinutesSimple(timeString) {
  if (!timeString || !timeString.includes(':')) return 0;
  const [h, m] = timeString.split(':').map(Number);
  return h * 60 + m;
}

function getScheduleSnapshot(schedule) {
  const blocks = schedule?.timeBlocks || [];
  if (blocks.length === 0) return { blockCount: 0, firstStart: '--:--', categoryCount: 0 };
  const sortedByStart = [...blocks].sort((a, b) => timeToMinutesSimple(a.start) - timeToMinutesSimple(b.start));
  const categories = new Set(blocks.map((block) => block.type || block.category || 'custom'));
  return { blockCount: blocks.length, firstStart: sortedByStart[0]?.start || '--:--', categoryCount: categories.size };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ScheduleSetup({ onNavigateToTasks, onNavigateToCalendar }) {
  const [state, dispatch] = useAppContext();
  const { taskTypes = [], tags = [], settings = {}, slots = [] } = useAppState();
  const appDispatch = useAppReducer();

  // Sub-navigation
  const [activeTab, setActiveTab] = useState('builder');

  // Day Builder state
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [message, setMessage] = useState('');
  const [editableSlots, setEditableSlots] = useState([]);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dragValue, setDragValue] = useState(null);

  const timelineRef = useRef(null);
  const dragValueRef = useRef(null);

  // Templates state
  const [schedules, setSchedules] = useState([]);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [scheduleToCustomize, setScheduleToCustomize] = useState(null);
  const [notification, setNotification] = useState(null);
  const [quickApplyStartDate, setQuickApplyStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [quickApplyDays, setQuickApplyDays] = useState(7);
  const [applyDateRange, setApplyDateRange] = useState(null);

  const defaultDaySlots = Array.isArray(settings.defaultDaySlots) ? settings.defaultDaySlots : [];
  const todayString = format(new Date(), 'yyyy-MM-dd');
  const preferredRange = useMemo(() => resolvePreferredRange(settings, taskTypes), [settings, taskTypes]);
  const rangeDuration = preferredRange.end - preferredRange.start;

  const slotsForSelectedDay = useMemo(() => {
    return sortByStart(defaultDaySlots.filter((slot) => slot.day === selectedDay));
  }, [defaultDaySlots, selectedDay]);

  const daySlotsCount = useMemo(() => {
    const counts = {};
    DAY_NAMES.forEach((day) => {
      counts[day] = defaultDaySlots.filter((slot) => slot.day === day).length;
    });
    return counts;
  }, [defaultDaySlots]);

  useEffect(() => {
    setEditableSlots(sanitizeSlotsForDay(slotsForSelectedDay, selectedDay, preferredRange, taskTypes));
    setActiveSlotId(null);
  }, [slotsForSelectedDay, selectedDay, preferredRange, taskTypes]);

  const sortedEditableSlots = useMemo(() => sortByStart(editableSlots), [editableSlots]);
  const boundaryMinutes = useMemo(() => {
    if (sortedEditableSlots.length === 0) return [preferredRange.start, preferredRange.end];
    return [preferredRange.start, ...sortedEditableSlots.map((slot) => parseTimeToMinutes(slot.endTime))];
  }, [sortedEditableSlots, preferredRange.start, preferredRange.end]);

  const displayBoundaries = useMemo(() => {
    if (!dragState || dragValue === null) return boundaryMinutes;
    const next = [...dragState.boundaries];
    next[dragState.index] = dragValue;
    return cleanBoundaries(next, preferredRange.start, preferredRange.end);
  }, [dragState, dragValue, boundaryMinutes, preferredRange.start, preferredRange.end]);

  const displaySlots = useMemo(() => {
    return buildSlotsFromBoundaries({
      boundaries: displayBoundaries,
      sourceSlots: sortedEditableSlots,
      day: selectedDay,
      taskTypes,
    });
  }, [displayBoundaries, sortedEditableSlots, selectedDay, taskTypes]);

  const activeSlot = useMemo(() => {
    return sortedEditableSlots.find((slot) => slot.id === activeSlotId) || null;
  }, [sortedEditableSlots, activeSlotId]);

  const hourMarkers = useMemo(() => {
    const markers = [];
    const firstHour = Math.ceil(preferredRange.start / 60);
    const lastHour = Math.floor(preferredRange.end / 60);
    for (let hour = firstHour; hour <= lastHour; hour += 1) {
      const minute = hour * 60;
      const top = ((minute - preferredRange.start) / rangeDuration) * 100;
      markers.push({ minute, top, label: minutesToDisplay(minute) });
    }
    return markers;
  }, [preferredRange.start, preferredRange.end, rangeDuration]);

  // Notification helper
  const showNotification = useCallback((msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Load templates
  useEffect(() => {
    const customSchedules = getSchedulesFromLocalStorage();
    const allSchedules = [...FAMOUS_SCHEDULES, ...ENHANCED_FAMOUS_SCHEDULES, ...customSchedules];
    setSchedules(allSchedules);
    const contextActiveId = state.activeScheduleId;
    const active = contextActiveId ? allSchedules.find((s) => s.id === contextActiveId) : getActiveSchedule();
    if (active) setActiveScheduleId(active.id);
  }, [state.activeScheduleId]);

  const quickApplyEndDate = useMemo(() => {
    const baseDate = new Date(quickApplyStartDate);
    if (Number.isNaN(baseDate.getTime())) return quickApplyStartDate;
    return format(addDays(baseDate, quickApplyDays - 1), 'yyyy-MM-dd');
  }, [quickApplyStartDate, quickApplyDays]);

  // ========== DAY BUILDER FUNCTIONS ==========

  const saveSelectedDaySlots = useCallback(
    (nextSlots, nextMessage = '') => {
      const normalized = sanitizeSlotsForDay(nextSlots, selectedDay, preferredRange, taskTypes);
      const otherDays = defaultDaySlots.filter((slot) => slot.day !== selectedDay);
      appDispatch({
        type: ACTION_TYPES.UPDATE_SETTINGS,
        payload: { defaultDaySlots: [...otherDays, ...normalized] },
      });
      setEditableSlots(normalized);
      if (nextMessage) setMessage(nextMessage);
    },
    [appDispatch, defaultDaySlots, selectedDay, preferredRange, taskTypes]
  );

  const applyPresetBoundaries = useCallback(
    (rawBoundaries, nextMessage) => {
      const boundaries = cleanBoundaries(rawBoundaries, preferredRange.start, preferredRange.end);
      const nextSlots = buildSlotsFromBoundaries({
        boundaries,
        sourceSlots: sortedEditableSlots,
        day: selectedDay,
        taskTypes,
      });
      saveSelectedDaySlots(nextSlots, nextMessage);
    },
    [preferredRange, sortedEditableSlots, selectedDay, taskTypes, saveSelectedDaySlots]
  );

  function splitEqual(parts) {
    const boundaries = [preferredRange.start];
    for (let index = 1; index < parts; index += 1) {
      const remaining = parts - index;
      const raw = preferredRange.start + ((preferredRange.end - preferredRange.start) * index) / parts;
      const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
      const minAllowed = boundaries[index - 1] + MIN_SLOT_MINUTES;
      const maxAllowed = preferredRange.end - remaining * MIN_SLOT_MINUTES;
      boundaries.push(Math.max(minAllowed, Math.min(maxAllowed, snapped)));
    }
    boundaries.push(preferredRange.end);
    applyPresetBoundaries(boundaries, `Split ${selectedDay} into ${parts} parts.`);
  }

  function splitMorningAfternoonEvening() {
    const candidates = [12 * 60, 17 * 60]
      .map((minute) => Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES)
      .filter(
        (minute) => minute > preferredRange.start + MIN_SLOT_MINUTES && minute < preferredRange.end - MIN_SLOT_MINUTES
      );
    const boundaries = [preferredRange.start, ...candidates, preferredRange.end];
    if (boundaries.length < 4) {
      splitEqual(3);
      return;
    }
    applyPresetBoundaries(boundaries, `Applied Morning / Afternoon / Evening on ${selectedDay}.`);
  }

  function splitEvery(minutes) {
    const boundaries = [preferredRange.start];
    let current = preferredRange.start + minutes;
    while (current < preferredRange.end - MIN_SLOT_MINUTES) {
      boundaries.push(current);
      current += minutes;
    }
    boundaries.push(preferredRange.end);
    applyPresetBoundaries(boundaries, `Split ${selectedDay} into ${minutes}-minute slots.`);
  }

  function computeMinutesFromClientY(clientY) {
    if (!timelineRef.current) return preferredRange.start;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = rect.height === 0 ? 0 : y / rect.height;
    const raw = preferredRange.start + ratio * rangeDuration;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(preferredRange.start, Math.min(preferredRange.end, snapped));
  }

  function handleTimelineClick(event) {
    if (dragState) return;
    const minute = computeMinutesFromClientY(event.clientY);
    const isNearExisting = boundaryMinutes.some((point) => Math.abs(point - minute) < MIN_SLOT_MINUTES);
    if (isNearExisting) return;
    if (minute <= preferredRange.start + MIN_SLOT_MINUTES || minute >= preferredRange.end - MIN_SLOT_MINUTES) return;
    const boundaries = [...boundaryMinutes, minute].sort((a, b) => a - b);
    applyPresetBoundaries(boundaries, `Added divider at ${minutesToDisplay(minute)}.`);
  }

  function beginDividerDrag(event, index) {
    event.preventDefault();
    event.stopPropagation();
    if (index <= 0 || index >= boundaryMinutes.length - 1) return;
    setDragState({ index, boundaries: [...boundaryMinutes] });
    dragValueRef.current = boundaryMinutes[index];
    setDragValue(boundaryMinutes[index]);
  }

  useEffect(() => {
    if (!dragState) return undefined;
    function handlePointerMove(event) {
      const previous = dragState.boundaries[dragState.index - 1] + MIN_SLOT_MINUTES;
      const next = dragState.boundaries[dragState.index + 1] - MIN_SLOT_MINUTES;
      const minute = computeMinutesFromClientY(event.clientY);
      const clamped = Math.max(previous, Math.min(next, minute));
      dragValueRef.current = clamped;
      setDragValue(clamped);
    }
    function handlePointerEnd() {
      const value = dragValueRef.current;
      if (value !== null) {
        const nextBoundaries = [...dragState.boundaries];
        nextBoundaries[dragState.index] = value;
        applyPresetBoundaries(nextBoundaries);
      }
      setDragState(null);
      setDragValue(null);
      dragValueRef.current = null;
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [dragState, applyPresetBoundaries]);

  function mergeSlot(slotId) {
    const ordered = sortByStart(sortedEditableSlots);
    const index = ordered.findIndex((slot) => slot.id === slotId);
    if (index === -1 || ordered.length < 2) return;
    const partnerIndex = index < ordered.length - 1 ? index + 1 : index - 1;
    if (partnerIndex < 0) return;
    const firstIndex = Math.min(index, partnerIndex);
    const secondIndex = Math.max(index, partnerIndex);
    const first = ordered[firstIndex];
    const second = ordered[secondIndex];
    const sameType = first.slotType && first.slotType === second.slotType;
    const mergedTags = Array.from(new Set([...(first.allowedTags || []), ...(second.allowedTags || [])]));
    const inferredType = sameType ? first.slotType : first.slotType || second.slotType || null;
    const inferredTaskType = taskTypes.find((type) => type.id === inferredType);
    const mergedSlot = {
      id: createTemplateId(),
      day: selectedDay,
      startTime: first.startTime,
      endTime: second.endTime,
      slotType: inferredType,
      label: sameType ? first.label : inferredTaskType?.name || 'Merged slot',
      flexibility: first.flexibility || second.flexibility || 'fixed',
      color: inferredTaskType?.color || first.color || second.color || '#3B82F6',
      allowedTags: mergedTags,
    };
    const nextSlots = ordered.filter((_, itemIndex) => itemIndex !== firstIndex && itemIndex !== secondIndex);
    nextSlots.push(mergedSlot);
    saveSelectedDaySlots(nextSlots, 'Merged adjacent slots.');
    setActiveSlotId(mergedSlot.id);
  }

  function handleSlotClick(event, slotId) {
    event.stopPropagation();
    setActiveSlotId(slotId);
  }

  function updateSingleSlot(slotId, updater) {
    const nextSlots = sortedEditableSlots.map((slot) => (slot.id === slotId ? updater(slot) : slot));
    saveSelectedDaySlots(nextSlots);
  }

  function applyTypeToSlot(slotId, typeId) {
    const type = taskTypes.find((item) => item.id === typeId) || null;
    updateSingleSlot(slotId, (slot) => ({
      ...slot,
      slotType: type?.id || null,
      label: type?.name || slot.label || 'Time slot',
      color: type?.color || slot.color || '#3B82F6',
    }));
  }

  function toggleSingleSlotTag(slotId, tagId) {
    updateSingleSlot(slotId, (slot) => {
      const current = new Set(slot.allowedTags || []);
      if (current.has(tagId)) current.delete(tagId);
      else current.add(tagId);
      return { ...slot, allowedTags: Array.from(current) };
    });
  }

  function resetDayToSingleSlot() {
    const defaults = getDefaultMetadata();
    saveSelectedDaySlots(
      [
        {
          id: createTemplateId(),
          day: selectedDay,
          startTime: minutesToTime(preferredRange.start),
          endTime: minutesToTime(preferredRange.end),
          slotType: defaults.slotType,
          label: defaults.label,
          flexibility: 'fixed',
          color: defaults.color,
          allowedTags: [],
        },
      ],
      `Reset ${selectedDay} to a single slot.`
    );
  }

  function applyDefaultsToUpcomingDays(daysAhead = 21) {
    if (defaultDaySlots.length === 0) {
      setMessage('Create at least one daily slot first.');
      return;
    }
    const blocks = buildUpcomingBlocks(defaultDaySlots, daysAhead);
    appDispatch({
      type: ACTION_TYPES.APPLY_SCHEDULE,
      payload: { blocks, options: { mergeWithExisting: true } },
    });
    setMessage(`Applied ${blocks.length} slots to the next ${daysAhead} days.`);
  }

  function deleteSlot(slotId) {
    if (sortedEditableSlots.length <= 1) {
      setMessage('Cannot delete the last slot. Use "Reset day" instead.');
      return;
    }
    const nextSlots = sortedEditableSlots.filter((slot) => slot.id !== slotId);
    saveSelectedDaySlots(nextSlots, 'Deleted slot.');
    if (activeSlotId === slotId) setActiveSlotId(null);
  }

  function copyDayTo(targetDay) {
    if (targetDay === selectedDay) return;
    const sourceSlots = sortedEditableSlots.map((slot) => ({
      ...slot,
      id: createTemplateId(),
      day: targetDay,
    }));
    const otherDays = defaultDaySlots.filter((slot) => slot.day !== targetDay);
    appDispatch({
      type: ACTION_TYPES.UPDATE_SETTINGS,
      payload: { defaultDaySlots: [...otherDays, ...sourceSlots] },
    });
    setMessage(`Copied ${selectedDay}'s slots to ${targetDay}.`);
  }

  function updateActiveSlotField(field, value) {
    if (!activeSlotId) return;
    updateSingleSlot(activeSlotId, (slot) => ({ ...slot, [field]: value }));
  }

  function handleClockTimeChange({ start, end }) {
    if (!activeSlotId) return;
    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);
    if (startMin === null || endMin === null || endMin <= startMin || endMin - startMin < MIN_SLOT_MINUTES) return;
    updateSingleSlot(activeSlotId, (slot) => ({ ...slot, startTime: start, endTime: end }));
  }

  // ========== TEMPLATE FUNCTIONS ==========

  function handleActivateSchedule(scheduleId, options = {}) {
    const { successMessage = null, silent = false } = typeof options === 'string' ? { successMessage: options } : options;
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) {
      if (!silent) showNotification('Could not find that schedule template.', 'warning');
      return;
    }
    setActiveScheduleStorage(scheduleId);
    dispatch({ type: ACTION_TYPES.SET_ACTIVE_SCHEDULE, payload: { schedule, scheduleId } });
    setActiveScheduleId(scheduleId);
    if (!silent) showNotification(successMessage || `"${schedule.name}" is now your active schedule!`);
  }

  function handleApplyToCalendar(schedule, startDate, endDate, options = {}) {
    const { source = 'schedule-library', activate = true } = options;
    if (!schedule || !startDate || !endDate) return;
    const blocks = applyTemplateToDateRange(schedule, startDate, endDate);
    if (blocks.length > 0) {
      dispatch({
        type: ACTION_TYPES.APPLY_SCHEDULE,
        payload: { blocks, options: { mergeWithExisting: true } },
      });
      if (activate) handleActivateSchedule(schedule.id, { silent: true });
      const applicationSummary = buildTemplateApplicationSummary({ schedule, blocks, startDate, endDate, source });
      dispatch({ type: ACTION_TYPES.UPDATE_SETTINGS, payload: { lastTemplateApplication: applicationSummary } });
      showNotification(`Applied ${blocks.length} slots from "${schedule.name}".`);
      setApplyDateRange(null);
    } else {
      showNotification('No blocks to apply for the selected date range', 'warning');
    }
  }

  function handleQuickApply(schedule) {
    const startDate = quickApplyStartDate || format(new Date(), 'yyyy-MM-dd');
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      showNotification('Pick a valid start date.', 'warning');
      return;
    }
    const endDate = format(addDays(start, quickApplyDays - 1), 'yyyy-MM-dd');
    handleApplyToCalendar(schedule, startDate, endDate, { source: 'quick-apply', activate: true });
  }

  function handleApplyAsDefaults(schedule) {
    const blocks = schedule.timeBlocks || [];
    if (blocks.length === 0) {
      showNotification('This schedule has no time blocks to import.', 'warning');
      return;
    }
    const daySlots = blocks.map((block, index) => ({
      id: `imported_${schedule.id}_${index}_${Date.now()}`,
      day: 'Monday',
      startTime: block.start || '09:00',
      endTime: block.end || '10:00',
      slotType: block.type || block.category || null,
      label: block.label || block.name || `${block.type || 'Block'} slot`,
      flexibility: 'preferred',
      color: block.color || '#3B82F6',
      allowedTags: [],
    }));
    const allDaySlots = [];
    DAY_NAMES.forEach((day) => {
      daySlots.forEach((slot) => {
        allDaySlots.push({ ...slot, id: `${slot.id}_${day}`, day });
      });
    });
    appDispatch({ type: ACTION_TYPES.UPDATE_SETTINGS, payload: { defaultDaySlots: allDaySlots } });
    handleActivateSchedule(schedule.id, { silent: true });
    showNotification(`Imported ${blocks.length} blocks from "${schedule.name}" as daily defaults. Switch to Day Builder to customize.`);
    setActiveTab('builder');
  }

  const filteredSchedules = schedules
    .filter((schedule) => {
      const normalizedSearchTerm = searchTerm.trim().replace(/^#/, '').toLowerCase();
      if (normalizedSearchTerm) {
        const searchableText = [schedule.name, schedule.description, schedule.author, ...(schedule.tags || [])].join(' ').toLowerCase();
        if (!searchableText.includes(normalizedSearchTerm)) return false;
      }
      if (filter === 'famous' && schedule.isCustom) return false;
      if (filter === 'custom' && !schedule.isCustom) return false;
      return true;
    })
    .map((s) => ({ ...s, _likes: getLikes(s.id) }));

  // Clock time blocks for visualization
  const clockBlocks = useMemo(() => {
    return sortedEditableSlots.map((slot) => ({
      start: slot.startTime,
      end: slot.endTime,
      color: slot.color || '#3B82F6',
      label: slot.label,
    }));
  }, [sortedEditableSlots]);

  // ========== RENDER ==========

  return (
    <div className={styles.container}>
      {notification && (
        <div className={`${styles.notification} ${styles[notification.type] || ''}`}>
          {notification.message}
        </div>
      )}

      <header className={styles.header}>
        <div>
          <h1>Schedule</h1>
          <p>Build your ideal day, then apply templates to your calendar.</p>
        </div>
        <div className={styles.headerActions}>
          {onNavigateToTasks && (
            <button type="button" className={styles.navBtn} onClick={onNavigateToTasks}>
              Tasks
            </button>
          )}
          {onNavigateToCalendar && (
            <button type="button" className={styles.navBtn} onClick={onNavigateToCalendar}>
              Calendar
            </button>
          )}
        </div>
      </header>

      <nav className={styles.subNav}>
        <button
          type="button"
          className={`${styles.subNavBtn} ${activeTab === 'builder' ? styles.subNavActive : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          Day Builder
        </button>
        <button
          type="button"
          className={`${styles.subNavBtn} ${activeTab === 'templates' ? styles.subNavActive : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
      </nav>

      {/* =============== DAY BUILDER TAB =============== */}
      {activeTab === 'builder' && (
        <div className={styles.builderContent}>
          <section className={styles.dayPillRow}>
            {DAY_NAMES.map((day) => {
              const count = daySlotsCount[day] || 0;
              return (
                <button
                  key={day}
                  type="button"
                  className={`${styles.dayPill} ${selectedDay === day ? styles.dayPillActive : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <span className={styles.dayPillLabel}>{day.slice(0, 3)}</span>
                  {count > 0 && <span className={styles.dayPillBadge}>{count}</span>}
                </button>
              );
            })}
          </section>

          <div className={styles.builderGrid}>
            {/* Left: Clock + quick presets */}
            <div className={styles.builderLeft}>
              <div className={styles.clockSection}>
                <ClockFaceInput
                  startTime={activeSlot?.startTime || minutesToTime(preferredRange.start)}
                  endTime={activeSlot?.endTime || minutesToTime(preferredRange.end)}
                  onChange={handleClockTimeChange}
                  timeBlocks={clockBlocks}
                  showNow={true}
                  size={280}
                />
              </div>

              <div className={styles.presets}>
                <span className={styles.presetLabel}>Quick split</span>
                <div className={styles.presetBtns}>
                  <button type="button" onClick={() => splitEqual(2)}>2</button>
                  <button type="button" onClick={() => splitEqual(3)}>3</button>
                  <button type="button" onClick={() => splitEqual(4)}>4</button>
                  <button type="button" onClick={() => splitEqual(6)}>6</button>
                  <button type="button" onClick={splitMorningAfternoonEvening}>AM/PM/Eve</button>
                </div>
                <span className={styles.presetLabel}>Interval</span>
                <div className={styles.presetBtns}>
                  <button type="button" onClick={() => splitEvery(30)}>30m</button>
                  <button type="button" onClick={() => splitEvery(60)}>1h</button>
                  <button type="button" onClick={() => splitEvery(90)}>90m</button>
                </div>
              </div>

              <div className={styles.builderActions}>
                <button type="button" className={styles.resetBtn} onClick={resetDayToSingleSlot}>
                  Reset day
                </button>
                <select
                  className={styles.copySelect}
                  value=""
                  onChange={(e) => { if (e.target.value) copyDayTo(e.target.value); }}
                >
                  <option value="">Copy to...</option>
                  {DAY_NAMES.filter((d) => d !== selectedDay).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Center: Timeline */}
            <div className={styles.builderCenter}>
              <div className={styles.timeline} ref={timelineRef} onClick={handleTimelineClick}>
                <div className={styles.timelineBg} />
                {hourMarkers.map((marker) => (
                  <div key={marker.minute} className={styles.hourMarker} style={{ top: `${marker.top}%` }}>
                    <span>{marker.label}</span>
                  </div>
                ))}

                {displaySlots.map((slot) => {
                  const start = parseTimeToMinutes(slot.startTime) || preferredRange.start;
                  const end = parseTimeToMinutes(slot.endTime) || preferredRange.end;
                  const top = ((start - preferredRange.start) / rangeDuration) * 100;
                  const height = ((end - start) / rangeDuration) * 100;
                  const isActive = activeSlot?.id === slot.id;
                  const slotType = taskTypes.find((type) => type.id === slot.slotType);

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`${styles.slotBlock} ${isActive ? styles.slotActive : ''}`}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        borderColor: slot.color || '#3B82F6',
                        background: `${slot.color || '#3B82F6'}24`,
                      }}
                      onClick={(event) => handleSlotClick(event, slot.id)}
                      onDoubleClick={(event) => { event.stopPropagation(); mergeSlot(slot.id); }}
                    >
                      <span className={styles.slotHeader}>
                        <span className={styles.slotLabel}>
                          {slotType?.icon ? `${slotType.icon} ` : ''}{slot.label || 'Time slot'}
                        </span>
                        <span className={styles.slotDuration}>{formatDuration(end - start)}</span>
                      </span>
                      <span className={styles.slotTime}>
                        {minutesToDisplay(start)} - {minutesToDisplay(end)}
                      </span>
                    </button>
                  );
                })}

                {displayBoundaries.slice(1, -1).map((minute, index) => {
                  const boundaryIndex = index + 1;
                  const top = ((minute - preferredRange.start) / rangeDuration) * 100;
                  const isDragging = dragState?.index === boundaryIndex;
                  return (
                    <button
                      key={`divider-${boundaryIndex}`}
                      type="button"
                      className={`${styles.dividerHandle} ${isDragging ? styles.dividerDragging : ''}`}
                      style={{ top: `${top}%` }}
                      onPointerDown={(event) => beginDividerDrag(event, boundaryIndex)}
                      aria-label={`Resize divider ${boundaryIndex}`}
                    >
                      <span />
                    </button>
                  );
                })}

                {dragState && dragValue !== null && (
                  <div className={styles.dragPreview} style={{ top: `${((dragValue - preferredRange.start) / rangeDuration) * 100}%` }}>
                    {minutesToDisplay(dragValue)}
                  </div>
                )}
              </div>

              <p className={styles.timelineHint}>Tap to add divider. Drag handles to resize. Double-tap to merge.</p>
            </div>

            {/* Right: Slot config */}
            <div className={styles.builderRight}>
              {!activeSlot && (
                <div className={styles.emptyPanel}>
                  <h3>Select a slot</h3>
                  <p>Tap a time slot on the timeline to configure it.</p>
                </div>
              )}

              {activeSlot && (
                <div className={styles.configPanel}>
                  <div className={styles.configHeader}>
                    <h3>Configure</h3>
                    <button type="button" className={styles.deleteBtn} onClick={() => deleteSlot(activeSlot.id)}>
                      Delete
                    </button>
                  </div>
                  <p className={styles.configMeta}>
                    {minutesToDisplay(parseTimeToMinutes(activeSlot.startTime) || 0)} -{' '}
                    {minutesToDisplay(parseTimeToMinutes(activeSlot.endTime) || 0)} &bull;{' '}
                    {formatDuration(
                      (parseTimeToMinutes(activeSlot.endTime) || preferredRange.end) -
                        (parseTimeToMinutes(activeSlot.startTime) || preferredRange.start)
                    )}
                  </p>

                  <div className={styles.configField}>
                    <label>Label</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={activeSlot.label || ''}
                      onChange={(e) => updateActiveSlotField('label', e.target.value)}
                      placeholder="Slot label"
                    />
                  </div>

                  <div className={styles.configField}>
                    <label>Color</label>
                    <div className={styles.colorRow}>
                      <input
                        type="color"
                        className={styles.colorPicker}
                        value={activeSlot.color || '#3B82F6'}
                        onChange={(e) => updateActiveSlotField('color', e.target.value)}
                      />
                      <span className={styles.colorHex}>{activeSlot.color || '#3B82F6'}</span>
                    </div>
                  </div>

                  <div className={styles.configField}>
                    <label>Type</label>
                    <div className={styles.choiceGrid}>
                      <button
                        type="button"
                        className={!activeSlot.slotType ? styles.choiceActive : ''}
                        onClick={() => applyTypeToSlot(activeSlot.id, null)}
                      >
                        Any
                      </button>
                      {taskTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          className={activeSlot.slotType === type.id ? styles.choiceActive : ''}
                          onClick={() => applyTypeToSlot(activeSlot.id, type.id)}
                        >
                          {type.icon} {type.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tags.length > 0 && (
                    <div className={styles.configField}>
                      <label>Tags</label>
                      <div className={styles.tagGrid}>
                        {tags.map((tag) => {
                          const selected = (activeSlot.allowedTags || []).includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              className={`${styles.tagChip} ${selected ? styles.tagChipActive : ''}`}
                              style={{
                                borderColor: selected ? tag.color : undefined,
                                backgroundColor: selected ? `${tag.color}30` : undefined,
                              }}
                              onClick={() => toggleSingleSlotTag(activeSlot.id, tag.id)}
                            >
                              {tag.icon} {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={styles.configField}>
                    <label>Flexibility</label>
                    <div className={styles.flexToggle}>
                      {['fixed', 'preferred', 'flexible'].map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={activeSlot.flexibility === level ? styles.flexActive : ''}
                          onClick={() => updateActiveSlotField('flexibility', level)}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <section className={styles.applySection}>
            <button type="button" className={styles.applyBtn} onClick={() => applyDefaultsToUpcomingDays(21)}>
              Apply to next 21 days
            </button>
            {message && <p className={styles.message}>{message}</p>}
          </section>
        </div>
      )}

      {/* =============== TEMPLATES TAB =============== */}
      {activeTab === 'templates' && (
        <div className={styles.templatesContent}>
          <div className={styles.templateControls}>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.filterBtns}>
              {['all', 'famous', 'custom'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'famous' ? 'Famous' : 'Mine'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.quickApplyBar}>
            <label>
              Start
              <input type="date" value={quickApplyStartDate} onChange={(e) => setQuickApplyStartDate(e.target.value)} />
            </label>
            <label>
              Span
              <select value={quickApplyDays} onChange={(e) => setQuickApplyDays(Number(e.target.value))}>
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
              </select>
            </label>
            <span className={styles.quickApplySummary}>Through {quickApplyEndDate}</span>
          </div>

          <div className={styles.templateGrid}>
            {filteredSchedules.map((schedule) => {
              const isActive = schedule.id === activeScheduleId;
              const snapshot = getScheduleSnapshot(schedule);
              return (
                <div
                  key={schedule.id}
                  className={`${styles.templateCard} ${isActive ? styles.templateCardActive : ''}`}
                  onClick={() => setSelectedSchedule(schedule)}
                >
                  <div className={styles.cardHeader}>
                    <h3>{schedule.name}</h3>
                    {isActive && <span className={styles.activeBadge}>Active</span>}
                  </div>
                  <div className={styles.cardPreview}>
                    <CircularSchedule timeBlocks={schedule.timeBlocks} showLegend={false} showNow={false} title="" />
                  </div>
                  <p className={styles.cardAuthor}>by {schedule.author}</p>
                  <div className={styles.cardStats}>
                    <span>{snapshot.blockCount} blocks</span>
                    <span>Starts {snapshot.firstStart}</span>
                  </div>
                  <div className={styles.cardBtns}>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={(e) => { e.stopPropagation(); handleQuickApply(schedule); }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className={styles.cardBtnAccent}
                      disabled={isActive}
                      onClick={(e) => { e.stopPropagation(); handleActivateSchedule(schedule.id); }}
                    >
                      {isActive ? 'Active' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={(e) => { e.stopPropagation(); handleApplyAsDefaults(schedule); }}
                    >
                      Import
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredSchedules.length === 0 && (
              <div className={styles.emptyTemplates}>No templates match your search.</div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Preview Modal */}
      {selectedSchedule && (
        <div className={styles.modal} onClick={() => setSelectedSchedule(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{selectedSchedule.name}</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedSchedule(null)}>
                &times;
              </button>
            </div>
            <p className={styles.modalAuthor}>by {selectedSchedule.author}</p>
            <p className={styles.modalDesc}>{selectedSchedule.description}</p>

            <div className={styles.modalTimeline}>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <CircularSchedule
                  timeBlocks={selectedSchedule.timeBlocks}
                  showLegend={true}
                  showNow={true}
                  title="24h"
                />
                <div className={styles.modalBlocks}>
                  {selectedSchedule.timeBlocks.map((block) => {
                    const activityType = ACTIVITY_TYPES[(block.type || '').toUpperCase()] || ACTIVITY_TYPES.BUFFER;
                    return (
                      <div
                        key={`${block.start}-${block.end}`}
                        className={styles.modalBlock}
                        style={{ borderLeftColor: activityType.color }}
                      >
                        <span className={styles.modalBlockTime}>
                          {activityType.icon} {block.start} - {block.end}
                        </span>
                        <span>{block.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={styles.modalApply}>
              <h4>Apply to Calendar</h4>
              <div className={styles.modalDateRow}>
                <label>
                  Start
                  <input
                    type="date"
                    value={applyDateRange?.startDate || format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) =>
                      setApplyDateRange((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                        endDate: prev?.endDate || format(addDays(new Date(e.target.value), 6), 'yyyy-MM-dd'),
                      }))
                    }
                  />
                </label>
                <label>
                  End
                  <input
                    type="date"
                    value={applyDateRange?.endDate || format(addDays(new Date(), 6), 'yyyy-MM-dd')}
                    onChange={(e) => setApplyDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className={styles.applyBtn}
                  onClick={() =>
                    handleApplyToCalendar(
                      selectedSchedule,
                      applyDateRange?.startDate || format(new Date(), 'yyyy-MM-dd'),
                      applyDateRange?.endDate || format(addDays(new Date(), 6), 'yyyy-MM-dd'),
                      { source: 'schedule-modal', activate: true }
                    )
                  }
                >
                  Apply
                </button>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.applyBtn}
                disabled={selectedSchedule.id === activeScheduleId}
                onClick={() => handleActivateSchedule(selectedSchedule.id)}
              >
                {selectedSchedule.id === activeScheduleId ? 'Currently Active' : 'Activate'}
              </button>
              <button type="button" className={styles.cardBtn} onClick={() => handleApplyAsDefaults(selectedSchedule)}>
                Import as Day Builder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleSetup;
