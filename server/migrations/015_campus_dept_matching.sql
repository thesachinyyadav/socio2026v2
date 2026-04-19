-- Migration 015: Campus + dept matching for approval routing
-- Adds campus snapshot to approvals, dept field to users for HOD dept-level matching.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add organizing_campus_snapshot to approvals
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.approvals
  add column if not exists organizing_campus_snapshot text;

create index if not exists idx_approvals_campus_snapshot
  on public.approvals (organizing_campus_snapshot)
  where organizing_campus_snapshot is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add dept to users for HOD dept-level matching
--    (campus already exists from prior migrations)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists dept text;

create index if not exists idx_users_dept
  on public.users (dept)
  where dept is not null;

create index if not exists idx_users_campus
  on public.users (campus)
  where campus is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Verification
-- ─────────────────────────────────────────────────────────────────────────────

select 'organizing_campus_snapshot on approvals' as check_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals'
      and column_name = 'organizing_campus_snapshot'
  ) as ok
union all
select 'dept on users',
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
      and column_name = 'dept'
  );

commit;
