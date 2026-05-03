/**
 * Singleton Cosmos client + container handle. Lives under api/_lib so
 * Vercel doesn't expose it as a route.
 *
 * Required env vars (server-only):
 *   COSMOS_ENDPOINT  — https://<account>.documents.azure.com:443/
 *   COSMOS_KEY       — primary key from `az cosmosdb keys list`
 *   COSMOS_DATABASE  — defaults to "taskometer"
 *   COSMOS_CONTAINER — defaults to "comments"
 *
 * If the env vars are missing, container() returns null and the
 * caller should respond 503. Logged with config-missing JSON.
 */

import { CosmosClient } from '@azure/cosmos';

let _client = null;
let _container = null;
let _logged = false;

export function isCosmosConfigured() {
  return !!(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY);
}

export function getContainer() {
  if (!isCosmosConfigured()) {
    if (!_logged) {
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
    return null;
  }
  if (!_container) {
    _client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
    });
    _container = _client
      .database(process.env.COSMOS_DATABASE || 'taskometer')
      .container(process.env.COSMOS_CONTAINER || 'comments');
  }
  return _container;
}
