-- Migration: 022_setup_rls_policies
-- Description: Enables and configures RLS for Module 11 tables

-- 1. Enable RLS on all related tables
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_chain_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fest_subheads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_incharge_config ENABLE ROW LEVEL SECURITY;

-- 2. APPROVAL_REQUESTS POLICIES
DROP POLICY IF EXISTS "approval_requests_select" ON public.approval_requests;
CREATE POLICY "approval_requests_select" ON public.approval_requests
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = requester_email OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_email = auth.jwt() ->> 'email' 
      AND ur.role_code IN ('MASTER_ADMIN', 'HOD', 'DEAN', 'CFO', 'ACCOUNTS')
    )
  );

-- 3. APPROVAL_STEPS POLICIES
DROP POLICY IF EXISTS "approval_steps_select" ON public.approval_steps;
CREATE POLICY "approval_steps_select" ON public.approval_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests ar 
      WHERE ar.id = approval_request_id
    )
  );

-- 4. APPROVAL_CHAIN_LOG POLICIES
DROP POLICY IF EXISTS "approval_chain_log_select" ON public.approval_chain_log;
CREATE POLICY "approval_chain_log_select" ON public.approval_chain_log
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = actor_email OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_email = auth.jwt() ->> 'email' 
      AND ur.role_code = 'MASTER_ADMIN'
    )
  );

-- 5. FEST_SUBHEADS POLICIES
DROP POLICY IF EXISTS "fest_subheads_select" ON public.fest_subheads;
CREATE POLICY "fest_subheads_select" ON public.fest_subheads
  FOR SELECT
  USING (true); -- Publicly viewable by participants/staff

DROP POLICY IF EXISTS "fest_subheads_all" ON public.fest_subheads;
CREATE POLICY "fest_subheads_all" ON public.fest_subheads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.fests f 
      WHERE f.fest_id = fest_id AND f.created_by = auth.jwt() ->> 'email'
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_email = auth.jwt() ->> 'email' AND ur.role_code = 'MASTER_ADMIN'
    )
  );

-- 6. SERVICE_REQUESTS POLICIES
DROP POLICY IF EXISTS "service_requests_select" ON public.service_requests;
CREATE POLICY "service_requests_select" ON public.service_requests
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = requester_email OR
    auth.jwt() ->> 'email' = assigned_incharge_email OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_email = auth.jwt() ->> 'email' AND ur.role_code = 'MASTER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "service_requests_insert" ON public.service_requests;
CREATE POLICY "service_requests_insert" ON public.service_requests
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = requester_email);

DROP POLICY IF EXISTS "service_requests_update" ON public.service_requests;
CREATE POLICY "service_requests_update" ON public.service_requests
  FOR UPDATE
  USING (
    auth.jwt() ->> 'email' = assigned_incharge_email OR
    auth.jwt() ->> 'email' = requester_email OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_email = auth.jwt() ->> 'email' AND ur.role_code = 'MASTER_ADMIN'
    )
  );

-- 7. SERVICE_INCHARGE_CONFIG POLICIES
DROP POLICY IF EXISTS "service_incharge_config_select" ON public.service_incharge_config;
CREATE POLICY "service_incharge_config_select" ON public.service_incharge_config
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_incharge_config_all" ON public.service_incharge_config;
CREATE POLICY "service_incharge_config_all" ON public.service_incharge_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_email = auth.jwt() ->> 'email' AND ur.role_code = 'MASTER_ADMIN'
    )
  );
