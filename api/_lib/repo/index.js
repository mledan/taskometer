/**
 * Repo dispatch — pick the active backend at request time.
 *
 * Phase 1: memory always.
 * Phase 2: when COSMOS_ENDPOINT is set, swap in the cosmos repo. The
 * route handlers don't change because both repos honor the same
 * interface (list/get/create/update/remove/removeWhere).
 */

import * as memory from './memory.js';

export function activeBackend() {
  return 'memory';
}

export function repos() {
  return {
    blocks:          memory.blocksRepo,
    recurringBlocks: memory.recurringBlocksRepo,
    routines:        memory.routinesRepo,
    tasks:           memory.tasksRepo,
    dayAssignments:  memory.dayAssignmentsRepo,
    exceptions:      memory.exceptionsRepo,
  };
}

/** Test-only — clear every store between cases. */
export function _resetAll() { memory._resetAll(); }
