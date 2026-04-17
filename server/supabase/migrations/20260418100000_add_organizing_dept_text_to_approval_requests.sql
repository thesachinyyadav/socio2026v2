-- Add organizing_dept text column to approval_requests for reliable HOD routing.
-- The UUID column (organizing_dept_id) is often null when department resolution fails;
-- this text column stores the raw department name so text-based matching always works.
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS organizing_dept text;

-- Back-fill from linked events where the text value is available
UPDATE approval_requests ar
SET organizing_dept = e.organizing_dept
FROM events e
WHERE ar.entity_ref = e.event_id
  AND ar.organizing_dept IS NULL
  AND e.organizing_dept IS NOT NULL
  AND ar.entity_type IN ('EVENT', 'STANDALONE_EVENT', 'FEST_CHILD_EVENT');

-- Back-fill from linked fests
UPDATE approval_requests ar
SET organizing_dept = f.organizing_dept
FROM fests f
WHERE ar.entity_ref = f.fest_id
  AND ar.organizing_dept IS NULL
  AND f.organizing_dept IS NOT NULL
  AND ar.entity_type = 'FEST';
