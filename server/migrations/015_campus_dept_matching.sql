-- Migration 015: Campus matching for approval routing
-- Adds organizing_campus_snapshot to approvals.
-- Indexes users(department) and users(campus) for fast HOD/Dean/CFO lookup.

begin;

alter table public.approvals
  add column if not exists organizing_campus_snapshot text;

create index idx_approvals_campus_snapshot
  on public.approvals (organizing_campus_snapshot);

create index idx_users_department
  on public.users (department);

create index idx_users_campus
  on public.users (campus);

select 'organizing_campus_snapshot on approvals' as check_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals'
      and column_name = 'organizing_campus_snapshot'
  ) as ok
union all
select 'department column exists on users',
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
      and column_name = 'department'
  );

commit;
