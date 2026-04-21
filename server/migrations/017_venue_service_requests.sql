-- Migration 017: Venue service request tables
-- Run this SQL directly in the Supabase SQL Editor.
-- Do NOT use npm run migration:up (tracker is not in use on this project).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table 1: Venues master list per campus
CREATE TABLE IF NOT EXISTS public.venues (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus    TEXT NOT NULL,
  name      TEXT NOT NULL,
  capacity  INTEGER,
  location  TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(campus, name)
);
CREATE INDEX IF NOT EXISTS idx_venues_campus ON public.venues(campus);

-- Table 2: Venue service requests only
CREATE TABLE IF NOT EXISTS public.service_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type             TEXT NOT NULL CHECK (entity_type IN ('fest', 'event')),
  entity_id               TEXT NOT NULL,
  service_type            TEXT NOT NULL DEFAULT 'venue' CHECK (service_type = 'venue'),
  details                 JSONB NOT NULL DEFAULT '{}',
  -- details shape: { venue_id, venue_name, date, start_time, end_time, headcount, setup_notes }
  assigned_incharge_email TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected', 'returned_for_revision')),
  requested_by            TEXT NOT NULL,
  decision_notes          TEXT
);
CREATE INDEX IF NOT EXISTS idx_sr_entity   ON public.service_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sr_incharge ON public.service_requests(assigned_incharge_email, status);

-- Seed sample venues (edit to match your actual campus names and halls)
-- Run separately after confirming the campus names match your users table:
--
-- INSERT INTO public.venues (campus, name, capacity, location) VALUES
--   ('Central Campus (Main)', 'Main Auditorium',  1200, 'Block A, Ground Floor'),
--   ('Central Campus (Main)', 'Seminar Hall 1',    150, 'Block B, 2nd Floor'),
--   ('Central Campus (Main)', 'Seminar Hall 2',    150, 'Block B, 3rd Floor'),
--   ('Central Campus (Main)', 'Open Air Theatre',  800, 'Near Block C'),
--   ('Central Campus (Main)', 'Conference Room 1',  50, 'Admin Block')
-- ON CONFLICT (campus, name) DO NOTHING;
