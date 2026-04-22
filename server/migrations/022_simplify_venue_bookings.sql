-- Migration 022 — Recreate venue_bookings with a simplified, purpose-built schema.
-- The old table was a copy of service_requests; this version owns only what
-- a venue booking actually needs.
-- Run in the Supabase SQL Editor.

-- Drop old table (was a copy of service_requests schema with mismatched constraint names)
DROP TABLE IF EXISTS public.venue_bookings;

CREATE TABLE public.venue_bookings (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      TEXT         NOT NULL,            -- slug, matches venues.venue_id
  requested_by  TEXT         NOT NULL,            -- booker's email
  date          TEXT         NOT NULL,            -- 'YYYY-MM-DD'
  start_time    TEXT         NOT NULL,            -- 'HH:MM'
  end_time      TEXT         NOT NULL,            -- 'HH:MM'
  title         TEXT         NOT NULL,            -- purpose / event name
  headcount     INTEGER,
  setup_notes   TEXT,
  entity_type   TEXT         NOT NULL DEFAULT 'standalone',
  entity_id     TEXT,                             -- populated when linked to event/fest
  status        TEXT         NOT NULL DEFAULT 'pending',
  decision_notes TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT venue_bookings_status_chk CHECK (
    status IN ('pending', 'approved', 'rejected', 'returned_for_revision')
  ),
  CONSTRAINT venue_bookings_entity_type_chk CHECK (
    entity_type IN ('standalone', 'event', 'fest')
  ),
  CONSTRAINT venue_bookings_time_chk CHECK (start_time < end_time)
);

-- Fast lookups used by queue + availability endpoints
CREATE INDEX idx_vb_venue_date    ON public.venue_bookings (venue_id, date);
CREATE INDEX idx_vb_requested_by  ON public.venue_bookings (requested_by);
CREATE INDEX idx_vb_status        ON public.venue_bookings (status);
