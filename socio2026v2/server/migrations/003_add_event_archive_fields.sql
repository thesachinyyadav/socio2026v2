-- Migration: Add archive tracking fields for events
-- Purpose: support manual archive/unarchive and archived views in management UI.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_events_is_archived ON public.events (is_archived);
CREATE INDEX IF NOT EXISTS idx_events_archived_at ON public.events (archived_at DESC);
