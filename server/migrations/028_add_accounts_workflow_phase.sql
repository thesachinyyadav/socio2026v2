-- Migration: 028_add_accounts_workflow_phase
-- Purpose:
-- 1) Split finance workflow phase into CFO and Accounts stages.
-- 2) Ensure users.university_role is enum-backed and includes cfo/finance_officer.
-- 3) Add approval_requests.approval_level and scoped RLS for L4 Accounts review.

-- ---------------------------------------------------------------------------
-- 1) Workflow phase enum migration (strict values)
-- ---------------------------------------------------------------------------
do $$
declare
  workflow_enum_exists boolean;
  has_legacy_finance_value boolean;
begin
  select exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'workflow_phase_enum'
  ) into workflow_enum_exists;

  if not workflow_enum_exists then
    create type public.workflow_phase_enum as enum (
      'draft',
      'dept_approval',
      'finance_approval_cfo',
      'finance_approval_accounts',
      'logistics_approval',
      'approved'
    );

    alter table if exists public.events
      add column if not exists workflow_phase public.workflow_phase_enum not null default 'draft';

    alter table if exists public.fests
      add column if not exists workflow_phase public.workflow_phase_enum not null default 'draft';
  else
    select exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'workflow_phase_enum'
        and e.enumlabel = 'finance_approval'
    ) into has_legacy_finance_value;

    if has_legacy_finance_value then
      if to_regtype('public.workflow_phase_enum_v2') is null then
        create type public.workflow_phase_enum_v2 as enum (
          'draft',
          'dept_approval',
          'finance_approval_cfo',
          'finance_approval_accounts',
          'logistics_approval',
          'approved'
        );
      end if;

      if to_regclass('public.events') is not null then
        execute '
          alter table public.events
            alter column workflow_phase drop default,
            alter column workflow_phase type public.workflow_phase_enum_v2
            using (
              case
                when workflow_phase::text = ''finance_approval''
                     and lower(coalesce(workflow_status, '''')) = ''pending_accounts''
                  then ''finance_approval_accounts''
                when workflow_phase::text = ''finance_approval''
                  then ''finance_approval_cfo''
                else workflow_phase::text
              end
            )::public.workflow_phase_enum_v2,
            alter column workflow_phase set default ''draft''::public.workflow_phase_enum_v2
        ';
      end if;

      if to_regclass('public.fests') is not null then
        execute '
          alter table public.fests
            alter column workflow_phase drop default,
            alter column workflow_phase type public.workflow_phase_enum_v2
            using (
              case
                when workflow_phase::text = ''finance_approval''
                     and lower(coalesce(workflow_status, '''')) = ''pending_accounts''
                  then ''finance_approval_accounts''
                when workflow_phase::text = ''finance_approval''
                  then ''finance_approval_cfo''
                else workflow_phase::text
              end
            )::public.workflow_phase_enum_v2,
            alter column workflow_phase set default ''draft''::public.workflow_phase_enum_v2
        ';
      end if;

      alter type public.workflow_phase_enum rename to workflow_phase_enum_old;
      alter type public.workflow_phase_enum_v2 rename to workflow_phase_enum;
      drop type if exists public.workflow_phase_enum_old;
    end if;
  end if;
end $$;

-- Enforce split phases for any remaining legacy rows.
update public.events
set workflow_phase = (
  case
    when lower(coalesce(workflow_status, '')) = 'pending_accounts' then 'finance_approval_accounts'
    when lower(coalesce(workflow_status, '')) = 'pending_cfo' then 'finance_approval_cfo'
    when workflow_phase::text = 'finance_approval' then 'finance_approval_cfo'
    else workflow_phase::text
  end
)::public.workflow_phase_enum
where workflow_phase::text in ('finance_approval', 'finance_approval_cfo', 'finance_approval_accounts');

update public.fests
set workflow_phase = (
  case
    when lower(coalesce(workflow_status, '')) = 'pending_accounts' then 'finance_approval_accounts'
    when lower(coalesce(workflow_status, '')) = 'pending_cfo' then 'finance_approval_cfo'
    when workflow_phase::text = 'finance_approval' then 'finance_approval_cfo'
    else workflow_phase::text
  end
)::public.workflow_phase_enum
where workflow_phase::text in ('finance_approval', 'finance_approval_cfo', 'finance_approval_accounts');

-- ---------------------------------------------------------------------------
-- 2) users.university_role enum alignment
-- ---------------------------------------------------------------------------
do $$
declare
  enum_exists boolean;
  enum_values text[];
  create_sql text;
  current_udt_name text;
begin
  select exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'university_role_enum'
  ) into enum_exists;

  if not enum_exists then
    select array_agg(role_value order by role_value)
      into enum_values
    from (
      select distinct lower(trim(university_role)) as role_value
      from public.users
      where university_role is not null
        and trim(university_role) <> ''
      union
      select 'cfo'
      union
      select 'finance_officer'
    ) roles;

    if enum_values is null or array_length(enum_values, 1) is null then
      enum_values := array['cfo', 'finance_officer'];
    end if;

    create_sql :=
      'create type public.university_role_enum as enum (' ||
      (
        select string_agg(quote_literal(value), ',')
        from unnest(enum_values) as value
      ) ||
      ')';

    execute create_sql;
  end if;

  alter type public.university_role_enum add value if not exists 'cfo';
  alter type public.university_role_enum add value if not exists 'finance_officer';

  select c.udt_name
    into current_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and c.column_name = 'university_role';

  if current_udt_name is not null and current_udt_name <> 'university_role_enum' then
    execute '
      alter table public.users
      alter column university_role type public.university_role_enum
      using (
        case
          when university_role is null or btrim(university_role::text) = '''' then null
          else lower(btrim(university_role::text))::public.university_role_enum
        end
      )
    ';
  end if;
end $$;

-- Keep role helper function enum-safe.
create or replace function public.current_user_has_role(role_code text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with me as (
    select
      coalesce(is_masteradmin, false) as is_masteradmin,
      coalesce(is_hod, false) as is_hod,
      coalesce(is_dean, false) as is_dean,
      coalesce(is_cfo, false) as is_cfo,
      coalesce(is_finance_office, false) as is_finance_office,
      coalesce(is_organiser, false) as is_organiser,
      coalesce(is_organiser_student, false) as is_organiser_student,
      lower(coalesce(university_role::text, '')) as university_role
    from public.users
    where
      lower(coalesce(email, '')) = public.current_auth_email()
      or (
        auth.uid() is not null
        and coalesce(auth_uuid::text, '') = auth.uid()::text
      )
    order by case when lower(coalesce(email, '')) = public.current_auth_email() then 0 else 1 end
    limit 1
  )
  select exists (
    select 1
    from me
    where
      case upper(coalesce(role_code, ''))
        when 'MASTER_ADMIN' then is_masteradmin or university_role in ('master_admin', 'masteradmin')
        when 'HOD' then is_hod or university_role = 'hod'
        when 'DEAN' then is_dean or university_role = 'dean'
        when 'CFO' then is_cfo or university_role = 'cfo'
        when 'ACCOUNTS' then is_finance_office or university_role in ('accounts', 'finance_officer')
        when 'FINANCE_OFFICER' then is_finance_office or university_role in ('accounts', 'finance_officer')
        when 'ORGANIZER_TEACHER' then is_organiser or university_role in ('organizer_teacher', 'organiser', 'organizer')
        when 'ORGANIZER_STUDENT' then is_organiser_student or university_role in ('organizer_student', 'organiser_student')
        else false
      end
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3) approval_requests level + L4 Accounts RLS
-- ---------------------------------------------------------------------------
alter table if exists public.approval_requests
  add column if not exists approval_level text;

create index if not exists idx_approval_requests_approval_level_status
  on public.approval_requests(approval_level, status);

-- Backfill approval level from current step routing when missing.
with ranked_steps as (
  select
    s.approval_request_id,
    upper(coalesce(s.role_code, s.step_code, '')) as role_code,
    row_number() over (
      partition by s.approval_request_id
      order by
        case upper(coalesce(s.status, ''))
          when 'PENDING' then 0
          when 'WAITING' then 1
          when 'APPROVED' then 2
          else 3
        end,
        s.sequence_order asc,
        s.created_at asc,
        s.id asc
    ) as rn
  from public.approval_steps s
),
request_levels as (
  select
    rs.approval_request_id,
    case
      when rs.role_code = 'CFO' then 'L3_CFO'
      when rs.role_code in ('ACCOUNTS', 'FINANCE_OFFICER') then 'L4_ACCOUNTS'
      else null
    end as resolved_level
  from ranked_steps rs
  where rs.rn = 1
)
update public.approval_requests ar
set approval_level = rl.resolved_level
from request_levels rl
where ar.id = rl.approval_request_id
  and rl.resolved_level is not null
  and coalesce(trim(ar.approval_level), '') = '';

grant select, update on table public.approval_requests to authenticated;

drop policy if exists approval_requests_finance_officer_l4_select on public.approval_requests;
create policy approval_requests_finance_officer_l4_select
  on public.approval_requests
  for select
  to authenticated
  using (
    upper(coalesce(public.approval_requests.approval_level, '')) = 'L4_ACCOUNTS'
    and exists (
      select 1
      from public.users me
      where (
          (me.auth_uuid is not null and me.auth_uuid = (select auth.uid()))
          or lower(coalesce(me.email, '')) = lower((select public.current_auth_email()))
        )
        and lower(coalesce(me.university_role::text, '')) = 'finance_officer'
    )
  );

drop policy if exists approval_requests_finance_officer_l4_update on public.approval_requests;
create policy approval_requests_finance_officer_l4_update
  on public.approval_requests
  for update
  to authenticated
  using (
    upper(coalesce(public.approval_requests.approval_level, '')) = 'L4_ACCOUNTS'
    and exists (
      select 1
      from public.users me
      where (
          (me.auth_uuid is not null and me.auth_uuid = (select auth.uid()))
          or lower(coalesce(me.email, '')) = lower((select public.current_auth_email()))
        )
        and lower(coalesce(me.university_role::text, '')) = 'finance_officer'
    )
  )
  with check (
    upper(coalesce(public.approval_requests.approval_level, '')) = 'L4_ACCOUNTS'
    and exists (
      select 1
      from public.users me
      where (
          (me.auth_uuid is not null and me.auth_uuid = (select auth.uid()))
          or lower(coalesce(me.email, '')) = lower((select public.current_auth_email()))
        )
        and lower(coalesce(me.university_role::text, '')) = 'finance_officer'
    )
  );
