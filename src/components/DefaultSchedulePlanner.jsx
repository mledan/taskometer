import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ACTION_TYPES, useAppReducer, useAppState } from '../AppContext.jsx';
import styles from './DefaultSchedulePlanner.module.css';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_SOURCE_ID = 'default-day-slots';
const FALLBACK_RANGE = { start: 6 * 60, end: 23 * 60 }; // 06:00 - 23:00
const MIN_SLOT_MINUTES = 15;
const SNAP_MINUTES = 15;
const ONBOARDING_KEY = 'default-day-splitter-hint-v1';
const SYSTEM_SLEEP_RANGE = { wake: 9 * 60, sleep: 21 * 60 };

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

function resolvePreferredRange(settings = {}, taskTypes = []) {
  const directStart = parseTimeToMinutes(
    settings.dayStartTime || settings.wakeTime || settings.preferredWakeTime
  );
  const directEnd = parseTimeToMinutes(
    settings.dayEndTime || settings.sleepTime || settings.preferredSleepTime
  );
  if (directStart !== null && directEnd !== null && directStart < directEnd) {
    return { start: directStart, end: directEnd };
  }

  const sleepType = taskTypes.find((type) => type.id === 'sleep');
  const wakeFromSleep = parseTimeToMinutes(sleepType?.constraints?.preferredTimeEnd);
  const sleepStart = parseTimeToMinutes(sleepType?.constraints?.preferredTimeStart);
  if (wakeFromSleep !== null && sleepStart !== null && wakeFromSleep < sleepStart) {
    const span = sleepStart - wakeFromSleep;
    const isSystemDefault =
      wakeFromSleep === SYSTEM_SLEEP_RANGE.wake &&
      sleepStart === SYSTEM_SLEEP_RANGE.sleep;
    if (!isSystemDefault && span >= 8 * 60 && span <= 20 * 60) {
      return { start: wakeFromSleep, end: sleepStart };
    }
  }

  return FALLBACK_RANGE;
}

function getDefaultMetadata(taskTypes = []) {
  return {
    slotType: null,
    label: 'Time slot',
    flexibility: 'fixed',
    color: '#3B82F6',
    allowedTags: []
  };
}

function normalizeTemplateSlot(slot, day, taskTypes) {
  const defaultMeta = getDefaultMetadata(taskTypes);
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
    allowedTags: Array.isArray(slot.allowedTags) ? Array.from(new Set(slot.allowedTags)) : []
  };
}

function cleanBoundaries(boundaries = [], start, end) {
  const sorted = Array.from(new Set(boundaries))
    .filter((value) => value >= start && value <= end)
    .sort((a, b) => a - b);

  if (sorted[0] !== start) {
    sorted.unshift(start);
  }
  if (sorted[sorted.length - 1] !== end) {
    sorted.push(end);
  }

  // Enforce minimum duration and monotonic boundaries.
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
    const inherited = exact ||
      normalizedSource.find((slot) => {
        const slotStart = parseTimeToMinutes(slot.startTime);
        const slotEnd = parseTimeToMinutes(slot.endTime);
        return slotStart !== null && slotEnd !== null && slotStart <= start && slotEnd >= end;
      });
    const defaults = getDefaultMetadata(taskTypes);
    const colorFromType = inherited?.slotType
      ? taskTypes.find((type) => type.id === inherited.slotType)?.color
      : null;

    result.push({
      id: exact?.id || createTemplateId(),
      day,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      slotType: inherited?.slotType || defaults.slotType,
      label: inherited?.label || defaults.label,
      flexibility: inherited?.flexibility || 'fixed',
      color: inherited?.color || colorFromType || defaults.color,
      allowedTags: Array.isArray(inherited?.allowedTags) ? Array.from(new Set(inherited.allowedTags)) : []
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
    const defaults = getDefaultMetadata(taskTypes);
    return [{
      id: createTemplateId(),
      day,
      startTime: minutesToTime(range.start),
      endTime: minutesToTime(range.end),
      slotType: defaults.slotType,
      label: defaults.label,
      flexibility: 'fixed',
      color: defaults.color,
      allowedTags: []
    }];
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
  return buildSlotsFromBoundaries({
    boundaries,
    sourceSlots: prepared,
    day,
    taskTypes
  });
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
          sourceBlockId: slot.id
        });
      });
  }

  return blocks;
}

function DefaultSchedulePlanner({ onNavigateToTasks, onNavigateToCalendar }) {
  const dispatch = useAppReducer();
  const { taskTypes = [], tags = [], settings = {}, slots = [] } = useAppState();

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [message, setMessage] = useState('');
  const [editableSlots, setEditableSlots] = useState([]);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [dragValue, setDragValue] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [customSplitCount, setCustomSplitCount] = useState('');
  const [customIntervalMinutes, setCustomIntervalMinutes] = useState('');
  const [addSlotStart, setAddSlotStart] = useState('');
  const [addSlotEnd, setAddSlotEnd] = useState('');
  const [showAddSlotForm, setShowAddSlotForm] = useState(false);
  const [showWeekOverview, setShowWeekOverview] = useState(false);

  const timelineRef = useRef(null);
  const dragValueRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const defaultDaySlots = Array.isArray(settings.defaultDaySlots) ? settings.defaultDaySlots : [];
  const todayString = format(new Date(), 'yyyy-MM-dd');
  const preferredRange = useMemo(() => resolvePreferredRange(settings, taskTypes), [settings, taskTypes]);
  const rangeDuration = preferredRange.end - preferredRange.start;

  const slotsForSelectedDay = useMemo(() => {
    return sortByStart(defaultDaySlots.filter((slot) => slot.day === selectedDay));
  }, [defaultDaySlots, selectedDay]);

  const activeGeneratedSlots = useMemo(() => {
    return slots.filter(
      (slot) => slot.sourceScheduleId === DEFAULT_SOURCE_ID && slot.date >= todayString
    );
  }, [slots, todayString]);

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
    setBulkMode(false);
    setSelectedSlotIds([]);
  }, [slotsForSelectedDay, selectedDay, preferredRange, taskTypes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  const sortedEditableSlots = useMemo(() => sortByStart(editableSlots), [editableSlots]);
  const boundaryMinutes = useMemo(() => {
    if (sortedEditableSlots.length === 0) {
      return [preferredRange.start, preferredRange.end];
    }
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
      taskTypes
    });
  }, [displayBoundaries, sortedEditableSlots, selectedDay, taskTypes]);

  const selectedBulkSlots = useMemo(() => {
    if (selectedSlotIds.length === 0) return [];
    const set = new Set(selectedSlotIds);
    return sortedEditableSlots.filter((slot) => set.has(slot.id));
  }, [sortedEditableSlots, selectedSlotIds]);

  const activeSlot = useMemo(() => {
    return sortedEditableSlots.find((slot) => slot.id === activeSlotId) || null;
  }, [sortedEditableSlots, activeSlotId]);

  const bulkTagState = useMemo(() => {
    if (selectedBulkSlots.length === 0) return {};
    const stateMap = {};
    tags.forEach((tag) => {
      let matches = 0;
      selectedBulkSlots.forEach((slot) => {
        if ((slot.allowedTags || []).includes(tag.id)) {
          matches += 1;
        }
      });
      stateMap[tag.id] = matches === 0
        ? 'none'
        : matches === selectedBulkSlots.length
          ? 'all'
          : 'some';
    });
    return stateMap;
  }, [selectedBulkSlots, tags]);

  const hourMarkers = useMemo(() => {
    const markers = [];
    const firstHour = Math.ceil(preferredRange.start / 60);
    const lastHour = Math.floor(preferredRange.end / 60);
    for (let hour = firstHour; hour <= lastHour; hour += 1) {
      const minute = hour * 60;
      const top = ((minute - preferredRange.start) / rangeDuration) * 100;
      markers.push({
        minute,
        top,
        label: minutesToDisplay(minute)
      });
    }
    return markers;
  }, [preferredRange.start, preferredRange.end, rangeDuration]);

  const saveSelectedDaySlots = useCallback((nextSlots, nextMessage = '') => {
    const normalized = sanitizeSlotsForDay(nextSlots, selectedDay, preferredRange, taskTypes);
    const otherDays = defaultDaySlots.filter((slot) => slot.day !== selectedDay);
    dispatch({
      type: ACTION_TYPES.UPDATE_SETTINGS,
      payload: {
        defaultDaySlots: [...otherDays, ...normalized]
      }
    });
    setEditableSlots(normalized);
    if (nextMessage) {
      setMessage(nextMessage);
    }
  }, [dispatch, defaultDaySlots, selectedDay, preferredRange, taskTypes]);

  const applyPresetBoundaries = useCallback((rawBoundaries, nextMessage) => {
    const boundaries = cleanBoundaries(rawBoundaries, preferredRange.start, preferredRange.end);
    const nextSlots = buildSlotsFromBoundaries({
      boundaries,
      sourceSlots: sortedEditableSlots,
      day: selectedDay,
      taskTypes
    });
    saveSelectedDaySlots(nextSlots, nextMessage);
  }, [preferredRange, sortedEditableSlots, selectedDay, taskTypes, saveSelectedDaySlots]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  function computeMinutesFromClientY(clientY) {
    if (!timelineRef.current) return preferredRange.start;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = rect.height === 0 ? 0 : y / rect.height;
    const raw = preferredRange.start + ratio * rangeDuration;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(preferredRange.start, Math.min(preferredRange.end, snapped));
  }

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
      .filter((minute) =>
        minute > preferredRange.start + MIN_SLOT_MINUTES &&
        minute < preferredRange.end - MIN_SLOT_MINUTES
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

  function handleTimelineClick(event) {
    if (dragState) return;
    const minute = computeMinutesFromClientY(event.clientY);
    const isNearExisting = boundaryMinutes.some((point) => Math.abs(point - minute) < MIN_SLOT_MINUTES);
    if (isNearExisting) return;
    if (minute <= preferredRange.start + MIN_SLOT_MINUTES || minute >= preferredRange.end - MIN_SLOT_MINUTES) {
      return;
    }
    const boundaries = [...boundaryMinutes, minute].sort((a, b) => a - b);
    applyPresetBoundaries(boundaries, `Added divider at ${minutesToDisplay(minute)}.`);
  }

  function beginDividerDrag(event, index) {
    event.preventDefault();
    event.stopPropagation();
    if (index <= 0 || index >= boundaryMinutes.length - 1) return;
    setDragState({
      index,
      boundaries: [...boundaryMinutes]
    });
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
    const inferredType = sameType ? first.slotType : (first.slotType || second.slotType || null);
    const inferredTaskType = taskTypes.find((type) => type.id === inferredType);

    const mergedSlot = {
      id: createTemplateId(),
      day: selectedDay,
      startTime: first.startTime,
      endTime: second.endTime,
      slotType: inferredType,
      label: sameType ? first.label : (inferredTaskType?.name || 'Merged slot'),
      flexibility: first.flexibility || second.flexibility || 'fixed',
      color: inferredTaskType?.color || first.color || second.color || '#3B82F6',
      allowedTags: mergedTags
    };

    const nextSlots = ordered.filter((_, itemIndex) => itemIndex !== firstIndex && itemIndex !== secondIndex);
    nextSlots.push(mergedSlot);
    saveSelectedDaySlots(nextSlots, 'Merged adjacent slots.');
    setActiveSlotId(mergedSlot.id);
  }

  function handleSlotPointerDown(slotId) {
    if (bulkMode) return;
    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      mergeSlot(slotId);
    }, 450);
  }

  function handleSlotPointerUp() {
    clearLongPress();
  }

  function handleSlotClick(event, slotId) {
    event.stopPropagation();

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (bulkMode) {
      setSelectedSlotIds((current) => {
        if (current.includes(slotId)) {
          return current.filter((id) => id !== slotId);
        }
        return [...current, slotId];
      });
      return;
    }

    setActiveSlotId(slotId);
  }

  function toggleBulkMode() {
    if (bulkMode) {
      setBulkMode(false);
      setSelectedSlotIds([]);
      return;
    }
    setBulkMode(true);
    setActiveSlotId(null);
  }

  function updateSingleSlot(slotId, updater) {
    const nextSlots = sortedEditableSlots.map((slot) => (
      slot.id === slotId ? updater(slot) : slot
    ));
    saveSelectedDaySlots(nextSlots);
  }

  function updateBulkSlots(updater) {
    const selectedSet = new Set(selectedSlotIds);
    const nextSlots = sortedEditableSlots.map((slot) => (
      selectedSet.has(slot.id) ? updater(slot) : slot
    ));
    saveSelectedDaySlots(nextSlots);
  }

  function applyTypeToSlot(slotId, typeId) {
    const type = taskTypes.find((item) => item.id === typeId) || null;
    updateSingleSlot(slotId, (slot) => ({
      ...slot,
      slotType: type?.id || null,
      label: type?.name || slot.label || 'Time slot',
      color: type?.color || slot.color || '#3B82F6'
    }));
  }

  function toggleSingleSlotTag(slotId, tagId) {
    updateSingleSlot(slotId, (slot) => {
      const current = new Set(slot.allowedTags || []);
      if (current.has(tagId)) {
        current.delete(tagId);
      } else {
        current.add(tagId);
      }
      return {
        ...slot,
        allowedTags: Array.from(current)
      };
    });
  }

  function applyTypeToBulk(typeId) {
    const type = taskTypes.find((item) => item.id === typeId) || null;
    updateBulkSlots((slot) => ({
      ...slot,
      slotType: type?.id || null,
      label: type?.name || slot.label || 'Time slot',
      color: type?.color || slot.color || '#3B82F6'
    }));
  }

  function toggleBulkTag(tagId) {
    if (selectedBulkSlots.length === 0) return;
    const allHaveTag = selectedBulkSlots.every((slot) => (slot.allowedTags || []).includes(tagId));
    updateBulkSlots((slot) => {
      const current = new Set(slot.allowedTags || []);
      if (allHaveTag) {
        current.delete(tagId);
      } else {
        current.add(tagId);
      }
      return {
        ...slot,
        allowedTags: Array.from(current)
      };
    });
  }

  function resetDayToSingleSlot() {
    const defaults = getDefaultMetadata(taskTypes);
    saveSelectedDaySlots([{
      id: createTemplateId(),
      day: selectedDay,
      startTime: minutesToTime(preferredRange.start),
      endTime: minutesToTime(preferredRange.end),
      slotType: defaults.slotType,
      label: defaults.label,
      flexibility: 'fixed',
      color: defaults.color,
      allowedTags: []
    }], `Reset ${selectedDay} to a single slot.`);
  }

  function applyDefaultsToUpcomingDays(daysAhead = 21) {
    if (defaultDaySlots.length === 0) {
      setMessage('Create at least one daily slot first.');
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

  function handleCustomSplit() {
    const count = parseInt(customSplitCount, 10);
    if (!count || count < 1 || count > 48) return;
    splitEqual(count);
    setCustomSplitCount('');
  }

  function handleCustomInterval() {
    const minutes = parseInt(customIntervalMinutes, 10);
    if (!minutes || minutes < 5 || minutes > 480) return;
    splitEvery(minutes);
    setCustomIntervalMinutes('');
  }

  function handleAddSlotAtTime() {
    const startMin = parseTimeToMinutes(addSlotStart);
    const endMin = parseTimeToMinutes(addSlotEnd);
    if (startMin === null || endMin === null || endMin <= startMin) {
      setMessage('Invalid time range. End must be after start.');
      return;
    }
    if (endMin - startMin < MIN_SLOT_MINUTES) {
      setMessage(`Slot must be at least ${MIN_SLOT_MINUTES} minutes.`);
      return;
    }
    const defaults = getDefaultMetadata(taskTypes);
    const newSlot = {
      id: createTemplateId(),
      day: selectedDay,
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(endMin),
      slotType: defaults.slotType,
      label: defaults.label,
      flexibility: 'fixed',
      color: defaults.color,
      allowedTags: []
    };
    saveSelectedDaySlots([...sortedEditableSlots, newSlot], `Added slot ${minutesToDisplay(startMin)} - ${minutesToDisplay(endMin)}.`);
    setAddSlotStart('');
    setAddSlotEnd('');
    setShowAddSlotForm(false);
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
      day: targetDay
    }));
    const otherDays = defaultDaySlots.filter((slot) => slot.day !== targetDay);
    dispatch({
      type: ACTION_TYPES.UPDATE_SETTINGS,
      payload: {
        defaultDaySlots: [...otherDays, ...sourceSlots]
      }
    });
    setMessage(`Copied ${selectedDay}'s slots to ${targetDay}.`);
  }

  function updateActiveSlotField(field, value) {
    if (!activeSlotId) return;
    updateSingleSlot(activeSlotId, (slot) => ({ ...slot, [field]: value }));
  }

  function updateActiveSlotTime(field, value) {
    if (!activeSlotId) return;
    const minutes = parseTimeToMinutes(value);
    if (minutes === null) return;
    updateSingleSlot(activeSlotId, (slot) => {
      const updated = { ...slot, [field]: value };
      const start = parseTimeToMinutes(updated.startTime);
      const end = parseTimeToMinutes(updated.endTime);
      if (start !== null && end !== null && end > start && end - start >= MIN_SLOT_MINUTES) {
        return updated;
      }
      return slot;
    });
  }

  function dismissOnboarding() {
    setShowOnboarding(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_KEY, '1');
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Daily Slot Builder</h2>
        <p>Split your day visually. Tap to add dividers, drag to resize, double-tap or long-press to merge.</p>
      </header>

      <section className={styles.dayToolbar}>
        <div className={styles.dayPills}>
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
        </div>
        <div className={styles.dayToolbarActions}>
          <div className={styles.rangeBadge}>
            {minutesToDisplay(preferredRange.start)} - {minutesToDisplay(preferredRange.end)}
          </div>
          <button type="button" className={styles.subtleButton} onClick={toggleBulkMode}>
            {bulkMode ? 'Done bulk tagging' : 'Bulk-tag slots'}
          </button>
          <button type="button" className={styles.subtleButton} onClick={resetDayToSingleSlot}>
            Reset day
          </button>
        </div>
      </section>

      <section className={styles.presets}>
        <div className={styles.presetGroup}>
          <span>Split equally</span>
          <button type="button" onClick={() => splitEqual(2)}>2</button>
          <button type="button" onClick={() => splitEqual(3)}>3</button>
          <button type="button" onClick={() => splitEqual(4)}>4</button>
          <button type="button" onClick={() => splitEqual(6)}>6</button>
          <div className={styles.customInput}>
            <input
              type="number"
              min="1"
              max="48"
              placeholder="N"
              value={customSplitCount}
              onChange={(e) => setCustomSplitCount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSplit()}
            />
            <button type="button" onClick={handleCustomSplit} disabled={!customSplitCount}>Go</button>
          </div>
        </div>
        <div className={styles.presetGroup}>
          <span>Natural day</span>
          <button type="button" onClick={splitMorningAfternoonEvening}>Morning / Afternoon / Evening</button>
        </div>
        <div className={styles.presetGroup}>
          <span>Interval</span>
          <button type="button" onClick={() => splitEvery(30)}>30m</button>
          <button type="button" onClick={() => splitEvery(60)}>60m</button>
          <button type="button" onClick={() => splitEvery(90)}>90m</button>
          <div className={styles.customInput}>
            <input
              type="number"
              min="5"
              max="480"
              step="5"
              placeholder="min"
              value={customIntervalMinutes}
              onChange={(e) => setCustomIntervalMinutes(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomInterval()}
            />
            <button type="button" onClick={handleCustomInterval} disabled={!customIntervalMinutes}>Go</button>
          </div>
        </div>
        <div className={styles.presetGroup}>
          <span>Manual</span>
          <button type="button" onClick={() => setShowAddSlotForm((v) => !v)}>
            {showAddSlotForm ? 'Cancel' : '+ Add slot'}
          </button>
        </div>
      </section>

      {showAddSlotForm && (
        <section className={styles.addSlotForm}>
          <label>
            Start
            <input type="time" value={addSlotStart} onChange={(e) => setAddSlotStart(e.target.value)} />
          </label>
          <label>
            End
            <input type="time" value={addSlotEnd} onChange={(e) => setAddSlotEnd(e.target.value)} />
          </label>
          <button type="button" onClick={handleAddSlotAtTime} disabled={!addSlotStart || !addSlotEnd}>
            Add slot
          </button>
        </section>
      )}

      <section className={styles.editorLayout}>
        <div className={styles.timelineWrap}>
          {showOnboarding && (
            <div className={styles.onboarding}>
              <strong>How it works</strong>
              <ul>
                <li>Tap empty timeline to add a divider.</li>
                <li>Drag divider handles for instant resize (live durations).</li>
                <li>Double-tap or long-press a slot to merge with a neighbor.</li>
              </ul>
              <button type="button" onClick={dismissOnboarding}>Got it</button>
            </div>
          )}

          <div className={styles.timeline} ref={timelineRef} onClick={handleTimelineClick}>
            <div className={styles.timelineBackground} />

            {hourMarkers.map((marker) => (
              <div
                key={marker.minute}
                className={styles.hourMarker}
                style={{ top: `${marker.top}%` }}
              >
                <span>{marker.label}</span>
              </div>
            ))}

            {displaySlots.map((slot) => {
              const start = parseTimeToMinutes(slot.startTime) || preferredRange.start;
              const end = parseTimeToMinutes(slot.endTime) || preferredRange.end;
              const top = ((start - preferredRange.start) / rangeDuration) * 100;
              const height = ((end - start) / rangeDuration) * 100;
              const isActive = activeSlot?.id === slot.id;
              const isSelectedBulk = selectedSlotIds.includes(slot.id);
              const slotType = taskTypes.find((type) => type.id === slot.slotType);

              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`${styles.slotBlock}
                    ${isActive ? styles.slotActive : ''}
                    ${isSelectedBulk ? styles.slotSelectedBulk : ''}`}
                  style={{
                    top: `${top}%`,
                    height: `${height}%`,
                    borderColor: slot.color || '#3B82F6',
                    background: `${slot.color || '#3B82F6'}24`
                  }}
                  onClick={(event) => handleSlotClick(event, slot.id)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    mergeSlot(slot.id);
                  }}
                  onPointerDown={() => handleSlotPointerDown(slot.id)}
                  onPointerUp={handleSlotPointerUp}
                  onPointerCancel={handleSlotPointerUp}
                >
                  <span className={styles.slotHeader}>
                    <span className={styles.slotLabel}>
                      {slotType?.icon ? `${slotType.icon} ` : ''}{slot.label || 'Time slot'}
                    </span>
                    <span className={styles.slotDuration}>{formatDuration(end - start)}</span>
                  </span>
                  <span className={styles.slotTimeText}>
                    {minutesToDisplay(start)} - {minutesToDisplay(end)}
                  </span>
                  <span className={styles.slotTagMeta}>
                    {(slot.allowedTags || []).length > 0
                      ? `${slot.allowedTags.length} tag${slot.allowedTags.length > 1 ? 's' : ''}`
                      : 'No tags'}
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
              <div
                className={styles.dragPreview}
                style={{ top: `${((dragValue - preferredRange.start) / rangeDuration) * 100}%` }}
              >
                {minutesToDisplay(dragValue)}
              </div>
            )}
          </div>
        </div>

        <div className={styles.sidePanel}>
          {!bulkMode && !activeSlot && (
            <div className={styles.emptyPanel}>
              <h3>Pick a slot</h3>
              <p>Tap a slot to assign a project/topic type and tags.</p>
            </div>
          )}

          {!bulkMode && activeSlot && (
            <div className={styles.pickerPanel}>
              <div className={styles.pickerHeader}>
                <h3>Slot Configuration</h3>
                <button
                  type="button"
                  className={styles.deleteSlotBtn}
                  onClick={() => deleteSlot(activeSlot.id)}
                  title="Delete this slot"
                >
                  Delete
                </button>
              </div>
              <p className={styles.pickerMeta}>
                {activeSlot.startTime} - {activeSlot.endTime} &bull; {
                  formatDuration(
                    (parseTimeToMinutes(activeSlot.endTime) || preferredRange.end) -
                    (parseTimeToMinutes(activeSlot.startTime) || preferredRange.start)
                  )
                }
              </p>

              <div className={styles.pickerSection}>
                <label>Label</label>
                <input
                  type="text"
                  className={styles.fieldInput}
                  value={activeSlot.label || ''}
                  onChange={(e) => updateActiveSlotField('label', e.target.value)}
                  placeholder="Slot label"
                />
              </div>

              <div className={styles.pickerSection}>
                <label>Time Range</label>
                <div className={styles.timeInputRow}>
                  <input
                    type="time"
                    className={styles.fieldInput}
                    value={activeSlot.startTime}
                    onChange={(e) => updateActiveSlotTime('startTime', e.target.value)}
                  />
                  <span className={styles.timeSeparator}>to</span>
                  <input
                    type="time"
                    className={styles.fieldInput}
                    value={activeSlot.endTime}
                    onChange={(e) => updateActiveSlotTime('endTime', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.pickerSection}>
                <label>Project / Topic</label>
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

              <div className={styles.pickerSection}>
                <label>Tags (multi-select)</label>
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
                          backgroundColor: selected ? `${tag.color}30` : undefined
                        }}
                        onClick={() => toggleSingleSlotTag(activeSlot.id, tag.id)}
                      >
                        {tag.icon} {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {bulkMode && (
            <div className={styles.pickerPanel}>
              <h3>Bulk tagging</h3>
              <p className={styles.pickerMeta}>
                {selectedSlotIds.length === 0
                  ? 'Select slots on the timeline'
                  : `${selectedSlotIds.length} slot${selectedSlotIds.length > 1 ? 's' : ''} selected`}
              </p>

              {selectedSlotIds.length > 0 && (
                <>
                  <div className={styles.pickerSection}>
                    <label>Apply topic to selected</label>
                    <div className={styles.choiceGrid}>
                      <button type="button" onClick={() => applyTypeToBulk(null)}>
                        Any
                      </button>
                      {taskTypes.map((type) => (
                        <button key={type.id} type="button" onClick={() => applyTypeToBulk(type.id)}>
                          {type.icon} {type.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.pickerSection}>
                    <label>Toggle tags for selected</label>
                    <div className={styles.tagGrid}>
                      {tags.map((tag) => {
                        const mode = bulkTagState[tag.id] || 'none';
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            className={`${styles.tagChip}
                              ${mode === 'all' ? styles.tagChipActive : ''}
                              ${mode === 'some' ? styles.tagChipPartial : ''}`}
                            style={{
                              borderColor: mode !== 'none' ? tag.color : undefined,
                              backgroundColor: mode === 'all' ? `${tag.color}30` : mode === 'some' ? `${tag.color}1c` : undefined
                            }}
                            onClick={() => toggleBulkTag(tag.id)}
                          >
                            {tag.icon} {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={styles.summary}>
        <div className={styles.summaryHeader}>
          <h3>{selectedDay} &mdash; {sortedEditableSlots.length} slot{sortedEditableSlots.length !== 1 ? 's' : ''}</h3>
          <div className={styles.summaryActions}>
            <div className={styles.copyDayWrap}>
              <label className={styles.copyDayLabel}>Copy to</label>
              <select
                className={styles.copyDaySelect}
                value=""
                onChange={(e) => { if (e.target.value) copyDayTo(e.target.value); }}
              >
                <option value="">Select day...</option>
                {DAY_NAMES.filter((d) => d !== selectedDay).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={styles.subtleButton}
              onClick={() => setShowWeekOverview((v) => !v)}
            >
              {showWeekOverview ? 'Hide week' : 'Week overview'}
            </button>
          </div>
        </div>
        <div className={styles.summaryList}>
          {sortedEditableSlots.map((slot) => {
            const start = parseTimeToMinutes(slot.startTime) || preferredRange.start;
            const end = parseTimeToMinutes(slot.endTime) || preferredRange.end;
            const slotType = taskTypes.find((t) => t.id === slot.slotType);
            const isActive = activeSlotId === slot.id;
            return (
              <button
                key={`summary-${slot.id}`}
                type="button"
                className={`${styles.summaryItem} ${isActive ? styles.summaryItemActive : ''}`}
                onClick={() => setActiveSlotId(slot.id)}
              >
                <span className={styles.summaryItemColor} style={{ background: slot.color || '#3B82F6' }} />
                <div className={styles.summaryItemInfo}>
                  <span className={styles.summaryItemLabel}>
                    {slotType?.icon ? `${slotType.icon} ` : ''}{slot.label || 'Time slot'}
                  </span>
                  <span className={styles.summaryItemTime}>
                    {minutesToDisplay(start)} - {minutesToDisplay(end)} &bull; {formatDuration(end - start)}
                  </span>
                  {(slot.allowedTags || []).length > 0 && (
                    <span className={styles.summaryItemTags}>
                      {slot.allowedTags.map((tagId) => {
                        const tag = tags.find((t) => t.id === tagId);
                        return tag ? `${tag.icon || ''} ${tag.name}` : tagId;
                      }).join(', ')}
                    </span>
                  )}
                </div>
                <span className={styles.summaryItemFlex}>{slot.flexibility}</span>
              </button>
            );
          })}
        </div>
      </section>

      {showWeekOverview && (
        <section className={styles.weekOverview}>
          <h3>Week at a Glance</h3>
          <div className={styles.weekGrid}>
            {DAY_NAMES.map((day) => {
              const daySlots = sortByStart(defaultDaySlots.filter((s) => s.day === day));
              const isSelected = selectedDay === day;
              return (
                <button
                  key={`week-${day}`}
                  type="button"
                  className={`${styles.weekDay} ${isSelected ? styles.weekDayActive : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <span className={styles.weekDayName}>{day.slice(0, 3)}</span>
                  <div className={styles.weekDayBar}>
                    {daySlots.length === 0 && <div className={styles.weekDayEmpty}>No slots</div>}
                    {daySlots.map((slot) => {
                      const start = parseTimeToMinutes(slot.startTime) || preferredRange.start;
                      const end = parseTimeToMinutes(slot.endTime) || preferredRange.end;
                      const top = ((start - preferredRange.start) / rangeDuration) * 100;
                      const height = Math.max(4, ((end - start) / rangeDuration) * 100);
                      return (
                        <div
                          key={slot.id}
                          className={styles.weekDaySlot}
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            background: slot.color || '#3B82F6'
                          }}
                          title={`${slot.label || 'Slot'}: ${slot.startTime} - ${slot.endTime}`}
                        />
                      );
                    })}
                  </div>
                  <span className={styles.weekDayCount}>
                    {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.applyActions}>
          <button type="button" onClick={() => applyDefaultsToUpcomingDays(21)}>
            Generate next 21 days
          </button>
          <button type="button" className={styles.secondary} onClick={() => clearUpcomingGeneratedSlots(21)}>
            Clear generated defaults
          </button>
        </div>
        <p className={styles.helper}>Generated upcoming slots: {activeGeneratedSlots.length}</p>
      </section>

      {(onNavigateToTasks || onNavigateToCalendar) && (
        <section className={styles.navActions}>
          <span className={styles.navHint}>Continue your setup:</span>
          {onNavigateToTasks && (
            <button type="button" className={styles.navButton} onClick={onNavigateToTasks}>
              Add Tasks &rarr;
            </button>
          )}
          {onNavigateToCalendar && (
            <button type="button" className={`${styles.navButton} ${styles.navButtonSecondary}`} onClick={onNavigateToCalendar}>
              View Calendar &rarr;
            </button>
          )}
        </section>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}

export default DefaultSchedulePlanner;
