/**
 * LocalStorageAdapter
 *
 * Implementation of DatabaseAdapter using browser localStorage.
 * This is the default adapter for browser-only usage.
 *
 * Storage Keys:
 * - taskometer-tasks: Array of tasks
 * - taskometer-slots: Array of calendar slots
 * - taskometer-tags: Array of tags
 * - taskometer-types: Array of task types
 * - taskometer-schedules: Array of custom schedules
 * - taskometer-audit: Array of audit entries
 * - taskometer-settings: Key-value settings
 * - taskometer-active-schedule: Active schedule ID
 * - state: Legacy app state (for backwards compatibility)
 *
 * TODO: When migrating to a real database:
 * 1. Create ApiAdapter.js that makes HTTP calls instead of localStorage
 * 2. The method signatures remain the same
 * 3. Add error handling for network failures
 * 4. Implement offline queue for pending changes
 */

import { DatabaseAdapter } from './DatabaseAdapter';
import {
  createTask,
  migrateLegacyTask,
  taskMatchesFilters
} from '../../models/Task';
import {
  createCalendarSlot,
  getSlotsForDate as filterSlotsForDate,
  getSlotsForDateRange
} from '../../models/CalendarSlot';
import { createTag, mergeWithDefaultTags, DEFAULT_TAGS } from '../../models/Tag';
import { createTaskType, mergeWithDefaultTypes, DEFAULT_TASK_TYPES } from '../../models/TaskType';
import { createSchedule, migrateLegacySchedule } from '../../models/Schedule';
import { createAuditEntry, filterAuditEntries } from '../../models/AuditEntry';
import { FAMOUS_SCHEDULES } from '../../utils/scheduleTemplates';

// Storage key constants
const STORAGE_KEYS = {
  TASKS: 'taskometer-tasks',
  SLOTS: 'taskometer-slots',
  TAGS: 'taskometer-tags',
  TYPES: 'taskometer-types',
  SCHEDULES: 'taskometer-schedules',
  AUDIT: 'taskometer-audit',
  SETTINGS: 'taskometer-settings',
  ACTIVE_SCHEDULE: 'taskometer-active-schedule',
  LEGACY_STATE: 'state',
  LEGACY_HISTORY: 'taskometer-history',
  MODEL_VERSION: 'taskometer-model-version'
};

const CURRENT_MODEL_VERSION = '2.0.0';

export class LocalStorageAdapter extends DatabaseAdapter {
  constructor(options = {}) {
    super(options);
    this.storage = options.storage || localStorage;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async initialize() {
    try {
      // Check for migration needs
      const storedVersion = this._get(STORAGE_KEYS.MODEL_VERSION);

      if (storedVersion !== CURRENT_MODEL_VERSION) {
        await this._migrateData(storedVersion);
        this._set(STORAGE_KEYS.MODEL_VERSION, CURRENT_MODEL_VERSION);
      }

      // Initialize defaults if needed
      await this._initializeDefaults();

      this.isInitialized = true;
      console.log('[LocalStorageAdapter] Initialized successfully');
    } catch (error) {
      console.error('[LocalStorageAdapter] Initialization failed:', error);
      throw error;
    }
  }

  async close() {
    this.isInitialized = false;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  _get(key) {
    try {
      const value = this.storage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[LocalStorageAdapter] Error reading ${key}:`, error);
      return null;
    }
  }

  _set(key, value) {
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[LocalStorageAdapter] Error writing ${key}:`, error);
      return false;
    }
  }

  _remove(key) {
    try {
      this.storage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[LocalStorageAdapter] Error removing ${key}:`, error);
      return false;
    }
  }

  async _migrateData(fromVersion) {
    console.log(`[LocalStorageAdapter] Migrating from version ${fromVersion || 'none'}`);

    // Migrate legacy state if exists
    const legacyState = this._get(STORAGE_KEYS.LEGACY_STATE);
    if (legacyState) {
      // Migrate tasks
      if (legacyState.items && legacyState.items.length > 0) {
        const existingTasks = this._get(STORAGE_KEYS.TASKS) || [];
        if (existingTasks.length === 0) {
          const migratedTasks = legacyState.items.map(item => migrateLegacyTask(item));
          this._set(STORAGE_KEYS.TASKS, migratedTasks);
          console.log(`[LocalStorageAdapter] Migrated ${migratedTasks.length} tasks`);
        }
      }

      // Migrate task types
      if (legacyState.taskTypes && legacyState.taskTypes.length > 0) {
        const existingTypes = this._get(STORAGE_KEYS.TYPES) || [];
        if (existingTypes.length === 0) {
          const migratedTypes = legacyState.taskTypes.map(type => createTaskType(type));
          this._set(STORAGE_KEYS.TYPES, migratedTypes);
          console.log(`[LocalStorageAdapter] Migrated ${migratedTypes.length} task types`);
        }
      }
    }

    // Migrate legacy schedules
    const legacySchedules = this._get('taskometer-schedules');
    if (legacySchedules && legacySchedules.length > 0) {
      const migratedSchedules = legacySchedules.map(schedule => {
        if (!schedule.categories || !schedule.applicableGranularity) {
          return migrateLegacySchedule(schedule);
        }
        return schedule;
      });
      this._set(STORAGE_KEYS.SCHEDULES, migratedSchedules);
    }

    // Migrate legacy history to audit
    const legacyHistory = this._get(STORAGE_KEYS.LEGACY_HISTORY);
    if (legacyHistory && legacyHistory.length > 0) {
      const existingAudit = this._get(STORAGE_KEYS.AUDIT) || [];
      if (existingAudit.length === 0) {
        const auditEntries = legacyHistory.map(item => createAuditEntry({
          action: item.action === 'removed' ? 'DELETE' : 'TASK_COMPLETE',
          entityType: 'task',
          entityId: item.key?.toString(),
          entityName: item.text,
          timestamp: item.removedAt || item.completedAt || new Date().toISOString(),
          previousState: item,
          source: 'migration'
        }));
        this._set(STORAGE_KEYS.AUDIT, auditEntries);
      }
    }
  }

  async _initializeDefaults() {
    // Initialize tags with defaults if empty
    const tags = this._get(STORAGE_KEYS.TAGS);
    if (!tags || tags.length === 0) {
      this._set(STORAGE_KEYS.TAGS, DEFAULT_TAGS.map(t => createTag(t)));
    }

    // Initialize task types with defaults if empty
    const types = this._get(STORAGE_KEYS.TYPES);
    if (!types || types.length === 0) {
      this._set(STORAGE_KEYS.TYPES, DEFAULT_TASK_TYPES.map(t => createTaskType(t)));
    }

    // Initialize other collections as empty arrays if not exist
    if (!this._get(STORAGE_KEYS.TASKS)) this._set(STORAGE_KEYS.TASKS, []);
    if (!this._get(STORAGE_KEYS.SLOTS)) this._set(STORAGE_KEYS.SLOTS, []);
    if (!this._get(STORAGE_KEYS.SCHEDULES)) this._set(STORAGE_KEYS.SCHEDULES, []);
    if (!this._get(STORAGE_KEYS.AUDIT)) this._set(STORAGE_KEYS.AUDIT, []);
    if (!this._get(STORAGE_KEYS.SETTINGS)) this._set(STORAGE_KEYS.SETTINGS, {});
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  /**
   * Create a new task
   *
   * TODO: Replace with API call:
   * POST /api/tasks
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: task
   * Returns: { id, ...task, createdAt, updatedAt }
   */
  async createTask(taskData) {
    const tasks = this._get(STORAGE_KEYS.TASKS) || [];
    const task = createTask(taskData);
    tasks.push(task);
    this._set(STORAGE_KEYS.TASKS, tasks);
    return task;
  }

  /**
   * Get a task by ID
   *
   * TODO: Replace with API call:
   * GET /api/tasks/:taskId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getTask(taskId) {
    const tasks = this._get(STORAGE_KEYS.TASKS) || [];
    // Support both new id and legacy key
    return tasks.find(t => t.id === taskId || t.key?.toString() === taskId) || null;
  }

  /**
   * Update a task
   *
   * TODO: Replace with API call:
   * PUT /api/tasks/:taskId
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: updates
   */
  async updateTask(taskId, updates) {
    const tasks = this._get(STORAGE_KEYS.TASKS) || [];
    const index = tasks.findIndex(t => t.id === taskId || t.key?.toString() === taskId);

    if (index === -1) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updatedTask = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    tasks[index] = updatedTask;
    this._set(STORAGE_KEYS.TASKS, tasks);
    return updatedTask;
  }

  /**
   * Delete a task
   *
   * TODO: Replace with API call:
   * DELETE /api/tasks/:taskId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async deleteTask(taskId) {
    const tasks = this._get(STORAGE_KEYS.TASKS) || [];
    const index = tasks.findIndex(t => t.id === taskId || t.key?.toString() === taskId);

    if (index === -1) {
      return false;
    }

    tasks.splice(index, 1);
    this._set(STORAGE_KEYS.TASKS, tasks);
    return true;
  }

  /**
   * Query tasks with filters
   *
   * TODO: Replace with API call:
   * GET /api/tasks?status=pending&primaryType=work&limit=50&offset=0
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async queryTasks(options = {}) {
    let tasks = this._get(STORAGE_KEYS.TASKS) || [];

    // Apply filters
    if (options.filters) {
      tasks = tasks.filter(task => taskMatchesFilters(task, options.filters));
    }

    // Sort
    if (options.sortBy) {
      tasks.sort((a, b) => {
        const aVal = a[options.sortBy];
        const bVal = b[options.sortBy];
        const order = options.sortOrder === 'desc' ? -1 : 1;

        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
        return 0;
      });
    }

    const total = tasks.length;

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || tasks.length;
    tasks = tasks.slice(offset, offset + limit);

    return {
      data: tasks,
      total,
      hasMore: offset + tasks.length < total
    };
  }

  /**
   * Batch create tasks
   *
   * TODO: Replace with API call:
   * POST /api/tasks/batch
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: { tasks }
   */
  async batchCreateTasks(tasksData) {
    const tasks = this._get(STORAGE_KEYS.TASKS) || [];
    const newTasks = tasksData.map(data => createTask(data));
    tasks.push(...newTasks);
    this._set(STORAGE_KEYS.TASKS, tasks);
    return newTasks;
  }

  /**
   * Batch update tasks
   *
   * TODO: Replace with API call:
   * PUT /api/tasks/batch
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: { updates: [{ id, updates }] }
   */
  async batchUpdateTasks(updates) {
    const tasks = this._get(STORAGE_KEYS.TASKS) || [];
    const updatedTasks = [];

    updates.forEach(({ id, updates: taskUpdates }) => {
      const index = tasks.findIndex(t => t.id === id || t.key?.toString() === id);
      if (index !== -1) {
        tasks[index] = {
          ...tasks[index],
          ...taskUpdates,
          updatedAt: new Date().toISOString()
        };
        updatedTasks.push(tasks[index]);
      }
    });

    this._set(STORAGE_KEYS.TASKS, tasks);
    return updatedTasks;
  }

  // ============================================
  // CALENDAR SLOT OPERATIONS
  // ============================================

  /**
   * Create a calendar slot
   *
   * TODO: Replace with API call:
   * POST /api/slots
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: slot
   */
  async createSlot(slotData) {
    const slots = this._get(STORAGE_KEYS.SLOTS) || [];
    const slot = createCalendarSlot(slotData);
    slots.push(slot);
    this._set(STORAGE_KEYS.SLOTS, slots);
    return slot;
  }

  /**
   * Get a slot by ID
   *
   * TODO: Replace with API call:
   * GET /api/slots/:slotId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getSlot(slotId) {
    const slots = this._get(STORAGE_KEYS.SLOTS) || [];
    return slots.find(s => s.id === slotId) || null;
  }

  /**
   * Update a slot
   *
   * TODO: Replace with API call:
   * PUT /api/slots/:slotId
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: updates
   */
  async updateSlot(slotId, updates) {
    const slots = this._get(STORAGE_KEYS.SLOTS) || [];
    const index = slots.findIndex(s => s.id === slotId);

    if (index === -1) {
      throw new Error(`Slot not found: ${slotId}`);
    }

    const updatedSlot = {
      ...slots[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    slots[index] = updatedSlot;
    this._set(STORAGE_KEYS.SLOTS, slots);
    return updatedSlot;
  }

  /**
   * Delete a slot
   *
   * TODO: Replace with API call:
   * DELETE /api/slots/:slotId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async deleteSlot(slotId) {
    const slots = this._get(STORAGE_KEYS.SLOTS) || [];
    const index = slots.findIndex(s => s.id === slotId);

    if (index === -1) {
      return false;
    }

    slots.splice(index, 1);
    this._set(STORAGE_KEYS.SLOTS, slots);
    return true;
  }

  /**
   * Query slots
   *
   * TODO: Replace with API call:
   * GET /api/slots?dateFrom=2024-01-01&dateTo=2024-01-07&slotType=work
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async querySlots(options = {}) {
    let slots = this._get(STORAGE_KEYS.SLOTS) || [];

    // Apply filters
    if (options.filters) {
      const { dateFrom, dateTo, slotType, assignedTaskId, sourceScheduleId } = options.filters;

      if (dateFrom && dateTo) {
        slots = getSlotsForDateRange(slots, dateFrom, dateTo);
      } else if (dateFrom) {
        slots = slots.filter(s => s.date >= dateFrom);
      } else if (dateTo) {
        slots = slots.filter(s => s.date <= dateTo);
      }

      if (slotType) {
        slots = slots.filter(s => s.slotType === slotType);
      }

      if (assignedTaskId !== undefined) {
        slots = slots.filter(s =>
          assignedTaskId === null ? !s.assignedTaskId : s.assignedTaskId === assignedTaskId
        );
      }

      if (sourceScheduleId) {
        slots = slots.filter(s => s.sourceScheduleId === sourceScheduleId);
      }
    }

    // Sort
    if (options.sortBy) {
      slots.sort((a, b) => {
        const aVal = a[options.sortBy];
        const bVal = b[options.sortBy];
        const order = options.sortOrder === 'desc' ? -1 : 1;

        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
        return 0;
      });
    } else {
      // Default sort by date and start time
      slots.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });
    }

    const total = slots.length;

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || slots.length;
    slots = slots.slice(offset, offset + limit);

    return {
      data: slots,
      total,
      hasMore: offset + slots.length < total
    };
  }

  /**
   * Get slots for a specific date
   *
   * TODO: Replace with API call:
   * GET /api/slots?date=2024-01-01
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getSlotsForDate(date) {
    const slots = this._get(STORAGE_KEYS.SLOTS) || [];
    return filterSlotsForDate(slots, date);
  }

  /**
   * Batch create slots
   *
   * TODO: Replace with API call:
   * POST /api/slots/batch
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: { slots }
   */
  async batchCreateSlots(slotsData) {
    const slots = this._get(STORAGE_KEYS.SLOTS) || [];
    const newSlots = slotsData.map(data => createCalendarSlot(data));
    slots.push(...newSlots);
    this._set(STORAGE_KEYS.SLOTS, slots);
    return newSlots;
  }

  /**
   * Clear slots for a date range
   *
   * TODO: Replace with API call:
   * DELETE /api/slots?dateFrom=...&dateTo=...&sourceScheduleId=...
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async clearSlots(dateFrom, dateTo, filters = {}) {
    const slots = this._get(STORAGE_KEYS.SLOTS) || [];

    const remainingSlots = slots.filter(slot => {
      // Keep if outside date range
      if (slot.date < dateFrom || slot.date > dateTo) return true;

      // Apply additional filters
      if (filters.sourceScheduleId && slot.sourceScheduleId !== filters.sourceScheduleId) {
        return true;
      }
      if (filters.slotType && slot.slotType !== filters.slotType) {
        return true;
      }

      return false;
    });

    const deletedCount = slots.length - remainingSlots.length;
    this._set(STORAGE_KEYS.SLOTS, remainingSlots);
    return deletedCount;
  }

  // ============================================
  // TAG OPERATIONS
  // ============================================

  /**
   * Create a tag
   *
   * TODO: Replace with API call:
   * POST /api/tags
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: tag
   */
  async createTag(tagData) {
    const tags = this._get(STORAGE_KEYS.TAGS) || [];
    const tag = createTag(tagData);
    tags.push(tag);
    this._set(STORAGE_KEYS.TAGS, tags);
    return tag;
  }

  /**
   * Get all tags
   *
   * TODO: Replace with API call:
   * GET /api/tags
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getTags() {
    const tags = this._get(STORAGE_KEYS.TAGS) || [];
    return mergeWithDefaultTags(tags.filter(t => !t.isSystem));
  }

  /**
   * Update a tag
   *
   * TODO: Replace with API call:
   * PUT /api/tags/:tagId
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: updates
   */
  async updateTag(tagId, updates) {
    const tags = this._get(STORAGE_KEYS.TAGS) || [];
    const index = tags.findIndex(t => t.id === tagId);

    if (index === -1) {
      throw new Error(`Tag not found: ${tagId}`);
    }

    // Don't allow modifying system tags
    if (tags[index].isSystem) {
      throw new Error('Cannot modify system tags');
    }

    const updatedTag = {
      ...tags[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    tags[index] = updatedTag;
    this._set(STORAGE_KEYS.TAGS, tags);
    return updatedTag;
  }

  /**
   * Delete a tag
   *
   * TODO: Replace with API call:
   * DELETE /api/tags/:tagId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async deleteTag(tagId) {
    const tags = this._get(STORAGE_KEYS.TAGS) || [];
    const tag = tags.find(t => t.id === tagId);

    if (!tag) {
      return false;
    }

    // Don't allow deleting system tags
    if (tag.isSystem) {
      throw new Error('Cannot delete system tags');
    }

    const newTags = tags.filter(t => t.id !== tagId);
    this._set(STORAGE_KEYS.TAGS, newTags);
    return true;
  }

  // ============================================
  // TASK TYPE OPERATIONS
  // ============================================

  /**
   * Create a task type
   *
   * TODO: Replace with API call:
   * POST /api/task-types
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: type
   */
  async createTaskType(typeData) {
    const types = this._get(STORAGE_KEYS.TYPES) || [];
    const type = createTaskType(typeData);
    types.push(type);
    this._set(STORAGE_KEYS.TYPES, types);
    return type;
  }

  /**
   * Get all task types
   *
   * TODO: Replace with API call:
   * GET /api/task-types
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getTaskTypes() {
    const types = this._get(STORAGE_KEYS.TYPES) || [];
    return mergeWithDefaultTypes(types.filter(t => !t.isSystem));
  }

  /**
   * Update a task type
   *
   * TODO: Replace with API call:
   * PUT /api/task-types/:typeId
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: updates
   */
  async updateTaskType(typeId, updates) {
    const types = this._get(STORAGE_KEYS.TYPES) || [];
    const index = types.findIndex(t => t.id === typeId);

    if (index === -1) {
      throw new Error(`Task type not found: ${typeId}`);
    }

    const updatedType = {
      ...types[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    types[index] = updatedType;
    this._set(STORAGE_KEYS.TYPES, types);
    return updatedType;
  }

  /**
   * Delete a task type
   *
   * TODO: Replace with API call:
   * DELETE /api/task-types/:typeId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async deleteTaskType(typeId) {
    const types = this._get(STORAGE_KEYS.TYPES) || [];
    const type = types.find(t => t.id === typeId);

    if (!type) {
      return false;
    }

    // Don't allow deleting the default type
    if (typeId === 'default' || type.isSystem) {
      throw new Error('Cannot delete system types');
    }

    const newTypes = types.filter(t => t.id !== typeId);
    this._set(STORAGE_KEYS.TYPES, newTypes);
    return true;
  }

  // ============================================
  // SCHEDULE OPERATIONS
  // ============================================

  /**
   * Create a schedule
   *
   * TODO: Replace with API call:
   * POST /api/schedules
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: schedule
   */
  async createSchedule(scheduleData) {
    const schedules = this._get(STORAGE_KEYS.SCHEDULES) || [];
    const schedule = createSchedule({ ...scheduleData, isCustom: true });
    schedules.push(schedule);
    this._set(STORAGE_KEYS.SCHEDULES, schedules);
    return schedule;
  }

  /**
   * Get a schedule by ID
   *
   * TODO: Replace with API call:
   * GET /api/schedules/:scheduleId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getSchedule(scheduleId) {
    // Check famous schedules first
    const famousSchedule = FAMOUS_SCHEDULES.find(s => s.id === scheduleId);
    if (famousSchedule) {
      return createSchedule({ ...famousSchedule, isFamous: true, isCustom: false });
    }

    // Check custom schedules
    const schedules = this._get(STORAGE_KEYS.SCHEDULES) || [];
    return schedules.find(s => s.id === scheduleId) || null;
  }

  /**
   * Get all schedules
   *
   * TODO: Replace with API call:
   * GET /api/schedules?isPublic=true&isFamous=true
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getSchedules(filters = {}) {
    let schedules = [];

    // Include famous schedules unless filtered out
    if (filters.isFamous !== false) {
      const famous = FAMOUS_SCHEDULES.map(s =>
        createSchedule({ ...s, isFamous: true, isCustom: false })
      );
      schedules.push(...famous);
    }

    // Include custom schedules
    if (filters.isCustom !== false) {
      const custom = this._get(STORAGE_KEYS.SCHEDULES) || [];
      schedules.push(...custom);
    }

    // Apply additional filters
    if (filters.author) {
      schedules = schedules.filter(s => s.author === filters.author);
    }
    if (filters.tags && filters.tags.length > 0) {
      schedules = schedules.filter(s =>
        filters.tags.some(tag => s.tags.includes(tag))
      );
    }
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      schedules = schedules.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.description.toLowerCase().includes(search) ||
        s.author.toLowerCase().includes(search)
      );
    }

    return schedules;
  }

  /**
   * Update a schedule
   *
   * TODO: Replace with API call:
   * PUT /api/schedules/:scheduleId
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: updates
   */
  async updateSchedule(scheduleId, updates) {
    const schedules = this._get(STORAGE_KEYS.SCHEDULES) || [];
    const index = schedules.findIndex(s => s.id === scheduleId);

    if (index === -1) {
      // Can't update famous schedules
      if (FAMOUS_SCHEDULES.find(s => s.id === scheduleId)) {
        throw new Error('Cannot modify famous schedules. Clone it first.');
      }
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    const updatedSchedule = {
      ...schedules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    schedules[index] = updatedSchedule;
    this._set(STORAGE_KEYS.SCHEDULES, schedules);
    return updatedSchedule;
  }

  /**
   * Delete a schedule
   *
   * TODO: Replace with API call:
   * DELETE /api/schedules/:scheduleId
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async deleteSchedule(scheduleId) {
    // Can't delete famous schedules
    if (FAMOUS_SCHEDULES.find(s => s.id === scheduleId)) {
      throw new Error('Cannot delete famous schedules');
    }

    const schedules = this._get(STORAGE_KEYS.SCHEDULES) || [];
    const index = schedules.findIndex(s => s.id === scheduleId);

    if (index === -1) {
      return false;
    }

    schedules.splice(index, 1);
    this._set(STORAGE_KEYS.SCHEDULES, schedules);

    // Clear active schedule if it was deleted
    const activeId = this._get(STORAGE_KEYS.ACTIVE_SCHEDULE);
    if (activeId === scheduleId) {
      this._remove(STORAGE_KEYS.ACTIVE_SCHEDULE);
    }

    return true;
  }

  /**
   * Get the active schedule
   *
   * TODO: Replace with API call:
   * GET /api/schedules/active
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getActiveSchedule() {
    const activeId = this._get(STORAGE_KEYS.ACTIVE_SCHEDULE);
    if (!activeId) return null;
    return this.getSchedule(activeId);
  }

  /**
   * Set the active schedule
   *
   * TODO: Replace with API call:
   * PUT /api/schedules/active
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: { scheduleId }
   */
  async setActiveSchedule(scheduleId) {
    if (scheduleId) {
      this._set(STORAGE_KEYS.ACTIVE_SCHEDULE, scheduleId);
    } else {
      this._remove(STORAGE_KEYS.ACTIVE_SCHEDULE);
    }
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  /**
   * Create an audit entry
   *
   * TODO: Replace with API call:
   * POST /api/audit
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: entry
   */
  async createAuditEntry(entryData) {
    const entries = this._get(STORAGE_KEYS.AUDIT) || [];
    const entry = createAuditEntry(entryData);
    entries.push(entry);

    // Keep audit log to reasonable size (last 10000 entries)
    const maxEntries = 10000;
    if (entries.length > maxEntries) {
      entries.splice(0, entries.length - maxEntries);
    }

    this._set(STORAGE_KEYS.AUDIT, entries);
    return entry;
  }

  /**
   * Query audit entries
   *
   * TODO: Replace with API call:
   * GET /api/audit?entityType=task&dateFrom=...&limit=100
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async queryAuditEntries(options = {}) {
    let entries = this._get(STORAGE_KEYS.AUDIT) || [];

    // Apply filters
    if (options.filters) {
      entries = filterAuditEntries(entries, options.filters);
    }

    // Sort (default: newest first)
    entries.sort((a, b) => {
      const order = options.sortOrder === 'asc' ? 1 : -1;
      return order * (new Date(b.timestamp) - new Date(a.timestamp));
    });

    const total = entries.length;

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    entries = entries.slice(offset, offset + limit);

    return {
      data: entries,
      total,
      hasMore: offset + entries.length < total
    };
  }

  /**
   * Get audit entries for an entity
   *
   * TODO: Replace with API call:
   * GET /api/audit?entityType=task&entityId=123
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getAuditForEntity(entityType, entityId) {
    const entries = this._get(STORAGE_KEYS.AUDIT) || [];
    return entries.filter(e =>
      e.entityType === entityType && e.entityId === entityId
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Batch create audit entries
   *
   * TODO: Replace with API call:
   * POST /api/audit/batch
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: { entries }
   */
  async batchCreateAuditEntries(entriesData) {
    const entries = this._get(STORAGE_KEYS.AUDIT) || [];
    const newEntries = entriesData.map(data => createAuditEntry(data));
    entries.push(...newEntries);

    // Keep audit log to reasonable size
    const maxEntries = 10000;
    if (entries.length > maxEntries) {
      entries.splice(0, entries.length - maxEntries);
    }

    this._set(STORAGE_KEYS.AUDIT, entries);
    return newEntries;
  }

  // ============================================
  // SETTINGS & STATE OPERATIONS
  // ============================================

  /**
   * Get a setting value
   *
   * TODO: Replace with API call:
   * GET /api/settings/:key
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getSetting(key, defaultValue = null) {
    const settings = this._get(STORAGE_KEYS.SETTINGS) || {};
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  /**
   * Set a setting value
   *
   * TODO: Replace with API call:
   * PUT /api/settings/:key
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: { value }
   */
  async setSetting(key, value) {
    const settings = this._get(STORAGE_KEYS.SETTINGS) || {};
    settings[key] = value;
    this._set(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Get the full application state
   *
   * TODO: Replace with API call:
   * GET /api/state
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getState() {
    return {
      tasks: this._get(STORAGE_KEYS.TASKS) || [],
      slots: this._get(STORAGE_KEYS.SLOTS) || [],
      tags: await this.getTags(),
      taskTypes: await this.getTaskTypes(),
      schedules: await this.getSchedules({ isCustom: true }),
      activeScheduleId: this._get(STORAGE_KEYS.ACTIVE_SCHEDULE),
      settings: this._get(STORAGE_KEYS.SETTINGS) || {},
      // Legacy state compatibility
      items: this._get(STORAGE_KEYS.TASKS) || []
    };
  }

  /**
   * Save the full application state
   *
   * TODO: Replace with API call:
   * PUT /api/state
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: state
   */
  async saveState(state) {
    if (state.tasks) this._set(STORAGE_KEYS.TASKS, state.tasks);
    if (state.slots) this._set(STORAGE_KEYS.SLOTS, state.slots);
    if (state.tags) this._set(STORAGE_KEYS.TAGS, state.tags);
    if (state.taskTypes) this._set(STORAGE_KEYS.TYPES, state.taskTypes);
    if (state.schedules) this._set(STORAGE_KEYS.SCHEDULES, state.schedules);
    if (state.activeScheduleId !== undefined) {
      if (state.activeScheduleId) {
        this._set(STORAGE_KEYS.ACTIVE_SCHEDULE, state.activeScheduleId);
      } else {
        this._remove(STORAGE_KEYS.ACTIVE_SCHEDULE);
      }
    }
    if (state.settings) this._set(STORAGE_KEYS.SETTINGS, state.settings);

    // Legacy compatibility - also update 'state' key
    if (state.items) {
      const legacyState = this._get(STORAGE_KEYS.LEGACY_STATE) || {};
      this._set(STORAGE_KEYS.LEGACY_STATE, { ...legacyState, items: state.items });
    }
  }

  // ============================================
  // SYNC OPERATIONS (placeholders for future)
  // ============================================

  /**
   * Sync local changes to remote
   *
   * TODO: Replace with API call:
   * POST /api/sync/push
   * Headers: { Authorization: `Bearer ${token}` }
   * Body: changes
   */
  async syncPush(changes) {
    // LocalStorage doesn't sync - this is a no-op
    // In a real implementation, this would push to the API
    console.log('[LocalStorageAdapter] syncPush not implemented (localStorage is local-only)');
    return { success: true, message: 'Local storage does not sync' };
  }

  /**
   * Pull remote changes to local
   *
   * TODO: Replace with API call:
   * GET /api/sync/pull?since=2024-01-01T00:00:00Z
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async syncPull(since) {
    // LocalStorage doesn't sync - this is a no-op
    console.log('[LocalStorageAdapter] syncPull not implemented (localStorage is local-only)');
    return { changes: [], lastSync: new Date().toISOString() };
  }

  /**
   * Get sync status
   *
   * TODO: Replace with API call:
   * GET /api/sync/status
   * Headers: { Authorization: `Bearer ${token}` }
   */
  async getSyncStatus() {
    return {
      isOnline: true,
      lastSync: null,
      pendingChanges: 0,
      syncEnabled: false
    };
  }

  // ============================================
  // UTILITY OPERATIONS
  // ============================================

  async clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      this._remove(key);
    });
    this.isInitialized = false;
  }

  async exportData() {
    return {
      version: CURRENT_MODEL_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: this._get(STORAGE_KEYS.TASKS) || [],
      slots: this._get(STORAGE_KEYS.SLOTS) || [],
      tags: this._get(STORAGE_KEYS.TAGS) || [],
      taskTypes: this._get(STORAGE_KEYS.TYPES) || [],
      schedules: this._get(STORAGE_KEYS.SCHEDULES) || [],
      audit: this._get(STORAGE_KEYS.AUDIT) || [],
      settings: this._get(STORAGE_KEYS.SETTINGS) || {},
      activeScheduleId: this._get(STORAGE_KEYS.ACTIVE_SCHEDULE)
    };
  }

  async importData(data, options = {}) {
    const { merge = true, clearExisting = false } = options;

    if (clearExisting) {
      await this.clearAll();
    }

    const results = { imported: 0, skipped: 0, errors: [] };

    try {
      if (merge) {
        // Merge with existing data
        if (data.tasks) {
          const existing = this._get(STORAGE_KEYS.TASKS) || [];
          const existingIds = new Set(existing.map(t => t.id));
          const newTasks = data.tasks.filter(t => !existingIds.has(t.id));
          this._set(STORAGE_KEYS.TASKS, [...existing, ...newTasks]);
          results.imported += newTasks.length;
          results.skipped += data.tasks.length - newTasks.length;
        }
        // Similar for other entities...
      } else {
        // Replace all data
        if (data.tasks) this._set(STORAGE_KEYS.TASKS, data.tasks);
        if (data.slots) this._set(STORAGE_KEYS.SLOTS, data.slots);
        if (data.tags) this._set(STORAGE_KEYS.TAGS, data.tags);
        if (data.taskTypes) this._set(STORAGE_KEYS.TYPES, data.taskTypes);
        if (data.schedules) this._set(STORAGE_KEYS.SCHEDULES, data.schedules);
        if (data.settings) this._set(STORAGE_KEYS.SETTINGS, data.settings);
        if (data.activeScheduleId) this._set(STORAGE_KEYS.ACTIVE_SCHEDULE, data.activeScheduleId);

        results.imported = Object.keys(data).length;
      }

      this._set(STORAGE_KEYS.MODEL_VERSION, CURRENT_MODEL_VERSION);
    } catch (error) {
      results.errors.push(error.message);
    }

    return results;
  }

  async getStats() {
    return {
      tasks: (this._get(STORAGE_KEYS.TASKS) || []).length,
      slots: (this._get(STORAGE_KEYS.SLOTS) || []).length,
      tags: (this._get(STORAGE_KEYS.TAGS) || []).length,
      taskTypes: (this._get(STORAGE_KEYS.TYPES) || []).length,
      customSchedules: (this._get(STORAGE_KEYS.SCHEDULES) || []).length,
      auditEntries: (this._get(STORAGE_KEYS.AUDIT) || []).length,
      storageUsed: this._estimateStorageUsed()
    };
  }

  _estimateStorageUsed() {
    let total = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const value = this.storage.getItem(key);
      if (value) {
        total += key.length + value.length;
      }
    });
    return total;
  }
}

export default LocalStorageAdapter;
