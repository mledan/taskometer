/**
 * Tag Model
 *
 * Represents a tag for categorizing tasks. Tags allow multi-categorization
 * beyond the single primary type, enabling flexible filtering and scheduling.
 *
 * TODO: When migrating to a real database, this model should map to:
 * - PostgreSQL: tags table, with task_tags junction table
 * - MongoDB: tags collection, tasks store tag IDs
 */

/**
 * @typedef {Object} Tag
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} color - Hex color for display
 * @property {string} icon - Emoji or icon identifier
 * @property {string|null} description - Optional description
 * @property {string} category - Tag category for grouping (e.g., 'work', 'life', 'health')
 * @property {boolean} isSystem - Whether this is a system-provided tag
 * @property {boolean} isActive - Whether this tag is currently active
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 * @property {string|null} userId - For future multi-user support
 * @property {number} usageCount - How many tasks use this tag (for analytics)
 */

// Tag categories for organization
export const TAG_CATEGORIES = {
  work: { id: 'work', name: 'Work', icon: '💼', color: '#3B82F6' },
  life: { id: 'life', name: 'Life', icon: '🏠', color: '#10B981' },
  health: { id: 'health', name: 'Health', icon: '❤️', color: '#EF4444' },
  learning: { id: 'learning', name: 'Learning', icon: '📚', color: '#8B5CF6' },
  social: { id: 'social', name: 'Social', icon: '👥', color: '#14B8A6' },
  custom: { id: 'custom', name: 'Custom', icon: '✨', color: '#F59E0B' }
};

// Default system tags
export const DEFAULT_TAGS = [
  {
    id: 'work',
    name: 'Work',
    color: '#3B82F6',
    icon: '💼',
    description: 'Work-related tasks',
    category: 'work',
    isSystem: true
  },
  {
    id: 'personal',
    name: 'Personal',
    color: '#10B981',
    icon: '🏠',
    description: 'Personal tasks and errands',
    category: 'life',
    isSystem: true
  },
  {
    id: 'health',
    name: 'Health',
    color: '#EF4444',
    icon: '❤️',
    description: 'Health and fitness tasks',
    category: 'health',
    isSystem: true
  },
  {
    id: 'learning',
    name: 'Learning',
    color: '#8B5CF6',
    icon: '📚',
    description: 'Learning and education',
    category: 'learning',
    isSystem: true
  },
  {
    id: 'creative',
    name: 'Creative',
    color: '#EC4899',
    icon: '🎨',
    description: 'Creative projects and hobbies',
    category: 'life',
    isSystem: true
  },
  {
    id: 'social',
    name: 'Social',
    color: '#14B8A6',
    icon: '👥',
    description: 'Social activities and meetings',
    category: 'social',
    isSystem: true
  },
  {
    id: 'leisure',
    name: 'Leisure',
    color: '#06B6D4',
    icon: '🎮',
    description: 'Recreation and relaxation',
    category: 'life',
    isSystem: true
  },
  {
    id: 'urgent',
    name: 'Urgent',
    color: '#DC2626',
    icon: '🔥',
    description: 'Time-sensitive tasks',
    category: 'work',
    isSystem: true
  },
  {
    id: 'important',
    name: 'Important',
    color: '#F59E0B',
    icon: '⭐',
    description: 'High-priority items',
    category: 'work',
    isSystem: true
  },
  {
    id: 'routine',
    name: 'Routine',
    color: '#94A3B8',
    icon: '🔄',
    description: 'Recurring routine tasks',
    category: 'life',
    isSystem: true
  }
];

/**
 * Generate a unique ID for a tag
 */
export function generateTagId() {
  return `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new tag with defaults
 * @param {Partial<Tag>} tagData
 * @returns {Tag}
 */
export function createTag(tagData) {
  const now = new Date().toISOString();

  return {
    id: tagData.id || generateTagId(),
    name: tagData.name || 'New Tag',
    color: tagData.color || '#94A3B8',
    icon: tagData.icon || '🏷️',
    description: tagData.description || null,
    category: tagData.category || 'custom',
    isSystem: tagData.isSystem || false,
    isActive: tagData.isActive !== false,
    createdAt: tagData.createdAt || now,
    updatedAt: tagData.updatedAt || now,
    userId: tagData.userId || null,
    usageCount: tagData.usageCount || 0
  };
}

/**
 * Validate a tag
 * @param {Tag} tag
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTag(tag) {
  const errors = [];

  if (!tag.id) errors.push('Tag ID is required');
  if (!tag.name || tag.name.trim().length === 0) errors.push('Tag name is required');
  if (tag.name && tag.name.length > 50) errors.push('Tag name must be 50 characters or less');

  // Validate color format
  if (tag.color && !/^#[0-9A-Fa-f]{6}$/.test(tag.color)) {
    errors.push('Color must be a valid hex color (e.g., #3B82F6)');
  }

  // Validate category
  if (tag.category && !TAG_CATEGORIES[tag.category]) {
    errors.push('Invalid tag category');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a tag ID is a system tag
 * @param {string} tagId
 * @returns {boolean}
 */
export function isSystemTag(tagId) {
  return DEFAULT_TAGS.some(tag => tag.id === tagId);
}

/**
 * Get tags grouped by category
 * @param {Tag[]} tags
 * @returns {Object}
 */
export function getTagsByCategory(tags) {
  const grouped = {};

  Object.keys(TAG_CATEGORIES).forEach(category => {
    grouped[category] = [];
  });

  tags.forEach(tag => {
    const category = tag.category || 'custom';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(tag);
  });

  return grouped;
}

/**
 * Search tags by name
 * @param {Tag[]} tags
 * @param {string} searchTerm
 * @returns {Tag[]}
 */
export function searchTags(tags, searchTerm) {
  const term = searchTerm.toLowerCase();
  return tags.filter(tag =>
    tag.name.toLowerCase().includes(term) ||
    tag.description?.toLowerCase().includes(term) ||
    tag.category.toLowerCase().includes(term)
  );
}

/**
 * Get tag display style object for React
 * @param {Tag} tag
 * @returns {Object}
 */
export function getTagStyle(tag) {
  return {
    backgroundColor: `${tag.color}20`, // 20% opacity background
    color: tag.color,
    borderColor: tag.color
  };
}

/**
 * Merge default tags with custom tags, preferring custom
 * @param {Tag[]} customTags
 * @returns {Tag[]}
 */
export function mergeWithDefaultTags(customTags) {
  const customIds = new Set(customTags.map(t => t.id));
  const defaultsNotOverridden = DEFAULT_TAGS.filter(t => !customIds.has(t.id));

  return [...defaultsNotOverridden.map(t => createTag({ ...t })), ...customTags];
}

export default {
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
};
