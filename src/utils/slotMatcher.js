/**
 * Slot Matcher Utility
 *
 * Intelligent task-to-slot routing based on type and tag matching.
 * This is the core algorithm for auto-scheduling tasks into calendar slots.
 *
 * Priority Order:
 * 1. Exact type match (task.primaryType === slot.slotType)
 * 2. Tag match (any task.tag in slot.allowedTags)
 * 3. Flexible slot (slot.flexibility === 'flexible' or no restrictions)
 *
 * TODO: Future enhancements:
 * - Learning from user behavior (ML-based slot preferences)
 * - Consider task priority for slot allocation
 * - Energy level matching (high-energy tasks in morning, etc.)
 */

import {
  getSlotDuration,
  getSlotStartDateTime,
  getSlotEndDateTime,
  canAssignTaskToSlot,
  slotsOverlap,
  findAvailableSlotsForTask
} from '../models/CalendarSlot';

/**
 * Match score constants for ranking slots
 */
const MATCH_SCORES = {
  EXACT_TYPE_MATCH: 100,
  TAG_MATCH: 50,
  PREFERRED_TIME: 30,
  FLEXIBLE_SLOT: 10,
  BUFFER_SLOT: 5,
  DURATION_FIT_EXACT: 20,
  DURATION_FIT_GOOD: 10,
  FUTURE_PENALTY_PER_HOUR: -2,
  CONFLICT_PENALTY: -1000
};

/**
 * Find the optimal slot for a task
 * @param {Object} task - Task to schedule
 * @param {Object[]} slots - Available calendar slots
 * @param {Object[]} existingTasks - Already scheduled tasks (for conflict detection)
 * @param {Object} options - Additional options
 * @returns {{ slot: Object, score: number, reason: string } | null}
 */
export function findOptimalSlot(task, slots, existingTasks = [], options = {}) {
  const {
    dateFrom = new Date().toISOString().split('T')[0],
    dateTo = null,
    preferExactMatch = true,
    allowConflicts = false
  } = options;

  const taskType = task.primaryType || task.taskType || 'work';
  const taskTags = task.tags || [];
  const taskDuration = task.duration || 30;

  // Filter and score slots
  const scoredSlots = slots
    .filter(slot => {
      // Must be in date range
      if (slot.date < dateFrom) return false;
      if (dateTo && slot.date > dateTo) return false;

      // Must have enough duration
      const slotDuration = getSlotDuration(slot);
      if (slotDuration < taskDuration) return false;

      // Must be in the future
      const slotStart = getSlotStartDateTime(slot);
      if (slotStart <= new Date()) return false;

      // Must not already be assigned (unless we're rescheduling this task)
      if (slot.assignedTaskId && slot.assignedTaskId !== task.id) return false;

      return true;
    })
    .map(slot => {
      let score = 0;
      let reasons = [];

      // Check if assignment is allowed
      const { allowed, reason } = canAssignTaskToSlot(slot, task);
      if (!allowed) {
        return { slot, score: MATCH_SCORES.CONFLICT_PENALTY, reasons: [reason] };
      }

      // Type matching
      if (slot.slotType === taskType) {
        score += MATCH_SCORES.EXACT_TYPE_MATCH;
        reasons.push('Exact type match');
      } else if (slot.slotType === 'buffer') {
        score += MATCH_SCORES.BUFFER_SLOT;
        reasons.push('Buffer slot');
      } else if (!slot.slotType || slot.flexibility === 'flexible') {
        score += MATCH_SCORES.FLEXIBLE_SLOT;
        reasons.push('Flexible slot');
      }

      // Tag matching
      if (slot.allowedTags && slot.allowedTags.length > 0 && taskTags.length > 0) {
        const matchingTags = taskTags.filter(tag => slot.allowedTags.includes(tag));
        if (matchingTags.length > 0) {
          score += MATCH_SCORES.TAG_MATCH * matchingTags.length;
          reasons.push(`Tag match: ${matchingTags.join(', ')}`);
        }
      }

      // Duration fit
      const slotDuration = getSlotDuration(slot);
      if (slotDuration === taskDuration) {
        score += MATCH_SCORES.DURATION_FIT_EXACT;
        reasons.push('Perfect duration fit');
      } else if (slotDuration <= taskDuration * 1.5) {
        score += MATCH_SCORES.DURATION_FIT_GOOD;
        reasons.push('Good duration fit');
      }

      // Prefer earlier slots (less future penalty)
      const hoursInFuture = (getSlotStartDateTime(slot) - new Date()) / (1000 * 60 * 60);
      score += MATCH_SCORES.FUTURE_PENALTY_PER_HOUR * Math.floor(hoursInFuture / 24);

      // Check for conflicts with existing tasks
      if (!allowConflicts) {
        const hasConflict = checkSlotConflict(slot, existingTasks, task.id);
        if (hasConflict) {
          score += MATCH_SCORES.CONFLICT_PENALTY;
          reasons.push('Conflict with existing task');
        }
      }

      return {
        slot,
        score,
        reasons
      };
    })
    .filter(result => result.score > MATCH_SCORES.CONFLICT_PENALTY)
    .sort((a, b) => b.score - a.score);

  if (scoredSlots.length === 0) {
    return null;
  }

  const best = scoredSlots[0];
  return {
    slot: best.slot,
    score: best.score,
    reason: best.reasons.join('; ')
  };
}

/**
 * Check if a slot conflicts with existing scheduled tasks
 * @param {Object} slot
 * @param {Object[]} existingTasks
 * @param {string} excludeTaskId - Task ID to exclude from conflict check (e.g., when rescheduling)
 * @returns {boolean}
 */
export function checkSlotConflict(slot, existingTasks, excludeTaskId = null) {
  const slotStart = getSlotStartDateTime(slot);
  const slotEnd = getSlotEndDateTime(slot);

  return existingTasks.some(task => {
    // Skip the task we're scheduling
    if (excludeTaskId && (task.id === excludeTaskId || task.key?.toString() === excludeTaskId)) {
      return false;
    }

    // Skip unscheduled or completed tasks
    if (!task.scheduledTime || task.status === 'completed') {
      return false;
    }

    const taskStart = new Date(task.scheduledTime);
    const taskEnd = new Date(taskStart.getTime() + (task.duration || 30) * 60000);

    // Check for overlap
    return taskStart < slotEnd && taskEnd > slotStart;
  });
}

/**
 * Batch match tasks to slots
 * @param {Object[]} tasks - Tasks to schedule
 * @param {Object[]} slots - Available slots
 * @param {Object[]} existingTasks - Already scheduled tasks
 * @param {Object} options
 * @returns {Object[]} Array of { task, slot, score, reason } or { task, unscheduled: true, reason }
 */
export function batchMatchTasksToSlots(tasks, slots, existingTasks = [], options = {}) {
  const results = [];
  const usedSlots = new Set();
  const scheduledTasks = [...existingTasks];

  // Sort tasks by priority (high priority first)
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityA = priorityOrder[a.priority] ?? 2;
    const priorityB = priorityOrder[b.priority] ?? 2;
    return priorityA - priorityB;
  });

  for (const task of sortedTasks) {
    // Filter out already-used slots
    const availableSlots = slots.filter(s => !usedSlots.has(s.id));

    const match = findOptimalSlot(task, availableSlots, scheduledTasks, options);

    if (match) {
      usedSlots.add(match.slot.id);
      scheduledTasks.push({
        ...task,
        scheduledTime: getSlotStartDateTime(match.slot).toISOString()
      });
      results.push({
        task,
        slot: match.slot,
        score: match.score,
        reason: match.reason
      });
    } else {
      results.push({
        task,
        unscheduled: true,
        reason: 'No suitable slot found'
      });
    }
  }

  return results;
}

/**
 * Generate slots from a schedule template for a date range
 * @param {Object} schedule - Schedule template
 * @param {string} dateFrom - Start date YYYY-MM-DD
 * @param {string} dateTo - End date YYYY-MM-DD
 * @param {Object} options
 * @returns {Object[]} Generated slots
 */
export function generateSlotsFromSchedule(schedule, dateFrom, dateTo, options = {}) {
  const {
    categories = null, // If set, only include blocks from these categories
    blockIds = null,   // If set, only include these specific blocks
    daysOfWeek = null  // If set, only generate for these days (e.g., ['Monday', 'Wednesday'])
  } = options;

  const slots = [];
  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);

  // Filter blocks based on options
  let blocks = schedule.timeBlocks || [];
  if (categories) {
    blocks = blocks.filter(b => categories.includes(b.category));
  }
  if (blockIds) {
    blocks = blocks.filter(b => blockIds.includes(b.id));
  }

  // Iterate through date range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

    // Check if this day should be included
    if (daysOfWeek && !daysOfWeek.includes(dayName)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check if blocks apply to this day
    const applicableBlocks = blocks.filter(block => {
      if (block.day) {
        return block.day.toLowerCase() === dayName.toLowerCase();
      }
      if (block.days) {
        return block.days.some(d => d.toLowerCase() === dayName.toLowerCase());
      }
      return true; // No day restriction = applies to all days
    });

    // Create slots for each applicable block
    for (const block of applicableBlocks) {
      const dateStr = currentDate.toISOString().split('T')[0];

      slots.push({
        date: dateStr,
        startTime: block.start,
        endTime: block.end,
        slotType: block.type,
        allowedTags: block.allowedTags || [],
        label: block.label || `${block.type} block`,
        description: block.description,
        color: block.color,
        flexibility: block.flexibility || 'preferred',
        sourceScheduleId: schedule.id,
        sourceBlockId: block.id,
        isRecurring: false
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Analyze slot utilization for a date range
 * @param {Object[]} slots
 * @param {Object[]} tasks
 * @param {string} dateFrom
 * @param {string} dateTo
 * @returns {Object} Utilization statistics
 */
export function analyzeSlotUtilization(slots, tasks, dateFrom, dateTo) {
  const stats = {
    totalSlots: 0,
    usedSlots: 0,
    emptySlots: 0,
    totalSlotMinutes: 0,
    usedMinutes: 0,
    utilizationPercent: 0,
    byType: {},
    byDay: {}
  };

  const relevantSlots = slots.filter(s => s.date >= dateFrom && s.date <= dateTo);

  for (const slot of relevantSlots) {
    stats.totalSlots++;
    const duration = getSlotDuration(slot);
    stats.totalSlotMinutes += duration;

    const isUsed = slot.assignedTaskId || tasks.some(task => {
      if (!task.scheduledTime) return false;
      const taskStart = new Date(task.scheduledTime);
      const slotStart = getSlotStartDateTime(slot);
      const slotEnd = getSlotEndDateTime(slot);
      return taskStart >= slotStart && taskStart < slotEnd;
    });

    if (isUsed) {
      stats.usedSlots++;
      stats.usedMinutes += duration;
    } else {
      stats.emptySlots++;
    }

    // By type
    const type = slot.slotType || 'flexible';
    if (!stats.byType[type]) {
      stats.byType[type] = { total: 0, used: 0, minutes: 0 };
    }
    stats.byType[type].total++;
    stats.byType[type].minutes += duration;
    if (isUsed) stats.byType[type].used++;

    // By day
    if (!stats.byDay[slot.date]) {
      stats.byDay[slot.date] = { total: 0, used: 0, minutes: 0 };
    }
    stats.byDay[slot.date].total++;
    stats.byDay[slot.date].minutes += duration;
    if (isUsed) stats.byDay[slot.date].used++;
  }

  stats.utilizationPercent = stats.totalSlotMinutes > 0
    ? Math.round((stats.usedMinutes / stats.totalSlotMinutes) * 100)
    : 0;

  return stats;
}

/**
 * Suggest optimal slots for a task type based on historical data
 * @param {string} taskType
 * @param {Object[]} completedTasks - Historical completed tasks
 * @param {Object[]} slots - Available slots
 * @returns {Object[]} Sorted slots by historical success
 */
export function suggestSlotsByHistory(taskType, completedTasks, slots) {
  // Analyze when this task type was most often completed
  const hourCounts = {};
  const dayOfWeekCounts = {};

  completedTasks
    .filter(t => (t.primaryType || t.taskType) === taskType && t.completedAt)
    .forEach(task => {
      const completedDate = new Date(task.completedAt);
      const hour = completedDate.getHours();
      const dayOfWeek = completedDate.toLocaleDateString('en-US', { weekday: 'long' });

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
    });

  // Score slots based on historical patterns
  return slots
    .map(slot => {
      const [hour] = slot.startTime.split(':').map(Number);
      const slotDate = new Date(slot.date);
      const dayOfWeek = slotDate.toLocaleDateString('en-US', { weekday: 'long' });

      const hourScore = hourCounts[hour] || 0;
      const dayScore = dayOfWeekCounts[dayOfWeek] || 0;

      return {
        slot,
        historyScore: hourScore + dayScore
      };
    })
    .sort((a, b) => b.historyScore - a.historyScore)
    .map(result => result.slot);
}

export default {
  findOptimalSlot,
  checkSlotConflict,
  batchMatchTasksToSlots,
  generateSlotsFromSchedule,
  analyzeSlotUtilization,
  suggestSlotsByHistory,
  MATCH_SCORES
};
