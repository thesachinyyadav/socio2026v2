-- Migration: 026_backfill_hod_dean_chain_and_school_scope.sql
-- Purpose:
-- 1) Backfill approval_requests.organizing_school from entity rows and department-school mappings.
-- 2) Enforce HOD -> DEAN sequence for active approval requests missing a DEAN step.
-- 3) Normalize active step statuses so only one current step is PENDING.

alter table if exists public.approval_requests
  add column if not exists organizing_school text;

-- Backfill request scope directly from events/fests when missing.
update public.approval_requests ar
set
  organizing_dept = coalesce(nullif(trim(ar.organizing_dept), ''), e.organizing_dept),
  organizing_school = coalesce(nullif(trim(ar.organizing_school), ''), e.organizing_school)
from public.events e
where trim(coalesce(ar.entity_ref, '')) = trim(coalesce(e.event_id, ''))
  and upper(coalesce(ar.entity_type, '')) in ('EVENT', 'STANDALONE_EVENT', 'FEST_CHILD_EVENT')
  and (
    coalesce(trim(ar.organizing_dept), '') = ''
    or coalesce(trim(ar.organizing_school), '') = ''
  );

update public.approval_requests ar
set
  organizing_dept = coalesce(nullif(trim(ar.organizing_dept), ''), f.organizing_dept),
  organizing_school = coalesce(nullif(trim(ar.organizing_school), ''), f.organizing_school)
from public.fests f
where trim(coalesce(ar.entity_ref, '')) = trim(coalesce(f.fest_id, ''))
  and upper(coalesce(ar.entity_type, '')) = 'FEST'
  and (
    coalesce(trim(ar.organizing_dept), '') = ''
    or coalesce(trim(ar.organizing_school), '') = ''
  );

do $$
begin
  if to_regclass('public.fest') is not null then
    execute '
      update public.approval_requests ar
      set
        organizing_dept = coalesce(nullif(trim(ar.organizing_dept), ''''), fest.organizing_dept),
        organizing_school = coalesce(nullif(trim(ar.organizing_school), ''''), fest.organizing_school)
      from public.fest fest
      where trim(coalesce(ar.entity_ref, '''')) = trim(coalesce(fest.fest_id, ''''))
        and upper(coalesce(ar.entity_type, '''')) = ''FEST''
        and (
          coalesce(trim(ar.organizing_dept), '''') = ''''
          or coalesce(trim(ar.organizing_school), '''') = ''''
        )';
  end if;
end $$;

-- Backfill school from departments_courses when request school is still missing.
update public.approval_requests ar
set organizing_school = dc.school
from public.departments_courses dc
where coalesce(trim(ar.organizing_school), '') = ''
  and coalesce(trim(dc.school), '') <> ''
  and lower(
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(ar.organizing_dept, ''), '[_-]+', ' ', 'g'),
              '^(department\s+of\s+|department\s+|dept\s+)',
              '',
              'i'
            ),
            '\s+',
            ' ',
            'g'
          )
        )
      ) = lower(
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(dc.department_name, ''), '[_-]+', ' ', 'g'),
              '^(department\s+of\s+|department\s+|dept\s+)',
              '',
              'i'
            ),
            '\s+',
            ' ',
            'g'
          )
        )
      );

-- Backfill school from department_school as a secondary source.
update public.approval_requests ar
set organizing_school = ds.school
from public.department_school ds
where coalesce(trim(ar.organizing_school), '') = ''
  and coalesce(trim(ds.school), '') <> ''
  and lower(
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(ar.organizing_dept, ''), '[_-]+', ' ', 'g'),
              '^(department\s+of\s+|department\s+|dept\s+)',
              '',
              'i'
            ),
            '\s+',
            ' ',
            'g'
          )
        )
      ) = lower(
        trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(ds.department_name, ''), '[_-]+', ' ', 'g'),
              '^(department\s+of\s+|department\s+|dept\s+)',
              '',
              'i'
            ),
            '\s+',
            ' ',
            'g'
          )
        )
      );

-- Insert missing DEAN step for active requests that currently have HOD but no DEAN.
with target_requests as (
  select
    s.approval_request_id,
    s.sequence_order as hod_sequence_order,
    coalesce(s.step_group, s.sequence_order) as hod_step_group,
    upper(coalesce(s.status, 'PENDING')) as hod_status
  from public.approval_steps s
  join public.approval_requests ar
    on ar.id = s.approval_request_id
  where upper(coalesce(s.role_code, s.step_code, '')) = 'HOD'
    and upper(coalesce(ar.status, '')) in ('UNDER_REVIEW', 'PENDING', 'DRAFT')
    and not exists (
      select 1
      from public.approval_steps dean_step
      where dean_step.approval_request_id = s.approval_request_id
        and upper(coalesce(dean_step.role_code, dean_step.step_code, '')) = 'DEAN'
    )
),
shifted as (
  update public.approval_steps step_row
  set
    sequence_order = step_row.sequence_order + 1,
    step_group = coalesce(step_row.step_group, step_row.sequence_order) + 1,
    updated_at = now()
  from target_requests tr
  where step_row.approval_request_id = tr.approval_request_id
    and step_row.sequence_order > tr.hod_sequence_order
  returning step_row.id
)
insert into public.approval_steps (
  approval_request_id,
  step_code,
  role_code,
  step_group,
  sequence_order,
  required_count,
  status,
  created_at,
  updated_at
)
select
  tr.approval_request_id,
  'DEAN',
  'DEAN',
  tr.hod_step_group + 1,
  tr.hod_sequence_order + 1,
  1,
  case when tr.hod_status = 'APPROVED' then 'PENDING' else 'WAITING' end,
  now(),
  now()
from target_requests tr
where not exists (
  select 1
  from public.approval_steps dean_step
  where dean_step.approval_request_id = tr.approval_request_id
    and upper(coalesce(dean_step.role_code, dean_step.step_code, '')) = 'DEAN'
);

-- Ensure there is only one active PENDING step per active request.
with candidate_steps as (
  select
    s.id,
    s.approval_request_id,
    row_number() over (
      partition by s.approval_request_id
      order by s.sequence_order asc, s.created_at asc, s.id asc
    ) as step_rank
  from public.approval_steps s
  join public.approval_requests ar
    on ar.id = s.approval_request_id
  where upper(coalesce(ar.status, '')) in ('UNDER_REVIEW', 'PENDING', 'DRAFT')
    and upper(coalesce(s.status, '')) in ('PENDING', 'WAITING')
),
normalized_status as (
  select
    cs.id,
    case when cs.step_rank = 1 then 'PENDING' else 'WAITING' end as target_status
  from candidate_steps cs
)
update public.approval_steps s
set
  status = ns.target_status,
  updated_at = now()
from normalized_status ns
where s.id = ns.id
  and upper(coalesce(s.status, '')) <> ns.target_status;

-- Keep active requests explicitly in under-review state when pending/waiting steps exist.
update public.approval_requests ar
set
  status = 'UNDER_REVIEW',
  updated_at = now()
where upper(coalesce(ar.status, '')) in ('PENDING', 'DRAFT')
  and exists (
    select 1
    from public.approval_steps s
    where s.approval_request_id = ar.id
      and upper(coalesce(s.status, '')) in ('PENDING', 'WAITING')
  );
