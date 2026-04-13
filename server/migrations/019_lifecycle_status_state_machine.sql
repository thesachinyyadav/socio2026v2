-- Module 11: unify events/fests lifecycle status state machine.
-- Enforced states:
--   draft, pending_approvals, revision_requested, approved, published

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    ALTER TABLE public.events
      ADD COLUMN IF NOT EXISTS status text;

    UPDATE public.events
    SET status = CASE
      WHEN lower(coalesce(status, '')) IN (
        'draft',
        'pending_approvals',
        'revision_requested',
        'approved',
        'published'
      )
        THEN lower(status)
      WHEN lower(coalesce(status, '')) IN (
        'upcoming',
        'ongoing',
        'completed',
        'cancelled',
        'past'
      )
        THEN CASE
          WHEN coalesce(is_draft, true) THEN 'draft'
          ELSE 'published'
        END
      ELSE CASE
        WHEN coalesce(is_draft, true) THEN 'draft'
        ELSE 'published'
      END
    END;

    ALTER TABLE public.events
      ALTER COLUMN status SET DEFAULT 'draft';

    ALTER TABLE public.events
      ALTER COLUMN status SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'events_status_lifecycle_chk'
    ) THEN
      ALTER TABLE public.events
        ADD CONSTRAINT events_status_lifecycle_chk
        CHECK (
          status IN (
            'draft',
            'pending_approvals',
            'revision_requested',
            'approved',
            'published'
          )
        );
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fests') IS NOT NULL THEN
    ALTER TABLE public.fests
      ADD COLUMN IF NOT EXISTS status text;

    UPDATE public.fests
    SET status = CASE
      WHEN lower(coalesce(status, '')) IN (
        'draft',
        'pending_approvals',
        'revision_requested',
        'approved',
        'published'
      )
        THEN lower(status)
      WHEN lower(coalesce(status, '')) IN (
        'upcoming',
        'ongoing',
        'completed',
        'cancelled',
        'past'
      )
        THEN CASE
          WHEN coalesce(is_draft, true) THEN 'draft'
          ELSE 'published'
        END
      ELSE CASE
        WHEN coalesce(is_draft, true) THEN 'draft'
        ELSE 'published'
      END
    END;

    ALTER TABLE public.fests
      ALTER COLUMN status SET DEFAULT 'draft';

    ALTER TABLE public.fests
      ALTER COLUMN status SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fests_status_lifecycle_chk'
    ) THEN
      ALTER TABLE public.fests
        ADD CONSTRAINT fests_status_lifecycle_chk
        CHECK (
          status IN (
            'draft',
            'pending_approvals',
            'revision_requested',
            'approved',
            'published'
          )
        );
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fest') IS NOT NULL THEN
    ALTER TABLE public.fest
      ADD COLUMN IF NOT EXISTS status text;

    UPDATE public.fest
    SET status = CASE
      WHEN lower(coalesce(status, '')) IN (
        'draft',
        'pending_approvals',
        'revision_requested',
        'approved',
        'published'
      )
        THEN lower(status)
      WHEN lower(coalesce(status, '')) IN (
        'upcoming',
        'ongoing',
        'completed',
        'cancelled',
        'past'
      )
        THEN CASE
          WHEN coalesce(is_draft, true) THEN 'draft'
          ELSE 'published'
        END
      ELSE CASE
        WHEN coalesce(is_draft, true) THEN 'draft'
        ELSE 'published'
      END
    END;

    ALTER TABLE public.fest
      ALTER COLUMN status SET DEFAULT 'draft';

    ALTER TABLE public.fest
      ALTER COLUMN status SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fest_status_lifecycle_chk'
    ) THEN
      ALTER TABLE public.fest
        ADD CONSTRAINT fest_status_lifecycle_chk
        CHECK (
          status IN (
            'draft',
            'pending_approvals',
            'revision_requested',
            'approved',
            'published'
          )
        );
    END IF;
  END IF;
END $$;
