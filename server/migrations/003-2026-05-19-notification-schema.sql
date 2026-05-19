-- Migration: 003-2026-05-19-notification-schema.sql
-- Description: Updates the notifications table to match the unified payload schema.

-- Add new columns to the notifications table
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS deep_link text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Optional: Create an index on the user_email for faster hydration lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON public.notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
