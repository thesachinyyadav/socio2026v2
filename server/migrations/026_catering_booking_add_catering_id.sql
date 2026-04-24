-- Migration 026 — Add catering_id to catering_booking
-- The catering_booking table links orders to a vendor via catering_id, but the
-- column was missing from the live schema. Adds the column and a FK.

ALTER TABLE public.catering_booking
  ADD COLUMN IF NOT EXISTS catering_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'catering_booking_catering_id_fkey'
  ) THEN
    ALTER TABLE public.catering_booking
      ADD CONSTRAINT catering_booking_catering_id_fkey
      FOREIGN KEY (catering_id)
      REFERENCES public.catering_vendors(catering_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_catering_booking_catering_id
  ON public.catering_booking (catering_id);
