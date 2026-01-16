# Authentication & Ownership Security Fix

## Summary
Fixed authentication and ownership checking for both **Events** and **Fests** to ensure proper security and access control.

## Issues Found & Fixed

### 1. Events - Ownership Field Mismatch
**Problem**: Update and Delete routes were checking `created_by` (email) against `req.userId` (UUID)  
**Fix**: Changed to use `auth_uuid` field for ownership verification

### 2. Fests - No Authentication/Ownership
**Problem**: Fest create/update/delete routes had NO authentication or ownership checks  
**Fix**: Added complete authentication middleware chain:
- `authenticateUser` - Verify JWT token
- `getUserInfo()` - Load user from database
- `requireOrganiser` - Ensure user has organizer privileges
- `requireOwnership()` - Verify user owns the resource (for update/delete)

### 3. Database Schema - Missing auth_uuid in fest table
**Problem**: Fest table didn't have `auth_uuid` column for ownership tracking  
**Fix**: 
- Created migration script: `migrate-fest-auth-uuid.sql`
- Updated schema file: `supabase-schema.sql`

## Changes Made

### Event Routes (`server/routes/eventRoutes_secured.js`)
```javascript
// BEFORE (BROKEN):
requireOwnership('events', 'eventId', 'created_by')

// AFTER (FIXED):
requireOwnership('events', 'eventId', 'auth_uuid')
```

### Fest Routes (`server/routes/festRoutes.js`)

#### POST /api/fests (Create)
```javascript
// BEFORE: No auth
router.post("/", async (req, res) => { ... })

// AFTER: Full auth
router.post("/",
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  async (req, res) => { ... }
)
```

#### PUT /api/fests/:festId (Update)
```javascript
// BEFORE: No auth, no ownership
router.put("/:festId", async (req, res) => { ... })

// AFTER: Full auth + ownership
router.put("/:festId",
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  requireOwnership('fest', 'festId', 'auth_uuid'),
  async (req, res) => { ... }
)
```

#### DELETE /api/fests/:festId (Delete)
```javascript
// BEFORE: No auth, no ownership
router.delete("/:festId", async (req, res) => { ... })

// AFTER: Full auth + ownership
router.delete("/:festId",
  authenticateUser,
  getUserInfo(),
  requireOrganiser,
  requireOwnership('fest', 'festId', 'auth_uuid'),
  async (req, res) => { ... }
)
```

### Auth Middleware (`server/middleware/authMiddleware.js`)
Added detailed logging to `requireOwnership()`:
- Logs the table, field, and values being checked
- Shows why ownership checks pass or fail
- Helps debug future access control issues

## Database Migration Required

**IMPORTANT**: Run this SQL in your Supabase dashboard:

```sql
-- Add auth_uuid column to fest table
ALTER TABLE fest ADD COLUMN IF NOT EXISTS auth_uuid UUID;

-- Add updated_at column
ALTER TABLE fest ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_fest_auth_uuid ON fest(auth_uuid);
```

Or import the file: `migrate-fest-auth-uuid.sql`

## Security Impact

### Before Fix:
❌ Any authenticated user could update/delete ANY event  
❌ Anyone (even unauthenticated) could create/update/delete ANY fest  
❌ No ownership tracking for fests  

### After Fix:
✅ Only event creators can update/delete their own events  
✅ Only authenticated organizers can create fests  
✅ Only fest creators can update/delete their own fests  
✅ Complete audit trail with `auth_uuid` tracking  

## Testing Checklist

### Events:
- [ ] Create event - works
- [ ] Update own event - works
- [ ] Update someone else's event - gets 403 Forbidden
- [ ] Delete own event - works
- [ ] Delete someone else's event - gets 403 Forbidden

### Fests:
- [ ] Create fest without auth - gets 401 Unauthorized
- [ ] Create fest as organizer - works
- [ ] Update own fest - works
- [ ] Update someone else's fest - gets 403 Forbidden
- [ ] Delete own fest - works
- [ ] Delete someone else's fest - gets 403 Forbidden

## Files Modified
1. `server/routes/eventRoutes_secured.js` - Fixed ownership field
2. `server/routes/festRoutes.js` - Added auth middleware
3. `server/middleware/authMiddleware.js` - Enhanced logging
4. `supabase-schema.sql` - Updated schema
5. `migrate-fest-auth-uuid.sql` - Created migration (NEW)

---
**Status**: Ready for deployment after running database migration
**Priority**: HIGH - Security vulnerability fix
**Date**: January 16, 2026
