/**
 * Tier 0 schedule-type sharing — encode/decode helpers.
 *
 * A set of schedule types (tag-driven time windows) is serialized as a
 * compact JSON blob (short keys: n/g/c/s/e/d) then base64url-encoded into
 * a URL fragment. No backend — anyone with the link can decode and add.
 *
 *   /app#sched=<base64url(json)>
 *
 * Coexists with wheel sharing (/share#w=…) — wheels and schedule types
 * are separate concepts so the apps' import flows can run independently.
 */

function b64urlEncode(str) {
  if (typeof btoa === 'undefined') return str;
  const utf8 = new TextEncoder().encode(str);
  let bin = '';
  for (const byte of utf8) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  if (typeof atob === 'undefined') return null;
  try {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const bin = atob(padded + '='.repeat(padLen));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (_) {
    return null;
  }
}

/** Pack a list of schedule types into the on-the-wire shape (short keys). */
export function packScheduleTypes(types = []) {
  if (!Array.isArray(types)) return null;
  return types
    .filter(t => t && t.tag && t.startTime && t.endTime)
    .slice(0, 30) // sane cap for URL length
    .map(t => ({
      n: String(t.name || t.tag).slice(0, 40),
      g: String(t.tag).slice(0, 24).toLowerCase(),
      c: t.color || null,
      s: t.startTime,
      e: t.endTime,
      d: Array.isArray(t.days) ? t.days : null,
    }));
}

/** Reverse of pack — re-hydrate into the app's scheduleType shape. */
export function unpackScheduleTypes(packed) {
  if (!Array.isArray(packed)) return null;
  return packed
    .filter(t => t && typeof t.g === 'string' && typeof t.s === 'string' && typeof t.e === 'string')
    .map(t => ({
      name: String(t.n || t.g).slice(0, 40),
      tag: String(t.g).slice(0, 24).toLowerCase(),
      color: t.c || '#3B82F6',
      startTime: t.s,
      endTime: t.e,
      days: Array.isArray(t.d) ? t.d : ['mon', 'tue', 'wed', 'thu', 'fri'],
    }));
}

/** Build a shareable URL fragment for a set of schedule types. */
export function buildScheduleShareURL(types, baseUrl) {
  const packed = packScheduleTypes(types);
  if (!packed || packed.length === 0) return null;
  const encoded = b64urlEncode(JSON.stringify(packed));
  const origin = baseUrl
    || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  return `${origin}#sched=${encoded}`;
}

/** Read the current page's URL fragment and try to decode shared types. */
export function readSharedScheduleTypesFromHash(hash) {
  const h = hash || (typeof window !== 'undefined' ? window.location.hash : '');
  if (!h || !h.includes('sched=')) return null;
  const m = h.match(/[#&]sched=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const json = b64urlDecode(m[1]);
  if (!json) return null;
  try {
    return unpackScheduleTypes(JSON.parse(json));
  } catch (_) {
    return null;
  }
}
