-- Migration 030 — Add campus and status columns to stall_booking
--
-- campus: the campus where the stall is requested (used to scope stall manager queue)
-- status: approval state — pending / accepted / declined
-- Run in the Supabase SQL Editor.

ALTER TABLE public.stall_booking
  ADD COLUMN IF NOT EXISTS campus TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined'));

CREATE INDEX IF NOT EXISTS idx_sb_campus ON public.stall_booking (campus);
CREATE INDEX IF NOT EXISTS idx_sb_status ON public.stall_booking (status);
