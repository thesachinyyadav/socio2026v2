-- Migration: 025_workflow_phase_state_machine
-- Introduces canonical workflow phase tracking for Module 11 sequencing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'workflow_phase_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.workflow_phase_enum AS ENUM (
      'draft',
      'dept_approval',
      'finance_approval',
      'logistics_approval',
      'approved'
    );
  END IF;
END $$;

ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS workflow_phase public.workflow_phase_enum NOT NULL DEFAULT 'draft';

UPDATE public.events
SET workflow_phase = (
  CASE
    WHEN lower(coalesce(workflow_status, '')) IN ('pending_hod', 'pending_dean', 'pending_organiser')
      THEN 'dept_approval'

    WHEN lower(coalesce(workflow_status, '')) IN ('pending_cfo', 'pending_accounts')
      THEN 'finance_approval'

    WHEN upper(coalesce(service_approval_state, 'APPROVED')) = 'PENDING'
      THEN 'logistics_approval'

    WHEN upper(coalesce(approval_state, 'APPROVED')) = 'APPROVED'
      AND upper(coalesce(service_approval_state, 'APPROVED')) = 'APPROVED'
      AND coalesce(is_draft, false) = false
      THEN 'approved'

    WHEN upper(coalesce(approval_state, 'UNDER_REVIEW')) IN ('UNDER_REVIEW', 'PENDING')
      THEN 'dept_approval'

    WHEN coalesce(is_draft, false) = true
      OR lower(coalesce(status, '')) = 'draft'
      OR lower(coalesce(workflow_status, '')) = 'draft'
      THEN 'draft'

    ELSE 'draft'
  END
)::public.workflow_phase_enum;

CREATE INDEX IF NOT EXISTS idx_events_workflow_phase
  ON public.events(workflow_phase);

DO $$
DECLARE
  fest_table text;
BEGIN
  FOREACH fest_table IN ARRAY ARRAY['fests', 'fest']
  LOOP
    IF to_regclass(format('public.%I', fest_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I
          ADD COLUMN IF NOT EXISTS workflow_phase public.workflow_phase_enum NOT NULL DEFAULT ''draft'';',
        fest_table
      );

      EXECUTE format(
        $fmt$
        UPDATE public.%I
        SET workflow_phase = (
          CASE
            WHEN lower(coalesce(workflow_status, '')) IN ('pending_hod', 'pending_dean')
              THEN 'dept_approval'

            WHEN lower(coalesce(workflow_status, '')) IN ('pending_cfo', 'pending_accounts')
              THEN 'finance_approval'

            WHEN upper(coalesce(approval_state, 'APPROVED')) = 'APPROVED'
              OR lower(coalesce(workflow_status, '')) IN ('fully_approved', 'live')
              THEN 'approved'

            WHEN upper(coalesce(approval_state, 'UNDER_REVIEW')) IN ('UNDER_REVIEW', 'PENDING')
              THEN 'dept_approval'

            WHEN coalesce(is_draft, false) = true
              OR lower(coalesce(status, '')) = 'draft'
              OR lower(coalesce(workflow_status, '')) = 'draft'
              THEN 'draft'

            ELSE 'draft'
          END
        )::public.workflow_phase_enum;
        $fmt$,
        fest_table
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(workflow_phase);',
        'idx_' || fest_table || '_workflow_phase',
        fest_table
      );
    END IF;
  END LOOP;
END $$;
