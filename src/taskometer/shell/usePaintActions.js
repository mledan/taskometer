import { useCallback } from 'react';
import { STARTER_WHEELS } from '../../services/api/TaskometerAPI';
import { FAMOUS_WHEELS } from '../../defaults/famousWheels';
import { ARCHETYPE_WHEELS } from '../../defaults/scheduleArchetypes';
import { emit, EVENTS } from '../../services/events.js';
import { log as telemetryLog } from '../../services/telemetry.js';
import { formatYMD } from '../../utils/time.js';

const TEMPLATES = () => [...STARTER_WHEELS, ...ARCHETYPE_WHEELS, ...FAMOUS_WHEELS];

/**
 * Every way a schedule gets painted onto days. All of them funnel
 * through `ensureWheel`, which clones a template into the user's
 * library on first use so applyToDate/applyToRange can address it by id.
 */
export function usePaintActions({ api, userWheels, viewKey }) {
  const ensureWheel = useCallback(async (wheelOrId) => {
    const id = typeof wheelOrId === 'string' ? wheelOrId : wheelOrId?.id;
    if (!id) return null;
    const existing = userWheels.find(w => w.id === id);
    if (existing) return existing.id;
    const tmpl = typeof wheelOrId === 'object' ? wheelOrId : TEMPLATES().find(w => w.id === id);
    if (!tmpl) return null;
    const added = await api.wheels.add({ id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks });
    return added.id;
  }, [api, userWheels]);

  const applyWheelToDay = useCallback(async (wheelId, opts = {}) => {
    if (!wheelId) {
      await api.days.unassign(viewKey);
      return;
    }
    const actualId = await ensureWheel(wheelId);
    if (!actualId) return;
    await api.wheels.applyToDate(actualId, viewKey, { mode: 'replace', ...opts });
    telemetryLog('rail:applied', { wheelId, date: viewKey, ...opts });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, date: viewKey });
  }, [api, ensureWheel, viewKey]);

  const paintWheelOnDate = useCallback(async (wheelId, dateKey) => {
    if (!wheelId || !dateKey) return;
    const actualId = await ensureWheel(wheelId);
    if (!actualId) return;
    await api.wheels.applyToDate(actualId, dateKey, { mode: 'replace' });
    telemetryLog('drag-paint:applied', { wheelId, date: dateKey });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, date: dateKey });
  }, [api, ensureWheel]);

  const paintWheelOverDays = useCallback(async (wheelId, dates) => {
    if (!wheelId || !Array.isArray(dates) || dates.length === 0) return;
    const actualId = await ensureWheel(wheelId);
    if (!actualId) return;
    for (const dateKey of dates) {
      // eslint-disable-next-line no-await-in-loop
      await api.wheels.applyToDate(actualId, dateKey, { mode: 'replace' });
    }
    telemetryLog('multi-paint:applied', { wheelId, count: dates.length });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, count: dates.length });
  }, [api, ensureWheel]);

  const paintWheelOverRange = useCallback(async (wheelId, startDate, endDate) => {
    if (!wheelId || !startDate || !endDate) return;
    const actualId = await ensureWheel(wheelId);
    if (!actualId) return;
    const result = await api.wheels.applyToRange(actualId, startDate, endDate, { mode: 'replace' });
    telemetryLog('lasso-paint:applied', { wheelId, count: result?.painted?.length || 0, startDate, endDate });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, startDate, endDate });
  }, [api, ensureWheel]);

  // Painter modal: range + weekday filter + merge mode.
  const paintWheelAcrossRange = useCallback(async (wheel, { startDate, endDate, weekdaysOnly, weekendsOnly, customDow, mode }) => {
    const actualId = await ensureWheel(wheel);
    if (!actualId) return;
    if (customDow && customDow.length > 0 && customDow.length < 7) {
      const set = new Set(customDow);
      const out = [];
      const cur = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      while (cur.getTime() <= end.getTime()) {
        if (set.has((cur.getDay() + 6) % 7)) out.push(formatYMD(cur));
        cur.setDate(cur.getDate() + 1);
      }
      for (const dateKey of out) {
        // eslint-disable-next-line no-await-in-loop
        await api.wheels.applyToDate(actualId, dateKey, { mode });
      }
      telemetryLog('painter:applied', { wheelId: actualId, count: out.length, customDow });
      return;
    }
    const result = await api.wheels.applyToRange(actualId, startDate, endDate, { weekdaysOnly, weekendsOnly, mode });
    telemetryLog('painter:applied', { wheelId: actualId, count: result?.painted?.length || 0, weekdaysOnly, weekendsOnly });
  }, [api, ensureWheel]);

  // Week canvas drag-paint.
  const paintWeekRange = useCallback(async ({ wheelId, material, startKey, endKey, weekdaysOnly, weekendsOnly }) => {
    if (material === 'blank') {
      const result = await api.wheels.clearRange(startKey, endKey, { weekdaysOnly: !!weekdaysOnly, weekendsOnly: !!weekendsOnly });
      telemetryLog('ui:week-paint-blank', { count: result?.cleared?.length || 0 });
      return;
    }
    if (!wheelId) return;
    const result = await api.wheels.applyToRange(wheelId, startKey, endKey, {
      weekdaysOnly: !!weekdaysOnly, weekendsOnly: !!weekendsOnly, mode: 'replace',
    });
    telemetryLog('ui:week-paint', { wheelId, count: result?.painted?.length || 0, weekdaysOnly: !!weekdaysOnly, weekendsOnly: !!weekendsOnly });
    emit(EVENTS.WHEEL_APPLIED, { wheelId });
  }, [api]);

  const clearDays = useCallback(async (dates) => {
    for (const dateKey of dates) {
      // eslint-disable-next-line no-await-in-loop
      await api.wheels.clearRange(dateKey, dateKey);
    }
    telemetryLog('paint:blank-days', { count: dates.length });
  }, [api]);

  const clearRange = useCallback(async (startDate, endDate) => {
    await api.wheels.clearRange(startDate, endDate);
    telemetryLog('paint:blank-range', { startDate, endDate });
  }, [api]);

  return {
    ensureWheel,
    applyWheelToDay,
    paintWheelOnDate,
    paintWheelOverDays,
    paintWheelOverRange,
    paintWheelAcrossRange,
    paintWeekRange,
    clearDays,
    clearRange,
  };
}
