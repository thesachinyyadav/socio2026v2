import { supabase } from './supabaseClient';

// API Base URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

export type SupportArticleSummary = {
  id: number;
  category: string;
  title: string;
  description: string;
  read_time_minutes: number;
  helpful_count: number;
  created_at?: string;
};

export type SupportArticleDetail = SupportArticleSummary & {
  content: string;
  updated_at?: string;
};

const SUPPORT_ARTICLES_FALLBACK: SupportArticleDetail[] = [
  {
    id: 1,
    category: 'account',
    title: 'How to create a SOCIO account',
    description: 'Sign in with your Christ University Google account, review your profile details, and complete any required fields to activate your SOCIO account.',
    content: 'Sign in using your Christ University Google account from the SOCIO auth page. If you are a student or staff member, your profile will be created automatically after first login. Review your profile details and complete any missing fields before registering for events.',
    read_time_minutes: 3,
    helpful_count: 89,
  },
  {
    id: 2,
    category: 'account',
    title: 'Forgot password? Reset it here',
    description: 'Use Google account recovery, then sign out and sign back in with your campus account if access is not restored immediately.',
    content: 'SOCIO uses Google authentication, so password resets are managed in your Google account settings. If login still fails, clear browser cache, sign out of all Google accounts, and sign in again with your campus account.',
    read_time_minutes: 2,
    helpful_count: 156,
  },
  {
    id: 3,
    category: 'events',
    title: 'How to register for events',
    description: 'Open the event page, review the eligibility and deadline details, complete registration, and confirm payment if required.',
    content: 'Open the event page, review eligibility and deadline details, then click Register. For paid events, complete payment if required and verify your registration confirmation. Your QR code will be available in your account once registration is successful.',
    read_time_minutes: 4,
    helpful_count: 234,
  },
  {
    id: 4,
    category: 'events',
    title: 'Managing your event registrations',
    description: 'Go to your registrations section, review upcoming bookings, and cancel only where the event policy allows it before the deadline.',
    content: 'Go to your profile and open the registrations area to view upcoming and past registrations. You can cancel registrations where cancellation is allowed before the deadline. Always check event-specific rules before modifying submissions.',
    read_time_minutes: 3,
    helpful_count: 142,
  },
  {
    id: 5,
    category: 'events',
    title: 'QR code attendance system',
    description: 'After registration, present your unique QR code at the venue so organizers can verify and record your attendance.',
    content: 'After successful registration, SOCIO generates a unique QR code tied to your registration record. Show this QR code at the venue for attendance scanning by organizers. If scanning fails, present your registration details for manual verification.',
    read_time_minutes: 2,
    helpful_count: 98,
  },
  {
    id: 6,
    category: 'technical',
    title: 'App not loading properly',
    description: 'Refresh the page, check your internet connection, and clear cache or cookies before trying again in an updated browser.',
    content: 'Start by refreshing the page and checking your internet connection. If issues continue, clear cache and cookies for the site, then try again in an updated browser. If the problem persists, contact support with screenshots and device details.',
    read_time_minutes: 3,
    helpful_count: 67,
  },
  {
    id: 7,
    category: 'technical',
    title: 'Notification settings',
    description: 'Review profile notification preferences, enable browser permissions, and check email spam folders to ensure updates are delivered.',
    content: 'Review your notification preferences in profile settings and ensure browser notification permissions are enabled for SOCIO. Also check email spam folders for missed updates. Disable and re-enable notifications if delivery appears inconsistent.',
    read_time_minutes: 2,
    helpful_count: 45,
  },
  {
    id: 8,
    category: 'organizer',
    title: 'How to create and manage events',
    description: 'Create the event from your dashboard, publish it with complete details, and monitor registrations and attendance from the organizer tools.',
    content: 'Organizers can create events from the management dashboard by filling title, schedule, venue, and participant settings. After publishing, monitor registrations, communicate updates, and track attendance from organizer tools. Keep deadlines and event details current.',
    read_time_minutes: 8,
    helpful_count: 78,
  },
  {
    id: 9,
    category: 'mobile',
    title: 'Download the SOCIO mobile app',
    description: 'Select your platform, install the app, sign in with your SOCIO account, and enable notifications for timely event updates.',
    content: 'Visit the app download section and select your platform. Install the app, sign in with your SOCIO account, and enable notifications for real-time event alerts. Use the latest app version for best reliability and performance.',
    read_time_minutes: 1,
    helpful_count: 234,
  },
];

function getFallbackSupportArticles(filters?: { category?: string; search?: string }): SupportArticleSummary[] {
  const category = (filters?.category || '').trim().toLowerCase();
  const search = (filters?.search || '').trim().toLowerCase();

  return SUPPORT_ARTICLES_FALLBACK.filter((article) => {
    const matchesCategory = !category || category === 'all' || article.category === category;
    const matchesSearch =
      !search ||
      article.title.toLowerCase().includes(search) ||
      article.description.toLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  }).map(({ content, ...summary }) => summary);
}

async function getApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.message === 'string' && body.message.trim()) {
      return body.message;
    }
  } catch {
    // Ignore JSON parse errors and return fallback.
  }
  return fallbackMessage;
}

export async function getSupportArticles(filters?: {
  category?: string;
  search?: string;
}): Promise<SupportArticleSummary[]> {
  const params = new URLSearchParams();

  if (filters?.category && filters.category !== 'all') {
    params.set('category', filters.category);
  }

  if (filters?.search?.trim()) {
    params.set('search', filters.search.trim());
  }

  const query = params.toString();
  const url = `${API_URL}/api/support/articles${query ? `?${query}` : ''}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to load support articles right now.'));
    }

    const body = await response.json();
    return Array.isArray(body?.articles) ? body.articles : [];
  } catch {
    return getFallbackSupportArticles(filters);
  }
}

export async function getSupportArticleById(id: number | string): Promise<SupportArticleDetail | null> {
  const articleId = Number.parseInt(String(id), 10);
  if (!Number.isFinite(articleId) || articleId <= 0) {
    throw new Error('Invalid article id.');
  }

  try {
    const response = await fetch(`${API_URL}/api/support/articles/${articleId}`, {
      cache: 'no-store'
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to load support article right now.'));
    }

    const body = await response.json();
    return body?.article ?? null;
  } catch {
    return SUPPORT_ARTICLES_FALLBACK.find((article) => article.id === articleId) || null;
  }
}

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

