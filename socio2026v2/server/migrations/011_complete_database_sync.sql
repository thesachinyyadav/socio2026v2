-- Migration: Complete sync for existing SOCIO databases
-- Purpose: bring older databases to the current backend schema expectations in one run.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- Canonicalize legacy fest table name if needed.
do $$
begin
  if to_regclass('public.fest') is not null and to_regclass('public.fests') is null then
    alter table public.fest rename to fests;
  end if;
end $$;

-- -----------------------------------------------------------------
-- FESTS
-- -----------------------------------------------------------------
alter table if exists public.fests
  add column if not exists auth_uuid text,
  add column if not exists venue text,
  add column if not exists status text,
  add column if not exists registration_deadline timestamptz,
  add column if not exists organizing_dept text,
  add column if not exists department_access jsonb not null default '[]'::jsonb,
  add column if not exists category text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists event_heads jsonb not null default '[]'::jsonb,
  add column if not exists custom_fields jsonb not null default '[]'::jsonb,
  add column if not exists timeline jsonb not null default '[]'::jsonb,
  add column if not exists sponsors jsonb not null default '[]'::jsonb,
  add column if not exists social_links jsonb not null default '[]'::jsonb,
  add column if not exists faqs jsonb not null default '[]'::jsonb,
  add column if not exists campus_hosted_at text,
  add column if not exists allowed_campuses jsonb not null default '[]'::jsonb,
  add column if not exists department_hosted_at text,
  add column if not exists allow_outsiders boolean not null default false,
  add column if not exists created_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;

update public.fests set department_access = '[]'::jsonb where department_access is null;
update public.fests set event_heads = '[]'::jsonb where event_heads is null;
update public.fests set custom_fields = '[]'::jsonb where custom_fields is null;
update public.fests set timeline = '[]'::jsonb where timeline is null;
update public.fests set sponsors = '[]'::jsonb where sponsors is null;
update public.fests set social_links = '[]'::jsonb where social_links is null;
update public.fests set faqs = '[]'::jsonb where faqs is null;
update public.fests set allowed_campuses = '[]'::jsonb where allowed_campuses is null;

alter table if exists public.fests
  alter column department_access set default '[]'::jsonb,
  alter column event_heads set default '[]'::jsonb,
  alter column custom_fields set default '[]'::jsonb,
  alter column timeline set default '[]'::jsonb,
  alter column sponsors set default '[]'::jsonb,
  alter column social_links set default '[]'::jsonb,
  alter column faqs set default '[]'::jsonb,
  alter column allowed_campuses set default '[]'::jsonb;

alter table if exists public.fests
  alter column department_access set not null,
  alter column event_heads set not null,
  alter column custom_fields set not null,
  alter column timeline set not null,
  alter column sponsors set not null,
  alter column social_links set not null,
  alter column faqs set not null,
  alter column allowed_campuses set not null;

-- -----------------------------------------------------------------
-- EVENTS
-- -----------------------------------------------------------------
alter table if exists public.events
  add column if not exists auth_uuid text,
  add column if not exists end_date date,
  add column if not exists fest_id text,
  add column if not exists fest text,
  add column if not exists registration_deadline timestamptz,
  add column if not exists total_participants integer not null default 0,
  add column if not exists custom_fields jsonb not null default '[]'::jsonb,
  add column if not exists allow_outsiders boolean not null default false,
  add column if not exists outsider_registration_fee numeric,
  add column if not exists outsider_max_participants integer,
  add column if not exists campus_hosted_at text,
  add column if not exists allowed_campuses jsonb not null default '[]'::jsonb,
  add column if not exists on_spot boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;

update public.events set custom_fields = '[]'::jsonb where custom_fields is null;
update public.events set allowed_campuses = '[]'::jsonb where allowed_campuses is null;

alter table if exists public.events
  alter column custom_fields set default '[]'::jsonb,
  alter column allowed_campuses set default '[]'::jsonb,
  alter column total_participants set default 0,
  alter column on_spot set default false,
  alter column is_archived set default false;

alter table if exists public.events
  alter column custom_fields set not null,
  alter column allowed_campuses set not null,
  alter column total_participants set not null,
  alter column on_spot set not null,
  alter column is_archived set not null;

-- -----------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------
alter table if exists public.users
  add column if not exists organization_type text not null default 'christ_member',
  add column if not exists visitor_id text,
  add column if not exists outsider_name_edit_used boolean not null default false,
  add column if not exists campus text,
  add column if not exists organiser_expires_at timestamptz,
  add column if not exists support_expires_at timestamptz,
  add column if not exists masteradmin_expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- -----------------------------------------------------------------
-- NOTIFICATION USER STATUS (if older DB does not have it yet)
-- -----------------------------------------------------------------
create table if not exists public.notification_user_status (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null,
  user_email text not null,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------
do $$
begin
  if to_regclass('public.fests') is not null then
    execute 'create index if not exists idx_fests_created_at on public.fests(created_at desc)';
    execute 'create index if not exists idx_fests_opening_date on public.fests(opening_date desc)';
    execute 'create index if not exists idx_fests_title_lower on public.fests((lower(fest_title)))';
    execute 'create index if not exists idx_fests_dept_lower on public.fests((lower(organizing_dept)))';
    execute 'create index if not exists idx_fests_allow_outsiders on public.fests(allow_outsiders)';
    execute 'create index if not exists idx_fests_department_hosted_at on public.fests(department_hosted_at)';
    execute 'create index if not exists idx_fests_is_archived on public.fests(is_archived)';
    execute 'create index if not exists idx_fests_archived_at on public.fests(archived_at desc)';
    execute 'create index if not exists idx_fests_custom_fields on public.fests using gin(custom_fields)';
  end if;

  if to_regclass('public.events') is not null then
    execute 'create index if not exists idx_events_fest_id on public.events(fest_id)';
    execute 'create index if not exists idx_events_created_at on public.events(created_at desc)';
    execute 'create index if not exists idx_events_event_date on public.events(event_date desc)';
    execute 'create index if not exists idx_events_title_lower on public.events((lower(title)))';
    execute 'create index if not exists idx_events_dept_lower on public.events((lower(organizing_dept)))';
    execute 'create index if not exists idx_events_on_spot on public.events(on_spot)';
    execute 'create index if not exists idx_events_is_archived on public.events(is_archived)';
    execute 'create index if not exists idx_events_archived_at on public.events(archived_at desc)';
    execute 'create index if not exists idx_events_campus_hosted_at on public.events(campus_hosted_at)';
  end if;

  if to_regclass('public.users') is not null then
    execute 'create unique index if not exists idx_users_visitor_id on public.users(visitor_id) where visitor_id is not null';
    execute 'create index if not exists idx_users_email_lower on public.users((lower(email)))';
  end if;

  if to_regclass('public.notification_user_status') is not null then
    execute 'create unique index if not exists idx_notification_user_status_unique on public.notification_user_status(notification_id, user_email)';
    execute 'create index if not exists idx_notification_user_status_user_email on public.notification_user_status(user_email)';
    execute 'create index if not exists idx_notification_user_status_notification_id on public.notification_user_status(notification_id)';
  end if;
end $$;

-- -----------------------------------------------------------------
-- FOREIGN KEYS (added only if absent)
-- -----------------------------------------------------------------
do $$
begin
  if to_regclass('public.events') is not null and to_regclass('public.fests') is not null then
    if not exists (select 1 from pg_constraint where conname = 'fk_events_fest_id') then
      alter table public.events
        add constraint fk_events_fest_id
        foreign key (fest_id)
        references public.fests(fest_id)
        on update cascade
        on delete set null;
    end if;
  end if;

  if to_regclass('public.notification_user_status') is not null and to_regclass('public.notifications') is not null then
    if not exists (select 1 from pg_constraint where conname = 'fk_notification_user_status_notification_id') then
      alter table public.notification_user_status
        add constraint fk_notification_user_status_notification_id
        foreign key (notification_id)
        references public.notifications(id)
        on delete cascade;
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------
-- Quick verification
-- -----------------------------------------------------------------
select 'fests.custom_fields' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fests'
      and column_name = 'custom_fields'
  ) as ok
union all
select 'fests.department_hosted_at' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fests'
      and column_name = 'department_hosted_at'
  ) as ok
union all
select 'events.on_spot' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'on_spot'
  ) as ok
union all
select 'events.is_archived' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'is_archived'
  ) as ok;
