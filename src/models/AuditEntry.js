/**
 * AuditEntry Model
 *
 * Represents an audit log entry for tracking all changes in the system.
 * This enables history viewing, undo functionality, and analytics.
 *
 * TODO: When migrating to a real database, this model should map to:
 * - PostgreSQL: audit_log table with previousState/newState as JSONB
 * - MongoDB: auditLog collection with embedded state documents
 */

/**
 * @typedef {Object} AuditEntry
 * @property {string} id - Unique identifier
 * @property {string} timestamp - ISO datetime when action occurred
 * @property {string} action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @property {string} entityType - Type of entity affected (task, slot, schedule, etc.)
 * @property {string} entityId - ID of the affected entity
 * @property {string|null} entityName - Human-readable name/text of entity
 * @property {Object|null} previousState - State before the change
 * @property {Object|null} newState - State after the change
 * @property {string[]} changedFields - List of fields that changed
 * @property {string|null} userId - User who made the change
 * @property {string|null} sessionId - Session identifier
 * @property {string} source - Source of the change (user, sync, system, schedule_apply)
 * @property {Object} metadata - Additional context
 */

// Action types for audit logging
export const AUDIT_ACTIONS = {
  // Generic CRUD
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',

  // Task-specific
  TASK_COMPLETE: 'TASK_COMPLETE',
  TASK_PAUSE: 'TASK_PAUSE',
  TASK_RESUME: 'TASK_RESUME',
  TASK_RESCHEDULE: 'TASK_RESCHEDULE',
  TASK_AUTO_SCHEDULE: 'TASK_AUTO_SCHEDULE',

  // Slot-specific
  SLOT_ASSIGN: 'SLOT_ASSIGN',
  SLOT_UNASSIGN: 'SLOT_UNASSIGN',
  SLOT_CONFIGURE: 'SLOT_CONFIGURE',

  // Schedule-specific
  SCHEDULE_APPLY: 'SCHEDULE_APPLY',
  SCHEDULE_APPLY_PARTIAL: 'SCHEDULE_APPLY_PARTIAL',
  SCHEDULE_CLONE: 'SCHEDULE_CLONE',
  SCHEDULE_SHARE: 'SCHEDULE_SHARE',

  // Sync-specific
  SYNC_PUSH: 'SYNC_PUSH',
  SYNC_PULL: 'SYNC_PULL',
  SYNC_CONFLICT: 'SYNC_CONFLICT',

  // Auth-specific
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',

  // System
  DAILY_RESET: 'DAILY_RESET',
  DATA_IMPORT: 'DATA_IMPORT',
  DATA_EXPORT: 'DATA_EXPORT',
  SETTINGS_CHANGE: 'SETTINGS_CHANGE'
};

// Entity types
export const ENTITY_TYPES = {
  TASK: 'task',
  SLOT: 'slot',
  SCHEDULE: 'schedule',
  TAG: 'tag',
  TASK_TYPE: 'taskType',
  USER: 'user',
  SETTINGS: 'settings',
  BATCH: 'batch' // For batch operations
};

// Change sources
export const CHANGE_SOURCES = {
  USER: 'user',
  SYNC: 'sync',
  SYSTEM: 'system',
  SCHEDULE_APPLY: 'schedule_apply',
  AUTO_SCHEDULE: 'auto_schedule',
  IMPORT: 'import'
};

/**
 * Generate a unique ID for an audit entry
 */
export function generateAuditId() {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new audit entry
 * @param {Partial<AuditEntry>} entryData
 * @returns {AuditEntry}
 */
export function createAuditEntry(entryData) {
  const entry = {
    id: entryData.id || generateAuditId(),
    timestamp: entryData.timestamp || new Date().toISOString(),
    action: entryData.action || AUDIT_ACTIONS.UPDATE,
    entityType: entryData.entityType || ENTITY_TYPES.TASK,
    entityId: entryData.entityId || null,
    entityName: entryData.entityName || null,
    previousState: entryData.previousState || null,
    newState: entryData.newState || null,
    changedFields: entryData.changedFields || [],
    userId: entryData.userId || null,
    sessionId: entryData.sessionId || getSessionId(),
    source: entryData.source || CHANGE_SOURCES.USER,
    metadata: entryData.metadata || {}
  };

  // Auto-extract changed fields if not provided
  if (entry.changedFields.length === 0 && entry.previousState && entry.newState) {
    entry.changedFields = getChangedFields(entry.previousState, entry.newState);
  }

  return entry;
}

/**
 * Get or create a session ID for tracking related changes
 */
let currentSessionId = null;
export function getSessionId() {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return currentSessionId;
}

/**
 * Reset session ID (e.g., on page refresh)
 */
export function resetSessionId() {
  currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return currentSessionId;
}

/**
 * Get list of fields that changed between two states
 * @param {Object} previous
 * @param {Object} next
 * @returns {string[]}
 */
export function getChangedFields(previous, next) {
  if (!previous || !next) return [];

  const allKeys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changed = [];

  allKeys.forEach(key => {
    // Skip metadata and timestamps for cleaner diffs
    if (['updatedAt', 'metadata'].includes(key)) return;

    const prevVal = previous[key];
    const nextVal = next[key];

    if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
      changed.push(key);
    }
  });

  return changed;
}

/**
 * Create a human-readable description of an audit entry
 * @param {AuditEntry} entry
 * @returns {string}
 */
export function getAuditDescription(entry) {
  const entityName = entry.entityName || entry.entityId || 'item';
  const action = entry.action.toLowerCase().replace('_', ' ');

  switch (entry.action) {
    case AUDIT_ACTIONS.CREATE:
      return `Created ${entry.entityType} "${entityName}"`;
    case AUDIT_ACTIONS.UPDATE:
      const fields = entry.changedFields.join(', ');
      return `Updated ${entry.entityType} "${entityName}" (${fields || 'properties'})`;
    case AUDIT_ACTIONS.DELETE:
      return `Deleted ${entry.entityType} "${entityName}"`;
    case AUDIT_ACTIONS.TASK_COMPLETE:
      return `Completed task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_PAUSE:
      return `Paused task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_RESUME:
      return `Resumed task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_RESCHEDULE:
      return `Rescheduled task "${entityName}"`;
    case AUDIT_ACTIONS.TASK_AUTO_SCHEDULE:
      return `Auto-scheduled task "${entityName}"`;
    case AUDIT_ACTIONS.SLOT_ASSIGN:
      return `Assigned task to slot`;
    case AUDIT_ACTIONS.SCHEDULE_APPLY:
      return `Applied schedule "${entityName}"`;
    case AUDIT_ACTIONS.SCHEDULE_APPLY_PARTIAL:
      return `Partially applied schedule "${entityName}"`;
    case AUDIT_ACTIONS.SYNC_PUSH:
      return `Synced ${entry.entityType} to calendar`;
    case AUDIT_ACTIONS.SYNC_PULL:
      return `Imported ${entry.entityType} from calendar`;
    case AUDIT_ACTIONS.DAILY_RESET:
      return `Daily reset completed`;
    default:
      return `${action} ${entry.entityType}`;
  }
}

/**
 * Filter audit entries
 * @param {AuditEntry[]} entries
 * @param {Object} filters
 * @returns {AuditEntry[]}
 */
export function filterAuditEntries(entries, filters = {}) {
  return entries.filter(entry => {
    // Date range filter
    if (filters.dateFrom) {
      if (new Date(entry.timestamp) < new Date(filters.dateFrom)) return false;
    }
    if (filters.dateTo) {
      if (new Date(entry.timestamp) > new Date(filters.dateTo)) return false;
    }

    // Action filter
    if (filters.actions && filters.actions.length > 0) {
      if (!filters.actions.includes(entry.action)) return false;
    }

    // Entity type filter
    if (filters.entityTypes && filters.entityTypes.length > 0) {
      if (!filters.entityTypes.includes(entry.entityType)) return false;
    }

    // Entity ID filter
    if (filters.entityId) {
      if (entry.entityId !== filters.entityId) return false;
    }

    // Source filter
    if (filters.sources && filters.sources.length > 0) {
      if (!filters.sources.includes(entry.source)) return false;
    }

    // Text search
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const description = getAuditDescription(entry).toLowerCase();
      const entityName = (entry.entityName || '').toLowerCase();
      if (!description.includes(searchLower) && !entityName.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Group audit entries by date
 * @param {AuditEntry[]} entries
 * @returns {Object}
 */
export function groupAuditByDate(entries) {
  const grouped = {};

  entries.forEach(entry => {
    const date = entry.timestamp.split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(entry);
  });

  // Sort each day's entries by timestamp descending
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  });

  return grouped;
}

/**
 * Get audit statistics
 * @param {AuditEntry[]} entries
 * @returns {Object}
 */
export function getAuditStats(entries) {
  const stats = {
    totalEntries: entries.length,
    byAction: {},
    byEntityType: {},
    bySource: {},
    taskCompletions: 0,
    scheduleApplications: 0,
    syncs: 0
  };

  entries.forEach(entry => {
    // Count by action
    stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;

    // Count by entity type
    stats.byEntityType[entry.entityType] = (stats.byEntityType[entry.entityType] || 0) + 1;

    // Count by source
    stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;

    // Special counts
    if (entry.action === AUDIT_ACTIONS.TASK_COMPLETE) stats.taskCompletions++;
    if (entry.action === AUDIT_ACTIONS.SCHEDULE_APPLY || entry.action === AUDIT_ACTIONS.SCHEDULE_APPLY_PARTIAL) {
      stats.scheduleApplications++;
    }
    if (entry.action === AUDIT_ACTIONS.SYNC_PUSH || entry.action === AUDIT_ACTIONS.SYNC_PULL) {
      stats.syncs++;
    }
  });

  return stats;
}

/**
 * Export audit log to CSV format
 * @param {AuditEntry[]} entries
 * @returns {string}
 */
export function exportAuditToCsv(entries) {
  const headers = [
    'Timestamp',
    'Action',
    'Entity Type',
    'Entity ID',
    'Entity Name',
    'Changed Fields',
    'Source',
    'Description'
  ];

  const rows = entries.map(entry => [
    entry.timestamp,
    entry.action,
    entry.entityType,
    entry.entityId || '',
    entry.entityName || '',
    entry.changedFields.join('; '),
    entry.source,
    getAuditDescription(entry)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell =>
      `"${String(cell).replace(/"/g, '""')}"`
    ).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Create a batch audit entry for multiple changes
 * @param {string} action
 * @param {AuditEntry[]} entries
 * @param {Object} metadata
 * @returns {AuditEntry}
 */
export function createBatchAuditEntry(action, entries, metadata = {}) {
  return createAuditEntry({
    action,
    entityType: ENTITY_TYPES.BATCH,
    entityId: `batch_${entries.length}_items`,
    entityName: `${entries.length} items`,
    previousState: null,
    newState: { entryIds: entries.map(e => e.id) },
    source: entries[0]?.source || CHANGE_SOURCES.USER,
    metadata: {
      ...metadata,
      batchSize: entries.length,
      batchEntryIds: entries.map(e => e.id)
    }
  });
}

export default {
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
};
