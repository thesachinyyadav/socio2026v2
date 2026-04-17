-- Migration: add_l5_service_approval_policies
-- Fix: approval_requests_select (migration 022) never included SERVICE_* roles,
--      locking service dashboards out of L5 rows entirely. Add scoped UPDATE too.

-- Extend SELECT to include service roles (existing roles unchanged)
DROP POLICY IF EXISTS "approval_requests_select" ON public.approval_requests;
CREATE POLICY "approval_requests_select" ON public.approval_requests
  FOR SELECT
  TO authenticated
  USING (
    lower(coalesce(requested_by_email, '')) = public.current_auth_email()
    OR public.current_user_has_any_role(ARRAY[
      'MASTER_ADMIN',
      'HOD', 'DEAN', 'CFO', 'ACCOUNTS', 'FINANCE_OFFICER',
      'SERVICE_IT', 'SERVICE_VENUE', 'SERVICE_CATERING', 'SERVICE_STALLS'
    ])
  );

-- Allow each service role to update only its own L5 pending row
DROP POLICY IF EXISTS "approval_requests_l5_update" ON public.approval_requests;
CREATE POLICY "approval_requests_l5_update" ON public.approval_requests
  FOR UPDATE
  TO authenticated
  USING (
    upper(coalesce(approval_level, '')) IN ('L5_IT', 'L5_VENUE', 'L5_CATERING', 'L5_STALLS')
    AND lower(coalesce(status, '')) = 'pending'
    AND (
      (upper(coalesce(approval_level, '')) = 'L5_IT'      AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_IT']))
      OR (upper(coalesce(approval_level, '')) = 'L5_VENUE'    AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_VENUE']))
      OR (upper(coalesce(approval_level, '')) = 'L5_CATERING' AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_CATERING']))
      OR (upper(coalesce(approval_level, '')) = 'L5_STALLS'   AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_STALLS']))
    )
  )
  WITH CHECK (
    upper(coalesce(approval_level, '')) IN ('L5_IT', 'L5_VENUE', 'L5_CATERING', 'L5_STALLS')
    AND (
      (upper(coalesce(approval_level, '')) = 'L5_IT'      AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_IT']))
      OR (upper(coalesce(approval_level, '')) = 'L5_VENUE'    AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_VENUE']))
      OR (upper(coalesce(approval_level, '')) = 'L5_CATERING' AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_CATERING']))
      OR (upper(coalesce(approval_level, '')) = 'L5_STALLS'   AND public.current_user_has_any_role(ARRAY['MASTER_ADMIN', 'SERVICE_STALLS']))
    )
  );
