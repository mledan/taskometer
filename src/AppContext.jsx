/**
 * AppContext - Legacy Re-export
 *
 * This file re-exports from the new context location for backwards compatibility.
 * New code should import from '@/context' or '@/context/AppContext'.
 *
 * The actual implementation has been moved to ./context/AppContext.jsx with:
 * 1. Structured state with separate slices for tasks, slots, tags, types, schedules
 * 2. Automatic audit logging for all state changes
 * 3. Integration with DatabaseAdapter for persistence
 * 4. New hooks: useTasks, useSlots, useTags, useTaskTypes, useSchedules, useSettings
 * 5. ACTION_TYPES constant for action type safety
 *
 * The legacy reducer actions (ADD_ITEM, UPDATE_ITEM, etc.) are still supported
 * for backwards compatibility.
 */

// Re-export everything from the new context location
export {
  AppContext,
  AppStateProvider,
  useAppState,
  useAppReducer,
  useAppContext,
  useItems,
  useTasks,
  useSlots,
  useTags,
  useTaskTypes,
  useSchedules,
  useSettings,
  ACTION_TYPES
} from './context/AppContext';

// Default export
export { AppContext as default } from './context/AppContext';
