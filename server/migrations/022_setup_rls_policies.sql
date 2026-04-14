-- Migration: 022_setup_rls_policies
-- Description: Enables and configures RLS for Module 11 tables

-- 1. Helper functions for role-aware RLS checks.
-- This migration uses `public.users` role flags plus `university_role`.

CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(role_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT
      coalesce(is_masteradmin, false) AS is_masteradmin,
      coalesce(is_hod, false) AS is_hod,
      coalesce(is_dean, false) AS is_dean,
      coalesce(is_cfo, false) AS is_cfo,
      coalesce(is_finance_office, false) AS is_finance_office,
      coalesce(is_organiser, false) AS is_organiser,
      coalesce(is_organiser_student, false) AS is_organiser_student,
      lower(coalesce(university_role, '')) AS university_role
    FROM public.users
    WHERE
      lower(coalesce(email, '')) = public.current_auth_email()
      OR (
        auth.uid() IS NOT NULL
        AND coalesce(auth_uuid::text, '') = auth.uid()::text
      )
    ORDER BY CASE WHEN lower(coalesce(email, '')) = public.current_auth_email() THEN 0 ELSE 1 END
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM me
    WHERE
      CASE upper(coalesce(role_code, ''))
        WHEN 'MASTER_ADMIN' THEN is_masteradmin OR university_role IN ('master_admin', 'masteradmin')
        WHEN 'HOD' THEN is_hod OR university_role = 'hod'
        WHEN 'DEAN' THEN is_dean OR university_role = 'dean'
        WHEN 'CFO' THEN is_cfo OR university_role = 'cfo'
        WHEN 'ACCOUNTS' THEN is_finance_office OR university_role IN ('accounts', 'finance_officer')
        WHEN 'FINANCE_OFFICER' THEN is_finance_office OR university_role IN ('accounts', 'finance_officer')
        WHEN 'ORGANIZER_TEACHER' THEN is_organiser OR university_role IN ('organizer_teacher', 'organiser', 'organizer')
        WHEN 'ORGANIZER_STUDENT' THEN is_organiser_student OR university_role IN ('organizer_student', 'organiser_student')
        ELSE false
      END
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(role_codes TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(coalesce(role_codes, ARRAY[]::TEXT[])) AS roles(role_code)
    WHERE public.current_user_has_role(roles.role_code)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_fest_manager(target_fest_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fests f
    WHERE f.fest_id = target_fest_id
      AND (
        lower(coalesce(f.created_by, '')) = public.current_auth_email()
        OR lower(coalesce(f.contact_email, '')) = public.current_auth_email()
        OR (
          auth.uid() IS NOT NULL
          AND coalesce(f.auth_uuid::text, '') = auth.uid()::text
        )
      )
  );
$$;

-- 2. Enable RLS on all related tables.
ALTER TABLE IF EXISTS public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.approval_chain_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fest_subheads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_incharge_config ENABLE ROW LEVEL SECURITY;

-- 3. APPROVAL_REQUESTS POLICIES
DROP POLICY IF EXISTS "approval_requests_select" ON public.approval_requests;
CREATE POLICY "approval_requests_select" ON public.approval_requests
  FOR SELECT
  USING (
    lower(coalesce(requester_email, '')) = public.current_auth_email()
    OR public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

-- 4. APPROVAL_STEPS POLICIES
DROP POLICY IF EXISTS "approval_steps_select" ON public.approval_steps;
CREATE POLICY "approval_steps_select" ON public.approval_steps
  FOR SELECT
  USING (
    public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
    OR EXISTS (
      SELECT 1
      FROM public.approval_requests ar
      WHERE ar.id = approval_request_id
        AND lower(coalesce(ar.requester_email, '')) = public.current_auth_email()
    )
  );

-- 5. APPROVAL_CHAIN_LOG POLICIES
DROP POLICY IF EXISTS "approval_chain_log_select" ON public.approval_chain_log;
CREATE POLICY "approval_chain_log_select" ON public.approval_chain_log
  FOR SELECT
  USING (
    lower(coalesce(actor_email, '')) = public.current_auth_email()
    OR public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
    OR (
      entity_type = 'event'
      AND EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.event_id = entity_id
          AND lower(coalesce(e.organizer_email, '')) = public.current_auth_email()
      )
    )
    OR (
      entity_type = 'fest'
      AND public.current_user_is_fest_manager(entity_id)
    )
  );

-- 6. FEST_SUBHEADS POLICIES
DROP POLICY IF EXISTS "fest_subheads_select" ON public.fest_subheads;
CREATE POLICY "fest_subheads_select" ON public.fest_subheads
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "fest_subheads_all" ON public.fest_subheads;
CREATE POLICY "fest_subheads_all" ON public.fest_subheads
  FOR ALL
  USING (
    public.current_user_is_fest_manager(fest_id)
    OR public.current_user_has_role('MASTER_ADMIN')
  )
  WITH CHECK (
    public.current_user_is_fest_manager(fest_id)
    OR public.current_user_has_role('MASTER_ADMIN')
  );

-- 7. SERVICE_REQUESTS POLICIES
DROP POLICY IF EXISTS "service_requests_select" ON public.service_requests;
CREATE POLICY "service_requests_select" ON public.service_requests
  FOR SELECT
  USING (
    lower(coalesce(requester_email, '')) = public.current_auth_email()
    OR lower(coalesce(assigned_incharge_email, '')) = public.current_auth_email()
    OR public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
    OR (
      entity_type = 'event'
      AND EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.event_id = entity_id
          AND lower(coalesce(e.organizer_email, '')) = public.current_auth_email()
      )
    )
    OR (
      entity_type = 'fest'
      AND public.current_user_is_fest_manager(entity_id)
    )
  );

DROP POLICY IF EXISTS "service_requests_insert" ON public.service_requests;
CREATE POLICY "service_requests_insert" ON public.service_requests
  FOR INSERT
  WITH CHECK (
    lower(coalesce(requester_email, '')) = public.current_auth_email()
    OR public.current_user_has_role('MASTER_ADMIN')
  );

DROP POLICY IF EXISTS "service_requests_update" ON public.service_requests;
CREATE POLICY "service_requests_update" ON public.service_requests
  FOR UPDATE
  USING (
    lower(coalesce(assigned_incharge_email, '')) = public.current_auth_email()
    OR lower(coalesce(requester_email, '')) = public.current_auth_email()
    OR public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
  )
  WITH CHECK (
    lower(coalesce(assigned_incharge_email, '')) = public.current_auth_email()
    OR lower(coalesce(requester_email, '')) = public.current_auth_email()
    OR public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

-- 8. SERVICE_INCHARGE_CONFIG POLICIES
DROP POLICY IF EXISTS "service_incharge_config_select" ON public.service_incharge_config;
CREATE POLICY "service_incharge_config_select" ON public.service_incharge_config
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_incharge_config_all" ON public.service_incharge_config;
CREATE POLICY "service_incharge_config_all" ON public.service_incharge_config
  FOR ALL
  USING (public.current_user_has_role('MASTER_ADMIN'))
  WITH CHECK (public.current_user_has_role('MASTER_ADMIN'));
