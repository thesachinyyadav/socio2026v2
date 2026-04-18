-- Migration: Add custom_fields to fests for fest-level registration questions
-- Purpose: Enable event-style dynamic custom fields on create/edit fest flows

alter table public.fests
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;

-- Optional index if querying by custom_fields keys later
create index if not exists idx_fests_custom_fields on public.fests using gin(custom_fields);

-- Confirmation query
select 'fests.custom_fields' as column_checked,
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fests'
      and column_name = 'custom_fields'
  ) as exists;
