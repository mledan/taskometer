import { beforeEach, describe, test, expect } from 'vitest';
import { findScheduleTarget } from './scheduling.js';
import { addRhythm, addException } from './rhythms.js';

/**
 * Tests for the forward-rolling scheduler. The bug we're fixing:
 * before this engine existed, tasks that wouldn't fit in their target
 * slot got clamped to the slot's last 30 minutes, producing
 * overlapping rows. The new engine walks forward and finds a real fit.
 */

beforeEach(() => {
  localStorage.clear();
});

const T = (id, slotId, scheduledTime, duration = 30) => ({
  id,
  status: 'pending',
  scheduledSlotId: slotId,
  scheduledTime,
  duration,
});
const slotMin = (date, slotType, startTime, endTime) => ({
  id: `${date}-${slotType}`,
  date,
  slotType,
  startTime,
  endTime,
});

describe('preferred slot has room', () => {
  test('returns the preferred slot at the next free minute', () => {
    const state = {
      slots: [slotMin('2026-04-15', 'work', '13:00', '17:00')],
      tasks: [
        T('a', '2026-04-15-work', '2026-04-15T13:00:00', 30),
        T('b', '2026-04-15-work', '2026-04-15T13:30:00', 30),
      ],
    };
    const target = findScheduleTarget({
      taskType: 'work',
      duration: 30,
      state,
      preferDate: '2026-04-15',
      preferSlotId: '2026-04-15-work',
      rhythms: [],
      exceptions: [],
    });
    expect(target.kind).toBe('concrete');
    expect(target.date).toBe('2026-04-15');
    expect(target.startMin).toBe(14 * 60); // 14:00
  });
});

describe('preferred slot is full → roll to tomorrow', () => {
  test('rolls forward when today is fully booked', () => {
    // Work slot 13:00–17:00 with four 1-hour tasks back to back.
    const state = {
      slots: [
        slotMin('2026-04-15', 'work', '13:00', '17:00'),
        slotMin('2026-04-16', 'work', '13:00', '17:00'),
      ],
      tasks: [
        T('a', '2026-04-15-work', '2026-04-15T13:00:00', 60),
        T('b', '2026-04-15-work', '2026-04-15T14:00:00', 60),
        T('c', '2026-04-15-work', '2026-04-15T15:00:00', 60),
        T('d', '2026-04-15-work', '2026-04-15T16:00:00', 60),
      ],
    };
    const target = findScheduleTarget({
      taskType: 'work',
      duration: 30,
      state,
      preferDate: '2026-04-15',
      preferSlotId: '2026-04-15-work',
      rhythms: [],
      exceptions: [],
    });
    expect(target.kind).toBe('concrete');
    expect(target.date).toBe('2026-04-16');
    expect(target.startMin).toBe(13 * 60);
  });
});

describe('rhythm rollover when no concrete slot exists', () => {
  test('finds tomorrow\'s rhythm projection if no concrete slot', () => {
    // Today's Work block is full. Tomorrow has no concrete slot but a
    // weekly Work rhythm fires every weekday. The engine should
    // surface a rhythm target for the caller to materialize.
    const state = {
      slots: [slotMin('2026-04-15', 'work', '13:00', '17:00')],
      tasks: [
        T('a', '2026-04-15-work', '2026-04-15T13:00:00', 240),
      ],
    };
    const rhythm = {
      id: 'r-work',
      name: 'Work block',
      color: '#D4663A',
      slotType: 'work',
      startTime: '13:00',
      endTime: '17:00',
      cadence: { kind: 'weekly', dayOfWeek: 4 }, // Thursday — Apr 16 2026 is Thu
    };
    const target = findScheduleTarget({
      taskType: 'work',
      duration: 30,
      state,
      preferDate: '2026-04-15',
      preferSlotId: '2026-04-15-work',
      rhythms: [rhythm],
      exceptions: [],
    });
    expect(target.kind).toBe('rhythm');
    expect(target.date).toBe('2026-04-16');
    expect(target.slotShape.slotType).toBe('work');
    expect(target.slotShape.startTime).toBe('13:00');
  });
});

describe('exceptions skip days', () => {
  test('rolls past a vacation range', () => {
    const state = {
      slots: [
        slotMin('2026-04-15', 'work', '13:00', '14:00'), // 1h, full
        slotMin('2026-04-16', 'work', '13:00', '14:00'), // inside vacation
        slotMin('2026-04-17', 'work', '13:00', '14:00'), // inside vacation
        slotMin('2026-04-18', 'work', '13:00', '14:00'), // OK
      ],
      tasks: [T('a', '2026-04-15-work', '2026-04-15T13:00:00', 60)],
    };
    const exceptions = [
      { id: 'e1', type: 'vacation', label: 'spring', startDate: '2026-04-16', endDate: '2026-04-17' },
    ];
    const target = findScheduleTarget({
      taskType: 'work',
      duration: 30,
      state,
      preferDate: '2026-04-15',
      preferSlotId: '2026-04-15-work',
      rhythms: [],
      exceptions,
    });
    expect(target.kind).toBe('concrete');
    expect(target.date).toBe('2026-04-18');
  });
});

describe('no fit anywhere', () => {
  test('returns null when no slot has room and no rhythms exist', () => {
    const state = {
      slots: [slotMin('2026-04-15', 'work', '13:00', '14:00')],
      tasks: [T('a', '2026-04-15-work', '2026-04-15T13:00:00', 60)],
    };
    const target = findScheduleTarget({
      taskType: 'work',
      duration: 30,
      state,
      preferDate: '2026-04-15',
      preferSlotId: '2026-04-15-work',
      rhythms: [],
      exceptions: [],
      lookAheadDays: 5,
    });
    expect(target).toBeNull();
  });
});

describe('matches by slotType, prefers same-type slots over others', () => {
  test('skips today\'s mismatched slot, finds tomorrow\'s matching one', () => {
    const state = {
      slots: [
        slotMin('2026-04-15', 'work', '13:00', '14:00'), // full
        slotMin('2026-04-15', 'admin', '14:00', '17:00'), // wrong type
        slotMin('2026-04-16', 'work', '09:00', '10:00'), // matching type next day
      ],
      tasks: [T('a', '2026-04-15-work', '2026-04-15T13:00:00', 60)],
    };
    const target = findScheduleTarget({
      taskType: 'work',
      duration: 30,
      state,
      preferDate: '2026-04-15',
      preferSlotId: '2026-04-15-work',
      rhythms: [],
      exceptions: [],
    });
    expect(target.kind).toBe('concrete');
    expect(target.date).toBe('2026-04-16');
    expect(target.slot.slotType).toBe('work');
  });
});

describe('localStorage integration', () => {
  test('reads rhythms and exceptions from localStorage when not passed', () => {
    addRhythm({
      name: 'Work',
      color: '#D4663A',
      slotType: 'work',
      startTime: '09:00',
      endTime: '11:00',
      cadence: { kind: 'weekly', dayOfWeek: 4 },
    });
    addException({
      type: 'holiday',
      label: 'something',
      startDate: '2026-04-15',
      endDate: '2026-04-15',
    });
    const target = findScheduleTarget({
      taskType: 'work',
      duration: 60,
      state: { slots: [], tasks: [] },
      preferDate: '2026-04-15',
    });
    // Apr 15 is excepted; Apr 16 (Thu) has the rhythm.
    expect(target).not.toBeNull();
    expect(target.kind).toBe('rhythm');
    expect(target.date).toBe('2026-04-16');
  });
});
