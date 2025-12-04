/**
 * Calendar Sync Services Index
 *
 * Export all calendar sync services from a single entry point.
 */

export { default as googleCalendarSync, googleCalendarSync as GoogleCalendarSync } from './GoogleCalendarSync';
export { default as appleCalendarSync, appleCalendarSync as AppleCalendarSync } from './AppleCalendarSync';

/**
 * Sync status constants
 */
export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Get the appropriate sync service based on provider
 * @param {string} provider - 'google' or 'apple'
 * @returns {Object|null}
 */
export function getSyncService(provider) {
  switch (provider) {
    case 'google':
      return googleCalendarSync;
    case 'apple':
      return appleCalendarSync;
    default:
      return null;
  }
}

/**
 * Check if any sync service is available
 * @param {Object} authState - Current auth state
 * @returns {boolean}
 */
export function isSyncAvailable(authState) {
  if (!authState?.isAuthenticated) return false;

  switch (authState.provider) {
    case 'google':
      return true; // Google sync is implemented
    case 'apple':
      return false; // Apple sync requires backend setup
    default:
      return false;
  }
}
