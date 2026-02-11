# Socio -- University Event Platform

A full-featured platform for managing university events, fests, and registrations at Christ University. Built for students, organisers, and administrators.

**Live at** [socio.christuniversity.in](https://socio.christuniversity.in)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Express 5, Node.js (ES Modules) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth), JWT verification |
| Email | Resend (`hello@withsocio.com`) |
| Charts | Recharts (Bar, Pie, Area) |
| QR | `qrcode` (server-side generation), `qr-scanner` (client scanning) |
| Forms | React Hook Form + Zod validation |
| Animations | GSAP + ScrollTrigger, PublishingOverlay (custom) |
| Export | ExcelJS (XLSX), CSV |
| Deployment | Vercel (client + server), Supabase (database) |

---

## User Roles

| Role | Access |
|------|--------|
| **Student** | Browse events, register, view QR tickets, receive notifications |
| **Organiser** | Create/edit/delete own events and fests, manage attendance, send reminders |
| **Support** | Access support inbox, manage contact submissions |
| **Master Admin** | Full platform control -- all users, events, fests, analytics, notifications, role management |

All roles support **expiration dates** with automatic revocation. Last Master Admin protection prevents platform lockout.

---

## Features

### Event Management
- Full CRUD with rich form validation (Zod schema)
- Image (3MB), banner (2MB), and PDF brochure (5MB) uploads
- Custom registration fields -- text, URL, email, number, dropdown, textarea (up to 10)
- Schedule items, rules, prizes, event heads
- Registration fee (separate pricing for outsiders)
- Max participants limit (separate for outsiders)
- Registration deadline enforcement
- WhatsApp group link, claims toggle
- Campus hosted at + allowed campuses (multi-select, 6 campuses)
- Allow outsiders toggle
- Categories: Academic, Cultural, Sports, Arts, Literary, Innovation
- 30+ departments

### Fest Management
- Full CRUD -- name, dates, description, department, venue, fees, banner
- Sponsor management (name + logo URL)
- FAQ section, social links (Instagram, website, etc.)
- Fest timeline with milestones
- Events linked to fest via dropdown

### Registration System
- Individual and team registration (team name, leader info, teammates)
- QR code generated per registration (server-side)
- Registration confirmation email via Resend
- Registration cancellation
- View all user registrations by register ID

### Attendance System
- QR code scanning via device camera (prefers back camera on mobile)
- Camera permission handling with scan result display
- Manual attendance toggle per participant
- Search/filter participants by name or email
- Filter by status (all / registered / attended / absent)
- CSV export of full attendance sheet

### Notification System
- Bell icon with unread count badge in navigation bar
- Types: info, success, warning, error
- 30-second polling for new notifications
- Paginated list (20 per page, load more)
- Mark individual or all as read, clear all
- Admin: broadcast to all users, event-targeted, or individual notifications
- Notification history with stats (total, broadcasts, individual, today)

### Email System
- Welcome email (branded HTML, visitor ID for outsiders, confirmation for members)
- Registration confirmation email (event details, registration ID)
- Plain text fallback for deliverability

### Campus Detection
- Geolocation API with Haversine distance calculation
- 6 campuses: Central (Main), Bannerghatta Road, Yeshwanthpur, Kengeri, Delhi NCR, Pune Lavasa
- 15 km maximum distance threshold
- Confirm flow: detecting -> confirm -> save
- 12-hour dismiss cooldown via localStorage
- Auto-triggered for Christ members without campus set

### Admin Panel (Master Admin)
- **Dashboard**: analytics with Recharts (user distribution pie, event stats, registration trends area chart, recent activity feed, quick actions), date range filter (7d/30d/90d/1y/all), CSV export
- **Users**: search, role filter, sort by name/email, pagination (20/page), edit roles with expiry date picker, delete users
- **Events**: search, status filter (Live/This Week/Upcoming/Past), sort by title/date/registrations/dept, edit/delete any event
- **Fests**: search, sort, filter, edit/delete any fest
- **Notifications**: compose and send broadcasts, individual, or event-targeted notifications; history with search/filter
- Debounced search inputs for performance

### Discovery Hub
- Full-width image carousel from event banners
- Trending events, upcoming events, fests sections
- Category browsing (Academic, Cultural, Sports, Arts, Literary, Innovation)
- Clubs/Centres directory (15+ centres, 8 categories)
- Campus filter dropdown

### Identity System
- Christ members: auto-extracts registration number and course code from email domain
- Staff detection: `@christuniversity.in` (bare domain) shows "Staff" for course/department
- Outsiders: assigned visitor ID, welcome modal, one-time name edit
- Terms consent modal before sign-up

### Interactive Guides
- Organiser Guide (`/guide/organiser`) -- 6 collapsible sections covering event/fest creation, management, attendance, notifications, tips
- Master Admin Guide (`/guide/masteradmin`) -- 7 collapsible sections covering dashboard, users, roles, events/fests, notifications, tips
- Accessible from profile page based on role

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, features, upcoming events, FAQs |
| `/auth` | Google OAuth sign-in |
| `/Discover` | Discovery hub with carousel, trending, categories, campus filter |
| `/events` | All events listing with search |
| `/event/[id]` | Event detail, registration form |
| `/fests` | All fests listing |
| `/fest/[id]` | Fest detail page |
| `/clubs` | Centres and cells directory |
| `/club/[id]` | Individual centre/cell page |
| `/profile` | User profile, registered events, guide buttons |
| `/manage` | Organiser dashboard (own events, admin sees all) |
| `/create/event` | Event creation form |
| `/create/fest` | Fest creation form |
| `/edit/event/[id]` | Edit event |
| `/edit/fest/[id]` | Edit fest |
| `/attendance` | Attendance manager with QR scanner |
| `/masteradmin` | Admin panel (dashboard, users, events, fests, notifications) |
| `/guide/organiser` | Organiser feature guide |
| `/guide/masteradmin` | Master Admin feature guide |
| `/about` | About, `/about/story`, `/about/team`, `/about/mission` |
| `/contact` | Contact form |
| `/support` | Knowledge base, `/support/inbox` (support role), `/support/careers` |
| `/faq` | Frequently asked questions |
| `/pricing` | Pricing tiers (Free, Basic, Pro, Enterprise) |
| `/solutions` | Use-case solutions (college fests, department events, sports) |
| `/app-download` | Mobile app coming soon page |
| `/privacy`, `/terms`, `/cookies` | Legal pages |

---

## API Endpoints

### Users (`/api/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all users (admin) |
| GET | `/:email` | Get user by email |
| POST | `/` | Create/update user (upsert) |
| PUT | `/:email/name` | Update display name |
| PUT | `/:email/campus` | Update campus |
| PUT | `/:email/roles` | Grant/revoke roles with expiry (admin) |
| DELETE | `/:email` | Delete user (admin) |

### Events (`/api/events`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all events |
| GET | `/:eventId` | Get event by ID |
| POST | `/` | Create event (with file uploads) |
| PUT | `/:eventId` | Update event |
| DELETE | `/:eventId` | Delete event |

### Fests (`/api/fests`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all fests |
| GET | `/:festId` | Get fest by ID |
| POST | `/` | Create fest |
| PUT | `/:festId` | Update fest |
| DELETE | `/:festId` | Delete fest |

### Registrations (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register for event (individual or team) |
| GET | `/registrations` | List registrations (filterable) |
| GET | `/registrations/:id` | Get single registration |
| GET | `/registrations/:id/qr-code` | Get QR code image |
| DELETE | `/registrations/:id` | Cancel registration |
| GET | `/registrations/user/:registerId/events` | User's registered events |

### Attendance (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/events/:eventId/participants` | List event participants |
| POST | `/events/:eventId/attendance` | Mark attendance (manual) |
| POST | `/events/:eventId/scan-qr` | Mark attendance via QR scan |

### Notifications (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | Get user notifications (paginated) |
| POST | `/notifications` | Create notification |
| POST | `/notifications/broadcast` | Broadcast to all users |
| PATCH | `/notifications/:id/read` | Mark as read |
| PATCH | `/notifications/mark-read` | Mark multiple as read |
| DELETE | `/notifications/:id` | Delete notification |
| DELETE | `/notifications/clear-all` | Clear all notifications |
| GET | `/notifications/admin/history` | Admin notification history |

### Other
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload/fest-image` | Upload fest image |
| POST | `/api/contact` | Submit contact form |
| GET | `/api/support/messages` | Get support messages |
| PATCH | `/api/support/messages/:id` | Update message status |

---

## Setup

### Prerequisites
- Node.js v18+
- Supabase project (for auth and database)
- Resend API key (for emails)

### Server
```bash
cd server
npm install
npm run dev
# Runs on http://localhost:8000
```

### Client
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:3000
```

### Environment Variables

**Server** -- create `.env` in `/server`:
```
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
RESEND_API_KEY=<your-resend-key>
ALLOWED_ORIGINS=https://socio.christuniversity.in,http://localhost:3000
```

**Client** -- create `.env.local` in `/client`:
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## Security

- Supabase JWT token validation on all protected routes
- Role-based access control (organiser, support, master admin)
- Client-side middleware + server-side auth middleware
- Role expiration with automatic revocation
- Last Master Admin lockout protection
- File size limits enforced (image 3MB, banner 2MB, PDF 5MB)
- CORS restricted to allowed origins

---

## Deployment

Both client and server deploy to **Vercel** with their respective `vercel.json` configs. Database and auth are hosted on **Supabase**.

---

## Contributing

1. Follow existing code structure and patterns
2. Use TypeScript with proper type definitions
3. Test features before submitting
4. Follow the established UI guidelines (brand colors: `#154CB3`, `#063168`, `#FFCC00`)
