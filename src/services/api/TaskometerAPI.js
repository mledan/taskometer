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

  const taskTypes = {
    async add(typeData) {
      dispatch({ type: ACTION_TYPES.ADD_TASK_TYPE, payload: typeData });
    },
    async update(id, updates) {
      dispatch({ type: ACTION_TYPES.UPDATE_TASK_TYPE, payload: { id, ...updates } });
    },
    async remove(id) {
      dispatch({ type: ACTION_TYPES.DELETE_TASK_TYPE, payload: { typeId: id } });
    },
  };

  // ---------- Wheels (named day templates) -------------------------------
  // Stored in settings.wheels so they persist via the existing settings path.
  // Each wheel = { id, name, color, blocks: [{startTime, endTime, slotType, label, color}] }

  const genId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const ymd = (d) => {
    const m = d.getMonth() + 1, day = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
  };

  // Track the last settings we wrote locally so successive calls in the
  // same tick see each other's updates. useReducer doesn't sync stateRef
  // between sequential dispatches within a single event loop turn, so
  // without this our own rapid writes overwrite each other. Only a
  // mismatch with state.settings (someone else edited them) invalidates.
  let pendingSettings = null;
  const settingsFingerprint = (s) =>
    JSON.stringify({
      wheels: s?.wheels || [],
      dayAssignments: s?.dayAssignments || {},
      dayOverrides: s?.dayOverrides || {},
    });
  const mergeSettings = (patch) => {
    const stateSettings = getState().settings || {};
    // Once React has caught up to what we last wrote, reset the cache.
    if (pendingSettings &&
        settingsFingerprint(stateSettings) === settingsFingerprint(pendingSettings)) {
      pendingSettings = null;
    }
    const base = pendingSettings || stateSettings;
    const next = { ...base, ...patch };
    pendingSettings = next;
    dispatch({ type: ACTION_TYPES.UPDATE_SETTINGS, payload: next });
  };

  const readSettings = () => pendingSettings || getState().settings || {};

  const wheels = {
    list() {
      return readSettings().wheels || [];
    },
    async add(wheel) {
      const existing = wheels.list();
      const w = {
        id: wheel.id || genId('wheel'),
        name: wheel.name || 'untitled wheel',
        color: wheel.color || '#3B82F6',
        blocks: Array.isArray(wheel.blocks) ? wheel.blocks.map(cloneBlock) : [],
      };
      mergeSettings({ wheels: [...existing, w] });
      return w;
    },
    async update(id, updates) {
      const existing = wheels.list();
      mergeSettings({
        wheels: existing.map(w => w.id === id ? {
          ...w,
          ...updates,
          blocks: Array.isArray(updates.blocks)
            ? updates.blocks.map(cloneBlock)
            : w.blocks,
        } : w),
      });
    },
    async remove(id) {
      const existing = wheels.list();
      const assignments = readSettings().dayAssignments || {};
      const nextAssignments = Object.fromEntries(
        Object.entries(assignments).filter(([, wid]) => wid !== id)
      );
      mergeSettings({
        wheels: existing.filter(w => w.id !== id),
        dayAssignments: nextAssignments,
      });
    },
    /**
     * Snapshot today's slots (or a specific date's) into a new wheel.
     */
    async saveFromDate(date, { name, color }) {
      const state = getState();
      const dateKey = typeof date === 'string' ? date : ymd(date);
      const sourceSlots = (state.slots || []).filter(s => s.date === dateKey);
      const blocks = sourceSlots
        .slice()
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        .map(s => ({
          startTime: s.startTime,
          endTime: s.endTime,
          slotType: s.slotType || null,
          label: s.label || s.slotType || 'block',
          color: s.color || null,
        }));
      return wheels.add({ name, color, blocks });
    },
    /**
     * Apply a wheel to a date. Creates concrete slots. `mode`:
     *   'replace' — remove existing same-date slots first
     *   'merge'   — keep existing slots and layer the wheel on top
     * Auto-assigns the wheel to that date via dayAssignments.
     */
    async applyToDate(wheelId, date, { mode = 'replace' } = {}) {
      const state = getState();
      const wheel = wheels.list().find(w => w.id === wheelId);
      if (!wheel) return;
      const dateKey = typeof date === 'string' ? date : ymd(date);

      if (mode === 'replace') {
        const toRemove = (state.slots || []).filter(s => s.date === dateKey);
        for (const s of toRemove) {
          // eslint-disable-next-line no-await-in-loop
          dispatch({ type: ACTION_TYPES.DELETE_SLOT, payload: { id: s.id } });
        }
      }

      const slotsToAdd = wheel.blocks.map(b => ({
        date: dateKey,
        startTime: b.startTime,
        endTime: b.endTime,
        slotType: b.slotType || null,
        label: b.label || b.slotType || 'block',
        color: b.color || wheel.color || null,
        sourceScheduleId: wheelId,
      }));
      dispatch({ type: ACTION_TYPES.BATCH_CREATE_SLOTS, payload: { slots: slotsToAdd } });
      await days.assign(dateKey, wheelId);
    },
    /**
     * Apply to a date range. Options:
     *   weekdaysOnly: true  => only Mon-Fri
     *   weekendsOnly: true  => only Sat-Sun
     *   skipOverrides: true => skip days that have an override set
     */
    async applyToRange(wheelId, startDate, endDate, opts = {}) {
      const overrides = days.overrides();
      const { weekdaysOnly = false, weekendsOnly = false, mode = 'replace', skipOverrides = true } = opts;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cursor = new Date(start);
      const results = [];
      while (cursor.getTime() <= end.getTime()) {
        const day = cursor.getDay();
        const isWeekend = day === 0 || day === 6;
        const skipByDay =
          (weekdaysOnly && isWeekend) ||
          (weekendsOnly && !isWeekend);
        const dateKey = ymd(cursor);
        const hasOverride = !!overrides[dateKey];
        if (!skipByDay && !(skipOverrides && hasOverride)) {
          // eslint-disable-next-line no-await-in-loop
          await wheels.applyToDate(wheelId, dateKey, { mode });
          results.push(dateKey);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return results;
    },
  };

  // ---------- Day assignments & overrides --------------------------------
  const days = {
    assignments() {
      return readSettings().dayAssignments || {};
    },
    overrides() {
      return readSettings().dayOverrides || {};
    },
    async assign(date, wheelId) {
      const dateKey = typeof date === 'string' ? date : ymd(date);
      const map = { ...days.assignments(), [dateKey]: wheelId };
      mergeSettings({ dayAssignments: map });
    },
    async unassign(date) {
      const dateKey = typeof date === 'string' ? date : ymd(date);
      const map = { ...days.assignments() };
      delete map[dateKey];
      mergeSettings({ dayAssignments: map });
    },
    async setOverride(date, override) {
      const dateKey = typeof date === 'string' ? date : ymd(date);
      const map = {
        ...days.overrides(),
        [dateKey]: {
          type: override.type || 'event',
          label: override.label || override.type || 'override',
          color: override.color || DEFAULT_OVERRIDE_COLORS[override.type] || '#94A3B8',
          note: override.note || null,
          clearSlots: !!override.clearSlots,
        },
      };
      mergeSettings({ dayOverrides: map });
      // Optionally clear slots (sick days, vacations)
      if (override.clearSlots) {
        const toRemove = (getState().slots || []).filter(s => s.date === dateKey);
        for (const s of toRemove) {
          dispatch({ type: ACTION_TYPES.DELETE_SLOT, payload: { id: s.id } });
        }
      }
    },
    async clearOverride(date) {
      const dateKey = typeof date === 'string' ? date : ymd(date);
      const map = { ...days.overrides() };
      delete map[dateKey];
      mergeSettings({ dayOverrides: map });
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
    taskTypes,
    wheels,
    days,
    backup,
    async getState() {
      return getState();
    },
  };
}

function cloneBlock(b) {
  return {
    startTime: b.startTime,
    endTime: b.endTime,
    slotType: b.slotType || null,
    label: b.label || b.slotType || 'block',
    color: b.color || null,
  };
}

export const OVERRIDE_TYPES = [
  { id: 'holiday', label: 'Holiday', color: '#EC4899', clearsSlots: true },
  { id: 'sick', label: 'Sick day', color: '#F59E0B', clearsSlots: true },
  { id: 'vacation', label: 'Vacation', color: '#06B6D4', clearsSlots: true },
  { id: 'event', label: 'Event', color: '#8B5CF6', clearsSlots: false },
  { id: 'custom', label: 'Custom', color: '#94A3B8', clearsSlots: false },
];

const DEFAULT_OVERRIDE_COLORS = Object.fromEntries(OVERRIDE_TYPES.map(o => [o.id, o.color]));

export const STARTER_WHEELS = [
  {
    id: 'starter_9_5',
    name: '9 to 5',
    color: '#3B82F6',
    blocks: [
      { startTime: '06:30', endTime: '07:30', slotType: 'routine', label: 'morning' },
      { startTime: '09:00', endTime: '12:00', slotType: 'deep', label: 'deep work' },
      { startTime: '12:00', endTime: '13:00', slotType: 'break', label: 'lunch' },
      { startTime: '13:00', endTime: '15:00', slotType: 'mtgs', label: 'meetings' },
      { startTime: '15:00', endTime: '17:00', slotType: 'admin', label: 'admin' },
      { startTime: '22:00', endTime: '06:00', slotType: 'sleep', label: 'sleep' },
    ],
  },
  {
    id: 'starter_weekend',
    name: 'Weekend chill',
    color: '#A8BF8C',
    blocks: [
      { startTime: '09:00', endTime: '10:00', slotType: 'routine', label: 'slow morning' },
      { startTime: '10:00', endTime: '12:00', slotType: 'play', label: 'hobby' },
      { startTime: '12:00', endTime: '13:30', slotType: 'break', label: 'lunch' },
      { startTime: '13:30', endTime: '17:00', slotType: 'play', label: 'free' },
      { startTime: '18:00', endTime: '20:00', slotType: 'play', label: 'social' },
      { startTime: '23:00', endTime: '08:00', slotType: 'sleep', label: 'sleep' },
    ],
  },
  {
    id: 'starter_early',
    name: 'Early riser',
    color: '#10B981',
    blocks: [
      { startTime: '05:30', endTime: '06:30', slotType: 'routine', label: 'workout' },
      { startTime: '07:00', endTime: '11:00', slotType: 'deep', label: 'morning focus' },
      { startTime: '11:00', endTime: '12:00', slotType: 'break', label: 'walk + lunch' },
      { startTime: '12:00', endTime: '15:00', slotType: 'mtgs', label: 'meetings' },
      { startTime: '15:00', endTime: '17:00', slotType: 'admin', label: 'wrap up' },
      { startTime: '21:00', endTime: '05:00', slotType: 'sleep', label: 'sleep' },
    ],
  },
];

export default makeTaskometerAPI;
