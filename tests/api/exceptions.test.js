import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/exceptions.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const vacation = {
  type: 'vacation',
  label: 'Spring break',
  startDate: '2026-04-13',
  endDate: '2026-04-19',
};

describe('CRUD', () => {
  test('create → list → get → patch → delete', async () => {
    const c = await callHandler(handler, { method: 'POST', body: vacation });
    expect(c.status).toBe(201);
    expect(c.body.exception.id).toMatch(/^exc_/);
    expect(c.body.exception.type).toBe('vacation');

    const list = await callHandler(handler, {
      method: 'GET',
      query: { from: '2026-04-01', to: '2026-04-30' },
    });
    expect(list.body.exceptions).toHaveLength(1);

    const patched = await callHandler(handler, {
      method: 'PATCH',
      query: { id: c.body.exception.id },
      body: { label: 'Renamed' },
    });
    expect(patched.body.exception.label).toBe('Renamed');

    const del = await callHandler(handler, { method: 'DELETE', query: { id: c.body.exception.id } });
    expect(del.status).toBe(204);
  });

  test('rejects endDate < startDate', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      body: { ...vacation, startDate: '2026-04-20', endDate: '2026-04-15' },
    });
    expect(r.status).toBe(400);
  });

  test('unknown type defaults to "other"', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      body: { ...vacation, type: 'made_up' },
    });
    expect(r.body.exception.type).toBe('other');
  });
});

describe('range filtering', () => {
  beforeEach(async () => {
    await callHandler(handler, {
      method: 'POST',
      body: { type: 'holiday', label: 'New Year', startDate: '2026-01-01', endDate: '2026-01-01' },
    });
    await callHandler(handler, {
      method: 'POST',
      body: { type: 'vacation', label: 'April break', startDate: '2026-04-15', endDate: '2026-04-19' },
    });
    await callHandler(handler, {
      method: 'POST',
      body: { type: 'conference', label: 'WWDC', startDate: '2026-06-08', endDate: '2026-06-12' },
    });
  });

  test('overlap query returns intersecting exceptions', async () => {
    const r = await callHandler(handler, {
      method: 'GET',
      query: { from: '2026-04-01', to: '2026-05-01' },
    });
    expect(r.body.exceptions).toHaveLength(1);
    expect(r.body.exceptions[0].label).toBe('April break');
  });

  test('range that misses everything returns empty', async () => {
    const r = await callHandler(handler, {
      method: 'GET',
      query: { from: '2026-09-01', to: '2026-09-30' },
    });
    expect(r.body.exceptions).toEqual([]);
  });
});
