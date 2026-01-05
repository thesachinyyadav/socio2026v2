-- Supabase Schema for Socio App
-- Run this in your Supabase SQL Editor

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uuid UUID UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  is_organiser BOOLEAN DEFAULT FALSE,
  course TEXT,
  register_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  event_time TIME,
  end_date DATE,
  venue TEXT,
  category TEXT,
  department_access JSONB,
  claims_applicable BOOLEAN DEFAULT FALSE,
  registration_fee NUMERIC,
  participants_per_team INTEGER,
  max_participants INTEGER,
  event_image_url TEXT,
  banner_url TEXT,
  pdf_url TEXT,
  rules JSONB,
  schedule JSONB,
  prizes JSONB,
  organizer_email TEXT,
  organizer_phone TEXT,
  whatsapp_invite_link TEXT,
  organizing_dept TEXT,
  fest TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  registration_deadline TIMESTAMPTZ,
  total_participants INTEGER DEFAULT 0
);

-- Fests table
CREATE TABLE fests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fest_id TEXT UNIQUE NOT NULL,
  fest_title TEXT NOT NULL,
  description TEXT,
  opening_date DATE,
  closing_date DATE,
  fest_image_url TEXT,
  organizing_dept TEXT,
  department_access JSONB,
  category TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  event_heads JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registrations table
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT UNIQUE NOT NULL,
  event_id TEXT,
  user_email TEXT,
  registration_type TEXT CHECK (registration_type IN ('individual', 'team')),
  individual_name TEXT,
  individual_email TEXT,
  individual_register_number TEXT,
  team_name TEXT,
  team_leader_name TEXT,
  team_leader_email TEXT,
  team_leader_register_number TEXT,
  teammates JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qr_code_data JSONB,
  qr_code_generated_at TIMESTAMPTZ
);

-- Attendance status table
CREATE TABLE attendance_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT UNIQUE,
  event_id TEXT,
  status TEXT CHECK (status IN ('attended', 'absent', 'pending')),
  marked_at TIMESTAMPTZ,
  marked_by TEXT
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QR scan logs table
CREATE TABLE qr_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT,
  event_id TEXT,
  scanned_by TEXT,
  scan_timestamp TIMESTAMPTZ DEFAULT NOW(),
  scan_result TEXT,
  scanner_info JSONB
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_uuid ON users(auth_uuid);
CREATE INDEX idx_events_event_id ON events(event_id);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_registrations_event_id ON registrations(event_id);
CREATE INDEX idx_registrations_user_email ON registrations(user_email);
CREATE INDEX idx_attendance_event_id ON attendance_status(event_id);
CREATE INDEX idx_notifications_user_email ON notifications(user_email);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fests ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_logs ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all access (you can restrict these later for production)
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to fests" ON fests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to registrations" ON registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to attendance_status" ON attendance_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to qr_scan_logs" ON qr_scan_logs FOR ALL USING (true) WITH CHECK (true);

-- Create a function to increment participant count
CREATE OR REPLACE FUNCTION increment_participants(event_id_param TEXT)
RETURNS void AS $$
BEGIN
  UPDATE events 
  SET total_participants = total_participants + 1 
  WHERE event_id = event_id_param;
END;
$$ LANGUAGE plpgsql;
