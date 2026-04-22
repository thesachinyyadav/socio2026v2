-- Migration 023 — Row Level Security for venue_bookings.
--
-- Who connects with what key:
--   Express server  → SUPABASE_SERVICE_ROLE_KEY → bypasses RLS entirely.
--   Browser client  → NEXT_PUBLIC_SUPABASE_ANON_KEY → governed by these policies.
--
-- Identity anchor: `requested_by` stores the user's email, which matches
-- auth.email() from Supabase's JWT. Role checks join against public.users.
--
-- Run in the Supabase SQL Editor.

ALTER TABLE public.venue_bookings ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: reusable role predicates (avoids repeating the subquery everywhere)
-- ─────────────────────────────────────────────────────────────────────────────

-- (Supabase doesn't support CREATE FUNCTION inside a DO block easily in the
--  SQL editor, so we inline the subqueries in each policy.)

-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. A user can always see their own bookings.
CREATE POLICY "vb_select_own"
  ON public.venue_bookings
  FOR SELECT
  USING ( requested_by = auth.email() );

-- 2. Approved bookings are visible to any authenticated user (calendar availability).
CREATE POLICY "vb_select_approved_public"
  ON public.venue_bookings
  FOR SELECT
  USING ( status = 'approved' );

-- 3. Vendor managers see all bookings for venues on their campus.
CREATE POLICY "vb_select_vendor_manager"
  ON public.venue_bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.users u
      JOIN   public.venues v ON v.venue_id = venue_bookings.venue_id
      WHERE  u.email              = auth.email()
        AND  u.is_vendor_manager  = TRUE
        AND  v.campus             = u.campus
    )
  );

-- 4. Master admins see everything.
CREATE POLICY "vb_select_masteradmin"
  ON public.venue_bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE  email          = auth.email()
        AND  is_masteradmin = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT policy
-- ─────────────────────────────────────────────────────────────────────────────

-- 5. Only organisers (or masteradmins) can insert, and only as themselves.
CREATE POLICY "vb_insert_organiser"
  ON public.venue_bookings
  FOR INSERT
  WITH CHECK (
    requested_by = auth.email()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE  email = auth.email()
        AND  (is_organiser = TRUE OR is_masteradmin = TRUE)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 6. Vendor managers can update (approve/reject) bookings for their campus venues.
--    They cannot change venue_id or requested_by — that's enforced by the
--    application layer (Express route only updates status + decision_notes).
CREATE POLICY "vb_update_vendor_manager"
  ON public.venue_bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.users u
      JOIN   public.venues v ON v.venue_id = venue_bookings.venue_id
      WHERE  u.email             = auth.email()
        AND  u.is_vendor_manager = TRUE
        AND  v.campus            = u.campus
    )
  );

-- 7. Master admins can update anything.
CREATE POLICY "vb_update_masteradmin"
  ON public.venue_bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE  email          = auth.email()
        AND  is_masteradmin = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- DELETE policy
-- ─────────────────────────────────────────────────────────────────────────────

-- 8. Only masteradmins can hard-delete a booking row.
--    Organisers cancel by going through the application (status update), not DELETE.
CREATE POLICY "vb_delete_masteradmin"
  ON public.venue_bookings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE  email          = auth.email()
        AND  is_masteradmin = TRUE
    )
  );
