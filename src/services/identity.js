/**
 * Browser-side identity helpers.
 *
 * Two pieces of identity travel on every API call:
 *
 *   - X-Device-Id: eph_<uuid>     — generated and persisted in
 *     localStorage on first visit. Survives page refresh; gets
 *     replaced with the Clerk userId once the user signs up (via
 *     the claim flow on the server).
 *   - Authorization: Bearer <token>  — Clerk JWT when signed in.
 *
 * The deviceId is purely a server-partition key. The user never sees
 * it; the server treats it as "this anonymous browser owns these
 * docs, expire in 24h."
 */

import storage from './storage';

const DEVICE_KEY = 'taskometer.deviceId';
const EPH_PREFIX = 'eph_';

/**
 * Get the current device id, generating one if absent. Returns null
 * if storage isn't available (private mode, SSR, etc.) — caller
 * should treat that as "no device id, send no header."
 */
export function getDeviceId() {
  let id = storage.getRaw(DEVICE_KEY);
  if (!id || !/^eph_[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = `${EPH_PREFIX}${randomId()}`;
    if (!storage.setRaw(DEVICE_KEY, id)) return null;
  }
  return id;
}

/** Clear the device id — called after a successful claim flow. */
export function clearDeviceId() {
  storage.remove(DEVICE_KEY);
}

/**
 * Random URL-safe id. Prefers crypto.randomUUID when available;
 * falls back to a 16-char base36 string otherwise.
 */
function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // Strip dashes — keeps the id shape simpler ("eph_abc123def456…").
    return crypto.randomUUID().replace(/-/g, '');
  }
  return (
    Date.now().toString(36)
    + Math.random().toString(36).slice(2, 10)
  );
}
