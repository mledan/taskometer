import { parseTime } from './scheduleTemplates';
import { addMinutes, addDays, isAfter, isBefore } from 'date-fns';

/**
 * Intelligent Task Routing System
 * Automatically assigns tasks to appropriate time blocks based on activity type
 */

export function findOptimalTimeSlot(task, activeSchedule, existingTasks = []) {
  if (!activeSchedule || !activeSchedule.timeBlocks) {
    return null;
  }

  const now = new Date();
  const taskActivityType = task.primaryType || task.taskType || task.activityType || 'buffer';
  const taskDuration = task.duration || 30; // minutes
  const preferredDateTime = getPreferredDateTime(task, now);

  if (preferredDateTime) {
    const preferredEnd = addMinutes(preferredDateTime, taskDuration);
    const hasConflict = hasTaskConflict(preferredDateTime, preferredEnd, existingTasks);
    if (!hasConflict) {
      return createScheduledResult(preferredDateTime, null, 100);
    }
  }

  // Find all time blocks that match the task's activity type.
  // Enhanced templates often use category IDs in `type` and map to task types
  // through `allowedTaskTypes`.
  const matchingBlocks = activeSchedule.timeBlocks.filter(block =>
    block.type === taskActivityType ||
    block.category === taskActivityType ||
    (Array.isArray(block.allowedTaskTypes) && block.allowedTaskTypes.includes(taskActivityType))
  );

  if (matchingBlocks.length === 0) {
    // No matching blocks, try buffer time
    const bufferBlocks = activeSchedule.timeBlocks.filter(block => 
      block.type === 'buffer'
    );
    if (bufferBlocks.length > 0) {
      matchingBlocks.push(...bufferBlocks);
    } else {
      return null; // No suitable blocks found
    }
  }

  // Sort blocks by start time
  matchingBlocks.sort((a, b) => {
    const timeA = parseTime(a.start);
    const timeB = parseTime(b.start);
    return timeA - timeB;
  });

  // Try to find an available slot in each matching block
  for (const block of matchingBlocks) {
    const { blockStart, blockEnd } = getNextBlockWindow(block, now);
    
    // Skip blocks that are in the past
    if (isAfter(now, blockEnd)) {
      continue;
    }

    // Start from current time if block has already started
    let slotStart = isAfter(now, blockStart) ? new Date(now) : new Date(blockStart);
    
    // Round to next 15-minute interval for cleaner scheduling
    const minutes = slotStart.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    slotStart.setMinutes(roundedMinutes, 0, 0);

    // Check if the task fits in this block
    const slotEnd = addMinutes(slotStart, taskDuration);
    if (isAfter(slotEnd, blockEnd)) {
      continue; // Task doesn't fit in this block
    }

    // Check for conflicts with existing tasks
    const hasConflict = hasTaskConflict(slotStart, slotEnd, existingTasks);

    if (!hasConflict) {
      return createScheduledResult(slotStart, block, calculateConfidence(task, block));
    }

    // Try to find next available slot within this block
    let nextSlot = slotStart;
    while (isBefore(nextSlot, blockEnd)) {
      nextSlot = addMinutes(nextSlot, 15); // Check every 15 minutes
      const nextSlotEnd = addMinutes(nextSlot, taskDuration);
      
      if (isAfter(nextSlotEnd, blockEnd)) {
        break; // Doesn't fit
      }

      const hasNextConflict = hasTaskConflict(nextSlot, nextSlotEnd, existingTasks);

      if (!hasNextConflict) {
        return createScheduledResult(nextSlot, block, calculateConfidence(task, block));
      }
    }
  }

  return null; // No available slot found
}

/**
 * Calculate confidence score for task-to-block assignment
 */
function calculateConfidence(task, block) {
  let confidence = 0;
  
  // Exact type match
  if (task.taskType === block.type) {
    confidence += 50;
  }
  
  // Priority bonus
  if (task.priority === 'high') {
    confidence += 20;
  } else if (task.priority === 'medium') {
    confidence += 10;
  }
  
  // Duration fit (task fits comfortably in block)
  const blockDuration = getBlockDurationMinutes(block);
  const taskDuration = task.duration || 30;
  if (taskDuration <= blockDuration * 0.5) {
    confidence += 20; // Task takes less than half the block
  } else if (taskDuration <= blockDuration * 0.75) {
    confidence += 10; // Task takes less than 3/4 of the block
  }
  
  return confidence;
}

function getNextBlockWindow(block, referenceTime) {
  let blockStart = parseTime(block.start);
  let blockEnd = parseTime(block.end);

  // Handle overnight blocks like 22:00 -> 06:30
  if (blockEnd <= blockStart) {
    blockEnd = addDays(blockEnd, 1);
  }

  // If today's occurrence is over, move to next day.
  if (blockEnd <= referenceTime) {
    blockStart = addDays(blockStart, 1);
    blockEnd = addDays(blockEnd, 1);
  }

  return { blockStart, blockEnd };
}

function getBlockDurationMinutes(block) {
  const start = parseTime(block.start);
  let end = parseTime(block.end);
  if (end <= start) {
    end = addDays(end, 1);
  }
  return (end - start) / 60000;
}

function createScheduledResult(startDate, block, confidence) {
  return {
    scheduledFor: startDate.toISOString(),
    scheduledTime: startDate.toISOString(), // Legacy compatibility
    specificTime: to24HourTime(startDate),
    specificDay: startDate.toLocaleDateString('en-US', { weekday: 'long' }),
    timeBlock: block,
    confidence
  };
}

function hasTaskConflict(slotStart, slotEnd, existingTasks = []) {
  return existingTasks.some(existingTask => {
    if (!existingTask?.scheduledTime || existingTask.status === 'completed') {
      return false;
    }

    const existingStart = new Date(existingTask.scheduledTime);
    const existingEnd = addMinutes(existingStart, existingTask.duration || 30);

    return slotStart < existingEnd && slotEnd > existingStart;
  });
}

function getPreferredDateTime(task, now) {
  if (task?.schedulingPreference === 'delay' && Number(task.delayMinutes) > 0) {
    return addMinutes(new Date(now), Number(task.delayMinutes));
  }

  if (task?.schedulingPreference !== 'specific') {
    return null;
  }

  const date = resolvePreferredDate(task.specificDay, now);
  const dateTime = applyPreferredTime(date, task.specificTime);

  // If a specific datetime was picked in the past, roll forward.
  // Weekday picks should stay on that weekday (next week), while date picks
  // move one day forward to keep the intent as "next available".
  if (dateTime <= now) {
    if (isWeekdayLabel(task.specificDay)) {
      return addDays(dateTime, 7);
    }
    return addDays(dateTime, 1);
  }
  return dateTime;
}

function resolvePreferredDate(specificDay, now) {
  const base = new Date(now);
  base.setSeconds(0, 0);

  if (!specificDay) return base;

  if (/^\d{4}-\d{2}-\d{2}$/.test(specificDay)) {
    const parsed = new Date(`${specificDay}T00:00:00`);
    if (!isNaN(parsed.getTime())) {
      parsed.setSeconds(0, 0);
      return parsed;
    }
  }

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetIndex = weekdays.findIndex(day => day.toLowerCase() === String(specificDay).toLowerCase());
  if (targetIndex === -1) return base;

  const currentIndex = base.getDay();
  let delta = targetIndex - currentIndex;
  if (delta < 0) delta += 7;

  const result = addDays(base, delta);
  result.setSeconds(0, 0);
  return result;
}

function applyPreferredTime(date, specificTime) {
  const result = new Date(date);
  const [hours, minutes] = parseTimeString(specificTime);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function parseTimeString(value) {
  if (!value || typeof value !== 'string') return [9, 0];
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return [9, 0];
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return [hours, minutes];
}

function to24HourTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isWeekdayLabel(value) {
  if (!value || typeof value !== 'string') return false;
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .includes(value.toLowerCase());
}

/**
 * Batch schedule multiple tasks intelligently
 */
export function batchScheduleTasks(tasks, activeSchedule, existingTasks = []) {
  if (!activeSchedule) {
    return tasks.map(task => ({ ...task, scheduledTime: null }));
  }

  // Sort tasks by priority and duration
  const sortedTasks = [...tasks].sort((a, b) => {
    // High priority first
    const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Shorter tasks first (easier to fit)
    return (a.duration || 30) - (b.duration || 30);
  });

  const scheduledTasks = [];
  const allScheduledItems = [...existingTasks];

  for (const task of sortedTasks) {
    const slot = findOptimalTimeSlot(task, activeSchedule, allScheduledItems);
    
    if (slot) {
      const scheduledTask = {
        ...task,
        scheduledTime: slot.scheduledTime,
        scheduledFor: slot.scheduledFor,
        specificTime: slot.specificTime,
        specificDay: slot.specificDay,
        assignedBlock: slot.timeBlock,
        confidence: slot.confidence
      };
      scheduledTasks.push(scheduledTask);
      allScheduledItems.push(scheduledTask);
    } else {
      // Couldn't schedule this task
      scheduledTasks.push({
        ...task,
        scheduledTime: null,
        failureReason: 'No available time slot found'
      });
    }
  }

  return scheduledTasks;
}

function getPriorityValue(priority) {
  switch ((priority || 'medium').toLowerCase()) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 2;
  }
}

/**
 * Get schedule utilization statistics
 */
export function getScheduleUtilization(activeSchedule, tasks) {
  if (!activeSchedule || !activeSchedule.timeBlocks) {
    return null;
  }

  const stats = {};
  
  // Initialize stats for each activity type
  activeSchedule.timeBlocks.forEach(block => {
    if (!stats[block.type]) {
      stats[block.type] = {
        totalMinutes: 0,
        scheduledMinutes: 0,
        utilization: 0,
        taskCount: 0
      };
    }
    
    const blockDuration = getBlockDurationMinutes(block);
    stats[block.type].totalMinutes += blockDuration;
  });

  // Calculate scheduled time
  tasks.forEach(task => {
    if (task.scheduledTime && task.status !== 'completed') {
      const type = task.taskType || 'buffer';
      if (stats[type]) {
        stats[type].scheduledMinutes += (task.duration || 30);
        stats[type].taskCount++;
      }
    }
  });

  // Calculate utilization percentages
  Object.keys(stats).forEach(type => {
    if (stats[type].totalMinutes > 0) {
      stats[type].utilization = Math.round(
        (stats[type].scheduledMinutes / stats[type].totalMinutes) * 100
      );
    }
  });

  return stats;
}

/**
 * Suggest best time for a new task based on current schedule
 */
export function suggestBestTime(taskType, duration, activeSchedule, existingTasks) {
  const mockTask = {
    taskType,
    duration,
    priority: 'medium'
  };

  const slot = findOptimalTimeSlot(mockTask, activeSchedule, existingTasks);
  
  if (slot) {
    return {
      time: new Date(slot.scheduledTime),
      block: slot.timeBlock,
      confidence: slot.confidence,
      available: true
    };
  }

  return {
    available: false,
    suggestion: 'No available slots found. Consider adjusting your schedule or task duration.'
  };
}

/**
 * Reschedule a task to next available slot
 */
export function rescheduleTask(task, activeSchedule, existingTasks) {
  // Remove the task from existing items to avoid self-conflict
  const otherTasks = existingTasks.filter(t => t.key !== task.key);
  
  // Find new slot
  const slot = findOptimalTimeSlot(task, activeSchedule, otherTasks);
  
  if (slot) {
    return {
      ...task,
      scheduledTime: slot.scheduledTime,
      rescheduledAt: new Date().toISOString()
    };
  }
  
  return null;
}
