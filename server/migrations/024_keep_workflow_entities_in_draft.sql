-- Migration: 024_keep_workflow_entities_in_draft
-- Keep fests and standalone events in draft while approval workflows are still in progress.

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    UPDATE public.events
    SET status = 'draft',
        is_draft = true
    WHERE lower(coalesce(status, '')) = 'pending_approvals'
       OR lower(coalesce(approval_state, '')) IN ('under_review', 'pending')
       OR lower(coalesce(workflow_status, '')) IN (
         'pending_hod',
         'pending_dean',
         'pending_cfo',
         'pending_accounts',
         'pending_organiser'
       );

    ALTER TABLE public.events
      DROP CONSTRAINT IF EXISTS events_status_is_draft_consistency_chk;

    ALTER TABLE public.events
      ADD CONSTRAINT events_status_is_draft_consistency_chk
      CHECK (
        (status IN ('draft', 'revision_requested', 'pending_approvals') AND is_draft = true)
        OR
        (status IN ('approved', 'published') AND is_draft = false)
      );
  END IF;

  IF to_regclass('public.fests') IS NOT NULL THEN
    UPDATE public.fests
    SET status = 'draft',
        is_draft = true
    WHERE lower(coalesce(status, '')) = 'pending_approvals'
       OR lower(coalesce(approval_state, '')) IN ('under_review', 'pending')
       OR lower(coalesce(workflow_status, '')) IN (
         'pending_hod',
         'pending_dean',
         'pending_cfo',
         'pending_accounts'
       );

    ALTER TABLE public.fests
      DROP CONSTRAINT IF EXISTS fests_status_is_draft_consistency_chk;

    ALTER TABLE public.fests
      ADD CONSTRAINT fests_status_is_draft_consistency_chk
      CHECK (
        (status IN ('draft', 'revision_requested', 'pending_approvals') AND is_draft = true)
        OR
        (status IN ('approved', 'published') AND is_draft = false)
      );
  END IF;

  IF to_regclass('public.fest') IS NOT NULL THEN
    UPDATE public.fest
    SET status = 'draft',
        is_draft = true
    WHERE lower(coalesce(status, '')) = 'pending_approvals'
       OR lower(coalesce(approval_state, '')) IN ('under_review', 'pending')
       OR lower(coalesce(workflow_status, '')) IN (
         'pending_hod',
         'pending_dean',
         'pending_cfo',
         'pending_accounts'
       );

    ALTER TABLE public.fest
      DROP CONSTRAINT IF EXISTS fest_status_is_draft_consistency_chk;

    ALTER TABLE public.fest
      ADD CONSTRAINT fest_status_is_draft_consistency_chk
      CHECK (
        (status IN ('draft', 'revision_requested', 'pending_approvals') AND is_draft = true)
        OR
        (status IN ('approved', 'published') AND is_draft = false)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_lifecycle_draft_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := lower(coalesce(NEW.status, ''));

  IF NEW.status = 'pending_approvals' THEN
    NEW.status := 'draft';
  END IF;

  IF NEW.status NOT IN (
    'draft',
    'pending_approvals',
    'revision_requested',
    'approved',
    'published'
  ) THEN
    NEW.status := CASE
      WHEN coalesce(NEW.is_draft, false) THEN 'draft'
      ELSE 'published'
    END;
  END IF;

  NEW.is_draft := NEW.status IN ('draft', 'revision_requested', 'pending_approvals');
  RETURN NEW;
END;
$$;
