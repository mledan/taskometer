/**
 * useTaskometerAPI — the single hook the Taskometer UI consumes.
 *
 * Exposes:
 *   { state, api, derived }
 *
 * - `state` is the raw AppContext slice (tasks, slots, isLoading, error).
 * - `api` is the TaskometerAPI façade, bound to this session's dispatch.
 * - `derived` is memoised view-models from the pure selectors.
 */

import { useMemo, useRef } from 'react';
import { useAppState, useAppReducer } from '../../context/AppContext';
import { makeTaskometerAPI, evaluateRules } from './TaskometerAPI';
import {
  deriveLoad,
  deriveNextTask,
  derivePressureHistory,
  deriveDayTimeline,
  deriveWheelWedges,
  deriveNowTask,
  deriveUpcoming,
  derivePushed,
  deriveBacklog,
  deriveWeekFit,
  deriveStats,
  deriveCurrentSlotTasks,
  deriveNextSlotTasks,
  deriveTodayTasks,
} from './derive';

export function useTaskometerAPI() {
  const state = useAppState();
  const dispatch = useAppReducer();
  const stateRef = useRef(state);
  stateRef.current = state;

  const api = useMemo(
    () => makeTaskometerAPI({ dispatch, getState: () => stateRef.current }),
    [dispatch]
  );

  const now = useMemo(() => new Date(), [
    // Re-cut 'now' only when task/slot collections change — good enough
    // for one render pass; a clock tick is the caller's job if they want it.
    state.tasks, state.slots,
  ]);

  const derived = useMemo(() => {
    const tasks = state.tasks || [];
    const slots = state.slots || [];
    const date = now;
    const settings = state.settings || {};

    return {
      load: deriveLoad({ tasks, slots, date }),
      next: deriveNextTask({ tasks, now }),
      pressure: derivePressureHistory({ tasks, slots, today: date }),
      timeline: deriveDayTimeline({ slots, tasks, date, now }),
      wedges: deriveWheelWedges({ slots, tasks, date, now }),
      nowTask: deriveNowTask({ tasks, date, now }),
      upcoming: deriveUpcoming({ tasks, date, now, limit: 3 }),
      pushed: derivePushed({ tasks, date, limit: 3 }),
      backlog: deriveBacklog({ tasks, limit: 10 }),
      weekFit: deriveWeekFit({ tasks, slots, today: date }),
      stats: deriveStats({ tasks, date }),
      currentSlot: deriveCurrentSlotTasks({ tasks, slots, date, now }),
      nextSlot: deriveNextSlotTasks({ tasks, slots, date, now }),
      todayTasks: deriveTodayTasks({ tasks, date, now }),
      wheels: settings.wheels || [],
      dayAssignments: settings.dayAssignments || {},
      dayOverrides: settings.dayOverrides || {},
      scheduleRules: settings.scheduleRules || [],
      /**
       * Compose rules + pins for an arbitrary date. Views use this to
       * render ruled days (dashed) vs. manually-pinned days (solid) without
       * having to duplicate the resolver logic from TaskometerAPI.
       */
      resolveDay: (dateKey) => {
        const pinWheel = (settings.dayAssignments || {})[dateKey] || null;
        const pinOverride = (settings.dayOverrides || {})[dateKey] || null;
        if (pinOverride || pinWheel) {
          return { wheelId: pinWheel, override: pinOverride, source: 'pin' };
        }
        const ruled = evaluateRules(settings.scheduleRules || [], dateKey);
        if (ruled) return { ...ruled, source: 'rule' };
        return { wheelId: null, override: null, source: 'none' };
      },
    };
  }, [state.tasks, state.slots, state.settings, now]);

  return { state, api, derived };
}

export default useTaskometerAPI;
