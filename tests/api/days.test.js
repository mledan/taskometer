import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/_handlers/days.js';
import routinesHandler from '../../api/_handlers/routines.js';
import recurringHandler from '../../api/_handlers/recurring-blocks.js';
import exceptionsHandler from '../../api/_handlers/exceptions.js';
import blocksHandler from '../../api/_handlers/blocks.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const sampleRoutine = {
  name: 'Workday',
  color: '#D4663A',
  blocks: [
    { startTime: '09:00', endTime: '12:00', label: 'Morning work', category: 'work' },
    { startTime: '13:00', endTime: '17:00', label: 'Afternoon',    category: 'work' },
  ],
};

const weeklyTuesday = {
  name: 'Standup',
  startTime: '09:00',
  endTime: '09:30',
  label: 'Standup',
  category: 'mtgs',
  cadence: { kind: 'weekly', dayOfWeek: 2 },
};

describe('/api/days?date=', () => {
  test('empty day returns no blocks, no assignment, no exception', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(r.status).toBe(200);
    expect(r.body.date).toBe('2026-05-03');
    expect(r.body.assignment).toBeNull();
    expect(r.body.blocks).toEqual([]);
    expect(r.body.recurringBlockOccurrences).toEqual([]);
    expect(r.body.exception).toBeNull();
  });

  test('day with painted routine + recurring block returns both, sorted', async () => {
    // Paint Workday on a Tuesday so the recurring standup also fires.
    const c = await callHandler(routinesHandler, { method: 'POST', body: sampleRoutine });
    await callHandler(routinesHandler, {
      method: 'POST',
      query: { id: c.body.routine.id, op: 'paint' },
      body: { dates: ['2026-05-05'] },   // 2026-05-05 is a Tuesday
    });
    await callHandler(recurringHandler, { method: 'POST', body: weeklyTuesday });

    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-05' } });
    expect(r.body.assignment.routineId).toBe(c.body.routine.id);
    expect(r.body.blocks).toHaveLength(2);                 // 2 painted blocks
    expect(r.body.recurringBlockOccurrences).toHaveLength(1); // 1 standup
    expect(r.body.recurringBlockOccurrences[0].isRecurring).toBe(true);
    expect(r.body.recurringBlockOccurrences[0].label).toBe('Standup');
    expect(r.body.exception).toBeNull();
  });

  test('exception suppresses recurring blocks on covered dates', async () => {
    await callHandler(recurringHandler, { method: 'POST', body: weeklyTuesday });
    await callHandler(exceptionsHandler, {
      method: 'POST',
      body: { type: 'vacation', label: 'time off', startDate: '2026-05-05', endDate: '2026-05-05' },
    });
    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-05' } });
    expect(r.body.exception).not.toBeNull();
    expect(r.body.recurringBlockOccurrences).toEqual([]);
  });

  test('broken-out recurring block does not double-render', async () => {
    const r1 = await callHandler(recurringHandler, { method: 'POST', body: weeklyTuesday });
    const id = r1.body.recurringBlock.id;
    // Break out 2026-05-05 — creates a concrete Block.
    await callHandler(recurringHandler, {
      method: 'POST', query: { id, op: 'break-out', date: '2026-05-05' },
    });
    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-05' } });
    // The composite must NOT show both the broken-out block AND the
    // recurring occurrence (would render twice on the wheel).
    expect(r.body.blocks).toHaveLength(1);
    expect(r.body.recurringBlockOccurrences).toEqual([]);
  });

  test('rejects bad date', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { date: 'today' } });
    expect(r.status).toBe(400);
  });
});
