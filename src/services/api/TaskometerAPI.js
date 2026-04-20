/**
 * TaskometerAPI — domain façade the UI depends on.
 *
 * SOLID posture:
 *  - Single responsibility: every method is a use-case, not a storage verb.
 *    (toggleTask, completeTask, exportICS, importBackup, ...)
 *  - Interface-segregation: callers get only the slice they need via the
 *    `namespaces` pattern (api.tasks.*, api.slots.*, api.backup.*).
 *  - Dependency-inversion: views never import a storage adapter directly.
 *    When a real server lands, swap the backing `DatabaseAdapter` in
 *    `services/database/index.js` and this façade stays identical.
 *
 * Two delivery modes exist today:
 *  1) in-session: dispatched through the AppContext reducer so the React
 *     tree re-renders immediately (and the reducer persists via the
 *     adapter).
 *  2) direct: calls `DatabaseAdapter` for pure data I/O (backup/restore,
 *     export). No UI state.
 *
 * Both modes end up in the same browser store. `makeTaskometerAPI` is the
 * composition root — bind it once at the React root.
 */

import { ACTION_TYPES } from '../../context/AppContext';
import { getAdapter } from '../database';
import { buildICS, downloadText } from './ics';

/**
 * @typedef {Object} TaskometerAPI
 * @property {Tasks}  tasks
 * @property {Slots}  slots
 * @property {Backup} backup
 * @property {() => Promise<Object>} getState
 */

/**
 * Build the façade. The `dispatch` is the AppContext reducer dispatch.
 */
export function makeTaskometerAPI({ dispatch, getState }) {
  const db = () => getAdapter();

  const tasks = {
    async add(taskData) {
      dispatch({ type: ACTION_TYPES.ADD_TASK, payload: taskData });
    },
    async update(id, updates) {
      dispatch({ type: ACTION_TYPES.UPDATE_TASK, payload: { id, ...updates } });
    },
    async remove(id) {
      dispatch({ type: ACTION_TYPES.DELETE_TASK, payload: { id } });
    },
    async toggleComplete(id) {
      const state = getState();
      const task = (state.tasks || []).find(t => (t.id || t.key) === id);
      if (!task) return;
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      dispatch({
        type: ACTION_TYPES.UPDATE_TASK,
        payload: { id: task.id || task.key, status: nextStatus },
      });
    },
    async reschedule(id, scheduledTime, scheduledSlotId = null) {
      dispatch({
        type: ACTION_TYPES.RESCHEDULE_TASK,
        payload: { id, scheduledTime, scheduledSlotId },
      });
    },
  };

  const slots = {
    async add(slotData) {
      dispatch({ type: ACTION_TYPES.ADD_SLOT, payload: slotData });
    },
    async update(id, updates) {
      dispatch({ type: ACTION_TYPES.UPDATE_SLOT, payload: { id, ...updates } });
    },
    async remove(id) {
      dispatch({ type: ACTION_TYPES.DELETE_SLOT, payload: { id } });
    },
    async assignTask(slotId, taskId) {
      dispatch({
        type: ACTION_TYPES.ASSIGN_TASK_TO_SLOT,
        payload: { slotId, taskId },
      });
    },
    async clear(slotId) {
      dispatch({ type: ACTION_TYPES.CLEAR_SLOT, payload: { slotId } });
    },
  };

  const backup = {
    /**
     * Build an iCalendar (.ics) payload containing every scheduled task +
     * every calendar slot. Google Calendar, Apple Calendar, and Outlook all
     * import .ics natively.
     */
    async exportICS({ download = true } = {}) {
      const state = getState();
      const ics = buildICS({
        tasks: state.tasks || [],
        slots: state.slots || [],
        calendarName: 'Taskometer',
      });
      if (download) {
        const stamp = new Date().toISOString().split('T')[0];
        downloadText(ics, `taskometer-${stamp}.ics`, 'text/calendar');
      }
      return ics;
    },

    /**
     * Full JSON backup. Round-trippable via `restoreJSON`.
     */
    async exportJSON({ download = true } = {}) {
      const adapter = await db();
      const payload = await adapter.exportData();
      const json = JSON.stringify(payload, null, 2);
      if (download) {
        const stamp = new Date().toISOString().split('T')[0];
        downloadText(json, `taskometer-backup-${stamp}.json`, 'application/json');
      }
      return payload;
    },

    /**
     * Restore from a JSON backup. Does NOT merge — it replaces, and then we
     * re-hydrate the reducer by dispatching INIT_STATE with the restored
     * state so the UI updates without a page reload.
     */
    async restoreJSON(text, { clearExisting = true } = {}) {
      const adapter = await db();
      const data = typeof text === 'string' ? JSON.parse(text) : text;
      const result = await adapter.importData(data, {
        merge: !clearExisting,
        clearExisting,
      });
      const fresh = await adapter.getState();
      dispatch({ type: ACTION_TYPES.INIT_STATE, payload: fresh });
      return result;
    },

    /**
     * Wipe all local data. Useful for "start over".
     */
    async wipe() {
      const adapter = await db();
      await adapter.clearAll();
      await adapter.initialize();
      const fresh = await adapter.getState();
      dispatch({ type: ACTION_TYPES.INIT_STATE, payload: fresh });
    },
  };

  return {
    tasks,
    slots,
    backup,
    async getState() {
      return getState();
    },
  };
}

export default makeTaskometerAPI;
