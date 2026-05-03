import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/blocks.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const validBlock = {
  date: '2026-05-03',
  startTime: '09:00',
  endTime: '12:00',
  label: 'Deep work',
  category: 'deep',
  color: '#D4663A',
};

describe('CRUD', () => {
  test('create → list → get → patch → delete', async () => {
    const created = await callHandler(handler, { method: 'POST', body: validBlock });
    expect(created.status).toBe(201);
    expect(created.body.block.id).toMatch(/^blk_/);
    expect(created.body.block.sourceRoutineId).toBeNull();

    const list = await callHandler(handler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(list.body.blocks).toHaveLength(1);

    const one = await callHandler(handler, { method: 'GET', query: { id: created.body.block.id } });
    expect(one.body.block.label).toBe('Deep work');

    const patched = await callHandler(handler, {
      method: 'PATCH',
      query: { id: created.body.block.id },
      body: { startTime: '10:00' },
    });
    expect(patched.body.block.startTime).toBe('10:00');

    const del = await callHandler(handler, { method: 'DELETE', query: { id: created.body.block.id } });
    expect(del.status).toBe(204);

    const after = await callHandler(handler, { method: 'GET', query: { id: created.body.block.id } });
    expect(after.status).toBe(404);
  });

  test('rejects missing date', async () => {
    const { date, ...rest } = validBlock;
    const r = await callHandler(handler, { method: 'POST', body: rest });
    expect(r.status).toBe(400);
  });

  test('rejects bad startTime format', async () => {
    const r = await callHandler(handler, { method: 'POST', body: { ...validBlock, startTime: '9am' } });
    expect(r.status).toBe(400);
  });

  test('rejects bad date format on update', async () => {
    const c = await callHandler(handler, { method: 'POST', body: validBlock });
    const r = await callHandler(handler, {
      method: 'PATCH',
      query: { id: c.body.block.id },
      body: { date: 'tomorrow' },
    });
    expect(r.status).toBe(400);
  });

  test('label is capped at 60 chars', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      body: { ...validBlock, label: 'x'.repeat(200) },
    });
    expect(r.body.block.label.length).toBe(60);
  });
});

describe('list filters', () => {
  beforeEach(async () => {
    await callHandler(handler, { method: 'POST', body: { ...validBlock, date: '2026-05-03', label: 'A' } });
    await callHandler(handler, { method: 'POST', body: { ...validBlock, date: '2026-05-04', label: 'B' } });
    await callHandler(handler, { method: 'POST', body: { ...validBlock, date: '2026-05-10', label: 'C' } });
  });

  test('filters by date', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(r.body.blocks.map(b => b.label)).toEqual(['A']);
  });

  test('filters by range', async () => {
    const r = await callHandler(handler, {
      method: 'GET',
      query: { from: '2026-05-03', to: '2026-05-05' },
    });
    expect(r.body.blocks.map(b => b.label).sort()).toEqual(['A', 'B']);
  });

  test('returns all when no filter', async () => {
    const r = await callHandler(handler, { method: 'GET' });
    expect(r.body.blocks).toHaveLength(3);
  });

  test('rejects invalid range', async () => {
    const r = await callHandler(handler, {
      method: 'GET',
      query: { from: 'not-a-date', to: '2026-05-05' },
    });
    expect(r.status).toBe(400);
  });
});
