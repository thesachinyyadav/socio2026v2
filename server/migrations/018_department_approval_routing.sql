-- Migration: 018_department_approval_routing.sql
-- Purpose: Configure department-specific primary approver routing (HOD or DEAN)
--          for event/fest approval requests.

create table if not exists public.department_approval_routing (
  id uuid primary key default gen_random_uuid(),
  department_scope text not null,
  approver_role_code text not null references public.role_catalog(role_code) on delete restrict,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint department_approval_routing_department_scope_not_blank
    check (length(trim(department_scope)) > 0),
  constraint department_approval_routing_role_chk
    check (upper(approver_role_code) in ('HOD', 'DEAN'))
);

create unique index if not exists idx_department_approval_routing_active_scope
  on public.department_approval_routing ((lower(trim(department_scope))))
  where is_active = true;

create index if not exists idx_department_approval_routing_role_active
  on public.department_approval_routing (approver_role_code, is_active);

with default_departments(department_scope) as (
  values
    ('dept_business_management_bba'),
    ('dept_business_management_mba'),
    ('dept_hotel_management'),
    ('dept_commerce'),
    ('dept_professional_studies'),
    ('dept_english_cultural_studies'),
    ('dept_music'),
    ('dept_performing_arts'),
    ('dept_philosophy_theology'),
    ('dept_theatre_studies'),
    ('dept_school_of_law'),
    ('dept_psychology'),
    ('dept_school_of_education'),
    ('dept_social_work'),
    ('dept_chemistry'),
    ('dept_computer_science'),
    ('dept_life_sciences'),
    ('dept_mathematics'),
    ('dept_physics_electronics'),
    ('dept_statistics_data_science'),
    ('dept_economics'),
    ('dept_international_studies_political_science_history'),
    ('dept_media_studies')
)
insert into public.department_approval_routing (
  department_scope,
  approver_role_code,
  is_active,
  notes
)
select
  d.department_scope,
  'HOD',
  true,
  'Seeded default routing; update approver role to DEAN where required.'
from default_departments d
where not exists (
  select 1
  from public.department_approval_routing r
  where lower(trim(r.department_scope)) = lower(trim(d.department_scope))
    and r.is_active = true
);

insert into public.department_approval_routing (
  department_scope,
  approver_role_code,
  is_active,
  notes
)
select
  trim(ar.organizing_dept),
  'HOD',
  true,
  'Auto-seeded from existing approval_requests.organizing_dept values.'
from public.approval_requests ar
where trim(coalesce(ar.organizing_dept, '')) <> ''
  and not exists (
    select 1
    from public.department_approval_routing r
    where lower(trim(r.department_scope)) = lower(trim(ar.organizing_dept))
      and r.is_active = true
  )
group by trim(ar.organizing_dept);
