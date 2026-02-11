import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import advancedFormat from 'dayjs/plugin/advancedFormat';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

/**
 * Format a date string to display format (e.g., "Jan 30, 2026")
 */
export const formatDate = (dateString: string | Date | null | undefined, fallback = "Date TBD"): string => {
  if (!dateString) return fallback;
  const parsed = dayjs(dateString);
  return parsed.isValid() ? parsed.format("MMM D, YYYY") : fallback;
};

/**
 * Format a date string with day suffix (e.g., "Jan 30, 2026")
 */
export const formatDateFull = (dateString: string | Date | null | undefined, fallback = "Date TBD"): string => {
  if (!dateString) return fallback;
  const parsed = dayjs(dateString);
  return parsed.isValid() ? parsed.format("MMM DD, YYYY") : fallback;
};

/**
 * Format a time string (HH:mm:ss or HH:mm) to display format (e.g., "2:30 PM")
 */
export const formatTime = (timeString: string | null | undefined, fallback = "Time TBD"): string => {
  if (!timeString) return fallback;
  
  const trimmed = timeString.trim();
  if (!trimmed) return fallback;

  // Try strict parsing first (HH:mm:ss or HH:mm)
  const strict = dayjs(trimmed, ['HH:mm:ss', 'HH:mm', 'h:mm A', 'h:mm:ss A'], true);
  if (strict.isValid()) return strict.format("h:mm A");

  // Fallback: try general dayjs parse (handles ISO timestamps, etc.)
  const general = dayjs(trimmed);
  if (general.isValid()) return general.format("h:mm A");

  return fallback;
};

/**
 * Format a date in UTC for consistent display
 */
export const formatDateUTC = (dateString: string | Date | null | undefined, fallback = "Date TBD"): string => {
  if (!dateString) return fallback;
  const parsed = dayjs.utc(dateString);
  return parsed.isValid() ? parsed.format("MMM D, YYYY") : fallback;
};

/**
 * Calculate days remaining until a deadline
 * Returns:
 * - null if no deadline is set (open registration)
 * - 0 or negative if deadline has passed
 * - positive number for days remaining
 */
export const getDaysUntil = (deadlineString: string | Date | null | undefined): number | null => {
  if (!deadlineString) return null; // No deadline means open registration
  
  const target = dayjs(deadlineString);
  const today = dayjs().startOf('day');
  
  if (!target.isValid()) return null;
  
  // Return the actual difference (can be negative if past)
  return target.diff(today, 'day');
};

/**
 * Check if registration deadline has passed
 * Returns false if no deadline is set (open registration)
 */
export const isDeadlinePassed = (deadlineString: string | Date | null | undefined): boolean => {
  if (!deadlineString) return false; // No deadline = still open
  
  const target = dayjs(deadlineString);
  const today = dayjs().startOf('day');
  
  if (!target.isValid()) return false;
  return target.isBefore(today);
};

/**
 * Check if a date is before today
 */
export const isBeforeToday = (dateString: string | Date | null | undefined): boolean => {
  if (!dateString) return true;
  const target = dayjs(dateString);
  const today = dayjs().startOf('day');
  return target.isBefore(today);
};

/**
 * Format a date range (e.g., "Jan 15, 2026 - Jan 20, 2026")
 */
export const formatDateRange = (
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined
): string => {
  const start = formatDateFull(startDate, "");
  const end = formatDateFull(endDate, "");
  
  if (!start && !end) return "Dates TBD";
  if (!start) return end;
  if (!end) return start;
  return `${start} - ${end}`;
};

/**
 * Get a dayjs instance (for advanced operations)
 */
export { dayjs };
