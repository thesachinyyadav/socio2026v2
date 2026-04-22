-- Migration 019 — add slug-based venue_id column to venues (mirrors events.event_id pattern)
-- Run in the Supabase SQL Editor (schema_migrations tracker is not in use).

-- 1. Add the column (nullable for now so backfill can run)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS venue_id TEXT;

-- 2. Backfill existing rows: slugify name (lowercase, non-word→strip, spaces/underscores→dash, trim dashes)
UPDATE public.venues
SET venue_id = trim(both '-' from
                regexp_replace(
                  regexp_replace(
                    lower(name),
                    '[^a-z0-9\s-]', '', 'g'
                  ),
                  '[\s_-]+', '-', 'g'
                )
              )
WHERE venue_id IS NULL;

-- 3. Enforce uniqueness and NOT NULL
ALTER TABLE public.venues
  ALTER COLUMN venue_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS venues_venue_id_key
  ON public.venues(venue_id);
