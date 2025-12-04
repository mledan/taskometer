/**
 * Task Model
 *
 * Represents a task/todo item with support for multiple tags,
 * scheduling, and recurrence.
 *
 * TODO: When migrating to a real database, this model should map to:
 * - PostgreSQL: tasks table with tags as JSONB or many-to-many relation
 * - MongoDB: tasks collection with embedded tags array
 */

/**
 * @typedef {Object} RecurrenceRule
 * @property {'none'|'daily'|'weekly'|'monthly'|'custom'} frequency
 * @property {number} interval - Every X days/weeks/months
 * @property {string[]} daysOfWeek - For weekly: ['monday', 'wednesday', 'friday']
 * @property {number} dayOfMonth - For monthly: 1-31
 * @property {string|null} endDate - ISO string or null for indefinite
 * @property {number|null} occurrences - Number of times to repeat, null for indefinite
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Unique identifier (UUID recommended for DB)
 * @property {string} text - Task title/description
 * @property {'pending'|'paused'|'completed'|'cancelled'} status
 * @property {string} primaryType - Primary task type ID (from TaskTypes)
 * @property {string[]} tags - Array of tag IDs for multi-categorization
 * @property {number} duration - Estimated duration in minutes
 * @property {'low'|'medium'|'high'|'urgent'} priority
 * @property {string|null} scheduledTime - ISO datetime when task is scheduled
 * @property {string|null} scheduledSlotId - Reference to CalendarSlot.id
 * @property {RecurrenceRule|null} recurrence - Recurrence settings
 * @property {string|null} description - Extended notes/description
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 * @property {string|null} completedAt - ISO datetime when completed
 * @property {string|null} userId - For future multi-user support
 * @property {boolean} isTemplateBlock - If created from a schedule template
 * @property {string|null} sourceTemplateId - Reference to source schedule
 * @property {Object} metadata - Flexible metadata for extensions
 */

// Default recurrence rule
export const DEFAULT_RECURRENCE = {
  frequency: 'none',
  interval: 1,
  daysOfWeek: [],
  dayOfMonth: null,
  endDate: null,
  occurrences: null
};

// Priority levels with display info
export const TASK_PRIORITIES = {
  low: { id: 'low', name: 'Low', color: '#94A3B8', icon: '○' },
  medium: { id: 'medium', name: 'Medium', color: '#F59E0B', icon: '◐' },
  high: { id: 'high', name: 'High', color: '#EF4444', icon: '●' },
  urgent: { id: 'urgent', name: 'Urgent', color: '#DC2626', icon: '◉' }
};

// Task statuses with display info
export const TASK_STATUSES = {
  pending: { id: 'pending', name: 'Pending', color: '#3B82F6', icon: '○' },
  paused: { id: 'paused', name: 'Paused', color: '#F59E0B', icon: '◑' },
  completed: { id: 'completed', name: 'Completed', color: '#10B981', icon: '●' },
  cancelled: { id: 'cancelled', name: 'Cancelled', color: '#6B7280', icon: '✕' }
};

/**
 * Generate a unique ID for a task
 * TODO: Replace with UUID v4 when using real database
 */
export function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new task with defaults
 * @param {Partial<Task>} taskData - Partial task data
 * @returns {Task}
 */
export function createTask(taskData) {
  const now = new Date().toISOString();

  return {
    id: taskData.id || generateTaskId(),
    text: taskData.text || '',
    status: taskData.status || 'pending',
    primaryType: taskData.primaryType || taskData.taskType || 'work',
    tags: taskData.tags || [],
    duration: taskData.duration || 30,
    priority: taskData.priority || 'medium',
    scheduledTime: taskData.scheduledTime || null,
    scheduledSlotId: taskData.scheduledSlotId || null,
    recurrence: taskData.recurrence || { ...DEFAULT_RECURRENCE },
    description: taskData.description || null,
    createdAt: taskData.createdAt || now,
    updatedAt: taskData.updatedAt || now,
    completedAt: taskData.completedAt || null,
    userId: taskData.userId || null,
    isTemplateBlock: taskData.isTemplateBlock || false,
    sourceTemplateId: taskData.sourceTemplateId || null,
    metadata: taskData.metadata || {},
    // Legacy field mapping for backwards compatibility
    key: taskData.key || taskData.id || generateTaskId(),
    taskType: taskData.primaryType || taskData.taskType || 'work',
    scheduledFor: taskData.scheduledFor || null,
    specificTime: taskData.specificTime || null,
    specificDay: taskData.specificDay || null,
  };
}

/**
 * Validate a task object
 * @param {Task} task
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTask(task) {
  const errors = [];

  if (!task.id) errors.push('Task ID is required');
  if (!task.text || task.text.trim().length === 0) errors.push('Task text is required');
  if (!task.status || !TASK_STATUSES[task.status]) errors.push('Invalid task status');
  if (!task.priority || !TASK_PRIORITIES[task.priority]) errors.push('Invalid task priority');
  if (task.duration !== undefined && (typeof task.duration !== 'number' || task.duration < 0)) {
    errors.push('Duration must be a positive number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Convert legacy task format to new format
 * @param {Object} legacyTask - Task in old format
 * @returns {Task}
 */
export function migrateLegacyTask(legacyTask) {
  return createTask({
    id: legacyTask.key?.toString() || generateTaskId(),
    text: legacyTask.text,
    status: legacyTask.status,
    primaryType: legacyTask.taskType || 'work',
    tags: legacyTask.tags || [],
    duration: legacyTask.duration || 30,
    priority: legacyTask.priority || 'medium',
    scheduledTime: legacyTask.scheduledTime || legacyTask.scheduledFor || null,
    description: legacyTask.description || null,
    isTemplateBlock: legacyTask.isTemplateBlock || false,
    sourceTemplateId: legacyTask.templateId || null,
    // Preserve legacy fields for backwards compatibility
    key: legacyTask.key,
    taskType: legacyTask.taskType,
    scheduledFor: legacyTask.scheduledFor,
    specificTime: legacyTask.specificTime,
    specificDay: legacyTask.specificDay,
    metadata: {
      migratedFrom: 'legacy',
      migratedAt: new Date().toISOString(),
      originalData: { ...legacyTask }
    }
  });
}

/**
 * Check if a task matches given filters
 * @param {Task} task
 * @param {Object} filters
 * @returns {boolean}
 */
export function taskMatchesFilters(task, filters = {}) {
  // Status filter
  if (filters.status && task.status !== filters.status) return false;
  if (filters.statuses && !filters.statuses.includes(task.status)) return false;

  // Priority filter
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.priorities && !filters.priorities.includes(task.priority)) return false;

  // Type filter
  if (filters.primaryType && task.primaryType !== filters.primaryType) return false;

  // Tags filter (any match)
  if (filters.tags && filters.tags.length > 0) {
    const hasMatchingTag = filters.tags.some(tag => task.tags.includes(tag));
    if (!hasMatchingTag) return false;
  }

  // Date range filter
  if (filters.dateFrom && task.scheduledTime) {
    if (new Date(task.scheduledTime) < new Date(filters.dateFrom)) return false;
  }
  if (filters.dateTo && task.scheduledTime) {
    if (new Date(task.scheduledTime) > new Date(filters.dateTo)) return false;
  }

  // Text search
  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase();
    const textMatch = task.text.toLowerCase().includes(searchLower);
    const descMatch = task.description?.toLowerCase().includes(searchLower);
    if (!textMatch && !descMatch) return false;
  }

  return true;
}

export default {
  createTask,
  validateTask,
  migrateLegacyTask,
  taskMatchesFilters,
  generateTaskId,
  TASK_PRIORITIES,
  TASK_STATUSES,
  DEFAULT_RECURRENCE
};
