-- Migration: Add on-spot registration toggle for events
-- Purpose: allow event-level override to keep online registrations open after deadline.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS on_spot BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_events_on_spot ON public.events (on_spot);
