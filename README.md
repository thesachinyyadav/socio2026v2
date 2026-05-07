# Socio

Socio is a university event and operations platform for Christ University. It covers the public event discovery experience, event and fest management, registrations, QR tickets, attendance, approvals, support workflows, and several role-gated operational portals.

The repo is a two-app monorepo:

- [client](client) is the Next.js 15 front end.
- [server](server) is the Express 5 API.

Live deployment: [socio.christuniversity.in](https://socio.christuniversity.in)

## What This Repo Contains

The old README only described the public event platform. The current codebase is broader:

- Public site, event discovery, fest pages, clubs, policies, support, and marketing pages.
- Protected organiser workflows for creating and editing events and fests.
- Attendance, QR scanning, registration lookup, notifications, and feedback.
- Approval and operations portals for HOD, Dean, CFO, Accounts, Venue, Catering, IT, Stalls, and Volunteer workflows.
- Admin tools for users, roles, analytics, and broadcasts.

## Architecture

| Layer | Stack |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Express 5, Node.js ES modules |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth with JWT verification |
| Email | Resend |
| Charts | Recharts |
| QR | `qrcode` on the server, `qr-scanner` on the client |
| Forms | React Hook Form + Zod |
| Motion | GSAP, ScrollTrigger, and custom animated UI blocks |
| Deployment | Vercel for app delivery, Supabase for auth/database |

### Client

The client is a Next.js App Router application. It uses Supabase browser access for read-heavy product features and calls the Express API for privileged actions such as uploads, attendance, notifications, chat, and operational workflows.

Important client-side pieces:

- `client/app` contains the routes and page-level layouts.
- `client/context` holds the main React contexts for auth, events, and consent.
- `client/lib` contains Supabase helpers, analytics adapters, and shared utilities.
- `client/middleware.ts` protects authenticated and role-gated routes before they render.

### Server

The server is a single Express entry point in [server/index.js](server/index.js) that mounts all route modules, configures CORS, serves uploads, and applies Sentry when configured.

Notable server responsibilities:

- Supabase JWT verification and user hydration.
- Role expiry checks and access control.
- CRUD APIs for users, events, fests, clubs, and registrations.
- Attendance scanning and manual attendance updates.
- Notifications, contact forms, reports, approvals, service requests, venue bookings, catering, stalls, volunteer flows, and analytics.
- File uploads and static file serving.

### Database

The app uses Supabase PostgreSQL. Database migrations live in [server/migrations](server/migrations), and migration utilities live in [server/scripts](server/scripts).

## Main Product Areas

### Public Experience

- Landing page with hero content, animated sections, featured events, and FAQs.
- Discovery hub for events and fests.
- Event, fest, and club detail pages.
- Support, FAQ, pricing, solutions, about, privacy, terms, cookies, and app download pages.

### Event and Fest Management

- Create and edit events and fests.
- Upload images, banners, brochures, and other assets with size limits enforced server-side.
- Configure custom registration fields, fees, participant limits, outsider rules, deadlines, and scheduling details.
- Manage sub-heads, sponsor blocks, timelines, FAQs, and related metadata.

### Registration and Tickets

- Individual and team registrations.
- QR code generation for registrations.
- Registration lookup and cancellation.
- Ticket and participant views for event owners and attendees.

### Attendance and Operations

- QR scanning with camera support and mobile-friendly flows.
- Manual attendance marking and participant filtering.
- Approvals and service-request style portals for internal operations.
- Booking flows for venues, catering, and stalls.

### Admin and Analytics

- User management, role grants, and expiry handling.
- Event, fest, and notification administration.
- HOD and Dean analytics routes.
- Master admin dashboards backed by Supabase data and Recharts visualizations.

## Important Routes

This is not a complete route inventory, but it covers the parts that matter most.

### Public and Discovery

- `/` landing page
- `/auth` sign-in
- `/Discover` discovery hub
- `/events`, `/event/[id]`
- `/fests`, `/fest/[id]`
- `/clubs`, `/club/[id]`
- `/about`, `/about/story`, `/about/team`, `/about/mission`
- `/contact`, `/faq`, `/pricing`, `/solutions`, `/app-download`
- `/privacy`, `/terms`, `/cookies`

### Protected User and Organiser Flows

- `/profile`
- `/manage`
- `/create/event`, `/create/fest`
- `/edit/event/[id]`, `/edit/fest/[id]`
- `/attendance`
- `/event/[id]/register`
- `/event/[id]/participants`
- `/event/[id]/ticket/[registrationId]`
- `/feedback/[eventId]`, `/feedbacks/[eventId]`

### Operations and Admin

- `/masteradmin`
- `/hod`, `/dean`, `/cfo`, `/accounts`
- `/venue`, `/catering`, `/it`, `/stalls`
- `/volunteer`, `/volunteer/scanner/[eventId]`
- `/bookvenue`, `/bookcatering`, `/bookstall`
- `/clubeditor/[id]`, `/edit/clubs/[id]`
- `/approvals/[itemId]`
- `/support`, `/support/inbox`, `/support/careers`
- `/statuscheck`

## API Surface

The Express server mounts route modules under `/api`.

| Area | Mounted path | Purpose |
|---|---|---|
| Auth | `/api/auth` | Session and auth helpers |
| Users | `/api/users` | User CRUD and role management |
| Events | `/api/events` | Event CRUD and protected event operations |
| Fests | `/api/fests` | Fest CRUD |
| Registrations | `/api/register`, `/api/registrations` | Register, cancel, lookup, and QR ticket flow |
| Attendance | `/api/attendance` and event-scoped attendance routes | Manual attendance and QR scan flows |
| Notifications | `/api/notifications` | User notifications and broadcasts |
| Uploads | `/api/upload` | File upload handling |
| Contact and reports | `/api/contact`, `/api/report` | Contact submissions and reporting |
| Chat | `/api/chat` | Chatbot / assistant flows |
| Approvals and services | `/api/approval`, `/api/service-request` | Operational approvals and requests |
| Venue and catering | `/api/venue`, `/api/venue-booking`, `/api/catering` | Venue and dining workflows |
| Stalls and volunteering | `/api/stall-booking`, `/api/volunteer` | Stall and volunteer operations |
| Clubs | `/api/clubs` | Clubs, cells, and related management |
| Analytics | `/api/analytics`, `/api/hod-analytics`, `/api/dean-analytics` | Dashboard and role-specific reporting |
| Utilities | `/api/statuscheck`, `/api/feedback` | Health and feedback flows |

## Getting Started

### Prerequisites

- Node.js 18 or newer
- A Supabase project
- Resend API key if you want email delivery enabled

### Install

From the repo root:

```bash
npm run install-all
```

This installs the root, client, and server dependencies.

### Run Locally

Start both apps from the root:

```bash
npm run dev
```

That runs the server and client together.

Or run them individually:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Default ports:

- Client: `http://localhost:3000`
- Server: `http://localhost:8000`

### Build and Lint

Client scripts:

```bash
cd client
npm run build
npm run lint
```

Server scripts:

```bash
cd server
npm run start
```

### Migrations

```bash
cd server
npm run migration:status
npm run migration:up
npm run migration:create
```

See [server/MIGRATIONS.md](server/MIGRATIONS.md) for the migration workflow.

## Environment Variables

### Client

Create `client/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NEXT_PUBLIC_APP_URL` is used as a redirect fallback in middleware.

### Server

Create `server/.env` or `server/.env.local`:

```bash
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
RESEND_API_KEY=<your-resend-key>
ALLOWED_ORIGINS=https://socio.christuniversity.in,http://localhost:3000
ALLOWED_ORIGIN_PATTERNS=^https://.*\.vercel\.app$,^https://.*\.christuniversity\.in$
SENTRY_DSN=<optional-sentry-dsn>
PORT=8000
```

Depending on your deployment and database setup, you may also need:

- `SUPABASE_DB_URL`
- `DB_SSL`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`

## Security and Access Control

- Supabase JWT verification on protected API routes.
- Route guarding in the client middleware.
- Role expiry for organiser, support, master admin, and operational roles.
- CORS allowlist plus regex-based origin patterns.
- Upload limits enforced on the server.
- The middleware blocks management, operational, and club-editor routes unless the user has the right access.

## Deployment Notes

Both apps are configured for Vercel. The server is written so it can run locally or in a serverless runtime, and the database/auth layer is provided by Supabase.

Useful files when you are changing deployment or infra behavior:

- [client/middleware.ts](client/middleware.ts)
- [server/index.js](server/index.js)
- [server/config/database.js](server/config/database.js)
- [server/middleware/authMiddleware.js](server/middleware/authMiddleware.js)

## Contributing

- Keep changes consistent with the existing client/server split.
- Prefer updating the feature area you are touching rather than broad refactors.
- Keep route and env documentation in sync when you add a new portal or API module.
- Follow the existing brand system already used in the client.
