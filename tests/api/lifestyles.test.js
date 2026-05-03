import { describe, test, expect } from 'vitest';
import handler from '../../api/_handlers/lifestyles.js';
import { callHandler } from './helpers.js';

describe('/api/lifestyles', () => {
  test('GET returns the curated whitelist', async () => {
    const r = await callHandler(handler, { method: 'GET' });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.lifestyles)).toBe(true);
    expect(r.body.lifestyles).toContain('Night Owl');
    expect(r.body.lifestyles).toContain('Office 9-to-5');
    expect(r.body.lifestyles.length).toBeGreaterThan(5);
  });

  test('rejects non-GET', async () => {
    const r = await callHandler(handler, { method: 'POST' });
    expect(r.status).toBe(405);
  });
});
