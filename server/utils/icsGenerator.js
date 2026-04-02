/**
 * ICS Generator Service - Backend service for generating calendar ICS files
 * Handles server-side ICS file generation with proper timezone support
 */

/**
 * Event interface for ICS generation
 */
interface CalendarEventData {
  title: string;
  description?: string;
  location?: string;
  event_date: string;     // Date string from database
  event_time?: string;    // Time string from database  
  end_date?: string;      // Optional end date
  end_time?: string;      // Optional end time
  event_url?: string;     // Link back to event page
  timezone?: string;      // Timezone identifier
}

/**
 * Parse time string to 24-hour format
 */
function parseTime(timeStr) {
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
 * Format date for ICS (YYYYMMDDTHHMMSSZ format)
 */
function formatIcsDateTime(date, time = null) {
  const dateObj = new Date(date);
  
  if (time) {
    const { hours, minutes } = parseTime(time);
    dateObj.setHours(hours, minutes, 0, 0);
  } else {
    dateObj.setHours(0, 0, 0, 0);
  }

  // Convert to UTC and format as YYYYMMDDTHHMMSSZ
  const utcDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
  
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  const hour = String(utcDate.getUTCHours()).padStart(2, '0');
  const minute = String(utcDate.getUTCMinutes()).padStart(2, '0');
  const second = String(utcDate.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/**
 * Format current timestamp for ICS
 */
function formatIcsTimestamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  const second = String(now.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/**
 * Escape special characters for ICS format
 */
function escapeIcsText(text) {
  if (!text) return '';
  
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Generate unique event ID
 */
function generateEventUid(eventData) {
  const titleSlug = eventData.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const timestamp = Date.now();
  return `${titleSlug}-${timestamp}@withsocio.com`;
}

/**
 * Generate ICS file content
 */
function generateIcsContent(eventData) {
  try {
    // Calculate start and end times
    const startDateTime = formatIcsDateTime(eventData.event_date, eventData.event_time);
    
    let endDateTime;
    if (eventData.end_date && eventData.end_time) {
      endDateTime = formatIcsDateTime(eventData.end_date, eventData.end_time);
    } else if (eventData.event_time) {
      // Default to +1 hour for timed events
      const endDate = new Date(eventData.event_date);
      const { hours, minutes } = parseTime(eventData.event_time);
      endDate.setHours(hours + 1, minutes, 0, 0);
      endDateTime = formatIcsDateTime(endDate.toISOString().split('T')[0], 
                                     `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`);
    } else {
      // All-day event, end next day
      const endDate = new Date(eventData.event_date);
      endDate.setDate(endDate.getDate() + 1);
      endDateTime = formatIcsDateTime(endDate.toISOString().split('T')[0]);
    }

    // Prepare event details
    const uid = generateEventUid(eventData);
    const timestamp = formatIcsTimestamp();
    
    let description = eventData.description || '';
    if (eventData.event_url) {
      description += description ? `\\n\\nEvent Details: ${eventData.event_url}` : `Event Details: ${eventData.event_url}`;
    }

    // Build ICS content
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Socio Event Management//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART:${startDateTime}`,
      `DTEND:${endDateTime}`,
      `SUMMARY:${escapeIcsText(eventData.title)}`,
    ];

    if (description) {
      icsLines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    }

    if (eventData.location) {
      icsLines.push(`LOCATION:${escapeIcsText(eventData.location)}`);
    }

    if (eventData.event_url) {
      icsLines.push(`URL:${eventData.event_url}`);
    }

    icsLines.push(
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR'
    );

    return icsLines.join('\r\n');
  } catch (error) {
    console.error('Error generating ICS content:', error);
    throw new Error('Failed to generate ICS file');
  }
}

/**
 * Get ICS filename for event
 */
function getIcsFilename(eventData) {
  const titleSlug = eventData.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase();
  return `${titleSlug}_event.ics`;
}

module.exports = {
  generateIcsContent,
  getIcsFilename,
  formatIcsDateTime,
  escapeIcsText,
  generateEventUid
};