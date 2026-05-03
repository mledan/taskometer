import { describe, test, expect } from 'vitest';
import handler from '../../api/health.js';
import { callHandler } from './helpers.js';

describe('/api/health', () => {
  test('GET returns ok + repo backend + auth mode', async () => {
    const r = await callHandler(handler, { method: 'GET' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
    expect(r.body.repo).toBe('memory');
    expect(r.body.auth).toBe('anonymous');
    expect(r.body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('rejects non-GET', async () => {
    const r = await callHandler(handler, { method: 'POST' });
    expect(r.status).toBe(405);
  });
});
