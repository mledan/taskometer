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
import { makeTaskometerAPI } from './TaskometerAPI';
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
    };
  }, [state.tasks, state.slots, now]);

  return { state, api, derived };
}

export default useTaskometerAPI;
