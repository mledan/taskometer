import { test, expect, describe } from 'vitest';
import { deriveCurrentSlot, deriveCurrentSlotTasks, deriveNextSlot } from './derive';

const sleepToday = { id: 'sleep-today', date: '2026-04-20', startTime: '23:00', endTime: '06:00', slotType: 'sleep' };
const sleepYesterday = { id: 'sleep-yday', date: '2026-04-19', startTime: '23:00', endTime: '06:00', slotType: 'sleep' };
const breakfast = { id: 'bf', date: '2026-04-20', startTime: '06:00', endTime: '07:00', slotType: 'food' };
const work = { id: 'work', date: '2026-04-20', startTime: '09:00', endTime: '12:00', slotType: 'work' };

describe('overnight blocks', () => {
  test('a 23:00–06:00 block painted on today is current at 00:30', () => {
    const now = new Date('2026-04-20T00:30:00');
    const slot = deriveCurrentSlot({ slots: [sleepToday, breakfast, work], date: now, now });
    expect(slot?.id).toBe('sleep-today');
    expect(slot.startH).toBe(23);
    expect(slot.endH).toBe(30);
  });

  test('yesterday\'s overnight block still counts after midnight when today has none', () => {
    const now = new Date('2026-04-20T00:30:00');
    const slot = deriveCurrentSlot({ slots: [sleepYesterday, breakfast, work], date: now, now });
    expect(slot?.id).toBe('sleep-yday');
    expect(slot.startH).toBe(-1);
    expect(slot.endH).toBe(6);
  });

  test('the same block is current at 23:30 too', () => {
    const now = new Date('2026-04-20T23:30:00');
    expect(deriveCurrentSlot({ slots: [sleepToday, work], date: now, now })?.id).toBe('sleep-today');
  });

  test('next slot after an overnight block is the first morning block', () => {
    const now = new Date('2026-04-20T00:30:00');
    expect(deriveNextSlot({ slots: [sleepToday, breakfast, work], date: now, now })?.id).toBe('bf');
  });

  test('tasks scheduled inside the overnight window are attached to it', () => {
    const now = new Date('2026-04-20T00:30:00');
    const tasks = [
      { id: 't1', status: 'pending', scheduledTime: '2026-04-20T01:00:00' },
      { id: 't2', status: 'pending', scheduledTime: '2026-04-20T10:00:00' },
    ];
    const r = deriveCurrentSlotTasks({ tasks, slots: [sleepToday, work], date: now, now });
    expect(r.slot.id).toBe('sleep-today');
    expect(r.tasks.map(t => t.id)).toEqual(['t1']);
  });

  test('daytime behaviour unchanged', () => {
    const now = new Date('2026-04-20T10:00:00');
    expect(deriveCurrentSlot({ slots: [sleepToday, breakfast, work], date: now, now })?.id).toBe('work');
    expect(deriveNextSlot({ slots: [sleepToday, breakfast, work], date: now, now })?.id).toBe('sleep-today');
  });
});
