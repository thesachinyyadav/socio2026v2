-- Migration: Add Master Admin Role with Temporary Role Assignments
-- Run this in Supabase SQL Editor

-- Add is_masteradmin column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_masteradmin BOOLEAN DEFAULT FALSE;

-- Add role expiration columns for temporary role assignments
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS organiser_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS masteradmin_expires_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_is_masteradmin ON users(is_masteradmin);
CREATE INDEX IF NOT EXISTS idx_users_organiser_expires ON users(organiser_expires_at) WHERE organiser_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_support_expires ON users(support_expires_at) WHERE support_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_masteradmin_expires ON users(masteradmin_expires_at) WHERE masteradmin_expires_at IS NOT NULL;

-- Optional: Promote first master admin (replace with your email)
-- UPDATE users 
-- SET is_masteradmin = TRUE 
-- WHERE email = 'your-admin-email@christuniversity.in';

-- Verify migration
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

-- Usage Examples:
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
