-- Per-event HOD and Dean routing preferences for standalone events.
-- Replaces the single combined `needs_hod_dean_approval` flag so the engine can
-- honour the organizer's explicit choice (HOD only, Dean only, both, neither).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS requires_hod_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_dean_approval boolean NOT NULL DEFAULT false;

-- Backfill: when the legacy combined flag was true, assume BOTH were intended
-- so existing behaviour (HOD then Dean) is preserved for historical events.
UPDATE public.events
SET requires_hod_approval = true,
    requires_dean_approval = true
WHERE needs_hod_dean_approval = true
  AND requires_hod_approval = false
  AND requires_dean_approval = false;
