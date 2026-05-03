/**
 * Thin fetch wrapper for /api/v2/*.
 *
 * Stamps every request with two identity headers (when available):
 *   - X-Device-Id    — always (until clear after claim)
 *   - Authorization  — Bearer <Clerk JWT> when the user is signed in
 *
 * The Clerk getToken() function is dependency-injected at app boot
 * via configureApiClient() — keeps this module React-free so it can
 * be imported anywhere (services, tests, vanilla JS).
 *
 * Request shape:
 *   apiFetch('/routines', { method: 'POST', body: { ... } })
 *
 * Returns parsed JSON on 2xx; throws ApiError on non-2xx with the
 * server's { error, hint? } payload attached.
 */

import { getDeviceId } from './identity.js';

const API_BASE = '/api/v2';

let _getToken = null;

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Wire up the Clerk token getter from React land. Call once during
 * mount — see ApiBoot.jsx.
 */
export function configureApiClient({ getToken }) {
  _getToken = typeof getToken === 'function' ? getToken : null;
}

export async function apiFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(opts.headers || {});
  if (!headers.has('content-type') && opts.body) {
    headers.set('content-type', 'application/json');
  }
  const deviceId = getDeviceId();
  if (deviceId) headers.set('x-device-id', deviceId);

  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers.set('authorization', `Bearer ${token}`);
    } catch (_) {
      // Token fetch can fail (signed out mid-flight, etc.) — fall
      // through with just the device id; server treats it as
      // ephemeral.
    }
  }

  const init = {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
  };
  if (opts.body !== undefined && opts.body !== null) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  const res = await fetch(url, init);
  // 204 → no body
  if (res.status === 204) return null;

  let payload;
  try { payload = await res.json(); }
  catch (_) { payload = null; }

  if (!res.ok) {
    const msg = payload?.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, payload);
  }
  return payload;
}

/**
 * Trigger the server-side claim flow once Clerk auth is live.
 * Returns the per-resource counts, or null if there was no device
 * id to claim (e.g. user signed up on a fresh browser).
 */
export async function claimDevice(deviceId) {
  if (!deviceId) return null;
  return apiFetch('/claim', {
    method: 'POST',
    body: { deviceId },
  });
}
