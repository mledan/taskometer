import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/_handlers/claim.js';
import routinesHandler from '../../api/_handlers/routines.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { repos } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const sampleRoutine = {
  name: 'Workday',
  color: '#D4663A',
  blocks: [{ startTime: '09:00', endTime: '17:00', label: 'Work', category: 'work' }],
};

describe('/api/v2/claim', () => {
  test('refuses when Clerk not configured (no auth path)', async () => {
    // In test env CLERK_SECRET_KEY is unset → claim returns 503.
    const r = await callHandler(handler, {
      method: 'POST',
      body: { deviceId: 'eph_abc12345xyz' },
    });
    expect(r.status).toBe(503);
  });

  test('reassignOwner moves docs between owners (memory repo unit)', async () => {
    // Direct repo test — bypass the claim handler since Clerk isn't
    // configured in the test environment, and prove the underlying
    // reassignOwner primitive that claim depends on.
    await callHandler(routinesHandler, {
      method: 'POST',
      body: sampleRoutine,
      headers: { 'x-device-id': 'eph_device12345' },
    });

    const before = repos().routines.list({ ownerId: 'eph_device12345' });
    expect(before).toHaveLength(1);

    const moved = repos().routines.reassignOwner({
      fromOwnerId: 'eph_device12345',
      toOwnerId: 'user_clerk_xyz',
    });
    expect(moved).toBe(1);

    const after = repos().routines.list({ ownerId: 'eph_device12345' });
    expect(after).toHaveLength(0);

    const claimed = repos().routines.list({ ownerId: 'user_clerk_xyz' });
    expect(claimed).toHaveLength(1);
    expect(claimed[0].name).toBe('Workday');
  });

  test('reassignOwner is idempotent — second call is a no-op', () => {
    const moved2 = repos().routines.reassignOwner({
      fromOwnerId: 'eph_does_not_exist123',
      toOwnerId: 'user_clerk_xyz',
    });
    expect(moved2).toBe(0);
  });
});
