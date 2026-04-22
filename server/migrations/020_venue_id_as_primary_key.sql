-- Migration 020 — venues: drop UUID id, make slug venue_id the primary key,
-- and put venue_id as the FIRST column (mirrors events.event_id placement).
-- Fully idempotent: safe to re-run after partial prior attempts.
-- Run in the Supabase SQL Editor.

DO $mig$
DECLARE
  v_has_id BOOLEAN;
BEGIN
  -- Clean up any leftover from a prior failed run
  DROP TABLE IF EXISTS public.venues_new;

  -- Ensure venue_id column exists
  ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS venue_id TEXT;

  -- Backfill venue_id slugs (EXECUTE so it parses against current schema)
  EXECUTE $cmd$
    UPDATE public.venues
    SET venue_id = trim(both '-' from
      regexp_replace(
        regexp_replace(lower(name), '[^a-z0-9 -]', '', 'g'),
        '[ _-]+', '-', 'g'
      )
    )
    WHERE venue_id IS NULL OR venue_id = ''
  $cmd$;

  -- Check whether the old UUID `id` column is still present
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'venues'
      AND column_name  = 'id'
  ) INTO v_has_id;

  -- Migrate service_requests JSONB references from old UUID → new slug
  -- Wrapped in EXECUTE so v.id is parsed only when the column actually exists
  IF v_has_id THEN
    EXECUTE $cmd$
      UPDATE public.service_requests sr
      SET details = jsonb_set(sr.details, '{venue_id}', to_jsonb(v.venue_id))
      FROM public.venues v
      WHERE sr.service_type = 'venue'
        AND sr.details ? 'venue_id'
        AND sr.details->>'venue_id' = v.id::text
    $cmd$;
  END IF;

  -- Recreate venues table with venue_id as the FIRST column AND primary key
  CREATE TABLE public.venues_new (
    venue_id  TEXT PRIMARY KEY,
    campus    TEXT NOT NULL,
    name      TEXT NOT NULL,
    capacity  INTEGER,
    location  TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (campus, name)
  );

  -- Copy rows (EXECUTE so the SELECT against current `venues` parses at runtime)
  EXECUTE $cmd$
    INSERT INTO public.venues_new (venue_id, campus, name, capacity, location, is_active)
    SELECT venue_id, campus, name, capacity, location, is_active FROM public.venues
  $cmd$;

  -- Swap
  DROP TABLE public.venues;
  ALTER TABLE public.venues_new RENAME TO venues;

  CREATE INDEX IF NOT EXISTS idx_venues_campus ON public.venues(campus);
END
$mig$;
