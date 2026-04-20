/**
 * iCalendar (.ics) exporter — RFC 5545.
 *
 * The output is readable by Google Calendar ("Settings → Import & export"),
 * Apple Calendar ("File → Import…"), and Microsoft Outlook ("File → Open
 * & Export → Import/Export"). One file, three apps.
 *
 * Scope:
 *  - Calendar slots become VEVENTs with their start/end.
 *  - Scheduled tasks become VEVENTs too (we estimate end from duration).
 *  - Unscheduled tasks become VTODOs (Apple & Outlook honor them; Google
 *    silently skips — acceptable tradeoff).
 *
 * Not attempting: attendees, alarms, timezone overrides, recurrences
 * (tasks' recurrence rule is domain-specific and would need careful
 * RRULE translation — out of scope for this pass).
 */

const CRLF = '\r\n';

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Format a Date as a floating local-time iCal stamp:
 *   YYYYMMDDTHHMMSS
 * We intentionally emit floating time (no TZID, no Z) so the event lands
 * on the user's local wall-clock regardless of the importing calendar's
 * timezone. That matches how this app thinks about slots.
 */
function formatLocal(date) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** UTC stamp used for DTSTAMP (required). */
function formatUTC(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Escape per RFC 5545 §3.3.11 (TEXT values). */
function escapeText(s = '') {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold long lines to ≤75 octets per RFC 5545 §3.1. */
function fold(line) {
  if (line.length <= 75) return line;
  const chunks = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join(CRLF);
}

function uid(prefix, id) {
  const clean = String(id || Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, '');
  return `${prefix}-${clean}@taskometer.local`;
}

function slotToVEvent(slot, now) {
  const start = new Date(`${slot.date}T${slot.startTime}:00`);
  // Handle overnight (end < start on same date).
  const [sH] = slot.startTime.split(':').map(Number);
  const [eH] = slot.endTime.split(':').map(Number);
  let endDate = slot.date;
  if (eH < sH) {
    const next = new Date(slot.date);
    next.setDate(next.getDate() + 1);
    endDate = next.toISOString().split('T')[0];
  }
  const end = new Date(`${endDate}T${slot.endTime}:00`);

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid('slot', slot.id)}`,
    `DTSTAMP:${formatUTC(now)}`,
    `DTSTART:${formatLocal(start)}`,
    `DTEND:${formatLocal(end)}`,
    `SUMMARY:${escapeText(slot.label || slot.slotType || 'time block')}`,
  ];
  if (slot.description) lines.push(`DESCRIPTION:${escapeText(slot.description)}`);
  if (slot.slotType) lines.push(`CATEGORIES:${escapeText(slot.slotType)}`);
  lines.push('END:VEVENT');
  return lines;
}

function scheduledTaskToVEvent(task, now) {
  const start = new Date(task.scheduledTime);
  const duration = typeof task.duration === 'number' ? task.duration : 30;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid('task', task.id || task.key)}`,
    `DTSTAMP:${formatUTC(now)}`,
    `DTSTART:${formatLocal(start)}`,
    `DTEND:${formatLocal(end)}`,
    `SUMMARY:${escapeText(task.text || task.title || 'task')}`,
    `STATUS:${task.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
  ];
  if (task.description) lines.push(`DESCRIPTION:${escapeText(task.description)}`);
  if (task.primaryType || task.taskType) {
    lines.push(`CATEGORIES:${escapeText(task.primaryType || task.taskType)}`);
  }
  lines.push('END:VEVENT');
  return lines;
}

function unscheduledTaskToVTodo(task, now) {
  const lines = [
    'BEGIN:VTODO',
    `UID:${uid('todo', task.id || task.key)}`,
    `DTSTAMP:${formatUTC(now)}`,
    `SUMMARY:${escapeText(task.text || task.title || 'task')}`,
    `STATUS:${task.status === 'completed' ? 'COMPLETED' : 'NEEDS-ACTION'}`,
  ];
  if (task.description) lines.push(`DESCRIPTION:${escapeText(task.description)}`);
  if (task.priority) {
    // RFC 5545 priorities: 1 highest .. 9 lowest
    const map = { urgent: 1, high: 3, medium: 5, low: 7 };
    lines.push(`PRIORITY:${map[task.priority] || 5}`);
  }
  lines.push('END:VTODO');
  return lines;
}

/**
 * Build an ICS string from the store.
 */
export function buildICS({ tasks = [], slots = [], calendarName = 'Taskometer' } = {}) {
  const now = new Date();
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Taskometer//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  const body = [];
  for (const slot of slots) {
    if (!slot || !slot.date || !slot.startTime || !slot.endTime) continue;
    body.push(...slotToVEvent(slot, now));
  }
  for (const task of tasks) {
    if (!task) continue;
    if (task.scheduledTime) body.push(...scheduledTaskToVEvent(task, now));
    else body.push(...unscheduledTaskToVTodo(task, now));
  }

  const footer = ['END:VCALENDAR'];
  const all = [...header, ...body, ...footer].map(fold);
  return all.join(CRLF) + CRLF;
}

/**
 * Trigger a browser download. Safe to call from a click handler only.
 */
export function downloadText(text, filename, mimeType = 'text/plain') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
