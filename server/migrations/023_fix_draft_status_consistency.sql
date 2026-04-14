-- Migration: align lifecycle status <-> is_draft semantics for events/fests.
-- New rule:
--   is_draft = true  only when status is draft or revision_requested
--   is_draft = false for pending_approvals, approved, published

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    ALTER TABLE public.events
      ADD COLUMN IF NOT EXISTS is_draft boolean,
      ADD COLUMN IF NOT EXISTS status text;

    UPDATE public.events
    SET status = CASE
      WHEN lower(coalesce(status, '')) IN (
        'draft',
        'pending_approvals',
        'revision_requested',
        'approved',
        'published'
      ) THEN lower(status)
      ELSE CASE
        WHEN coalesce(is_draft, false) THEN 'draft'
        ELSE 'published'
      END
    END;

    UPDATE public.events
    SET is_draft = CASE
      WHEN status IN ('draft', 'revision_requested') THEN true
      ELSE false
    END
    WHERE is_draft IS DISTINCT FROM CASE
      WHEN status IN ('draft', 'revision_requested') THEN true
      ELSE false
    END;

    ALTER TABLE public.events
      ALTER COLUMN status SET DEFAULT 'draft',
      ALTER COLUMN status SET NOT NULL,
      ALTER COLUMN is_draft SET DEFAULT false,
      ALTER COLUMN is_draft SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'events_status_lifecycle_chk'
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

    ALTER TABLE public.events
      DROP CONSTRAINT IF EXISTS events_status_is_draft_consistency_chk;

    ALTER TABLE public.events
      ADD CONSTRAINT events_status_is_draft_consistency_chk
      CHECK (
        (status IN ('draft', 'revision_requested') AND is_draft = true)
        OR
        (status IN ('pending_approvals', 'approved', 'published') AND is_draft = false)
      );

    CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
    CREATE INDEX IF NOT EXISTS idx_events_status_is_draft ON public.events(status, is_draft);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fests') IS NOT NULL THEN
    ALTER TABLE public.fests
      ADD COLUMN IF NOT EXISTS is_draft boolean,
      ADD COLUMN IF NOT EXISTS status text;

    UPDATE public.fests
    SET status = CASE
      WHEN lower(coalesce(status, '')) IN (
        'draft',
        'pending_approvals',
        'revision_requested',
        'approved',
        'published'
      ) THEN lower(status)
      ELSE CASE
        WHEN coalesce(is_draft, false) THEN 'draft'
        ELSE 'published'
      END
    END;

    UPDATE public.fests
    SET is_draft = CASE
      WHEN status IN ('draft', 'revision_requested') THEN true
      ELSE false
    END
    WHERE is_draft IS DISTINCT FROM CASE
      WHEN status IN ('draft', 'revision_requested') THEN true
      ELSE false
    END;

    ALTER TABLE public.fests
      ALTER COLUMN status SET DEFAULT 'draft',
      ALTER COLUMN status SET NOT NULL,
      ALTER COLUMN is_draft SET DEFAULT false,
      ALTER COLUMN is_draft SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fests_status_lifecycle_chk'
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

    ALTER TABLE public.fests
      DROP CONSTRAINT IF EXISTS fests_status_is_draft_consistency_chk;

    ALTER TABLE public.fests
      ADD CONSTRAINT fests_status_is_draft_consistency_chk
      CHECK (
        (status IN ('draft', 'revision_requested') AND is_draft = true)
        OR
        (status IN ('pending_approvals', 'approved', 'published') AND is_draft = false)
      );

    CREATE INDEX IF NOT EXISTS idx_fests_status ON public.fests(status);
    CREATE INDEX IF NOT EXISTS idx_fests_status_is_draft ON public.fests(status, is_draft);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.fest') IS NOT NULL THEN
    ALTER TABLE public.fest
      ADD COLUMN IF NOT EXISTS is_draft boolean,
      ADD COLUMN IF NOT EXISTS status text;

    UPDATE public.fest
    SET status = CASE
      WHEN lower(coalesce(status, '')) IN (
        'draft',
        'pending_approvals',
        'revision_requested',
        'approved',
        'published'
      ) THEN lower(status)
      ELSE CASE
        WHEN coalesce(is_draft, false) THEN 'draft'
        ELSE 'published'
      END
    END;

    UPDATE public.fest
    SET is_draft = CASE
      WHEN status IN ('draft', 'revision_requested') THEN true
      ELSE false
    END
    WHERE is_draft IS DISTINCT FROM CASE
      WHEN status IN ('draft', 'revision_requested') THEN true
      ELSE false
    END;

    ALTER TABLE public.fest
      ALTER COLUMN status SET DEFAULT 'draft',
      ALTER COLUMN status SET NOT NULL,
      ALTER COLUMN is_draft SET DEFAULT false,
      ALTER COLUMN is_draft SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fest_status_lifecycle_chk'
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

    ALTER TABLE public.fest
      DROP CONSTRAINT IF EXISTS fest_status_is_draft_consistency_chk;

    ALTER TABLE public.fest
      ADD CONSTRAINT fest_status_is_draft_consistency_chk
      CHECK (
        (status IN ('draft', 'revision_requested') AND is_draft = true)
        OR
        (status IN ('pending_approvals', 'approved', 'published') AND is_draft = false)
      );

    CREATE INDEX IF NOT EXISTS idx_fest_status ON public.fest(status);
    CREATE INDEX IF NOT EXISTS idx_fest_status_is_draft ON public.fest(status, is_draft);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_lifecycle_draft_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := lower(coalesce(NEW.status, ''));

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

  NEW.is_draft := NEW.status IN ('draft', 'revision_requested');
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_events_lifecycle_draft_consistency ON public.events;
    CREATE TRIGGER trg_events_lifecycle_draft_consistency
    BEFORE INSERT OR UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_lifecycle_draft_consistency();
  END IF;

  IF to_regclass('public.fests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_fests_lifecycle_draft_consistency ON public.fests;
    CREATE TRIGGER trg_fests_lifecycle_draft_consistency
    BEFORE INSERT OR UPDATE ON public.fests
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_lifecycle_draft_consistency();
  END IF;

  IF to_regclass('public.fest') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_fest_lifecycle_draft_consistency ON public.fest;
    CREATE TRIGGER trg_fest_lifecycle_draft_consistency
    BEFORE INSERT OR UPDATE ON public.fest
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_lifecycle_draft_consistency();
  END IF;
END $$;
