import { useCallback, useEffect, useRef, useState } from 'react';
import { matchScheduleType, nextOpenInType } from '../../services/api/derive';
import { findScheduleTarget } from '../../services/scheduling.js';
import { emit, EVENTS } from '../../services/events.js';
import { log as telemetryLog } from '../../services/telemetry.js';
import { formatYMD } from '../../utils/time.js';

const NO_RECURRENCE = { frequency: 'none', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null };

function isoAt(dateKey, startMin) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  return d.toISOString();
}

/**
 * Task CRUD, capture, auto-scheduling and drag-move. Returns the
 * handlers the screens need plus the shared `rowHandlers` bundle.
 */
export function useTaskActions({ api, state, viewKey, selectedSlot, selectedSlotIsForDay }) {
  const [editingTaskId, setEditingTaskId] = useState(null);

  // When the auto-scheduler pushes a task forward, ComingUp shows a
  // sticky "just rolled forward" breadcrumb for a minute.
  const [recentRollover, setRecentRollover] = useState(null);
  const rolloverTimerRef = useRef(null);
  useEffect(() => {
    if (!recentRollover) return;
    if (rolloverTimerRef.current) clearTimeout(rolloverTimerRef.current);
    rolloverTimerRef.current = setTimeout(() => setRecentRollover(null), 60000);
  }, [recentRollover]);
  useEffect(() => () => { if (rolloverTimerRef.current) clearTimeout(rolloverTimerRef.current); }, []);

  const handleToggle = useCallback((id) => { telemetryLog('task:toggle', { id }); return api.tasks.toggleComplete(id); }, [api]);
  const handleDelete = useCallback((id) => { telemetryLog('task:delete', { id }); return api.tasks.remove(id); }, [api]);
  const handleEdit = useCallback((id) => {
    telemetryLog('task:edit-open', { id });
    setEditingTaskId(prev => (prev === id ? null : id));
  }, []);
  const handleSaveEdit = useCallback((id, updates) => {
    telemetryLog('task:edit-save', { id, keys: Object.keys(updates || {}) });
    api.tasks.update(id, updates);
    setEditingTaskId(null);
  }, [api]);

  // Capture: text in, unscheduled task out. Lands in the inbox.
  const handleQuickCapture = useCallback((text) => {
    const t = (text || '').trim();
    if (!t) return;
    telemetryLog('task:add', { text: t.slice(0, 40), kind: 'inbox' });
    return api.tasks.add({
      text: t, status: 'pending', priority: 'medium', recurrence: NO_RECURRENCE,
      autoSchedule: false,
    });
  }, [api]);

  // Full add: [tag] routing first, then the scheduler walks forward
  // up to 60 days for a real fit.
  const handleAddTask = useCallback(async (data) => {
    const duration = data?.duration || 30;
    const typesList = state.settings?.scheduleTypes || [];
    const matchedType = matchScheduleType(data?.text || '', typesList);
    if (matchedType) {
      const occ = nextOpenInType({ type: matchedType, tasks: state.tasks || [], now: new Date(), duration });
      if (occ) {
        const iso = isoAt(occ.dayKey, occ.startMin);
        const existingTags = Array.isArray(data.tags) ? data.tags : [];
        const payload = {
          ...data,
          scheduledTime: iso,
          scheduledFor: iso,
          tags: existingTags.includes(matchedType.tag) ? existingTags : [...existingTags, matchedType.tag],
          metadata: { ...(data.metadata || {}), scheduleTypeId: matchedType.id },
        };
        telemetryLog('task:add', { text: (payload.text || '').slice(0, 40), type: payload.primaryType, duration: payload.duration, tagMatch: matchedType.tag, kind: 'schedule-type' });
        emit(EVENTS.TASK_ADDED, { slotId: null });
        return api.tasks.add(payload);
      }
    }

    const target = findScheduleTarget({
      taskType: data?.primaryType,
      duration,
      state,
      preferDate: viewKey,
      preferSlotId: selectedSlot && selectedSlotIsForDay ? selectedSlot.id : null,
    });

    let payload = data;
    if (target) {
      let slotId;
      if (target.kind === 'rhythm') {
        const created = await api.slots.add(target.slotShape);
        slotId = created.id;
        telemetryLog('rhythm:materialized-on-rollover', { rhythmId: target.rhythm.id, date: target.date });
      } else {
        slotId = target.slot.id;
      }
      const iso = isoAt(target.date, target.startMin);
      payload = { ...data, scheduledSlotId: slotId, scheduledTime: iso, scheduledFor: iso };
      if (target.date !== viewKey) {
        setRecentRollover({ text: data?.text || 'task', dayKey: target.date, scheduledTime: iso, at: Date.now() });
      }
    } else {
      const iso = new Date(`${viewKey}T09:00:00`).toISOString();
      payload = { ...data, scheduledTime: iso, scheduledFor: iso };
    }

    telemetryLog('task:add', {
      text: (payload?.text || '').slice(0, 40),
      type: payload?.primaryType,
      duration: payload?.duration,
      priority: payload?.priority,
      slotId: payload?.scheduledSlotId || null,
      rolledOver: target?.date !== viewKey,
      kind: target?.kind || 'unscheduled',
    });
    emit(EVENTS.TASK_ADDED, { slotId: payload?.scheduledSlotId || null });
    return api.tasks.add(payload);
  }, [api, state, viewKey, selectedSlot, selectedSlotIsForDay]);

  const handleSeriesComplete = useCallback((id) => api.tasks.completeSeries(id), [api]);
  const handleSeriesDelete = useCallback((id) => {
    const count = api.tasks.seriesOf(id).length;
    if (count > 1 && !window.confirm(`delete all ${count} parts of this task?`)) return;
    api.tasks.removeSeries(id);
  }, [api]);
  const handleSeriesBump = useCallback((id, days) => api.tasks.bumpSeries(id, days), [api]);

  // Drag a task into a slot: lands at the next free minute, or the
  // slot start if the slot is saturated.
  const handleTaskMoveToSlot = useCallback(async (taskId, slotId) => {
    if (!taskId || !slotId) return;
    const slot = (state.slots || []).find(s => s.id === slotId);
    const task = (state.tasks || []).find(t => t.id === taskId);
    if (!slot || !task || task.scheduledSlotId === slotId) return;

    const [sh, sm] = (slot.startTime || '09:00').split(':').map(Number);
    const [eh, em] = (slot.endTime || '17:00').split(':').map(Number);
    const slotStartMin = (sh || 0) * 60 + (sm || 0);
    let slotEndMin = (eh || 0) * 60 + (em || 0);
    if (slotEndMin <= slotStartMin) slotEndMin += 24 * 60;
    const duration = task.duration || 30;

    const existing = (state.tasks || []).filter(t => {
      if (t.id === taskId || t.status === 'cancelled') return false;
      if (t.scheduledSlotId === slotId) return true;
      if (!t.scheduledTime) return false;
      const ts = new Date(t.scheduledTime);
      if (formatYMD(ts) !== slot.date) return false;
      const m = ts.getHours() * 60 + ts.getMinutes();
      return m >= slotStartMin && m < slotEndMin;
    });
    let nextMin = slotStartMin;
    for (const t of existing) {
      const ts = new Date(t.scheduledTime);
      const end = ts.getHours() * 60 + ts.getMinutes() + (t.duration || 30);
      if (end > nextMin) nextMin = end;
    }
    if (nextMin + duration > slotEndMin) nextMin = slotStartMin;

    const iso = isoAt(slot.date, nextMin);
    await api.tasks.update(taskId, { scheduledSlotId: slotId, scheduledTime: iso, scheduledFor: iso });
    telemetryLog('task:drag-move', { id: taskId, toSlot: slotId, date: slot.date });
  }, [api, state]);

  const addTasksToInbox = useCallback(async (tasks) => {
    for (const t of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await api.tasks.add({
        text: t.text, duration: t.duration, primaryType: t.primaryType,
        status: 'pending', priority: 'medium', recurrence: NO_RECURRENCE, autoSchedule: false,
      });
    }
  }, [api]);

  const addTasksAutoScheduled = useCallback(async (tasks) => {
    for (const t of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await api.tasks.add({ text: t.text, duration: t.duration, primaryType: t.primaryType, status: 'pending', priority: 'medium' });
    }
  }, [api]);

  const rowHandlers = {
    onToggle: handleToggle,
    onDelete: handleDelete,
    onEdit: handleEdit,
    onSaveEdit: handleSaveEdit,
    onSeriesComplete: handleSeriesComplete,
    onSeriesDelete: handleSeriesDelete,
    onSeriesBump: handleSeriesBump,
    onTaskMoveTo: handleTaskMoveToSlot,
    editingTaskId,
  };

  return {
    rowHandlers,
    editingTaskId,
    setEditingTaskId,
    recentRollover,
    setRecentRollover,
    handleToggle,
    handleDelete,
    handleQuickCapture,
    handleAddTask,
    handleTaskMoveToSlot,
    addTasksToInbox,
    addTasksAutoScheduled,
  };
}
