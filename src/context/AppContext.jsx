/**
 * Enhanced AppContext
 *
 * Centralized state management for Taskometer 2.0
 * Uses structured reducers for different entity types with audit logging.
 *
 * Features:
 * - Separate state slices for tasks, slots, tags, types, schedules
 * - Automatic audit logging for all state changes
 * - Integration with DatabaseAdapter for persistence
 * - Backwards compatibility with legacy state structure
 */

import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { addDays, format } from 'date-fns';
import { getAdapter } from '../services/database';
import { createTask, migrateLegacyTask, TASK_STATUSES } from '../models/Task';
import { createCalendarSlot, getSlotStartDateTime } from '../models/CalendarSlot';
import { createTag, DEFAULT_TAGS } from '../models/Tag';
import { createTaskType, DEFAULT_TASK_TYPES } from '../models/TaskType';
import { createSchedule, createScheduleBlock, BLOCK_CATEGORIES } from '../models/Schedule';
import { createAuditEntry, AUDIT_ACTIONS, ENTITY_TYPES, CHANGE_SOURCES } from '../models/AuditEntry';
import { findOptimalTimeSlot, batchScheduleTasks } from '../utils/intelligentScheduler';
import { batchMatchTasksToSlots } from '../utils/slotMatcher';
import { getActiveSchedule as getLegacyActiveSchedule } from '../utils/scheduleTemplates';

// ============================================
// CONTEXT CREATION
// ============================================

export const AppContext = createContext();

// ============================================
// INITIAL STATE
// ============================================

const getInitialDate = () => {
  const nd = new Date();
  return {
    day: format(nd, 'dd'),
    dayDisplay: format(nd, 'd'),
    month: format(nd, 'MM'),
    monthDisplay: format(nd, 'MMM'),
    year: format(nd, 'y'),
    weekday: format(nd, 'EEEE'),
  };
};

const initialState = {
  // Core entities
  tasks: [],
  slots: [],
  tags: [...DEFAULT_TAGS],
  taskTypes: [...DEFAULT_TASK_TYPES],
  schedules: [],
  palaces: [],

  // Active selections
  activeSchedule: null,
  activeScheduleId: null,

  // UI state
  date: getInitialDate(),

  // Audit log (in-memory, persisted separately)
  auditLog: [],

  // Loading/error states
  isLoading: true,
  error: null,
  isInitialized: false,

  // Legacy compatibility
  items: [], // Alias for tasks

  // Settings
  settings: {
    autoSchedule: true,
    showCompletedTasks: false,
    defaultView: 'week',
    theme: 'dark',
    defaultDaySlots: []
  }
};

// ============================================
// ACTION TYPES
// ============================================

export const ACTION_TYPES = {
  // Initialization
  INIT_STATE: 'INIT_STATE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',

  // Task actions
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  COMPLETE_TASK: 'COMPLETE_TASK',
  PAUSE_TASK: 'PAUSE_TASK',
  RESUME_TASK: 'RESUME_TASK',
  RESCHEDULE_TASK: 'RESCHEDULE_TASK',
  BATCH_UPDATE_TASKS: 'BATCH_UPDATE_TASKS',
  SCHEDULE_TASKS: 'SCHEDULE_TASKS',
  RESCHEDULE_ALL_TASKS: 'RESCHEDULE_ALL_TASKS',

  // Slot actions
  ADD_SLOT: 'ADD_SLOT',
  UPDATE_SLOT: 'UPDATE_SLOT',
  DELETE_SLOT: 'DELETE_SLOT',
  ASSIGN_TASK_TO_SLOT: 'ASSIGN_TASK_TO_SLOT',
  CLEAR_SLOT: 'CLEAR_SLOT',
  BATCH_CREATE_SLOTS: 'BATCH_CREATE_SLOTS',
  CLEAR_SLOTS_FOR_DATE: 'CLEAR_SLOTS_FOR_DATE',

  // Tag actions
  ADD_TAG: 'ADD_TAG',
  UPDATE_TAG: 'UPDATE_TAG',
  DELETE_TAG: 'DELETE_TAG',

  // Task Type actions
  ADD_TASK_TYPE: 'ADD_TASK_TYPE',
  UPDATE_TASK_TYPE: 'UPDATE_TASK_TYPE',
  DELETE_TASK_TYPE: 'DELETE_TASK_TYPE',

  // Schedule actions
  ADD_SCHEDULE: 'ADD_SCHEDULE',
  UPDATE_SCHEDULE: 'UPDATE_SCHEDULE',
  DELETE_SCHEDULE: 'DELETE_SCHEDULE',
  SET_ACTIVE_SCHEDULE: 'SET_ACTIVE_SCHEDULE',
  APPLY_SCHEDULE: 'APPLY_SCHEDULE',
  APPLY_SCHEDULE_BLOCKS: 'APPLY_SCHEDULE_BLOCKS',

  // Palace actions
  ADD_PALACE: 'ADD_PALACE',
  UPDATE_PALACE: 'UPDATE_PALACE',
  DELETE_PALACE: 'DELETE_PALACE',
  ADD_PALACE_LOCATION: 'ADD_PALACE_LOCATION',
  UPDATE_PALACE_LOCATION: 'UPDATE_PALACE_LOCATION',
  DELETE_PALACE_LOCATION: 'DELETE_PALACE_LOCATION',

  // Settings actions
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',

  // Date actions
  UPDATE_DATE: 'UPDATE_DATE',
  DAILY_RESET: 'DAILY_RESET',

  // Audit actions
  ADD_AUDIT_ENTRY: 'ADD_AUDIT_ENTRY',

  // Legacy compatibility
  ADD_ITEM: 'ADD_ITEM',
  UPDATE_ITEM: 'UPDATE_ITEM',
  DELETE_ITEM: 'DELETE_ITEM',
  RESET_ALL: 'RESET_ALL',
  APPLY_TEMPLATE_BLOCKS: 'APPLY_TEMPLATE_BLOCKS',
  AUTO_SLOT_TASKS_INTO_TEMPLATE: 'AUTO_SLOT_TASKS_INTO_TEMPLATE'
};

function normalizeTemplateBlockToSlot(block = {}, index = 0) {
  const date = resolveTemplateBlockDate(block);
  const sourceScheduleId = block.sourceScheduleId || block.templateId || null;
  const sourceBlockId = block.sourceBlockId ||
    block.id ||
    `${sourceScheduleId || 'template'}-${date}-${index}`;

  return {
    date,
    startTime: resolveTemplateBlockTime(block.start, block.startTime, '09:00'),
    endTime: resolveTemplateBlockTime(block.end, block.endTime, '10:00'),
    // Keep template category/type for slot labeling and matching.
    slotType: block.slotType || block.type || block.category || null,
    allowedTags: Array.isArray(block.allowedTags) ? block.allowedTags : [],
    label: block.label || block.name || `${block.type || block.category || 'Template'} block`,
    description: block.description || null,
    color: block.color,
    flexibility: block.flexibility || 'preferred',
    sourceScheduleId,
    sourceBlockId,
    isRecurring: false
  };
}

function resolveTemplateBlockDate(block = {}) {
  if (typeof block.date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(block.date)) {
      return block.date;
    }
    const parsedDate = new Date(block.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      return format(parsedDate, 'yyyy-MM-dd');
    }
  }

  if (block.date instanceof Date && !Number.isNaN(block.date.getTime())) {
    return format(block.date, 'yyyy-MM-dd');
  }

  if (block.startTime) {
    const parsedStart = new Date(block.startTime);
    if (!Number.isNaN(parsedStart.getTime())) {
      return format(parsedStart, 'yyyy-MM-dd');
    }
  }

  return format(new Date(), 'yyyy-MM-dd');
}

function resolveTemplateBlockTime(rawTime, isoTime, fallback) {
  if (typeof rawTime === 'string') {
    const strictMatch = rawTime.match(/^(\d{2}):(\d{2})$/);
    if (strictMatch) {
      return rawTime;
    }
    const looseMatch = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    if (looseMatch) {
      return `${looseMatch[1].padStart(2, '0')}:${looseMatch[2]}`;
    }
  }

  if (isoTime) {
    const parsedTime = new Date(isoTime);
    if (!Number.isNaN(parsedTime.getTime())) {
      return format(parsedTime, 'HH:mm');
    }
  }

  return fallback;
}

const DEFAULT_DAY_SLOT_SOURCE_ID = 'default-day-slots';

function getTaskIdentifier(task) {
  if (!task) return null;
  return task.id?.toString() || task.key?.toString() || null;
}

function getDefaultDaySlotsFromSettings(settings = {}) {
  if (!Array.isArray(settings.defaultDaySlots)) {
    return [];
  }

  return settings.defaultDaySlots.filter((slot) =>
    slot &&
    typeof slot.day === 'string' &&
    typeof slot.startTime === 'string' &&
    typeof slot.endTime === 'string'
  );
}

function buildDefaultSlotId(template, date) {
  const templateId = template.id ||
    `${template.day}-${template.startTime}-${template.endTime}-${template.slotType || 'any'}`;
  return `default-slot-${templateId}-${date}`;
}

function generateDefaultSlotsFromSettings(state, daysAhead = 21) {
  const templateSlots = getDefaultDaySlotsFromSettings(state.settings);
  if (templateSlots.length === 0) {
    return [];
  }

  const existingIds = new Set((state.slots || []).map((slot) => slot.id));
  const generated = [];

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const targetDate = addDays(new Date(), offset);
    const dateString = format(targetDate, 'yyyy-MM-dd');
    const dayName = format(targetDate, 'EEEE').toLowerCase();

    templateSlots
      .filter((template) => template.day.toLowerCase() === dayName)
      .forEach((template, index) => {
        const slotId = buildDefaultSlotId(template, dateString);
        if (existingIds.has(slotId)) {
          return;
        }

        const generatedSlot = createCalendarSlot({
          id: slotId,
          date: dateString,
          startTime: template.startTime,
          endTime: template.endTime,
          slotType: template.slotType || null,
          allowedTags: Array.isArray(template.allowedTags) ? template.allowedTags : [],
          label: template.label || `${template.slotType || 'Task'} slot`,
          description: template.description || null,
          color: template.color,
          flexibility: template.flexibility || 'fixed',
          sourceScheduleId: DEFAULT_DAY_SLOT_SOURCE_ID,
          sourceBlockId: template.id || `${template.day}-${index}`,
          isRecurring: false
        });

        generated.push(generatedSlot);
        existingIds.add(slotId);
      });
  }

  return generated;
}

function clearSlotAssignmentsForTaskIds(slots = [], taskIds = new Set(), timestamp) {
  if (taskIds.size === 0) {
    return slots;
  }

  return slots.map((slot) => {
    const assignedTaskId = slot.assignedTaskId?.toString();
    if (!assignedTaskId || !taskIds.has(assignedTaskId)) {
      return slot;
    }
    return {
      ...slot,
      assignedTaskId: null,
      updatedAt: timestamp
    };
  });
}

function scheduleTasksIntoSlots(state, tasksToSchedule = [], timestamp) {
  if (!Array.isArray(tasksToSchedule) || tasksToSchedule.length === 0) {
    return null;
  }

  const normalizedTasks = tasksToSchedule.map((task) => task || {}).map((task) => {
    return getTaskIdentifier(task) ? task : createTask(task);
  });

  const schedulingIds = new Set(
    normalizedTasks
      .map((task) => getTaskIdentifier(task))
      .filter(Boolean)
  );

  const generatedSlots = generateDefaultSlotsFromSettings(state, 21);
  const slotPool = [...state.slots, ...generatedSlots];
  if (slotPool.length === 0) {
    return null;
  }

  const existingTasksForConflicts = state.tasks.filter((task) => {
    const taskId = getTaskIdentifier(task);
    return taskId ? !schedulingIds.has(taskId) : true;
  });

  const matches = batchMatchTasksToSlots(
    normalizedTasks,
    slotPool,
    existingTasksForConflicts
  );

  const scheduledTaskMap = new Map();
  const slotAssignmentMap = new Map();
  const unscheduledTasks = [];

  matches.forEach((result) => {
    if (result.unscheduled || !result.slot) {
      unscheduledTasks.push(result.task);
      return;
    }

    const taskId = getTaskIdentifier(result.task);
    if (!taskId) {
      unscheduledTasks.push(result.task);
      return;
    }

    const slotStart = getSlotStartDateTime(result.slot);
    scheduledTaskMap.set(taskId, {
      ...result.task,
      scheduledTime: slotStart.toISOString(),
      scheduledFor: slotStart.toISOString(),
      specificTime: result.slot.startTime,
      specificDay: format(new Date(`${result.slot.date}T00:00:00`), 'EEEE'),
      scheduledSlotId: result.slot.id,
      failureReason: null
    });

    slotAssignmentMap.set(result.slot.id, taskId);
  });

  if (scheduledTaskMap.size === 0) {
    return null;
  }

  const updatedTasks = state.tasks.map((task) => {
    const taskId = getTaskIdentifier(task);
    if (!taskId) return task;
    const scheduledTask = scheduledTaskMap.get(taskId);
    if (!scheduledTask) return task;
    return {
      ...task,
      ...scheduledTask,
      updatedAt: timestamp
    };
  });

  const updatedTaskIds = new Set(updatedTasks.map((task) => getTaskIdentifier(task)).filter(Boolean));
  scheduledTaskMap.forEach((task, taskId) => {
    if (updatedTaskIds.has(taskId)) {
      return;
    }
    updatedTasks.push({
      ...task,
      updatedAt: timestamp
    });
  });

  const slotsById = new Map(state.slots.map((slot) => [slot.id, slot]));
  schedulingIds.forEach((taskId) => {
    const previousTask = state.tasks.find((task) => getTaskIdentifier(task) === taskId);
    const previousSlotId = previousTask?.scheduledSlotId;
    if (!previousSlotId || !slotsById.has(previousSlotId)) {
      return;
    }
    if (slotAssignmentMap.has(previousSlotId)) {
      return;
    }

    const previousSlot = slotsById.get(previousSlotId);
    slotsById.set(previousSlotId, {
      ...previousSlot,
      assignedTaskId: null,
      updatedAt: timestamp
    });
  });

  slotAssignmentMap.forEach((taskId, slotId) => {
    if (slotsById.has(slotId)) {
      const existingSlot = slotsById.get(slotId);
      slotsById.set(slotId, {
        ...existingSlot,
        assignedTaskId: taskId,
        updatedAt: timestamp
      });
      return;
    }

    const generatedSlot = generatedSlots.find((slot) => slot.id === slotId);
    if (generatedSlot) {
      slotsById.set(slotId, {
        ...generatedSlot,
        assignedTaskId: taskId,
        updatedAt: timestamp
      });
    }
  });

  return {
    tasks: updatedTasks,
    slots: Array.from(slotsById.values()),
    unscheduledTasks
  };
}

// ============================================
// REDUCER
// ============================================

function appReducer(state, action) {
  const now = new Date();
  const timestamp = now.toISOString();

  switch (action.type) {
    // ============================================
    // INITIALIZATION
    // ============================================

    case ACTION_TYPES.INIT_STATE: {
      return {
        ...state,
        ...action.payload,
        items: action.payload.tasks || action.payload.items || [],
        isLoading: false,
        isInitialized: true,
        error: null
      };
    }

    case ACTION_TYPES.SET_LOADING: {
      return { ...state, isLoading: action.payload };
    }

    case ACTION_TYPES.SET_ERROR: {
      return { ...state, error: action.payload, isLoading: false };
    }

    // ============================================
    // TASK ACTIONS
    // ============================================

    case ACTION_TYPES.ADD_TASK:
    case ACTION_TYPES.ADD_ITEM: {
      const taskData = action.payload || action.item;
      let newTask = createTask(taskData);
      const skipAutoSchedule = taskData?.autoSchedule === false;
      let newTasks = [...state.tasks, newTask];
      let newSlots = state.slots;

      // Auto-schedule if enabled and no specific time set.
      // Preferred path: next available matching slot.
      if (state.settings.autoSchedule && !skipAutoSchedule && !newTask.scheduledTime && !newTask.specificTime) {
        const slotScheduled = scheduleTasksIntoSlots(
          { ...state, tasks: newTasks },
          [newTask],
          timestamp
        );

        if (slotScheduled) {
          newTasks = slotScheduled.tasks;
          newSlots = slotScheduled.slots;
        } else {
          // Backwards-compatible fallback for legacy schedule templates.
          const activeSchedule = state.activeSchedule || getLegacyActiveSchedule();
          if (activeSchedule) {
            const optimalSlot = findOptimalTimeSlot(newTask, activeSchedule, state.tasks, state.taskTypes);
            if (optimalSlot) {
              newTask = {
                ...newTask,
                scheduledTime: optimalSlot.scheduledFor,
                scheduledFor: optimalSlot.scheduledFor,
                specificTime: optimalSlot.specificTime
              };
              newTasks = [...state.tasks, newTask];
            }
          }
        }
      }

      return {
        ...state,
        tasks: newTasks,
        slots: newSlots,
        items: newTasks // Legacy compatibility
      };
    }

    case ACTION_TYPES.UPDATE_TASK:
    case ACTION_TYPES.UPDATE_ITEM: {
      const updateData = action.payload || action.item;
      const taskId = updateData.id || updateData.key;

      const updatedTasks = state.tasks.map(task => {
        const isMatch = task.id === taskId || task.key?.toString() === taskId?.toString();
        if (!isMatch) return task;

        return {
          ...task,
          ...updateData,
          updatedAt: timestamp
        };
      });

      const taskToReschedule = updatedTasks.find((task) => {
        return (task.id === taskId || task.key?.toString() === taskId?.toString()) &&
          state.settings.autoSchedule &&
          task.status === 'pending' &&
          !task.scheduledTime &&
          !task.specificTime;
      });

      if (taskToReschedule) {
        const slotScheduled = scheduleTasksIntoSlots(
          { ...state, tasks: updatedTasks },
          [taskToReschedule],
          timestamp
        );

        if (slotScheduled) {
          return {
            ...state,
            tasks: slotScheduled.tasks,
            slots: slotScheduled.slots,
            items: slotScheduled.tasks
          };
        }

        const activeSchedule = state.activeSchedule || getLegacyActiveSchedule();
        if (activeSchedule) {
          const otherTasks = updatedTasks.filter((task) =>
            task.id !== taskToReschedule.id && task.key !== taskToReschedule.key
          );
          const optimalSlot = findOptimalTimeSlot(taskToReschedule, activeSchedule, otherTasks, state.taskTypes);
          if (optimalSlot) {
            const rescheduledTasks = updatedTasks.map((task) => {
              if (task.id !== taskToReschedule.id && task.key !== taskToReschedule.key) {
                return task;
              }

              return {
                ...task,
                scheduledTime: optimalSlot.scheduledFor,
                scheduledFor: optimalSlot.scheduledFor,
                specificTime: optimalSlot.specificTime
              };
            });

            return {
              ...state,
              tasks: rescheduledTasks,
              items: rescheduledTasks
            };
          }
        }
      }

      return {
        ...state,
        tasks: updatedTasks,
        items: updatedTasks
      };
    }

    case ACTION_TYPES.DELETE_TASK:
    case ACTION_TYPES.DELETE_ITEM: {
      const deleteData = action.payload || action.item;
      const taskId = deleteData.id || deleteData.key;
      const removedTaskIds = new Set(
        state.tasks
          .filter((task) => task.id === taskId || task.key?.toString() === taskId?.toString())
          .map((task) => getTaskIdentifier(task))
          .filter(Boolean)
      );

      const newTasks = state.tasks.filter(task =>
        task.id !== taskId && task.key?.toString() !== taskId?.toString()
      );
      const newSlots = clearSlotAssignmentsForTaskIds(state.slots, removedTaskIds, timestamp);

      return {
        ...state,
        tasks: newTasks,
        slots: newSlots,
        items: newTasks
      };
    }

    case ACTION_TYPES.COMPLETE_TASK: {
      const { taskId } = action.payload;
      const newTasks = state.tasks.map(task => {
        if (task.id !== taskId && task.key?.toString() !== taskId) return task;
        return {
          ...task,
          status: 'completed',
          completedAt: timestamp,
          updatedAt: timestamp
        };
      });

      return { ...state, tasks: newTasks, items: newTasks };
    }

    case ACTION_TYPES.PAUSE_TASK: {
      const { taskId } = action.payload;
      const newTasks = state.tasks.map(task => {
        if (task.id !== taskId && task.key?.toString() !== taskId) return task;
        return { ...task, status: 'paused', updatedAt: timestamp };
      });

      return { ...state, tasks: newTasks, items: newTasks };
    }

    case ACTION_TYPES.RESUME_TASK: {
      const { taskId } = action.payload;
      const newTasks = state.tasks.map(task => {
        if (task.id !== taskId && task.key?.toString() !== taskId) return task;
        return { ...task, status: 'pending', updatedAt: timestamp };
      });

      return { ...state, tasks: newTasks, items: newTasks };
    }

    case ACTION_TYPES.RESCHEDULE_TASK: {
      const { taskId, scheduledTime, specificTime, specificDay } = action.payload;
      const oldTask = state.tasks.find((task) => task.id === taskId || task.key?.toString() === taskId);
      const oldSlotId = oldTask?.scheduledSlotId;
      const updatedSlots = oldSlotId
        ? state.slots.map((slot) => {
          if (slot.id !== oldSlotId) return slot;
          return { ...slot, assignedTaskId: null, updatedAt: timestamp };
        })
        : state.slots;

      const newTasks = state.tasks.map(task => {
        if (task.id !== taskId && task.key?.toString() !== taskId) return task;
        return {
          ...task,
          scheduledTime,
          scheduledFor: scheduledTime,
          specificTime,
          specificDay,
          scheduledSlotId: null,
          updatedAt: timestamp
        };
      });

      return { ...state, tasks: newTasks, slots: updatedSlots, items: newTasks };
    }

    case ACTION_TYPES.BATCH_UPDATE_TASKS: {
      const { updates } = action.payload;
      const updateMap = new Map(updates.map(u => [u.id, u.updates]));

      const newTasks = state.tasks.map(task => {
        const taskUpdates = updateMap.get(task.id) || updateMap.get(task.key?.toString());
        if (!taskUpdates) return task;
        return { ...task, ...taskUpdates, updatedAt: timestamp };
      });

      return { ...state, tasks: newTasks, items: newTasks };
    }

    case ACTION_TYPES.SCHEDULE_TASKS: {
      const tasksToSchedule = action.payload?.tasks || action.tasks || [];
      if (tasksToSchedule.length === 0) {
        return state;
      }

      const slotScheduled = scheduleTasksIntoSlots(state, tasksToSchedule, timestamp);
      if (slotScheduled) {
        return {
          ...state,
          tasks: slotScheduled.tasks,
          slots: slotScheduled.slots,
          items: slotScheduled.tasks
        };
      }

      const activeSchedule = state.activeSchedule || getLegacyActiveSchedule();
      if (!activeSchedule) {
        return state;
      }

      // Backwards-compatible fallback using legacy template blocks.
      const schedulingIds = new Set(
        tasksToSchedule
          .map(task => task?.id?.toString() || task?.key?.toString() || null)
          .filter(Boolean)
      );
      const existingTasks = state.tasks.filter(task => {
        const id = task?.id?.toString() || task?.key?.toString() || null;
        return id ? !schedulingIds.has(id) : true;
      });

      const scheduledTasks = batchScheduleTasks(tasksToSchedule, activeSchedule, existingTasks, state.taskTypes);
      const scheduledTaskMap = new Map(
        scheduledTasks.map(task => [task?.id?.toString() || task?.key?.toString(), task])
      );

      const newTasks = state.tasks.map(task => {
        const id = task?.id?.toString() || task?.key?.toString();
        const scheduled = scheduledTaskMap.get(id);
        return scheduled || task;
      });

      return { ...state, tasks: newTasks, items: newTasks };
    }

    case ACTION_TYPES.RESCHEDULE_ALL_TASKS: {
      const pendingTasks = state.tasks
        .filter(item => item.status === 'pending' || item.status === 'paused')
        .map(item => ({
          ...item,
          scheduledTime: null,
          scheduledFor: null,
          specificTime: null,
          specificDay: null,
          scheduledSlotId: null
        }));

      const slotScheduled = scheduleTasksIntoSlots(state, pendingTasks, timestamp);
      if (slotScheduled) {
        return {
          ...state,
          tasks: slotScheduled.tasks,
          slots: slotScheduled.slots,
          items: slotScheduled.tasks
        };
      }

      const activeSchedule = state.activeSchedule || getLegacyActiveSchedule();

      if (activeSchedule) {
        const scheduledTasks = batchScheduleTasks(pendingTasks, activeSchedule, [], state.taskTypes);
        const newTasks = state.tasks.map(item => {
          const scheduledItem = scheduledTasks.find(s => s.key === item.key || s.id === item.id);
          return scheduledItem || item;
        });

        return { ...state, tasks: newTasks, items: newTasks };
      }

      return state;
    }

    // ============================================
    // SLOT ACTIONS
    // ============================================

    case ACTION_TYPES.ADD_SLOT: {
      const slot = createCalendarSlot(action.payload);
      return { ...state, slots: [...state.slots, slot] };
    }

    case ACTION_TYPES.UPDATE_SLOT: {
      const slotId = action.payload?.slotId || action.payload?.id;
      const updates = action.payload?.updates || action.payload || {};
      const newSlots = state.slots.map(slot =>
        slot.id === slotId ? { ...slot, ...updates, updatedAt: timestamp } : slot
      );
      return { ...state, slots: newSlots };
    }

    case ACTION_TYPES.DELETE_SLOT: {
      const slotId = action.payload?.slotId || action.payload?.id;
      return { ...state, slots: state.slots.filter(s => s.id !== slotId) };
    }

    case ACTION_TYPES.ASSIGN_TASK_TO_SLOT: {
      const { slotId, taskId } = action.payload;
      const newSlots = state.slots.map(slot =>
        slot.id === slotId ? { ...slot, assignedTaskId: taskId, updatedAt: timestamp } : slot
      );
      return { ...state, slots: newSlots };
    }

    case ACTION_TYPES.CLEAR_SLOT: {
      const { slotId } = action.payload;
      const newSlots = state.slots.map(slot =>
        slot.id === slotId ? { ...slot, assignedTaskId: null, updatedAt: timestamp } : slot
      );
      return { ...state, slots: newSlots };
    }

    case ACTION_TYPES.BATCH_CREATE_SLOTS: {
      const { slots } = action.payload;
      const newSlots = slots.map(s => createCalendarSlot(s));
      return { ...state, slots: [...state.slots, ...newSlots] };
    }

    case ACTION_TYPES.CLEAR_SLOTS_FOR_DATE: {
      const { date, sourceScheduleId } = action.payload;
      const newSlots = state.slots.filter(slot => {
        if (slot.date !== date) return true;
        if (sourceScheduleId && slot.sourceScheduleId !== sourceScheduleId) return true;
        return false;
      });
      return { ...state, slots: newSlots };
    }

    // ============================================
    // TAG ACTIONS
    // ============================================

    case ACTION_TYPES.ADD_TAG: {
      const tag = createTag(action.payload);
      return { ...state, tags: [...state.tags, tag] };
    }

    case ACTION_TYPES.UPDATE_TAG: {
      const { tagId, updates } = action.payload;
      const newTags = state.tags.map(tag =>
        tag.id === tagId ? { ...tag, ...updates, updatedAt: timestamp } : tag
      );
      return { ...state, tags: newTags };
    }

    case ACTION_TYPES.DELETE_TAG: {
      const { tagId } = action.payload;
      // Don't delete system tags
      const tag = state.tags.find(t => t.id === tagId);
      if (tag?.isSystem) return state;
      return { ...state, tags: state.tags.filter(t => t.id !== tagId) };
    }

    // ============================================
    // TASK TYPE ACTIONS
    // ============================================

    case ACTION_TYPES.ADD_TASK_TYPE: {
      const taskType = createTaskType(action.payload || action.taskType);
      return { ...state, taskTypes: [...state.taskTypes, taskType] };
    }

    case ACTION_TYPES.UPDATE_TASK_TYPE: {
      const updateData = action.payload || action.taskType;
      const typeId = updateData.id;
      const newTypes = state.taskTypes.map(type =>
        type.id === typeId ? { ...type, ...updateData, updatedAt: timestamp } : type
      );
      return { ...state, taskTypes: newTypes };
    }

    case ACTION_TYPES.DELETE_TASK_TYPE: {
      const typeId = action.payload?.typeId || action.taskTypeId;
      if (typeId === 'default') return state;
      return { ...state, taskTypes: state.taskTypes.filter(t => t.id !== typeId) };
    }

    // ============================================
    // SCHEDULE ACTIONS
    // ============================================

    case ACTION_TYPES.ADD_SCHEDULE: {
      const schedule = createSchedule(action.payload);
      return { ...state, schedules: [...state.schedules, schedule] };
    }

    case ACTION_TYPES.UPDATE_SCHEDULE: {
      const { scheduleId, updates } = action.payload;
      const newSchedules = state.schedules.map(schedule =>
        schedule.id === scheduleId ? { ...schedule, ...updates, updatedAt: timestamp } : schedule
      );
      return { ...state, schedules: newSchedules };
    }

    case ACTION_TYPES.DELETE_SCHEDULE: {
      const { scheduleId } = action.payload;
      const newSchedules = state.schedules.filter(s => s.id !== scheduleId);
      const newActiveSchedule = state.activeScheduleId === scheduleId ? null : state.activeSchedule;
      const newActiveScheduleId = state.activeScheduleId === scheduleId ? null : state.activeScheduleId;
      return {
        ...state,
        schedules: newSchedules,
        activeSchedule: newActiveSchedule,
        activeScheduleId: newActiveScheduleId
      };
    }

    case ACTION_TYPES.SET_ACTIVE_SCHEDULE: {
      const { schedule, scheduleId } = action.payload;
      return {
        ...state,
        activeSchedule: schedule,
        activeScheduleId: scheduleId || schedule?.id
      };
    }

    case ACTION_TYPES.APPLY_SCHEDULE:
    case ACTION_TYPES.APPLY_TEMPLATE_BLOCKS: {
      const { blocks = [], options = {} } = action.payload || {};
      const { overrideExisting = false, mergeWithExisting = true } = options;

      if (!Array.isArray(blocks) || blocks.length === 0) {
        return state;
      }

      const generatedSlots = blocks.map((block, index) =>
        createCalendarSlot(normalizeTemplateBlockToSlot(block, index))
      );

      const affectedDates = new Set(generatedSlots.map(slot => slot.date));
      let baseSlots = state.slots;

      if (overrideExisting || !mergeWithExisting) {
        baseSlots = baseSlots.filter(slot => !affectedDates.has(slot.date));
      }

      // Prevent duplicate slots when re-applying the same schedule/range.
      const slotSignature = (slot) => [
        slot.date,
        slot.startTime,
        slot.endTime,
        slot.label || '',
        slot.sourceScheduleId || '',
        slot.sourceBlockId || ''
      ].join('|');

      const existingSignatures = new Set(baseSlots.map(slotSignature));
      const uniqueGeneratedSlots = generatedSlots.filter(slot => {
        const signature = slotSignature(slot);
        if (existingSignatures.has(signature)) {
          return false;
        }
        existingSignatures.add(signature);
        return true;
      });

      // Legacy template-created tasks should be removed: templates now define
      // scheduling windows/slots, while user tasks fill those windows.
      const nonTemplateTasks = state.tasks.filter(task => !task.isTemplateBlock);

      return {
        ...state,
        slots: [...baseSlots, ...uniqueGeneratedSlots],
        tasks: nonTemplateTasks,
        items: nonTemplateTasks
      };
    }

    case ACTION_TYPES.AUTO_SLOT_TASKS_INTO_TEMPLATE: {
      const { templateBlocks } = action.payload;

      const unscheduledTasks = state.tasks.filter(
        item => item.status === 'pending' && !item.scheduledTime && !item.isTemplateBlock
      );

      if (unscheduledTasks.length === 0 || !templateBlocks?.length) {
        return state;
      }

      const newTasks = state.tasks.map(item => {
        if (item.scheduledTime || item.isTemplateBlock || item.status !== 'pending') {
          return item;
        }

        // Find matching blocks
        const eligibleBlocks = templateBlocks.filter(block =>
          block.type === item.taskType ||
          block.type === item.primaryType ||
          block.type === 'buffer'
        );

        if (eligibleBlocks.length === 0) return item;

        const sortedBlocks = [...eligibleBlocks].sort((a, b) =>
          new Date(a.startTime) - new Date(b.startTime)
        );

        for (const block of sortedBlocks) {
          const blockStart = new Date(block.startTime);
          const blockEnd = new Date(block.endTime);
          const taskDuration = item.duration || 30;
          const blockDuration = (blockEnd - blockStart) / 60000;

          if (blockDuration >= taskDuration && blockStart > new Date()) {
            const hasConflict = state.tasks.some(otherItem => {
              if (!otherItem.scheduledTime || otherItem.id === item.id) return false;
              const otherStart = new Date(otherItem.scheduledTime);
              const otherEnd = new Date(otherStart.getTime() + (otherItem.duration || 30) * 60000);
              const taskEnd = new Date(blockStart.getTime() + taskDuration * 60000);
              return blockStart < otherEnd && taskEnd > otherStart;
            });

            if (!hasConflict) {
              return {
                ...item,
                scheduledTime: blockStart.toISOString(),
                specificTime: blockStart.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                }),
                scheduledFor: blockStart.toISOString().split('T')[0],
                specificDay: format(blockStart, 'EEEE'),
                assignedToTemplate: true
              };
            }
          }
        }

        return item;
      });

      return { ...state, tasks: newTasks, items: newTasks };
    }

    // ============================================
    // PALACE ACTIONS
    // ============================================

    case 'ADD_PALACE': {
      const newPalaces = [...(state.palaces || []), action.payload];
      return { ...state, palaces: newPalaces };
    }

    case 'UPDATE_PALACE': {
      const { palaceId, updates } = action.payload;
      const newPalaces = (state.palaces || []).map(palace =>
        palace.id === palaceId ? { ...palace, ...updates, updatedAt: timestamp } : palace
      );
      return { ...state, palaces: newPalaces };
    }

    case 'DELETE_PALACE': {
      const { palaceId } = action.payload;
      const newPalaces = (state.palaces || []).filter(p => p.id !== palaceId);
      return { ...state, palaces: newPalaces };
    }

    case 'ADD_PALACE_LOCATION': {
      const { palaceId, location } = action.payload;
      const newPalaces = (state.palaces || []).map(palace => {
        if (palace.id !== palaceId) return palace;
        return {
          ...palace,
          locations: [...palace.locations, location],
          updatedAt: timestamp
        };
      });
      return { ...state, palaces: newPalaces };
    }

    case 'UPDATE_PALACE_LOCATION': {
      const { palaceId, locationId, updates } = action.payload;
      const newPalaces = (state.palaces || []).map(palace => {
        if (palace.id !== palaceId) return palace;
        return {
          ...palace,
          locations: palace.locations.map(loc =>
            loc.id === locationId ? { ...loc, ...updates, updatedAt: timestamp } : loc
          ),
          updatedAt: timestamp
        };
      });
      return { ...state, palaces: newPalaces };
    }

    case 'DELETE_PALACE_LOCATION': {
      const { palaceId, locationId } = action.payload;
      const newPalaces = (state.palaces || []).map(palace => {
        if (palace.id !== palaceId) return palace;
        return {
          ...palace,
          locations: palace.locations.filter(loc => loc.id !== locationId),
          updatedAt: timestamp
        };
      });
      return { ...state, palaces: newPalaces };
    }

    // ============================================
    // SETTINGS ACTIONS
    // ============================================

    case ACTION_TYPES.UPDATE_SETTINGS: {
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      };
    }

    // ============================================
    // DATE ACTIONS
    // ============================================

    case ACTION_TYPES.UPDATE_DATE: {
      return { ...state, date: getInitialDate() };
    }

    case ACTION_TYPES.DAILY_RESET:
    case ACTION_TYPES.RESET_ALL: {
      // Move completed tasks out, reset paused to pending
      const newTasks = state.tasks
        .filter(item => item.status !== 'completed')
        .map(item => {
          if (item.status === 'paused') {
            return { ...item, status: 'pending' };
          }
          return item;
        });

      return {
        ...state,
        tasks: newTasks,
        items: newTasks,
        date: getInitialDate()
      };
    }

    // ============================================
    // AUDIT ACTIONS
    // ============================================

    case ACTION_TYPES.ADD_AUDIT_ENTRY: {
      const entry = createAuditEntry(action.payload);
      const newAuditLog = [...state.auditLog, entry].slice(-1000); // Keep last 1000
      return { ...state, auditLog: newAuditLog };
    }

    default:
      console.warn(`[AppContext] Unknown action type: ${action.type}`);
      return state;
  }
}

// ============================================
// CONTEXT PROVIDER
// ============================================

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const dbRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Initialize from database
  useEffect(() => {
    async function initializeState() {
      try {
        dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true });

        const db = await getAdapter();
        dbRef.current = db;

        const savedState = await db.getState();

        // Merge with defaults
        const tasks = savedState.tasks || savedState.items || [];
        const taskTypes = savedState.taskTypes?.length > 0
          ? savedState.taskTypes
          : DEFAULT_TASK_TYPES;

        dispatch({
          type: ACTION_TYPES.INIT_STATE,
          payload: {
            tasks,
            slots: savedState.slots || [],
            tags: savedState.tags?.length > 0 ? savedState.tags : DEFAULT_TAGS,
            taskTypes,
            schedules: savedState.schedules || [],
            palaces: savedState.palaces || [],
            activeScheduleId: savedState.activeScheduleId,
            activeSchedule: await db.getActiveSchedule(),
            settings: { ...initialState.settings, ...(savedState.settings || {}) },
            date: getInitialDate()
          }
        });
      } catch (error) {
        console.error('[AppContext] Initialization error:', error);
        dispatch({ type: ACTION_TYPES.SET_ERROR, payload: error.message });
      }
    }

    initializeState();
  }, []);

  // Debounced save to database
  useEffect(() => {
    if (!state.isInitialized || !dbRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await dbRef.current.saveState({
          tasks: state.tasks,
          slots: state.slots,
          tags: state.tags,
          taskTypes: state.taskTypes,
          schedules: state.schedules,
          palaces: state.palaces,
          activeScheduleId: state.activeScheduleId,
          settings: state.settings,
          items: state.tasks // Legacy compatibility
        });

        // Also save to legacy 'state' key for backwards compatibility
        const legacyState = {
          items: state.tasks,
          taskTypes: state.taskTypes,
          date: state.date,
          activeSchedule: state.activeSchedule
        };
        localStorage.setItem('state', JSON.stringify(legacyState));
      } catch (error) {
        console.error('[AppContext] Save error:', error);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.tasks, state.slots, state.tags, state.taskTypes, state.schedules, state.palaces, state.activeScheduleId, state.settings, state.isInitialized]);

  // Wrapped dispatch with audit logging
  const auditDispatch = useCallback((action) => {
    // Actions that should be audited
    const auditableActions = [
      ACTION_TYPES.ADD_TASK, ACTION_TYPES.UPDATE_TASK, ACTION_TYPES.DELETE_TASK,
      ACTION_TYPES.COMPLETE_TASK, ACTION_TYPES.PAUSE_TASK, ACTION_TYPES.RESUME_TASK,
      ACTION_TYPES.ADD_SLOT, ACTION_TYPES.UPDATE_SLOT, ACTION_TYPES.DELETE_SLOT,
      ACTION_TYPES.ADD_TAG, ACTION_TYPES.UPDATE_TAG, ACTION_TYPES.DELETE_TAG,
      ACTION_TYPES.ADD_TASK_TYPE, ACTION_TYPES.UPDATE_TASK_TYPE, ACTION_TYPES.DELETE_TASK_TYPE,
      ACTION_TYPES.ADD_SCHEDULE, ACTION_TYPES.UPDATE_SCHEDULE, ACTION_TYPES.DELETE_SCHEDULE,
      ACTION_TYPES.SET_ACTIVE_SCHEDULE, ACTION_TYPES.APPLY_SCHEDULE,
      // Legacy
      ACTION_TYPES.ADD_ITEM, ACTION_TYPES.UPDATE_ITEM, ACTION_TYPES.DELETE_ITEM
    ];

    const payload = action.payload || action.item || {};
    const entityType = getEntityTypeFromAction(action.type);
    const auditAction = getAuditActionFromAction(action.type);
    const entitySnapshot = getEntitySnapshotForAction(state, entityType, payload);
    const deleteAction = isDeleteAction(action.type);

    // Dispatch the action
    dispatch(action);

    // Create audit entry if action is auditable
    if (auditableActions.includes(action.type)) {
      const auditPayload = {
        action: auditAction,
        entityType,
        entityId: entitySnapshot.entityId,
        entityName: entitySnapshot.entityName,
        previousState: deleteAction ? entitySnapshot.previousState : null,
        newState: deleteAction ? null : payload,
        source: CHANGE_SOURCES.USER
      };

      dispatch({
        type: ACTION_TYPES.ADD_AUDIT_ENTRY,
        payload: auditPayload
      });

      // Also persist to database
      if (dbRef.current) {
        dbRef.current.createAuditEntry(auditPayload)
          .catch(err => console.error('[AppContext] Audit log error:', err));
      }
    }
  }, [state]);

  return (
    <div className="App">
      <AppContext.Provider value={[state, auditDispatch]}>
        {children}
      </AppContext.Provider>
    </div>
  );
}

// ============================================
// HOOKS
// ============================================

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context[0];
}

export function useAppReducer() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppReducer must be used within AppStateProvider');
  }
  return context[1];
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppStateProvider');
  }
  return context;
}

// Legacy hook for backwards compatibility
export function useItems() {
  const { tasks } = useAppState();

  const pending = tasks.filter(item => item.status === 'pending');
  const paused = tasks.filter(item => item.status === 'paused');
  const completed = tasks.filter(item => item.status === 'completed');

  return { pending, paused, completed };
}

// New specialized hooks
export function useTasks(filters = {}) {
  const { tasks } = useAppState();

  return tasks.filter(task => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.primaryType && task.primaryType !== filters.primaryType && task.taskType !== filters.primaryType) return false;
    if (filters.tags && !filters.tags.some(tag => task.tags?.includes(tag))) return false;
    return true;
  });
}

export function useSlots(date = null) {
  const { slots } = useAppState();

  if (date) {
    return slots.filter(slot => slot.date === date);
  }
  return slots;
}

export function useTags() {
  const { tags } = useAppState();
  return tags;
}

export function useTaskTypes() {
  const { taskTypes } = useAppState();
  return taskTypes;
}

export function useSchedules() {
  const { schedules, activeSchedule, activeScheduleId } = useAppState();
  return { schedules, activeSchedule, activeScheduleId };
}

export function useSettings() {
  const { settings } = useAppState();
  const dispatch = useAppReducer();

  const updateSettings = useCallback((updates) => {
    dispatch({ type: ACTION_TYPES.UPDATE_SETTINGS, payload: updates });
  }, [dispatch]);

  return [settings, updateSettings];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getEntityTypeFromAction(actionType) {
  if (actionType.includes('TASK') || actionType.includes('ITEM')) return ENTITY_TYPES.TASK;
  if (actionType.includes('SLOT')) return ENTITY_TYPES.SLOT;
  if (actionType.includes('TAG')) return ENTITY_TYPES.TAG;
  if (actionType.includes('TYPE')) return ENTITY_TYPES.TASK_TYPE;
  if (actionType.includes('SCHEDULE')) return ENTITY_TYPES.SCHEDULE;
  return ENTITY_TYPES.TASK;
}

function getAuditActionFromAction(actionType) {
  if (actionType.includes('ADD') || actionType.includes('CREATE')) return AUDIT_ACTIONS.CREATE;
  if (actionType.includes('UPDATE')) return AUDIT_ACTIONS.UPDATE;
  if (actionType.includes('DELETE')) return AUDIT_ACTIONS.DELETE;
  if (actionType.includes('COMPLETE')) return AUDIT_ACTIONS.TASK_COMPLETE;
  if (actionType.includes('PAUSE')) return AUDIT_ACTIONS.TASK_PAUSE;
  if (actionType.includes('RESUME')) return AUDIT_ACTIONS.TASK_RESUME;
  if (actionType.includes('APPLY')) return AUDIT_ACTIONS.SCHEDULE_APPLY;
  return AUDIT_ACTIONS.UPDATE;
}

function getEntitySnapshotForAction(state, entityType, payload) {
  const entityId = getEntityIdFromPayload(payload);
  const collection = getCollectionForEntityType(state, entityType);
  const previousState = entityId
    ? collection.find(entity => matchesEntityId(entity, entityId)) || null
    : null;

  return {
    entityId: entityId || previousState?.id || previousState?.key || null,
    entityName:
      payload.text ||
      payload.name ||
      payload.label ||
      payload.schedule?.name ||
      previousState?.text ||
      previousState?.name ||
      previousState?.label ||
      null,
    previousState
  };
}

function getCollectionForEntityType(state, entityType) {
  switch (entityType) {
    case ENTITY_TYPES.TASK:
      return state.tasks || [];
    case ENTITY_TYPES.SLOT:
      return state.slots || [];
    case ENTITY_TYPES.TAG:
      return state.tags || [];
    case ENTITY_TYPES.TASK_TYPE:
      return state.taskTypes || [];
    case ENTITY_TYPES.SCHEDULE:
      return state.schedules || [];
    default:
      return [];
  }
}

function getEntityIdFromPayload(payload = {}) {
  return (
    payload.id ||
    payload.key ||
    payload.taskId ||
    payload.slotId ||
    payload.tagId ||
    payload.scheduleId ||
    payload.schedule?.id ||
    null
  );
}

function matchesEntityId(entity, targetId) {
  if (!entity || !targetId) return false;
  return (
    entity.id?.toString() === targetId.toString() ||
    entity.key?.toString() === targetId.toString()
  );
}

function isDeleteAction(actionType) {
  return actionType.includes('DELETE');
}

export default AppContext;
