import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleTask, scheduleMultipleTasks, previewTaskSchedule } from './schedulingEngine.js';

function makeSlot(overrides = {}) {
  return {
    id: overrides.id || `slot_${Math.random().toString(36).slice(2)}`,
    date: overrides.date || '2026-02-24',
    startTime: overrides.startTime || '09:00',
    endTime: overrides.endTime || '12:00',
    slotType: overrides.slotType || null,
    allowedTags: overrides.allowedTags || [],
    assignedTaskId: overrides.assignedTaskId || null,
    label: overrides.label || 'Test Slot',
    color: overrides.color || '#3B82F6',
    flexibility: overrides.flexibility || 'preferred',
    sourceScheduleId: overrides.sourceScheduleId || null,
    sourceBlockId: overrides.sourceBlockId || null,
    isRecurring: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeTask(overrides = {}) {
  return {
    id: overrides.id || `task_${Math.random().toString(36).slice(2)}`,
    text: overrides.text || 'Test task',
    status: overrides.status || 'pending',
    primaryType: overrides.primaryType || overrides.taskType || 'work',
    taskType: overrides.taskType || overrides.primaryType || 'work',
    tags: overrides.tags || [],
    duration: overrides.duration || 30,
    priority: overrides.priority || 'medium',
    scheduledTime: overrides.scheduledTime || null,
    scheduledSlotId: overrides.scheduledSlotId || null,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
// SCENARIO 1: No framework set
// ===========================================================================

describe('Scenario 1: No framework - ad-hoc scheduling', () => {
  it('schedules a task into the next available time slot from now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 10, 0, 0)); // Tue Feb 24, 10:00

    const task = makeTask({ duration: 30 });
    const state = { slots: [], tasks: [], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    const scheduled = new Date(result.scheduledTime);
    expect(scheduled.getHours()).toBe(10);
    expect(scheduled.getMinutes()).toBe(0);
    expect(result.reason).toContain('no framework');
  });

  it('skips conflict and finds next available window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 10, 0, 0));

    const existingTask = makeTask({
      id: 'existing-1',
      scheduledTime: new Date(2026, 1, 24, 10, 0, 0).toISOString(),
      duration: 60,
    });

    const task = makeTask({ duration: 30 });
    const state = { slots: [], tasks: [existingTask], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    const scheduled = new Date(result.scheduledTime);
    expect(scheduled.getHours()).toBe(11);
    expect(scheduled.getMinutes()).toBe(0);
  });

  it('rolls to next day when today is full', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 21, 45, 0)); // 9:45 PM

    const task = makeTask({ duration: 60 });
    const state = { slots: [], tasks: [], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    const scheduled = new Date(result.scheduledTime);
    expect(scheduled.getDate()).toBe(25);
    expect(scheduled.getHours()).toBe(9);
  });

  it('respects task type allowed days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 10, 0, 0)); // Tuesday

    const task = makeTask({ primaryType: 'work', duration: 30 });
    const state = {
      slots: [],
      tasks: [],
      settings: {},
      taskTypes: [
        { id: 'work', allowedDays: ['Wednesday', 'Thursday'], constraints: {} },
      ],
    };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.specificDay).toBe('Wednesday');
  });

  it('returns null when task type has empty allowedDays', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 10, 0, 0));

    const task = makeTask({ primaryType: 'work', duration: 30 });
    const state = {
      slots: [],
      tasks: [],
      settings: {},
      taskTypes: [{ id: 'work', allowedDays: [], constraints: {} }],
    };

    const result = scheduleTask(task, state);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// SCENARIO 2: Framework with tagged slots (AM/PM/EVE)
// ===========================================================================

describe('Scenario 2: Framework with AM/PM/EVE slots', () => {
  const morningSlot = makeSlot({
    id: 'slot-am',
    date: '2026-02-24',
    startTime: '06:00',
    endTime: '12:00',
    slotType: 'work',
    label: 'Morning',
    flexibility: 'preferred',
    allowedTags: ['work'],
  });

  const afternoonSlot = makeSlot({
    id: 'slot-pm',
    date: '2026-02-24',
    startTime: '12:00',
    endTime: '17:00',
    slotType: 'learning',
    label: 'Afternoon',
    flexibility: 'preferred',
    allowedTags: ['learning'],
  });

  const eveningSlot = makeSlot({
    id: 'slot-eve',
    date: '2026-02-24',
    startTime: '17:00',
    endTime: '22:00',
    slotType: 'creative',
    label: 'Evening',
    flexibility: 'preferred',
    allowedTags: ['creative'],
  });

  const frameworkSlots = [morningSlot, afternoonSlot, eveningSlot];

  it('routes a work task to the Morning slot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 5, 0, 0));

    const task = makeTask({ primaryType: 'work', tags: ['work'], duration: 60 });
    const state = { slots: frameworkSlots, tasks: [], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.label).toBe('Morning');
    expect(result.slotId).toBe('slot-am');
  });

  it('routes a learning task to the Afternoon slot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 5, 0, 0));

    const task = makeTask({ primaryType: 'learning', tags: ['learning'], duration: 30 });
    const state = { slots: frameworkSlots, tasks: [], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.label).toBe('Afternoon');
  });

  it('routes a creative task to the Evening slot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 5, 0, 0));

    const task = makeTask({ primaryType: 'creative', tags: ['creative'], duration: 45 });
    const state = { slots: frameworkSlots, tasks: [], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.label).toBe('Evening');
  });

  it('untagged task goes to flexible/any available slot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 5, 0, 0));

    const flexSlot = makeSlot({
      id: 'slot-flex',
      date: '2026-02-24',
      startTime: '08:00',
      endTime: '09:00',
      slotType: null,
      label: 'Flex Time',
      flexibility: 'flexible',
      allowedTags: [],
    });

    const task = makeTask({ primaryType: 'chores', tags: [], duration: 30 });
    const state = {
      slots: [...frameworkSlots, flexSlot],
      tasks: [],
      settings: {},
      taskTypes: [],
    };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.slotId).toBe('slot-flex');
  });
});

// ===========================================================================
// SCENARIO 3: All today's slots filled -> overflow to next day
// ===========================================================================

describe('Scenario 3: Overflow to next day/week', () => {
  it('schedules to tomorrow when today is full', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 8, 0, 0));

    const todaySlot = makeSlot({
      id: 'slot-today',
      date: '2026-02-24',
      startTime: '09:00',
      endTime: '17:00',
      slotType: 'work',
      assignedTaskId: 'task-existing',
    });

    const tomorrowSlot = makeSlot({
      id: 'slot-tomorrow',
      date: '2026-02-25',
      startTime: '09:00',
      endTime: '17:00',
      slotType: 'work',
    });

    const existingTask = makeTask({
      id: 'task-existing',
      scheduledTime: new Date(2026, 1, 24, 9, 0, 0).toISOString(),
      duration: 480,
    });

    const task = makeTask({ primaryType: 'work', duration: 60 });
    const state = {
      slots: [todaySlot, tomorrowSlot],
      tasks: [existingTask],
      settings: {},
      taskTypes: [],
    };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.date).toBe('2026-02-25');
    expect(result.slotId).toBe('slot-tomorrow');
  });

  it('generates default day slots for future days when needed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 8, 0, 0)); // Tuesday

    const todaySlotFull = makeSlot({
      id: 'slot-today',
      date: '2026-02-24',
      startTime: '09:00',
      endTime: '17:00',
      slotType: 'work',
      assignedTaskId: 'task-existing',
    });

    const existingTask = makeTask({
      id: 'task-existing',
      scheduledTime: new Date(2026, 1, 24, 9, 0, 0).toISOString(),
      duration: 480,
    });

    const task = makeTask({ primaryType: 'work', duration: 60 });
    const state = {
      slots: [todaySlotFull],
      tasks: [existingTask],
      settings: {
        defaultDaySlots: [
          {
            id: 'default-work',
            day: 'Wednesday',
            startTime: '09:00',
            endTime: '17:00',
            slotType: 'work',
            label: 'Work Block',
            flexibility: 'preferred',
          },
        ],
      },
      taskTypes: [],
    };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.date).toBe('2026-02-25');
    expect(result.label).toBe('Work Block');
  });

  it('fills multiple days across a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 5, 0, 0));

    const slots = [];
    for (let i = 0; i < 7; i++) {
      const day = 24 + i;
      const dateStr = `2026-02-${day.toString().padStart(2, '0')}`;
      slots.push(makeSlot({
        id: `slot-day-${i}`,
        date: dateStr,
        startTime: '09:00',
        endTime: '10:00',
        slotType: 'work',
        label: 'Work AM',
      }));
    }

    const tasks = [];
    for (let i = 0; i < 6; i++) {
      const day = 24 + i;
      tasks.push(makeTask({
        id: `task-${i}`,
        scheduledTime: new Date(2026, 1, day, 9, 0, 0).toISOString(),
        duration: 60,
      }));
    }

    const newTask = makeTask({ primaryType: 'work', duration: 30 });
    const state = { slots, tasks, settings: {}, taskTypes: [] };

    const result = scheduleTask(newTask, state);

    expect(result).not.toBeNull();
    expect(result.date).toBe('2026-03-02');
  });
});

// ===========================================================================
// SCENARIO 4: Edge cases
// ===========================================================================

describe('Scenario 4: Edge cases', () => {
  it('handles zero slots gracefully', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 10, 0, 0));

    const task = makeTask({ duration: 30 });
    const state = { slots: [], tasks: [], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);
    expect(result).not.toBeNull();
    expect(result.reason).toContain('no framework');
  });

  it('handles completed tasks as non-blocking', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 10, 0, 0));

    const completedTask = makeTask({
      id: 'done-1',
      scheduledTime: new Date(2026, 1, 24, 10, 0, 0).toISOString(),
      duration: 120,
      status: 'completed',
    });

    const task = makeTask({ duration: 30 });
    const state = { slots: [], tasks: [completedTask], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    const scheduled = new Date(result.scheduledTime);
    expect(scheduled.getHours()).toBe(10);
  });

  it('task with mismatched type uses flexible slot as fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 5, 0, 0));

    const typedSlot = makeSlot({
      id: 'slot-work',
      date: '2026-02-24',
      startTime: '09:00',
      endTime: '17:00',
      slotType: 'work',
      flexibility: 'fixed',
    });

    const flexSlot = makeSlot({
      id: 'slot-flex',
      date: '2026-02-24',
      startTime: '17:00',
      endTime: '22:00',
      slotType: null,
      flexibility: 'flexible',
      label: 'Evening Flex',
    });

    const task = makeTask({ primaryType: 'creative', duration: 30 });
    const state = { slots: [typedSlot, flexSlot], tasks: [], settings: {}, taskTypes: [] };

    const result = scheduleTask(task, state);

    expect(result).not.toBeNull();
    expect(result.slotId).toBe('slot-flex');
  });

  it('previewTaskSchedule works identically to scheduleTask', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 10, 0, 0));

    const task = makeTask({ duration: 30 });
    const state = { slots: [], tasks: [], settings: {}, taskTypes: [] };

    const preview = previewTaskSchedule(task, state);
    const scheduled = scheduleTask(task, state);

    expect(preview?.scheduledTime).toBe(scheduled?.scheduledTime);
  });
});

// ===========================================================================
// Batch scheduling
// ===========================================================================

describe('Batch scheduling (scheduleMultipleTasks)', () => {
  it('schedules multiple tasks without conflicts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 8, 0, 0));

    const slot = makeSlot({
      id: 'slot-big',
      date: '2026-02-24',
      startTime: '09:00',
      endTime: '17:00',
      slotType: null,
      flexibility: 'flexible',
    });

    const tasks = [
      makeTask({ id: 'task-1', duration: 60, priority: 'high' }),
      makeTask({ id: 'task-2', duration: 30, priority: 'medium' }),
      makeTask({ id: 'task-3', duration: 45, priority: 'low' }),
    ];

    const state = { slots: [slot], tasks: [], settings: {}, taskTypes: [] };
    const results = scheduleMultipleTasks(tasks, state);

    const scheduled = results.filter(r => r.result !== null);
    expect(scheduled.length).toBe(3);

    const times = scheduled.map(r => new Date(r.result.scheduledTime).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
  });

  it('high priority tasks get scheduled first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 24, 8, 0, 0));

    const slot = makeSlot({
      id: 'slot-small',
      date: '2026-02-24',
      startTime: '09:00',
      endTime: '10:00',
      slotType: null,
      flexibility: 'flexible',
    });

    const tasks = [
      makeTask({ id: 'low-task', duration: 30, priority: 'low' }),
      makeTask({ id: 'high-task', duration: 30, priority: 'high' }),
    ];

    const state = { slots: [slot], tasks: [], settings: {}, taskTypes: [] };
    const results = scheduleMultipleTasks(tasks, state);

    const highResult = results.find(r => r.task.id === 'high-task');
    const lowResult = results.find(r => r.task.id === 'low-task');

    expect(highResult.result).not.toBeNull();
    expect(lowResult.result).not.toBeNull();
    expect(new Date(highResult.result.scheduledTime).getTime())
      .toBeLessThan(new Date(lowResult.result.scheduledTime).getTime());
  });
});
