/**
 * GET /api/lifestyles — public, unauthenticated.
 *
 * Returns the curated whitelist. The SPA's lifestyle picker uses
 * this as its source of truth.
 */
import { LIFESTYLES } from './_lib/lifestyles.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  return res.status(200).json({ lifestyles: LIFESTYLES });
}
