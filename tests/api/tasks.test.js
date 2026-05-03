import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/tasks.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

describe('CRUD', () => {
  test('create returns server-assigned id + defaults', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      body: { text: 'write API tests', duration: 45, priority: 'high' },
    });
    expect(r.status).toBe(201);
    expect(r.body.task.id).toMatch(/^tsk_/);
    expect(r.body.task.text).toBe('write API tests');
    expect(r.body.task.duration).toBe(45);
    expect(r.body.task.priority).toBe('high');
    expect(r.body.task.status).toBe('pending');
    expect(r.body.task.ownerId).toBe('anon');
  });

  test('rejects missing text', async () => {
    const r = await callHandler(handler, { method: 'POST', body: {} });
    expect(r.status).toBe(400);
  });

  test('caps text at 500 chars', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      body: { text: 'x'.repeat(700) },
    });
    expect(r.body.task.text.length).toBe(500);
  });

  test('PATCH only whitelisted fields', async () => {
    const c = await callHandler(handler, { method: 'POST', body: { text: 'orig' } });
    const r = await callHandler(handler, {
      method: 'PATCH',
      query: { id: c.body.task.id },
      body: { text: 'changed', sneaky: 'no' },
    });
    expect(r.body.task.text).toBe('changed');
    expect(r.body.task.sneaky).toBeUndefined();
  });

  test('soft-delete sets status=cancelled, hard delete removes', async () => {
    const c1 = await callHandler(handler, { method: 'POST', body: { text: 'soft' } });
    const c2 = await callHandler(handler, { method: 'POST', body: { text: 'hard' } });

    const soft = await callHandler(handler, { method: 'DELETE', query: { id: c1.body.task.id } });
    expect(soft.body.task.status).toBe('cancelled');

    const hard = await callHandler(handler, { method: 'DELETE', query: { id: c2.body.task.id, hard: '1' } });
    expect(hard.status).toBe(204);

    const checkSoft = await callHandler(handler, { method: 'GET', query: { id: c1.body.task.id } });
    expect(checkSoft.status).toBe(200);
    const checkHard = await callHandler(handler, { method: 'GET', query: { id: c2.body.task.id } });
    expect(checkHard.status).toBe(404);
  });
});

describe('filters', () => {
  beforeEach(async () => {
    await callHandler(handler, { method: 'POST', body: { text: 'A', scheduledTime: '2026-05-03T09:00:00.000Z', scheduledBlockId: 'blk_x' } });
    await callHandler(handler, { method: 'POST', body: { text: 'B', scheduledTime: '2026-05-03T13:00:00.000Z' } });
    await callHandler(handler, { method: 'POST', body: { text: 'C', scheduledTime: '2026-05-04T10:00:00.000Z' } });
    await callHandler(handler, { method: 'POST', body: { text: 'D', scheduledRecurringBlockId: 'rcb_y', scheduledTime: '2026-05-05T09:00:00.000Z' } });
  });

  test('?date=', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(r.body.tasks.map(t => t.text).sort()).toEqual(['A', 'B']);
  });

  test('?blockId=', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { blockId: 'blk_x' } });
    expect(r.body.tasks.map(t => t.text)).toEqual(['A']);
  });

  test('?recurringBlockId=', async () => {
    const r = await callHandler(handler, { method: 'GET', query: { recurringBlockId: 'rcb_y' } });
    expect(r.body.tasks.map(t => t.text)).toEqual(['D']);
  });
});
