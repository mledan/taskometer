import { FAMOUS_WHEELS } from '../../defaults/famousWheels';
import { log as telemetryLog } from '../../services/telemetry.js';
import { formatYMD, formatDateLabel } from '../../utils/time.js';

/**
 * Wires the Library drawer's four tabs to the paint and task actions.
 * Every apply closes the drawer so the user sees the result land.
 */
export function useLibraryActions({
  api, paint, viewKey, selectedDate, userWheels, taskTypes, activeWheelId,
  pendingRange, pendingDays, addTasksToInbox, addTasksAutoScheduled, closeLibrary,
}) {
  return {
    schedules: {
      api,
      userWheels,
      taskTypes,
      wheels: [...userWheels, ...FAMOUS_WHEELS.filter(fw => !userWheels.some(uw => uw.id === fw.id))],
      currentWheelId: activeWheelId,
      rangeContext: pendingRange,
      paintingDays: pendingDays,
      onApply: async (wheelId) => {
        if (pendingDays && pendingDays.length > 0) await paint.paintWheelOverDays(wheelId, pendingDays);
        else if (pendingRange) await paint.paintWheelOverRange(wheelId, pendingRange.startDate, pendingRange.endDate);
        else await paint.applyWheelToDay(wheelId);
        closeLibrary();
      },
    },
    routines: {
      dateLabel: formatDateLabel(selectedDate),
      onApply: async (wheelId, slice) => {
        const partial = slice && (slice.from || slice.to);
        await paint.applyWheelToDay(wheelId, partial ? { from: slice.from, to: slice.to } : {});
        telemetryLog(partial ? 'ui:routine-slice' : 'ui:routine-apply', { wheelId, slice: slice?.id, date: viewKey });
        closeLibrary();
      },
    },
    paths: {
      onAdopt: async (path, wheel, pack) => {
        const actualId = await paint.ensureWheel(wheel);
        if (!actualId) return;
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + (path.duration - 1));
        await api.wheels.applyToRange(actualId, formatYMD(start), formatYMD(end), { weekdaysOnly: !!path.weekdaysOnly, mode: 'replace' });
        await addTasksToInbox(pack.tasks);
        telemetryLog('path:adopted', { pathId: path.id, wheelId: actualId, packId: pack.id, days: path.duration, tasks: pack.tasks.length });
        closeLibrary();
      },
    },
    packs: {
      onAddToInbox: async (tasks) => { await addTasksToInbox(tasks); telemetryLog('packs:added-to-inbox', { count: tasks.length }); closeLibrary(); },
      onScheduleToday: async (tasks) => { await addTasksAutoScheduled(tasks); telemetryLog('packs:scheduled-today', { count: tasks.length }); closeLibrary(); },
    },
  };
}
