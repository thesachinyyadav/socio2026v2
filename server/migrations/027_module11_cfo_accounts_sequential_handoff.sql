-- Migration: 027_module11_cfo_accounts_sequential_handoff
-- Purpose:
-- 1) Enforce transactional L3_CFO -> L4_ACCOUNTS handoff.
-- 2) Route events to logistics only after L4 approval.
-- 3) Add explicit L4 Accounts RLS policies for finance reviewers.

create extension if not exists pgcrypto;

alter table if exists public.approval_requests
  add column if not exists approval_level text,
  add column if not exists event_id text,
  add column if not exists previous_approval_request_id uuid references public.approval_requests(id) on delete set null,
  add column if not exists cfo_approved_at timestamptz,
  add column if not exists cfo_approved_by text;

alter table if exists public.service_requests
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists service_type text,
  add column if not exists requester_email text;

update public.approval_requests ar
set event_id = nullif(trim(ar.entity_ref), '')
where coalesce(trim(ar.event_id), '') = ''
  and upper(coalesce(ar.entity_type, '')) in ('EVENT', 'STANDALONE_EVENT', 'FEST_CHILD_EVENT');

update public.approval_requests ar
set
  event_id = coalesce(nullif(trim(ar.event_id), ''), e.event_id),
  approval_level = coalesce(
    nullif(trim(ar.approval_level), ''),
    case
      when lower(coalesce(e.workflow_status, '')) = 'pending_cfo' then 'L3_CFO'
      when lower(coalesce(e.workflow_status, '')) = 'pending_accounts' then 'L4_ACCOUNTS'
      else null
    end
  )
from public.events e
where e.approval_request_id = ar.id
  and (
    coalesce(trim(ar.event_id), '') = ''
    or coalesce(trim(ar.approval_level), '') = ''
  );

update public.service_requests sr
set requester_email = coalesce(nullif(trim(sr.requested_by_email), ''), sr.requester_email)
where coalesce(trim(sr.requester_email), '') = ''
  and coalesce(trim(sr.requested_by_email), '') <> '';

update public.service_requests sr
set
  entity_type = coalesce(nullif(trim(sr.entity_type), ''), 'event'),
  entity_id = coalesce(nullif(trim(sr.entity_id), ''), sr.event_id),
  service_type = coalesce(
    nullif(trim(sr.service_type), ''),
    case
      when upper(coalesce(sr.service_role_code, '')) = 'SERVICE_IT' then 'it'
      when upper(coalesce(sr.service_role_code, '')) = 'SERVICE_VENUE' then 'venue'
      when upper(coalesce(sr.service_role_code, '')) = 'SERVICE_CATERING' then 'catering'
      when upper(coalesce(sr.service_role_code, '')) = 'SERVICE_STALLS' then 'stalls'
      else 'other'
    end
  )
where coalesce(trim(sr.entity_type), '') = ''
   or coalesce(trim(sr.entity_id), '') = ''
   or coalesce(trim(sr.service_type), '') = '';

create index if not exists idx_approval_requests_level_status
  on public.approval_requests(approval_level, status, submitted_at desc);

create index if not exists idx_approval_requests_event_level
  on public.approval_requests(event_id, approval_level, created_at desc);

create index if not exists idx_approval_requests_prev_request
  on public.approval_requests(previous_approval_request_id);

create or replace function public.process_cfo_approval_handoff(
  p_l3_request_id uuid,
  p_actor_email text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_actor_email text := lower(nullif(trim(coalesce(p_actor_email, public.current_auth_email())), ''));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_l3 public.approval_requests%rowtype;
  v_event_id text;
  v_existing_l4_id uuid;
  v_new_l4_id uuid;
  v_generated_request_id text;
begin
  if p_l3_request_id is null then
    raise exception 'L3 request id is required';
  end if;

  if not public.current_user_has_any_role(array['MASTER_ADMIN', 'CFO']) then
    raise exception 'Only CFO or Master Admin can approve L3 handoff'
      using errcode = '42501';
  end if;

  select *
    into v_l3
  from public.approval_requests
  where id = p_l3_request_id
  for update;

  if not found then
    raise exception 'L3 approval request not found';
  end if;

  if upper(coalesce(v_l3.approval_level, '')) <> 'L3_CFO' then
    raise exception 'Request % is not an L3_CFO request', p_l3_request_id;
  end if;

  v_event_id := nullif(trim(coalesce(v_l3.event_id, v_l3.entity_ref)), '');
  if v_event_id is null then
    raise exception 'L3 request % is not linked to an event', p_l3_request_id;
  end if;

  -- Lock event row to avoid concurrent pointer/phase updates.
  perform 1
  from public.events
  where event_id = v_event_id
  for update;

  if not found then
    raise exception 'Event % was not found for L3 request', v_event_id;
  end if;

  select ar.id
    into v_existing_l4_id
  from public.approval_requests ar
  where coalesce(ar.event_id, ar.entity_ref) = v_event_id
    and upper(coalesce(ar.approval_level, '')) = 'L4_ACCOUNTS'
    and lower(coalesce(ar.status, '')) = 'pending'
  order by ar.created_at desc
  limit 1
  for update;

  if lower(coalesce(v_l3.status, '')) = 'approved' and v_existing_l4_id is not null then
    update public.events
    set
      approval_request_id = v_existing_l4_id,
      workflow_status = 'pending_accounts',
      workflow_phase = 'finance_approval',
      approval_state = 'UNDER_REVIEW',
      activation_state = 'PENDING',
      status = 'draft',
      is_draft = true,
      updated_at = v_now
    where event_id = v_event_id;

    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'l3_request_id', v_l3.id,
      'l4_request_id', v_existing_l4_id,
      'event_id', v_event_id,
      'message', 'L3 already approved and linked to active L4 request.'
    );
  end if;

  if lower(coalesce(v_l3.status, '')) not in ('pending', 'under_review') then
    raise exception 'L3 request % is no longer pending (status=%)', p_l3_request_id, v_l3.status;
  end if;

  update public.approval_requests
  set
    status = 'approved',
    decided_at = v_now,
    latest_comment = coalesce(v_note, latest_comment),
    cfo_approved_at = v_now,
    cfo_approved_by = coalesce(v_actor_email, cfo_approved_by),
    updated_at = v_now
  where id = v_l3.id;

  if v_existing_l4_id is null then
    v_generated_request_id := format(
      'APR-L4-%s-%s',
      regexp_replace(v_event_id, '[^A-Za-z0-9]+', '-', 'g'),
      encode(gen_random_bytes(4), 'hex')
    );

    insert into public.approval_requests (
      request_id,
      entity_type,
      entity_ref,
      parent_fest_ref,
      requested_by_user_id,
      requested_by_email,
      organizing_dept,
      organizing_school,
      campus_hosted_at,
      is_budget_related,
      status,
      submitted_at,
      latest_comment,
      approval_level,
      event_id,
      previous_approval_request_id,
      cfo_approved_at,
      cfo_approved_by,
      created_at,
      updated_at
    )
    values (
      v_generated_request_id,
      coalesce(v_l3.entity_type, 'STANDALONE_EVENT'),
      v_event_id,
      v_l3.parent_fest_ref,
      v_l3.requested_by_user_id,
      v_l3.requested_by_email,
      v_l3.organizing_dept,
      v_l3.organizing_school,
      v_l3.campus_hosted_at,
      coalesce(v_l3.is_budget_related, true),
      'pending',
      v_now,
      null,
      'L4_ACCOUNTS',
      v_event_id,
      v_l3.id,
      v_now,
      coalesce(v_actor_email, v_l3.requested_by_email),
      v_now,
      v_now
    )
    returning id into v_new_l4_id;
  else
    v_new_l4_id := v_existing_l4_id;
  end if;

  -- Critical Module 11 state update:
  -- keep event in finance phase and point queue ownership to the new L4 row.
  update public.events
  set
    approval_request_id = v_new_l4_id,
    workflow_status = 'pending_accounts',
    workflow_phase = 'finance_approval',
    approval_state = 'UNDER_REVIEW',
    activation_state = 'PENDING',
    status = 'draft',
    is_draft = true,
    updated_at = v_now
  where event_id = v_event_id;

  return jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'l3_request_id', v_l3.id,
    'l4_request_id', v_new_l4_id,
    'event_id', v_event_id,
    'message', 'L3 approved and handed off to L4 Accounts.'
  );
end;
$$;

create or replace function public.process_accounts_approval_route_logistics(
  p_l4_request_id uuid,
  p_actor_email text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_actor_email text := lower(nullif(trim(coalesce(p_actor_email, public.current_auth_email())), ''));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_l4 public.approval_requests%rowtype;
  v_event_id text;
  v_has_it boolean := false;
  v_has_venue boolean := false;
  v_has_catering boolean := false;
  v_it_snapshot jsonb := '{}'::jsonb;
  v_venue_snapshot jsonb := '{}'::jsonb;
  v_catering_snapshot jsonb := '{}'::jsonb;
  v_created_count integer := 0;
  v_promoted_queued_count integer := 0;
  v_pending_service_count integer := 0;
begin
  if p_l4_request_id is null then
    raise exception 'L4 request id is required';
  end if;

  if not public.current_user_has_any_role(array['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER']) then
    raise exception 'Only Accounts, Finance Officer, or Master Admin can approve L4'
      using errcode = '42501';
  end if;

  select *
    into v_l4
  from public.approval_requests
  where id = p_l4_request_id
  for update;

  if not found then
    raise exception 'L4 approval request not found';
  end if;

  if upper(coalesce(v_l4.approval_level, '')) <> 'L4_ACCOUNTS' then
    raise exception 'Request % is not an L4_ACCOUNTS request', p_l4_request_id;
  end if;

  v_event_id := nullif(trim(coalesce(v_l4.event_id, v_l4.entity_ref)), '');
  if v_event_id is null then
    raise exception 'L4 request % is not linked to an event', p_l4_request_id;
  end if;

  perform 1
  from public.events
  where event_id = v_event_id
  for update;

  if not found then
    raise exception 'Event % was not found for L4 request', v_event_id;
  end if;

  if lower(coalesce(v_l4.status, '')) = 'approved' then
    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'l4_request_id', v_l4.id,
      'event_id', v_event_id,
      'message', 'L4 request is already approved.'
    );
  end if;

  if lower(coalesce(v_l4.status, '')) not in ('pending', 'under_review') then
    raise exception 'L4 request % is no longer pending (status=%)', p_l4_request_id, v_l4.status;
  end if;

  update public.approval_requests
  set
    status = 'approved',
    decided_at = v_now,
    latest_comment = coalesce(v_note, latest_comment),
    updated_at = v_now
  where id = v_l4.id;

  -- Promote any queued service rows from earlier drafts into active review.
  update public.service_requests
  set
    status = 'PENDING',
    updated_at = v_now
  where event_id = v_event_id
    and upper(coalesce(status, '')) = 'QUEUED';

  get diagnostics v_promoted_queued_count = row_count;

  -- Detect logistics demand from source tables.
  if to_regclass('public.event_resources') is not null then
    select exists(select 1 from public.event_resources er where er.event_id = v_event_id)
      into v_has_it;

    if v_has_it then
      select to_jsonb(er)
        into v_it_snapshot
      from public.event_resources er
      where er.event_id = v_event_id
      limit 1;
    end if;
  end if;

  if to_regclass('public.venue_bookings') is not null then
    select exists(select 1 from public.venue_bookings vb where vb.event_id = v_event_id)
      into v_has_venue;

    if v_has_venue then
      select to_jsonb(vb)
        into v_venue_snapshot
      from public.venue_bookings vb
      where vb.event_id = v_event_id
      limit 1;
    end if;
  end if;

  if to_regclass('public.catering_plans') is not null then
    select exists(select 1 from public.catering_plans cp where cp.event_id = v_event_id)
      into v_has_catering;

    if v_has_catering then
      select to_jsonb(cp)
        into v_catering_snapshot
      from public.catering_plans cp
      where cp.event_id = v_event_id
      limit 1;
    end if;
  end if;

  -- Create IT service request if resources are present and no active row exists.
  if v_has_it
     and not exists (
       select 1
       from public.service_requests sr
       where sr.event_id = v_event_id
         and upper(coalesce(sr.service_role_code, '')) = 'SERVICE_IT'
         and upper(coalesce(sr.status, '')) in ('PENDING', 'QUEUED', 'APPROVED')
     ) then
    insert into public.service_requests (
      service_request_id,
      event_id,
      approval_request_id,
      service_role_code,
      requested_by_user_id,
      requested_by_email,
      requester_email,
      status,
      details,
      entity_type,
      entity_id,
      service_type,
      created_at,
      updated_at
    )
    values (
      format(
        'SR-%s-it-%s',
        regexp_replace(v_event_id, '[^A-Za-z0-9]+', '-', 'g'),
        encode(gen_random_bytes(3), 'hex')
      ),
      v_event_id,
      v_l4.id,
      'SERVICE_IT',
      v_l4.requested_by_user_id,
      coalesce(v_l4.requested_by_email, v_actor_email),
      coalesce(v_l4.requested_by_email, v_actor_email),
      'PENDING',
      jsonb_build_object(
        'auto_generated_by', 'process_accounts_approval_route_logistics',
        'source_table', 'event_resources',
        'source_snapshot', coalesce(v_it_snapshot, '{}'::jsonb),
        'generated_at', v_now
      ),
      'event',
      v_event_id,
      'it',
      v_now,
      v_now
    );

    v_created_count := v_created_count + 1;
  end if;

  -- Create Venue service request only after L4 approval.
  if v_has_venue
     and not exists (
       select 1
       from public.service_requests sr
       where sr.event_id = v_event_id
         and upper(coalesce(sr.service_role_code, '')) = 'SERVICE_VENUE'
         and upper(coalesce(sr.status, '')) in ('PENDING', 'QUEUED', 'APPROVED')
     ) then
    insert into public.service_requests (
      service_request_id,
      event_id,
      approval_request_id,
      service_role_code,
      requested_by_user_id,
      requested_by_email,
      requester_email,
      status,
      details,
      entity_type,
      entity_id,
      service_type,
      created_at,
      updated_at
    )
    values (
      format(
        'SR-%s-venue-%s',
        regexp_replace(v_event_id, '[^A-Za-z0-9]+', '-', 'g'),
        encode(gen_random_bytes(3), 'hex')
      ),
      v_event_id,
      v_l4.id,
      'SERVICE_VENUE',
      v_l4.requested_by_user_id,
      coalesce(v_l4.requested_by_email, v_actor_email),
      coalesce(v_l4.requested_by_email, v_actor_email),
      'PENDING',
      jsonb_build_object(
        'auto_generated_by', 'process_accounts_approval_route_logistics',
        'source_table', 'venue_bookings',
        'source_snapshot', coalesce(v_venue_snapshot, '{}'::jsonb),
        'generated_at', v_now
      ),
      'event',
      v_event_id,
      'venue',
      v_now,
      v_now
    );

    v_created_count := v_created_count + 1;
  end if;

  -- Create Catering service request only after L4 approval.
  if v_has_catering
     and not exists (
       select 1
       from public.service_requests sr
       where sr.event_id = v_event_id
         and upper(coalesce(sr.service_role_code, '')) = 'SERVICE_CATERING'
         and upper(coalesce(sr.status, '')) in ('PENDING', 'QUEUED', 'APPROVED')
     ) then
    insert into public.service_requests (
      service_request_id,
      event_id,
      approval_request_id,
      service_role_code,
      requested_by_user_id,
      requested_by_email,
      requester_email,
      status,
      details,
      entity_type,
      entity_id,
      service_type,
      created_at,
      updated_at
    )
    values (
      format(
        'SR-%s-catering-%s',
        regexp_replace(v_event_id, '[^A-Za-z0-9]+', '-', 'g'),
        encode(gen_random_bytes(3), 'hex')
      ),
      v_event_id,
      v_l4.id,
      'SERVICE_CATERING',
      v_l4.requested_by_user_id,
      coalesce(v_l4.requested_by_email, v_actor_email),
      coalesce(v_l4.requested_by_email, v_actor_email),
      'PENDING',
      jsonb_build_object(
        'auto_generated_by', 'process_accounts_approval_route_logistics',
        'source_table', 'catering_plans',
        'source_snapshot', coalesce(v_catering_snapshot, '{}'::jsonb),
        'generated_at', v_now
      ),
      'event',
      v_event_id,
      'catering',
      v_now,
      v_now
    );

    v_created_count := v_created_count + 1;
  end if;

  select count(*)
    into v_pending_service_count
  from public.service_requests sr
  where sr.event_id = v_event_id
    and upper(coalesce(sr.status, '')) in ('PENDING', 'QUEUED');

  -- Accounts approval closes finance and opens logistics phase when service rows are pending.
  update public.events
  set
    approval_request_id = v_l4.id,
    approval_state = 'APPROVED',
    service_approval_state = case when v_pending_service_count > 0 then 'PENDING' else 'APPROVED' end,
    activation_state = case when v_pending_service_count > 0 then 'PENDING' else 'ACTIVE' end,
    workflow_phase = case when v_pending_service_count > 0 then 'logistics_approval' else 'approved' end,
    workflow_status = 'fully_approved',
    status = case when v_pending_service_count > 0 then 'draft' else 'approved' end,
    is_draft = case when v_pending_service_count > 0 then true else false end,
    approved_at = coalesce(approved_at, v_now),
    approved_by = coalesce(approved_by, v_actor_email),
    rejected_at = null,
    rejected_by = null,
    rejection_reason = null,
    updated_at = v_now
  where event_id = v_event_id;

  return jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'l4_request_id', v_l4.id,
    'event_id', v_event_id,
    'created_service_requests', v_created_count,
    'promoted_queued_requests', v_promoted_queued_count,
    'pending_service_requests', v_pending_service_count,
    'workflow_phase', case when v_pending_service_count > 0 then 'logistics_approval' else 'approved' end,
    'message', 'L4 approved and logistics routing applied.'
  );
end;
$$;

grant execute on function public.process_cfo_approval_handoff(uuid, text, text) to authenticated;
grant execute on function public.process_accounts_approval_route_logistics(uuid, text, text) to authenticated;

grant select, update on table public.approval_requests to authenticated;

drop policy if exists approval_requests_select_l4_accounts_finance on public.approval_requests;
create policy approval_requests_select_l4_accounts_finance
  on public.approval_requests
  for select
  to authenticated
  using (
    upper(coalesce(approval_level, '')) = 'L4_ACCOUNTS'
    and lower(coalesce(status, '')) = 'pending'
    and public.current_user_has_any_role(array['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

drop policy if exists approval_requests_update_l4_accounts_finance on public.approval_requests;
create policy approval_requests_update_l4_accounts_finance
  on public.approval_requests
  for update
  to authenticated
  using (
    upper(coalesce(approval_level, '')) = 'L4_ACCOUNTS'
    and lower(coalesce(status, '')) = 'pending'
    and public.current_user_has_any_role(array['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  )
  with check (
    upper(coalesce(approval_level, '')) = 'L4_ACCOUNTS'
    and public.current_user_has_any_role(array['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );
