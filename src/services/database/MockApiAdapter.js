/**
 * MockApiAdapter
 *
 * A mock implementation that simulates API calls for development/testing.
 * This helps test the adapter interface before building the real API.
 *
 * TODO: This is a placeholder for the real ApiAdapter that will:
 * 1. Make actual HTTP requests to /api/* endpoints
 * 2. Handle authentication tokens
 * 3. Implement retry logic and error handling
 * 4. Add request caching and offline support
 *
 * Real API Implementation Example:
 *
 * ```javascript
 * async createTask(task) {
 *   const response = await fetch('/api/tasks', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': `Bearer ${this.authToken}`
 *     },
 *     body: JSON.stringify(task)
 *   });
 *
 *   if (!response.ok) {
 *     throw new ApiError(response.status, await response.text());
 *   }
 *
 *   return response.json();
 * }
 * ```
 */

import { LocalStorageAdapter } from './LocalStorageAdapter';

// Simulated network delay
const MOCK_DELAY = 100;

export class MockApiAdapter extends LocalStorageAdapter {
  constructor(options = {}) {
    super(options);
    this.mockDelay = options.mockDelay || MOCK_DELAY;
    this.authToken = options.authToken || null;
    this.userId = options.userId || null;
    this.baseUrl = options.baseUrl || '/api';
  }

  /**
   * Simulate network delay
   * @private
   */
  async _simulateNetwork() {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
  }

  /**
   * Log mock API calls for debugging
   * @private
   */
  _logApiCall(method, endpoint, body = null) {
    console.log(`[MockApiAdapter] ${method} ${this.baseUrl}${endpoint}`, body || '');
  }

  // Override methods to add mock API behavior

  async createTask(task) {
    this._logApiCall('POST', '/tasks', task);
    await this._simulateNetwork();

    // TODO: Real implementation would be:
    // const response = await fetch(`${this.baseUrl}/tasks`, {
    //   method: 'POST',
    //   headers: this._getHeaders(),
    //   body: JSON.stringify(task)
    // });
    // return response.json();

    return super.createTask({ ...task, userId: this.userId });
  }

  async getTask(taskId) {
    this._logApiCall('GET', `/tasks/${taskId}`);
    await this._simulateNetwork();
    return super.getTask(taskId);
  }

  async updateTask(taskId, updates) {
    this._logApiCall('PUT', `/tasks/${taskId}`, updates);
    await this._simulateNetwork();
    return super.updateTask(taskId, updates);
  }

  async deleteTask(taskId) {
    this._logApiCall('DELETE', `/tasks/${taskId}`);
    await this._simulateNetwork();
    return super.deleteTask(taskId);
  }

  async queryTasks(options) {
    const queryString = new URLSearchParams(options.filters || {}).toString();
    this._logApiCall('GET', `/tasks?${queryString}`);
    await this._simulateNetwork();
    return super.queryTasks(options);
  }

  async createSlot(slot) {
    this._logApiCall('POST', '/slots', slot);
    await this._simulateNetwork();
    return super.createSlot({ ...slot, userId: this.userId });
  }

  async getSchedules(filters) {
    const queryString = new URLSearchParams(filters || {}).toString();
    this._logApiCall('GET', `/schedules?${queryString}`);
    await this._simulateNetwork();
    return super.getSchedules(filters);
  }

  async createAuditEntry(entry) {
    this._logApiCall('POST', '/audit', entry);
    await this._simulateNetwork();
    return super.createAuditEntry({ ...entry, userId: this.userId });
  }

  // Sync operations would actually communicate with server

  async syncPush(changes) {
    this._logApiCall('POST', '/sync/push', changes);
    await this._simulateNetwork();

    // Mock successful sync
    return {
      success: true,
      syncedAt: new Date().toISOString(),
      serverChanges: []
    };
  }

  async syncPull(since) {
    this._logApiCall('GET', `/sync/pull?since=${since}`);
    await this._simulateNetwork();

    // Mock no changes
    return {
      changes: [],
      lastSync: new Date().toISOString()
    };
  }

  async getSyncStatus() {
    this._logApiCall('GET', '/sync/status');
    await this._simulateNetwork();

    return {
      isOnline: true,
      lastSync: new Date().toISOString(),
      pendingChanges: 0,
      syncEnabled: true
    };
  }

  /**
   * Helper to get auth headers
   * @private
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Set user ID
   */
  setUserId(userId) {
    this.userId = userId;
  }
}

export default MockApiAdapter;
