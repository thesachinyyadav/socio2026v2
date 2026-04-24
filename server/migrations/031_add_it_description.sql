-- Add it_description column to events for storing IT support request details
ALTER TABLE events ADD COLUMN IF NOT EXISTS it_description TEXT;

-- Add it_support_expires_at to users for IT support role expiry
ALTER TABLE users ADD COLUMN IF NOT EXISTS it_support_expires_at TIMESTAMPTZ;
