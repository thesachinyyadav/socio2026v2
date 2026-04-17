-- Migration 035: Drop legacy department text columns + redundant tables
-- Run this ONLY after all application code has been updated to use the
-- new UUID FK columns (organizing_dept_id / department_id).
--
-- GUARD: aborts if any text value still hasn't been mapped to a UUID —
-- preventing silent data loss.

DO $$
DECLARE
    unresolved bigint;
BEGIN
    SELECT
        (SELECT count(*) FROM events              WHERE organizing_dept   IS NOT NULL AND organizing_dept_id IS NULL) +
        (SELECT count(*) FROM fests               WHERE organizing_dept   IS NOT NULL AND organizing_dept_id IS NULL) +
        (SELECT count(*) FROM approval_requests   WHERE organizing_dept   IS NOT NULL AND organizing_dept_id IS NULL) +
        (SELECT count(*) FROM department_approval_routing WHERE department_scope IS NOT NULL AND department_id IS NULL) +
        (SELECT count(*) FROM user_role_assignments       WHERE department_scope IS NOT NULL AND department_id IS NULL)
    INTO unresolved;

    IF unresolved > 0 THEN
        RAISE EXCEPTION
            'Migration 035 aborted: % text dept values not yet mapped to UUIDs. Re-run 034 backfill or reconcile manually.',
            unresolved;
    END IF;
END$$;

-- Drop RLS policies referencing old text columns so the DROP COLUMN can proceed.
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM   pg_policies
        WHERE  schemaname = 'public'
          AND  tablename  IN ('events','fests','approval_requests',
                              'department_approval_routing','user_role_assignments','users')
          AND  (qual LIKE '%organizing_dept%' OR qual LIKE '%department_scope%'
             OR with_check LIKE '%organizing_dept%' OR with_check LIKE '%department_scope%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Dropped RLS policy % on %.% — recreate using department_id FK joins.',
                     pol.policyname, pol.schemaname, pol.tablename;
    END LOOP;
END$$;

-- Drop old text columns
ALTER TABLE events              DROP COLUMN IF EXISTS organizing_dept;
ALTER TABLE fests               DROP COLUMN IF EXISTS organizing_dept;
ALTER TABLE fests               DROP COLUMN IF EXISTS department_hosted_at;
ALTER TABLE users               DROP COLUMN IF EXISTS department;
ALTER TABLE approval_requests   DROP COLUMN IF EXISTS organizing_dept;
ALTER TABLE department_approval_routing DROP COLUMN IF EXISTS department_scope;
ALTER TABLE user_role_assignments       DROP COLUMN IF EXISTS department_scope;

-- Drop legacy helper tables (data already migrated to departments.courses_json)
DROP TABLE IF EXISTS department_school    CASCADE;
DROP TABLE IF EXISTS departments_courses  CASCADE;
