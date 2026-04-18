# Database Migrations

This project uses SQL files in `server/migrations` plus a Node runner that tracks applied migrations in:

- `public.schema_migrations`

## Prerequisites

Set these in `server/.env` (or environment variables):

- `SUPABASE_DB_URL` (Postgres connection string, preferred)
- `DB_SSL=true` (default)

`SUPABASE_SERVICE_ROLE_KEY` is still used by API runtime, but migration execution uses `SUPABASE_DB_URL`.

## Commands

Run from `server/`:

```bash
npm run migration:create -- add_users_is_active
npm run migration:status
npm run migration:up
```

## Workflow For Developers

1. Create migration file:

```bash
npm run migration:create -- add_fest_visibility_flag
```

2. Edit generated `server/migrations/<timestamp>_add_fest_visibility_flag.sql`.

3. Use forward-only SQL with idempotent guards where possible:

```sql
ALTER TABLE public.fest
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;
```

4. Apply locally/staging:

```bash
npm run migration:up
```

5. Validate app behavior and API endpoints:

```bash
node test-all-endpoints.js
```

6. Commit code + migration file together.

## Production Deployment Steps

1. Deploy server code first (or together with client).
2. Run migrations against production DB:

```bash
cd server
npm ci
npm run migration:up
```

3. Verify:

```bash
npm run migration:status
```

4. Smoke test critical APIs.

## Notes

- Migrations are executed inside a transaction per file.
- A Postgres advisory lock prevents concurrent migration runs.
- If a migration fails, it rolls back and is not recorded.
- Do not edit already-applied migration files.
- Create a new migration to fix/adjust prior changes.
