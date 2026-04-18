import { supabase } from './supabaseClient';

// API Base URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

// ============ EVENTS ============

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getUpcomingEvents(limit = 50) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', todayIso)
    .order('event_date', { ascending: true })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function getEventById(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_id', eventId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createEvent(eventData: any) {
  const { data, error } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateEvent(eventId: string, eventData: any) {
  const { data, error } = await supabase
    .from('events')
    .update({ ...eventData, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId: string) {
  // Delete related records first
  await supabase.from('attendance_status').delete().eq('event_id', eventId);
  await supabase.from('registrations').delete().eq('event_id', eventId);
  
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('event_id', eventId);
  
  if (error) throw error;
  return true;
}

// ============ FESTS ============

const FEST_TABLE_CANDIDATES = ['fests', 'fest'] as const;
const FEST_ID_COLUMN_CANDIDATES = ['fest_id', 'id'] as const;

function isMissingRelationOrColumn(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return (
    code === '42P01' ||
    code === '42703' ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('column') && message.includes('does not exist'))
  );
}

function parseComparableDate(value: unknown): Date | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      parsed.setHours(0, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTodayBoundary(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isFestUpcomingOrActive(fest: any): boolean {
  const openingDate = parseComparableDate(fest?.opening_date);
  const closingDate = parseComparableDate(fest?.closing_date) || openingDate;
  if (!openingDate && !closingDate) return false;

  const referenceDate = closingDate || openingDate;
  if (!referenceDate) return false;

  return referenceDate.getTime() >= getTodayBoundary().getTime();
}

export async function getFests() {
  let lastError: any = null;

  for (const tableName of FEST_TABLE_CANDIDATES) {
    const attempts = [
      { applyOrder: true },
      { applyOrder: false },
    ];

    for (const attempt of attempts) {
      let query = supabase.from(tableName).select('*');

      if (attempt.applyOrder) {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (!error) {
        return data || [];
      }

      lastError = error;

      if (attempt.applyOrder && isMissingRelationOrColumn(error)) {
        continue;
      }

      if (isMissingRelationOrColumn(error)) {
        break;
      }

      throw error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function getUpcomingFests(limit = 50) {
  let lastError: any = null;
  const todayIso = new Date().toISOString().slice(0, 10);

  for (const tableName of FEST_TABLE_CANDIDATES) {
    const attempts = [
      { useDateFilterInQuery: true },
      { useDateFilterInQuery: false },
    ];

    for (const attempt of attempts) {
      let query = supabase.from(tableName).select('*');

      if (attempt.useDateFilterInQuery) {
        query = query.gte('closing_date', todayIso);
      }

      query = query.order('opening_date', { ascending: true }).limit(limit);

      const { data, error } = await query;

      if (!error) {
        const rows = data || [];
        if (attempt.useDateFilterInQuery) {
          return rows;
        }

        return rows
          .filter((fest) => isFestUpcomingOrActive(fest))
          .sort((a, b) => {
            const aDate = parseComparableDate(a?.opening_date)?.getTime() || 0;
            const bDate = parseComparableDate(b?.opening_date)?.getTime() || 0;
            return aDate - bDate;
          })
          .slice(0, limit);
      }

      lastError = error;

      if (attempt.useDateFilterInQuery && isMissingRelationOrColumn(error)) {
        continue;
      }

      if (isMissingRelationOrColumn(error)) {
        break;
      }

      throw error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function getFestById(festId: string) {
  let lastError: any = null;

  for (const tableName of FEST_TABLE_CANDIDATES) {
    for (const idColumn of FEST_ID_COLUMN_CANDIDATES) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(idColumn, festId)
        .single();

      if (!error) return data;

      if (error.code === 'PGRST116') {
        lastError = error;
        continue;
      }

      if (isMissingRelationOrColumn(error)) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (lastError?.code !== 'PGRST116' && lastError) throw lastError;
  return null;
}

export async function createFest(festData: any) {
  let lastError: any = null;

  for (const tableName of FEST_TABLE_CANDIDATES) {
    const { data, error } = await supabase
      .from(tableName)
      .insert(festData)
      .select()
      .single();

    if (!error) return data;

    if (isMissingRelationOrColumn(error)) {
      lastError = error;
      continue;
    }

    throw error;
  }

  if (lastError) throw lastError;
  return null;
}

export async function updateFest(festId: string, festData: any) {
  let lastError: any = null;

  for (const tableName of FEST_TABLE_CANDIDATES) {
    for (const idColumn of FEST_ID_COLUMN_CANDIDATES) {
      const { data, error } = await supabase
        .from(tableName)
        .update(festData)
        .eq(idColumn, festId)
        .select()
        .single();

      if (!error) return data;

      if (error.code === 'PGRST116' || isMissingRelationOrColumn(error)) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (lastError) throw lastError;
  return null;
}

export async function deleteFest(festId: string) {
  let lastError: any = null;

  for (const tableName of FEST_TABLE_CANDIDATES) {
    for (const idColumn of FEST_ID_COLUMN_CANDIDATES) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq(idColumn, festId);

      if (!error) return true;

      if (isMissingRelationOrColumn(error)) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (lastError) throw lastError;
  return true;
}

// ============ USERS ============

export async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) throw error;
  return data || [];
}

export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createOrUpdateUser(userData: {
  email: string;
  name?: string;
  avatar_url?: string;
  auth_uuid?: string;
  is_organiser?: boolean;
  course?: string;
  register_number?: string;
}) {
  // Check if user exists
  const existingUser = await getUserByEmail(userData.email);
  
  if (existingUser) {
    // Update existing user
    const { data, error } = await supabase
      .from('users')
      .update(userData)
      .eq('email', userData.email)
      .select()
      .single();
    
    if (error) throw error;
    return { user: data, isNew: false };
  } else {
    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw error;
    return { user: data, isNew: true };
  }
}

// ============ REGISTRATIONS ============

export async function getRegistrations(eventId: string) {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getRegistrationById(registrationId: string) {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('registration_id', registrationId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createRegistration(registrationData: any) {
  const { data, error } = await supabase
    .from('registrations')
    .insert(registrationData)
    .select()
    .single();
  
  if (error) throw error;
  
  // Update event participant count
  await supabase.rpc('increment_participants', { event_id_param: registrationData.event_id });
  
  return data;
}

export async function getUserRegistrations(userEmail: string) {
  const { data, error } = await supabase
    .from('registrations')
    .select('*, events(*)')
    .or(`user_email.eq.${userEmail},individual_email.eq.${userEmail},team_leader_email.eq.${userEmail}`)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// ============ ATTENDANCE ============

export async function getAttendanceStatus(eventId: string) {
  const { data, error } = await supabase
    .from('attendance_status')
    .select('*')
    .eq('event_id', eventId);
  
  if (error) throw error;
  return data || [];
}

export async function markAttendance(attendanceData: {
  registration_id: string;
  event_id: string;
  status: 'attended' | 'absent' | 'pending';
  marked_by: string;
}) {
  const { data, error } = await supabase
    .from('attendance_status')
    .upsert({
      ...attendanceData,
      marked_at: new Date().toISOString()
    }, { onConflict: 'registration_id' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============ QR SCAN LOGS ============

export async function logQRScan(scanData: {
  registration_id: string;
  event_id: string;
  scanned_by: string;
  scan_result: string;
  scanner_info?: any;
}) {
  const { data, error } = await supabase
    .from('qr_scan_logs')
    .insert({
      ...scanData,
      scan_timestamp: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============ NOTIFICATIONS ============

export async function getNotifications(userEmail: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(notificationId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createNotification(notificationData: {
  user_email: string;
  title: string;
  message?: string;
  type?: string;
}) {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notificationData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Export supabase client for direct use if needed
export { supabase };

