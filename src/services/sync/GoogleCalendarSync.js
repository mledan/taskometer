/**
 * Google Calendar Sync Service
 *
 * Two-way sync between Taskometer and Google Calendar.
 * Creates a dedicated "Taskometer" calendar for synced tasks.
 *
 * TODO: Complete implementation when Google OAuth is configured
 *
 * Required scopes:
 * - https://www.googleapis.com/auth/calendar
 * - https://www.googleapis.com/auth/calendar.events
 */

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TASKOMETER_CALENDAR_NAME = 'Taskometer';
const TASKOMETER_CALENDAR_COLOR = '#62DCA5'; // Green from app theme

/**
 * GoogleCalendarSync class
 * Handles all Google Calendar API interactions
 */
class GoogleCalendarSync {
  constructor() {
    this.accessToken = null;
    this.taskometerId = null; // ID of our dedicated calendar
    this.syncToken = null; // For incremental sync
  }

  /**
   * Initialize the sync service with access token
   * @param {string} accessToken
   */
  initialize(accessToken) {
    this.accessToken = accessToken;
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async apiRequest(endpoint, options = {}) {
    if (!this.accessToken) {
      throw new Error('Google Calendar sync not initialized. Please log in first.');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${GOOGLE_CALENDAR_API}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Find or create the Taskometer calendar
   * @returns {Promise<string>} Calendar ID
   */
  async getOrCreateTaskometerCalendar() {
    // Check if we already have the calendar ID cached
    if (this.taskometerId) {
      return this.taskometerId;
    }

    // List all calendars to find Taskometer
    const calendars = await this.apiRequest('/users/me/calendarList');

    const existing = calendars.items?.find(cal =>
      cal.summary === TASKOMETER_CALENDAR_NAME
    );

    if (existing) {
      this.taskometerId = existing.id;
      return existing.id;
    }

    // Create new Taskometer calendar
    const newCalendar = await this.apiRequest('/calendars', {
      method: 'POST',
      body: JSON.stringify({
        summary: TASKOMETER_CALENDAR_NAME,
        description: 'Tasks synced from Taskometer app',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });

    // Set calendar color
    await this.apiRequest(`/users/me/calendarList/${newCalendar.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        colorId: '11' // Corresponds to a green color
      })
    });

    this.taskometerId = newCalendar.id;
    return newCalendar.id;
  }

  /**
   * Convert a Taskometer task to Google Calendar event
   * @param {Object} task
   * @returns {Object} Google Calendar event format
   */
  taskToEvent(task) {
    const start = new Date(task.scheduledTime);
    const end = new Date(start.getTime() + (task.duration || 30) * 60000);

    return {
      summary: task.text,
      description: [
        task.description,
        `Type: ${task.taskType || task.primaryType || 'task'}`,
        task.tags?.length ? `Tags: ${task.tags.join(', ')}` : null,
        `Priority: ${task.priority || 'medium'}`,
        `Status: ${task.status || 'pending'}`,
        '---',
        `Taskometer ID: ${task.id || task.key}`
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      colorId: getColorIdForType(task.taskType || task.primaryType),
      extendedProperties: {
        private: {
          taskometerId: task.id || task.key,
          taskType: task.taskType || task.primaryType,
          priority: task.priority || 'medium',
          status: task.status || 'pending'
        }
      }
    };
  }

  /**
   * Convert a Google Calendar event to Taskometer task format
   * @param {Object} event
   * @returns {Object} Taskometer task format
   */
  eventToTask(event) {
    const taskometerId = event.extendedProperties?.private?.taskometerId;
    const start = new Date(event.start.dateTime || event.start.date);
    const end = new Date(event.end.dateTime || event.end.date);
    const duration = Math.round((end - start) / 60000);

    return {
      id: taskometerId,
      googleEventId: event.id,
      text: event.summary,
      description: event.description?.split('---')[0]?.trim(),
      scheduledTime: start.toISOString(),
      duration,
      taskType: event.extendedProperties?.private?.taskType || 'work',
      priority: event.extendedProperties?.private?.priority || 'medium',
      status: event.extendedProperties?.private?.status || 'pending',
      syncedAt: new Date().toISOString()
    };
  }

  /**
   * Push a task to Google Calendar
   * @param {Object} task
   * @returns {Promise<Object>} Created/updated event
   */
  async pushTask(task) {
    const calendarId = await this.getOrCreateTaskometerCalendar();
    const eventData = this.taskToEvent(task);

    // If task has a googleEventId, update existing event
    if (task.googleEventId) {
      return this.apiRequest(
        `/calendars/${encodeURIComponent(calendarId)}/events/${task.googleEventId}`,
        {
          method: 'PUT',
          body: JSON.stringify(eventData)
        }
      );
    }

    // Otherwise create new event
    return this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify(eventData)
      }
    );
  }

  /**
   * Push multiple tasks to Google Calendar
   * @param {Object[]} tasks
   * @returns {Promise<Object[]>} Results
   */
  async pushTasks(tasks) {
    const results = [];
    for (const task of tasks) {
      try {
        if (task.scheduledTime) {
          const result = await this.pushTask(task);
          results.push({ task, event: result, success: true });
        }
      } catch (error) {
        results.push({ task, error: error.message, success: false });
      }
    }
    return results;
  }

  /**
   * Pull events from Google Calendar
   * @param {string} timeMin - ISO date string
   * @param {string} timeMax - ISO date string
   * @returns {Promise<Object[]>} Events as task format
   */
  async pullEvents(timeMin, timeMax) {
    const calendarId = await this.getOrCreateTaskometerCalendar();

    const params = new URLSearchParams({
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    // Add sync token for incremental sync if available
    if (this.syncToken) {
      params.set('syncToken', this.syncToken);
    }

    const response = await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );

    // Save sync token for next incremental sync
    if (response.nextSyncToken) {
      this.syncToken = response.nextSyncToken;
    }

    return (response.items || [])
      .filter(event => !event.status || event.status !== 'cancelled')
      .map(event => this.eventToTask(event));
  }

  /**
   * Delete an event from Google Calendar
   * @param {string} eventId
   */
  async deleteEvent(eventId) {
    const calendarId = await this.getOrCreateTaskometerCalendar();

    await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Perform full two-way sync
   * @param {Object[]} localTasks - Local tasks to sync
   * @param {string} timeMin - Sync window start
   * @param {string} timeMax - Sync window end
   * @returns {Promise<Object>} Sync results
   */
  async fullSync(localTasks, timeMin, timeMax) {
    const results = {
      pushed: [],
      pulled: [],
      conflicts: [],
      errors: []
    };

    try {
      // 1. Pull remote events
      const remoteEvents = await this.pullEvents(timeMin, timeMax);

      // 2. Build maps for comparison
      const localByGoogleId = new Map();
      const localByTaskId = new Map();
      localTasks.forEach(task => {
        if (task.googleEventId) localByGoogleId.set(task.googleEventId, task);
        localByTaskId.set(task.id || task.key, task);
      });

      const remoteByTaskId = new Map();
      remoteEvents.forEach(event => {
        if (event.id) remoteByTaskId.set(event.id, event);
      });

      // 3. Process remote events (pull)
      for (const remoteTask of remoteEvents) {
        const localTask = remoteTask.googleEventId
          ? localByGoogleId.get(remoteTask.googleEventId)
          : localByTaskId.get(remoteTask.id);

        if (!localTask) {
          // New event from remote - pull it
          results.pulled.push(remoteTask);
        } else {
          // Exists locally - check for conflicts
          const localUpdate = new Date(localTask.updatedAt || localTask.scheduledTime);
          const remoteUpdate = new Date(remoteTask.syncedAt);

          if (remoteUpdate > localUpdate) {
            // Remote is newer - pull
            results.pulled.push({ ...remoteTask, id: localTask.id || localTask.key });
          }
        }
      }

      // 4. Process local tasks (push)
      for (const task of localTasks) {
        if (!task.scheduledTime) continue;

        const existsRemote = task.googleEventId && remoteByTaskId.has(task.googleEventId);

        if (!existsRemote && task.scheduledTime) {
          // Not synced yet - push
          const result = await this.pushTask(task);
          results.pushed.push({ task, googleEventId: result.id });
        }
      }

    } catch (error) {
      results.errors.push(error.message);
    }

    return results;
  }

  /**
   * Clear cached data (for logout)
   */
  clear() {
    this.accessToken = null;
    this.taskometerId = null;
    this.syncToken = null;
  }
}

/**
 * Get Google Calendar color ID for task type
 * Colors: https://developers.google.com/calendar/api/v3/reference/colors
 */
function getColorIdForType(type) {
  const colorMap = {
    work: '9',       // Blue
    exercise: '10',  // Green
    creative: '6',   // Orange
    learning: '1',   // Lavender
    personal: '11',  // Red
    sleep: '8',      // Gray
    buffer: '2',     // Sage
    meals: '5',      // Yellow
    planning: '7',   // Cyan
    mindfulness: '3', // Purple
    chores: '4',     // Pink
    social: '11'     // Flamingo
  };
  return colorMap[type] || '0'; // Default calendar color
}

// Export singleton instance
export const googleCalendarSync = new GoogleCalendarSync();

export default googleCalendarSync;
