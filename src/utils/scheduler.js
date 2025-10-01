import { addMinutes, isSameDay, format } from 'date-fns';
import { toLocalTime, toUTCFromLocal } from './timeDisplay.js';

// Constants for scheduling
const WORK_DAY_START = 9; // 9 AM
const WORK_DAY_END = 17; // 5 PM
const MIN_SLOT_SIZE = 30; // 30 minutes

/**
 * Finds the first available time slot for a task
 * @param {Object} task - The task to schedule
 * @param {Array} existingItems - List of already scheduled items
 * @param {Array} taskTypes - List of task types with their constraints
 * @param {Date} startFrom - The date to start searching from
 * @returns {Date} The start time for the task
 */
export function findFirstAvailableSlot(task, existingItems, taskTypes, startFrom = new Date()) {
  const taskType = taskTypes.find(t => t.id === task.taskType);
  if (!taskType) return null;

  // If specific day is requested, use that as the start date
  let searchStart;
  if (task.specificDay) {
    // If specific time is also provided, combine date and time properly
    if (task.specificTime) {
      // Create a proper UTC time from the local date and time
      const utcString = toUTCFromLocal(task.specificDay, task.specificTime);
      searchStart = new Date(utcString);
    } else {
      // Just use the date with default time
      searchStart = new Date(task.specificDay);
      searchStart.setHours(WORK_DAY_START, 0, 0, 0);
    }
  } else {
    searchStart = startFrom;
  }
  
  // If delay is requested, add it to the start time
  if (task.schedulingPreference === 'delay' && task.delayMinutes) {
    searchStart.setTime(searchStart.getTime() + task.delayMinutes * 60000);
  }

  let currentDate = new Date(searchStart);
  let attempts = 0;
  const maxAttempts = 14; // Search up to 2 weeks ahead

  while (attempts < maxAttempts) {
    // Check if this day is allowed for this task type
    const dayName = format(currentDate, 'EEEE');
    if (taskType.allowedDays.includes(dayName)) {
      // For immediate scheduling, use current time if we're on the first attempt
      // For specific day/time scheduling, time is already set
      if (task.schedulingPreference === 'immediate' && attempts === 0) {
        // Keep current time for immediate scheduling
        const now = new Date();
        currentDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
      } else if (task.specificDay && task.specificTime && attempts === 0) {
        // Time is already set from specificTime, don't change it
      } else if (attempts > 0) {
        // Start from work day start for subsequent attempts
        currentDate.setHours(WORK_DAY_START, 0, 0, 0);
      }

      while (currentDate.getHours() < WORK_DAY_END) {
        const slotEnd = addMinutes(currentDate, task.duration);
        
        // Check if slot end is within work hours
        if (slotEnd.getHours() >= WORK_DAY_END) {
          break; // Move to next day
        }

        // Check for conflicts with existing tasks
        const hasConflict = existingItems.some(item => {
          if (item.status === 'completed' || !item.scheduledTime) return false;

          // Ensure we're comparing times properly (both should be in same timezone context)
          const itemStart = new Date(item.scheduledTime);
          const itemEnd = addMinutes(itemStart, item.duration);

          // Check if there's any overlap
          return (currentDate < itemEnd && slotEnd > itemStart);
        });

        if (!hasConflict) {
          return currentDate;
        }

        // Move to next slot
        currentDate = addMinutes(currentDate, MIN_SLOT_SIZE);
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    attempts++;
  }

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
    const startDate = task.specificDay ? new Date(task.specificDay) : new Date();
    
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
