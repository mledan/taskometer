import { test, expect, describe } from 'vitest';
import {
  deriveLoad,
  deriveNextTask,
  derivePressureHistory,
  deriveDayTimeline,
  deriveWheelWedges,
  deriveBacklog,
  deriveWeekFit,
  deriveCurrentSlotTasks,
  deriveTodayTasks,
  ymd,
} from './derive';

const TODAY = new Date('2026-04-20T09:00:00');

describe('deriveLoad', () => {
  test('returns 0 when no slots exist', () => {
    expect(deriveLoad({ tasks: [], slots: [], date: TODAY })).toBe(0);
  });

  test('computes percentage from scheduled minutes vs slot capacity', () => {
    const slots = [
      { id: 's1', date: '2026-04-20', startTime: '09:00', endTime: '11:00' }, // 120m
    ];
    const tasks = [
      {
        id: 't1',
        scheduledTime: '2026-04-20T09:00:00',
        duration: 60,
        status: 'pending',
      },
    ];
    expect(deriveLoad({ tasks, slots, date: TODAY })).toBe(50);
  });

  test('clamps to 120 when over-booked', () => {
    const slots = [{ id: 's1', date: '2026-04-20', startTime: '09:00', endTime: '10:00' }];
    const tasks = [
      { id: 't1', scheduledTime: '2026-04-20T09:00:00', duration: 240, status: 'pending' },
    ];
    expect(deriveLoad({ tasks, slots, date: TODAY })).toBe(120);
  });

  test('ignores completed tasks', () => {
    const slots = [{ id: 's1', date: '2026-04-20', startTime: '09:00', endTime: '11:00' }];
    const tasks = [
      { id: 't1', scheduledTime: '2026-04-20T09:00:00', duration: 60, status: 'completed' },
    ];
    expect(deriveLoad({ tasks, slots, date: TODAY })).toBe(0);
  });
});

describe('deriveNextTask', () => {
  test('picks the task whose window contains now', () => {
    const tasks = [
      { id: 'a', scheduledTime: '2026-04-20T08:00:00', duration: 30, status: 'pending' },
      { id: 'b', scheduledTime: '2026-04-20T08:50:00', duration: 60, status: 'pending' },
    ];
    expect(deriveNextTask({ tasks, now: TODAY }).id).toBe('b');
  });

  test('returns next upcoming when nothing is live', () => {
    const tasks = [
      { id: 'a', scheduledTime: '2026-04-20T14:00:00', duration: 30, status: 'pending' },
      { id: 'b', scheduledTime: '2026-04-20T15:00:00', duration: 30, status: 'pending' },
    ];
    expect(deriveNextTask({ tasks, now: TODAY }).id).toBe('a');
  });

  test('falls back to unscheduled task', () => {
    const tasks = [{ id: 'z', status: 'pending' }];
    expect(deriveNextTask({ tasks, now: TODAY }).id).toBe('z');
  });
});

describe('derivePressureHistory', () => {
  test('produces `days` entries with today marked as now', () => {
    const hist = derivePressureHistory({ tasks: [], slots: [], today: TODAY, days: 14 });
    expect(hist).toHaveLength(14);
    expect(hist[hist.length - 1].now).toBe(true);
    expect(hist[0].now).toBeFalsy();
  });
});

describe('deriveDayTimeline + deriveWheelWedges', () => {
  test('return empty arrays when no slots for today', () => {
    const timeline = deriveDayTimeline({ slots: [], tasks: [], date: TODAY, now: TODAY });
    const wedges = deriveWheelWedges({ slots: [], tasks: [], date: TODAY, now: TODAY });
    expect(timeline).toEqual([]);
    expect(wedges).toEqual([]);
  });

  test('derive wedges from real slots with task counts', () => {
    const slots = [
      { id: 's1', date: '2026-04-20', startTime: '09:00', endTime: '12:00', label: 'deep work' },
    ];
    const tasks = [
      { id: 't1', scheduledTime: '2026-04-20T10:00:00', duration: 30, status: 'pending' },
      { id: 't2', scheduledTime: '2026-04-20T11:00:00', duration: 30, status: 'pending' },
    ];
    const wedges = deriveWheelWedges({ slots, tasks, date: TODAY, now: TODAY });
    expect(wedges).toHaveLength(1);
    expect(wedges[0].label).toBe('deep work');
    expect(wedges[0].count).toBe(2);
    expect(wedges[0].current).toBe(true);
  });
});

describe('deriveBacklog', () => {
  test('keeps only unscheduled, non-completed tasks', () => {
    const tasks = [
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'pending', scheduledTime: '2026-04-20T09:00:00' },
      { id: 'c', status: 'completed' },
      { id: 'd', status: 'pending' },
    ];
    const backlog = deriveBacklog({ tasks });
    expect(backlog.map(t => t.id)).toEqual(['a', 'd']);
  });
});

describe('deriveWeekFit', () => {
  test('places scheduled tasks into the correct day column', () => {
    const tasks = [
      {
        id: 't1',
        text: 'finish doc',
        primaryType: 'deep',
        duration: 60,
        status: 'pending',
        scheduledTime: '2026-04-20T09:00:00', // Monday
      },
      {
        id: 't2',
        text: 'standup',
        primaryType: 'mtgs',
        duration: 30,
        status: 'pending',
        scheduledTime: '2026-04-22T10:00:00', // Wednesday
      },
    ];
    const fit = deriveWeekFit({ tasks, slots: [], today: TODAY });
    expect(fit.rowLabels).toEqual(['deep', 'mtgs', 'admin', 'calls', 'play']);
    expect(fit.placed.find(p => p.id === 't1').col).toBe(0);
    expect(fit.placed.find(p => p.id === 't2').col).toBe(2);
  });

  test('capacity buffer is non-negative when empty', () => {
    const fit = deriveWeekFit({ tasks: [], slots: [], today: TODAY });
    expect(fit.capacity.bufferMin).toBeGreaterThanOrEqual(0);
  });
});

describe('deriveCurrentSlotTasks', () => {
  test('returns null slot and empty tasks when no slot covers now', () => {
    const slots = [
      { id: 's1', date: '2026-04-20', startTime: '14:00', endTime: '15:00', label: 'calls' },
    ];
    const tasks = [
      { id: 't1', scheduledTime: '2026-04-20T14:30:00', duration: 30, status: 'pending' },
    ];
    // TODAY is 09:00 — 14-15 slot is not active
    const result = deriveCurrentSlotTasks({ tasks, slots, date: TODAY, now: TODAY });
    expect(result.slot).toBeNull();
    expect(result.tasks).toEqual([]);
  });

  test('returns tasks scheduled inside the active slot window', () => {
    const slots = [
      { id: 's1', date: '2026-04-20', startTime: '08:00', endTime: '12:00', label: 'deep work' },
    ];
    const tasks = [
      { id: 'in', scheduledTime: '2026-04-20T10:00:00', duration: 30, status: 'pending' },
      { id: 'late', scheduledTime: '2026-04-20T17:00:00', duration: 30, status: 'pending' },
      { id: 'done', scheduledTime: '2026-04-20T09:00:00', duration: 30, status: 'completed' },
    ];
    const result = deriveCurrentSlotTasks({ tasks, slots, date: TODAY, now: TODAY });
    expect(result.slot?.id).toBe('s1');
    expect(result.tasks.map(t => t.id)).toEqual(['in']);
  });

  test('excludes tasks that belong to a different day', () => {
    const slots = [
      { id: 's1', date: '2026-04-20', startTime: '08:00', endTime: '12:00', label: 'deep work' },
    ];
    const tasks = [
      { id: 'tom', scheduledTime: '2026-04-21T10:00:00', duration: 30, status: 'pending' },
    ];
    const result = deriveCurrentSlotTasks({ tasks, slots, date: TODAY, now: TODAY });
    expect(result.tasks).toEqual([]);
  });
});

describe('deriveTodayTasks', () => {
  test('returns tasks scheduled today, sorted by time, with state tags', () => {
    const tasks = [
      { id: 'a', scheduledTime: '2026-04-20T15:00:00', duration: 30, status: 'pending' }, // upcoming
      { id: 'b', scheduledTime: '2026-04-20T08:30:00', duration: 60, status: 'pending' }, // live (now is 9:00)
      { id: 'c', scheduledTime: '2026-04-20T07:00:00', duration: 30, status: 'pending' }, // past
      { id: 'd', scheduledTime: '2026-04-19T15:00:00', duration: 30, status: 'pending' }, // not today
      { id: 'e', scheduledTime: '2026-04-20T06:00:00', duration: 30, status: 'completed' }, // done
    ];
    const result = deriveTodayTasks({ tasks, date: TODAY, now: TODAY });
    expect(result.map(r => r.task.id)).toEqual(['e', 'c', 'b', 'a']);
    expect(result.find(r => r.task.id === 'b').state).toBe('live');
    expect(result.find(r => r.task.id === 'c').state).toBe('past');
    expect(result.find(r => r.task.id === 'a').state).toBe('upcoming');
    expect(result.find(r => r.task.id === 'e').state).toBe('done');
  });

  test('skips unscheduled and cancelled tasks', () => {
    const tasks = [
      { id: 'a', status: 'pending' },
      { id: 'b', scheduledTime: '2026-04-20T10:00:00', status: 'cancelled' },
    ];
    const result = deriveTodayTasks({ tasks, date: TODAY, now: TODAY });
    expect(result).toEqual([]);
  });
});

describe('ymd', () => {
  test('produces zero-padded YYYY-MM-DD', () => {
    expect(ymd(new Date('2026-01-05T00:00:00'))).toBe('2026-01-05');
  });
});
