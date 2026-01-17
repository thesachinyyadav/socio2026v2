-- CRITICAL FIX: Drop old event_registrations table and ensure schema matches code
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Drop old/unused event_registrations table
-- ============================================

-- This table is not used by the application code
-- It has wrong schema (register_number as INTEGER, no name/email fields)
DROP TABLE IF EXISTS public.event_registrations CASCADE;

-- ============================================
-- PART 2: Fix users table - register_number should be TEXT not INTEGER
-- ============================================

-- Check current data type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'register_number';

-- If it's INTEGER, we need to convert it to TEXT
-- First, alter the column type
ALTER TABLE public.users 
ALTER COLUMN register_number TYPE TEXT USING register_number::TEXT;

-- ============================================
-- PART 3: Verify registrations table is correct
-- ============================================

-- Ensure individual_register_number is TEXT (for 7-digit register numbers)
ALTER TABLE public.registrations
ALTER COLUMN individual_register_number TYPE TEXT;

ALTER TABLE public.registrations
ALTER COLUMN team_leader_register_number TYPE TEXT;

-- ============================================
-- PART 4: Add missing indexes for performance
-- ============================================

-- Index on register_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_register_number ON users(register_number);

-- Index on individual_register_number for faster registration lookups
CREATE INDEX IF NOT EXISTS idx_registrations_individual_register_number 
ON registrations(individual_register_number) WHERE individual_register_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_team_leader_register_number 
ON registrations(team_leader_register_number) WHERE team_leader_register_number IS NOT NULL;

-- ============================================
-- PART 5: Verify schema
-- ============================================

-- Check users table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('register_number', 'email', 'is_organiser', 'is_support', 'is_masteradmin')
ORDER BY column_name;

-- Check registrations table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'registrations'
AND column_name IN ('registration_id', 'event_id', 'individual_name', 'individual_email', 'individual_register_number')
ORDER BY column_name;

-- List all tables to confirm event_registrations is dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('registrations', 'event_registrations')
ORDER BY table_name;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- You should see:
-- ✅ users.register_number is TEXT
-- ✅ registrations table has all correct columns
-- ✅ event_registrations table is GONE
-- ✅ All indexes created
