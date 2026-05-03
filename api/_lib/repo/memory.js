/**
 * In-memory repository — Phase 1 backend. Same interface as the
 * Cosmos repo will be in Phase 2, so route handlers don't change.
 *
 * Every doc carries an `ownerId`. Lookups + mutations are scoped to
 * the caller's owner so user A can't see / clobber user B's data.
 *
 * Stores live on the module so tests can `_resetAll()` between cases
 * and dev runs see consistent state across requests in the same
 * process.
 */

const stores = {
  blocks:           new Map(),
  recurringBlocks:  new Map(),
  routines:         new Map(),
  tasks:            new Map(),
  dayAssignments:   new Map(),
  exceptions:       new Map(),
};

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a CRUD store with owner-scoping baked in.
 *   list({ ownerId, where? })  — where is an optional doc → bool predicate
 *   get({ ownerId, id })       — null if not found OR wrong owner
 *   create({ ownerId, data })  — server assigns id + ts + updated
 *   update({ ownerId, id, patch })  — null if not found / wrong owner
 *   remove({ ownerId, id })    — boolean
 */
function makeStore(name, idPrefix) {
  const map = stores[name];
  if (!map) throw new Error(`unknown store: ${name}`);

  return {
    _reset() { map.clear(); },

    list({ ownerId, where = null } = {}) {
      const out = [];
      for (const doc of map.values()) {
        if (doc.ownerId !== ownerId) continue;
        if (where && !where(doc)) continue;
        out.push(doc);
      }
      return out;
    },

    get({ ownerId, id }) {
      const doc = map.get(id);
      if (!doc || doc.ownerId !== ownerId) return null;
      return doc;
    },

    create({ ownerId, data }) {
      const id = data.id || genId(idPrefix);
      const now = new Date().toISOString();
      const doc = { ...data, id, ownerId, ts: data.ts || now, updated: now };
      map.set(id, doc);
      return doc;
    },

    update({ ownerId, id, patch }) {
      const existing = map.get(id);
      if (!existing || existing.ownerId !== ownerId) return null;
      const next = { ...existing, ...patch, id, ownerId, updated: new Date().toISOString() };
      map.set(id, next);
      return next;
    },

    remove({ ownerId, id }) {
      const existing = map.get(id);
      if (!existing || existing.ownerId !== ownerId) return false;
      map.delete(id);
      return true;
    },

    /** Bulk delete — used by routine paint when re-snapshotting. */
    removeWhere({ ownerId, where }) {
      let count = 0;
      for (const [id, doc] of map.entries()) {
        if (doc.ownerId !== ownerId) continue;
        if (!where(doc)) continue;
        map.delete(id);
        count++;
      }
      return count;
    },

    /**
     * Move every doc owned by `fromOwnerId` to `toOwnerId`. Used by
     * the claim flow when an ephemeral device signs up. TTL (if any)
     * is dropped — claimed data persists.
     */
    reassignOwner({ fromOwnerId, toOwnerId }) {
      let count = 0;
      for (const [id, doc] of map.entries()) {
        if (doc.ownerId !== fromOwnerId) continue;
        const { ttl, ...rest } = doc;
        map.set(id, { ...rest, ownerId: toOwnerId });
        count++;
      }
      return count;
    },
  };
}

export const blocksRepo          = makeStore('blocks',          'blk');
export const recurringBlocksRepo = makeStore('recurringBlocks', 'rcb');
export const routinesRepo        = makeStore('routines',        'rtn');
export const tasksRepo           = makeStore('tasks',           'tsk');
export const dayAssignmentsRepo  = makeStore('dayAssignments',  'asn');
export const exceptionsRepo      = makeStore('exceptions',      'exc');

export function _resetAll() {
  for (const s of Object.values(stores)) s.clear();
}
