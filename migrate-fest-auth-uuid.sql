-- Add auth_uuid column to fest table for ownership tracking
-- This allows us to track who created/owns each fest using their Supabase auth UUID

ALTER TABLE fest ADD COLUMN IF NOT EXISTS auth_uuid UUID;

-- Add updated_at column for tracking modifications
ALTER TABLE fest ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create index for faster queries on auth_uuid
CREATE INDEX IF NOT EXISTS idx_fest_auth_uuid ON fest(auth_uuid);

-- Add comment explaining the columns
COMMENT ON COLUMN fest.auth_uuid IS 'Supabase Auth UUID of the user who created this fest';
COMMENT ON COLUMN fest.created_by IS 'Email address of the user who created this fest';
COMMENT ON COLUMN fest.updated_at IS 'Timestamp of last update';
