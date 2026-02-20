/**
 * AuditLogViewer Component
 *
 * Displays a searchable, filterable view of the audit log.
 * Shows all actions taken in the app with timestamps.
 *
 * Features:
 * - Filter by action type (task, slot, schedule, etc.)
 * - Filter by date range
 * - Search through log entries
 * - Expandable details for each entry
 * - Export log data
 */

import { useState, useMemo } from 'react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { AUDIT_ACTIONS } from '../../models/AuditEntry';
import styles from './AuditLogViewer.module.css';

// Action type icons
const ACTION_ICONS = {
  // New audit model actions
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  TASK_COMPLETE: '✅',
  TASK_PAUSE: '⏸️',
  TASK_RESUME: '▶️',
  TASK_RESCHEDULE: '🔄',
  SCHEDULE_APPLY: '📋',
  SYNC_PUSH: '⬆️',
  SYNC_PULL: '⬇️',
  USER_LOGIN: '🔐',
  USER_LOGOUT: '🚪',
  DAILY_RESET: '🧹',
  SETTINGS_CHANGE: '⚙️',
  DATA_IMPORT: '📥',
  DATA_EXPORT: '📤',
  // Legacy action keys kept for backwards compatibility
  ADD_TASK: '➕',
  UPDATE_TASK: '✏️',
  DELETE_TASK: '🗑️',
  COMPLETE_TASK: '✅',
  PAUSE_TASK: '⏸️',
  ADD_SLOT: '📅',
  UPDATE_SLOT: '📝',
  DELETE_SLOT: '❌',
  ASSIGN_TASK_TO_SLOT: '🔗',
  ADD_TAG: '🏷️',
  UPDATE_TAG: '✏️',
  DELETE_TAG: '🗑️',
  ADD_SCHEDULE: '📋',
  UPDATE_SCHEDULE: '✏️',
  DELETE_SCHEDULE: '🗑️',
  APPLY_SCHEDULE: '▶️',
  SYNC_START: '🔄',
  SYNC_SUCCESS: '✅',
  SYNC_ERROR: '❌',
  LOGIN: '🔐',
  LOGOUT: '🚪'
};

// Category groupings
const ACTION_CATEGORIES = {
  tasks: ['TASK_COMPLETE', 'TASK_PAUSE', 'TASK_RESUME', 'TASK_RESCHEDULE', 'ADD_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'COMPLETE_TASK', 'PAUSE_TASK'],
  slots: ['SLOT_ASSIGN', 'SLOT_UNASSIGN', 'SLOT_CONFIGURE', 'ADD_SLOT', 'UPDATE_SLOT', 'DELETE_SLOT', 'ASSIGN_TASK_TO_SLOT'],
  schedules: ['SCHEDULE_APPLY', 'SCHEDULE_APPLY_PARTIAL', 'ADD_SCHEDULE', 'UPDATE_SCHEDULE', 'DELETE_SCHEDULE', 'APPLY_SCHEDULE'],
  tags: ['CREATE', 'UPDATE', 'DELETE', 'ADD_TAG', 'UPDATE_TAG', 'DELETE_TAG'],
  sync: ['SYNC_PUSH', 'SYNC_PULL', 'SYNC_CONFLICT', 'SYNC_START', 'SYNC_SUCCESS', 'SYNC_ERROR'],
  auth: ['USER_LOGIN', 'USER_LOGOUT', 'LOGIN', 'LOGOUT']
};

function AuditLogViewer({
  auditLog = [],
  maxEntries = 500
}) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // UI state
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  function getEntryAction(entry) {
    return entry.action || entry.actionType || AUDIT_ACTIONS.UPDATE;
  }

  function getEntryDetails(entry) {
    const details = entry.details ? { ...entry.details } : {};
    if (entry.changedFields?.length) {
      details.changedFields = entry.changedFields.join(', ');
    }
    if (entry.source) {
      details.source = entry.source;
    }
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      details.metadata = entry.metadata;
    }
    if (entry.previousState) {
      details.previousState = entry.previousState;
    }
    if (entry.newState) {
      details.newState = entry.newState;
    }
    return details;
  }

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let entries = [...auditLog].slice(0, maxEntries);

    // Filter by category
    if (selectedCategory !== 'all') {
      const allowedActions = ACTION_CATEGORIES[selectedCategory] || [];
      entries = entries.filter(entry =>
        allowedActions.includes(getEntryAction(entry))
      );
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? parseISO(dateFrom) : new Date(0);
      const toDate = dateTo ? parseISO(dateTo + 'T23:59:59') : new Date();

      entries = entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return isWithinInterval(entryDate, { start: fromDate, end: toDate });
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      entries = entries.filter(entry => {
        const searchable = [
          getEntryAction(entry),
          entry.description,
          JSON.stringify(getEntryDetails(entry)),
          entry.entityType,
          entry.entityId
        ].join(' ').toLowerCase();
        return searchable.includes(query);
      });
    }

    // Sort
    entries.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return entries;
  }, [auditLog, selectedCategory, dateFrom, dateTo, searchQuery, sortOrder, maxEntries]);

  /**
   * Toggle entry expansion
   */
  function toggleEntry(entryId) {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  /**
   * Format timestamp for display
   */
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  }

  /**
   * Get human-readable action description
   */
  function getActionDescription(entry) {
    if (entry.description) return entry.description;
    const action = getEntryAction(entry);

    const templates = {
      CREATE: 'Created item',
      UPDATE: 'Updated item',
      DELETE: 'Deleted item',
      TASK_COMPLETE: 'Completed task',
      TASK_PAUSE: 'Paused task',
      TASK_RESUME: 'Resumed task',
      TASK_RESCHEDULE: 'Rescheduled task',
      SCHEDULE_APPLY: 'Applied schedule',
      SCHEDULE_APPLY_PARTIAL: 'Partially applied schedule',
      SYNC_PUSH: 'Synced changes to calendar',
      SYNC_PULL: 'Imported changes from calendar',
      SYNC_CONFLICT: 'Sync conflict detected',
      USER_LOGIN: 'Logged in',
      USER_LOGOUT: 'Logged out',
      DAILY_RESET: 'Daily reset completed',
      SETTINGS_CHANGE: 'Changed settings',
      DATA_IMPORT: 'Imported data',
      DATA_EXPORT: 'Exported data',
      ADD_TASK: 'Created task',
      UPDATE_TASK: 'Updated task',
      DELETE_TASK: 'Deleted task',
      COMPLETE_TASK: 'Completed task',
      PAUSE_TASK: 'Paused task',
      ADD_SLOT: 'Created calendar slot',
      UPDATE_SLOT: 'Updated calendar slot',
      DELETE_SLOT: 'Deleted calendar slot',
      ASSIGN_TASK_TO_SLOT: 'Assigned task to slot',
      ADD_TAG: 'Created tag',
      UPDATE_TAG: 'Updated tag',
      DELETE_TAG: 'Deleted tag',
      ADD_SCHEDULE: 'Created schedule',
      UPDATE_SCHEDULE: 'Updated schedule',
      DELETE_SCHEDULE: 'Deleted schedule',
      APPLY_SCHEDULE: 'Applied schedule',
      SYNC_START: 'Started calendar sync',
      SYNC_SUCCESS: 'Calendar sync completed',
      SYNC_ERROR: 'Calendar sync failed',
      LOGIN: 'Logged in',
      LOGOUT: 'Logged out'
    };

    return templates[action] || action;
  }

  /**
   * Export audit log as JSON
   */
  function handleExport() {
    const data = {
      exportedAt: new Date().toISOString(),
      entries: filteredEntries,
      filters: {
        category: selectedCategory,
        dateFrom,
        dateTo,
        searchQuery
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskometer-audit-log-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all filters
   */
  function clearFilters() {
    setSearchQuery('');
    setSelectedCategory('all');
    setDateFrom('');
    setDateTo('');
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2>Activity Log</h2>
        <span className={styles.count}>
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        {/* Search */}
        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search activity log..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Category filter */}
        <div className={styles.filterRow}>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className={styles.categorySelect}
          >
            <option value="all">All Categories</option>
            <option value="tasks">Tasks</option>
            <option value="slots">Calendar Slots</option>
            <option value="schedules">Schedules</option>
            <option value="tags">Tags</option>
            <option value="sync">Sync</option>
            <option value="auth">Authentication</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className={styles.dateInput}
            placeholder="From date"
          />

          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className={styles.dateInput}
            placeholder="To date"
            min={dateFrom}
          />

          <button
            className={styles.sortButton}
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            title={`Sort ${sortOrder === 'desc' ? 'oldest first' : 'newest first'}`}
          >
            {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>

        {/* Filter actions */}
        <div className={styles.filterActions}>
          {(searchQuery || selectedCategory !== 'all' || dateFrom || dateTo) && (
            <button className={styles.clearButton} onClick={clearFilters}>
              Clear Filters
            </button>
          )}
          <button className={styles.exportButton} onClick={handleExport}>
            📤 Export
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div className={styles.logList}>
        {filteredEntries.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            <p>No activity found</p>
            {(searchQuery || selectedCategory !== 'all' || dateFrom || dateTo) && (
              <button className={styles.clearButton} onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          filteredEntries.map(entry => {
            const details = getEntryDetails(entry);
            const action = getEntryAction(entry);
            const hasDetails = Object.keys(details).length > 0;

            return (
              <div
                key={entry.id}
                className={`${styles.logEntry} ${expandedEntries.has(entry.id) ? styles.expanded : ''}`}
                onClick={() => toggleEntry(entry.id)}
              >
                <div className={styles.entryMain}>
                  <span className={styles.entryIcon}>
                    {ACTION_ICONS[action] || '📌'}
                  </span>
                  <div className={styles.entryContent}>
                    <span className={styles.entryDescription}>
                      {getActionDescription(entry)}
                    </span>
                    {entry.entityName && (
                      <span className={styles.entityName}>{entry.entityName}</span>
                    )}
                  </div>
                  <span className={styles.entryTime}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                {/* Expanded details */}
                {expandedEntries.has(entry.id) && hasDetails && (
                  <div className={styles.entryDetails}>
                    <div className={styles.detailsGrid}>
                      {entry.entityType && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Type:</span>
                          <span className={styles.detailValue}>{entry.entityType}</span>
                        </div>
                      )}
                      {entry.entityId && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>ID:</span>
                          <span className={styles.detailValue}>{entry.entityId}</span>
                        </div>
                      )}
                      {Object.entries(details).map(([key, value]) => (
                        <div key={key} className={styles.detailItem}>
                          <span className={styles.detailLabel}>{key}:</span>
                          <span className={styles.detailValue}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AuditLogViewer;
