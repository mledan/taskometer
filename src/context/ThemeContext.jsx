/**
 * ThemeContext
 *
 * Provides theme management for the application.
 * Supports dark, light, and system (auto) themes.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

// Theme options
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Storage key
const THEME_STORAGE_KEY = 'taskometer-theme';

/**
 * Get the effective theme based on system preference
 * @param {string} theme - Current theme setting
 * @returns {string} - Effective theme (light or dark)
 */
function getEffectiveTheme(theme) {
  if (theme === THEMES.SYSTEM) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? THEMES.DARK
      : THEMES.LIGHT;
  }
  return theme;
}

/**
 * ThemeProvider component
 * Wraps the app and provides theme context
 */
export function ThemeProvider({ children }) {
  // Initialize theme from localStorage or default to system
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && Object.values(THEMES).includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.error('Failed to read theme from localStorage:', e);
    }
    return THEMES.SYSTEM;
  });

  // Track the effective theme (resolved system preference)
  const [effectiveTheme, setEffectiveTheme] = useState(() => getEffectiveTheme(theme));

  // Apply theme to document
  const applyTheme = useCallback((themeValue) => {
    const effective = getEffectiveTheme(themeValue);
    setEffectiveTheme(effective);

    // Apply to document root
    if (themeValue === THEMES.SYSTEM) {
      // Remove data-theme to let CSS media query handle it
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', effective);
    }

    // Also set a class for additional styling hooks
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${effective}`);
  }, []);

  // Set theme and persist
  const setTheme = useCallback((newTheme) => {
    if (!Object.values(THEMES).includes(newTheme)) {
      console.warn('Invalid theme:', newTheme);
      return;
    }

    setThemeState(newTheme);
    applyTheme(newTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e);
    }
  }, [applyTheme]);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme = effectiveTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    setTheme(newTheme);
  }, [effectiveTheme, setTheme]);

  // Cycle through themes: dark -> light -> system -> dark
  const cycleTheme = useCallback(() => {
    const cycle = [THEMES.DARK, THEMES.LIGHT, THEMES.SYSTEM];
    const currentIndex = cycle.indexOf(theme);
    const nextIndex = (currentIndex + 1) % cycle.length;
    setTheme(cycle[nextIndex]);
  }, [theme, setTheme]);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Listen for system preference changes when using system theme
  useEffect(() => {
    if (theme !== THEMES.SYSTEM) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  const value = {
    theme,           // Current setting (light, dark, or system)
    effectiveTheme,  // Resolved theme (light or dark)
    setTheme,        // Set specific theme
    toggleTheme,     // Toggle between light and dark
    cycleTheme,      // Cycle through all themes
    isDark: effectiveTheme === THEMES.DARK,
    isLight: effectiveTheme === THEMES.LIGHT,
    isSystem: theme === THEMES.SYSTEM
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
