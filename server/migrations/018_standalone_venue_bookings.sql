-- Migration 018 — allow standalone venue bookings + shared-pool manager model
-- Run in the Supabase SQL Editor (schema_migrations tracker is not in use).

-- 1. Allow a third entity_type for bookings not tied to an event/fest
ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_entity_type_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_entity_type_check
  CHECK (entity_type IN ('fest', 'event', 'standalone'));

-- 2. Standalone rows don't reference an event/fest id
ALTER TABLE public.service_requests
  ALTER COLUMN entity_id DROP NOT NULL;

-- 3. Shared-pool: no single manager owns a request
ALTER TABLE public.service_requests
  ALTER COLUMN assigned_incharge_email DROP NOT NULL;
