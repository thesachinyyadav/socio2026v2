-- Migration 025 — Catering schema (reflects actual Supabase state)
-- All tables and columns below already exist — this file is documentation only.

-- catering_vendors: vendor profiles
CREATE TABLE IF NOT EXISTS public.catering_vendors (
  catering_id      TEXT     PRIMARY KEY,
  catering_name    TEXT     NOT NULL,
  contact_details  JSONB    NOT NULL DEFAULT '[]'::JSONB,
  campuses         JSONB    NOT NULL DEFAULT '[]'::JSONB,
  location         TEXT
);

CREATE INDEX IF NOT EXISTS idx_cvi_campuses
  ON public.catering_vendors USING GIN (campuses);

-- catering_booking: individual orders linked to a vendor
CREATE TABLE IF NOT EXISTS public.catering_booking (
  booking_id      TEXT        PRIMARY KEY,
  booked_by       TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'declined', 'accepted')),
  event_id        TEXT        REFERENCES public.events(event_id) ON DELETE SET NULL,
  contact_details JSON,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- users.caters: single JSONB column storing catering role
-- Shape when assigned: { "is_catering": true, "catering_id": "<vendor-slug>" }
-- Null when not a catering contact.
-- Column already present on users table — no ALTER needed.
