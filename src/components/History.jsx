import { useMemo, useState } from 'react';
import { useAppState, useAppReducer, ACTION_TYPES } from '../AppContext.jsx';
import { formatLocalTime } from '../utils/timeDisplay.js';
import { AuditLogViewer, ProductivityDashboard } from './history';
import styles from './History.module.css';

function History() {
  const { items = [], auditLog = [] } = useAppState();
  const dispatch = useAppReducer();
  const [filter, setFilter] = useState('all'); // all, completed, paused, removed
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, audit, analytics

  const historyItems = useMemo(() => {
    const completedOrPaused = items
      .filter(item => item.status === 'completed' || item.status === 'paused')
      .map(item => ({
        ...item,
        historyId: `task-${item.id || item.key}`,
        historyType: item.status
      }));

    const removedFromAudit = auditLog
      .filter(entry => {
        const action = entry.action || entry.actionType;
        return (
          entry.entityType === 'task' &&
          (action === 'DELETE' || action === 'DELETE_TASK')
        );
      })
      .map(entry => {
        const snapshot = entry.previousState || entry.newState || {};
        const taskId = entry.entityId || snapshot.id || snapshot.key || entry.id;
        return {
          ...snapshot,
          id: snapshot.id || taskId,
          key: snapshot.key || taskId,
          text: entry.entityName || snapshot.text || 'Deleted task',
          status: 'removed',
          removedAt: entry.timestamp,
          historyId: `removed-${entry.id}`,
          historyType: 'removed',
          sourceAuditEntryId: entry.id,
          canRestore: Boolean(snapshot.text || entry.entityName)
        };
      });

    return [...completedOrPaused, ...removedFromAudit].sort((a, b) => {
      return new Date(getHistoryTimestamp(b)) - new Date(getHistoryTimestamp(a));
    });
  }, [items, auditLog]);

  // Filter history items based on selected filter
  const filteredItems = historyItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'completed') return item.status === 'completed';
    if (filter === 'paused') return item.status === 'paused';
    if (filter === 'removed') return item.historyType === 'removed';
    return true;
  });

  function restoreItem(item) {
    const itemId = item.id || item.key;

    if (item.historyType === 'removed') {
      if (!item.canRestore) return;
      dispatch({
        type: ACTION_TYPES.ADD_TASK,
        payload: {
          text: item.text || 'Restored task',
          status: 'pending',
          primaryType: item.primaryType || item.taskType || 'work',
          taskType: item.primaryType || item.taskType || 'work',
          tags: item.tags || [],
          duration: item.duration || 30,
          priority: item.priority || 'medium',
          description: item.description || null,
          scheduledTime: null,
          specificDay: null,
          specificTime: null
        }
      });
      return;
    }

    if (!itemId) return;
    dispatch({
      type: ACTION_TYPES.UPDATE_TASK,
      payload: {
        id: itemId,
        status: 'pending',
        completedAt: null
      }
    });
  }

  function permanentlyDelete(item) {
    if (item.historyType === 'removed') return;
    const itemId = item.id || item.key;
    if (!itemId) return;
    dispatch({
      type: ACTION_TYPES.DELETE_TASK,
      payload: { id: itemId }
    });
  }

  function clearHistory() {
    const clearableItems = filteredItems.filter(item => item.historyType !== 'removed');
    if (clearableItems.length === 0) return;

    if (window.confirm('Are you sure you want to clear completed/paused tasks from history?')) {
      clearableItems.forEach(item => {
        const itemId = item.id || item.key;
        if (!itemId) return;
        dispatch({
          type: ACTION_TYPES.DELETE_TASK,
          payload: { id: itemId }
        });
      });
    }
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    try {
      return formatLocalTime(timestamp, 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  }

  // Render task history content
  function renderTaskHistory() {
    return (
      <>
        <div className={styles.historyControls}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="removed">Removed</option>
          </select>
          <button
            onClick={clearHistory}
            className={styles.clearButton}
            disabled={filteredItems.every(item => item.historyType === 'removed')}
          >
            Clear History
          </button>
        </div>

        <div className={styles.historyList}>
          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              No history items to display
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.historyId || item.id || item.key} className={styles.historyItem}>
                <div className={styles.itemInfo}>
                  <span className={`${styles.status} ${styles[item.status]}`}>
                    {item.status}
                  </span>
                  <span className={styles.text}>{item.text}</span>
                  <span className={styles.metadata}>
                    Duration: {item.duration}min |
                    Priority: {item.priority} |
                    Type: {item.primaryType || item.taskType}
                  </span>
                  <span className={styles.timestamp}>
                    {item.completedAt && `Completed: ${formatTimestamp(item.completedAt)}`}
                    {item.status === 'paused' && `Paused: ${formatTimestamp(item.updatedAt)}`}
                    {item.removedAt && `Removed: ${formatTimestamp(item.removedAt)}`}
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    onClick={() => restoreItem(item)}
                    disabled={item.historyType === 'removed' && !item.canRestore}
                    title="Restore to active list"
                  >
                    ↺ Restore
                  </button>
                  {item.historyType !== 'removed' && (
                    <button
                      onClick={() => permanentlyDelete(item)}
                      className={styles.deleteButton}
                      title="Permanently delete"
                    >
                      × Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>History & Analytics</h2>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'tasks' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Task History
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'audit' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Log
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'analytics' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'tasks' && renderTaskHistory()}
        {activeTab === 'audit' && <AuditLogViewer auditLog={auditLog} />}
        {activeTab === 'analytics' && <ProductivityDashboard />}
      </div>
    </div>
  );
}

function getHistoryTimestamp(item) {
  return item.removedAt || item.completedAt || item.updatedAt || item.createdAt || new Date(0).toISOString();
}

export default History;
