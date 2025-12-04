/**
 * Apple Calendar Sync Service
 *
 * Two-way sync between Taskometer and Apple Calendar via iCloud.
 * Creates a dedicated "Taskometer" calendar for synced tasks.
 *
 * TODO: Complete implementation when Apple Sign-In is configured
 *
 * Note: Apple Calendar sync is more complex than Google because:
 * 1. CalDAV protocol is used instead of REST API
 * 2. Requires server-side proxy for authentication
 * 3. Apple doesn't provide a direct web API like Google
 *
 * Alternative approaches:
 * - Use CloudKit for direct iCloud access (requires native app)
 * - Use a CalDAV library (e.g., tsdav)
 * - Use a backend service to handle CalDAV communication
 */

// CalDAV endpoints for iCloud
const CALDAV_BASE = 'https://caldav.icloud.com';
const TASKOMETER_CALENDAR_NAME = 'Taskometer';

/**
 * AppleCalendarSync class
 * Handles Apple Calendar / iCloud Calendar sync
 */
class AppleCalendarSync {
  constructor() {
    this.credentials = null;
    this.principalUrl = null;
    this.taskometerId = null;
    this.syncToken = null;
  }

  /**
   * Initialize with Apple credentials
   * @param {Object} credentials - Apple ID credentials or app-specific password
   */
  initialize(credentials) {
    this.credentials = credentials;
    // Note: Direct CalDAV access requires either:
    // 1. App-specific password (two-factor auth accounts)
    // 2. Backend proxy to handle OAuth
  }

  /**
   * Check if Apple Calendar sync is available
   * Returns false until properly configured
   */
  isAvailable() {
    // TODO: Check if CalDAV credentials or backend proxy is configured
    return false;
  }

  /**
   * Get or create the Taskometer calendar
   * @returns {Promise<string>} Calendar ID/URL
   */
  async getOrCreateTaskometerCalendar() {
    if (this.taskometerId) {
      return this.taskometerId;
    }

    // TODO: Implement CalDAV PROPFIND to list calendars
    // TODO: Create calendar if not exists using MKCALENDAR

    throw new Error(
      'Apple Calendar sync not configured. ' +
      'This feature requires additional backend setup for CalDAV authentication.'
    );
  }

  /**
   * Convert a Taskometer task to iCalendar (ICS) format
   * @param {Object} task
   * @returns {string} ICS formatted event
   */
  taskToICS(task) {
    const start = new Date(task.scheduledTime);
    const end = new Date(start.getTime() + (task.duration || 30) * 60000);

    const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const uid = `taskometer-${task.id || task.key}@taskometer.app`;
    const now = formatDate(new Date());

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Taskometer//Taskometer App//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${escapeICS(task.text)}`,
      task.description ? `DESCRIPTION:${escapeICS(task.description)}` : '',
      `CATEGORIES:${task.taskType || task.primaryType || 'task'}`,
      `PRIORITY:${getPriorityNumber(task.priority)}`,
      `STATUS:${getICSStatus(task.status)}`,
      `X-TASKOMETER-ID:${task.id || task.key}`,
      `X-TASKOMETER-TYPE:${task.taskType || task.primaryType}`,
      `X-TASKOMETER-PRIORITY:${task.priority || 'medium'}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
  }

  /**
   * Parse ICS event to Taskometer task format
   * @param {string} ics
   * @returns {Object} Taskometer task format
   */
  parseICS(ics) {
    const lines = ics.split(/\r?\n/);
    const event = {};

    for (const line of lines) {
      if (line.startsWith('UID:')) {
        event.uid = line.substring(4);
      } else if (line.startsWith('DTSTART')) {
        event.start = parseICSDate(line);
      } else if (line.startsWith('DTEND')) {
        event.end = parseICSDate(line);
      } else if (line.startsWith('SUMMARY:')) {
        event.summary = unescapeICS(line.substring(8));
      } else if (line.startsWith('DESCRIPTION:')) {
        event.description = unescapeICS(line.substring(12));
      } else if (line.startsWith('X-TASKOMETER-ID:')) {
        event.taskometerId = line.substring(16);
      } else if (line.startsWith('X-TASKOMETER-TYPE:')) {
        event.taskType = line.substring(18);
      } else if (line.startsWith('X-TASKOMETER-PRIORITY:')) {
        event.priority = line.substring(22);
      }
    }

    if (!event.start || !event.summary) {
      return null;
    }

    const duration = event.end
      ? Math.round((new Date(event.end) - new Date(event.start)) / 60000)
      : 30;

    return {
      id: event.taskometerId,
      appleEventId: event.uid,
      text: event.summary,
      description: event.description,
      scheduledTime: event.start.toISOString(),
      duration,
      taskType: event.taskType || 'work',
      priority: event.priority || 'medium',
      status: 'pending',
      syncedAt: new Date().toISOString()
    };
  }

  /**
   * Push a task to Apple Calendar
   * @param {Object} task
   * @returns {Promise<Object>}
   */
  async pushTask(task) {
    const calendarUrl = await this.getOrCreateTaskometerCalendar();
    const ics = this.taskToICS(task);
    const eventUrl = `${calendarUrl}${task.id || task.key}.ics`;

    // TODO: Make CalDAV PUT request to create/update event
    // await this.caldavRequest(eventUrl, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'text/calendar' },
    //   body: ics
    // });

    throw new Error('Apple Calendar push not implemented');
  }

  /**
   * Push multiple tasks to Apple Calendar
   * @param {Object[]} tasks
   * @returns {Promise<Object[]>}
   */
  async pushTasks(tasks) {
    const results = [];
    for (const task of tasks) {
      try {
        if (task.scheduledTime) {
          await this.pushTask(task);
          results.push({ task, success: true });
        }
      } catch (error) {
        results.push({ task, error: error.message, success: false });
      }
    }
    return results;
  }

  /**
   * Pull events from Apple Calendar
   * @param {string} timeMin
   * @param {string} timeMax
   * @returns {Promise<Object[]>}
   */
  async pullEvents(timeMin, timeMax) {
    // TODO: Implement CalDAV REPORT request to get events in range

    throw new Error('Apple Calendar pull not implemented');
  }

  /**
   * Delete an event from Apple Calendar
   * @param {string} eventId
   */
  async deleteEvent(eventId) {
    const calendarUrl = await this.getOrCreateTaskometerCalendar();
    const eventUrl = `${calendarUrl}${eventId}.ics`;

    // TODO: Make CalDAV DELETE request
    // await this.caldavRequest(eventUrl, { method: 'DELETE' });

    throw new Error('Apple Calendar delete not implemented');
  }

  /**
   * Perform full two-way sync
   * @param {Object[]} localTasks
   * @param {string} timeMin
   * @param {string} timeMax
   * @returns {Promise<Object>}
   */
  async fullSync(localTasks, timeMin, timeMax) {
    if (!this.isAvailable()) {
      return {
        pushed: [],
        pulled: [],
        conflicts: [],
        errors: ['Apple Calendar sync is not configured']
      };
    }

    // Similar logic to Google sync
    // 1. Pull remote events
    // 2. Compare with local
    // 3. Push new/updated local tasks
    // 4. Return results

    throw new Error('Apple Calendar sync not implemented');
  }

  /**
   * Clear cached data
   */
  clear() {
    this.credentials = null;
    this.principalUrl = null;
    this.taskometerId = null;
    this.syncToken = null;
  }
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Unescape ICS special characters
 */
function unescapeICS(text) {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Parse ICS date format
 */
function parseICSDate(line) {
  const match = line.match(/(\d{8}T\d{6}Z?)/);
  if (!match) return null;

  const dateStr = match[1];
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(9, 11);
  const minute = dateStr.substring(11, 13);
  const second = dateStr.substring(13, 15);

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

/**
 * Convert priority to ICS priority number (1-9, 1 is highest)
 */
function getPriorityNumber(priority) {
  const map = { urgent: 1, high: 3, medium: 5, low: 7 };
  return map[priority] || 5;
}

/**
 * Convert status to ICS status
 */
function getICSStatus(status) {
  const map = {
    pending: 'NEEDS-ACTION',
    'in-progress': 'IN-PROCESS',
    completed: 'COMPLETED',
    paused: 'CANCELLED'
  };
  return map[status] || 'NEEDS-ACTION';
}

// Export singleton instance
export const appleCalendarSync = new AppleCalendarSync();

export default appleCalendarSync;
