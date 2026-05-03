/**
 * Repo dispatch — pick the active backend at request time.
 *
 * Phase 1: memory always.
 * Phase 2: when COSMOS_ENDPOINT + COSMOS_KEY are set, swap in the
 * cosmos repo. The route handlers don't change because both repos
 * honor the same async interface (list/get/create/update/remove/
 * removeWhere), all returning Promises.
 *
 * Backend is resolved per-call (not module-init) so toggling the env
 * vars in dev / between tests works without a restart.
 */

import * as memory from './memory.js';
import * as cosmos from './cosmos.js';
import { isCosmosConfigured } from '../cosmos.js';

function backend() {
  return isCosmosConfigured() ? cosmos : memory;
}

export function activeBackend() {
  return isCosmosConfigured() ? 'cosmos' : 'memory';
}

export function repos() {
  const b = backend();
  return {
    blocks:          b.blocksRepo,
    recurringBlocks: b.recurringBlocksRepo,
    routines:        b.routinesRepo,
    tasks:           b.tasksRepo,
    dayAssignments:  b.dayAssignmentsRepo,
    exceptions:      b.exceptionsRepo,
  };
}

/** Test-only — clear every store between cases. Cosmos backend is a no-op. */
export function _resetAll() { backend()._resetAll(); }
