import { format, parseISO } from 'date-fns';

/**
 * Converts a UTC ISO string or Date object to local time for display
 * @param {string|Date} utcTimeOrDate - UTC time as ISO string or Date object
 * @returns {Date} Date object in local time
 */
export function toLocalTime(utcTimeOrDate) {
  if (!utcTimeOrDate) return null;
  
  // If it's already a Date object, ensure we're working with local interpretation
  if (utcTimeOrDate instanceof Date) {
    return new Date(utcTimeOrDate);
  }
  
  // Parse ISO string to Date (automatically converts to local time)
  return parseISO(utcTimeOrDate);
}

/**
 * Formats a UTC time for display in local timezone
 * @param {string|Date} utcTimeOrDate - UTC time as ISO string or Date object
 * @param {string} formatString - date-fns format string
 * @returns {string} Formatted date string in local time
 */
export function formatLocalTime(utcTimeOrDate, formatString) {
  const localDate = toLocalTime(utcTimeOrDate);
  if (!localDate) return '';
  
  return format(localDate, formatString);
}

/**
 * Gets the local date from a UTC ISO string for date input fields
 * @param {string} utcTime - UTC time as ISO string
 * @returns {string} Date string in YYYY-MM-DD format for input fields
 */
export function getLocalDateString(utcTime) {
  if (!utcTime) return '';
  const localDate = toLocalTime(utcTime);
  return format(localDate, 'yyyy-MM-dd');
}

/**
 * Gets the local time from a UTC ISO string for time input fields
 * @param {string} utcTime - UTC time as ISO string
 * @returns {string} Time string in HH:mm format for input fields
 */
export function getLocalTimeString(utcTime) {
  if (!utcTime) return '';
  const localDate = toLocalTime(utcTime);
  return format(localDate, 'HH:mm');
}

/**
 * Creates a UTC ISO string from local date and time inputs
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} timeString - Time in HH:mm format
 * @returns {string} UTC ISO string
 */
export function toUTCFromLocal(dateString, timeString) {
  // Create date in local timezone
  const localDate = new Date(`${dateString}T${timeString}`);
  // Return as UTC ISO string
  return localDate.toISOString();
}

/**
 * Gets the current time in local timezone
 * @returns {Date} Current date/time
 */
export function nowLocal() {
  return new Date();
}