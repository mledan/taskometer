/**
 * TaskType Model
 *
 * Represents a task type/category. These are the primary classification
 * for tasks and map to schedule block types.
 *
 * TODO: When migrating to a real database, this model should map to:
 * - PostgreSQL: task_types table
 * - MongoDB: taskTypes collection
 */

/**
 * @typedef {Object} TaskType
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} icon - Emoji or icon identifier
 * @property {string} color - Hex color for display
 * @property {number} defaultDuration - Default duration in minutes
 * @property {string[]} allowedDays - Days when this type can be scheduled
 * @property {string|null} description - Optional description
 * @property {Object|null} constraints - Scheduling constraints
 * @property {boolean} isSystem - Whether this is a system-provided type
 * @property {boolean} isActive - Whether this type is currently active
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 * @property {string|null} userId - For future multi-user support
 */

/**
 * @typedef {Object} TypeConstraints
 * @property {string|null} preferredTimeStart - Preferred start time HH:mm
 * @property {string|null} preferredTimeEnd - Preferred end time HH:mm
 * @property {number|null} maxDailyMinutes - Max minutes per day
 * @property {number|null} minBreakBetween - Min minutes between same-type tasks
 * @property {boolean} allowOverlap - Whether tasks of this type can overlap
 */

// Default task type constraints
export const DEFAULT_CONSTRAINTS = {
  preferredTimeStart: null,
  preferredTimeEnd: null,
  maxDailyMinutes: null,
  minBreakBetween: null,
  allowOverlap: false
};

// All days of the week
export const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Default system task types (matching ACTIVITY_TYPES from scheduleTemplates.js)
export const DEFAULT_TASK_TYPES = [
  {
    id: 'sleep',
    name: 'Sleep/Rest',
    icon: '🛏️',
    color: '#6B46C1',
    defaultDuration: 480, // 8 hours
    description: 'Sleep and rest time',
    isSystem: true,
    constraints: {
      preferredTimeStart: '21:00',
      preferredTimeEnd: '09:00'
    }
  },
  {
    id: 'work',
    name: 'Work/Career',
    icon: '💼',
    color: '#3B82F6',
    defaultDuration: 60,
    description: 'Professional work tasks',
    isSystem: true,
    constraints: {
      preferredTimeStart: '09:00',
      preferredTimeEnd: '18:00'
    }
  },
  {
    id: 'meals',
    name: 'Meals/Nutrition',
    icon: '🍽️',
    color: '#F59E0B',
    defaultDuration: 30,
    description: 'Eating and meal prep',
    isSystem: true
  },
  {
    id: 'exercise',
    name: 'Exercise/Health',
    icon: '🏃',
    color: '#10B981',
    defaultDuration: 45,
    description: 'Physical exercise and fitness',
    isSystem: true
  },
  {
    id: 'learning',
    name: 'Learning/Reading',
    icon: '📚',
    color: '#8B5CF6',
    defaultDuration: 60,
    description: 'Education and skill development',
    isSystem: true
  },
  {
    id: 'creative',
    name: 'Creative/Hobbies',
    icon: '🎨',
    color: '#EC4899',
    defaultDuration: 60,
    description: 'Creative projects and hobbies',
    isSystem: true
  },
  {
    id: 'social',
    name: 'Social/Family',
    icon: '👥',
    color: '#14B8A6',
    defaultDuration: 60,
    description: 'Social activities and family time',
    isSystem: true
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness/Meditation',
    icon: '🧘',
    color: '#84CC16',
    defaultDuration: 20,
    description: 'Meditation and mental wellness',
    isSystem: true
  },
  {
    id: 'chores',
    name: 'Chores/Admin',
    icon: '🏠',
    color: '#F97316',
    defaultDuration: 30,
    description: 'Household chores and administration',
    isSystem: true
  },
  {
    id: 'recreation',
    name: 'Recreation/Entertainment',
    icon: '🎮',
    color: '#06B6D4',
    defaultDuration: 60,
    description: 'Entertainment and relaxation',
    isSystem: true
  },
  {
    id: 'side_project',
    name: 'Side Projects',
    icon: '🚀',
    color: '#A855F7',
    defaultDuration: 60,
    description: 'Personal projects and ventures',
    isSystem: true
  },
  {
    id: 'planning',
    name: 'Planning/Review',
    icon: '📝',
    color: '#64748B',
    defaultDuration: 30,
    description: 'Planning and review sessions',
    isSystem: true
  },
  {
    id: 'buffer',
    name: 'Buffer/Flex Time',
    icon: '⏰',
    color: '#94A3B8',
    defaultDuration: 30,
    description: 'Flexible time for overflow or breaks',
    isSystem: true
  }
];

/**
 * Generate a unique ID for a task type
 */
export function generateTaskTypeId() {
  return `type_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new task type with defaults
 * @param {Partial<TaskType>} typeData
 * @returns {TaskType}
 */
export function createTaskType(typeData) {
  const now = new Date().toISOString();

  return {
    id: typeData.id || generateTaskTypeId(),
    name: typeData.name || 'New Type',
    icon: typeData.icon || '📌',
    color: typeData.color || '#94A3B8',
    defaultDuration: typeData.defaultDuration || 30,
    allowedDays: typeData.allowedDays || [...ALL_DAYS],
    description: typeData.description || null,
    constraints: typeData.constraints || { ...DEFAULT_CONSTRAINTS },
    isSystem: typeData.isSystem || false,
    isActive: typeData.isActive !== false,
    createdAt: typeData.createdAt || now,
    updatedAt: typeData.updatedAt || now,
    userId: typeData.userId || null
  };
}

/**
 * Validate a task type
 * @param {TaskType} type
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTaskType(type) {
  const errors = [];

  if (!type.id) errors.push('Type ID is required');
  if (!type.name || type.name.trim().length === 0) errors.push('Type name is required');
  if (type.name && type.name.length > 50) errors.push('Type name must be 50 characters or less');

  // Validate color format
  if (type.color && !/^#[0-9A-Fa-f]{6}$/.test(type.color)) {
    errors.push('Color must be a valid hex color (e.g., #3B82F6)');
  }

  // Validate duration
  if (type.defaultDuration !== undefined) {
    if (typeof type.defaultDuration !== 'number' || type.defaultDuration < 1) {
      errors.push('Default duration must be a positive number');
    }
  }

  // Validate allowed days
  if (type.allowedDays && type.allowedDays.length > 0) {
    const invalidDays = type.allowedDays.filter(day => !ALL_DAYS.includes(day));
    if (invalidDays.length > 0) {
      errors.push(`Invalid days: ${invalidDays.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a task type is a system type
 * @param {string} typeId
 * @returns {boolean}
 */
export function isSystemType(typeId) {
  return DEFAULT_TASK_TYPES.some(type => type.id === typeId);
}

/**
 * Get type display style object for React
 * @param {TaskType} type
 * @returns {Object}
 */
export function getTypeStyle(type) {
  return {
    backgroundColor: `${type.color}20`, // 20% opacity background
    color: type.color,
    borderColor: type.color
  };
}

/**
 * Check if a task type can be scheduled on a given day
 * @param {TaskType} type
 * @param {string} dayName - e.g., 'Monday'
 * @returns {boolean}
 */
export function canScheduleOnDay(type, dayName) {
  if (!type.allowedDays || type.allowedDays.length === 0) {
    return true; // No restrictions
  }
  return type.allowedDays.includes(dayName);
}

/**
 * Check if a time is within the preferred time range
 * @param {TaskType} type
 * @param {string} time - HH:mm format
 * @returns {boolean}
 */
export function isWithinPreferredTime(type, time) {
  if (!type.constraints?.preferredTimeStart || !type.constraints?.preferredTimeEnd) {
    return true; // No time preference
  }

  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const timeMin = toMinutes(time);
  const startMin = toMinutes(type.constraints.preferredTimeStart);
  let endMin = toMinutes(type.constraints.preferredTimeEnd);

  // Handle overnight ranges (e.g., 21:00 - 09:00)
  if (endMin < startMin) {
    return timeMin >= startMin || timeMin <= endMin;
  }

  return timeMin >= startMin && timeMin <= endMin;
}

/**
 * Merge default types with custom types, preserving custom overrides
 * @param {TaskType[]} customTypes
 * @returns {TaskType[]}
 */
export function mergeWithDefaultTypes(customTypes) {
  const customIds = new Set(customTypes.map(t => t.id));
  const defaultsNotOverridden = DEFAULT_TASK_TYPES.filter(t => !customIds.has(t.id));

  return [...defaultsNotOverridden.map(t => createTaskType({ ...t })), ...customTypes];
}

/**
 * Search types by name
 * @param {TaskType[]} types
 * @param {string} searchTerm
 * @returns {TaskType[]}
 */
export function searchTypes(types, searchTerm) {
  const term = searchTerm.toLowerCase();
  return types.filter(type =>
    type.name.toLowerCase().includes(term) ||
    type.description?.toLowerCase().includes(term)
  );
}

/**
 * Get types that match a schedule block type
 * @param {TaskType[]} types
 * @param {string} blockType
 * @returns {TaskType[]}
 */
export function getTypesMatchingBlockType(types, blockType) {
  // Direct match
  const exactMatch = types.filter(t => t.id === blockType);
  if (exactMatch.length > 0) return exactMatch;

  // Flexible types that can go in buffer blocks
  if (blockType === 'buffer') {
    return types.filter(t => t.isActive !== false);
  }

  return [];
}

export default {
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
};
