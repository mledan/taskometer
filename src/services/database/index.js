/**
 * Database Services Index
 *
 * Central export for database adapters. This allows easy swapping
 * between different storage backends.
 *
 * Usage:
 *   import { createAdapter, LocalStorageAdapter } from '@/services/database';
 *
 *   const db = createAdapter('localStorage');
 *   await db.initialize();
 *
 * TODO: When adding a real backend:
 * 1. Create ApiAdapter.js extending DatabaseAdapter
 * 2. Add it to the adapters map below
 * 3. Configure based on environment or user auth state
 */

import { DatabaseAdapter } from './DatabaseAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';

// Export adapter classes
export { DatabaseAdapter } from './DatabaseAdapter';
export { LocalStorageAdapter } from './LocalStorageAdapter';

// Adapter registry
const adapters = {
  localStorage: LocalStorageAdapter,
  // TODO: Add more adapters as they're implemented
  // api: ApiAdapter,
  // indexedDB: IndexedDBAdapter,
};

// Singleton instance
let currentAdapter = null;

/**
 * Create a database adapter instance
 * @param {string} type - Adapter type ('localStorage', 'api', etc.)
 * @param {Object} options - Adapter-specific options
 * @returns {DatabaseAdapter}
 */
export function createAdapter(type = 'localStorage', options = {}) {
  const AdapterClass = adapters[type];

  if (!AdapterClass) {
    throw new Error(`Unknown adapter type: ${type}. Available: ${Object.keys(adapters).join(', ')}`);
  }

  return new AdapterClass(options);
}

/**
 * Get or create the singleton adapter instance
 * @param {string} type - Adapter type
 * @param {Object} options - Adapter options
 * @returns {Promise<DatabaseAdapter>}
 */
export async function getAdapter(type = 'localStorage', options = {}) {
  if (!currentAdapter) {
    currentAdapter = createAdapter(type, options);
    await currentAdapter.initialize();
  }
  return currentAdapter;
}

/**
 * Reset the singleton adapter (useful for testing or logout)
 */
export function resetAdapter() {
  if (currentAdapter) {
    currentAdapter.close();
    currentAdapter = null;
  }
}

/**
 * Get adapter without initialization (for checking state)
 */
export function getCurrentAdapter() {
  return currentAdapter;
}

/**
 * Check if an adapter is ready
 */
export function isAdapterReady() {
  return currentAdapter?.isReady() || false;
}

// Default export for convenience
export default {
  createAdapter,
  getAdapter,
  resetAdapter,
  getCurrentAdapter,
  isAdapterReady,
  DatabaseAdapter,
  LocalStorageAdapter
};
