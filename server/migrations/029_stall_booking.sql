-- Migration 029 — Create stall_booking table
--
-- Tracks stall booking requests.
-- event_fest_id stores the linked event_id or fest_id (nullable).
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.stall_booking (
  stall_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  description   JSONB,
  requested_by  TEXT        NOT NULL,
  event_fest_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_sb_event_id FOREIGN KEY (event_fest_id)
    REFERENCES public.events(event_id) ON DELETE SET NULL,
  CONSTRAINT fk_sb_fest_id  FOREIGN KEY (event_fest_id)
    REFERENCES public.fests(fest_id)   ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sb_requested_by  ON public.stall_booking (requested_by);
CREATE INDEX IF NOT EXISTS idx_sb_event_fest_id ON public.stall_booking (event_fest_id);
