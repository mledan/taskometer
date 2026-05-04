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
      if (task.status === 'completed') {
        // Un-complete: route through UPDATE_TASK so the reducer can re-schedule
        // if autoSchedule is on and the slot is free.
        dispatch({
          type: ACTION_TYPES.UPDATE_TASK,
          payload: {
            id: task.id || task.key,
            status: 'pending',
            completedAt: null,
          },
        });
      } else {
        // Complete: go through the dedicated action so recurrence spawns.
        dispatch({
          type: ACTION_TYPES.COMPLETE_TASK,
          payload: { taskId: task.id || task.key },
        });
      }
    },
    async reschedule(id, scheduledTime, scheduledSlotId = null) {
      // Reducer destructures `taskId`, not `id`. Keep both for forward compat.
      dispatch({
        type: ACTION_TYPES.RESCHEDULE_TASK,
        payload: { taskId: id, id, scheduledTime, scheduledSlotId },
      });
    },
    /**
     * Return every task that shares a metadata.seriesId with the given task.
     * If the task isn't part of a series, returns `[task]`.
     */
    seriesOf(id) {
      const state = getState();
      const all = state.tasks || [];
      const root = all.find(t => (t.id || t.key) === id);
      if (!root) return [];
      const sid = root.metadata?.seriesId;
      if (!sid) return [root];
      return all.filter(t => t.metadata?.seriesId === sid);
    },
    async completeSeries(id) {
      const siblings = tasks.seriesOf(id);
      for (const t of siblings) {
        if (t.status === 'completed') continue;
        // eslint-disable-next-line no-await-in-loop
        dispatch({ type: ACTION_TYPES.COMPLETE_TASK, payload: { taskId: t.id || t.key } });
      }
    },
    async removeSeries(id) {
      const siblings = tasks.seriesOf(id);
      for (const t of siblings) {
        // eslint-disable-next-line no-await-in-loop
        dispatch({ type: ACTION_TYPES.DELETE_TASK, payload: { id: t.id || t.key } });
      }
    },
    /**
     * Shift every segment in a series by `days` calendar days. Negative values
     * pull earlier. Unscheduled segments are ignored.
     */
    async bumpSeries(id, days) {
      if (!days) return;
      const siblings = tasks.seriesOf(id);
      const ms = days * 24 * 60 * 60 * 1000;
      for (const t of siblings) {
        if (!t.scheduledTime) continue;
        const next = new Date(new Date(t.scheduledTime).getTime() + ms);
        // eslint-disable-next-line no-await-in-loop
        dispatch({
          type: ACTION_TYPES.UPDATE_TASK,
          payload: {
            id: t.id || t.key,
            scheduledTime: next.toISOString(),
            scheduledFor: next.toISOString(),
          },
        });
      }
    },
    /**
     * Move a task into a specific slot. Sets scheduledSlotId and snaps the
     * scheduledTime to the slot's start on the slot's date.
     */
    async moveToSlot(taskId, slotId) {
      const state = getState();
      const slot = (state.slots || []).find(s => s.id === slotId);
      if (!slot) return;
      const [h, m] = (slot.startTime || '09:00').split(':').map(Number);
      const d = new Date(slot.date);
      d.setHours(h || 0, m || 0, 0, 0);
      dispatch({
        type: ACTION_TYPES.RESCHEDULE_TASK,
        payload: {
          taskId,
          id: taskId,
          scheduledTime: d.toISOString(),
          scheduledSlotId: slotId,
        },
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
      dayOverrideSnapshots: s?.dayOverrideSnapshots || {},
      scheduleRules: s?.scheduleRules || [],
      autoSchedule: s?.autoSchedule !== false,
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
     * Apply a wheel to a date. Creates concrete slots.
     *
     *   mode: 'replace' — remove existing same-date slots first
     *         'merge'   — keep existing slots and layer the wheel on top
     *
     *   from / to: optional 'HH:mm' time window to paint only a slice
     *     of the wheel onto the day. The window is inclusive of `from`
     *     and exclusive of `to`. Blocks that overlap the window are
     *     clipped to fit. Used for mix-and-match — "morning of Buffett
     *     + afternoon of Hemingway." When `from` or `to` is set we
     *     don't auto-assign the wheel to the day (the day is now a
     *     composition, not a single shape).
     */
    async applyToDate(wheelId, date, { mode = 'replace', from, to } = {}) {
      const state = getState();
      const wheel = wheels.list().find(w => w.id === wheelId);
      if (!wheel) return;
      const dateKey = typeof date === 'string' ? date : ymd(date);

      const partial = !!from || !!to;
      const winFrom = from ? hhmmToMinutes(from) : 0;
      const winTo = to ? hhmmToMinutes(to) : 24 * 60;

      if (mode === 'replace') {
        const dayList = (state.slots || []).filter(s => s.date === dateKey);
        if (!partial) {
          for (const s of dayList) {
            // eslint-disable-next-line no-await-in-loop
            dispatch({ type: ACTION_TYPES.DELETE_SLOT, payload: { id: s.id } });
          }
        } else {
          // Partial mode: delete slots entirely inside the window;
          // for slots straddling the window boundary, clip them to
          // keep the outside portion. Mix-and-match should not erase
          // the user's existing blocks just because the boundary cuts
          // through them.
          for (const s of dayList) {
            const sStart = hhmmToMinutes(s.startTime);
            const sEndRaw = hhmmToMinutes(s.endTime);
            const sEnd = sEndRaw <= sStart ? sEndRaw + 24 * 60 : sEndRaw;
            const winFromMin = winFrom;
            const winToMin = winTo;
            // Entirely outside the window — leave alone
            if (sEnd <= winFromMin || sStart >= winToMin) continue;
            // Entirely inside — delete
            if (sStart >= winFromMin && sEnd <= winToMin) {
              // eslint-disable-next-line no-await-in-loop
              dispatch({ type: ACTION_TYPES.DELETE_SLOT, payload: { id: s.id } });
              continue;
            }
            // Straddling: clip to the outside portion. There are three
            // shapes — left overhang, right overhang, or wrap (slot
            // covers the whole window with leftovers on both sides;
            // we split into two slots).
            const leftStart = sStart;
            const leftEnd = Math.max(sStart, Math.min(sEnd, winFromMin));
            const rightStart = Math.max(sStart, Math.min(sEnd, winToMin));
            const rightEnd = sEnd;
            const hasLeft = leftEnd > leftStart;
            const hasRight = rightEnd > rightStart;
            if (hasLeft && !hasRight) {
              // eslint-disable-next-line no-await-in-loop
              dispatch({
                type: ACTION_TYPES.UPDATE_SLOT,
                payload: { id: s.id, startTime: minutesToHHMM(leftStart), endTime: minutesToHHMM(leftEnd) },
              });
            } else if (!hasLeft && hasRight) {
              // eslint-disable-next-line no-await-in-loop
              dispatch({
                type: ACTION_TYPES.UPDATE_SLOT,
                payload: { id: s.id, startTime: minutesToHHMM(rightStart), endTime: minutesToHHMM(rightEnd === 24 * 60 ? 0 : rightEnd) },
              });
            } else if (hasLeft && hasRight) {
              // Window punches a hole — shrink the existing slot to
              // the left chunk and create a new slot for the right.
              // eslint-disable-next-line no-await-in-loop
              dispatch({
                type: ACTION_TYPES.UPDATE_SLOT,
                payload: { id: s.id, startTime: minutesToHHMM(leftStart), endTime: minutesToHHMM(leftEnd) },
              });
              // eslint-disable-next-line no-await-in-loop
              dispatch({
                type: ACTION_TYPES.ADD_SLOT,
                payload: {
                  date: dateKey,
                  startTime: minutesToHHMM(rightStart),
                  endTime: minutesToHHMM(rightEnd === 24 * 60 ? 0 : rightEnd),
                  slotType: s.slotType || null,
                  label: s.label || s.slotType || 'block',
                  color: s.color || null,
                  sourceScheduleId: s.sourceScheduleId || null,
                },
              });
            }
          }
        }
      }

      const slotsToAdd = [];
      for (const b of wheel.blocks) {
        if (!partial) {
          slotsToAdd.push({
            date: dateKey,
            startTime: b.startTime,
            endTime: b.endTime,
            slotType: b.slotType || null,
            label: b.label || b.slotType || 'block',
            color: b.color || wheel.color || null,
            sourceScheduleId: wheelId,
          });
          continue;
        }
        // Partial paint: clip the block to the window if it overlaps.
        const blockStart = hhmmToMinutes(b.startTime);
        const blockEndRaw = hhmmToMinutes(b.endTime);
        const blockEnd = blockEndRaw <= blockStart ? blockEndRaw + 24 * 60 : blockEndRaw;
        // Skip blocks entirely outside the window.
        if (blockEnd <= winFrom || blockStart >= winTo) continue;
        const startMin = Math.max(blockStart, winFrom);
        const endMin = Math.min(blockEnd, winTo);
        const startTime = minutesToHHMM(startMin);
        const endTime = minutesToHHMM(endMin === 24 * 60 ? 0 : endMin);
        slotsToAdd.push({
          date: dateKey,
          startTime,
          endTime,
          slotType: b.slotType || null,
          label: b.label || b.slotType || 'block',
          color: b.color || wheel.color || null,
          sourceScheduleId: wheelId,
        });
      }
      if (slotsToAdd.length > 0) {
        dispatch({ type: ACTION_TYPES.BATCH_CREATE_SLOTS, payload: { slots: slotsToAdd } });
      }
      // Only auto-assign if this is a whole-day paint. A partial paint
      // means the day is now a composition — there's no single owning
      // wheel.
      if (!partial) {
        await days.assign(dateKey, wheelId);
      }
    },
    /**
     * Apply to a date range. Options:
     *   weekdaysOnly: true  => only Mon-Fri
     *   weekendsOnly: true  => only Sat-Sun
     *   skipOverrides: true => skip days that have an override set
     *   confirmReplace: (count) => boolean — called when `mode==='replace'`
     *     and the range already has existing slots that would be destroyed.
     *     Return false to abort. If absent, destructive replace proceeds.
     */
    async applyToRange(wheelId, startDate, endDate, opts = {}) {
      const overrides = days.overrides();
      const {
        weekdaysOnly = false,
        weekendsOnly = false,
        mode = 'replace',
        skipOverrides = true,
        confirmReplace,
      } = opts;
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Build the list of dates we'd actually paint, respecting filters.
      const plan = [];
      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        const day = cursor.getDay();
        const isWeekend = day === 0 || day === 6;
        const skipByDay =
          (weekdaysOnly && isWeekend) ||
          (weekendsOnly && !isWeekend);
        const dateKey = ymd(cursor);
        const hasOverride = !!overrides[dateKey];
        if (!skipByDay && !(skipOverrides && hasOverride)) {
          plan.push(dateKey);
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      // In replace mode with an existing slot footprint, give callers a chance
      // to abort before we nuke user data.
      if (mode === 'replace' && typeof confirmReplace === 'function') {
        const stateNow = getState();
        const planSet = new Set(plan);
        const destroyedDays = new Set();
        for (const s of stateNow.slots || []) {
          if (planSet.has(s.date)) destroyedDays.add(s.date);
        }
        if (destroyedDays.size > 0) {
          const ok = await Promise.resolve(confirmReplace(destroyedDays.size, plan.length));
          if (ok === false) return { painted: [], aborted: true };
        }
      }

      const results = [];
      for (const dateKey of plan) {
        // eslint-disable-next-line no-await-in-loop
        await wheels.applyToDate(wheelId, dateKey, { mode });
        results.push(dateKey);
      }
      return { painted: results, aborted: false };
    },
  };

  // ---------- Day assignments & overrides --------------------------------
  //
  // Override shape on disk:
  //   { type, label, color, note, clearSlots,
  //     coverage: 'full' | 'partial',
  //     from?: 'HH:mm', to?: 'HH:mm' }
  //
  // When `clearSlots` is set we snapshot the slots we remove into
  // settings.dayOverrideSnapshots[dateKey] so `clearOverride` can restore
  // them verbatim. Partial-coverage overrides only snapshot/remove the
  // slots whose windows intersect [from, to).
  const days = {
    assignments() {
      return readSettings().dayAssignments || {};
    },
    overrides() {
      return readSettings().dayOverrides || {};
    },
    snapshots() {
      return readSettings().dayOverrideSnapshots || {};
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
      const coverage = override.coverage === 'partial' ? 'partial' : 'full';
      const from = coverage === 'partial' ? (override.from || '00:00') : null;
      const to = coverage === 'partial' ? (override.to || '23:59') : null;
      const record = {
        type: override.type || 'event',
        label: override.label || override.type || 'override',
        color: override.color || DEFAULT_OVERRIDE_COLORS[override.type] || '#94A3B8',
        note: override.note || null,
        clearSlots: !!override.clearSlots,
        coverage,
        from,
        to,
      };

      let snapshotsPatch = null;
      if (override.clearSlots) {
        const slotsOnDay = (getState().slots || []).filter(s => s.date === dateKey);
        const targets = coverage === 'partial'
          ? slotsOnDay.filter(s => slotOverlapsWindow(s, from, to))
          : slotsOnDay;
        if (targets.length > 0) {
          const existing = days.snapshots();
          snapshotsPatch = {
            ...existing,
            [dateKey]: [
              // Preserve any prior snapshot so nested overrides still roll back
              ...(existing[dateKey] || []),
              ...targets.map(snapshotSlot),
            ],
          };
        }
      }

      mergeSettings({
        dayOverrides: { ...days.overrides(), [dateKey]: record },
        ...(snapshotsPatch ? { dayOverrideSnapshots: snapshotsPatch } : {}),
      });

      if (override.clearSlots) {
        const slotsOnDay = (getState().slots || []).filter(s => s.date === dateKey);
        const targets = coverage === 'partial'
          ? slotsOnDay.filter(s => slotOverlapsWindow(s, from, to))
          : slotsOnDay;
        for (const s of targets) {
          dispatch({ type: ACTION_TYPES.DELETE_SLOT, payload: { id: s.id } });
        }
      }
    },
    async clearOverride(date) {
      const dateKey = typeof date === 'string' ? date : ymd(date);

      // Restore any snapshotted slots so clearing an override doesn't
      // permanently destroy the user's schedule.
      const snaps = days.snapshots();
      const restoring = snaps[dateKey];
      if (Array.isArray(restoring) && restoring.length > 0) {
        const toAdd = restoring.map(restoreSlot);
        dispatch({ type: ACTION_TYPES.BATCH_CREATE_SLOTS, payload: { slots: toAdd } });
      }

      const nextOverrides = { ...days.overrides() };
      delete nextOverrides[dateKey];
      const nextSnaps = { ...snaps };
      delete nextSnaps[dateKey];
      mergeSettings({
        dayOverrides: nextOverrides,
        dayOverrideSnapshots: nextSnaps,
      });
    },
    /**
     * Apply an override to every day in [startDate, endDate]. Useful for
     * vacations and multi-day events. Snapshotting works per-day so a
     * later `clearOverrideRange` puts everything back.
     */
    async setOverrideRange(startDate, endDate, override) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cursor = new Date(start);
      const results = [];
      while (cursor.getTime() <= end.getTime()) {
        const key = ymd(cursor);
        // eslint-disable-next-line no-await-in-loop
        await days.setOverride(key, override);
        results.push(key);
        cursor.setDate(cursor.getDate() + 1);
      }
      return results;
    },
    async clearOverrideRange(startDate, endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cursor = new Date(start);
      const results = [];
      while (cursor.getTime() <= end.getTime()) {
        const key = ymd(cursor);
        // eslint-disable-next-line no-await-in-loop
        await days.clearOverride(key);
        results.push(key);
        cursor.setDate(cursor.getDate() + 1);
      }
      return results;
    },
    /**
     * Compose the effective picture for a given date:
     *   { wheelId, override, source }
     * `source` is 'pin' (manual assignment/override), 'rule' (matched
     * scheduleRule), or 'none' (no resolution).
     */
    getEffectiveForDate(date) {
      const dateKey = typeof date === 'string' ? date : ymd(date);
      const pinOverride = days.overrides()[dateKey] || null;
      const pinWheel = days.assignments()[dateKey] || null;
      if (pinOverride || pinWheel) {
        return { wheelId: pinWheel, override: pinOverride, source: 'pin' };
      }
      const ruled = evaluateRules(readSettings().scheduleRules || [], dateKey);
      if (ruled) return { ...ruled, source: 'rule' };
      return { wheelId: null, override: null, source: 'none' };
    },
  };

  // ---------- Schedule rules ---------------------------------------------
  //
  // Persisted in settings.scheduleRules as:
  //   { id, name, enabled, priority, when, action }
  //
  // `when` predicates (any combination; all must match):
  //   { dow: [0..6] }          — days of week (0=Sun..6=Sat)
  //   { date: 'YYYY-MM-DD' }   — exact date
  //   { range: ['YYYY-MM-DD', 'YYYY-MM-DD'] } — inclusive
  //   { monthDay: [n, n...] }  — day-of-month list
  //   { month: [n, n...] }     — months (1..12) list, combined with monthDay for yearly
  //
  // `action`:
  //   { applyWheel: wheelId }
  //   { override: { type, label, color, clearSlots, coverage?, from?, to? } }
  //
  // Evaluation sorts by priority desc; the first match wins (later matches
  // are ignored to keep behavior obvious). A point-in-time dayAssignment or
  // dayOverride pin always overrides any rule.
  const rules = {
    list() {
      return readSettings().scheduleRules || [];
    },
    async add(rule) {
      const existing = rules.list();
      const r = {
        id: rule.id || genId('rule'),
        name: rule.name || 'rule',
        enabled: rule.enabled !== false,
        priority: typeof rule.priority === 'number' ? rule.priority : 0,
        when: rule.when || {},
        action: rule.action || {},
      };
      mergeSettings({ scheduleRules: [...existing, r] });
      return r;
    },
    async update(id, updates) {
      const existing = rules.list();
      mergeSettings({
        scheduleRules: existing.map(r => r.id === id ? { ...r, ...updates } : r),
      });
    },
    async remove(id) {
      const existing = rules.list();
      mergeSettings({
        scheduleRules: existing.filter(r => r.id !== id),
      });
    },
    async toggle(id, enabled) {
      return rules.update(id, { enabled: !!enabled });
    },
    /**
     * Materialize rules into concrete day assignments/overrides for the given
     * date range. Pins (manual assignments or overrides) are never touched.
     * Returns { touched: number }.
     */
    async materialize(startDate, endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cursor = new Date(start);
      const ruleList = rules.list();
      let touched = 0;
      while (cursor.getTime() <= end.getTime()) {
        const key = ymd(cursor);
        const pinWheel = days.assignments()[key];
        const pinOverride = days.overrides()[key];
        if (!pinWheel && !pinOverride) {
          const hit = evaluateRules(ruleList, key);
          if (hit) {
            if (hit.override) {
              // eslint-disable-next-line no-await-in-loop
              await days.setOverride(key, hit.override);
              touched++;
            } else if (hit.wheelId) {
              // eslint-disable-next-line no-await-in-loop
              await wheels.applyToDate(hit.wheelId, key, { mode: 'replace' });
              touched++;
            }
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return { touched };
    },
  };

  // ---------- Settings ---------------------------------------------------
  const settings = {
    get() {
      return readSettings();
    },
    async update(patch) {
      mergeSettings(patch || {});
    },
    async setAutoSchedule(on) {
      mergeSettings({ autoSchedule: !!on });
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
     * Schedule-replication backup. Round-trippable via `restoreJSON`.
     *
     *   minimal: true  (default) — tasks, slots, taskTypes, and the
     *     schedule-shaping bits of settings (wheels, rules, overrides,
     *     assignments, autoSchedule). This is everything you need to
     *     rebuild a user's schedule on another machine.
     *   minimal: false — full dump including the audit log, legacy
     *     template library, and tags. Useful for support/forensics.
     *
     * Output is compact JSON (no pretty-printing) — the audit log alone
     * can hit hundreds of KB formatted.
     */
    async exportJSON({ download = true, minimal = true, pretty = false } = {}) {
      const adapter = await db();
      const full = await adapter.exportData();
      const payload = minimal ? slimExport(full) : full;
      const json = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
      if (download) {
        const stamp = new Date().toISOString().split('T')[0];
        const suffix = minimal ? 'schedule' : 'full';
        downloadText(json, `taskometer-${suffix}-${stamp}.json`, 'application/json');
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
     * Wipe all local data. Callers must pass `confirm: 'wipe my data'` so
     * accidental or programmatic calls can't destroy the user's work.
     */
    async wipe({ confirm } = {}) {
      if (confirm !== 'wipe my data') {
        throw new Error('backup.wipe requires confirm: "wipe my data"');
      }
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
    rules,
    settings,
    backup,
    async getState() {
      return getState();
    },
  };
}

// ---------- helpers shared by the API -----------------------------------

function hhmmToMinutes(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHHMM(min) {
  const m = ((Math.round(min) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h < 10 ? '0' + h : h}:${mm < 10 ? '0' + mm : mm}`;
}

function slotOverlapsWindow(slot, fromHHMM, toHHMM) {
  const DAY = 24 * 60;
  const sStart = hhmmToMinutes(slot.startTime);
  const sEndRaw = hhmmToMinutes(slot.endTime);
  const sEnd = sEndRaw <= sStart ? sEndRaw + DAY : sEndRaw;
  const wStart = hhmmToMinutes(fromHHMM);
  const wEndRaw = hhmmToMinutes(toHHMM);
  const wEnd = wEndRaw <= wStart ? wEndRaw + DAY : wEndRaw;
  return sStart < wEnd && wStart < sEnd;
}

function snapshotSlot(s) {
  return {
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    slotType: s.slotType || null,
    label: s.label || s.slotType || 'block',
    color: s.color || null,
    sourceScheduleId: s.sourceScheduleId || null,
  };
}

function restoreSlot(snap) {
  return {
    date: snap.date,
    startTime: snap.startTime,
    endTime: snap.endTime,
    slotType: snap.slotType || null,
    label: snap.label || snap.slotType || 'block',
    color: snap.color || null,
    sourceScheduleId: snap.sourceScheduleId || null,
  };
}

/**
 * Return the first matching rule's resolved action, or null.
 *   { wheelId?, override? }
 * Ties broken by priority desc, then array order.
 */
export function evaluateRules(rules, dateKey) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const sorted = rules
    .filter(r => r && r.enabled !== false)
    .slice()
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const r of sorted) {
    if (!ruleMatches(r.when || {}, dateKey)) continue;
    const out = {};
    if (r.action?.applyWheel) out.wheelId = r.action.applyWheel;
    if (r.action?.override) out.override = r.action.override;
    if (out.wheelId || out.override) return out;
  }
  return null;
}

function ruleMatches(when, dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  if (Array.isArray(when.dow) && when.dow.length > 0) {
    if (!when.dow.includes(d.getDay())) return false;
  }
  if (when.date && when.date !== dateKey) return false;
  if (Array.isArray(when.range) && when.range.length === 2) {
    if (dateKey < when.range[0] || dateKey > when.range[1]) return false;
  }
  if (Array.isArray(when.monthDay) && when.monthDay.length > 0) {
    if (!when.monthDay.includes(d.getDate())) return false;
  }
  if (Array.isArray(when.month) && when.month.length > 0) {
    if (!when.month.includes(d.getMonth() + 1)) return false;
  }
  return true;
}

/**
 * Keep only the fields needed to rebuild a user's schedule on another
 * machine. Drops the audit log, legacy template library, tags collection,
 * and any `schedules` entries — none of which affect how the taskometer
 * renders the day, week, or calendar.
 */
function slimExport(full = {}) {
  const settings = full.settings || {};
  return {
    version: full.version,
    exportedAt: full.exportedAt,
    kind: 'schedule',
    tasks: (full.tasks || []).map(stripTaskForExport),
    slots: full.slots || [],
    taskTypes: full.taskTypes || [],
    settings: {
      wheels: settings.wheels || [],
      scheduleRules: settings.scheduleRules || [],
      dayAssignments: settings.dayAssignments || {},
      dayOverrides: settings.dayOverrides || {},
      dayOverrideSnapshots: settings.dayOverrideSnapshots || {},
      autoSchedule: settings.autoSchedule !== false,
      defaultView: settings.defaultView || 'week',
    },
  };
}

function stripTaskForExport(t) {
  // Drop large legacy-migration blobs from task.metadata so the file stays
  // small. Migrations leave originalData payloads behind that can dwarf the
  // rest of the export.
  const { metadata, ...rest } = t;
  if (!metadata) return rest;
  const { originalData: _ignored, ...cleanMeta } = metadata;
  return { ...rest, metadata: cleanMeta };
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

// The wheel library we ship with. Single source of truth lives in
// src/defaults/defaultSchedule.js so it can be tweaked without editing
// this file.
export { DEFAULT_WHEELS as STARTER_WHEELS } from '../../defaults/defaultSchedule';

export default makeTaskometerAPI;
