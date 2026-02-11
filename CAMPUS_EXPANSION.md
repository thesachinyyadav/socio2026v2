# Campus Expansion Roadmap

## Current Deployment (v1 — Central Campus)

SOCIO is currently deployed and tested at **Central Campus (Main)**, Christ University. The campus restriction fields (`campus_hosted_at`, `allowed_campuses`) exist in the database and UI but are **optional** — organizers can leave them untouched.

### What works today

- Events and fests default to Central Campus.
- Campus fields are present in create/edit forms for both events and fests.
- The Discover page has a campus dropdown with all 6 campuses (decorative filtering only).
- Database columns `campus_hosted_at` (text) and `allowed_campuses` (JSON) are live on both `events` and `fest` tables.

---

## Supported Campuses

| # | Campus | Status |
|---|--------|--------|
| 1 | Central Campus (Main) | Active — primary deployment |
| 2 | Bannerghatta Road Campus | Ready — UI & DB support in place |
| 3 | Yeshwanthpur Campus | Ready — UI & DB support in place |
| 4 | Kengeri Campus | Ready — UI & DB support in place |
| 5 | Delhi NCR Campus | Ready — UI & DB support in place |
| 6 | Pune Lavasa Campus | Ready — UI & DB support in place |

The campus list is defined once in `client/app/lib/eventFormSchema.ts` (`christCampuses` export) and shared across all forms and the Discover page.

---

## What needs to happen for multi-campus rollout

### Phase 1 — Enforce campus filtering (low effort)

- [ ] **Discover page**: Wire `selectedCampus` state to actually filter events/fests by `campus_hosted_at` or `allowed_campuses`.
- [ ] **Registration gate**: Before a user registers, check if their `users.campus` is in the event's `allowed_campuses` array (skip check if array is empty — means "all campuses allowed").
- [ ] **Validation**: Consider making `campus_hosted_at` required once multi-campus is active.

### Phase 2 — Campus-aware features (medium effort)

- [ ] **User onboarding**: Ask users to set their campus during sign-up or first login (the `users.campus` column already exists).
- [ ] **Default campus**: Auto-select the organizer's campus as `campus_hosted_at` when creating events/fests.
- [ ] **Campus-scoped notifications**: Only notify users whose campus matches the event's `allowed_campuses`.
- [ ] **Campus dashboard**: Show campus-specific stats on the master admin page.

### Phase 3 — Inter-campus features (higher effort)

- [ ] **Cross-campus events**: Events hosted at one campus but open to students from multiple campuses.
- [ ] **Campus leaderboard**: Compare engagement metrics across campuses.
- [ ] **Campus admin role**: A per-campus admin who can manage events/fests for their campus only.

---

## Adding a new campus

1. Add the campus name to the `christCampuses` array in `client/app/lib/eventFormSchema.ts`.
2. That's it — all forms and the Discover dropdown will pick it up automatically.
3. No database migration needed; the columns already accept any text value.

---

## Files involved

| File | What it does |
|------|-------------|
| `client/app/lib/eventFormSchema.ts` | Single source of truth for the campus list (`christCampuses`) |
| `client/app/_components/Admin/ManageEvent.tsx` | Event form — campus section (visible when outsiders OFF) |
| `client/app/_components/CreateFestForm.tsx` | Fest form — campus section (always visible) |
| `client/app/Discover/page.tsx` | Campus dropdown on Discover page |
| `client/app/create/event/page.tsx` | Sends campus fields in event creation payload |
| `client/app/edit/event/[id]/page.tsx` | Maps and sends campus fields in event edit payload |
| `server/routes/eventRoutes.js` | Accepts campus fields on event POST |
| `server/routes/eventRoutes_secured.js` | Accepts campus fields on event PUT |
| `server/routes/festRoutes.js` | Accepts campus fields on fest POST and PUT |
| `socios.sql` | ALTER TABLE statements for `campus_hosted_at` and `allowed_campuses` |
