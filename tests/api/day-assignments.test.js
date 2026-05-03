import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/day-assignments.js';
import routinesHandler from '../../api/routines.js';
import blocksHandler from '../../api/blocks.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const sampleRoutine = {
  name: 'Workday',
  color: '#D4663A',
  blocks: [{ startTime: '09:00', endTime: '17:00', label: 'Work', category: 'work' }],
};

describe('GET', () => {
  test('returns null when no assignment on the date', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(r.status).toBe(200);
    expect(r.body.assignment).toBeNull();
  });

  test('returns the assignment after a routine paints the date', async () => {
    const c = await callHandler(routinesHandler, { method: 'POST', body: sampleRoutine });
    await callHandler(routinesHandler, {
      method: 'POST',
      query: { id: c.body.routine.id, op: 'paint' },
      body: { dates: ['2026-05-03'] },
    });
    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(r.body.assignment.routineId).toBe(c.body.routine.id);
  });

  test('range query returns all assignments in the range', async () => {
    const c = await callHandler(routinesHandler, { method: 'POST', body: sampleRoutine });
    await callHandler(routinesHandler, {
      method: 'POST',
      query: { id: c.body.routine.id, op: 'paint' },
      body: { dates: ['2026-05-03', '2026-05-04', '2026-05-10'] },
    });
    const r = await callHandler(handler, {
      method: 'GET',
      query: { from: '2026-05-03', to: '2026-05-05' },
    });
    expect(r.body.assignments.map(a => a.date)).toEqual(['2026-05-03', '2026-05-04']);
  });

  test('rejects bad date', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { date: 'today' } });
    expect(r.status).toBe(400);
  });

  test('requires either date OR from+to', async () => {
    const r = await callHandler(handler, { method: 'GET', query: {} });
    expect(r.status).toBe(400);
  });
});

describe('DELETE clears the assignment without nuking blocks', () => {
  test('after delete, blocks remain but assignment is gone', async () => {
    const c = await callHandler(routinesHandler, { method: 'POST', body: sampleRoutine });
    await callHandler(routinesHandler, {
      method: 'POST',
      query: { id: c.body.routine.id, op: 'paint' },
      body: { dates: ['2026-05-03'] },
    });

    const del = await callHandler(handler, {
      method: 'DELETE',
      query: { date: '2026-05-03' },
    });
    expect(del.status).toBe(204);

    const after = await callHandler(handler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(after.body.assignment).toBeNull();

    const blocks = await callHandler(blocksHandler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(blocks.body.blocks).toHaveLength(1); // block survived
  });

  test('404 when no assignment to delete', async () => {
    const r = await callHandler(handler, { method: 'DELETE', query: { date: '2026-05-03' } });
    expect(r.status).toBe(404);
  });
});
