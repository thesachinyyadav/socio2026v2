-- Migration: Add Organization Membership & Outsider Support
-- Date: January 17, 2026
-- Description: Adds support for non-Christ University users (outsiders) with visitor IDs
--              and event-level controls for outsider registration

-- ============================================================================
-- STEP 1: Update USERS table
-- ============================================================================

-- Add organization_type column to track Christ members vs outsiders
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'christ_member';

-- Add visitor_id column for outsiders (format: VIS + 7 digits)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- Add check constraint to ensure organization_type has valid values
ALTER TABLE users 
ADD CONSTRAINT valid_organization_type 
CHECK (organization_type IN ('christ_member', 'outsider'));

-- Add check constraint: Christ members can NEVER have visitor_id (must be NULL)
ALTER TABLE users
ADD CONSTRAINT christ_member_no_visitor_id
CHECK (
  (organization_type = 'christ_member' AND visitor_id IS NULL) OR
  (organization_type = 'outsider')
);

-- Add check constraint: Outsiders MUST have visitor_id
ALTER TABLE users
ADD CONSTRAINT outsider_must_have_visitor_id
CHECK (
  (organization_type = 'outsider' AND visitor_id IS NOT NULL) OR
  (organization_type = 'christ_member')
);

-- Update existing users to be Christ members (since they authenticated with christuniversity.in)
UPDATE users 
SET organization_type = 'christ_member',
    visitor_id = NULL
WHERE organization_type IS NULL OR organization_type = '';

-- Create index on organization_type for filtering
CREATE INDEX IF NOT EXISTS idx_users_organization_type ON users(organization_type);

-- Create unique index on visitor_id (for outsiders only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_visitor_id ON users(visitor_id) 
WHERE visitor_id IS NOT NULL;

COMMENT ON COLUMN users.organization_type IS 'User organization membership: christ_member or outsider';
COMMENT ON COLUMN users.visitor_id IS 'Unique visitor ID for outsiders (format: VISXXXXXXX)';

-- Add flag to allow one-time name edit for outsiders
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS outsider_name_edit_used BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN users.outsider_name_edit_used IS 'Flag indicating outsider has used their one-time name edit';


-- ============================================================================
-- STEP 2: Update EVENTS table
-- ============================================================================

-- Add flag to allow/disallow outsider registrations
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS allow_outsiders BOOLEAN DEFAULT FALSE;

-- Add separate registration fee for outsiders
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS outsider_registration_fee NUMERIC(10, 2);

-- Add maximum participants limit specifically for outsiders
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS outsider_max_participants INTEGER;

-- Create index for filtering events that allow outsiders
CREATE INDEX IF NOT EXISTS idx_events_allow_outsiders ON events(allow_outsiders) 
WHERE allow_outsiders = TRUE;

COMMENT ON COLUMN events.allow_outsiders IS 'Whether outsiders (non-Christ members) can register for this event';
COMMENT ON COLUMN events.outsider_registration_fee IS 'Registration fee for outsiders (can be different from standard fee)';
COMMENT ON COLUMN events.outsider_max_participants IS 'Maximum number of outsider participants allowed';


-- ============================================================================
-- STEP 3: Update REGISTRATIONS table
-- ============================================================================

-- Add column to track whether participant is Christ member or outsider
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS participant_organization TEXT DEFAULT 'christ_member';

-- Add check constraint for valid values
ALTER TABLE registrations 
ADD CONSTRAINT valid_participant_organization 
CHECK (participant_organization IN ('christ_member', 'outsider'));

-- Update existing registrations to be Christ members (all existing users are Christ members)
UPDATE registrations 
SET participant_organization = 'christ_member' 
WHERE participant_organization IS NULL OR participant_organization = '';

-- Create index for filtering registrations by organization
CREATE INDEX IF NOT EXISTS idx_registrations_participant_org ON registrations(participant_organization);

-- Create composite index for event + organization queries (for quota checks)
CREATE INDEX IF NOT EXISTS idx_registrations_event_org ON registrations(event_id, participant_organization);

COMMENT ON COLUMN registrations.participant_organization IS 'Organization type of the participant: christ_member or outsider';


-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================

-- Check users table structure
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name IN ('organization_type', 'visitor_id')
-- ORDER BY ordinal_position;

-- Check events table structure
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'events' 
-- AND column_name IN ('allow_outsiders', 'outsider_registration_fee', 'outsider_max_participants')
-- ORDER BY ordinal_position;

-- Check registrations table structure
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'registrations' 
-- AND column_name IN ('participant_organization')
-- ORDER BY ordinal_position;

-- Verify existing users are marked as Christ members
-- SELECT organization_type, COUNT(*) as count 
-- FROM users 
-- GROUP BY organization_type;

-- Verify existing registrations are marked as Christ members
-- SELECT participant_organization, COUNT(*) as count 
-- FROM registrations 
-- GROUP BY participant_organization;


-- ============================================================================
-- ROLLBACK SCRIPT (In case you need to revert changes)
-- ============================================================================

-- Uncomment and run if you need to rollback:
-- DROP INDEX IF EXISTS idx_users_organization_type;
-- DROP INDEX IF EXISTS idx_users_visitor_id;
-- DROP INDEX IF EXISTS idx_events_allow_outsiders;
-- DROP INDEX IF EXISTS idx_registrations_participant_org;
-- DROP INDEX IF EXISTS idx_registrations_event_org;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_organization_type;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS christ_member_no_visitor_id;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS outsider_must_have_visitor_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS organization_type;
-- ALTER TABLE users DROP COLUMN IF EXISTS visitor_id;
-- ALTER TABLE events DROP COLUMN IF EXISTS allow_outsiders;
-- ALTER TABLE events DROP COLUMN IF EXISTS outsider_registration_fee;
-- ALTER TABLE events DROP COLUMN IF EXISTS outsider_max_participants;
-- ALTER TABLE registrations DROP CONSTRAINT IF EXISTS valid_participant_organization;
-- ALTER TABLE registrations DROP COLUMN IF EXISTS participant_organization;
