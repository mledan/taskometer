/**
 * Telemetry endpoint — Vercel serverless function.
 *
 * Accepts POST { event, data, ts, sessionId } and logs it as a
 * structured JSON line to stdout, where it joins the Vercel function
 * log stream. No database, no third-party services, no IP retention.
 *
 * Schema is intentionally tiny so we can swap to a real analytics
 * provider later without changing the client. Whatever we forward
 * needs to satisfy what's disclosed at /privacy:
 *   - feature usage names (rhythm:added, wheel:applied, task:add)
 *   - a session id that lives only in sessionStorage on the client
 *   - timestamp
 * No personal identifiers, no user agents, no IPs are stored.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const event = String(body.event || '').slice(0, 80);
  const sessionId = String(body.sessionId || '').slice(0, 32);
  const ts = String(body.ts || new Date().toISOString()).slice(0, 32);

  // The data payload is whitelist-shaped on the client; here we just
  // truncate the JSON to a reasonable size to stop unbounded writes.
  let dataString;
  try {
    dataString = JSON.stringify(body.data ?? null).slice(0, 500);
  } catch (_) {
    dataString = '"<unserialisable>"';
  }

  if (!event) {
    return res.status(400).json({ error: 'missing event' });
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    kind: 'telemetry',
    event,
    sessionId: sessionId || null,
    ts,
    data: dataString,
  }));

  // No-content response — we don't echo back anything that could be
  // useful to a third party scraping the endpoint.
  return res.status(204).end();
}
