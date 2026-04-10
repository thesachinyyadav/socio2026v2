-- Migration: 012_add_domain_scoped_roles.sql
-- Purpose: Add domain-scoped role support for HOD and Dean in users table
-- Date: 2026-04-10

alter table if exists public.users
  add column if not exists is_hod boolean not null default false,
  add column if not exists is_dean boolean not null default false,
  add column if not exists school_id text;

update public.users set is_hod = false where is_hod is null;
update public.users set is_dean = false where is_dean is null;

alter table if exists public.users
  alter column is_hod set default false,
  alter column is_dean set default false,
  alter column is_hod set not null,
  alter column is_dean set not null;

-- Enforce mutually exclusive domain leadership roles.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_hod_dean_exclusive_chk'
  ) then
    alter table public.users
      add constraint users_hod_dean_exclusive_chk
      check (not (is_hod and is_dean));
  end if;
end $$;

create index if not exists idx_users_is_hod on public.users(is_hod);
create index if not exists idx_users_is_dean on public.users(is_dean);
create index if not exists idx_users_school_id on public.users(school_id);
