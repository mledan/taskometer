import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/_handlers/recurring-blocks.js';
import blocksHandler from '../../api/_handlers/blocks.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const weeklyTuesday = {
  name: 'Standup',
  startTime: '09:00',
  endTime: '09:30',
  label: 'Engineering standup',
  category: 'mtgs',
  color: '#A8BF8C',
  cadence: { kind: 'weekly', dayOfWeek: 2 },
};

describe('CRUD', () => {
  test('create → list → get → patch → delete', async () => {
    const c = await callHandler(handler, { method: 'POST', body: weeklyTuesday });
    expect(c.status).toBe(201);
    expect(c.body.recurringBlock.id).toMatch(/^rcb_/);

    const list = await callHandler(handler, { method: 'GET' });
    expect(list.body.recurringBlocks).toHaveLength(1);

    const patched = await callHandler(handler, {
      method: 'PATCH',
      query: { id: c.body.recurringBlock.id },
      body: { startTime: '09:30' },
    });
    expect(patched.body.recurringBlock.startTime).toBe('09:30');

    const del = await callHandler(handler, { method: 'DELETE', query: { id: c.body.recurringBlock.id } });
    expect(del.status).toBe(204);
  });

  test('rejects unknown cadence kind', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      body: { ...weeklyTuesday, cadence: { kind: 'made_up' } },
    });
    expect(r.status).toBe(400);
  });

  test('rejects missing name', async () => {
    const { name, ...rest } = weeklyTuesday;
    const r = await callHandler(handler, { method: 'POST', body: rest });
    expect(r.status).toBe(400);
  });
});

describe('occurrences op', () => {
  test('weekly Tuesday in April 2026 returns 4 dates', async () => {
    const c = await callHandler(handler, { method: 'POST', body: weeklyTuesday });
    const r = await callHandler(handler, {
      method: 'GET',
      query: { id: c.body.recurringBlock.id, op: 'occurrences', from: '2026-04-01', to: '2026-04-30' },
    });
    expect(r.status).toBe(200);
    expect(r.body.occurrences).toEqual(['2026-04-07', '2026-04-14', '2026-04-21', '2026-04-28']);
  });

  test('multi-day weekly (Mon, Wed, Fri)', async () => {
    const c = await callHandler(handler, {
      method: 'POST',
      body: {
        ...weeklyTuesday,
        cadence: { kind: 'weekly', daysOfWeek: [1, 3, 5] },
      },
    });
    const r = await callHandler(handler, {
      method: 'GET',
      query: { id: c.body.recurringBlock.id, op: 'occurrences', from: '2026-05-04', to: '2026-05-08' },
    });
    expect(r.body.occurrences).toEqual(['2026-05-04', '2026-05-06', '2026-05-08']);
  });

  test('rejects bad date format', async () => {
    const c = await callHandler(handler, { method: 'POST', body: weeklyTuesday });
    const r = await callHandler(handler, {
      method: 'GET',
      query: { id: c.body.recurringBlock.id, op: 'occurrences', from: 'yesterday', to: 'today' },
    });
    expect(r.status).toBe(400);
  });
});

describe('break-out op', () => {
  test('materializes a one-off Block carrying sourceRecurringBlockId', async () => {
    const c = await callHandler(handler, { method: 'POST', body: weeklyTuesday });
    const id = c.body.recurringBlock.id;

    const r = await callHandler(handler, {
      method: 'POST',
      query: { id, op: 'break-out', date: '2026-05-05' },
    });
    expect(r.status).toBe(201);
    expect(r.body.created).toBe(true);
    expect(r.body.block.date).toBe('2026-05-05');
    expect(r.body.block.sourceRecurringBlockId).toBe(id);
    expect(r.body.block.sourceRoutineId).toBeNull();

    // Verify the block actually exists in the blocks store.
    const onDate = await callHandler(blocksHandler, { method: 'GET', query: { date: '2026-05-05' } });
    expect(onDate.body.blocks).toHaveLength(1);
  });

  test('idempotent — second break-out returns the same block, created=false', async () => {
    const c = await callHandler(handler, { method: 'POST', body: weeklyTuesday });
    const id = c.body.recurringBlock.id;

    const first = await callHandler(handler, {
      method: 'POST', query: { id, op: 'break-out', date: '2026-05-05' },
    });
    const second = await callHandler(handler, {
      method: 'POST', query: { id, op: 'break-out', date: '2026-05-05' },
    });
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.block.id).toBe(first.body.block.id);
  });

  test('404 when recurring block does not exist', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      query: { id: 'rcb_nope', op: 'break-out', date: '2026-05-05' },
    });
    expect(r.status).toBe(404);
  });
});
