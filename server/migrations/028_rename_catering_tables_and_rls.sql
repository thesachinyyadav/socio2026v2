-- Migration 028 — Rename catering tables to caters / cater_bookings, enable RLS on caters
--
-- The vendor table was renamed catering_vendors → caters, and the orders table
-- was renamed catering_booking → cater_bookings. This migration mirrors that
-- change for environments that haven't already had it applied manually, and
-- enables RLS on the new caters table.

ALTER TABLE IF EXISTS public.catering_vendors RENAME TO caters;
ALTER TABLE IF EXISTS public.catering_booking  RENAME TO cater_bookings;

-- Rename the FK constraint on cater_bookings so its name matches the new table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catering_booking_catering_id_fkey'
  ) THEN
    ALTER TABLE public.cater_bookings
      RENAME CONSTRAINT catering_booking_catering_id_fkey TO cater_bookings_catering_id_fkey;
  END IF;
END $$;

-- Enable Row Level Security on caters
ALTER TABLE public.caters ENABLE ROW LEVEL SECURITY;

-- Service-role (server) bypasses RLS by default — these policies cover the
-- anon / authenticated roles used by the Supabase JS browser client.
DROP POLICY IF EXISTS "caters_select_authenticated" ON public.caters;
CREATE POLICY "caters_select_authenticated"
  ON public.caters
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes go through the Express server (service role), so block direct writes
-- from authenticated/anon clients. Service role bypasses these checks.
DROP POLICY IF EXISTS "caters_block_writes" ON public.caters;
CREATE POLICY "caters_block_writes"
  ON public.caters
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
