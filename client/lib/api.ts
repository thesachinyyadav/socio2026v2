import { supabase } from './supabaseClient';

// API Base URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============ EVENTS ============

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
  
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

export async function getFests() {
  const { data, error } = await supabase
    .from('fest')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getFestById(festId: string) {
  const { data, error } = await supabase
    .from('fest')
    .select('*')
    .eq('fest_id', festId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createFest(festData: any) {
  const { data, error } = await supabase
    .from('fest')
    .insert(festData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateFest(festId: string, festData: any) {
  const { data, error } = await supabase
    .from('fest')
    .update(festData)
    .eq('fest_id', festId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteFest(festId: string) {
  const { error } = await supabase
    .from('fest')
    .delete()
    .eq('fest_id', festId);
  
  if (error) throw error;
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
