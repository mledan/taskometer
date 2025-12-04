/**
 * CalendarSlot Model
 *
 * Represents a time slot in the calendar that can have type/tag restrictions
 * and hold assigned tasks. This is the core of the slot-based scheduling system.
 *
 * TODO: When migrating to a real database, this model should map to:
 * - PostgreSQL: calendar_slots table with allowedTags as JSONB
 * - MongoDB: calendarSlots collection with embedded arrays
 */

/**
 * @typedef {Object} CalendarSlot
 * @property {string} id - Unique identifier
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {string} startTime - Start time in HH:mm format
 * @property {string} endTime - End time in HH:mm format
 * @property {string|null} slotType - Type restriction for this slot (or null for flexible)
 * @property {string[]} allowedTags - Tags allowed in this slot (empty = all allowed)
 * @property {string|null} assignedTaskId - Task assigned to this slot
 * @property {boolean} isRecurring - Whether this slot recurs
 * @property {Object|null} recurrenceRule - Recurrence settings
 * @property {string|null} sourceScheduleId - Which schedule template created this
 * @property {string|null} sourceBlockId - Specific block within schedule
 * @property {string} label - Display label for the slot
 * @property {string|null} description - Optional description
 * @property {string} color - Color for display
 * @property {'flexible'|'fixed'|'preferred'} flexibility - How strict the slot type is
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 * @property {string|null} userId - For future multi-user support
 * @property {string|null} googleEventId - Synced Google Calendar event ID
 * @property {string|null} appleEventId - Synced Apple Calendar event ID
 */

// Slot flexibility levels
export const SLOT_FLEXIBILITY = {
  flexible: {
    id: 'flexible',
    name: 'Flexible',
    description: 'Any task type can be scheduled here',
    icon: '🔄'
  },
  preferred: {
    id: 'preferred',
    name: 'Preferred',
    description: 'Prefers certain types but allows others',
    icon: '⭐'
  },
  fixed: {
    id: 'fixed',
    name: 'Fixed',
    description: 'Only specific types/tags allowed',
    icon: '🔒'
  }
};

/**
 * Generate a unique ID for a slot
 */
export function generateSlotId() {
  return `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new calendar slot with defaults
 * @param {Partial<CalendarSlot>} slotData
 * @returns {CalendarSlot}
 */
export function createCalendarSlot(slotData) {
  const now = new Date().toISOString();

  return {
    id: slotData.id || generateSlotId(),
    date: slotData.date || new Date().toISOString().split('T')[0],
    startTime: slotData.startTime || '09:00',
    endTime: slotData.endTime || '10:00',
    slotType: slotData.slotType || null,
    allowedTags: slotData.allowedTags || [],
    assignedTaskId: slotData.assignedTaskId || null,
    isRecurring: slotData.isRecurring || false,
    recurrenceRule: slotData.recurrenceRule || null,
    sourceScheduleId: slotData.sourceScheduleId || null,
    sourceBlockId: slotData.sourceBlockId || null,
    label: slotData.label || 'Time Slot',
    description: slotData.description || null,
    color: slotData.color || '#3B82F6',
    flexibility: slotData.flexibility || 'flexible',
    createdAt: slotData.createdAt || now,
    updatedAt: slotData.updatedAt || now,
    userId: slotData.userId || null,
    googleEventId: slotData.googleEventId || null,
    appleEventId: slotData.appleEventId || null
  };
}

/**
 * Create a slot from a schedule template block
 * @param {Object} block - Schedule block
 * @param {string} date - Target date YYYY-MM-DD
 * @param {string} scheduleId - Source schedule ID
 * @returns {CalendarSlot}
 */
export function createSlotFromTemplateBlock(block, date, scheduleId) {
  return createCalendarSlot({
    date,
    startTime: block.start,
    endTime: block.end,
    slotType: block.type,
    allowedTags: block.allowedTaskTypes || [],
    label: block.label || block.name || `${block.type} block`,
    description: block.description,
    color: block.color,
    flexibility: block.flexibility || 'preferred',
    sourceScheduleId: scheduleId,
    sourceBlockId: block.id,
    isRecurring: false // Will be set separately if needed
  });
}

/**
 * Validate a calendar slot
 * @param {CalendarSlot} slot
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCalendarSlot(slot) {
  const errors = [];

  if (!slot.id) errors.push('Slot ID is required');
  if (!slot.date) errors.push('Slot date is required');
  if (!slot.startTime) errors.push('Start time is required');
  if (!slot.endTime) errors.push('End time is required');

  // Validate date format
  if (slot.date && !/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  }

  // Validate time format
  if (slot.startTime && !/^\d{2}:\d{2}$/.test(slot.startTime)) {
    errors.push('Start time must be in HH:mm format');
  }
  if (slot.endTime && !/^\d{2}:\d{2}$/.test(slot.endTime)) {
    errors.push('End time must be in HH:mm format');
  }

  // Validate time order (allow overnight slots where end < start)
  // But ensure they're not the same
  if (slot.startTime === slot.endTime) {
    errors.push('Start and end time cannot be the same');
  }

  if (slot.flexibility && !SLOT_FLEXIBILITY[slot.flexibility]) {
    errors.push('Invalid flexibility level');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calculate slot duration in minutes
 * @param {CalendarSlot} slot
 * @returns {number}
 */
export function getSlotDuration(slot) {
  const [startH, startM] = slot.startTime.split(':').map(Number);
  const [endH, endM] = slot.endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Handle overnight slots
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

/**
 * Get full datetime for a slot's start
 * @param {CalendarSlot} slot
 * @returns {Date}
 */
export function getSlotStartDateTime(slot) {
  return new Date(`${slot.date}T${slot.startTime}:00`);
}

/**
 * Get full datetime for a slot's end
 * @param {CalendarSlot} slot
 * @returns {Date}
 */
export function getSlotEndDateTime(slot) {
  const [startH] = slot.startTime.split(':').map(Number);
  const [endH] = slot.endTime.split(':').map(Number);

  let endDate = slot.date;

  // Handle overnight slots
  if (endH < startH) {
    const nextDay = new Date(slot.date);
    nextDay.setDate(nextDay.getDate() + 1);
    endDate = nextDay.toISOString().split('T')[0];
  }

  return new Date(`${endDate}T${slot.endTime}:00`);
}

/**
 * Check if a task can be assigned to this slot
 * @param {CalendarSlot} slot
 * @param {Object} task
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canAssignTaskToSlot(slot, task) {
  // If slot already has a task
  if (slot.assignedTaskId) {
    return { allowed: false, reason: 'Slot already has an assigned task' };
  }

  // If slot is flexible, always allow
  if (slot.flexibility === 'flexible' || (!slot.slotType && slot.allowedTags.length === 0)) {
    return { allowed: true, reason: null };
  }

  // Check type match
  const taskType = task.primaryType || task.taskType;
  const typeMatches = !slot.slotType || slot.slotType === taskType;

  // Check tag match (if slot has tag restrictions)
  let tagMatches = true;
  if (slot.allowedTags.length > 0) {
    const taskTags = task.tags || [];
    tagMatches = slot.allowedTags.some(allowedTag => taskTags.includes(allowedTag));
  }

  // For fixed slots, both must match
  if (slot.flexibility === 'fixed') {
    if (!typeMatches) {
      return { allowed: false, reason: `Slot requires type "${slot.slotType}"` };
    }
    if (slot.allowedTags.length > 0 && !tagMatches) {
      return { allowed: false, reason: `Slot requires one of tags: ${slot.allowedTags.join(', ')}` };
    }
    return { allowed: true, reason: null };
  }

  // For preferred slots, warn but allow
  if (slot.flexibility === 'preferred') {
    if (!typeMatches || (slot.allowedTags.length > 0 && !tagMatches)) {
      return {
        allowed: true,
        reason: `Warning: This slot prefers type "${slot.slotType || 'any'}" with tags [${slot.allowedTags.join(', ')}]`
      };
    }
  }

  return { allowed: true, reason: null };
}

/**
 * Check if two slots overlap
 * @param {CalendarSlot} slot1
 * @param {CalendarSlot} slot2
 * @returns {boolean}
 */
export function slotsOverlap(slot1, slot2) {
  if (slot1.date !== slot2.date) return false;

  const start1 = getSlotStartDateTime(slot1);
  const end1 = getSlotEndDateTime(slot1);
  const start2 = getSlotStartDateTime(slot2);
  const end2 = getSlotEndDateTime(slot2);

  return start1 < end2 && start2 < end1;
}

/**
 * Get slots for a specific date
 * @param {CalendarSlot[]} slots
 * @param {string} date - YYYY-MM-DD
 * @returns {CalendarSlot[]}
 */
export function getSlotsForDate(slots, date) {
  return slots.filter(slot => slot.date === date);
}

/**
 * Get slots for a date range
 * @param {CalendarSlot[]} slots
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {CalendarSlot[]}
 */
export function getSlotsForDateRange(slots, startDate, endDate) {
  return slots.filter(slot => {
    return slot.date >= startDate && slot.date <= endDate;
  });
}

/**
 * Find available slots for a task
 * @param {CalendarSlot[]} slots
 * @param {Object} task
 * @param {Object} options
 * @returns {CalendarSlot[]}
 */
export function findAvailableSlotsForTask(slots, task, options = {}) {
  const { dateFrom, dateTo, preferExactMatch = true } = options;

  let candidateSlots = slots.filter(slot => {
    // Must not have an assigned task
    if (slot.assignedTaskId) return false;

    // Date range filter
    if (dateFrom && slot.date < dateFrom) return false;
    if (dateTo && slot.date > dateTo) return false;

    // Must have enough duration
    const slotDuration = getSlotDuration(slot);
    const taskDuration = task.duration || 30;
    if (slotDuration < taskDuration) return false;

    // Must be assignable
    const { allowed } = canAssignTaskToSlot(slot, task);
    return allowed;
  });

  // Sort by best match and then by date/time
  candidateSlots.sort((a, b) => {
    if (preferExactMatch) {
      const taskType = task.primaryType || task.taskType;
      const aExact = a.slotType === taskType;
      const bExact = b.slotType === taskType;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
    }

    // Sort by date, then start time
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  return candidateSlots;
}

export default {
  createCalendarSlot,
  createSlotFromTemplateBlock,
  validateCalendarSlot,
  getSlotDuration,
  getSlotStartDateTime,
  getSlotEndDateTime,
  canAssignTaskToSlot,
  slotsOverlap,
  getSlotsForDate,
  getSlotsForDateRange,
  findAvailableSlotsForTask,
  generateSlotId,
  SLOT_FLEXIBILITY
};
