/**
 * Tier 0 wheel sharing — encode/decode helpers.
 *
 * A wheel is serialized as a compact JSON blob (short keys: n, c, b
 * for name/color/blocks) then base64url-encoded into a URL fragment.
 * No backend, no database — anyone with the link can decode and
 * apply.
 *
 *   /share#w=<base64url(json)>
 *
 * Why a fragment, not a query string:
 *   - Fragments aren't sent to the server, so we leak nothing to
 *     Vercel logs even if the wheel name is sensitive.
 *   - Vercel's SPA rewrite rule preserves them.
 *
 * URL length budget: a 12-block wheel fits comfortably under 1.5kB
 * encoded, well within everyone's URL limits. We don't compress
 * further because clarity > shaving 100 bytes.
 */

/** Base64url-encode a UTF-8 string. */
function b64urlEncode(str) {
  if (typeof btoa === 'undefined') return str; // SSR safety
  const utf8 = new TextEncoder().encode(str);
  let bin = '';
  for (const byte of utf8) bin += String.fromCharCode(byte);
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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

/**
 * Pack a wheel into the on-the-wire shape. Drops anything that's
 * derivable (id, slot ordering) or not user-facing (per-block
 * slotType is optional). Block colors are kept because the wheel
 * preview won't render correctly without them.
 */
export function packWheel(wheel) {
  if (!wheel) return null;
  return {
    n: String(wheel.name || 'untitled').slice(0, 80),
    c: wheel.color || null,
    b: (wheel.blocks || []).map(b => {
      const out = {
        s: b.startTime,
        e: b.endTime,
        l: (b.label || b.slotType || '').slice(0, 40),
      };
      if (b.color) out.c = b.color;
      if (b.slotType) out.t = b.slotType;
      return out;
    }),
  };
}

/** Reverse of packWheel — re-hydrate into the app's wheel shape. */
export function unpackWheel(packed) {
  if (!packed || typeof packed !== 'object') return null;
  if (!Array.isArray(packed.b)) return null;
  return {
    name: String(packed.n || 'shared wheel').slice(0, 80),
    color: packed.c || '#A8BF8C',
    blocks: packed.b
      .filter(b => b && typeof b.s === 'string' && typeof b.e === 'string')
      .map(b => ({
        startTime: b.s,
        endTime: b.e,
        label: typeof b.l === 'string' ? b.l : '',
        color: b.c || null,
        slotType: typeof b.t === 'string' ? b.t : null,
      })),
  };
}

/** Build a shareable URL for the given wheel. */
export function buildShareURL(wheel, baseUrl) {
  const packed = packWheel(wheel);
  if (!packed) return null;
  const json = JSON.stringify(packed);
  const encoded = b64urlEncode(json);
  const origin = baseUrl
    || (typeof window !== 'undefined' ? window.location.origin : 'https://taskometer.vercel.app');
  return `${origin}/share#w=${encoded}`;
}

/**
 * Read the current page's URL fragment and try to decode a shared
 * wheel from it. Returns the unpacked wheel or null.
 */
export function readSharedWheelFromHash(hash) {
  const h = hash || (typeof window !== 'undefined' ? window.location.hash : '');
  if (!h || !h.includes('w=')) return null;
  const m = h.match(/[#&]w=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const json = b64urlDecode(m[1]);
  if (!json) return null;
  try {
    return unpackWheel(JSON.parse(json));
  } catch (_) {
    return null;
  }
}
