/**
 * DatabaseAdapter Interface
 *
 * Abstract interface for all database operations. This allows swapping
 * between localStorage, IndexedDB, and a real backend API without
 * changing the application code.
 *
 * TODO: When migrating to a real database:
 * 1. Create ApiAdapter.js implementing this interface
 * 2. Add authentication headers to all requests
 * 3. Implement proper error handling and retries
 * 4. Add caching layer for offline support
 * 5. Implement WebSocket for real-time sync
 *
 * Example API endpoints this would connect to:
 * - GET    /api/tasks              - List tasks
 * - POST   /api/tasks              - Create task
 * - GET    /api/tasks/:id          - Get task
 * - PUT    /api/tasks/:id          - Update task
 * - DELETE /api/tasks/:id          - Delete task
 * - Similar for /api/slots, /api/schedules, /api/tags, /api/types, /api/audit
 */

/**
 * @typedef {Object} QueryOptions
 * @property {Object} filters - Filter criteria
 * @property {string} sortBy - Field to sort by
 * @property {'asc'|'desc'} sortOrder - Sort direction
 * @property {number} limit - Max items to return
 * @property {number} offset - Items to skip
 */

/**
 * @typedef {Object} QueryResult
 * @property {Array} data - Result items
 * @property {number} total - Total matching items
 * @property {boolean} hasMore - Whether more items exist
 */

/**
 * Abstract DatabaseAdapter class
 * All database implementations must extend this class
 */
export class DatabaseAdapter {
  constructor(options = {}) {
    if (new.target === DatabaseAdapter) {
      throw new Error('DatabaseAdapter is abstract and cannot be instantiated directly');
    }
    this.options = options;
    this.isInitialized = false;
  }

  /**
   * Initialize the database connection
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('Method close() must be implemented');
  }

  /**
   * Check if adapter is ready
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized;
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  /**
   * Create a new task
   * @param {Object} task - Task data
   * @returns {Promise<Object>} Created task with ID
   *
   * TODO: Replace with API call:
   * POST /api/tasks
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: task
   */
  async createTask(task) {
    throw new Error('Method createTask() must be implemented');
  }

  /**
   * Get a task by ID
   * @param {string} taskId
   * @returns {Promise<Object|null>}
   *
   * TODO: Replace with API call:
   * GET /api/tasks/:taskId
   */
  async getTask(taskId) {
    throw new Error('Method getTask() must be implemented');
  }

  /**
   * Update a task
   * @param {string} taskId
   * @param {Object} updates - Partial task data
   * @returns {Promise<Object>} Updated task
   *
   * TODO: Replace with API call:
   * PUT /api/tasks/:taskId
   * Body: updates
   */
  async updateTask(taskId, updates) {
    throw new Error('Method updateTask() must be implemented');
  }

  /**
   * Delete a task
   * @param {string} taskId
   * @returns {Promise<boolean>} Success status
   *
   * TODO: Replace with API call:
   * DELETE /api/tasks/:taskId
   */
  async deleteTask(taskId) {
    throw new Error('Method deleteTask() must be implemented');
  }

  /**
   * Query tasks with filters
   * @param {QueryOptions} options
   * @returns {Promise<QueryResult>}
   *
   * TODO: Replace with API call:
   * GET /api/tasks?status=pending&limit=50&offset=0
   */
  async queryTasks(options = {}) {
    throw new Error('Method queryTasks() must be implemented');
  }

  /**
   * Batch create tasks
   * @param {Object[]} tasks
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * POST /api/tasks/batch
   */
  async batchCreateTasks(tasks) {
    throw new Error('Method batchCreateTasks() must be implemented');
  }

  /**
   * Batch update tasks
   * @param {Array<{id: string, updates: Object}>} updates
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * PUT /api/tasks/batch
   */
  async batchUpdateTasks(updates) {
    throw new Error('Method batchUpdateTasks() must be implemented');
  }

  // ============================================
  // CALENDAR SLOT OPERATIONS
  // ============================================

  /**
   * Create a calendar slot
   * @param {Object} slot
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * POST /api/slots
   */
  async createSlot(slot) {
    throw new Error('Method createSlot() must be implemented');
  }

  /**
   * Get a slot by ID
   * @param {string} slotId
   * @returns {Promise<Object|null>}
   *
   * TODO: Replace with API call:
   * GET /api/slots/:slotId
   */
  async getSlot(slotId) {
    throw new Error('Method getSlot() must be implemented');
  }

  /**
   * Update a slot
   * @param {string} slotId
   * @param {Object} updates
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * PUT /api/slots/:slotId
   */
  async updateSlot(slotId, updates) {
    throw new Error('Method updateSlot() must be implemented');
  }

  /**
   * Delete a slot
   * @param {string} slotId
   * @returns {Promise<boolean>}
   *
   * TODO: Replace with API call:
   * DELETE /api/slots/:slotId
   */
  async deleteSlot(slotId) {
    throw new Error('Method deleteSlot() must be implemented');
  }

  /**
   * Query slots (e.g., by date range)
   * @param {QueryOptions} options
   * @returns {Promise<QueryResult>}
   *
   * TODO: Replace with API call:
   * GET /api/slots?dateFrom=2024-01-01&dateTo=2024-01-07
   */
  async querySlots(options = {}) {
    throw new Error('Method querySlots() must be implemented');
  }

  /**
   * Get slots for a specific date
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * GET /api/slots?date=2024-01-01
   */
  async getSlotsForDate(date) {
    throw new Error('Method getSlotsForDate() must be implemented');
  }

  /**
   * Batch create slots (e.g., when applying a schedule)
   * @param {Object[]} slots
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * POST /api/slots/batch
   */
  async batchCreateSlots(slots) {
    throw new Error('Method batchCreateSlots() must be implemented');
  }

  /**
   * Clear slots for a date range (e.g., before applying new schedule)
   * @param {string} dateFrom
   * @param {string} dateTo
   * @param {Object} filters - Additional filters
   * @returns {Promise<number>} Number of deleted slots
   *
   * TODO: Replace with API call:
   * DELETE /api/slots?dateFrom=...&dateTo=...
   */
  async clearSlots(dateFrom, dateTo, filters = {}) {
    throw new Error('Method clearSlots() must be implemented');
  }

  // ============================================
  // TAG OPERATIONS
  // ============================================

  /**
   * Create a tag
   * @param {Object} tag
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * POST /api/tags
   */
  async createTag(tag) {
    throw new Error('Method createTag() must be implemented');
  }

  /**
   * Get all tags
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * GET /api/tags
   */
  async getTags() {
    throw new Error('Method getTags() must be implemented');
  }

  /**
   * Update a tag
   * @param {string} tagId
   * @param {Object} updates
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * PUT /api/tags/:tagId
   */
  async updateTag(tagId, updates) {
    throw new Error('Method updateTag() must be implemented');
  }

  /**
   * Delete a tag
   * @param {string} tagId
   * @returns {Promise<boolean>}
   *
   * TODO: Replace with API call:
   * DELETE /api/tags/:tagId
   */
  async deleteTag(tagId) {
    throw new Error('Method deleteTag() must be implemented');
  }

  // ============================================
  // TASK TYPE OPERATIONS
  // ============================================

  /**
   * Create a task type
   * @param {Object} type
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * POST /api/task-types
   */
  async createTaskType(type) {
    throw new Error('Method createTaskType() must be implemented');
  }

  /**
   * Get all task types
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * GET /api/task-types
   */
  async getTaskTypes() {
    throw new Error('Method getTaskTypes() must be implemented');
  }

  /**
   * Update a task type
   * @param {string} typeId
   * @param {Object} updates
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * PUT /api/task-types/:typeId
   */
  async updateTaskType(typeId, updates) {
    throw new Error('Method updateTaskType() must be implemented');
  }

  /**
   * Delete a task type
   * @param {string} typeId
   * @returns {Promise<boolean>}
   *
   * TODO: Replace with API call:
   * DELETE /api/task-types/:typeId
   */
  async deleteTaskType(typeId) {
    throw new Error('Method deleteTaskType() must be implemented');
  }

  // ============================================
  // SCHEDULE OPERATIONS
  // ============================================

  /**
   * Create a schedule
   * @param {Object} schedule
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * POST /api/schedules
   */
  async createSchedule(schedule) {
    throw new Error('Method createSchedule() must be implemented');
  }

  /**
   * Get a schedule by ID
   * @param {string} scheduleId
   * @returns {Promise<Object|null>}
   *
   * TODO: Replace with API call:
   * GET /api/schedules/:scheduleId
   */
  async getSchedule(scheduleId) {
    throw new Error('Method getSchedule() must be implemented');
  }

  /**
   * Get all schedules (famous + custom)
   * @param {Object} filters
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * GET /api/schedules?isPublic=true
   */
  async getSchedules(filters = {}) {
    throw new Error('Method getSchedules() must be implemented');
  }

  /**
   * Update a schedule
   * @param {string} scheduleId
   * @param {Object} updates
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * PUT /api/schedules/:scheduleId
   */
  async updateSchedule(scheduleId, updates) {
    throw new Error('Method updateSchedule() must be implemented');
  }

  /**
   * Delete a schedule
   * @param {string} scheduleId
   * @returns {Promise<boolean>}
   *
   * TODO: Replace with API call:
   * DELETE /api/schedules/:scheduleId
   */
  async deleteSchedule(scheduleId) {
    throw new Error('Method deleteSchedule() must be implemented');
  }

  /**
   * Get the active schedule
   * @returns {Promise<Object|null>}
   *
   * TODO: Replace with API call:
   * GET /api/schedules/active
   */
  async getActiveSchedule() {
    throw new Error('Method getActiveSchedule() must be implemented');
  }

  /**
   * Set the active schedule
   * @param {string|null} scheduleId
   * @returns {Promise<void>}
   *
   * TODO: Replace with API call:
   * PUT /api/schedules/active
   * Body: { scheduleId }
   */
  async setActiveSchedule(scheduleId) {
    throw new Error('Method setActiveSchedule() must be implemented');
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  /**
   * Create an audit entry
   * @param {Object} entry
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * POST /api/audit
   */
  async createAuditEntry(entry) {
    throw new Error('Method createAuditEntry() must be implemented');
  }

  /**
   * Query audit entries
   * @param {QueryOptions} options
   * @returns {Promise<QueryResult>}
   *
   * TODO: Replace with API call:
   * GET /api/audit?entityType=task&dateFrom=...
   */
  async queryAuditEntries(options = {}) {
    throw new Error('Method queryAuditEntries() must be implemented');
  }

  /**
   * Get audit entries for an entity
   * @param {string} entityType
   * @param {string} entityId
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * GET /api/audit?entityType=task&entityId=123
   */
  async getAuditForEntity(entityType, entityId) {
    throw new Error('Method getAuditForEntity() must be implemented');
  }

  /**
   * Batch create audit entries
   * @param {Object[]} entries
   * @returns {Promise<Object[]>}
   *
   * TODO: Replace with API call:
   * POST /api/audit/batch
   */
  async batchCreateAuditEntries(entries) {
    throw new Error('Method batchCreateAuditEntries() must be implemented');
  }

  // ============================================
  // SETTINGS & STATE OPERATIONS
  // ============================================

  /**
   * Get a setting value
   * @param {string} key
   * @param {*} defaultValue
   * @returns {Promise<*>}
   *
   * TODO: Replace with API call:
   * GET /api/settings/:key
   */
  async getSetting(key, defaultValue = null) {
    throw new Error('Method getSetting() must be implemented');
  }

  /**
   * Set a setting value
   * @param {string} key
   * @param {*} value
   * @returns {Promise<void>}
   *
   * TODO: Replace with API call:
   * PUT /api/settings/:key
   * Body: { value }
   */
  async setSetting(key, value) {
    throw new Error('Method setSetting() must be implemented');
  }

  /**
   * Get the full application state
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * GET /api/state
   */
  async getState() {
    throw new Error('Method getState() must be implemented');
  }

  /**
   * Save the full application state
   * @param {Object} state
   * @returns {Promise<void>}
   *
   * TODO: Replace with API call:
   * PUT /api/state
   * Body: state
   */
  async saveState(state) {
    throw new Error('Method saveState() must be implemented');
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Sync local changes to remote
   * @param {Object} changes
   * @returns {Promise<Object>} Sync result
   *
   * TODO: Replace with API call:
   * POST /api/sync/push
   * Body: changes
   */
  async syncPush(changes) {
    throw new Error('Method syncPush() must be implemented');
  }

  /**
   * Pull remote changes to local
   * @param {string} since - ISO timestamp
   * @returns {Promise<Object>} Changes since timestamp
   *
   * TODO: Replace with API call:
   * GET /api/sync/pull?since=2024-01-01T00:00:00Z
   */
  async syncPull(since) {
    throw new Error('Method syncPull() must be implemented');
  }

  /**
   * Get sync status
   * @returns {Promise<Object>}
   *
   * TODO: Replace with API call:
   * GET /api/sync/status
   */
  async getSyncStatus() {
    throw new Error('Method getSyncStatus() must be implemented');
  }

  // ============================================
  // UTILITY OPERATIONS
  // ============================================

  /**
   * Clear all data (for reset/logout)
   * @returns {Promise<void>}
   */
  async clearAll() {
    throw new Error('Method clearAll() must be implemented');
  }

  /**
   * Export all data
   * @returns {Promise<Object>}
   */
  async exportData() {
    throw new Error('Method exportData() must be implemented');
  }

  /**
   * Import data
   * @param {Object} data
   * @param {Object} options
   * @returns {Promise<Object>} Import result
   */
  async importData(data, options = {}) {
    throw new Error('Method importData() must be implemented');
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('Method getStats() must be implemented');
  }
}

export default DatabaseAdapter;
