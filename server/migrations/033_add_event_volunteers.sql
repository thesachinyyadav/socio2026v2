-- Migration: Add JSONB volunteer access to events

alter table if exists public.events
  add column if not exists volunteers jsonb not null default '[]'::jsonb,
  add column if not exists end_time time without time zone;

update public.events
set volunteers = '[]'::jsonb
where volunteers is null;

alter table if exists public.events
  alter column volunteers set default '[]'::jsonb,
  alter column volunteers set not null;

do $$
begin
  if to_regclass('public.events') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'events_volunteers_is_array'
    ) then
      alter table public.events
        add constraint events_volunteers_is_array
        check (jsonb_typeof(volunteers) = 'array');
    end if;
  end if;
end $$;
