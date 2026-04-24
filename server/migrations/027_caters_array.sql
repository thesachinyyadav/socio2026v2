-- Migration 027 — Convert users.caters from single object to array of assignments
--
-- Before: users.caters = { "is_catering": true, "catering_id": "<vendor>" } | NULL
-- After : users.caters = [ { "is_catering": true, "catering_id": "<vendor>" }, ... ] | NULL
--
-- Lets a single email be assigned to multiple catering vendors and see orders
-- from every shop they belong to.

UPDATE public.users
   SET caters = jsonb_build_array(caters)
 WHERE caters IS NOT NULL
   AND jsonb_typeof(caters) = 'object';
