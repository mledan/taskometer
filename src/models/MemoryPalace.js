/**
 * Memory Palace Model
 * 
 * Implements a memory palace system for spatial task organization.
 * Users create virtual "palaces" (like their home or office) with
 * locations (desk, kitchen counter, etc.) that can be linked to tasks.
 * 
 * This leverages the Method of Loci memory technique for better
 * task recall and organization.
 */

/**
 * @typedef {Object} MemoryLocation
 * @property {string} id - Unique identifier
 * @property {string} name - Location name (e.g., "Kitchen Counter", "Office Desk")
 * @property {string} description - Detailed description or notes
 * @property {string|null} imageUrl - Optional image representing the location
 * @property {string} palaceId - Reference to parent palace
 * @property {{ x: number, y: number }} position - Position for visual layout (0-100 percentage)
 * @property {string[]} linkedTaskIds - Array of linked task IDs
 * @property {string[]} staticReminders - Permanent reminders (e.g., "Keys always here")
 * @property {string} icon - Emoji or icon identifier
 * @property {string} color - Color for visual representation
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 */

/**
 * @typedef {Object} MemoryPalace
 * @property {string} id - Unique identifier
 * @property {string} userId - User who owns this palace
 * @property {string} name - Palace name (e.g., "Home", "Office", "Childhood Home")
 * @property {string} description - Description of the palace
 * @property {string|null} backgroundImage - Optional background/floor plan image
 * @property {MemoryLocation[]} locations - Array of locations within this palace
 * @property {boolean} isPublic - Whether this palace can be shared
 * @property {string[]} tags - Tags for organization
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 */

// Default palace templates
export const PALACE_TEMPLATES = {
  home: {
    name: 'Home',
    description: 'Your home with familiar rooms and spaces',
    suggestedLocations: [
      { name: 'Front Door', icon: '🚪', position: { x: 50, y: 90 } },
      { name: 'Living Room', icon: '🛋️', position: { x: 30, y: 60 } },
      { name: 'Kitchen', icon: '🍳', position: { x: 70, y: 50 } },
      { name: 'Bedroom', icon: '🛏️', position: { x: 20, y: 30 } },
      { name: 'Bathroom', icon: '🚿', position: { x: 80, y: 30 } },
      { name: 'Home Office', icon: '💻', position: { x: 50, y: 40 } },
    ]
  },
  office: {
    name: 'Office',
    description: 'Your workspace with desk areas and meeting rooms',
    suggestedLocations: [
      { name: 'Entrance', icon: '🚪', position: { x: 50, y: 95 } },
      { name: 'My Desk', icon: '💻', position: { x: 30, y: 50 } },
      { name: 'Meeting Room', icon: '🪑', position: { x: 70, y: 30 } },
      { name: 'Break Room', icon: '☕', position: { x: 80, y: 70 } },
      { name: 'Whiteboard', icon: '📋', position: { x: 50, y: 20 } },
    ]
  },
  school: {
    name: 'School/Campus',
    description: 'Educational environment with classrooms and study areas',
    suggestedLocations: [
      { name: 'Main Entrance', icon: '🚪', position: { x: 50, y: 90 } },
      { name: 'Classroom', icon: '📚', position: { x: 30, y: 40 } },
      { name: 'Library', icon: '📖', position: { x: 70, y: 30 } },
      { name: 'Cafeteria', icon: '🍽️', position: { x: 20, y: 70 } },
      { name: 'Study Area', icon: '✏️', position: { x: 80, y: 50 } },
    ]
  }
};

// Location icons for selection
export const LOCATION_ICONS = [
  '🚪', '🛋️', '🍳', '🛏️', '🚿', '💻', '📚', '📖', '🪑', '☕',
  '📋', '🎮', '🎵', '🌱', '🖼️', '📺', '🔑', '📦', '🗄️', '⏰',
  '💡', '🪴', '🧹', '🧺', '📬', '🏠', '🚗', '🚴', '🏋️', '🧘'
];

// Location colors for visual variety
export const LOCATION_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

/**
 * Generate a unique ID for a palace
 */
export function generatePalaceId() {
  return `palace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique ID for a location
 */
export function generateLocationId() {
  return `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new memory palace with defaults
 * @param {Partial<MemoryPalace>} palaceData - Partial palace data
 * @returns {MemoryPalace}
 */
export function createMemoryPalace(palaceData) {
  const now = new Date().toISOString();
  
  return {
    id: palaceData.id || generatePalaceId(),
    userId: palaceData.userId || null,
    name: palaceData.name || 'My Palace',
    description: palaceData.description || '',
    backgroundImage: palaceData.backgroundImage || null,
    locations: palaceData.locations || [],
    isPublic: palaceData.isPublic || false,
    tags: palaceData.tags || [],
    createdAt: palaceData.createdAt || now,
    updatedAt: palaceData.updatedAt || now,
  };
}

/**
 * Create a new location with defaults
 * @param {Partial<MemoryLocation>} locationData - Partial location data
 * @returns {MemoryLocation}
 */
export function createMemoryLocation(locationData) {
  const now = new Date().toISOString();
  
  return {
    id: locationData.id || generateLocationId(),
    name: locationData.name || 'New Location',
    description: locationData.description || '',
    imageUrl: locationData.imageUrl || null,
    palaceId: locationData.palaceId || '',
    position: locationData.position || { x: 50, y: 50 },
    linkedTaskIds: locationData.linkedTaskIds || [],
    staticReminders: locationData.staticReminders || [],
    icon: locationData.icon || '📍',
    color: locationData.color || LOCATION_COLORS[0],
    createdAt: locationData.createdAt || now,
    updatedAt: locationData.updatedAt || now,
  };
}

/**
 * Validate a palace object
 * @param {MemoryPalace} palace
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePalace(palace) {
  const errors = [];
  
  if (!palace.id) errors.push('Palace ID is required');
  if (!palace.name || palace.name.trim().length === 0) {
    errors.push('Palace name is required');
  }
  if (palace.locations && !Array.isArray(palace.locations)) {
    errors.push('Locations must be an array');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a location object
 * @param {MemoryLocation} location
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLocation(location) {
  const errors = [];
  
  if (!location.id) errors.push('Location ID is required');
  if (!location.name || location.name.trim().length === 0) {
    errors.push('Location name is required');
  }
  if (!location.palaceId) errors.push('Palace ID is required');
  if (!location.position || typeof location.position.x !== 'number' || typeof location.position.y !== 'number') {
    errors.push('Valid position (x, y) is required');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Create a palace from a template
 * @param {keyof typeof PALACE_TEMPLATES} templateKey
 * @returns {MemoryPalace}
 */
export function createPalaceFromTemplate(templateKey) {
  const template = PALACE_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown template: ${templateKey}`);
  }
  
  const palaceId = generatePalaceId();
  const locations = template.suggestedLocations.map((loc, index) => 
    createMemoryLocation({
      ...loc,
      palaceId,
      color: LOCATION_COLORS[index % LOCATION_COLORS.length],
    })
  );
  
  return createMemoryPalace({
    id: palaceId,
    name: template.name,
    description: template.description,
    locations,
  });
}

/**
 * Link a task to a location
 * @param {MemoryLocation} location
 * @param {string} taskId
 * @returns {MemoryLocation}
 */
export function linkTaskToLocation(location, taskId) {
  if (location.linkedTaskIds.includes(taskId)) {
    return location;
  }
  
  return {
    ...location,
    linkedTaskIds: [...location.linkedTaskIds, taskId],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Unlink a task from a location
 * @param {MemoryLocation} location
 * @param {string} taskId
 * @returns {MemoryLocation}
 */
export function unlinkTaskFromLocation(location, taskId) {
  return {
    ...location,
    linkedTaskIds: location.linkedTaskIds.filter(id => id !== taskId),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add a static reminder to a location
 * @param {MemoryLocation} location
 * @param {string} reminder
 * @returns {MemoryLocation}
 */
export function addStaticReminder(location, reminder) {
  return {
    ...location,
    staticReminders: [...location.staticReminders, reminder],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Remove a static reminder from a location
 * @param {MemoryLocation} location
 * @param {number} index
 * @returns {MemoryLocation}
 */
export function removeStaticReminder(location, index) {
  return {
    ...location,
    staticReminders: location.staticReminders.filter((_, i) => i !== index),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get all locations with linked tasks
 * @param {MemoryPalace} palace
 * @returns {MemoryLocation[]}
 */
export function getLocationsWithTasks(palace) {
  return palace.locations.filter(loc => loc.linkedTaskIds.length > 0);
}

/**
 * Get all locations with static reminders
 * @param {MemoryPalace} palace
 * @returns {MemoryLocation[]}
 */
export function getLocationsWithReminders(palace) {
  return palace.locations.filter(loc => loc.staticReminders.length > 0);
}

/**
 * Find location by task ID across all locations in a palace
 * @param {MemoryPalace} palace
 * @param {string} taskId
 * @returns {MemoryLocation|undefined}
 */
export function findLocationByTaskId(palace, taskId) {
  return palace.locations.find(loc => loc.linkedTaskIds.includes(taskId));
}

/**
 * Clone a palace (for sharing/templates)
 * @param {MemoryPalace} palace
 * @param {string} newUserId
 * @returns {MemoryPalace}
 */
export function clonePalace(palace, newUserId) {
  const newPalaceId = generatePalaceId();
  const now = new Date().toISOString();
  
  const clonedLocations = palace.locations.map(loc => 
    createMemoryLocation({
      ...loc,
      id: generateLocationId(),
      palaceId: newPalaceId,
      linkedTaskIds: [], // Don't clone task links
      createdAt: now,
      updatedAt: now,
    })
  );
  
  return createMemoryPalace({
    id: newPalaceId,
    userId: newUserId,
    name: `${palace.name} (Copy)`,
    description: palace.description,
    backgroundImage: palace.backgroundImage,
    locations: clonedLocations,
    isPublic: false,
    tags: [...palace.tags],
    createdAt: now,
    updatedAt: now,
  });
}

export default {
  createMemoryPalace,
  createMemoryLocation,
  validatePalace,
  validateLocation,
  createPalaceFromTemplate,
  linkTaskToLocation,
  unlinkTaskFromLocation,
  addStaticReminder,
  removeStaticReminder,
  getLocationsWithTasks,
  getLocationsWithReminders,
  findLocationByTaskId,
  clonePalace,
  generatePalaceId,
  generateLocationId,
  PALACE_TEMPLATES,
  LOCATION_ICONS,
  LOCATION_COLORS,
};
