-- Migration 029 — cater_bookings: rename event_id → event_fest_id (polymorphic),
-- add event_fest_type to indicate whether the ID refers to an event or a fest.
-- No DB-level FK since a single column cannot reference two tables simultaneously;
-- referential integrity is enforced in the Express routes.

-- 1. Rename the column
ALTER TABLE public.cater_bookings
  RENAME COLUMN event_id TO event_fest_id;

-- 2. Drop the old FK constraint (referenced only events)
ALTER TABLE public.cater_bookings
  DROP CONSTRAINT IF EXISTS fk_cb_event_id;

-- 3. Rename the old index
DROP INDEX IF EXISTS public.idx_cb_event_id;
CREATE INDEX IF NOT EXISTS idx_cb_event_fest_id
  ON public.cater_bookings USING btree (event_fest_id) TABLESPACE pg_default;

-- 4. Add the type discriminator column
ALTER TABLE public.cater_bookings
  ADD COLUMN IF NOT EXISTS event_fest_type TEXT
  CHECK (event_fest_type IN ('event', 'fest'));

CREATE INDEX IF NOT EXISTS idx_cb_event_fest_type
  ON public.cater_bookings USING btree (event_fest_type) TABLESPACE pg_default;
