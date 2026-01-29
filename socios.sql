-- COMBINED SQL DUMP this is total update and clean working apart from new logins
-- Generated: 2026-01-18
-- This file concatenates all .sql files in the repository into a single file.

-- ===== File: server/supabase-schema.sql =====

-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS contact_messages CASCADE;
DROP TABLE IF EXISTS qr_scan_logs CASCADE;
DROP TABLE IF EXISTS attendance_status CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS fest CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uuid UUID UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  is_organiser BOOLEAN DEFAULT FALSE,
  is_support BOOLEAN DEFAULT FALSE,
  course TEXT,
  register_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact messages table
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT DEFAULT 'contact',
  status TEXT DEFAULT 'new',
  handled_by UUID,
  handled_at TIMESTAMPTZ,
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

-- Fest table (singular)
CREATE TABLE fest (
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
  teammates JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qr_code_data JSONB,
  qr_code_generated_at TIMESTAMPTZ
);

-- Attendance status table
CREATE TABLE attendance_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT UNIQUE NOT NULL,
  event_id TEXT,
  status TEXT CHECK (status IN ('attended', 'absent', 'pending')),
  marked_at TIMESTAMPTZ DEFAULT NOW(),
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
CREATE INDEX idx_contact_messages_status ON contact_messages(status);

CREATE INDEX idx_events_event_id ON events(event_id);
CREATE INDEX idx_registrations_event_id ON registrations(event_id);
CREATE INDEX idx_registrations_user_email ON registrations(user_email);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fest ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_logs ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all access (you can restrict these later)
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to contact_messages" ON contact_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to fest" ON fest FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to registrations" ON registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to attendance_status" ON attendance_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to qr_scan_logs" ON qr_scan_logs FOR ALL USING (true) WITH CHECK (true);

-- ===== File: ADD_OUTSIDER_SUPPORT.sql =====

-- Migration to add outsider support fields and constraints
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'christ_member'::text CHECK (organization_type IN ('christ_member','outsider')),
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS outsider_name_edit_used BOOLEAN DEFAULT FALSE;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS allow_outsiders BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS outsider_registration_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS outsider_max_participants INTEGER;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS participant_organization TEXT DEFAULT 'christ_member'::text CHECK (participant_organization IN ('christ_member','outsider'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_visitor_id ON users(visitor_id) WHERE visitor_id IS NOT NULL;

-- ===== File: FIX_TABLES_NOW.sql =====

-- CRITICAL FIX: Drop old event_registrations table and ensure schema matches code
DROP TABLE IF EXISTS public.event_registrations CASCADE;

ALTER TABLE public.users 
ALTER COLUMN register_number TYPE TEXT USING register_number::TEXT;

ALTER TABLE public.registrations
ALTER COLUMN individual_register_number TYPE TEXT;

ALTER TABLE public.registrations
ALTER COLUMN team_leader_register_number TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_users_register_number ON users(register_number);

CREATE INDEX IF NOT EXISTS idx_registrations_individual_register_number 
ON registrations(individual_register_number) WHERE individual_register_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_team_leader_register_number 
ON registrations(team_leader_register_number) WHERE team_leader_register_number IS NOT NULL;

-- ===== File: migrate-fest-auth-uuid.sql =====

-- Add auth_uuid column to fest table for ownership tracking
ALTER TABLE fest ADD COLUMN IF NOT EXISTS auth_uuid UUID;

ALTER TABLE fest ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fest_auth_uuid ON fest(auth_uuid);

COMMENT ON COLUMN fest.auth_uuid IS 'Supabase Auth UUID of the user who created this fest';
COMMENT ON COLUMN fest.created_by IS 'Email address of the user who created this fest';
COMMENT ON COLUMN fest.updated_at IS 'Timestamp of last update';

-- ===== File: migrate-master-admin.sql =====

-- Migration: Add Master Admin Role, Support Role, Contact Messages, and Fix Schema
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_support BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_masteradmin BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS organiser_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS masteradmin_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT DEFAULT 'contact',
  status TEXT DEFAULT 'new',
  handled_by UUID,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to contact_messages" ON contact_messages;
CREATE POLICY "Allow all access to contact_messages" 
ON contact_messages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_users_is_organiser ON users(is_organiser) WHERE is_organiser = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_support ON users(is_support) WHERE is_support = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_masteradmin ON users(is_masteradmin) WHERE is_masteradmin = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_organiser_expires ON users(organiser_expires_at) WHERE organiser_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_support_expires ON users(support_expires_at) WHERE support_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_masteradmin_expires ON users(masteradmin_expires_at) WHERE masteradmin_expires_at IS NOT NULL;

-- ===== File: socios.sql (original content appended) =====

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_id text NOT NULL UNIQUE,
  event_id text,
  status text CHECK (status = ANY (ARRAY['attended'::text, 'absent'::text, 'pending'::text])),
  marked_at timestamp with time zone DEFAULT now(),
  marked_by text,
  CONSTRAINT attendance_status_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contact_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  source text DEFAULT 'contact'::text,
  status text DEFAULT 'new'::text,
  handled_by uuid,
  handled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contact_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.events (
  event_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  event_date date NOT NULL,
  event_time time without time zone NOT NULL,
  category text,
  banner_url text,
  event_image_url text,
  pdf_url text,
  participants_per_team smallint DEFAULT '1'::smallint,
  registration_fee numeric DEFAULT '0'::numeric,
  claims_applicable boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  department_access jsonb,
  registration_deadline date,
  whatsapp_invite_link text,
  organizer_email text NOT NULL,
  organizer_phone bigint NOT NULL CHECK (organizer_phone > 9),
  rules json,
  schedule json,
  prizes json,
  venue text NOT NULL,
  total_participants smallint,
  created_by text,
  end_date date,
  fest text,
  organizing_dept text,
  updated_by text,
  auth_uuid uuid,
  allow_outsiders boolean DEFAULT false,
  outsider_registration_fee numeric,
  outsider_max_participants integer,
  CONSTRAINT events_pkey PRIMARY KEY (event_id)
);
CREATE TABLE public.fest (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  fest_title text NOT NULL,
  opening_date date NOT NULL,
  closing_date date NOT NULL,
  description text NOT NULL,
  department_access json NOT NULL,
  category text NOT NULL,
  fest_image_url text,
  contact_email text,
  contact_phone text,
  event_heads json,
  created_by text,
  fest_id text,
  organizing_dept text,
  updated_at timestamp without time zone DEFAULT now(),
  updated_by text,
  auth_uuid uuid,
  CONSTRAINT fest_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_email text,
  title text NOT NULL,
  message text,
  type text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.qr_scan_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_id text,
  event_id text,
  scanned_by text,
  scan_timestamp timestamp with time zone DEFAULT now(),
  scan_result text,
  scanner_info jsonb,
  CONSTRAINT qr_scan_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_id text NOT NULL UNIQUE,
  event_id text,
  user_email text,
  registration_type text CHECK (registration_type = ANY (ARRAY['individual'::text, 'team'::text])),
  individual_name text,
  individual_email text,
  individual_register_number text,
  team_name text,
  team_leader_name text,
  team_leader_email text,
  team_leader_register_number text,
  teammates jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  qr_code_data jsonb,
  qr_code_generated_at timestamp with time zone,
  participant_organization text DEFAULT 'christ_member'::text CHECK (participant_organization = ANY (ARRAY['christ_member'::text, 'outsider'::text])),
  CONSTRAINT registrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text,
  register_number text NOT NULL,
  email text UNIQUE,
  course text,
  department text,
  campus text,
  is_organiser boolean NOT NULL DEFAULT false,
  avatar_url text,
  auth_uuid uuid,
  is_support boolean DEFAULT false,
  is_masteradmin boolean DEFAULT false,
  organiser_expires_at timestamp with time zone,
  support_expires_at timestamp with time zone,
  masteradmin_expires_at timestamp with time zone,
  organization_type text DEFAULT 'christ_member'::text CHECK (organization_type = ANY (ARRAY['christ_member'::text, 'outsider'::text])),
  visitor_id text,
  outsider_name_edit_used boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (register_number)
);