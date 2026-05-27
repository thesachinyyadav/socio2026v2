# Contributor Code of Conduct

This document defines the standards every contributor must follow before
submitting any change to the SOCIO codebase. It is not optional — a pull
request that violates these standards will be rejected regardless of its
functional correctness.

---

## 1. Visual Consistency

### Color palette
All UI work must use the established design tokens. Do not introduce new hex
values without explicit approval.

| Token | Value | Usage |
|---|---|---|
| Primary blue | `#154CB3` | Buttons, links, active states, borders |
| Dark blue | `#063168` | Nav text, headings, dark accents |
| Surface | `#FFFFFF` | Page and card backgrounds |
| Text | `#101010` | Body copy |
| Border | `border-gray-200` (Tailwind) | Card and input borders |
| Admin accent | `bg-[#154CB3]/8` | Icon containers in admin stats |

Do not use raw Tailwind color scales (`blue-500`, `indigo-600`, etc.) in
components that already have an established `#154CB3` pattern. Consistency
matters more than Tailwind's defaults.

### Typography
- The project uses **DM Sans** loaded via `next/font/google`. Do not import
  any other typeface without updating `layout.tsx`.
- Font sizes, weights, and spacing must follow what is already in use in
  adjacent components. Check the nearest sibling component before picking a
  size.

### Icon library
All icons must come from **Lucide React** (`lucide-react`). Do not introduce
icons from Heroicons, React Icons, Font Awesome, or any other library. Do not
add inline SVGs unless there is no Lucide equivalent.

### Component patterns
- Admin panels: two-column layout (`grid-cols-1 lg:grid-cols-[380px_1fr]`),
  white card with `border border-gray-200 rounded-xl shadow-sm`, section
  header `px-5 py-3.5 border-b bg-gray-50/60`.
- Buttons: rounded-full for primary actions, rounded-lg for secondary/table
  actions.
- Empty states: Lucide icon at `strokeWidth={1.5}`, muted title, muted
  sub-text.

Look at an existing admin component (e.g. `AdminNotifications.tsx`,
`AdminDashboardView.tsx`) and match its visual language exactly before
writing new UI.

---

## 2. Pre-Push Checklist

Run every item below before opening a pull request. A build that fails or a
linter that reports warnings is a hard block.

```bash
# From /client
npm run build      # must complete with 0 errors
npm run lint       # zero warnings allowed (--max-warnings 0 is enforced)
```

If `npm run build` surfaces a TypeScript error you did not introduce, note it
in your PR description. Do not leave new TypeScript errors unaddressed.

---

## 3. No Runtime Errors in the Browser

Before submitting, open the browser DevTools console on every page your change
touches and confirm:

- Zero unhandled JavaScript errors
- Zero React hydration warnings (`Warning: Prop ... did not match`)
- Zero "missing key" warnings in lists
- Zero `useLayoutEffect` / `useEffect` dependency warnings

If you see a warning you cannot immediately fix, add a comment in the code
explaining why and open a follow-up issue. Do not silently ignore console
output.

---

## 4. Caching Rules

Caching in this project is intentional and load-bearing. Misuse causes stale
data, hard-to-reproduce bugs, and broken user sessions.

### Server-side (`unstable_cache`)
- Only cache **public, non-personalised** data (event lists, fest lists).
- Set a meaningful `revalidate` interval. Never cache user-specific or
  role-gated data server-side.
- Tag cached entries (`tags: ['events']`) so they can be invalidated on
  mutation.

### Client-side (`localStorage`)
- Only the auth layer (`AuthContext`) is permitted to write to `localStorage`.
  Do not reach into `localStorage` from components or pages — read from
  context instead.
- Keys in use: `socio_session`, `socio_user_data`. Do not add new keys without
  updating `AuthContext` and documenting them here.
- Session and user data are restored via `useLayoutEffect` (before first
  paint). Do not move this to `useEffect` — it re-introduces the auth flash.

### HTTP / browser cache
- All `/api/*` responses carry `Cache-Control: no-store` headers (set in
  `server/index.js`). Do not remove or weaken these headers.
- Do not add `cache: 'force-cache'` to `fetch()` calls that hit the Express
  API. Supabase direct queries (via `lib/api.ts`) may use caching only for
  static reference data.

---

## 5. API and Data Access

- **Privileged operations** (registration, attendance, notifications, uploads)
  go through the Express server at `NEXT_PUBLIC_API_URL`. Do not call Supabase
  directly from the client for these.
- **Public read operations** (event lists, fest lists) use the Supabase
  browser client in `lib/api.ts`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. It belongs only in
  the server environment.
- **Never hardcode any URL, hostname, port, API key, secret, or environment-
  specific value anywhere in the codebase.** This is a zero-tolerance rule.
  Every value that can differ between development, staging, and production must
  live in an environment variable.
- Use `NEXT_PUBLIC_API_URL` on the client and `SUPABASE_URL` on the server.
  A hardcoded domain, IP address, Vercel URL, or localhost string found in
  committed code is an automatic rejection — no exceptions.

---

## 6. Error Messages

Error responses shown to users must be helpful, not diagnostic.

`"Registration could not be completed. Please try again."`
`"duplicate key value violates unique constraint \"registrations_pkey\""`

- Strip `error.message`, `error.details`, database column names, and table
  names from all API responses before they reach the client.
- Log the full error server-side (`console.error`) for developer visibility.
- The global error handler in `server/index.js` is the last line of defence —
  do not rely on it. Handle errors explicitly in each route.

---

## 7. Security

- **No SSRF**: Do not make server-side `fetch()` calls to user-supplied URLs.
  Validate image/file URLs by format only, never by fetching them.
- **No hardcoded values of any kind**: API keys, secrets, URLs, hostnames,
  ports, feature flags, and environment-specific strings must all come from
  environment variables. If a value would need to change between dev and
  production, it is not allowed in source code — period. `.env` files must
  never be committed; add any new secret file patterns to `.gitignore`
  immediately.
- **CORS**: New origins must be added to `DEFAULT_ALLOWED_ORIGINS` or
  `DEFAULT_ALLOWED_ORIGIN_PATTERNS` in `server/index.js` with a comment
  explaining why.
- **Input validation**: Validate and sanitise all user input at the Express
  route level before it reaches the database layer.

---

## 8. Code Style

- **No comments explaining what code does** — name things clearly instead.
  Only add a comment when the *why* is non-obvious (a workaround, a hidden
  constraint, a subtle invariant).
- **No dead code** — remove unused variables, imports, and components. Do not
  comment out code and leave it in.
- **No new packages without justification** — open a discussion before adding
  a dependency. Prefer extending an existing package already in `package.json`.
- **Consistent state management** — this project uses React Context only (no
  Redux, Zustand, or Jotai). Do not introduce a new state library.
- **No `any` casts** unless absolutely necessary, and even then add a comment
  explaining why the type cannot be derived.

---

## 9. Roles and Access Control

If your change touches role-gated routes or middleware:

- Test with an account that does **not** have the required role and confirm
  the gate holds.
- Check that role expiry timestamps (`organiser_expires_at`, etc.) are
  respected — do not grant access to a user whose role has expired.
- Middleware (`client/middleware.ts`) is the enforcement layer for page-level
  access. Route handlers in Express are the enforcement layer for API access.
  Both must be updated if a new role is introduced.

---

## 10. Commit Discipline

- One logical change per commit. Do not bundle unrelated fixes.
- Commit messages must be in the imperative: `fix: session fetch timeout`,
  `feat: club editor nav`, not `fixed stuff` or `updates`.
- Run the build and lint before every push, not just before opening a PR.
- Never use `--no-verify` to skip hooks.

---

Violations of this code of conduct will result in the pull request being
closed without merge until the issues are resolved. If you have a question
about any of these standards, open a discussion before writing code.
