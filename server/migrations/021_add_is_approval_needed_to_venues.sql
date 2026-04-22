-- Migration 021 — add `is_approval_needed` boolean to venues.
-- When TRUE, any booking for this venue is routed to the venue dashboard
-- for approval instead of being auto-approved.
-- Run in the Supabase SQL Editor.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_approval_needed BOOLEAN NOT NULL DEFAULT FALSE;
