-- Migration: 015_boolean_rbac_pivot.sql
-- Purpose: Pivot to boolean-only RBAC on users table and remove role-catalog dependencies.
-- Safe to run multiple times.

alter table if exists public.users
  add column if not exists is_finance_office boolean not null default false,
  add column if not exists is_organiser_student boolean not null default false,
  add column if not exists is_volunteer boolean not null default false,
  add column if not exists is_service_it boolean not null default false,
  add column if not exists is_service_venue boolean not null default false,
  add column if not exists is_service_catering boolean not null default false,
  add column if not exists is_service_stalls boolean not null default false,
  add column if not exists is_service_security boolean not null default false;

update public.users
set is_finance_office = false
where is_finance_office is null;

update public.users
set is_organiser_student = false
where is_organiser_student is null;

update public.users
set is_volunteer = false
where is_volunteer is null;

update public.users
set is_service_it = false
where is_service_it is null;

update public.users
set is_service_venue = false
where is_service_venue is null;

update public.users
set is_service_catering = false
where is_service_catering is null;

update public.users
set is_service_stalls = false
where is_service_stalls is null;

update public.users
set is_service_security = false
where is_service_security is null;

update public.users
set
  is_hod = true,
  is_dean = false,
  is_cfo = false,
  is_finance_officer = false,
  is_finance_office = false
where lower(coalesce(university_role, '')) = 'hod';

update public.users
set
  is_hod = false,
  is_dean = true,
  is_cfo = false,
  is_finance_officer = false,
  is_finance_office = false
where lower(coalesce(university_role, '')) = 'dean';

update public.users
set
  is_hod = false,
  is_dean = false,
  is_cfo = true,
  is_finance_officer = false,
  is_finance_office = false
where lower(coalesce(university_role, '')) = 'cfo';

update public.users
set
  is_hod = false,
  is_dean = false,
  is_cfo = false,
  is_finance_officer = true,
  is_finance_office = true
where lower(coalesce(university_role, '')) in ('finance_officer', 'accounts');

update public.users
set is_organiser_student = true
where lower(coalesce(university_role, '')) in ('organizer_student', 'organiser_student');

update public.users
set is_volunteer = true
where lower(coalesce(university_role, '')) in ('organizer_volunteer', 'organiser_volunteer');

update public.users
set is_service_it = true
where lower(coalesce(university_role, '')) = 'service_it';

update public.users
set is_service_venue = true
where lower(coalesce(university_role, '')) in ('service_venue', 'venue_manager');

update public.users
set is_service_catering = true
where lower(coalesce(university_role, '')) = 'service_catering';

update public.users
set is_service_stalls = true
where lower(coalesce(university_role, '')) = 'service_stalls';

update public.users
set is_service_security = true
where lower(coalesce(university_role, '')) = 'service_security';

update public.users
set
  is_finance_officer = true,
  is_finance_office = true
where coalesce(is_finance_officer, false) = true
   or coalesce(is_finance_office, false) = true;

do $$
begin
  if to_regclass('public.user_role_assignments') is not null then
    update public.users u
    set
      is_masteradmin = coalesce(u.is_masteradmin, false) or role_map.has_master_admin,
      is_organiser = coalesce(u.is_organiser, false) or role_map.has_organizer_teacher,
      is_support = coalesce(u.is_support, false) or role_map.has_support,
      is_hod = case
        when coalesce(u.is_hod, false) then true
        when coalesce(u.is_dean, false) or coalesce(u.is_cfo, false) or coalesce(u.is_finance_officer, false) or coalesce(u.is_finance_office, false) then false
        else role_map.has_hod
      end,
      is_dean = case
        when coalesce(u.is_dean, false) then true
        when coalesce(u.is_hod, false) or coalesce(u.is_cfo, false) or coalesce(u.is_finance_officer, false) or coalesce(u.is_finance_office, false) then false
        else (not role_map.has_hod and role_map.has_dean)
      end,
      is_cfo = case
        when coalesce(u.is_cfo, false) then true
        when coalesce(u.is_hod, false) or coalesce(u.is_dean, false) or coalesce(u.is_finance_officer, false) or coalesce(u.is_finance_office, false) then false
        else (not role_map.has_hod and not role_map.has_dean and role_map.has_cfo)
      end,
      is_finance_officer = case
        when coalesce(u.is_finance_officer, false) or coalesce(u.is_finance_office, false) then true
        when coalesce(u.is_hod, false) or coalesce(u.is_dean, false) or coalesce(u.is_cfo, false) then false
        else (not role_map.has_hod and not role_map.has_dean and not role_map.has_cfo and role_map.has_finance)
      end,
      is_finance_office = case
        when coalesce(u.is_finance_officer, false) or coalesce(u.is_finance_office, false) then true
        when coalesce(u.is_hod, false) or coalesce(u.is_dean, false) or coalesce(u.is_cfo, false) then false
        else (not role_map.has_hod and not role_map.has_dean and not role_map.has_cfo and role_map.has_finance)
      end,
      is_organiser_student = coalesce(u.is_organiser_student, false) or role_map.has_organizer_student,
      is_volunteer = coalesce(u.is_volunteer, false) or role_map.has_organizer_volunteer,
      is_service_it = coalesce(u.is_service_it, false) or role_map.has_service_it,
      is_service_venue = coalesce(u.is_service_venue, false) or role_map.has_service_venue,
      is_service_catering = coalesce(u.is_service_catering, false) or role_map.has_service_catering,
      is_service_stalls = coalesce(u.is_service_stalls, false) or role_map.has_service_stalls,
      is_service_security = coalesce(u.is_service_security, false) or role_map.has_service_security
    from (
      select
        user_id,
        bool_or(role_code = 'MASTER_ADMIN') as has_master_admin,
        bool_or(role_code = 'ORGANIZER_TEACHER') as has_organizer_teacher,
        bool_or(role_code = 'SUPPORT') as has_support,
        bool_or(role_code = 'HOD') as has_hod,
        bool_or(role_code = 'DEAN') as has_dean,
        bool_or(role_code = 'CFO') as has_cfo,
        bool_or(role_code in ('ACCOUNTS', 'FINANCE_OFFICER')) as has_finance,
        bool_or(role_code = 'ORGANIZER_STUDENT') as has_organizer_student,
        bool_or(role_code = 'ORGANIZER_VOLUNTEER') as has_organizer_volunteer,
        bool_or(role_code = 'SERVICE_IT') as has_service_it,
        bool_or(role_code = 'SERVICE_VENUE') as has_service_venue,
        bool_or(role_code = 'SERVICE_CATERING') as has_service_catering,
        bool_or(role_code = 'SERVICE_STALLS') as has_service_stalls,
        bool_or(role_code = 'SERVICE_SECURITY') as has_service_security
      from public.user_role_assignments
      where coalesce(is_active, true) = true
      group by user_id
    ) role_map
    where u.id = role_map.user_id
      and (
        (role_map.has_master_admin and u.is_masteradmin is distinct from true) or
        (role_map.has_organizer_teacher and u.is_organiser is distinct from true) or
        (role_map.has_support and u.is_support is distinct from true) or
        (role_map.has_hod and u.is_hod is distinct from true) or
        (role_map.has_dean and u.is_dean is distinct from true) or
        (role_map.has_cfo and u.is_cfo is distinct from true) or
        (role_map.has_finance and (u.is_finance_officer is distinct from true or u.is_finance_office is distinct from true)) or
        (role_map.has_organizer_student and u.is_organiser_student is distinct from true) or
        (role_map.has_organizer_volunteer and u.is_volunteer is distinct from true) or
        (role_map.has_service_it and u.is_service_it is distinct from true) or
        (role_map.has_service_venue and u.is_service_venue is distinct from true) or
        (role_map.has_service_catering and u.is_service_catering is distinct from true) or
        (role_map.has_service_stalls and u.is_service_stalls is distinct from true) or
        (role_map.has_service_security and u.is_service_security is distinct from true)
      );
  end if;
end $$;

alter table if exists public.users
  alter column is_finance_office set default false,
  alter column is_finance_office set not null,
  alter column is_organiser_student set default false,
  alter column is_organiser_student set not null,
  alter column is_volunteer set default false,
  alter column is_volunteer set not null,
  alter column is_service_it set default false,
  alter column is_service_it set not null,
  alter column is_service_venue set default false,
  alter column is_service_venue set not null,
  alter column is_service_catering set default false,
  alter column is_service_catering set not null,
  alter column is_service_stalls set default false,
  alter column is_service_stalls set not null,
  alter column is_service_security set default false,
  alter column is_service_security set not null;

alter table if exists public.approval_steps
  drop constraint if exists approval_steps_role_code_fkey;

alter table if exists public.approval_decisions
  drop constraint if exists approval_decisions_role_code_fkey;

alter table if exists public.service_requests
  drop constraint if exists service_requests_service_role_code_fkey;

alter table if exists public.service_decisions
  drop constraint if exists service_decisions_role_code_fkey;

do $$
begin
  if to_regclass('public.approval_steps') is not null and not exists (
    select 1 from pg_constraint where conname = 'approval_steps_role_code_chk'
  ) then
    alter table public.approval_steps
      add constraint approval_steps_role_code_chk
      check (
        role_code in (
          'MASTER_ADMIN',
          'SUPPORT',
          'HOD',
          'DEAN',
          'CFO',
          'ACCOUNTS',
          'FINANCE_OFFICER',
          'ORGANIZER_TEACHER',
          'ORGANIZER_STUDENT',
          'ORGANIZER_VOLUNTEER',
          'SERVICE_IT',
          'SERVICE_VENUE',
          'SERVICE_CATERING',
          'SERVICE_STALLS',
          'SERVICE_SECURITY'
        )
      );
  end if;

  if to_regclass('public.approval_decisions') is not null and not exists (
    select 1 from pg_constraint where conname = 'approval_decisions_role_code_chk'
  ) then
    alter table public.approval_decisions
      add constraint approval_decisions_role_code_chk
      check (
        role_code in (
          'MASTER_ADMIN',
          'SUPPORT',
          'HOD',
          'DEAN',
          'CFO',
          'ACCOUNTS',
          'FINANCE_OFFICER',
          'ORGANIZER_TEACHER',
          'ORGANIZER_STUDENT',
          'ORGANIZER_VOLUNTEER',
          'SERVICE_IT',
          'SERVICE_VENUE',
          'SERVICE_CATERING',
          'SERVICE_STALLS',
          'SERVICE_SECURITY'
        )
      );
  end if;

  if to_regclass('public.service_requests') is not null and not exists (
    select 1 from pg_constraint where conname = 'service_requests_role_code_chk'
  ) then
    alter table public.service_requests
      add constraint service_requests_role_code_chk
      check (
        service_role_code in (
          'SERVICE_IT',
          'SERVICE_VENUE',
          'SERVICE_CATERING',
          'SERVICE_STALLS',
          'SERVICE_SECURITY'
        )
      );
  end if;

  if to_regclass('public.service_decisions') is not null and not exists (
    select 1 from pg_constraint where conname = 'service_decisions_role_code_chk'
  ) then
    alter table public.service_decisions
      add constraint service_decisions_role_code_chk
      check (
        role_code in (
          'SERVICE_IT',
          'SERVICE_VENUE',
          'SERVICE_CATERING',
          'SERVICE_STALLS',
          'SERVICE_SECURITY'
        )
      );
  end if;
end $$;

drop table if exists public.user_role_assignments;
drop table if exists public.role_capabilities;
drop table if exists public.role_catalog;
