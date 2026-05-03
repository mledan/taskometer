/**
 * /api/comments — comment thread per shared wheel.
 *
 *   GET  /api/comments?thread=<hash>     → list comments
 *   POST /api/comments  { threadKey, name, body } → create comment
 *
 * The thread key is the share-fragment hash (the b64url-encoded wheel
 * blob from /share#w=<hash>) so the same wheel link surfaces the same
 * comment thread across devices.
 *
 * Auth contract:
 *   - When CLERK_SECRET_KEY is set, POST requires a verified token.
 *     The Clerk userId becomes the comment's authorId. GET stays
 *     anonymous-readable (it's a public wheel link after all).
 *   - When Clerk isn't configured at all, POST allows anonymous
 *     comments — useful before auth is wired. The "Anonymous" name
 *     is honest about what's happening.
 *
 * Storage: Cosmos DB serverless container partitioned by /threadKey
 * so reads of a single thread are single-partition (cheap).
 */

import { getContainer, isCosmosConfigured } from './_lib/cosmos.js';
import { isClerkConfigured, verifyAuth } from './_lib/clerk.js';

const THREAD_KEY_RE = /^[A-Za-z0-9_-]{8,40}$/;
const NAME_MAX = 40;
const BODY_MAX = 1000;

export default async function handler(req, res) {
  // Modest CORS so the SPA on a custom domain can talk to /api/* on
  // the same origin without preflight friction. Vercel collapses
  // these into the default rules when on the same host.
  res.setHeader('Vary', 'Origin');

  const c = getContainer();
  if (!c) {
    return res.status(503).json({
      error: 'comments backend not configured',
      hint: 'see SETUP.md §5 for Cosmos provisioning',
    });
  }

  if (req.method === 'GET') return handleList(req, res, c);
  if (req.method === 'POST') return handleCreate(req, res, c);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

async function handleList(req, res, c) {
  const threadKey = String(req.query?.thread || '').trim();
  if (!THREAD_KEY_RE.test(threadKey)) {
    return res.status(400).json({ error: 'invalid thread key' });
  }
  try {
    const { resources } = await c.items
      .query({
        query: 'SELECT c.id, c.name, c.body, c.ts, c.authorId FROM c WHERE c.threadKey = @t ORDER BY c.ts ASC',
        parameters: [{ name: '@t', value: threadKey }],
      }, { partitionKey: threadKey })
      .fetchAll();
    return res.status(200).json({ comments: resources });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ kind: 'comments-list-error', message: err?.message }));
    return res.status(500).json({ error: 'could not load comments' });
  }
}

async function handleCreate(req, res, c) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const threadKey = String(body.threadKey || '').trim();
  if (!THREAD_KEY_RE.test(threadKey)) {
    return res.status(400).json({ error: 'invalid thread key' });
  }

  const text = String(body.body || '').trim().slice(0, BODY_MAX);
  if (!text) return res.status(400).json({ error: 'body required' });

  // Identity: prefer Clerk-verified user when available; fall back to
  // anonymous if Clerk isn't configured. When Clerk IS configured we
  // require auth so paid features and abuse controls have a real
  // identity to attach.
  let authorId = null;
  let displayName = String(body.name || '').trim().slice(0, NAME_MAX);
  if (isClerkConfigured()) {
    const ident = await verifyAuth(req);
    if (!ident) return res.status(401).json({ error: 'sign-in required' });
    authorId = ident.userId;
    if (!displayName) displayName = ident.email?.split('@')[0] || 'Member';
  }
  if (!displayName) displayName = 'Anonymous';

  const doc = {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    threadKey,
    name: displayName,
    body: text,
    authorId,
    ts: new Date().toISOString(),
  };

  try {
    const { resource } = await c.items.create(doc, { partitionKey: threadKey });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      kind: 'comment-created',
      threadKey,
      authorId,
      id: resource.id,
    }));
    return res.status(201).json({ comment: resource });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ kind: 'comments-create-error', message: err?.message }));
    return res.status(500).json({ error: 'could not save comment' });
  }
}
