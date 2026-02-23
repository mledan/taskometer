/**
 * ThemeToggle Component
 *
 * A button/toggle for switching between light and dark themes.
 * Supports simple toggle or full theme cycling (including system).
 */

import { useTheme, THEMES } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

function ThemeToggle({ showLabel = false, variant = 'simple' }) {
  const { theme, effectiveTheme, toggleTheme, cycleTheme, setTheme } = useTheme();

  // Get icon based on effective theme
  function getIcon() {
    if (theme === THEMES.SYSTEM) {
      return '🖥️';
    }
    return effectiveTheme === THEMES.DARK ? '🌙' : '☀️';
  }

  // Get label based on current theme setting
  function getLabel() {
    switch (theme) {
      case THEMES.DARK:
        return 'Dark';
      case THEMES.LIGHT:
        return 'Light';
      case THEMES.SYSTEM:
        return 'Auto';
      default:
        return 'Theme';
    }
  }

  // Handle click based on variant
  function handleClick() {
    if (variant === 'cycle') {
      cycleTheme();
    } else {
      toggleTheme();
    }
  }

  // Simple button variant
  if (variant === 'simple' || variant === 'cycle') {
    return (
      <button
        data-tour="theme"
        className={styles.toggleButton}
        onClick={handleClick}
        title={`Current: ${getLabel()}. Click to change.`}
        aria-label={`Toggle theme. Current theme: ${getLabel()}`}
      >
        <span className={styles.icon}>{getIcon()}</span>
        {showLabel && <span className={styles.label}>{getLabel()}</span>}
      </button>
    );
  }

  // Dropdown variant with all options
  if (variant === 'dropdown') {
    return (
      <div className={styles.dropdown}>
        <button
          data-tour="theme"
          className={styles.dropdownTrigger}
          title="Change theme"
          aria-label="Theme options"
        >
          <span className={styles.icon}>{getIcon()}</span>
          {showLabel && <span className={styles.label}>{getLabel()}</span>}
          <span className={styles.chevron}>▼</span>
        </button>
        <div className={styles.dropdownMenu}>
          <button
            className={`${styles.dropdownItem} ${theme === THEMES.LIGHT ? styles.active : ''}`}
            onClick={() => setTheme(THEMES.LIGHT)}
          >
            <span>☀️</span>
            <span>Light</span>
          </button>
          <button
            className={`${styles.dropdownItem} ${theme === THEMES.DARK ? styles.active : ''}`}
            onClick={() => setTheme(THEMES.DARK)}
          >
            <span>🌙</span>
            <span>Dark</span>
          </button>
          <button
            className={`${styles.dropdownItem} ${theme === THEMES.SYSTEM ? styles.active : ''}`}
            onClick={() => setTheme(THEMES.SYSTEM)}
          >
            <span>🖥️</span>
            <span>System</span>
          </button>
        </div>
      </div>
    );
  }

  // Switch variant (animated toggle)
  if (variant === 'switch') {
    return (
      <label className={styles.switch} data-tour="theme">
        <input
          type="checkbox"
          checked={effectiveTheme === THEMES.DARK}
          onChange={toggleTheme}
          aria-label={`Toggle dark mode. Currently ${effectiveTheme === THEMES.DARK ? 'on' : 'off'}`}
        />
        <span className={styles.slider}>
          <span className={styles.switchIcon}>
            {effectiveTheme === THEMES.DARK ? '🌙' : '☀️'}
          </span>
        </span>
        {showLabel && (
          <span className={styles.switchLabel}>
            {effectiveTheme === THEMES.DARK ? 'Dark' : 'Light'}
          </span>
        )}
      </label>
    );
  }

  return null;
}

export default ThemeToggle;
