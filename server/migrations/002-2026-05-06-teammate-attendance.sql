-- Adds per-teammate attendance tracking to attendance_status.
-- teammate_statuses is keyed by teammate register_number and stores
-- { status, marked_at, marked_by } for each teammate of a team registration.

alter table public.attendance_status
  add column if not exists teammate_statuses jsonb not null default '{}'::jsonb;
