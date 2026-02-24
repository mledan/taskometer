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

// Life Block Catalog - organized life chunks users can pick from.
// Users start with a fresh slate and add the blocks that matter to them.
export const LIFE_BLOCK_CATALOG = [
  // Essentials
  {
    id: 'sleep',
    name: 'Sleep',
    icon: '😴',
    color: '#6B46C1',
    catalogCategory: 'essentials',
    defaultDuration: 480,
    description: 'How many hours of sleep do you want?',
    durationPresets: [420, 480, 540],
    durationLabels: ['7h', '8h', '9h'],
    preferredStart: '22:00',
    preferredEnd: '06:00',
    isFixed: true,
    constraints: { preferredTimeStart: '22:00', preferredTimeEnd: '06:00' }
  },

  // Meals
  {
    id: 'breakfast',
    name: 'Breakfast',
    icon: '🥣',
    color: '#F59E0B',
    catalogCategory: 'meals',
    defaultDuration: 30,
    description: 'Morning meal',
    durationPresets: [15, 30, 45],
    durationLabels: ['15m', '30m', '45m'],
    preferredStart: '07:00',
    preferredEnd: '08:00',
    isFixed: false,
    constraints: { preferredTimeStart: '06:00', preferredTimeEnd: '10:00' }
  },
  {
    id: 'lunch',
    name: 'Lunch',
    icon: '🥗',
    color: '#F97316',
    catalogCategory: 'meals',
    defaultDuration: 60,
    description: 'Midday meal or lunch break',
    durationPresets: [30, 60, 90],
    durationLabels: ['30m', '1h', '1.5h'],
    preferredStart: '12:00',
    preferredEnd: '13:00',
    isFixed: false,
    constraints: { preferredTimeStart: '11:00', preferredTimeEnd: '14:00' }
  },
  {
    id: 'dinner',
    name: 'Dinner',
    icon: '🍽️',
    color: '#EF4444',
    catalogCategory: 'meals',
    defaultDuration: 60,
    description: 'Evening meal',
    durationPresets: [30, 60, 90],
    durationLabels: ['30m', '1h', '1.5h'],
    preferredStart: '18:00',
    preferredEnd: '19:00',
    isFixed: false,
    constraints: { preferredTimeStart: '17:00', preferredTimeEnd: '21:00' }
  },
  {
    id: 'meal_prep',
    name: 'Meal Prep',
    icon: '🧑‍🍳',
    color: '#FB923C',
    catalogCategory: 'meals',
    defaultDuration: 60,
    description: 'Cooking and food preparation',
    durationPresets: [30, 60, 90],
    durationLabels: ['30m', '1h', '1.5h'],
    preferredStart: '17:00',
    preferredEnd: '18:00',
    isFixed: false,
    constraints: { preferredTimeStart: '06:00', preferredTimeEnd: '21:00' }
  },

  // Productivity
  {
    id: 'work',
    name: 'Work',
    icon: '💼',
    color: '#3B82F6',
    catalogCategory: 'productivity',
    defaultDuration: 480,
    description: 'Work, career, job hours',
    durationPresets: [240, 360, 480],
    durationLabels: ['4h', '6h', '8h'],
    preferredStart: '09:00',
    preferredEnd: '17:00',
    isFixed: true,
    constraints: { preferredTimeStart: '09:00', preferredTimeEnd: '17:00' }
  },
  {
    id: 'learning',
    name: 'Learning',
    icon: '📚',
    color: '#8B5CF6',
    catalogCategory: 'productivity',
    defaultDuration: 60,
    description: 'Reading, courses, studying, skill building',
    durationPresets: [30, 60, 90],
    durationLabels: ['30m', '1h', '1.5h'],
    preferredStart: '20:00',
    preferredEnd: '21:00',
    isFixed: false,
    constraints: { preferredTimeStart: '06:00', preferredTimeEnd: '23:00' }
  },

  // Health
  {
    id: 'exercise',
    name: 'Exercise',
    icon: '🏋️',
    color: '#10B981',
    catalogCategory: 'health',
    defaultDuration: 60,
    description: 'Gym, running, sports, workout',
    durationPresets: [30, 60, 90],
    durationLabels: ['30m', '1h', '1.5h'],
    preferredStart: '06:00',
    preferredEnd: '07:00',
    isFixed: false,
    constraints: { preferredTimeStart: '05:00', preferredTimeEnd: '22:00' }
  },
  {
    id: 'selfcare',
    name: 'Self Care',
    icon: '🧘',
    color: '#84CC16',
    catalogCategory: 'health',
    defaultDuration: 30,
    description: 'Meditation, journal, skincare, mental health',
    durationPresets: [15, 30, 45],
    durationLabels: ['15m', '30m', '45m'],
    preferredStart: '06:30',
    preferredEnd: '07:00',
    isFixed: false,
    constraints: { preferredTimeStart: '05:00', preferredTimeEnd: '23:00' }
  },

  // Leisure
  {
    id: 'hobby',
    name: 'Hobby Time',
    icon: '🎨',
    color: '#EC4899',
    catalogCategory: 'leisure',
    defaultDuration: 120,
    description: '3D printing, crafts, side projects, creative work',
    durationPresets: [60, 120, 180],
    durationLabels: ['1h', '2h', '3h'],
    preferredStart: '19:00',
    preferredEnd: '21:00',
    isFixed: false,
    constraints: { preferredTimeStart: '06:00', preferredTimeEnd: '23:00' }
  },
  {
    id: 'leisure',
    name: 'Leisure / Brainrot',
    icon: '📺',
    color: '#06B6D4',
    catalogCategory: 'leisure',
    defaultDuration: 60,
    description: 'Netflix, scrolling, gaming, just vibing',
    durationPresets: [30, 60, 120],
    durationLabels: ['30m', '1h', '2h'],
    preferredStart: '21:00',
    preferredEnd: '22:00',
    isFixed: false,
    constraints: { preferredTimeStart: '06:00', preferredTimeEnd: '23:00' }
  },
  {
    id: 'social',
    name: 'Social',
    icon: '👥',
    color: '#14B8A6',
    catalogCategory: 'leisure',
    defaultDuration: 120,
    description: 'Friends, family, dates, going out',
    durationPresets: [60, 120, 180],
    durationLabels: ['1h', '2h', '3h'],
    preferredStart: '18:00',
    preferredEnd: '20:00',
    isFixed: false,
    constraints: { preferredTimeStart: '06:00', preferredTimeEnd: '23:00' }
  },

  // Other
  {
    id: 'commute',
    name: 'Commute',
    icon: '🚗',
    color: '#64748B',
    catalogCategory: 'other',
    defaultDuration: 30,
    description: 'Travel to/from work or activities',
    durationPresets: [15, 30, 60],
    durationLabels: ['15m', '30m', '1h'],
    preferredStart: '08:00',
    preferredEnd: '08:30',
    isFixed: false,
    constraints: { preferredTimeStart: '05:00', preferredTimeEnd: '23:00' }
  },
  {
    id: 'chores',
    name: 'Chores / Admin',
    icon: '🏠',
    color: '#78716C',
    catalogCategory: 'other',
    defaultDuration: 30,
    description: 'Cleaning, errands, bills, admin tasks',
    durationPresets: [15, 30, 60],
    durationLabels: ['15m', '30m', '1h'],
    preferredStart: '10:00',
    preferredEnd: '10:30',
    isFixed: false,
    constraints: { preferredTimeStart: '06:00', preferredTimeEnd: '22:00' }
  },
  {
    id: 'buffer',
    name: 'Buffer / Flex',
    icon: '⏰',
    color: '#94A3B8',
    catalogCategory: 'other',
    defaultDuration: 30,
    description: 'Breathing room between activities',
    durationPresets: [15, 30, 60],
    durationLabels: ['15m', '30m', '1h'],
    isFixed: false,
    constraints: {}
  },
  {
    id: 'event',
    name: 'Event / Exception',
    icon: '🎉',
    color: '#F43F5E',
    catalogCategory: 'other',
    defaultDuration: 120,
    description: 'Parties, appointments, one-off events that override the framework',
    durationPresets: [60, 120, 180],
    durationLabels: ['1h', '2h', '3h'],
    isFixed: true,
    isException: true,
    constraints: {}
  },
];

export const CATALOG_CATEGORIES = {
  essentials: { label: 'Essentials', icon: '🌙' },
  meals: { label: 'Meals & Food', icon: '🍳' },
  productivity: { label: 'Productivity', icon: '💼' },
  health: { label: 'Health & Wellness', icon: '💪' },
  leisure: { label: 'Leisure & Fun', icon: '🎮' },
  other: { label: 'Other', icon: '📦' },
};

export function getCatalogBlock(id) {
  return LIFE_BLOCK_CATALOG.find(b => b.id === id) || null;
}

export function getCatalogByCategory() {
  const grouped = {};
  for (const [catId, catMeta] of Object.entries(CATALOG_CATEGORIES)) {
    grouped[catId] = {
      ...catMeta,
      blocks: LIFE_BLOCK_CATALOG.filter(b => b.catalogCategory === catId),
    };
  }
  return grouped;
}

// Default task types: empty for fresh-slate experience.
// Users build their own set by picking from LIFE_BLOCK_CATALOG.
// Legacy defaults preserved for backward compatibility if needed.
export const LEGACY_TASK_TYPES = [
  { id: 'sleep', name: 'Sleep/Rest', icon: '🛏️', color: '#6B46C1', defaultDuration: 480, isSystem: true, constraints: { preferredTimeStart: '21:00', preferredTimeEnd: '09:00' } },
  { id: 'work', name: 'Work/Career', icon: '💼', color: '#3B82F6', defaultDuration: 60, isSystem: true, constraints: { preferredTimeStart: '09:00', preferredTimeEnd: '18:00' } },
  { id: 'meals', name: 'Meals/Nutrition', icon: '🍽️', color: '#F59E0B', defaultDuration: 30, isSystem: true },
  { id: 'exercise', name: 'Exercise/Health', icon: '🏃', color: '#10B981', defaultDuration: 45, isSystem: true },
  { id: 'creative', name: 'Creative/Hobbies', icon: '🎨', color: '#EC4899', defaultDuration: 60, isSystem: true },
  { id: 'buffer', name: 'Buffer/Flex Time', icon: '⏰', color: '#94A3B8', defaultDuration: 30, isSystem: true },
];

export const DEFAULT_TASK_TYPES = [];

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

export function catalogBlockToTaskType(block, overrides = {}) {
  return createTaskType({
    id: block.id,
    name: block.name,
    icon: block.icon,
    color: block.color,
    defaultDuration: overrides.duration || block.defaultDuration,
    description: block.description,
    isSystem: false,
    isActive: true,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      ...(block.constraints || {}),
      ...(overrides.constraints || {}),
    },
  });
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
  catalogBlockToTaskType,
  getCatalogBlock,
  getCatalogByCategory,
  DEFAULT_TASK_TYPES,
  LEGACY_TASK_TYPES,
  LIFE_BLOCK_CATALOG,
  CATALOG_CATEGORIES,
  DEFAULT_CONSTRAINTS,
  ALL_DAYS
};
