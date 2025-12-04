/**
 * Audit Logger Utility
 *
 * Provides audit logging functionality for tracking all changes in the application.
 * Works with the DatabaseAdapter to persist audit entries.
 *
 * TODO: When migrating to a real database:
 * - Audit entries should be stored in a dedicated audit_log table
 * - Consider using database triggers for automatic auditing
 * - Add user session tracking for multi-user support
 */

import {
  createAuditEntry,
  getChangedFields,
  getAuditDescription,
  filterAuditEntries,
  groupAuditByDate,
  getAuditStats,
  exportAuditToCsv,
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  CHANGE_SOURCES,
  getSessionId
} from '../models/AuditEntry';

// In-memory audit log for quick access (synced with database)
let auditLog = [];

// Max entries to keep in memory
const MAX_MEMORY_ENTRIES = 1000;

// Database adapter reference (set during initialization)
let dbAdapter = null;

/**
 * Initialize the audit logger with a database adapter
 * @param {DatabaseAdapter} adapter
 */
export async function initializeAuditLogger(adapter) {
  dbAdapter = adapter;

  // Load recent entries from database
  if (dbAdapter) {
    try {
      const result = await dbAdapter.queryAuditEntries({
        limit: MAX_MEMORY_ENTRIES,
        sortOrder: 'desc'
      });
      auditLog = result.data || [];
    } catch (error) {
      console.error('[AuditLogger] Failed to load audit history:', error);
    }
  }
}

/**
 * Log an action
 * @param {string} action - Action type from AUDIT_ACTIONS
 * @param {string} entityType - Entity type from ENTITY_TYPES
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Created audit entry
 */
export async function logAction(action, entityType, options = {}) {
  const entry = createAuditEntry({
    action,
    entityType,
    entityId: options.entityId,
    entityName: options.entityName,
    previousState: options.previousState,
    newState: options.newState,
    changedFields: options.changedFields || getChangedFields(options.previousState, options.newState),
    source: options.source || CHANGE_SOURCES.USER,
    metadata: options.metadata || {}
  });

  // Add to memory
  auditLog.push(entry);
  if (auditLog.length > MAX_MEMORY_ENTRIES) {
    auditLog = auditLog.slice(-MAX_MEMORY_ENTRIES);
  }

  // Persist to database
  if (dbAdapter) {
    try {
      await dbAdapter.createAuditEntry(entry);
    } catch (error) {
      console.error('[AuditLogger] Failed to persist audit entry:', error);
    }
  }

  return entry;
}

/**
 * Log a task action
 */
export async function logTaskAction(action, task, previousTask = null) {
  return logAction(action, ENTITY_TYPES.TASK, {
    entityId: task.id || task.key?.toString(),
    entityName: task.text,
    previousState: previousTask,
    newState: task
  });
}

/**
 * Log a slot action
 */
export async function logSlotAction(action, slot, previousSlot = null) {
  return logAction(action, ENTITY_TYPES.SLOT, {
    entityId: slot.id,
    entityName: slot.label,
    previousState: previousSlot,
    newState: slot
  });
}

/**
 * Log a schedule action
 */
export async function logScheduleAction(action, schedule, options = {}) {
  return logAction(action, ENTITY_TYPES.SCHEDULE, {
    entityId: schedule.id,
    entityName: schedule.name,
    previousState: options.previousState,
    newState: schedule,
    metadata: options.metadata
  });
}

/**
 * Log a schedule application
 */
export async function logScheduleApplication(schedule, appliedBlocks, options = {}) {
  return logAction(
    options.partial ? AUDIT_ACTIONS.SCHEDULE_APPLY_PARTIAL : AUDIT_ACTIONS.SCHEDULE_APPLY,
    ENTITY_TYPES.SCHEDULE,
    {
      entityId: schedule.id,
      entityName: schedule.name,
      newState: {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        blocksApplied: appliedBlocks.length,
        categories: options.categories,
        targetDays: options.targetDays,
        isRecurring: options.isRecurring
      },
      source: CHANGE_SOURCES.SCHEDULE_APPLY,
      metadata: {
        appliedBlockIds: appliedBlocks.map(b => b.id),
        conflictResolution: options.conflictResolution
      }
    }
  );
}

/**
 * Log a sync action
 */
export async function logSyncAction(action, syncResult) {
  return logAction(action, ENTITY_TYPES.BATCH, {
    entityName: `Sync ${action === AUDIT_ACTIONS.SYNC_PUSH ? 'to' : 'from'} calendar`,
    newState: syncResult,
    source: CHANGE_SOURCES.SYNC,
    metadata: {
      itemsAffected: syncResult.itemsAffected,
      provider: syncResult.provider
    }
  });
}

/**
 * Log batch operations
 * @param {string} action
 * @param {Object[]} items
 * @param {Object} metadata
 */
export async function logBatchAction(action, items, metadata = {}) {
  const entries = items.map(item => createAuditEntry({
    action,
    entityType: metadata.entityType || ENTITY_TYPES.TASK,
    entityId: item.id || item.key?.toString(),
    entityName: item.text || item.name || item.label,
    newState: item,
    source: metadata.source || CHANGE_SOURCES.USER
  }));

  // Add all to memory
  auditLog.push(...entries);
  if (auditLog.length > MAX_MEMORY_ENTRIES) {
    auditLog = auditLog.slice(-MAX_MEMORY_ENTRIES);
  }

  // Batch persist to database
  if (dbAdapter) {
    try {
      await dbAdapter.batchCreateAuditEntries(entries);
    } catch (error) {
      console.error('[AuditLogger] Failed to persist batch audit entries:', error);
    }
  }

  return entries;
}

/**
 * Get audit log entries
 * @param {Object} filters
 * @returns {Object[]}
 */
export function getAuditLog(filters = {}) {
  return filterAuditEntries(auditLog, filters);
}

/**
 * Get audit log grouped by date
 * @param {Object} filters
 * @returns {Object}
 */
export function getAuditLogByDate(filters = {}) {
  const filtered = filterAuditEntries(auditLog, filters);
  return groupAuditByDate(filtered);
}

/**
 * Get audit statistics
 * @param {Object} filters
 * @returns {Object}
 */
export function getAuditStatistics(filters = {}) {
  const filtered = filterAuditEntries(auditLog, filters);
  return getAuditStats(filtered);
}

/**
 * Get audit history for a specific entity
 * @param {string} entityType
 * @param {string} entityId
 * @returns {Object[]}
 */
export function getEntityHistory(entityType, entityId) {
  return auditLog.filter(
    entry => entry.entityType === entityType && entry.entityId === entityId
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Export audit log to CSV
 * @param {Object} filters
 * @returns {string}
 */
export function exportAuditLog(filters = {}) {
  const filtered = filterAuditEntries(auditLog, filters);
  return exportAuditToCsv(filtered);
}

/**
 * Clear in-memory audit log (doesn't affect database)
 */
export function clearMemoryLog() {
  auditLog = [];
}

/**
 * Get productivity metrics from audit log
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo - YYYY-MM-DD
 * @returns {Object}
 */
export function getProductivityMetrics(dateFrom, dateTo) {
  const filtered = filterAuditEntries(auditLog, {
    dateFrom: `${dateFrom}T00:00:00.000Z`,
    dateTo: `${dateTo}T23:59:59.999Z`
  });

  const metrics = {
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksPaused: 0,
    tasksRescheduled: 0,
    schedulesApplied: 0,
    syncs: 0,
    byDay: {},
    byHour: {}
  };

  filtered.forEach(entry => {
    // Count by action
    switch (entry.action) {
      case AUDIT_ACTIONS.CREATE:
        if (entry.entityType === ENTITY_TYPES.TASK) metrics.tasksCreated++;
        break;
      case AUDIT_ACTIONS.TASK_COMPLETE:
        metrics.tasksCompleted++;
        break;
      case AUDIT_ACTIONS.TASK_PAUSE:
        metrics.tasksPaused++;
        break;
      case AUDIT_ACTIONS.TASK_RESCHEDULE:
        metrics.tasksRescheduled++;
        break;
      case AUDIT_ACTIONS.SCHEDULE_APPLY:
      case AUDIT_ACTIONS.SCHEDULE_APPLY_PARTIAL:
        metrics.schedulesApplied++;
        break;
      case AUDIT_ACTIONS.SYNC_PUSH:
      case AUDIT_ACTIONS.SYNC_PULL:
        metrics.syncs++;
        break;
    }

    // Group by day
    const day = entry.timestamp.split('T')[0];
    if (!metrics.byDay[day]) {
      metrics.byDay[day] = { created: 0, completed: 0, paused: 0 };
    }
    if (entry.action === AUDIT_ACTIONS.CREATE && entry.entityType === ENTITY_TYPES.TASK) {
      metrics.byDay[day].created++;
    }
    if (entry.action === AUDIT_ACTIONS.TASK_COMPLETE) {
      metrics.byDay[day].completed++;
    }
    if (entry.action === AUDIT_ACTIONS.TASK_PAUSE) {
      metrics.byDay[day].paused++;
    }

    // Group by hour (for activity patterns)
    const hour = new Date(entry.timestamp).getHours();
    metrics.byHour[hour] = (metrics.byHour[hour] || 0) + 1;
  });

  // Calculate completion rate
  metrics.completionRate = metrics.tasksCreated > 0
    ? Math.round((metrics.tasksCompleted / metrics.tasksCreated) * 100)
    : 0;

  return metrics;
}

/**
 * Create middleware function for reducer auditing
 * @param {Function} dispatch - Original dispatch function
 * @returns {Function} Wrapped dispatch with auditing
 */
export function createAuditMiddleware(dispatch) {
  return (action) => {
    // Dispatch the action first
    dispatch(action);

    // Then log it (async, non-blocking)
    const auditableActions = {
      ADD_TASK: AUDIT_ACTIONS.CREATE,
      ADD_ITEM: AUDIT_ACTIONS.CREATE,
      UPDATE_TASK: AUDIT_ACTIONS.UPDATE,
      UPDATE_ITEM: AUDIT_ACTIONS.UPDATE,
      DELETE_TASK: AUDIT_ACTIONS.DELETE,
      DELETE_ITEM: AUDIT_ACTIONS.DELETE,
      COMPLETE_TASK: AUDIT_ACTIONS.TASK_COMPLETE,
      PAUSE_TASK: AUDIT_ACTIONS.TASK_PAUSE,
      RESUME_TASK: AUDIT_ACTIONS.TASK_RESUME,
      RESCHEDULE_TASK: AUDIT_ACTIONS.TASK_RESCHEDULE,
      ADD_SLOT: AUDIT_ACTIONS.CREATE,
      UPDATE_SLOT: AUDIT_ACTIONS.UPDATE,
      DELETE_SLOT: AUDIT_ACTIONS.DELETE,
      APPLY_SCHEDULE: AUDIT_ACTIONS.SCHEDULE_APPLY,
      APPLY_TEMPLATE_BLOCKS: AUDIT_ACTIONS.SCHEDULE_APPLY
    };

    const auditAction = auditableActions[action.type];
    if (auditAction) {
      const payload = action.payload || action.item || {};
      logAction(auditAction, getEntityTypeFromAction(action.type), {
        entityId: payload.id || payload.key?.toString() || payload.taskId || payload.slotId,
        entityName: payload.text || payload.name || payload.label,
        newState: payload,
        source: CHANGE_SOURCES.USER
      }).catch(err => console.error('[AuditLogger] Middleware error:', err));
    }
  };
}

/**
 * Helper to determine entity type from action type
 */
function getEntityTypeFromAction(actionType) {
  if (actionType.includes('TASK') || actionType.includes('ITEM')) return ENTITY_TYPES.TASK;
  if (actionType.includes('SLOT')) return ENTITY_TYPES.SLOT;
  if (actionType.includes('TAG')) return ENTITY_TYPES.TAG;
  if (actionType.includes('TYPE')) return ENTITY_TYPES.TASK_TYPE;
  if (actionType.includes('SCHEDULE')) return ENTITY_TYPES.SCHEDULE;
  return ENTITY_TYPES.TASK;
}

// Export constants for convenience
export {
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  CHANGE_SOURCES,
  getSessionId,
  getAuditDescription
};

export default {
  initializeAuditLogger,
  logAction,
  logTaskAction,
  logSlotAction,
  logScheduleAction,
  logScheduleApplication,
  logSyncAction,
  logBatchAction,
  getAuditLog,
  getAuditLogByDate,
  getAuditStatistics,
  getEntityHistory,
  exportAuditLog,
  getProductivityMetrics,
  createAuditMiddleware,
  clearMemoryLog,
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  CHANGE_SOURCES
};
