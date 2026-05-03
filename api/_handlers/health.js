/**
 * GET /api/health
 *
 * Liveness + introspection. Tests use this to confirm the API is
 * reachable; ops use it to learn which storage backend is active.
 */
import { activeBackend } from '../_lib/repo/index.js';
import { isClerkConfigured } from '../_lib/clerk.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  return res.status(200).json({
    status: 'ok',
    repo: activeBackend(),
    auth: isClerkConfigured() ? 'clerk' : 'anonymous',
    ts: new Date().toISOString(),
  });
}
