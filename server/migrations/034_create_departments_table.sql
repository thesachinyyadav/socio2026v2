-- Migration 034: Create canonical departments table + add UUID FK columns + backfill
-- Phase 1–3 of the department standardization.
-- Phase 4 (DROP old text columns) is in 035 — run that AFTER all app code is deployed.

-- =============================================================================
-- PHASE 1 — Master departments table
-- =============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text        UNIQUE NOT NULL,
    code         text        UNIQUE,
    school       text        NOT NULL,
    is_active    boolean     NOT NULL DEFAULT true,
    courses_json jsonb       NOT NULL DEFAULT '[]'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_school    ON departments (school);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments (is_active);

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

-- Seed the canonical 24 entries (22 departments + All Departments sentinel + CLUBS AND CENTERS school)
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

-- Preserve any non-standard depts already in departments_courses and carry over courses_json
INSERT INTO departments (name, school, courses_json)
SELECT
    dc.department_name,
    COALESCE(NULLIF(dc.school, ''), 'UNSPECIFIED'),
    COALESCE(dc.courses_json, '[]'::jsonb)
FROM departments_courses dc
WHERE dc.department_name IS NOT NULL
ON CONFLICT (name) DO UPDATE
    SET courses_json = CASE
                           WHEN EXCLUDED.courses_json IS NOT NULL AND EXCLUDED.courses_json <> '[]'::jsonb
                               THEN EXCLUDED.courses_json
                           ELSE departments.courses_json
                       END,
        school = CASE
                     WHEN departments.school = 'UNSPECIFIED' AND EXCLUDED.school <> 'UNSPECIFIED'
                         THEN EXCLUDED.school
                     ELSE departments.school
                 END;

-- =============================================================================
-- PHASE 2 — Add nullable UUID FK columns (text columns kept until 035)
-- =============================================================================

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

-- users.department_id already exists but FK points at departments_courses.
-- Drop the old FK so we can rebind it after the backfill.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_id_fkey;

CREATE INDEX IF NOT EXISTS idx_events_organizing_dept_id            ON events              (organizing_dept_id);
CREATE INDEX IF NOT EXISTS idx_fests_organizing_dept_id             ON fests               (organizing_dept_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_dept_id            ON approval_requests   (organizing_dept_id);
CREATE INDEX IF NOT EXISTS idx_dept_approval_routing_department_id  ON department_approval_routing (department_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_department_id  ON user_role_assignments (department_id);

-- =============================================================================
-- PHASE 3 — Backfill UUID FKs from existing text data
-- =============================================================================

-- events: organizing_dept stores either a slug (dept_computer_science) or a display name
UPDATE events e
SET    organizing_dept_id = d.id
FROM   departments d
WHERE  e.organizing_dept_id IS NULL
  AND  e.organizing_dept IS NOT NULL
  AND  (lower(e.organizing_dept) = lower(d.name) OR lower(e.organizing_dept) = lower(d.code));

-- fests
UPDATE fests f
SET    organizing_dept_id = d.id
FROM   departments d
WHERE  f.organizing_dept_id IS NULL
  AND  f.organizing_dept IS NOT NULL
  AND  (lower(f.organizing_dept) = lower(d.name) OR lower(f.organizing_dept) = lower(d.code));

-- approval_requests
UPDATE approval_requests a
SET    organizing_dept_id = d.id
FROM   departments d
WHERE  a.organizing_dept_id IS NULL
  AND  a.organizing_dept IS NOT NULL
  AND  (lower(a.organizing_dept) = lower(d.name) OR lower(a.organizing_dept) = lower(d.code));

-- department_approval_routing: stores department name as text
UPDATE department_approval_routing r
SET    department_id = d.id
FROM   departments d
WHERE  r.department_id IS NULL
  AND  r.department_scope IS NOT NULL
  AND  (lower(r.department_scope) = lower(d.name) OR lower(r.department_scope) = lower(d.code));

-- user_role_assignments: stores either a stringified old UUID (from departments_courses) or text name/slug
UPDATE user_role_assignments ura
SET    department_id = new_d.id
FROM   departments_courses old_dc
JOIN   departments new_d ON lower(new_d.name) = lower(old_dc.department_name)
WHERE  ura.department_id IS NULL
  AND  ura.department_scope IS NOT NULL
  AND  ura.department_scope = old_dc.id::text;

UPDATE user_role_assignments ura
SET    department_id = d.id
FROM   departments d
WHERE  ura.department_id IS NULL
  AND  ura.department_scope IS NOT NULL
  AND  (lower(ura.department_scope) = lower(d.name) OR lower(ura.department_scope) = lower(d.code));

-- users.department_id: re-point old departments_courses UUIDs → new departments UUIDs
UPDATE users u
SET    department_id = new_d.id
FROM   departments_courses old_dc
JOIN   departments new_d ON lower(new_d.name) = lower(old_dc.department_name)
WHERE  u.department_id = old_dc.id;

-- Fallback: user has text department name but no department_id
UPDATE users u
SET    department_id = d.id
FROM   departments d
WHERE  u.department_id IS NULL
  AND  u.department IS NOT NULL
  AND  (lower(u.department) = lower(d.name) OR lower(u.department) = lower(d.code));

-- Clear users.department_id values that still don't match any departments row
-- (stale orphaned UUIDs) — otherwise the FK re-add below fails.
UPDATE users u
SET    department_id = NULL
WHERE  u.department_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = u.department_id);

-- Rebind FK to the new departments table
ALTER TABLE users
    ADD CONSTRAINT users_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
