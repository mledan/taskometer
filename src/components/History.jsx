import { useState, useEffect } from 'react';
import { useAppState, useAppReducer } from '../AppContext.jsx';
import { format } from 'date-fns';
import styles from './History.module.css';

function History() {
  const { items } = useAppState();
  const dispatch = useAppReducer();
  const [historyItems, setHistoryItems] = useState([]);
  const [filter, setFilter] = useState('all'); // all, completed, paused, removed

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('taskometer-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistoryItems(parsed);
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }
  }, []);

  // Save completed/paused items to history
  useEffect(() => {
    const completedItems = items.filter(item => item.status === 'completed');
    const pausedItems = items.filter(item => item.status === 'paused');
    
    // Get existing history
    const savedHistory = localStorage.getItem('taskometer-history');
    let history = [];
    
    if (savedHistory) {
      try {
        history = JSON.parse(savedHistory);
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }
    
    // Add completed items to history if not already there
    completedItems.forEach(item => {
      if (!history.find(h => h.key === item.key)) {
        history.push({
          ...item,
          completedAt: new Date().toISOString(),
          action: 'completed'
        });
      }
    });
    
    // Update paused items in history
    pausedItems.forEach(item => {
      const existingIndex = history.findIndex(h => h.key === item.key);
      if (existingIndex >= 0) {
        history[existingIndex] = {
          ...item,
          pausedAt: new Date().toISOString(),
          action: 'paused'
        };
      } else {
        history.push({
          ...item,
          pausedAt: new Date().toISOString(),
          action: 'paused'
        });
      }
    });
    
    // Save updated history
    localStorage.setItem('taskometer-history', JSON.stringify(history));
    setHistoryItems(history);
  }, [items]);

  // Filter history items based on selected filter
  const filteredItems = historyItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'completed') return item.status === 'completed';
    if (filter === 'paused') return item.status === 'paused';
    if (filter === 'removed') return item.action === 'removed';
    return true;
  });

  function restoreItem(item) {
    // Re-add the item to the active list
    dispatch({
      type: 'ADD_ITEM',
      item: {
        ...item,
        status: 'pending',
        key: Date.now(), // New key to avoid conflicts
        scheduledTime: null
      }
    });

    // Remove from history
    const updatedHistory = historyItems.filter(h => h.key !== item.key);
    localStorage.setItem('taskometer-history', JSON.stringify(updatedHistory));
    setHistoryItems(updatedHistory);
  }

  function permanentlyDelete(item) {
    // Remove from history permanently
    const updatedHistory = historyItems.filter(h => h.key !== item.key);
    localStorage.setItem('taskometer-history', JSON.stringify(updatedHistory));
    setHistoryItems(updatedHistory);
  }

  function clearHistory() {
    if (window.confirm('Are you sure you want to clear all history?')) {
      localStorage.setItem('taskometer-history', JSON.stringify([]));
      setHistoryItems([]);
    }
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    try {
      return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Task History</h2>
        <div className={styles.controls}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="removed">Removed</option>
          </select>
          <button onClick={clearHistory} className={styles.clearButton}>
            Clear History
          </button>
        </div>
      </div>

      <div className={styles.historyList}>
        {filteredItems.length === 0 ? (
          <div className={styles.emptyState}>
            No history items to display
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.key} className={styles.historyItem}>
              <div className={styles.itemInfo}>
                <span className={`${styles.status} ${styles[item.status]}`}>
                  {item.status}
                </span>
                <span className={styles.text}>{item.text}</span>
                <span className={styles.metadata}>
                  Duration: {item.duration}min | 
                  Priority: {item.priority} | 
                  Type: {item.taskType}
                </span>
                <span className={styles.timestamp}>
                  {item.completedAt && `Completed: ${formatTimestamp(item.completedAt)}`}
                  {item.pausedAt && `Paused: ${formatTimestamp(item.pausedAt)}`}
                  {item.removedAt && `Removed: ${formatTimestamp(item.removedAt)}`}
                </span>
              </div>
              <div className={styles.actions}>
                <button onClick={() => restoreItem(item)} title="Restore to active list">
                  ↺ Restore
                </button>
                <button 
                  onClick={() => permanentlyDelete(item)} 
                  className={styles.deleteButton}
                  title="Permanently delete"
                >
                  × Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default History;
