import { useEffect, useRef } from 'react';
import { DEFAULT_DAY_WHEEL_ID } from '../../defaults/defaultSchedule';
import { findScheduleTarget } from '../../services/scheduling.js';
import { log as telemetryLog, snapshotState } from '../../services/telemetry.js';
import { formatYMD } from '../../utils/time.js';

/**
 * Two boot-time sweeps:
 *  1. Skeleton self-heal — every day in the next 30 that has no slots,
 *     no assignment and no override gets the default workday/weekend
 *     schedule, so the planner is never empty.
 *  2. Carry-forward — incomplete tasks scheduled in the past move to
 *     the next matching slot from today onwards.
 */
export function useBootMaintenance({ state, api, zoom }) {
  const loggedReadyRef = useRef(false);
  const seededRef = useRef(false);
  const carriedRef = useRef(false);

  useEffect(() => {
    if (loggedReadyRef.current) return;
    if (state.isLoading || !state.isInitialized) return;
    loggedReadyRef.current = true;
    telemetryLog('app:ready', { zoom, ...snapshotState(state) });

    if (seededRef.current) return;
    const wheelsList = state.settings?.wheels || [];
    if (wheelsList.length < 1) return;
    const workday = wheelsList.find(w => w.id === DEFAULT_DAY_WHEEL_ID) || wheelsList[0];
    const weekend = wheelsList.find(w => w.id === 'starter_weekend')
      || wheelsList.find(w => w.id !== workday?.id)
      || workday;
    if (!workday) return;

    const slotsByDate = new Map();
    for (const s of state.slots || []) {
      if (!s?.date) continue;
      slotsByDate.set(s.date, (slotsByDate.get(s.date) || 0) + 1);
    }
    const assignments = state.settings?.dayAssignments || {};
    const overrides = state.settings?.dayOverrides || {};

    const targets = [];
    const cursor = new Date();
    for (let i = 0; i < 30; i++) {
      const key = formatYMD(cursor);
      const empty = (slotsByDate.get(key) || 0) === 0 && !assignments[key] && !overrides[key];
      if (empty) {
        const dow = cursor.getDay();
        const wheel = (dow === 0 || dow === 6) ? weekend : workday;
        targets.push({ date: key, wheelId: wheel.id });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (targets.length === 0) return;
    seededRef.current = true;
    (async () => {
      try {
        for (const t of targets) {
          // eslint-disable-next-line no-await-in-loop
          await api.wheels.applyToDate(t.wheelId, t.date, { mode: 'replace' });
        }
        telemetryLog('skeleton:self-heal', { painted: targets.length, first: targets[0]?.date, last: targets[targets.length - 1]?.date });
      } catch (err) {
        telemetryLog('skeleton:self-heal-error', { message: err?.message });
        seededRef.current = false;
      }
    })();
  }, [state, zoom, api]);

  useEffect(() => {
    if (carriedRef.current) return;
    if (state.isLoading || !state.isInitialized) return;
    // Wait for the self-heal to settle — the two race on settings otherwise.
    if (!seededRef.current) return;

    const now = new Date();
    const todayKey = formatYMD(now);
    const overdue = (state.tasks || []).filter(t => {
      if (!t || t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.scheduledTime) return false;
      const d = new Date(t.scheduledTime);
      if (Number.isNaN(d.getTime())) return false;
      const dayKey = formatYMD(d);
      if (dayKey < todayKey) return true;
      if (dayKey === todayKey) {
        const dur = typeof t.duration === 'number' ? t.duration : 30;
        return d.getTime() + dur * 60 * 1000 < now.getTime();
      }
      return false;
    });

    carriedRef.current = true;
    if (overdue.length === 0) return;

    (async () => {
      let moved = 0;
      for (const t of overdue) {
        const target = findScheduleTarget({
          taskType: t.primaryType || t.taskType,
          duration: t.duration || 30,
          state,
          preferDate: todayKey,
        });
        if (!target) continue;
        let slotId = target.slot?.id || null;
        if (target.kind === 'rhythm') {
          // eslint-disable-next-line no-await-in-loop
          const created = await api.slots.add(target.slotShape);
          slotId = created.id;
        }
        const d = new Date(`${target.date}T00:00:00`);
        d.setHours(Math.floor(target.startMin / 60), target.startMin % 60, 0, 0);
        const iso = d.toISOString();
        // eslint-disable-next-line no-await-in-loop
        await api.tasks.update(t.id || t.key, {
          scheduledTime: iso,
          scheduledFor: iso,
          scheduledSlotId: slotId,
          metadata: { ...(t.metadata || {}), carriedForwardAt: new Date().toISOString() },
        });
        moved++;
      }
      if (moved > 0) telemetryLog('carry-forward', { moved, total: overdue.length });
    })();
  }, [state, api]);
}
