import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/_handlers/year.js';
import routinesHandler from '../../api/_handlers/routines.js';
import recurringHandler from '../../api/_handlers/recurring-blocks.js';
import exceptionsHandler from '../../api/_handlers/exceptions.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const sampleRoutine = {
  name: 'Workday',
  color: '#D4663A',
  blocks: [{ startTime: '09:00', endTime: '17:00', label: 'Work', category: 'work' }],
};

describe('/api/year?year=', () => {
  test('empty year returns no days, no exceptions', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { year: '2026' } });
    expect(r.status).toBe(200);
    expect(r.body.year).toBe(2026);
    expect(r.body.daysByKey).toEqual({});
    expect(r.body.exceptions).toEqual([]);
  });

  test('returns painted dates as days with assignment + entries', async () => {
    const c = await callHandler(routinesHandler, { method: 'POST', body: sampleRoutine });
    await callHandler(routinesHandler, {
      method: 'POST',
      query: { id: c.body.routine.id, op: 'paint' },
      body: { dates: ['2026-05-03', '2026-05-04'] },
    });
    const r = await callHandler(handler, { method: 'GET', query: { year: '2026' } });
    expect(Object.keys(r.body.daysByKey).sort()).toEqual(['2026-05-03', '2026-05-04']);
    expect(r.body.daysByKey['2026-05-03'].assignment.routineId).toBe(c.body.routine.id);
    expect(r.body.daysByKey['2026-05-03'].entries).toHaveLength(1);
    expect(r.body.daysByKey['2026-05-03'].entries[0].source).toBe('block');
  });

  test('recurring block fills every matching date in the year', async () => {
    await callHandler(recurringHandler, {
      method: 'POST',
      body: {
        name: 'Standup',
        startTime: '09:00',
        endTime: '09:30',
        label: 'Standup',
        cadence: { kind: 'weekly', dayOfWeek: 2 },
      },
    });
    const r = await callHandler(handler, { method: 'GET', query: { year: '2026' } });
    // Tuesdays in 2026: 52 (the year has 52 Tuesdays — 2026 starts Thursday, ends Thursday).
    const tuesdayCount = Object.keys(r.body.daysByKey).filter(d => {
      const date = new Date(`${d}T00:00:00`);
      return date.getDay() === 2;
    }).length;
    expect(tuesdayCount).toBe(52);
  });

  test('exception replaces day entries with a single "exception" entry', async () => {
    await callHandler(recurringHandler, {
      method: 'POST',
      body: {
        name: 'Standup', startTime: '09:00', endTime: '09:30', label: 'Standup',
        cadence: { kind: 'weekly', dayOfWeek: 2 },
      },
    });
    await callHandler(exceptionsHandler, {
      method: 'POST',
      body: { type: 'vacation', label: 'time off', startDate: '2026-05-05', endDate: '2026-05-05' },
    });
    const r = await callHandler(handler, { method: 'GET', query: { year: '2026' } });
    const day = r.body.daysByKey['2026-05-05'];
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0].source).toBe('exception');
    expect(day.entries[0].type).toBe('vacation');
  });

  test('rejects bad year format', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { year: 'twenty twenty-six' } });
    expect(r.status).toBe(400);
  });
});
