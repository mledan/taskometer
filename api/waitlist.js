/**
 * Waitlist endpoint — Vercel serverless function.
 *
 * Accepts POST { email, team, ts }, validates lightly, and logs to
 * stdout so entries show up in the Vercel function logs. No database
 * yet — this is the cheapest possible "we're capturing real interest"
 * surface that doesn't lie to visitors.
 *
 * When we have a real CRM/db (Postgres, Notion, Airtable, whatever),
 * the body of the handler swaps out and the contract stays the same.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = String(body.email || '').trim().slice(0, 200);
  const team = String(body.team || '').trim().slice(0, 200);

  // Minimal validation — we can't fully verify an email without sending
  // one, but reject the obvious garbage and overlong inputs.
  const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!looksEmail) {
    return res.status(400).json({ error: 'invalid email' });
  }

  const entry = {
    email,
    team,
    ts: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || null,
    ua: req.headers['user-agent'] || null,
  };

  // The log line is intentionally a single JSON object so it grep's
  // cleanly out of Vercel's log stream.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ kind: 'waitlist', ...entry }));

  return res.status(200).json({ ok: true });
}
