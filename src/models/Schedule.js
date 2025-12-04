/**
 * Schedule Model
 *
 * Represents a schedule template that can be applied to the calendar.
 * Includes famous schedules, community uploads, and custom schedules.
 *
 * TODO: When migrating to a real database, this model should map to:
 * - PostgreSQL: schedules table with timeBlocks as JSONB
 * - MongoDB: schedules collection with embedded blocks array
 */

/**
 * @typedef {Object} ScheduleBlock
 * @property {string} id - Unique identifier for this block
 * @property {string} start - Start time in HH:mm format
 * @property {string} end - End time in HH:mm format
 * @property {string} type - Activity type (maps to task types)
 * @property {string} label - Display label
 * @property {string|null} description - Optional description
 * @property {string|null} color - Override color
 * @property {string} category - Block category (sleep, work, health, etc.)
 * @property {'flexible'|'fixed'|'preferred'} flexibility - How strict the slot is
 * @property {string[]} allowedTaskTypes - Compatible task types
 * @property {string[]} allowedTags - Compatible tags
 */

/**
 * @typedef {Object} Schedule
 * @property {string} id - Unique identifier
 * @property {string} name - Schedule name
 * @property {string} description - Description/purpose
 * @property {string} author - Creator name
 * @property {string|null} authorId - Creator user ID (for community)
 * @property {string[]} tags - Searchable tags
 * @property {'daily'|'weekly'|'monthly'} period - Schedule period
 * @property {ScheduleBlock[]} timeBlocks - Array of time blocks
 * @property {string[]} categories - Categories present in this schedule
 * @property {'full'|'category'|'block'} applicableGranularity - Smallest applicable unit
 * @property {boolean} isPublic - Whether shared publicly
 * @property {boolean} isCustom - Whether user-created
 * @property {boolean} isFamous - Whether a famous person's schedule
 * @property {string|null} sourceUrl - Citation/source URL
 * @property {string|null} imageUrl - Preview image
 * @property {number} likes - Community likes count
 * @property {number} usageCount - How many times applied
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 * @property {string|null} userId - Owner user ID
 * @property {Object} metadata - Flexible metadata
 */

// Schedule periods
export const SCHEDULE_PERIODS = {
  daily: { id: 'daily', name: 'Daily', description: 'Repeats every day' },
  weekly: { id: 'weekly', name: 'Weekly', description: 'Varies by day of week' },
  monthly: { id: 'monthly', name: 'Monthly', description: 'Varies by day of month' }
};

// Schedule block categories for granular application
export const BLOCK_CATEGORIES = {
  sleep: {
    id: 'sleep',
    name: 'Sleep & Rest',
    icon: '🛏️',
    color: '#6B46C1',
    types: ['sleep']
  },
  morning_routine: {
    id: 'morning_routine',
    name: 'Morning Routine',
    icon: '🌅',
    color: '#F59E0B',
    types: ['planning', 'mindfulness', 'meals']
  },
  work: {
    id: 'work',
    name: 'Work & Career',
    icon: '💼',
    color: '#3B82F6',
    types: ['work', 'side_project']
  },
  health: {
    id: 'health',
    name: 'Health & Exercise',
    icon: '🏃',
    color: '#10B981',
    types: ['exercise']
  },
  meals: {
    id: 'meals',
    name: 'Meals',
    icon: '🍽️',
    color: '#F97316',
    types: ['meals']
  },
  learning: {
    id: 'learning',
    name: 'Learning & Growth',
    icon: '📚',
    color: '#8B5CF6',
    types: ['learning', 'creative']
  },
  leisure: {
    id: 'leisure',
    name: 'Leisure & Social',
    icon: '🎮',
    color: '#06B6D4',
    types: ['recreation', 'social']
  },
  evening_routine: {
    id: 'evening_routine',
    name: 'Evening Routine',
    icon: '🌙',
    color: '#64748B',
    types: ['planning', 'mindfulness']
  },
  buffer: {
    id: 'buffer',
    name: 'Buffer & Flex',
    icon: '⏰',
    color: '#94A3B8',
    types: ['buffer', 'chores']
  }
};

/**
 * Generate a unique ID for a schedule
 */
export function generateScheduleId() {
  return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique ID for a schedule block
 */
export function generateBlockId() {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new schedule with defaults
 * @param {Partial<Schedule>} scheduleData
 * @returns {Schedule}
 */
export function createSchedule(scheduleData) {
  const now = new Date().toISOString();

  const schedule = {
    id: scheduleData.id || generateScheduleId(),
    name: scheduleData.name || 'New Schedule',
    description: scheduleData.description || '',
    author: scheduleData.author || 'Anonymous',
    authorId: scheduleData.authorId || null,
    tags: scheduleData.tags || [],
    period: scheduleData.period || 'daily',
    timeBlocks: (scheduleData.timeBlocks || []).map(block => createScheduleBlock(block)),
    categories: scheduleData.categories || [],
    applicableGranularity: scheduleData.applicableGranularity || 'full',
    isPublic: scheduleData.isPublic || false,
    isCustom: scheduleData.isCustom !== false,
    isFamous: scheduleData.isFamous || false,
    sourceUrl: scheduleData.sourceUrl || null,
    imageUrl: scheduleData.imageUrl || null,
    likes: scheduleData.likes || 0,
    usageCount: scheduleData.usageCount || 0,
    createdAt: scheduleData.createdAt || now,
    updatedAt: scheduleData.updatedAt || now,
    userId: scheduleData.userId || null,
    metadata: scheduleData.metadata || {}
  };

  // Auto-extract categories from blocks if not provided
  if (schedule.categories.length === 0) {
    schedule.categories = extractCategoriesFromBlocks(schedule.timeBlocks);
  }

  return schedule;
}

/**
 * Create a schedule block with defaults
 * @param {Partial<ScheduleBlock>} blockData
 * @returns {ScheduleBlock}
 */
export function createScheduleBlock(blockData) {
  const block = {
    id: blockData.id || generateBlockId(),
    start: blockData.start || '09:00',
    end: blockData.end || '10:00',
    type: blockData.type || 'work',
    label: blockData.label || 'Time Block',
    description: blockData.description || null,
    color: blockData.color || null,
    category: blockData.category || inferCategoryFromType(blockData.type),
    flexibility: blockData.flexibility || 'preferred',
    allowedTaskTypes: blockData.allowedTaskTypes || [blockData.type],
    allowedTags: blockData.allowedTags || []
  };

  return block;
}

/**
 * Infer block category from activity type
 * @param {string} type
 * @returns {string}
 */
export function inferCategoryFromType(type) {
  for (const [categoryId, category] of Object.entries(BLOCK_CATEGORIES)) {
    if (category.types.includes(type)) {
      return categoryId;
    }
  }
  return 'buffer';
}

/**
 * Extract unique categories from schedule blocks
 * @param {ScheduleBlock[]} blocks
 * @returns {string[]}
 */
export function extractCategoriesFromBlocks(blocks) {
  const categories = new Set();
  blocks.forEach(block => {
    const category = block.category || inferCategoryFromType(block.type);
    categories.add(category);
  });
  return Array.from(categories);
}

/**
 * Validate a schedule
 * @param {Schedule} schedule
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSchedule(schedule) {
  const errors = [];

  if (!schedule.id) errors.push('Schedule ID is required');
  if (!schedule.name || schedule.name.trim().length === 0) {
    errors.push('Schedule name is required');
  }
  if (!schedule.timeBlocks || schedule.timeBlocks.length === 0) {
    errors.push('Schedule must have at least one time block');
  }
  if (schedule.period && !SCHEDULE_PERIODS[schedule.period]) {
    errors.push('Invalid schedule period');
  }

  // Validate each block
  schedule.timeBlocks?.forEach((block, index) => {
    const blockValidation = validateScheduleBlock(block);
    if (!blockValidation.valid) {
      errors.push(`Block ${index + 1}: ${blockValidation.errors.join(', ')}`);
    }
  });

  // Check for overlapping blocks
  const overlaps = findOverlappingBlocks(schedule.timeBlocks || []);
  if (overlaps.length > 0) {
    errors.push(`Schedule has ${overlaps.length} overlapping block(s)`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a schedule block
 * @param {ScheduleBlock} block
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateScheduleBlock(block) {
  const errors = [];

  if (!block.start) errors.push('Start time is required');
  if (!block.end) errors.push('End time is required');
  if (!block.type) errors.push('Block type is required');
  if (!block.label) errors.push('Block label is required');

  // Validate time format
  if (block.start && !/^\d{2}:\d{2}$/.test(block.start)) {
    errors.push('Start time must be in HH:mm format');
  }
  if (block.end && !/^\d{2}:\d{2}$/.test(block.end)) {
    errors.push('End time must be in HH:mm format');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Find overlapping blocks in a schedule
 * @param {ScheduleBlock[]} blocks
 * @returns {Array<[number, number]>}
 */
export function findOverlappingBlocks(blocks) {
  const overlaps = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (blocksOverlap(blocks[i], blocks[j])) {
        overlaps.push([i, j]);
      }
    }
  }

  return overlaps;
}

/**
 * Check if two blocks overlap
 * @param {ScheduleBlock} block1
 * @param {ScheduleBlock} block2
 * @returns {boolean}
 */
export function blocksOverlap(block1, block2) {
  const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const start1 = toMinutes(block1.start);
  let end1 = toMinutes(block1.end);
  const start2 = toMinutes(block2.start);
  let end2 = toMinutes(block2.end);

  // Handle overnight blocks
  if (end1 < start1) end1 += 24 * 60;
  if (end2 < start2) end2 += 24 * 60;

  return start1 < end2 && start2 < end1;
}

/**
 * Get blocks by category
 * @param {Schedule} schedule
 * @param {string} categoryId
 * @returns {ScheduleBlock[]}
 */
export function getBlocksByCategory(schedule, categoryId) {
  return schedule.timeBlocks.filter(block => {
    const blockCategory = block.category || inferCategoryFromType(block.type);
    return blockCategory === categoryId;
  });
}

/**
 * Get total duration for a category in minutes
 * @param {Schedule} schedule
 * @param {string} categoryId
 * @returns {number}
 */
export function getCategoryDuration(schedule, categoryId) {
  const blocks = getBlocksByCategory(schedule, categoryId);
  return blocks.reduce((total, block) => {
    const [startH, startM] = block.start.split(':').map(Number);
    const [endH, endM] = block.end.split(':').map(Number);
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return total + (endMinutes - startMinutes);
  }, 0);
}

/**
 * Get schedule statistics
 * @param {Schedule} schedule
 * @returns {Object}
 */
export function getScheduleStats(schedule) {
  const stats = {
    totalBlocks: schedule.timeBlocks.length,
    categoryBreakdown: {},
    totalScheduledMinutes: 0,
    earliestStart: '23:59',
    latestEnd: '00:00',
    hasOvernightBlock: false
  };

  schedule.timeBlocks.forEach(block => {
    const category = block.category || inferCategoryFromType(block.type);

    if (!stats.categoryBreakdown[category]) {
      stats.categoryBreakdown[category] = { blocks: 0, minutes: 0 };
    }

    const [startH, startM] = block.start.split(':').map(Number);
    const [endH, endM] = block.end.split(':').map(Number);
    let duration = (endH * 60 + endM) - (startH * 60 + startM);
    if (duration < 0) {
      duration += 24 * 60;
      stats.hasOvernightBlock = true;
    }

    stats.categoryBreakdown[category].blocks++;
    stats.categoryBreakdown[category].minutes += duration;
    stats.totalScheduledMinutes += duration;

    if (block.start < stats.earliestStart) stats.earliestStart = block.start;
    if (block.end > stats.latestEnd) stats.latestEnd = block.end;
  });

  return stats;
}

/**
 * Clone a schedule with new ID
 * @param {Schedule} schedule
 * @param {Object} overrides
 * @returns {Schedule}
 */
export function cloneSchedule(schedule, overrides = {}) {
  return createSchedule({
    ...schedule,
    id: generateScheduleId(),
    name: overrides.name || `${schedule.name} (Copy)`,
    isCustom: true,
    isFamous: false,
    likes: 0,
    usageCount: 0,
    timeBlocks: schedule.timeBlocks.map(block => ({
      ...block,
      id: generateBlockId()
    })),
    ...overrides
  });
}

/**
 * Convert legacy schedule format to new format
 * @param {Object} legacySchedule
 * @returns {Schedule}
 */
export function migrateLegacySchedule(legacySchedule) {
  return createSchedule({
    ...legacySchedule,
    timeBlocks: legacySchedule.timeBlocks.map(block => ({
      ...block,
      id: block.id || generateBlockId(),
      category: block.category || inferCategoryFromType(block.type),
      flexibility: block.flexibility || 'preferred',
      allowedTaskTypes: block.allowedTaskTypes || [block.type],
      allowedTags: block.allowedTags || []
    })),
    categories: extractCategoriesFromBlocks(legacySchedule.timeBlocks),
    applicableGranularity: legacySchedule.applicableGranularity || 'full',
    metadata: {
      migratedFrom: 'legacy',
      migratedAt: new Date().toISOString()
    }
  });
}

export default {
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
};
