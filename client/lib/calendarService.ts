/**
 * Calendar Service - Utility for generating calendar links and ICS files
 * Supports Google Calendar, Outlook, Apple Calendar, Yahoo Calendar, and generic ICS
 */

import { dayjs } from './dateUtils';

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: string;  // ISO date string or date
  startTime?: string;  // Time string like "2:30 PM" or "14:30"
  endDate?: string;    // Optional end date, defaults to same day
  endTime?: string;    // Optional end time, defaults to +1 hour
  url?: string;        // Link back to event page
  timezone?: string;   // Timezone identifier (e.g., 'America/New_York')
}

export interface CalendarPlatform {
  id: string;
  name: string;
  icon: string;
  method: 'url' | 'download';
}

export const CALENDAR_PLATFORMS: CalendarPlatform[] = [
  { id: 'google', name: 'Google Calendar', icon: 'google', method: 'url' },
  { id: 'outlook', name: 'Outlook', icon: 'outlook', method: 'download' },
  { id: 'apple', name: 'Apple Calendar', icon: 'apple', method: 'download' },
  { id: 'yahoo', name: 'Yahoo Calendar', icon: 'yahoo', method: 'url' },
  { id: 'ics', name: 'Other (ICS file)', icon: 'calendar', method: 'download' },
];

/**
 * Parse time string to 24-hour format
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!timeMatch) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const period = timeMatch[3]?.toUpperCase();

  if (period === 'PM' && hours < 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
}

/**
 * Generate start and end DateTime strings for calendar platforms
 */
function generateDateTimes(event: CalendarEvent): { start: string; end: string; startUtc: string; endUtc: string } {
  try {
    const startDateObj = dayjs(event.startDate);
    let startDateTime: dayjs.Dayjs;
    let endDateTime: dayjs.Dayjs;

    if (event.startTime) {
      const { hours, minutes } = parseTime(event.startTime);
      startDateTime = startDateObj.hour(hours).minute(minutes).second(0);
      
      if (event.endTime) {
        const endDateObj = event.endDate ? dayjs(event.endDate) : startDateObj;
        const { hours: endHours, minutes: endMinutes } = parseTime(event.endTime);
        endDateTime = endDateObj.hour(endHours).minute(endMinutes).second(0);
      } else {
        // Default to +1 hour if no end time specified
        endDateTime = startDateTime.add(1, 'hour');
      }
    } else {
      // All-day event
      startDateTime = startDateObj.startOf('day');
      const endDateObj = event.endDate ? dayjs(event.endDate) : startDateObj;
      endDateTime = endDateObj.add(1, 'day').startOf('day');
    }

    return {
      start: startDateTime.format('YYYYMMDDTHHmmss'),
      end: endDateTime.format('YYYYMMDDTHHmmss'),
      startUtc: startDateTime.utc().format('YYYYMMDDTHHmmss[Z]'),
      endUtc: endDateTime.utc().format('YYYYMMDDTHHmmss[Z]'),
    };
  } catch (error) {
    console.error('Error generating date times:', error);
    throw new Error('Failed to parse event date/time');
  }
}

/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const { start, end } = generateDateTimes(event);
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.description) {
    let description = event.description;
    if (event.url) {
      description += `\n\nEvent Details: ${event.url}`;
    }
    params.set('details', description);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Yahoo Calendar URL
 */
export function generateYahooCalendarUrl(event: CalendarEvent): string {
  const { start, end } = generateDateTimes(event);
  
  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: start,
    et: end,
  });

  if (event.description) {
    let description = event.description;
    if (event.url) {
      description += ` Event Details: ${event.url}`;
    }
    params.set('desc', description);
  }

  if (event.location) {
    params.set('in_loc', event.location);
  }

  return `https://calendar.yahoo.com/?${params.toString()}`;
}

/**
 * Generate ICS file content
 */
export function generateIcsContent(event: CalendarEvent): string {
  const { startUtc, endUtc } = generateDateTimes(event);
  
  // Generate unique ID for this event
  const uid = `${event.title.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}@withsocio.com`;
  const timestamp = dayjs().utc().format('YYYYMMDDTHHmmss[Z]');

  let description = event.description || '';
  if (event.url) {
    description += description ? `\\n\\nEvent Details: ${event.url}` : `Event Details: ${event.url}`;
  }

  // Escape special characters for ICS format
  const escapeIcsText = (text: string) => 
    text.replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Socio Event Management//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : '',
    event.url ? `URL:${event.url}` : '',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  return icsContent;
}

/**
 * Download ICS file
 */
export function downloadIcsFile(event: CalendarEvent, filename?: string): void {
  const icsContent = generateIcsContent(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_event.ics`;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Handle calendar platform action
 */
export function handleCalendarAction(platform: CalendarPlatform, event: CalendarEvent): void {
  try {
    switch (platform.id) {
      case 'google':
        window.open(generateGoogleCalendarUrl(event), '_blank');
        break;
      case 'yahoo':
        window.open(generateYahooCalendarUrl(event), '_blank');
        break;
      case 'outlook':
      case 'apple':
      case 'ics':
        downloadIcsFile(event);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform.id}`);
    }
  } catch (error) {
    console.error(`Error handling calendar action for ${platform.name}:`, error);
    throw error;
  }
}

/**
 * Get calendar API endpoint URL for ICS download
 */
export function getCalendarApiUrl(eventId: string): string {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");
  return `${API_URL}/api/events/${eventId}/calendar.ics`;
}