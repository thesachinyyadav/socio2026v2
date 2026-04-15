-- Migration: 026_supabase_hardening_rls_fk_indexes
-- Purpose: Address Supabase advisor security/performance findings safely.
-- Scope:
-- 1) Add missing FK-covering indexes.
-- 2) Set explicit function search_path for mutable functions.
-- 3) Enable scoped RLS for remaining public tables flagged by advisors.
-- 4) Tune user_role_assignments policy to avoid per-row auth function re-evaluation.

-- ---------------------------------------------------------------------------
-- 1) FK-covering indexes (performance)
-- ---------------------------------------------------------------------------
create index if not exists idx_approval_decisions_decided_by_user_id
  on public.approval_decisions(decided_by_user_id);

create index if not exists idx_approval_requests_requested_by_user_id
  on public.approval_requests(requested_by_user_id);

create index if not exists idx_events_approval_request_id
  on public.events(approval_request_id);

create index if not exists idx_fests_approval_request_id
  on public.fests(approval_request_id);

create index if not exists idx_service_decisions_decided_by_user_id
  on public.service_decisions(decided_by_user_id);

create index if not exists idx_service_requests_approval_request_id
  on public.service_requests(approval_request_id);

create index if not exists idx_service_requests_requested_by_user_id
  on public.service_requests(requested_by_user_id);

-- ---------------------------------------------------------------------------
-- 2) Function search_path hardening (security)
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'set_notification_user_status_updated_at',
        'prevent_audit_log_mutation',
        'enforce_lifecycle_draft_consistency',
        'current_auth_email',
        'sync_event_fest_fields'
      )
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, pg_temp;',
      fn.proname,
      fn.identity_args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) RLS enablement for advisor-flagged tables (security)
-- ---------------------------------------------------------------------------
alter table if exists public.approval_decisions enable row level security;
alter table if exists public.department_approval_routing enable row level security;
alter table if exists public.department_school enable row level security;
alter table if exists public.departments_courses enable row level security;
alter table if exists public.event_budgets enable row level security;
alter table if exists public.expense_documents enable row level security;
alter table if exists public.finance_audit_log enable row level security;
alter table if exists public.service_decisions enable row level security;

-- Grants/revokes aligned to scoped policies.
revoke all on table public.approval_decisions from anon;
revoke all on table public.department_approval_routing from anon;
revoke all on table public.department_school from anon;
revoke all on table public.event_budgets from anon;
revoke all on table public.expense_documents from anon;
revoke all on table public.finance_audit_log from anon;
revoke all on table public.service_decisions from anon;

-- Keep departments as readable lookup data for public forms and UI.
grant select on table public.departments_courses to anon;
grant select on table public.departments_courses to authenticated;

-- Authenticated access to scoped workflow/finance data (enforced by policies).
grant select on table public.approval_decisions to authenticated;
grant select on table public.department_approval_routing to authenticated;
grant select on table public.department_school to authenticated;
grant select on table public.event_budgets to authenticated;
grant update on table public.event_budgets to authenticated;
grant select on table public.expense_documents to authenticated;
grant insert on table public.expense_documents to authenticated;
grant update on table public.expense_documents to authenticated;
grant select on table public.finance_audit_log to authenticated;
grant insert on table public.finance_audit_log to authenticated;
grant select on table public.service_decisions to authenticated;

-- approval_decisions: requester and workflow roles can read.
drop policy if exists approval_decisions_select_scoped on public.approval_decisions;
create policy approval_decisions_select_scoped
  on public.approval_decisions
  for select
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
    or exists (
      select 1
      from public.approval_requests ar
      where ar.id = public.approval_decisions.approval_request_id
        and lower(coalesce(ar.requested_by_email, '')) = public.current_auth_email()
    )
  );

-- department_approval_routing: internal routing matrix.
drop policy if exists department_approval_routing_select_scoped on public.department_approval_routing;
create policy department_approval_routing_select_scoped
  on public.department_approval_routing
  for select
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER', 'ORGANIZER_TEACHER'])
  );

-- department_school: lookup for scoped workflows.
drop policy if exists department_school_select_authenticated on public.department_school;
create policy department_school_select_authenticated
  on public.department_school
  for select
  to authenticated
  using (true);

-- departments_courses: public lookup table.
drop policy if exists departments_courses_read_public on public.departments_courses;
create policy departments_courses_read_public
  on public.departments_courses
  for select
  to anon, authenticated
  using (true);

-- event_budgets: finance and approval actors, plus event owners.
drop policy if exists event_budgets_select_scoped on public.event_budgets;
create policy event_budgets_select_scoped
  on public.event_budgets
  for select
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER', 'ORGANIZER_TEACHER'])
    or exists (
      select 1
      from public.events e
      where e.event_id = public.event_budgets.event_id
        and lower(
          coalesce(
            e.organizer_email,
            e.created_by,
            ''
          )
        ) = public.current_auth_email()
    )
  );

drop policy if exists event_budgets_update_finance on public.event_budgets;
create policy event_budgets_update_finance
  on public.event_budgets
  for update
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  )
  with check (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

-- expense_documents: finance roles, event owners, and uploaders.
drop policy if exists expense_documents_select_scoped on public.expense_documents;
create policy expense_documents_select_scoped
  on public.expense_documents
  for select
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
    or lower(coalesce(public.expense_documents.uploaded_by, '')) = public.current_auth_email()
    or exists (
      select 1
      from public.events e
      where e.event_id = public.expense_documents.event_id
        and lower(
          coalesce(
            e.organizer_email,
            e.created_by,
            ''
          )
        ) = public.current_auth_email()
    )
  );

drop policy if exists expense_documents_insert_scoped on public.expense_documents;
create policy expense_documents_insert_scoped
  on public.expense_documents
  for insert
  to authenticated
  with check (
    lower(coalesce(public.expense_documents.uploaded_by, '')) = public.current_auth_email()
    or public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

drop policy if exists expense_documents_update_finance on public.expense_documents;
create policy expense_documents_update_finance
  on public.expense_documents
  for update
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  )
  with check (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

-- finance_audit_log: finance-only read/write.
drop policy if exists finance_audit_log_select_finance on public.finance_audit_log;
create policy finance_audit_log_select_finance
  on public.finance_audit_log
  for select
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

drop policy if exists finance_audit_log_insert_finance on public.finance_audit_log;
create policy finance_audit_log_insert_finance
  on public.finance_audit_log
  for insert
  to authenticated
  with check (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

-- service_decisions: service actors, managers, and requester/incharge visibility.
drop policy if exists service_decisions_select_scoped on public.service_decisions;
create policy service_decisions_select_scoped
  on public.service_decisions
  for select
  to authenticated
  using (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
    or exists (
      select 1
      from public.service_requests sr
      where sr.id = public.service_decisions.service_request_id
        and (
          lower(coalesce(sr.requester_email, sr.requested_by_email, '')) = public.current_auth_email()
          or lower(coalesce(sr.assigned_incharge_email, '')) = public.current_auth_email()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) RLS initplan tuning for existing policy (performance)
-- ---------------------------------------------------------------------------
drop policy if exists user_role_assignments_select_scoped on public.user_role_assignments;
create policy user_role_assignments_select_scoped
  on public.user_role_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users me
      where me.id = public.user_role_assignments.user_id
        and (
          (me.auth_uuid is not null and me.auth_uuid = (select auth.uid()))
          or lower(me.email) = lower((select public.current_auth_email()))
        )
    )
    or exists (
      select 1
      from public.users me
      where (
          (me.auth_uuid is not null and me.auth_uuid = (select auth.uid()))
          or lower(me.email) = lower((select public.current_auth_email()))
        )
        and coalesce(me.is_masteradmin, false) = true
    )
  );
