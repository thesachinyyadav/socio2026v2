-- Migration: Add Master Admin Role, Support Role, Contact Messages, and Fix Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Add missing role columns to users table
-- ============================================

-- Add is_support column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_support BOOLEAN DEFAULT FALSE;

-- Add is_masteradmin column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_masteradmin BOOLEAN DEFAULT FALSE;

-- Add role expiration columns for temporary role assignments
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS organiser_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS masteradmin_expires_at TIMESTAMPTZ;

-- ============================================
-- PART 2: Create contact_messages table if not exists
-- ============================================

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

-- Create index for contact messages
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- Enable RLS for contact_messages
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access (drop first if exists to avoid errors)
DROP POLICY IF EXISTS "Allow all access to contact_messages" ON contact_messages;
CREATE POLICY "Allow all access to contact_messages" 
ON contact_messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PART 3: Create performance indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_is_organiser ON users(is_organiser) WHERE is_organiser = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_support ON users(is_support) WHERE is_support = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_masteradmin ON users(is_masteradmin) WHERE is_masteradmin = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_organiser_expires ON users(organiser_expires_at) WHERE organiser_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_support_expires ON users(support_expires_at) WHERE support_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_masteradmin_expires ON users(masteradmin_expires_at) WHERE masteradmin_expires_at IS NOT NULL;

-- ============================================
-- PART 4: Optional - Promote first master admin
-- ============================================

-- UNCOMMENT AND UPDATE WITH YOUR EMAIL:
-- UPDATE users 
-- SET is_masteradmin = TRUE 
-- WHERE email = 'your-admin-email@christuniversity.in';

-- ============================================
-- PART 5: Verify migration
-- ============================================

-- Check if all columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('is_support', 'is_masteradmin', 'organiser_expires_at', 'support_expires_at', 'masteradmin_expires_at')
ORDER BY column_name;

-- Check users with special roles
SELECT 
  email, 
  is_organiser, 
  organiser_expires_at,
  is_support, 
  support_expires_at,
  is_masteradmin,
  masteradmin_expires_at,
  created_at
FROM users 
WHERE is_masteradmin = TRUE OR is_organiser = TRUE OR is_support = TRUE
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- PART 6: Usage Examples
-- ============================================

-- 1. Make someone organiser forever:
--    UPDATE users SET is_organiser = TRUE, organiser_expires_at = NULL WHERE email = 'user@example.com';

-- 2. Make someone support for 1 month:
--    UPDATE users SET is_support = TRUE, support_expires_at = NOW() + INTERVAL '1 month' WHERE email = 'user@example.com';

-- 3. Make someone master admin until specific date:
--    UPDATE users SET is_masteradmin = TRUE, masteradmin_expires_at = '2026-12-31 23:59:59' WHERE email = 'user@example.com';

-- 4. Remove expired roles (run periodically or in middleware):
--    UPDATE users SET is_organiser = FALSE WHERE organiser_expires_at IS NOT NULL AND organiser_expires_at < NOW();
--    UPDATE users SET is_support = FALSE WHERE support_expires_at IS NOT NULL AND support_expires_at < NOW();
--    UPDATE users SET is_masteradmin = FALSE WHERE masteradmin_expires_at IS NOT NULL AND masteradmin_expires_at < NOW();

-- ============================================
-- PART 7: Data integrity check
-- ============================================

-- Count users by role
SELECT 
  COUNT(*) FILTER (WHERE is_organiser = TRUE) as organisers,
  COUNT(*) FILTER (WHERE is_support = TRUE) as support_users,
  COUNT(*) FILTER (WHERE is_masteradmin = TRUE) as master_admins,
  COUNT(*) as total_users
FROM users;

-- Check for any orphaned registrations (registrations without events)
SELECT 
  r.registration_id, 
  r.event_id,
  r.created_at
FROM registrations r
LEFT JOIN events e ON r.event_id = e.event_id
WHERE e.event_id IS NULL
LIMIT 10;

-- Check events without registrations
SELECT 
  e.event_id,
  e.title,
  e.total_participants,
  COUNT(r.id) as actual_registrations
FROM events e
LEFT JOIN registrations r ON e.event_id = r.event_id
GROUP BY e.event_id, e.title, e.total_participants
HAVING e.total_participants != COUNT(r.id)
ORDER BY e.total_participants DESC
LIMIT 10;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Run the verification queries above to confirm everything is working
