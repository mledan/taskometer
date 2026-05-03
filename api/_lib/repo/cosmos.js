/**
 * Cosmos repository — Phase 2 backend. Same interface as the in-memory
 * repo so route handlers don't change.
 *
 * Container layout: one Cosmos container per resource type, all
 * partitioned by /ownerId. Single-partition queries per user, which
 * is the cheap path on serverless Cosmos.
 *
 *   blocks            — partition key /ownerId
 *   recurring-blocks  — partition key /ownerId
 *   routines          — partition key /ownerId
 *   tasks             — partition key /ownerId
 *   day-assignments   — partition key /ownerId
 *   exceptions        — partition key /ownerId
 *
 * Provisioning script: scripts/setup-cosmos-v2.sh
 *
 * Each store implements:
 *   list({ ownerId, where? })
 *   get({ ownerId, id })
 *   create({ ownerId, data })
 *   update({ ownerId, id, patch })
 *   remove({ ownerId, id })
 *   removeWhere({ ownerId, where })
 *
 * `where` is an in-memory predicate (doc → bool). For the data sizes
 * Taskometer hits (a few thousand docs per user, max), pulling all of
 * a user's docs and filtering in JS is faster + simpler than
 * synthesizing arbitrary SQL. If a query gets hot we can promote it
 * to a parameterized query later.
 */

import { getContainerByName } from '../cosmos.js';
import { isEphemeralOwner } from '../identity.js';

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip Cosmos system fields (_rid, _self, _etag, _attachments, _ts) from a doc. */
function clean(doc) {
  if (!doc) return doc;
  const { _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
  return rest;
}

/**
 * Default TTL for ephemeral owners — 24 hours. Spirit of the design:
 * if you don't sign up within a day of trying the app, your local
 * scratch data is reclaimed. Refreshed on every write (Cosmos resets
 * the TTL countdown to "now + ttl seconds" on each replace).
 */
const EPHEMERAL_TTL_SECONDS = 24 * 60 * 60;

/**
 * Apply Cosmos per-doc TTL when the owner is ephemeral. The `ttl`
 * field is honored by Cosmos automatically when the container has
 * default TTL enabled (we set it to -1 = "respect per-doc ttl when
 * present, never expire otherwise"). For Clerk owners ttl stays
 * unset → permanent.
 */
function applyTtl(doc, ownerId) {
  if (!isEphemeralOwner(ownerId)) return doc;
  return { ...doc, ttl: EPHEMERAL_TTL_SECONDS };
}

/**
 * Build a Cosmos-backed CRUD store. The container name and id prefix
 * come in at construction time; everything else mirrors memory.js.
 */
function makeStore(containerName, idPrefix) {
  function container() {
    const c = getContainerByName(containerName);
    if (!c) throw new Error(`cosmos not configured (container: ${containerName})`);
    return c;
  }

  return {
    async list({ ownerId, where = null } = {}) {
      const { resources } = await container().items
        .query(
          { query: 'SELECT * FROM c WHERE c.ownerId = @o', parameters: [{ name: '@o', value: ownerId }] },
          { partitionKey: ownerId },
        )
        .fetchAll();
      const filtered = where ? resources.filter(where) : resources;
      return filtered.map(clean);
    },

    async get({ ownerId, id }) {
      try {
        const { resource } = await container().item(id, ownerId).read();
        if (!resource || resource.ownerId !== ownerId) return null;
        return clean(resource);
      } catch (err) {
        if (err?.code === 404) return null;
        throw err;
      }
    },

    async create({ ownerId, data }) {
      const id = data.id || genId(idPrefix);
      const now = new Date().toISOString();
      let doc = { ...data, id, ownerId, ts: data.ts || now, updated: now };
      doc = applyTtl(doc, ownerId);
      const { resource } = await container().items.create(doc);
      return clean(resource);
    },

    async update({ ownerId, id, patch }) {
      let existing;
      try {
        const r = await container().item(id, ownerId).read();
        existing = r.resource;
      } catch (err) {
        if (err?.code === 404) return null;
        throw err;
      }
      if (!existing || existing.ownerId !== ownerId) return null;
      let next = { ...clean(existing), ...patch, id, ownerId, updated: new Date().toISOString() };
      next = applyTtl(next, ownerId);
      const { resource } = await container().item(id, ownerId).replace(next);
      return clean(resource);
    },

    async remove({ ownerId, id }) {
      try {
        await container().item(id, ownerId).delete();
        return true;
      } catch (err) {
        if (err?.code === 404) return false;
        throw err;
      }
    },

    /**
     * Bulk delete by predicate. Cosmos has no batched delete-by-query,
     * so we fetch the matching docs and issue point deletes in
     * parallel. Used by routine paint when re-snapshotting (small N
     * — typically <30 docs per call).
     */
    async removeWhere({ ownerId, where }) {
      const { resources } = await container().items
        .query(
          { query: 'SELECT c.id FROM c WHERE c.ownerId = @o', parameters: [{ name: '@o', value: ownerId }] },
          { partitionKey: ownerId },
        )
        .fetchAll();
      // We need full docs to evaluate the predicate.
      const fulls = await Promise.all(
        resources.map(({ id }) => container().item(id, ownerId).read().then(r => r.resource).catch(() => null)),
      );
      const targets = fulls.filter(d => d && where(d));
      await Promise.all(
        targets.map(d => container().item(d.id, ownerId).delete().catch(() => null)),
      );
      return targets.length;
    },

    /**
     * Move every doc owned by `fromOwnerId` to `toOwnerId`. The
     * partition key (ownerId) is part of the doc, so Cosmos requires
     * a delete-then-create pair per doc — there's no in-place
     * partition-key update. We strip `ttl` so the claimed docs
     * persist permanently.
     *
     * Used by /api/v2/claim when an ephemeral device signs up.
     */
    async reassignOwner({ fromOwnerId, toOwnerId }) {
      const { resources } = await container().items
        .query(
          { query: 'SELECT * FROM c WHERE c.ownerId = @o', parameters: [{ name: '@o', value: fromOwnerId }] },
          { partitionKey: fromOwnerId },
        )
        .fetchAll();

      let count = 0;
      for (const doc of resources) {
        const { ttl, ...rest } = clean(doc);
        const reowned = { ...rest, ownerId: toOwnerId };
        try {
          await container().items.create(reowned);
          await container().item(doc.id, fromOwnerId).delete();
          count++;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('reassignOwner: skipped one doc', { id: doc.id, code: err?.code });
        }
      }
      return count;
    },
  };
}

export const blocksRepo          = makeStore('blocks',           'blk');
export const recurringBlocksRepo = makeStore('recurring-blocks', 'rcb');
export const routinesRepo        = makeStore('routines',         'rtn');
export const tasksRepo           = makeStore('tasks',            'tsk');
export const dayAssignmentsRepo  = makeStore('day-assignments',  'asn');
export const exceptionsRepo      = makeStore('exceptions',       'exc');

/**
 * No-op for cosmos (we don't reset prod data between tests). The
 * symbol exists so the dispatch in repo/index.js can call
 * `_resetAll()` uniformly without branching.
 */
export function _resetAll() { /* no-op for cosmos */ }
