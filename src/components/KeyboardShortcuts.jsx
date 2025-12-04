/**
 * KeyboardShortcuts Component
 *
 * Modal that displays all available keyboard shortcuts.
 */

import { useEffect } from 'react';
import { DEFAULT_SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import styles from './KeyboardShortcuts.module.css';

function KeyboardShortcuts({ isOpen, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const groups = {};
  Object.entries(DEFAULT_SHORTCUTS).forEach(([key, shortcut]) => {
    const category = shortcut.category || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({ key, ...shortcut });
  });

  // Format key display
  function formatKey(key) {
    return key
      .split('+')
      .map(k => {
        switch (k) {
          case 'Escape': return 'Esc';
          case 'Delete': return 'Del';
          case 'Enter': return '↵';
          default: return k.toUpperCase();
        }
      })
      .join(' + ');
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {Object.entries(groups).map(([category, shortcuts]) => (
            <div key={category} className={styles.category}>
              <h3 className={styles.categoryTitle}>{category}</h3>
              <div className={styles.shortcutList}>
                {shortcuts.map(({ key, description }) => (
                  <div key={key} className={styles.shortcut}>
                    <span className={styles.description}>{description}</span>
                    <kbd className={styles.key}>{formatKey(key)}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>
            Press <kbd>?</kbd> anytime to show this help
          </span>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcuts;
