-- SOCIO new Supabase schema (ADV-01 + ADV-02 + ADV-03 ready)
-- Date: 2026-03-30
--
-- Includes:
-- ADV-01: Stable event -> fest mapping via events.fest_id (ID-safe, title-change safe)
-- ADV-02: Canonical fest table name: public.fests
-- ADV-03: Indexes for heavy admin lists (page/search/sort friendly)
--
-- Run this in Supabase SQL Editor on the NEW project.

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Canonicalize legacy table name if needed (fest -> fests)
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.fest') is not null and to_regclass('public.fests') is null then
    alter table public.fest rename to fests;
  end if;
end $$;

-- ------------------------------------------------------------
-- Core Tables
-- ------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_uuid uuid unique,
  email text unique not null,
  name text,
  avatar_url text,

  is_organiser boolean not null default false,
  organiser_expires_at timestamptz,
  is_support boolean not null default false,
  support_expires_at timestamptz,
  is_masteradmin boolean not null default false,
  masteradmin_expires_at timestamptz,

  course text,
  register_number text,

  organization_type text not null default 'christ_member' check (organization_type in ('christ_member', 'outsider')),
  visitor_id text,
  outsider_name_edit_used boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_users_visitor_id on public.users(visitor_id) where visitor_id is not null;

create table if not exists public.fests (
  id uuid primary key default gen_random_uuid(),
  auth_uuid text,

  fest_id text unique not null,
  fest_title text not null,

  description text,
  opening_date date,
  closing_date date,
  fest_image_url text,
  venue text,
  status text,
  registration_deadline timestamptz,

  organizing_dept text,
  department_access jsonb not null default '[]'::jsonb,
  category text,

  contact_email text,
  contact_phone text,
  event_heads jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,

  timeline jsonb not null default '[]'::jsonb,
  sponsors jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,

  campus_hosted_at text,
  allowed_campuses jsonb not null default '[]'::jsonb,
  allow_outsiders boolean not null default false,

  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  auth_uuid text,

  event_id text unique not null,
  title text not null,
  description text,

  event_date date,
  end_date date,
  event_time time,
  venue text,

  category text,
  department_access jsonb not null default '[]'::jsonb,
  organizing_dept text,

  claims_applicable boolean not null default false,
  registration_fee numeric,
  outsider_registration_fee numeric,
  participants_per_team integer,
  max_participants integer,
  outsider_max_participants integer,
  total_participants integer not null default 0,

  event_image_url text,
  banner_url text,
  pdf_url text,

  rules jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  prizes jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,

  organizer_email text,
  organizer_phone text,
  whatsapp_invite_link text,

  registration_deadline timestamptz,
  allow_outsiders boolean not null default false,

  -- ADV-01 canonical relation (stable, ID-safe)
  fest_id text,

  -- Legacy compatibility field used by existing code paths.
  -- Kept in sync with fest_id by trigger below.
  fest text,

  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_events_fest_id
    foreign key (fest_id)
    references public.fests(fest_id)
    on update cascade
    on delete set null
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  registration_id text unique not null,
  event_id text,

  user_email text,
  register_id text,

  registration_type text check (registration_type in ('individual', 'team')),

  individual_name text,
  individual_email text,
  individual_register_number text,

  team_name text,
  team_leader_name text,
  team_leader_email text,
  team_leader_register_number text,
  teammates jsonb not null default '[]'::jsonb,

  participant_organization text not null default 'christ_member' check (participant_organization in ('christ_member', 'outsider')),

  qr_code_data jsonb,
  qr_code_generated_at timestamptz,

  created_at timestamptz not null default now(),

  constraint fk_registrations_event_id
    foreign key (event_id)
    references public.events(event_id)
    on update cascade
    on delete cascade
);

create table if not exists public.attendance_status (
  id uuid primary key default gen_random_uuid(),
  registration_id text unique not null,
  event_id text,
  status text check (status in ('attended', 'absent', 'pending')),
  marked_at timestamptz not null default now(),
  marked_by text
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  title text not null,
  message text,
  type text,
  read boolean not null default false,

  event_id text,
  event_title text,
  action_url text,

  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  source text default 'contact',
  status text default 'new',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_scan_logs (
  id uuid primary key default gen_random_uuid(),
  registration_id text,
  event_id text,
  scanned_by text,
  scan_timestamp timestamptz not null default now(),
  scan_result text,
  scanner_info jsonb
);

-- ------------------------------------------------------------
-- ADV-01 migration helpers: keep events.fest and events.fest_id aligned
-- ------------------------------------------------------------

create or replace function public.sync_event_fest_fields()
returns trigger
language plpgsql
as $$
begin
  if new.fest_id is null and new.fest is not null then
    -- If legacy payload sends fest_id in fest text, accept it.
    new.fest_id := new.fest;
  elsif new.fest is null and new.fest_id is not null then
    -- Keep legacy field readable for old code.
    new.fest := new.fest_id;
  elsif new.fest_id is not null and new.fest is not null and new.fest <> new.fest_id then
    -- Canonical source is fest_id.
    new.fest := new.fest_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_event_fest_fields on public.events;
create trigger trg_sync_event_fest_fields
before insert or update on public.events
for each row execute function public.sync_event_fest_fields();

-- Backfill existing rows if any.
update public.events e
set fest_id = e.fest
where e.fest_id is null
  and e.fest is not null
  and exists (select 1 from public.fests f where f.fest_id = e.fest);

update public.events e
set fest_id = f.fest_id
from public.fests f
where e.fest_id is null
  and e.fest = f.fest_title;

update public.events
set fest = fest_id
where fest_id is not null
  and (fest is null or fest <> fest_id);

-- ------------------------------------------------------------
-- Auto-updated timestamps
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_fests_updated_at on public.fests;
create trigger trg_fests_updated_at
before update on public.fests
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- ADV-03 indexes for heavy admin list pagination/filter/sort
-- ------------------------------------------------------------

-- Users list
create index if not exists idx_users_created_at on public.users(created_at desc);
create index if not exists idx_users_email_lower on public.users((lower(email)));
create index if not exists idx_users_name_lower on public.users((lower(name)));
create index if not exists idx_users_roles on public.users(is_organiser, is_support, is_masteradmin);

-- Events list
create index if not exists idx_events_created_at on public.events(created_at desc);
create index if not exists idx_events_event_date on public.events(event_date desc);
create index if not exists idx_events_title_lower on public.events((lower(title)));
create index if not exists idx_events_dept_lower on public.events((lower(organizing_dept)));
create index if not exists idx_events_fest_id on public.events(fest_id);

-- Fests list
create index if not exists idx_fests_created_at on public.fests(created_at desc);
create index if not exists idx_fests_opening_date on public.fests(opening_date desc);
create index if not exists idx_fests_title_lower on public.fests((lower(fest_title)));
create index if not exists idx_fests_dept_lower on public.fests((lower(organizing_dept)));

-- Registration and attendance
create index if not exists idx_registrations_event_id on public.registrations(event_id);
create index if not exists idx_registrations_user_email on public.registrations(user_email);
create index if not exists idx_attendance_event_id on public.attendance_status(event_id);
create index if not exists idx_attendance_registration_id on public.attendance_status(registration_id);

-- Notifications
create index if not exists idx_notifications_user_read_created on public.notifications(user_email, read, created_at desc);

-- ------------------------------------------------------------
-- RLS (wide-open baseline; tighten later if needed)
-- ------------------------------------------------------------

alter table public.users enable row level security;
alter table public.fests enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.attendance_status enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_messages enable row level security;
alter table public.qr_scan_logs enable row level security;

drop policy if exists "Allow all access to users" on public.users;
create policy "Allow all access to users" on public.users for all using (true) with check (true);

drop policy if exists "Allow all access to fests" on public.fests;
create policy "Allow all access to fests" on public.fests for all using (true) with check (true);

drop policy if exists "Allow all access to events" on public.events;
create policy "Allow all access to events" on public.events for all using (true) with check (true);

drop policy if exists "Allow all access to registrations" on public.registrations;
create policy "Allow all access to registrations" on public.registrations for all using (true) with check (true);

drop policy if exists "Allow all access to attendance_status" on public.attendance_status;
create policy "Allow all access to attendance_status" on public.attendance_status for all using (true) with check (true);

drop policy if exists "Allow all access to notifications" on public.notifications;
create policy "Allow all access to notifications" on public.notifications for all using (true) with check (true);

drop policy if exists "Allow all access to contact_messages" on public.contact_messages;
create policy "Allow all access to contact_messages" on public.contact_messages for all using (true) with check (true);

drop policy if exists "Allow all access to qr_scan_logs" on public.qr_scan_logs;
create policy "Allow all access to qr_scan_logs" on public.qr_scan_logs for all using (true) with check (true);
