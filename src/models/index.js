/**
 * Models Index
 *
 * Central export for all data models used in Taskometer.
 * These models define the shape of data and provide utility functions
 * for creating, validating, and manipulating entities.
 *
 * TODO: When migrating to a real database:
 * - These models can be extended with ORM decorators (TypeORM, Prisma)
 * - Validation can be enhanced with schema libraries (Zod, Yup)
 * - Add migration utilities for schema changes
 */

// Task model - individual todo items
export {
  default as TaskModel,
  createTask,
  validateTask,
  migrateLegacyTask,
  taskMatchesFilters,
  generateTaskId,
  TASK_PRIORITIES,
  TASK_STATUSES,
  DEFAULT_RECURRENCE
} from './Task';

// CalendarSlot model - time slots in the calendar
export {
  default as CalendarSlotModel,
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
} from './CalendarSlot';

// Tag model - task categorization tags
export {
  default as TagModel,
  createTag,
  validateTag,
  isSystemTag,
  getTagsByCategory,
  searchTags,
  getTagStyle,
  mergeWithDefaultTags,
  generateTagId,
  DEFAULT_TAGS,
  TAG_CATEGORIES
} from './Tag';

// Schedule model - schedule templates
export {
  default as ScheduleModel,
  createSchedule,
  createScheduleBlock,
  validateSchedule,
  validateScheduleBlock,
  findOverlappingBlocks,
  blocksOverlap,
  getBlocksByCategory,
  getCategoryDuration,
  getScheduleStats,
  cloneSchedule,
  migrateLegacySchedule,
  inferCategoryFromType,
  extractCategoriesFromBlocks,
  generateScheduleId,
  generateBlockId,
  SCHEDULE_PERIODS,
  BLOCK_CATEGORIES
} from './Schedule';

// TaskType model - primary task types
export {
  default as TaskTypeModel,
  createTaskType,
  validateTaskType,
  isSystemType,
  getTypeStyle,
  canScheduleOnDay,
  isWithinPreferredTime,
  mergeWithDefaultTypes,
  searchTypes,
  getTypesMatchingBlockType,
  generateTaskTypeId,
  DEFAULT_TASK_TYPES,
  DEFAULT_CONSTRAINTS,
  ALL_DAYS
} from './TaskType';

// AuditEntry model - audit log entries
export {
  default as AuditEntryModel,
  createAuditEntry,
  getSessionId,
  resetSessionId,
  getChangedFields,
  getAuditDescription,
  filterAuditEntries,
  groupAuditByDate,
  getAuditStats,
  exportAuditToCsv,
  createBatchAuditEntry,
  generateAuditId,
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  CHANGE_SOURCES
} from './AuditEntry';

/**
 * Model version for migration tracking
 */
export const MODEL_VERSION = '2.0.0';

/**
 * Check if stored data needs migration
 * @param {string} storedVersion
 * @returns {boolean}
 */
export function needsMigration(storedVersion) {
  if (!storedVersion) return true;
  return storedVersion !== MODEL_VERSION;
}

/**
 * Get all model types for debugging/introspection
 */
export const MODEL_TYPES = {
  task: 'Task',
  calendarSlot: 'CalendarSlot',
  tag: 'Tag',
  schedule: 'Schedule',
  taskType: 'TaskType',
  auditEntry: 'AuditEntry'
};
