import { afterEach, describe, expect, it, vi } from 'vitest';
import { findOptimalTimeSlot } from './intelligentScheduler.js';

const BASE_SCHEDULE = {
  id: 'test_schedule',
  name: 'Test Schedule',
  timeBlocks: [
    { type: 'work', start: '09:00', end: '18:00', label: 'Work Block' }
  ]
};

afterEach(() => {
  vi.useRealTimers();
});

describe('intelligentScheduler task type constraints', () => {
  it('uses future allowed day when current day is not allowed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 16, 8, 0, 0)); // Monday

    const task = {
      id: 'task-1',
      text: 'Deep work',
      taskType: 'work',
      primaryType: 'work',
      duration: 30,
      priority: 'medium'
    };

    const slot = findOptimalTimeSlot(task, BASE_SCHEDULE, [], [
      { id: 'work', allowedDays: ['Tuesday'], constraints: {} }
    ]);

    expect(slot).not.toBeNull();
    const scheduled = new Date(slot.scheduledTime);
    expect(scheduled.toLocaleDateString('en-US', { weekday: 'long' })).toBe('Tuesday');
  });

  it('applies preferred start/end time constraints for matching type', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 16, 8, 0, 0)); // Monday

    const task = {
      id: 'task-2',
      text: 'Constrained task',
      taskType: 'work',
      primaryType: 'work',
      duration: 45,
      priority: 'high'
    };

    const slot = findOptimalTimeSlot(task, BASE_SCHEDULE, [], [
      {
        id: 'work',
        allowedDays: ['Monday'],
        constraints: { preferredTimeStart: '14:00', preferredTimeEnd: '16:00' }
      }
    ]);

    expect(slot).not.toBeNull();
    const scheduled = new Date(slot.scheduledTime);
    expect(scheduled.getHours()).toBe(14);
    expect(scheduled.getMinutes()).toBe(0);
  });

  it('returns null when task type has no allowed days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 16, 8, 0, 0)); // Monday

    const task = {
      id: 'task-3',
      text: 'Blocked task',
      taskType: 'work',
      primaryType: 'work',
      duration: 30,
      priority: 'medium'
    };

    const slot = findOptimalTimeSlot(task, BASE_SCHEDULE, [], [
      { id: 'work', allowedDays: [], constraints: {} }
    ]);

    expect(slot).toBeNull();
  });
});
