/**
 * Singleton Cosmos client + per-container handles. Lives under
 * api/_lib so Vercel doesn't expose it as a route.
 *
 * Required env vars (server-only):
 *   COSMOS_ENDPOINT  — https://<account>.documents.azure.com:443/
 *   COSMOS_KEY       — primary key from `az cosmosdb keys list`
 *   COSMOS_DATABASE  — defaults to "taskometer"
 *   COSMOS_CONTAINER — legacy, defaults to "comments" (still used by
 *                      api/comments.js)
 *
 * If the env vars are missing, getContainer/getContainerByName return
 * null and the caller should respond 503 (or fall back to memory in
 * the case of the v2 repo dispatcher).
 */

import { CosmosClient } from '@azure/cosmos';

let _client = null;
const _containers = new Map(); // name -> Container handle
let _logged = false;

export function isCosmosConfigured() {
  return !!(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY);
}

function logMissingOnce() {
  if (_logged) return;
  _logged = true;
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify({
    kind: 'config-missing',
    provider: 'cosmos',
    missing: [
      process.env.COSMOS_ENDPOINT ? null : 'COSMOS_ENDPOINT',
      process.env.COSMOS_KEY ? null : 'COSMOS_KEY',
    ].filter(Boolean),
    doc: 'SETUP.md §5 — provision Cosmos via az cli, then add COSMOS_ENDPOINT and COSMOS_KEY to Vercel',
  }));
}

function getClient() {
  if (!isCosmosConfigured()) return null;
  if (!_client) {
    _client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
    });
  }
  return _client;
}

/**
 * Get a Cosmos container handle by name. Reuses a single client across
 * containers and caches the container object.
 *
 * @param {string} name — container name (e.g. 'blocks', 'routines')
 */
export function getContainerByName(name) {
  const client = getClient();
  if (!client) {
    logMissingOnce();
    return null;
  }
  if (_containers.has(name)) return _containers.get(name);
  const c = client
    .database(process.env.COSMOS_DATABASE || 'taskometer')
    .container(name);
  _containers.set(name, c);
  return c;
}

/**
 * Legacy single-container accessor used by api/comments.js. Returns
 * the container named by COSMOS_CONTAINER (default 'comments').
 */
export function getContainer() {
  return getContainerByName(process.env.COSMOS_CONTAINER || 'comments');
}
