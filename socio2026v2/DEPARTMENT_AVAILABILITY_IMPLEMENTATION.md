# Department Availability Feature - Implementation Summary

## What Was Added

### 1. Database Schema Update
**File**: `server/migrations/009_add_department_hosted_at.sql`
- Added `department_hosted_at` column to `fests` table
- Added index for faster queries

**Action Required**: 
- Run this SQL in your Supabase SQL Editor:
```sql
alter table public.fests add column if not exists department_hosted_at text;
create index if not exists idx_fests_department_hosted_at on public.fests(department_hosted_at);
```

### 2. Frontend Form Updates
**File**: `client/app/_components/CreateFestForm.tsx`

#### Added to Form State (CreateFestState interface):
- `departmentHostedAt: string` - Which department hosts the fest
- `allowedDepartments: string[]` - Which departments can register

#### Added UI Controls:
- New "Department Availability" section (similar to Campus Availability)
- Dropdown for "Which department is hosting this fest?"
- Checkboxes for "Which departments can register?"
- Shows all available departments from the system

#### Form Data Handling:
- Initial state: `departmentHostedAt: "", allowedDepartments: []`
- Data submission includes both fields
- Edit mode loads department data from database
- Properly formats data for API submission

### 3. Backend API Updates
**File**: `server/routes/festRoutes.js`

#### POST Endpoint (Create Fest):
- Now accepts and saves `departmentHostedAt` 
- Stores as `department_hosted_at` in database

#### PUT Endpoint (Update Fest):
- Extracts `departmentHostedAt` from request body
- Maps to `department_hosted_at` in update payload

---

## How It Works

### Creating a Fest

1. User fills in fest details
2. Scrolls to "Department Availability" section
3. Selects:
   - Which department is hosting (single select dropdown)
   - Which departments can register (multi-select checkboxes)
4. Form submits:
   ```json
   {
     "departmentHostedAt": "dept_business_management_bba",
     "departmentAccess": ["dept_business_management_bba", "dept_commerce", ...]
   }
   ```

### Database Storage

The fest is stored with:
- `department_hosted_at`: The hosting department identifier
- `department_access`: Array of departments that can participate
- `campus_hosted_at`: The hosting campus (existing field)
- `allowed_campuses`: Campuses that can participate (existing field)

---

## Testing Checklist

1. **Run the migration**
   - Go to Supabase SQL Editor
   - Run the migration from `server/migrations/009_add_department_hosted_at.sql`
   - Verify the column was added

2. **Create a new fest**
   - Navigate to `/create/fest`
   - Scroll to "Department Availability" section
   - Select a hosting department
   - Select which departments can register
   - Submit the form
   - Verify fest is created successfully

3. **Edit an existing fest**
   - Go to manage page
   - Edit a fest
   - Verify department fields are pre-populated
   - Make changes and save
   - Verify changes are saved to database

4. **Check the database**
   - In Supabase, query the fests table
   - Look for `department_hosted_at` and `department_access` fields
   - Verify data matches what was submitted

---

## Field Mapping Reference

| Frontend Field | Database Column | Type | Purpose |
|---|---|---|---|
| `departmentHostedAt` | `department_hosted_at` | text | Which department is hosting the fest |
| `allowedDepartments` | `department_access` | jsonb array | Which departments can register/participate |
| `campusHostedAt` | `campus_hosted_at` | text | Which campus is hosting the fest |
| `allowedCampuses` | `allowed_campuses` | jsonb array | Which campuses can register/participate |

---

## Next Steps

1. ✅ Database migration ready
2. ✅ Frontend form updated
3. ✅ API endpoints updated
4. 🔜 Run migration in Supabase
5. 🔜 Test the feature end-to-end
6. 🔜 Deploy to production

