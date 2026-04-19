-- Migration 014: Dynamic JSONB stages array
-- Replaces 13 hardcoded approval-role columns with a single `stages` jsonb array.
-- Each element: { step, role, label, status, assignee_user_id, routing_state, blocking }
-- Safe to run in Supabase SQL Editor as a single transaction.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add stages column (nullable during backfill)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.approvals
  add column if not exists stages jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill existing rows from old columns into stages array
--    Preserves hod/dean assignee UUIDs and routing states.
--    CFO/accounts/stage2 lanes had no assignee tracking → null.
-- ─────────────────────────────────────────────────────────────────────────────

update public.approvals
set stages = jsonb_build_array(
  jsonb_build_object(
    'step',             0,
    'role',             'hod',
    'label',            'HOD',
    'status',           stage1_hod,
    'assignee_user_id', stage1_hod_assignee_user_id::text,
    'routing_state',    stage1_hod_routing_state,
    'blocking',         true
  ),
  jsonb_build_object(
    'step',             1,
    'role',             'dean',
    'label',            'Dean',
    'status',           stage2_dean,
    'assignee_user_id', stage2_dean_assignee_user_id::text,
    'routing_state',    stage2_dean_routing_state,
    'blocking',         true
  ),
  jsonb_build_object(
    'step',             2,
    'role',             'cfo',
    'label',            'CFO/Campus Dir',
    'status',           stage3_cfo,
    'assignee_user_id', null,
    'routing_state',    case when stage3_cfo = 'pending' then 'waiting_for_assignment' else 'assigned' end,
    'blocking',         true
  ),
  jsonb_build_object(
    'step',             3,
    'role',             'accounts',
    'label',            'Accounts Office',
    'status',           stage4_accounts,
    'assignee_user_id', null,
    'routing_state',    case when stage4_accounts = 'pending' then 'waiting_for_assignment' else 'assigned' end,
    'blocking',         true
  ),
  jsonb_build_object(
    'step',             4,
    'role',             'it',
    'label',            'IT Support',
    'status',           it_support_approval,
    'assignee_user_id', null,
    'routing_state',    case when it_support_approval = 'pending' then 'waiting_for_assignment' else 'assigned' end,
    'blocking',         false
  ),
  jsonb_build_object(
    'step',             5,
    'role',             'venue',
    'label',            'Venue',
    'status',           venue_approval,
    'assignee_user_id', null,
    'routing_state',    case when venue_approval = 'pending' then 'waiting_for_assignment' else 'assigned' end,
    'blocking',         false
  ),
  jsonb_build_object(
    'step',             6,
    'role',             'catering',
    'label',            'Catering Vendors',
    'status',           catering_approval,
    'assignee_user_id', null,
    'routing_state',    case when catering_approval = 'pending' then 'waiting_for_assignment' else 'assigned' end,
    'blocking',         false
  ),
  jsonb_build_object(
    'step',             7,
    'role',             'stalls',
    'label',            'Stalls/Misc',
    'status',           stalls_approval,
    'assignee_user_id', null,
    'routing_state',    case when stalls_approval = 'pending' then 'waiting_for_assignment' else 'assigned' end,
    'blocking',         false
  ),
  jsonb_build_object(
    'step',             8,
    'role',             'miscellaneous',
    'label',            'Miscellaneous',
    'status',           miscellaneous_approval,
    'assignee_user_id', null,
    'routing_state',    case when miscellaneous_approval = 'pending' then 'waiting_for_assignment' else 'assigned' end,
    'blocking',         false
  )
)
where stages is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Make stages NOT NULL with default
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.approvals
  alter column stages set not null,
  alter column stages set default '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop old hardcoded columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.approvals
  drop column if exists stage1_hod,
  drop column if exists stage2_dean,
  drop column if exists stage3_cfo,
  drop column if exists stage4_accounts,
  drop column if exists catering_approval,
  drop column if exists it_support_approval,
  drop column if exists stalls_approval,
  drop column if exists venue_approval,
  drop column if exists miscellaneous_approval,
  drop column if exists stage1_hod_assignee_user_id,
  drop column if exists stage1_hod_routing_state,
  drop column if exists stage2_dean_assignee_user_id,
  drop column if exists stage2_dean_routing_state,
  drop column if exists current_stage;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Drop old indexes that referenced dropped columns
-- ─────────────────────────────────────────────────────────────────────────────

drop index if exists public.idx_approvals_current_stage;
drop index if exists public.idx_approvals_stage1_hod;
drop index if exists public.idx_approvals_stage2_dean;
drop index if exists public.idx_approvals_hod_assignee;
drop index if exists public.idx_approvals_dean_assignee;
drop index if exists public.idx_approvals_hod_routing;
drop index if exists public.idx_approvals_dean_routing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Add GIN index for JSONB containment queries (@>)
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_approvals_stages_gin
  on public.approvals using gin (stages);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Postgres RPC for bulk auto-routing (called from userRoutes.js)
--    Updates all waiting_for_assignment stage objects matching p_role + p_school
--    to assigned in a single query instead of JS read-modify-write loop.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.route_approvals_to_user(
  p_user_id   uuid,
  p_role      text,
  p_school    text
) returns integer
language plpgsql
security definer
as $$
declare
  v_row   record;
  v_new   jsonb;
  v_count integer := 0;
begin
  for v_row in
    select id, stages
    from public.approvals
    where organizing_school_snapshot = p_school
      and stages @> jsonb_build_array(
            jsonb_build_object(
              'role',          p_role,
              'status',        'pending',
              'routing_state', 'waiting_for_assignment'
            )
          )
  loop
    select jsonb_agg(
      case
        when (elem->>'role') = p_role
         and (elem->>'routing_state') = 'waiting_for_assignment'
         and (elem->>'status') = 'pending'
        then elem
          || jsonb_build_object(
               'assignee_user_id', p_user_id::text,
               'routing_state',    'assigned'
             )
        else elem
      end
      order by (elem->>'step')::int
    )
    into v_new
    from jsonb_array_elements(v_row.stages) as elem;

    update public.approvals
    set stages     = v_new,
        updated_at = now()
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Verification
-- ─────────────────────────────────────────────────────────────────────────────

select 'stages column exists'    as check_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals' and column_name = 'stages'
  ) as ok
union all
select 'old columns dropped',
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals'
      and column_name in ('stage1_hod', 'current_stage', 'catering_approval')
  )
union all
select 'all rows backfilled',
  not exists (
    select 1 from public.approvals where stages is null
  )
union all
select 'rpc function exists',
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'route_approvals_to_user'
  );

commit;
