import { addMinutes, isSameDay, format } from 'date-fns';
import { toLocalTime, toUTCFromLocal } from './timeDisplay.js';

// Constants for scheduling
const WORK_DAY_START = 9; // 9 AM
const WORK_DAY_END = 17; // 5 PM
const MIN_SLOT_SIZE = 30; // 30 minutes

// Debug logging flag - set to true to enable comprehensive logging
const DEBUG_SCHEDULING = true;

// Helper function for consistent debug logging
function debugLog(category, message, data = null) {
  if (!DEBUG_SCHEDULING) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[SCHEDULER:${category}]`;
  
  if (data) {
    console.log(`${timestamp} ${prefix} ${message}`, data);
  } else {
    console.log(`${timestamp} ${prefix} ${message}`);
  }
}

// Assertion helper for runtime validation
function assertValidDate(date, context) {
  if (!(date instanceof Date) || isNaN(date)) {
    console.error(`[SCHEDULER:ASSERTION] Invalid date in context: ${context}`, date);
    throw new Error(`Invalid date in ${context}: ${date}`);
  }
  return true;
}

// Verify timezone consistency
function assertTimezoneConsistency(isoString, localString, context) {
  if (!DEBUG_SCHEDULING) return;
  
  const utcDate = new Date(isoString);
  const localConverted = toLocalTime(isoString);
  
  debugLog('TIMEZONE_CHECK', `${context} - UTC: ${utcDate.toISOString()} | Local: ${localConverted}`);
}

/**
 * Finds the first available time slot for a task
 * @param {Object} task - The task to schedule
 * @param {Array} existingItems - List of already scheduled items
 * @param {Array} taskTypes - List of task types with their constraints
 * @param {Date} startFrom - The date to start searching from
 * @returns {Date} The start time for the task
 */
export function findFirstAvailableSlot(task, existingItems, taskTypes, startFrom = new Date()) {
  debugLog('FIND_SLOT:START', `Finding slot for task: ${task.name || task.id}`, {
    taskId: task.id,
    taskName: task.name,
    specificDay: task.specificDay,
    specificTime: task.specificTime,
    schedulingPreference: task.schedulingPreference,
    delayMinutes: task.delayMinutes,
    duration: task.duration,
    priority: task.priority
  });
  
  const taskType = taskTypes.find(t => t.id === task.taskType);
  if (!taskType) {
    debugLog('FIND_SLOT:ERROR', `No task type found for ID: ${task.taskType}`);
    return null;
  }
  
  debugLog('FIND_SLOT:TYPE', `Task type found: ${taskType.name}`, {
    allowedDays: taskType.allowedDays,
    constraints: taskType.constraints
  });

  // If specific day is requested, use that as the start date
  let searchStart;
  if (task.specificDay) {
    debugLog('FIND_SLOT:SPECIFIC_DAY', `Task has specific day: ${task.specificDay}`);
    
    // If specific time is also provided, combine date and time properly
    if (task.specificTime) {
      debugLog('FIND_SLOT:SPECIFIC_TIME', `Task has specific time: ${task.specificTime}`);
      
      // Create a proper UTC time from the local date and time
      const utcString = toUTCFromLocal(task.specificDay, task.specificTime);
      searchStart = new Date(utcString);
      
      debugLog('FIND_SLOT:UTC_CONVERSION', 'Converted to UTC', {
        input: { date: task.specificDay, time: task.specificTime },
        utcString,
        searchStart: searchStart.toISOString(),
        localCheck: toLocalTime(searchStart.toISOString())
      });
      
      assertTimezoneConsistency(searchStart.toISOString(), `${task.specificDay} ${task.specificTime}`, 'specific date/time');
    } else {
      // Use the date with default work start time, properly converted to UTC
      const defaultTime = `${WORK_DAY_START.toString().padStart(2, '0')}:00`;
      debugLog('FIND_SLOT:DEFAULT_TIME', `Using default work start time: ${defaultTime}`);
      
      const utcString = toUTCFromLocal(task.specificDay, defaultTime);
      searchStart = new Date(utcString);
      
      debugLog('FIND_SLOT:UTC_CONVERSION', 'Converted to UTC with default time', {
        input: { date: task.specificDay, time: defaultTime },
        utcString,
        searchStart: searchStart.toISOString(),
        localCheck: toLocalTime(searchStart.toISOString())
      });
      
      assertTimezoneConsistency(searchStart.toISOString(), `${task.specificDay} ${defaultTime}`, 'specific date with default time');
    }
  } else {
    searchStart = startFrom;
    debugLog('FIND_SLOT:NO_SPECIFIC', `Using provided start time: ${searchStart.toISOString()}`);
  }
  
  assertValidDate(searchStart, 'searchStart after initial setup');
  
  // If delay is requested, add it to the start time
  if (task.schedulingPreference === 'delay' && task.delayMinutes) {
    const beforeDelay = searchStart.toISOString();
    searchStart.setTime(searchStart.getTime() + task.delayMinutes * 60000);
    
    debugLog('FIND_SLOT:DELAY', `Applied delay of ${task.delayMinutes} minutes`, {
      before: beforeDelay,
      after: searchStart.toISOString(),
      delayMinutes: task.delayMinutes
    });
    
    assertValidDate(searchStart, 'searchStart after delay');
  }

  let currentDate = new Date(searchStart);
  let attempts = 0;
  const maxAttempts = 14; // Search up to 2 weeks ahead
  
  debugLog('FIND_SLOT:SEARCH', `Starting search from ${currentDate.toISOString()}`);

  while (attempts < maxAttempts) {
    // Check if this day is allowed for this task type
    const dayName = format(currentDate, 'EEEE');
    
    debugLog('FIND_SLOT:DAY_CHECK', `Attempt ${attempts + 1}: Checking ${dayName}`, {
      currentDate: currentDate.toISOString(),
      localDate: toLocalTime(currentDate.toISOString()),
      allowedDays: taskType.allowedDays,
      isAllowed: taskType.allowedDays.includes(dayName)
    });
    
    if (taskType.allowedDays.includes(dayName)) {
      // For immediate scheduling, use current time if we're on the first attempt
      // For specific day/time scheduling, time is already set
      if (task.schedulingPreference === 'immediate' && attempts === 0) {
        // For immediate scheduling, use the actual current time
        const now = new Date();
        const beforeChange = currentDate.toISOString();
        // Replace currentDate with actual current time to avoid timezone issues
        currentDate = new Date(now);
        
        debugLog('FIND_SLOT:IMMEDIATE', 'Using current time for immediate scheduling', {
          now: now.toISOString(),
          before: beforeChange,
          after: currentDate.toISOString(),
          localTime: toLocalTime(currentDate.toISOString())
        });
      } else if (task.specificDay && task.specificTime && attempts === 0) {
        // Time is already set from specificTime, don't change it
        debugLog('FIND_SLOT:KEEP_TIME', 'Keeping specific time from task', {
          currentDate: currentDate.toISOString(),
          localTime: toLocalTime(currentDate.toISOString())
        });
      } else if (attempts > 0) {
        // Start from work day start for subsequent attempts
        const beforeChange = currentDate.toISOString();
        // Create a new date for the current day at work start time
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = currentDate.getDate();
        currentDate = new Date(year, month, date, WORK_DAY_START, 0, 0, 0);
        
        debugLog('FIND_SLOT:WORK_START', `Moving to work day start (attempt ${attempts + 1})`, {
          before: beforeChange,
          after: currentDate.toISOString(),
          workDayStart: WORK_DAY_START,
          localTime: toLocalTime(currentDate.toISOString())
        });
      }

      let slotsChecked = 0;
      while (currentDate.getHours() < WORK_DAY_END) {
        const slotEnd = addMinutes(currentDate, task.duration);
        slotsChecked++;
        
        debugLog('FIND_SLOT:SLOT_CHECK', `Checking slot ${slotsChecked}`, {
          slotStart: currentDate.toISOString(),
          slotEnd: slotEnd.toISOString(),
          localStart: toLocalTime(currentDate.toISOString()),
          localEnd: toLocalTime(slotEnd.toISOString()),
          duration: task.duration
        });
        
        // Check if slot end is within work hours
        if (slotEnd.getHours() >= WORK_DAY_END) {
          debugLog('FIND_SLOT:WORK_END', 'Slot extends beyond work hours', {
            slotEndHour: slotEnd.getHours(),
            workDayEnd: WORK_DAY_END
          });
          break; // Move to next day
        }

        // Check for conflicts with existing tasks
        const conflicts = [];
        const hasConflict = existingItems.some(item => {
          if (item.status === 'completed' || !item.scheduledTime) return false;

          // Ensure we're comparing times properly (both should be in same timezone context)
          const itemStart = new Date(item.scheduledTime);
          const itemEnd = addMinutes(itemStart, item.duration);

          // Check if there's any overlap
          const overlaps = (currentDate < itemEnd && slotEnd > itemStart);
          
          if (overlaps) {
            conflicts.push({
              itemName: item.name || item.id,
              itemStart: itemStart.toISOString(),
              itemEnd: itemEnd.toISOString(),
              localStart: toLocalTime(itemStart.toISOString()),
              localEnd: toLocalTime(itemEnd.toISOString())
            });
          }
          
          return overlaps;
        });
        
        if (hasConflict) {
          debugLog('FIND_SLOT:CONFLICT', `Slot has ${conflicts.length} conflict(s)`, conflicts);
        }

        if (!hasConflict) {
          debugLog('FIND_SLOT:SUCCESS', '✅ Found available slot!', {
            slotStart: currentDate.toISOString(),
            localStart: toLocalTime(currentDate.toISOString()),
            slotEnd: slotEnd.toISOString(),
            localEnd: toLocalTime(slotEnd.toISOString()),
            attemptsNeeded: attempts + 1,
            slotsChecked
          });
          
          assertValidDate(currentDate, 'final slot found');
          return currentDate;
        }

        // Move to next slot
        currentDate = addMinutes(currentDate, MIN_SLOT_SIZE);
      }
    }

    // Move to next day
    const beforeNextDay = currentDate.toISOString();
    // Create a new date for the next day at work start time
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    currentDate = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), WORK_DAY_START, 0, 0, 0);
    attempts++;
    
    debugLog('FIND_SLOT:NEXT_DAY', `Moving to next day (attempt ${attempts + 1}/${maxAttempts})`, {
      before: beforeNextDay,
      after: currentDate.toISOString(),
      localDate: toLocalTime(currentDate.toISOString())
    });
  }

  debugLog('FIND_SLOT:FAILED', '❌ No available slot found within search period', {
    maxAttempts,
    lastCheckedDate: currentDate.toISOString()
  });
  
  return null; // No slot found within the search period
}

/**
 * Checks if a proposed schedule has any conflicts
 * @param {Date} startTime - Proposed start time
 * @param {number} duration - Task duration in minutes
 * @param {Array} existingItems - List of already scheduled items
 * @returns {boolean} True if there are conflicts
 */
export function hasSchedulingConflicts(startTime, duration, existingItems) {
  const endTime = addMinutes(startTime, duration);

  return existingItems.some(item => {
    if (item.status === 'completed' || !item.scheduledTime) return false;

    // Ensure proper comparison of UTC times
    const itemStart = new Date(item.scheduledTime);
    const itemEnd = addMinutes(itemStart, item.duration);

    return (startTime < itemEnd && endTime > itemStart);
  });
}

/**
 * Gets the priority level as a number for sorting
 * @param {string} priority - Priority level (low, medium, high)
 * @returns {number} Priority value (1 for low, 2 for medium, 3 for high)
 */
export function getPriorityValue(priority) {
  switch (priority.toLowerCase()) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

/**
 * Schedules a batch of tasks, respecting priorities
 * @param {Array} tasks - List of tasks to schedule
 * @param {Array} existingItems - List of already scheduled items
 * @param {Array} taskTypes - List of task types
 * @returns {Array} List of scheduled tasks
 */
export function scheduleTasks(tasks, existingItems, taskTypes) {
  // Sort tasks by priority (high to low)
  const sortedTasks = [...tasks].sort((a, b) => {
    return getPriorityValue(b.priority) - getPriorityValue(a.priority);
  });

  const scheduledTasks = [];
  const failedToSchedule = [];

  for (const task of sortedTasks) {
    // For tasks with specific days, respect that
    let startDate;
    if (task.specificDay) {
      // Use toUTCFromLocal to properly handle timezone conversion
      const defaultTime = `${WORK_DAY_START.toString().padStart(2, '0')}:00`;
      const utcString = toUTCFromLocal(task.specificDay, defaultTime);
      startDate = new Date(utcString);
    } else {
      startDate = new Date();
    }
    
    const slot = findFirstAvailableSlot(
      task,
      [...existingItems, ...scheduledTasks],
      taskTypes,
      startDate
    );

    if (slot) {
      scheduledTasks.push({
        ...task,
        scheduledTime: slot.toISOString(),
      });
    } else {
      failedToSchedule.push(task);
    }
  }

  return {
    scheduled: scheduledTasks,
    unscheduled: failedToSchedule,
  };
}
