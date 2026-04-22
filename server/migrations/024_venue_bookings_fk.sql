-- Migration 024 — Add FK from venue_bookings.venue_id → venues.venue_id
-- Allows Supabase's implicit join syntax (venue:venue_id(...)) to work.
-- Run in the Supabase SQL Editor.

ALTER TABLE public.venue_bookings
  ADD CONSTRAINT fk_vb_venue_id
  FOREIGN KEY (venue_id)
  REFERENCES public.venues(venue_id)
  ON DELETE RESTRICT;
