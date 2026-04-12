-- Migration: 017_add_organizing_school_to_events_fests.sql
-- Purpose: Add organizing_school to fests and events for required school capture.

alter table if exists public.fests
  add column if not exists organizing_school text;

alter table if exists public.events
  add column if not exists organizing_school text;

create index if not exists idx_fests_school_lower
  on public.fests((lower(organizing_school)));

create index if not exists idx_events_school_lower
  on public.events((lower(organizing_school)));
