/**
 * useKeyboardShortcuts Hook
 *
 * Manages global keyboard shortcuts for the application.
 */

import { useEffect, useCallback, useState } from 'react';

// Default shortcuts configuration
export const DEFAULT_SHORTCUTS = {
  // Navigation
  'g+t': { action: 'goToTodos', description: 'Go to Todos', category: 'Navigation' },
  'g+c': { action: 'goToCalendar', description: 'Go to Calendar', category: 'Navigation' },
  'g+s': { action: 'goToSchedules', description: 'Go to Schedules', category: 'Navigation' },
  'g+h': { action: 'goToHistory', description: 'Go to History', category: 'Navigation' },
  'g+y': { action: 'goToTaskTypes', description: 'Go to Task Types', category: 'Navigation' },

  // Actions
  'n': { action: 'newTask', description: 'New Task', category: 'Actions' },
  'Escape': { action: 'cancel', description: 'Cancel / Close', category: 'Actions' },
  '/': { action: 'search', description: 'Search', category: 'Actions' },

  // Task actions
  'Enter': { action: 'confirm', description: 'Confirm / Complete', category: 'Tasks' },
  'Delete': { action: 'delete', description: 'Delete selected', category: 'Tasks' },
  'e': { action: 'edit', description: 'Edit selected', category: 'Tasks' },
  'p': { action: 'pause', description: 'Pause task', category: 'Tasks' },

  // View
  'd': { action: 'toggleDarkMode', description: 'Toggle dark mode', category: 'View' },
  '?': { action: 'showHelp', description: 'Show keyboard shortcuts', category: 'View' },
};

// Storage key for custom shortcuts
const SHORTCUTS_KEY = 'taskometer-shortcuts';

/**
 * Hook to manage keyboard shortcuts
 * @param {Object} handlers - Map of action names to handler functions
 * @param {Object} options - Options
 * @returns {Object} - Shortcut utilities
 */
export function useKeyboardShortcuts(handlers = {}, options = {}) {
  const {
    enabled = true,
    preventDefault = true,
    enableInInputs = false
  } = options;

  const [shortcuts, setShortcuts] = useState(() => {
    try {
      const saved = localStorage.getItem(SHORTCUTS_KEY);
      if (saved) {
        return { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load shortcuts:', e);
    }
    return DEFAULT_SHORTCUTS;
  });

  const [keySequence, setKeySequence] = useState([]);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Reset key sequence after timeout
  useEffect(() => {
    if (keySequence.length > 0) {
      const timer = setTimeout(() => {
        setKeySequence([]);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [keySequence]);

  // Handle key press
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;

    // Skip if typing in input/textarea (unless enabled)
    if (!enableInInputs) {
      const target = event.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }
    }

    // Build the key string
    const key = event.key;
    const newSequence = [...keySequence, key];

    // Check for multi-key shortcuts (like g+t)
    const sequenceStr = newSequence.join('+');

    // Check if this matches a shortcut
    const shortcut = shortcuts[sequenceStr] || shortcuts[key];

    if (shortcut) {
      const handler = handlers[shortcut.action];
      if (handler) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
        setKeySequence([]);
        return;
      }
    }

    // Check if this could be the start of a multi-key shortcut
    const couldBeMultiKey = Object.keys(shortcuts).some(
      s => s.startsWith(sequenceStr + '+')
    );

    if (couldBeMultiKey) {
      setKeySequence(newSequence);
    } else {
      setKeySequence([]);
    }
  }, [enabled, enableInInputs, keySequence, shortcuts, handlers, preventDefault]);

  // Set up event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Update shortcut
  const updateShortcut = useCallback((key, newKey) => {
    setShortcuts(prev => {
      const updated = { ...prev };
      const shortcut = updated[key];
      delete updated[key];
      updated[newKey] = shortcut;

      try {
        localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save shortcuts:', e);
      }

      return updated;
    });
  }, []);

  // Reset shortcuts to defaults
  const resetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    try {
      localStorage.removeItem(SHORTCUTS_KEY);
    } catch (e) {
      console.error('Failed to reset shortcuts:', e);
    }
  }, []);

  // Get shortcuts grouped by category
  const getGroupedShortcuts = useCallback(() => {
    const groups = {};
    Object.entries(shortcuts).forEach(([key, shortcut]) => {
      const category = shortcut.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push({ key, ...shortcut });
    });
    return groups;
  }, [shortcuts]);

  return {
    shortcuts,
    keySequence,
    showHelpModal,
    setShowHelpModal,
    updateShortcut,
    resetShortcuts,
    getGroupedShortcuts
  };
}

export default useKeyboardShortcuts;
