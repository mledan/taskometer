import { addDays, format, addMinutes } from 'date-fns';
import { createCalendarSlot, getSlotStartDateTime, getSlotDuration, canAssignTaskToSlot } from '../models/CalendarSlot';

const ADHOC_WORK_START = 9;
const ADHOC_WORK_END = 22;
const DEFAULT_DURATION = 30;
const SNAP_MINUTES = 15;
const MAX_DAYS_AHEAD = 28;

/**
 * Core scheduling entry point.
 *
 * Given a task and the current application state, determines the best time
 * slot for the task across three modes:
 *
 *  1. Slot-based (framework set): matches against CalendarSlot objects
 *  2. Ad-hoc (no framework): synthesises windows from work-hour defaults
 *  3. Overflow: when today is full, pushes to the next available day/week
 *
 * Returns { scheduledTime, slotId, label, date, reason } or null.
 */
export function scheduleTask(task, state) {
  const {
    slots = [],
    tasks = [],
    settings = {},
    taskTypes = [],
  } = state;

  const hasFramework = hasActiveFramework(slots, settings);

  if (hasFramework) {
    return scheduleWithFramework(task, slots, tasks, settings, taskTypes);
  }

  return scheduleWithoutFramework(task, tasks, taskTypes);
}

/**
 * Schedule multiple tasks in priority order.
 */
export function scheduleMultipleTasks(tasksToSchedule, state) {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...tasksToSchedule].sort((a, b) => {
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
  });

  const virtualTasks = [...(state.tasks || [])];
  const results = [];

  for (const task of sorted) {
    const result = scheduleTask(task, { ...state, tasks: virtualTasks });
    if (result) {
      results.push({ task, result });
      virtualTasks.push({
        ...task,
        scheduledTime: result.scheduledTime,
        scheduledSlotId: result.slotId || null,
      });
    } else {
      results.push({ task, result: null });
    }
  }

  return results;
}

/**
 * Preview where a task would land without committing.
 */
export function previewTaskSchedule(task, state) {
  return scheduleTask(task, state);
}

// ---------------------------------------------------------------------------
// Internal: framework detection
// ---------------------------------------------------------------------------

function hasActiveFramework(slots, settings) {
  if (slots && slots.length > 0) return true;

  const defaultDaySlots = settings?.defaultDaySlots;
  if (Array.isArray(defaultDaySlots) && defaultDaySlots.length > 0) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Mode 1: Schedule with framework (slots exist)
// ---------------------------------------------------------------------------

function scheduleWithFramework(task, existingSlots, existingTasks, settings, taskTypes) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const taskType = task.primaryType || task.taskType || 'work';
  const taskTags = task.tags || [];
  const taskDuration = task.duration || DEFAULT_DURATION;

  const allSlots = ensureFutureSlots(existingSlots, settings, MAX_DAYS_AHEAD);

  const candidates = allSlots
    .filter(slot => {
      const slotStart = getSlotStartDateTime(slot);
      if (slotStart <= now) return false;
      if (getSlotDuration(slot) < taskDuration) return false;
      return true;
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

  // Phase 1: exact type+tag match
  const exactMatch = findFirstAvailable(candidates, task, existingTasks, (slot) => {
    if (slot.slotType && slot.slotType === taskType) return true;
    if (slot.allowedTags?.length > 0 && taskTags.length > 0) {
      return taskTags.some(tag => slot.allowedTags.includes(tag));
    }
    return false;
  });

  if (exactMatch) {
    return buildResult(exactMatch, task, 'Matched slot type/tag');
  }

  // Phase 2: type match only (ignore tags)
  const typeMatch = findFirstAvailable(candidates, task, existingTasks, (slot) => {
    return slot.slotType && slot.slotType === taskType;
  });

  if (typeMatch) {
    return buildResult(typeMatch, task, 'Matched slot type');
  }

  // Phase 3: tag match only
  if (taskTags.length > 0) {
    const tagMatch = findFirstAvailable(candidates, task, existingTasks, (slot) => {
      if (!slot.allowedTags || slot.allowedTags.length === 0) return false;
      return taskTags.some(tag => slot.allowedTags.includes(tag));
    });
    if (tagMatch) {
      return buildResult(tagMatch, task, 'Matched slot tags');
    }
  }

  // Phase 4: flexible/untyped slots
  const flexibleMatch = findFirstAvailable(candidates, task, existingTasks, (slot) => {
    if (!slot.slotType && (!slot.allowedTags || slot.allowedTags.length === 0)) return true;
    if (slot.flexibility === 'flexible') return true;
    return false;
  });

  if (flexibleMatch) {
    return buildResult(flexibleMatch, task, 'Used flexible slot');
  }

  // Phase 5: any slot that allows this task (preferred slots accept non-matching)
  const anyMatch = findFirstAvailable(candidates, task, existingTasks, (slot) => {
    const { allowed } = canAssignTaskToSlot(slot, task);
    return allowed;
  });

  if (anyMatch) {
    return buildResult(anyMatch, task, 'Best available slot');
  }

  // Phase 6: no framework slots worked, try ad-hoc as last resort
  return scheduleWithoutFramework(task, existingTasks, taskTypes);
}

// ---------------------------------------------------------------------------
// Mode 2: Schedule without framework (no slots at all)
// ---------------------------------------------------------------------------

function scheduleWithoutFramework(task, existingTasks, taskTypes) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const taskDuration = task.duration || DEFAULT_DURATION;
  const taskTypeId = task.primaryType || task.taskType || 'work';
  const typeConfig = Array.isArray(taskTypes)
    ? taskTypes.find(t => t.id === taskTypeId)
    : null;

  for (let dayOffset = 0; dayOffset < MAX_DAYS_AHEAD; dayOffset++) {
    const day = addDays(now, dayOffset);
    const dayName = format(day, 'EEEE');

    if (typeConfig?.allowedDays && Array.isArray(typeConfig.allowedDays)) {
      if (typeConfig.allowedDays.length > 0 && !typeConfig.allowedDays.includes(dayName)) {
        continue;
      }
      if (typeConfig.allowedDays.length === 0) {
        return null;
      }
    }

    const dayStart = getAdHocDayStart(day, dayOffset === 0 ? now : null, typeConfig);
    const dayEnd = getAdHocDayEnd(day, typeConfig);

    if (dayStart >= dayEnd) continue;

    let candidate = new Date(dayStart);
    const roundedMinutes = Math.ceil(candidate.getMinutes() / SNAP_MINUTES) * SNAP_MINUTES;
    candidate.setMinutes(roundedMinutes, 0, 0);

    while (candidate < dayEnd) {
      const candidateEnd = addMinutes(candidate, taskDuration);
      if (candidateEnd > dayEnd) break;

      if (!hasConflict(candidate, candidateEnd, existingTasks)) {
        const scheduledDate = format(candidate, 'yyyy-MM-dd');
        const overflowedFromToday = dayOffset > 0 && scheduledDate !== todayStr;
        return {
          scheduledTime: candidate.toISOString(),
          specificTime: formatHHMM(candidate),
          specificDay: dayName,
          date: scheduledDate,
          slotId: null,
          label: null,
          reason: overflowedFromToday
            ? `Overflowed to ${dayName} — today is full`
            : 'Next available time (no framework)',
          confidence: 60,
          overflowed: overflowedFromToday,
          overflowDaysAhead: dayOffset,
        };
      }

      candidate = addMinutes(candidate, SNAP_MINUTES);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureFutureSlots(existingSlots, settings, daysAhead) {
  const defaultDaySlots = settings?.defaultDaySlots;
  if (!Array.isArray(defaultDaySlots) || defaultDaySlots.length === 0) {
    return existingSlots;
  }

  const existingSignatures = new Set(
    existingSlots.map(s => `${s.date}|${s.startTime}|${s.endTime}|${s.sourceBlockId || ''}`)
  );

  const generated = [];
  const today = new Date();

  for (let offset = 0; offset < daysAhead; offset++) {
    const targetDate = addDays(today, offset);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const dayName = format(targetDate, 'EEEE');

    for (const template of defaultDaySlots) {
      if (template.day?.toLowerCase() !== dayName.toLowerCase()) continue;

      const sig = `${dateStr}|${template.startTime}|${template.endTime}|${template.id || ''}`;
      if (existingSignatures.has(sig)) continue;

      generated.push(createCalendarSlot({
        id: `gen_${dateStr}_${template.id || template.startTime}`,
        date: dateStr,
        startTime: template.startTime,
        endTime: template.endTime,
        slotType: template.slotType || null,
        allowedTags: Array.isArray(template.allowedTags) ? template.allowedTags : [],
        label: template.label || 'Time slot',
        color: template.color,
        flexibility: template.flexibility || 'preferred',
        sourceScheduleId: 'default-day-slots',
        sourceBlockId: template.id || null,
        assignedTaskId: null,
      }));

      existingSignatures.add(sig);
    }
  }

  return [...existingSlots, ...generated];
}

function findFirstAvailable(candidates, task, existingTasks, filterFn) {
  const taskDuration = task.duration || DEFAULT_DURATION;

  for (const slot of candidates) {
    if (!filterFn(slot)) continue;
    if (slot.assignedTaskId && slot.assignedTaskId !== task.id) continue;

    const slotStart = getSlotStartDateTime(slot);
    const slotEnd = addMinutes(slotStart, getSlotDuration(slot));

    let candidateStart = new Date(slotStart);
    const roundedMinutes = Math.ceil(candidateStart.getMinutes() / SNAP_MINUTES) * SNAP_MINUTES;
    candidateStart.setMinutes(roundedMinutes, 0, 0);
    if (candidateStart < slotStart) candidateStart = new Date(slotStart);

    while (candidateStart < slotEnd) {
      const candidateEnd = addMinutes(candidateStart, taskDuration);
      if (candidateEnd > slotEnd) break;

      if (!hasConflict(candidateStart, candidateEnd, existingTasks)) {
        return { slot, startTime: candidateStart };
      }

      candidateStart = addMinutes(candidateStart, SNAP_MINUTES);
    }
  }

  return null;
}

function buildResult(match, task, reason) {
  const { slot, startTime } = match;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const scheduledDate = format(startTime, 'yyyy-MM-dd');
  const overflowedFromToday = scheduledDate !== todayStr;
  const daysDiff = overflowedFromToday
    ? Math.round((startTime.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    scheduledTime: startTime.toISOString(),
    specificTime: formatHHMM(startTime),
    specificDay: format(startTime, 'EEEE'),
    date: scheduledDate,
    slotId: slot.id,
    label: slot.label,
    slotColor: slot.color,
    reason: overflowedFromToday
      ? `${reason} — overflowed to ${format(startTime, 'EEEE')}`
      : reason,
    confidence: slot.slotType === (task.primaryType || task.taskType) ? 95 : 75,
    overflowed: overflowedFromToday,
    overflowDaysAhead: Math.max(0, daysDiff),
  };
}

function hasConflict(start, end, existingTasks) {
  if (!Array.isArray(existingTasks)) return false;

  return existingTasks.some(t => {
    if (!t.scheduledTime) return false;
    if (t.status === 'completed' || t.status === 'cancelled') return false;

    const tStart = new Date(t.scheduledTime);
    const tEnd = addMinutes(tStart, t.duration || DEFAULT_DURATION);
    return start < tEnd && end > tStart;
  });
}

function getAdHocDayStart(day, now, typeConfig) {
  const start = new Date(day);

  let startHour = ADHOC_WORK_START;
  if (typeConfig?.constraints?.preferredTimeStart) {
    const [h] = typeConfig.constraints.preferredTimeStart.split(':').map(Number);
    if (!isNaN(h)) startHour = h;
  }

  start.setHours(startHour, 0, 0, 0);

  if (now && now > start) {
    return now;
  }
  return start;
}

function getAdHocDayEnd(day, typeConfig) {
  const end = new Date(day);

  let endHour = ADHOC_WORK_END;
  if (typeConfig?.constraints?.preferredTimeEnd) {
    const [h] = typeConfig.constraints.preferredTimeEnd.split(':').map(Number);
    if (!isNaN(h) && h > 0 && h <= 23) endHour = h;
  }

  end.setHours(endHour, 0, 0, 0);
  return end;
}

function formatHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Apply a one-off event to the calendar, overriding any framework slots that
 * overlap. Returns information about which slots were displaced so their
 * assigned tasks can be rescheduled.
 *
 * @param {Object} event - { date, start, end, name, id }
 * @param {Object} state - { slots, tasks, settings, taskTypes }
 * @returns {{ eventSlot: Object, displacedTasks: Object[], rescheduled: Object[] }}
 */
export function applyEventOverride(event, state) {
  const { slots = [], tasks = [], settings = {}, taskTypes = [] } = state;
  const eventStartMin = toMinutes(event.start);
  const eventEndMin = toMinutes(event.end);

  const displacedTasks = [];
  const affectedSlotIds = new Set();

  // Find slots on the event date that overlap with the event time
  slots.forEach(slot => {
    if (slot.date !== event.date) return;
    const slotStart = toMinutes(slot.startTime);
    const slotEnd = toMinutes(slot.endTime);
    if (slotStart < eventEndMin && slotEnd > eventStartMin) {
      affectedSlotIds.add(slot.id);
      if (slot.assignedTaskId) {
        const task = tasks.find(t =>
          (t.id || t.key)?.toString() === slot.assignedTaskId?.toString()
        );
        if (task) {
          displacedTasks.push({
            ...task,
            displacedFromSlotId: slot.id,
            displacedFromSlotType: slot.slotType,
            scheduledTime: null,
            scheduledFor: null,
            specificTime: null,
            scheduledSlotId: null,
          });
        }
      }
    }
  });

  // Reschedule displaced tasks to next available matching slot
  const rescheduled = [];
  const remainingState = {
    ...state,
    slots: slots.filter(s => !affectedSlotIds.has(s.id)),
    tasks: tasks.filter(t =>
      !displacedTasks.some(d => (d.id || d.key)?.toString() === (t.id || t.key)?.toString())
    ),
  };

  displacedTasks.forEach(task => {
    const result = scheduleTask(task, remainingState);
    if (result) {
      rescheduled.push({
        task,
        newTime: result.scheduledTime,
        newSlotId: result.slotId,
        reason: `Rescheduled from ${event.date} due to "${event.name}"`,
      });
      remainingState.tasks.push({
        ...task,
        scheduledTime: result.scheduledTime,
        scheduledSlotId: result.slotId,
      });
    } else {
      rescheduled.push({
        task,
        newTime: null,
        newSlotId: null,
        reason: `Could not find alternative slot after displacement by "${event.name}"`,
      });
    }
  });

  return {
    affectedSlotIds: Array.from(affectedSlotIds),
    displacedTasks,
    rescheduled,
  };
}

function toMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default {
  scheduleTask,
  scheduleMultipleTasks,
  previewTaskSchedule,
  applyEventOverride,
};
