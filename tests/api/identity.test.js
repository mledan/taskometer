import { describe, test, expect } from 'vitest';
import {
  resolveOwner, isEphemeralOwner, ANON_OWNER, EPH_PREFIX,
} from '../../api/_lib/identity.js';

function mockReq({ headers = {} } = {}) {
  return { headers };
}

describe('isEphemeralOwner', () => {
  test('matches eph_ prefix', () => {
    expect(isEphemeralOwner('eph_abc12345')).toBe(true);
    expect(isEphemeralOwner(`${EPH_PREFIX}xyz12345`)).toBe(true);
  });
  test('rejects everything else', () => {
    expect(isEphemeralOwner('user_2abc')).toBe(false);
    expect(isEphemeralOwner('anon')).toBe(false);
    expect(isEphemeralOwner(null)).toBe(false);
    expect(isEphemeralOwner('')).toBe(false);
  });
});

describe('resolveOwner — Clerk not configured', () => {
  // Clerk is not configured in test env (no CLERK_SECRET_KEY).
  test('falls back to anon when no device id supplied', async () => {
    const r = mockReq();
    expect(await resolveOwner(r)).toBe(ANON_OWNER);
  });

  test('honors X-Device-Id when shape matches', async () => {
    const r = mockReq({ headers: { 'x-device-id': 'eph_abc12345xyz' } });
    expect(await resolveOwner(r)).toBe('eph_abc12345xyz');
  });

  test('rejects malformed device id (too short)', async () => {
    const r = mockReq({ headers: { 'x-device-id': 'eph_short' } });
    expect(await resolveOwner(r)).toBe(ANON_OWNER);
  });

  test('rejects device id without prefix', async () => {
    const r = mockReq({ headers: { 'x-device-id': 'random12345' } });
    expect(await resolveOwner(r)).toBe(ANON_OWNER);
  });

  test('rejects junk in the device-id slot', async () => {
    const r = mockReq({ headers: { 'x-device-id': 'eph_<script>alert' } });
    expect(await resolveOwner(r)).toBe(ANON_OWNER);
  });
});
