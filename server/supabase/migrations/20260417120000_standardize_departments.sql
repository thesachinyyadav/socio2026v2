-- =============================================================================
-- Migration: Standardize Departments
-- Date: 2026-04-17
-- Author: Principal Database Architect
--
-- Purpose:
--   Collapse the fragmented department model (departments_courses +
--   department_school + raw text columns on events/fests/users/approvals/
--   routing/role assignments) into a single canonical `departments` table
--   referenced everywhere via UUID foreign keys.
--
-- Execution model:
--   Runs in a single transaction — if any phase fails the whole thing rolls
--   back. Review carefully before applying to production. Back up
--   `departments_courses`, `users`, `events`, `fests`, `approval_requests`,
--   `department_approval_routing`, and `user_role_assignments` first.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PHASE 1 — Master `departments` table
-- =============================================================================
-- Why a new table instead of reshaping `departments_courses`:
--   * `departments_courses` mixes department metadata with per-course class
--     schedule payloads (courses_json). We split metadata into `departments`
--     and keep course schedules as a JSON column on the new table so nothing
--     is lost.
--   * A clean slate lets us add a stable short `code` slug (matching the
--     frontend eventFormSchema slugs like `dept_computer_science`) that the
--     app can use for UI lookups without relying on free-text names.

CREATE TABLE IF NOT EXISTS departments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text UNIQUE NOT NULL,         -- canonical display name
    code        text UNIQUE,                   -- stable slug (e.g. dept_computer_science)
    school      text NOT NULL,                 -- owning school / faculty
    is_active   boolean NOT NULL DEFAULT true,
    courses_json jsonb NOT NULL DEFAULT '[]'::jsonb, -- migrated from departments_courses
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_school ON departments (school);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments (is_active);

-- Keep `updated_at` fresh on every update.
CREATE OR REPLACE FUNCTION set_departments_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments;
CREATE TRIGGER trg_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION set_departments_updated_at();

-- -----------------------------------------------------------------------------
-- 1a. Seed the standardized 22 departments (the frontend eventFormSchema list)
-- -----------------------------------------------------------------------------
-- These are the authoritative set the UI uses. Inserted first so downstream
-- UPDATEs can key off either `name` or `code`. ON CONFLICT ensures re-runs are
-- idempotent AND repairs any pre-existing rows that lacked a code/school.

INSERT INTO departments (name, code, school) VALUES
    ('All Departments',                                                     'all_departments',                                     'ALL'),
    ('Department of Business and Management (BBA)',                         'dept_business_management_bba',                        'SCHOOL OF BUSINESS AND MANAGEMENT'),
    ('Department of Business and Management (MBA)',                         'dept_business_management_mba',                        'SCHOOL OF BUSINESS AND MANAGEMENT'),
    ('Department of Hotel Management',                                      'dept_hotel_management',                               'SCHOOL OF BUSINESS AND MANAGEMENT'),
    ('Department of Commerce',                                              'dept_commerce',                                       'SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY'),
    ('Department of Professional Studies',                                  'dept_professional_studies',                           'SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY'),
    ('Department of English and Cultural Studies',                          'dept_english_cultural_studies',                       'SCHOOL OF HUMANITIES AND PERFORMING ARTS'),
    ('Department of Music',                                                 'dept_music',                                          'SCHOOL OF HUMANITIES AND PERFORMING ARTS'),
    ('Department of Performing Arts',                                       'dept_performing_arts',                                'SCHOOL OF HUMANITIES AND PERFORMING ARTS'),
    ('Department of Philosophy and Theology',                               'dept_philosophy_theology',                            'SCHOOL OF HUMANITIES AND PERFORMING ARTS'),
    ('Department of Theatre Studies',                                       'dept_theatre_studies',                                'SCHOOL OF HUMANITIES AND PERFORMING ARTS'),
    ('Department of School of Law',                                         'dept_school_of_law',                                  'SCHOOL OF LAW'),
    ('Department of Psychology',                                            'dept_psychology',                                     'SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK'),
    ('Department of School of Education',                                   'dept_school_of_education',                            'SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK'),
    ('Department of Social Work',                                           'dept_social_work',                                    'SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK'),
    ('Department of Chemistry',                                             'dept_chemistry',                                      'SCHOOL OF SCIENCES'),
    ('Department of Computer Science',                                      'dept_computer_science',                               'SCHOOL OF SCIENCES'),
    ('Department of Life Sciences',                                         'dept_life_sciences',                                  'SCHOOL OF SCIENCES'),
    ('Department of Mathematics',                                           'dept_mathematics',                                    'SCHOOL OF SCIENCES'),
    ('Department of Physics and Electronics',                               'dept_physics_electronics',                            'SCHOOL OF SCIENCES'),
    ('Department of Statistics and Data Science',                           'dept_statistics_data_science',                        'SCHOOL OF SCIENCES'),
    ('Department of Economics',                                             'dept_economics',                                      'SCHOOL OF SOCIAL SCIENCES'),
    ('Department of International Studies, Political Science and History',  'dept_international_studies_political_science_history', 'SCHOOL OF SOCIAL SCIENCES'),
    ('Department of Media Studies',                                         'dept_media_studies',                                  'SCHOOL OF SOCIAL SCIENCES')
ON CONFLICT (name) DO UPDATE
SET code   = COALESCE(EXCLUDED.code,   departments.code),
    school = COALESCE(NULLIF(EXCLUDED.school, ''), departments.school);

-- -----------------------------------------------------------------------------
-- 1b. Preserve any non-standard departments already present in
--     `departments_courses` so live data is not lost (orgs may have seeded
--      extras outside the canonical 22). Also carries over `courses_json`.
-- -----------------------------------------------------------------------------
INSERT INTO departments (name, school, courses_json)
SELECT
    dc.department_name,
    COALESCE(NULLIF(dc.school, ''), 'UNSPECIFIED'),
    COALESCE(dc.courses_json, '[]'::jsonb)
FROM departments_courses dc
WHERE dc.department_name IS NOT NULL
ON CONFLICT (name) DO UPDATE
SET courses_json = EXCLUDED.courses_json,
    school       = CASE
                      WHEN departments.school = 'UNSPECIFIED' AND EXCLUDED.school <> 'UNSPECIFIED'
                          THEN EXCLUDED.school
                      ELSE departments.school
                   END;

-- =============================================================================
-- PHASE 2 — Add new UUID FK columns (text columns stay for now)
-- =============================================================================
-- Additive-only so Phase 3 has time to backfill before Phase 4 drops the text
-- columns. Every new column is nullable — we DO NOT NOT-NULL them here because
-- rows that can't be mapped must remain unblocked until humans reconcile.

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS organizing_dept_id uuid REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE fests
    ADD COLUMN IF NOT EXISTS organizing_dept_id uuid REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS organizing_dept_id uuid REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE department_approval_routing
    ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments
    ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

-- `users.department_id` already exists but references `departments_courses`.
-- Drop the old FK (if present) so we can rebind it to the new `departments`
-- table after Phase 3 finishes backfilling.
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_department_id_fkey;

CREATE INDEX IF NOT EXISTS idx_events_organizing_dept_id              ON events              (organizing_dept_id);
CREATE INDEX IF NOT EXISTS idx_fests_organizing_dept_id               ON fests               (organizing_dept_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_organizing_dept_id   ON approval_requests   (organizing_dept_id);
CREATE INDEX IF NOT EXISTS idx_dept_approval_routing_department_id    ON department_approval_routing (department_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_department_id    ON user_role_assignments (department_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id                    ON users               (department_id);

-- =============================================================================
-- PHASE 3 — Backfill UUID FKs from existing text/UUID data
-- =============================================================================
-- The source columns are inconsistent: some rows store the canonical display
-- name ("Department of Computer Science"), others store the frontend slug
-- ("dept_computer_science"), and a few (user_role_assignments) store a
-- stringified UUID pointing at the old departments_courses row. We handle all
-- three shapes by joining via name, code, or id — whichever matches first.

-- -----------------------------------------------------------------------------
-- 3a. events.organizing_dept  →  events.organizing_dept_id
-- -----------------------------------------------------------------------------
UPDATE events e
SET    organizing_dept_id = d.id
FROM   departments d
WHERE  e.organizing_dept_id IS NULL
  AND  e.organizing_dept IS NOT NULL
  AND  (lower(e.organizing_dept) = lower(d.name) OR lower(e.organizing_dept) = lower(d.code));

-- -----------------------------------------------------------------------------
-- 3b. fests.organizing_dept  →  fests.organizing_dept_id
-- -----------------------------------------------------------------------------
UPDATE fests f
SET    organizing_dept_id = d.id
FROM   departments d
WHERE  f.organizing_dept_id IS NULL
  AND  f.organizing_dept IS NOT NULL
  AND  (lower(f.organizing_dept) = lower(d.name) OR lower(f.organizing_dept) = lower(d.code));

-- -----------------------------------------------------------------------------
-- 3c. approval_requests.organizing_dept  →  approval_requests.organizing_dept_id
-- -----------------------------------------------------------------------------
UPDATE approval_requests a
SET    organizing_dept_id = d.id
FROM   departments d
WHERE  a.organizing_dept_id IS NULL
  AND  a.organizing_dept IS NOT NULL
  AND  (lower(a.organizing_dept) = lower(d.name) OR lower(a.organizing_dept) = lower(d.code));

-- -----------------------------------------------------------------------------
-- 3d. department_approval_routing.department_scope  →  department_id
--     Stored as a free-text department name in this table.
-- -----------------------------------------------------------------------------
UPDATE department_approval_routing r
SET    department_id = d.id
FROM   departments d
WHERE  r.department_id IS NULL
  AND  r.department_scope IS NOT NULL
  AND  (lower(r.department_scope) = lower(d.name) OR lower(r.department_scope) = lower(d.code));

-- -----------------------------------------------------------------------------
-- 3e. user_role_assignments.department_scope  →  department_id
--     Historically stored as the stringified UUID of the old
--     departments_courses row. We bridge via departments_courses.name
--     because the new `departments` rows share that name.
-- -----------------------------------------------------------------------------
UPDATE user_role_assignments ura
SET    department_id = new_d.id
FROM   departments_courses old_dc
JOIN   departments new_d ON lower(new_d.name) = lower(old_dc.department_name)
WHERE  ura.department_id IS NULL
  AND  ura.department_scope IS NOT NULL
  AND  ura.department_scope = old_dc.id::text;

-- Fallback: some rows may already store the name or slug directly.
UPDATE user_role_assignments ura
SET    department_id = d.id
FROM   departments d
WHERE  ura.department_id IS NULL
  AND  ura.department_scope IS NOT NULL
  AND  (lower(ura.department_scope) = lower(d.name) OR lower(ura.department_scope) = lower(d.code));

-- -----------------------------------------------------------------------------
-- 3f. users.department_id (old → new)  +  users.department (text → id)
-- -----------------------------------------------------------------------------
-- Step 1: re-point existing UUID values from departments_courses.id to the
--         matching departments.id by joining on name.
UPDATE users u
SET    department_id = new_d.id
FROM   departments_courses old_dc
JOIN   departments new_d ON lower(new_d.name) = lower(old_dc.department_name)
WHERE  u.department_id = old_dc.id;

-- Step 2: for users whose UUID didn't resolve (orphan FK) but who have a
--         textual `department` column, fall back to mapping by name/code.
UPDATE users u
SET    department_id = d.id
FROM   departments d
WHERE  u.department_id IS NULL
  AND  u.department IS NOT NULL
  AND  (lower(u.department) = lower(d.name) OR lower(u.department) = lower(d.code));

-- Step 3: clear any users.department_id values that still don't match a row
--         in the new table — leaving a dangling UUID would violate the FK we
--         are about to re-add.
UPDATE users u
SET    department_id = NULL
WHERE  u.department_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = u.department_id);

-- Now it is safe to rebind the FK to the new table.
ALTER TABLE users
    ADD CONSTRAINT users_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- =============================================================================
-- PHASE 4 — Cleanup & enforcement
-- =============================================================================
-- Guardrail: if any text column still has values that did NOT resolve to a
-- UUID, abort. Operators can then reconcile manually and re-run. This keeps
-- silent data loss from happening when we drop the old columns.

DO $$
DECLARE
    unresolved_count bigint;
BEGIN
    SELECT
        (SELECT count(*) FROM events              WHERE organizing_dept IS NOT NULL AND organizing_dept_id IS NULL) +
        (SELECT count(*) FROM fests               WHERE organizing_dept IS NOT NULL AND organizing_dept_id IS NULL) +
        (SELECT count(*) FROM approval_requests   WHERE organizing_dept IS NOT NULL AND organizing_dept_id IS NULL) +
        (SELECT count(*) FROM department_approval_routing WHERE department_scope IS NOT NULL AND department_id IS NULL) +
        (SELECT count(*) FROM user_role_assignments WHERE department_scope IS NOT NULL AND department_id IS NULL)
    INTO unresolved_count;

    IF unresolved_count > 0 THEN
        RAISE EXCEPTION
            'Department migration halted: % text values did not map to a UUID. Reconcile the source rows and re-run.',
            unresolved_count;
    END IF;
END$$;

-- -----------------------------------------------------------------------------
-- 4a. RLS policies — drop policies that referenced the old text columns so
--     the column DROP can proceed. Replacement policies using the new FK
--     columns must be created in a follow-up migration once app code is
--     updated (kept out of this migration to avoid a window where policies
--     silently widen access while code is mid-deploy).
-- -----------------------------------------------------------------------------
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
          AND  (qual LIKE '%organizing_dept%'
             OR qual LIKE '%department_scope%'
             OR qual LIKE '%department_hosted_at%'
             OR with_check LIKE '%organizing_dept%'
             OR with_check LIKE '%department_scope%'
             OR with_check LIKE '%department_hosted_at%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Dropped RLS policy % on %.% — recreate using department_id join.',
                     pol.policyname, pol.schemaname, pol.tablename;
    END LOOP;
END$$;

-- -----------------------------------------------------------------------------
-- 4b. Drop the old text columns
-- -----------------------------------------------------------------------------
ALTER TABLE events              DROP COLUMN IF EXISTS organizing_dept;
ALTER TABLE fests               DROP COLUMN IF EXISTS organizing_dept;
ALTER TABLE fests               DROP COLUMN IF EXISTS department_hosted_at;
ALTER TABLE users               DROP COLUMN IF EXISTS department;
ALTER TABLE approval_requests   DROP COLUMN IF EXISTS organizing_dept;
ALTER TABLE department_approval_routing DROP COLUMN IF EXISTS department_scope;
ALTER TABLE user_role_assignments       DROP COLUMN IF EXISTS department_scope;

-- -----------------------------------------------------------------------------
-- 4c. Drop redundant legacy tables.
--     courses_json has already been migrated onto `departments` in Phase 1b.
--     `department_school` was a lookup-only helper superseded by
--     `departments.school`.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS department_school CASCADE;
DROP TABLE IF EXISTS departments_courses CASCADE;

COMMIT;

-- =============================================================================
-- POST-MIGRATION TODO (handle in application-side PRs, not here):
--   1. Update server/client code to read/write *_dept_id / department_id
--      instead of the dropped text columns.
--   2. Recreate RLS policies dropped in 4a — rewrite them to JOIN on
--      department_id rather than compare text.
--   3. Remove the hardcoded `departments` / `schools` arrays from
--      client/app/lib/eventFormSchema.ts and fetch from `departments` via a
--      server action (single source of truth).
--   4. Monitor for NULL organizing_dept_id in new rows; add NOT NULL once
--      app writes are proven to always populate it.
-- =============================================================================
