# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Run both client and server concurrently (from root)
npm run dev

# Install all dependencies (root + client + server)
npm run install-all
```

```bash
# Client only (Next.js 15 + Turbopack)
cd client && npm run dev

# Server only (Express + Nodemon)
cd server && npm run dev
```

### Build & Lint

```bash
cd client && npm run build
cd client && npm run lint        # ESLint, zero warnings allowed
```

### Database Migrations (server)

```bash
cd server && npm run migration:up        # Run pending migrations
cd server && npm run migration:status    # Check applied/pending
cd server && npm run migration:create    # Create new migration file
```

### Tests

Neither client nor server has a real test suite yet (`npm run test` is a placeholder).

## Architecture

This is a full-stack **university event management platform** for Christ University. The repo is a monorepo with two deployable apps:

- **`/client`** — Next.js 15 (App Router, TypeScript, Tailwind CSS 4, Turbopack)
- **`/server`** — Express 5 REST API (ES Modules, Node.js)

Both are deployed independently to **Vercel**. The database is **Supabase (PostgreSQL)**.

---

### Client (`/client`)

**Routing** — Next.js App Router. Key route groups:

| Path | Purpose |
|------|---------|
| `/Discover` | Event discovery hub (carousel, categories) |
| `/event/[id]`, `/fest/[id]` | Detail + registration forms |
| `/manage` | Organizer dashboard (requires `is_organiser` role) |
| `/masteradmin` | Admin panel — users, analytics, approvals (requires `is_masteradmin`) |
| `/attendance` | QR scan interface (requires `is_organiser`) |
| `/auth` | Google OAuth callback |
| `/support` | Knowledge base + support inbox |

**Middleware** (`middleware.ts`) — Runs on every request. Reads Supabase session cookie, redirects unauthenticated users to `/auth`, blocks role-restricted routes (`/manage`, `/create`, `/edit`, `/masteradmin`) for users without the appropriate role.

**State management** — Three React Contexts (no Redux/Zustand):
- `AuthContext` — session, user profile, roles, campus detection, outsider handling, Google sign-in/out
- `EventContext` — all events / trending / upcoming with client-side caching
- `TermsConsentContext` — terms acceptance gate before sign-up

**Data access** — Two layers:
1. `lib/api.ts` — Supabase browser client queries (events, fests, registrations, analytics RPC)
2. `fetch()` calls to the Express server for privileged operations (registrations, chat, notifications, uploads, attendance)

**Key env vars (client)**:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — Express server base URL

---

### Server (`/server`)

**Entry point**: `index.js` — mounts Express, configures CORS (allowlist + regex patterns), registers route modules.

**Route modules** under `routes/`:

| File | Prefix | Purpose |
|------|--------|---------|
| `userRoutes.js` | `/api/users` | User CRUD, role grants with expiry |
| `eventRoutes_secured.js` | `/api/events` | Event CRUD with file uploads (primary) |
| `festRoutes.js` | `/api/fests` | Fest CRUD |
| `registrationRoutes.js` | `/api/register`, `/api/registrations` | Register, cancel, QR code fetch |
| `attendanceRoutes.js` | `/api/events/:id/...` | Mark attendance, QR scan |
| `notificationRoutes.js` | `/api/notifications` | Per-user + broadcast notifications |
| `chatRoutes.js` | `/api/chat` | AI chatbot (OpenAI + Google Gemini) |
| `uploadRoutes.js` | `/api/upload` | Multer — image 3 MB, banner 2 MB, PDF 5 MB |

**Auth middleware** (`middleware/authMiddleware.js`) — Verifies Supabase JWT from `Authorization: Bearer` header, populates `req.userInfo` with user data + roles. Checks role expiry (`organiser_expires_at`, `support_expires_at`, `masteradmin_expires_at`).

**Database helpers** (`config/database.js`) — Supabase service-role client wrapped in `queryAll()`, `queryOne()`, `insert()`, `update()`, `upsert()`, `remove()` helpers used throughout routes.

**Key env vars (server)**:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` — email via `hello@withsocio.com`
- `GEMINI_API_KEY`, `OPENAI_API_KEY` — chatbot
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist

---

### Database Schema

Supabase PostgreSQL. Core tables: `users`, `events`, `fests`, `registrations`, `attendance_status`, `notifications`, `clubs`, `departments`, `courses`. Migration files live in `server/migrations/` (001–011) and are tracked in a `schema_migrations` table.

**Module 11** (`module11-agent-readme.md`) documents a planned approval workflow (HOD → Dean → CFO → Accounts, plus operational lanes for IT/Venue/Catering) that has migrations staged but is not yet live in the application routes.

---

### Roles & Access Control

Roles are boolean columns on the `users` table with expiry timestamps:

| Role column | Expiry column | Access |
|-------------|--------------|--------|
| `is_organiser` | `organiser_expires_at` | `/manage`, `/create`, `/edit`, `/attendance` |
| `is_support` | `support_expires_at` | `/support` inbox |
| `is_masteradmin` | `masteradmin_expires_at` | `/masteradmin` |

Roles auto-expire when the timestamp passes. Granting/revoking roles goes through `PUT /api/users/:email/roles`.

---

### Notable Patterns

- **Campus detection** — Geolocation + Haversine distance against 6 Christ campuses (15 km threshold). Stored in `AuthContext`, cached in `localStorage` for 12 hours.
- **Identity system** — Christ student emails encode registration number and course; `@christuniversity.in` = staff; all others = outsiders assigned a visitor ID.
- **QR system** — Server generates QR codes via `qrcode`; client scans via `qr-scanner` + device camera.
- **File uploads** — Multer on the Express server; files stored in Supabase Storage buckets.
- **Notifications polling** — Client polls `/api/notifications` every 30 seconds; no WebSocket.
- **Analytics** — Recharts charts in masteradmin, backed by Supabase RPC functions and `lib/adminAnalyticsQueries.ts`.
