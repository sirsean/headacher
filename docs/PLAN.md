# Plan: Headacher MVP

This document describes what we will build for the Headacher MVP, grounded in the current repository state and calling out gaps to fill.

## 1) Project context (confirmed from repo)
- App shell: React 19 + Vite 7 (TypeScript)
- Dev tooling: ESLint 9, TypeScript ~5.8
- Cloudflare integration:
  - Cloudflare Worker entry: `worker/index.ts`
  - Build: `@cloudflare/vite-plugin` in `vite.config.ts`
  - Config: `wrangler.jsonc` (assets set for SPA 404 handling; no bindings yet)
- Current API: `GET /api/` returns `{ name: "Cloudflare" }` (placeholder)
- Not present yet: Tailwind CSS, Recharts, Cloudflare D1 binding/schema

## 2) Goal and MVP scope
An opinionated, lightweight headache tracking app you can deploy globally on Cloudflare.

MVP user stories
- As a user, I can record a headache entry with date/time, pain level (0–10), duration, optional notes, and optional triggers.
- As a user, I can view a simple history list of my last N entries.
- As a user, I can see a basic chart of pain level over time for the last 30 days.
- As a user, I can edit or delete an entry I created in this browser session.

Out of scope for MVP
- Authentication and multi-user accounts
- Sync across devices or export/import
- Complex analytics, reminders/notifications, or tag management UI

## 3) Tech choices (current vs. to add)
- Frontend
  - React + Vite + TypeScript (present)
  - Tailwind CSS (to add) for rapid UI styling
  - Recharts (to add) for the basic time-series chart
- Backend
  - Cloudflare Worker (present) to expose a minimal JSON API
  - Cloudflare D1 (to add) as the persistent store
- Deployment
  - Wrangler deploy to Cloudflare (present, scripts in package.json)

## 4) Architecture overview
- Single-page app served as static assets; SPA not-found handling is enabled via Wrangler.
- API is routed under `/api/*` by `worker/index.ts`.
- Database access occurs only in the Worker; the browser talks to the Worker via fetch.
- Minimal schema with two tables for headaches and events to support logging and timeline views.

## 5) Data model (D1)
Tables
- headaches
  - id TEXT PRIMARY KEY NOT NULL DEFAULT uuid_v4() via SQLite expression using randomblob (see schema.sql)
  - timestamp TEXT NOT NULL — ISO-8601 UTC (e.g., 2025-08-10T03:00:00Z)
  - severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10)
  - aura INTEGER NOT NULL CHECK (aura IN (0,1)) — boolean stored as 0/1
- events
  - id TEXT PRIMARY KEY NOT NULL DEFAULT uuid_v4() via SQLite expression using randomblob (see schema.sql)
  - timestamp TEXT NOT NULL — ISO-8601 UTC
  - event_type TEXT NOT NULL — free-form text
  - value TEXT NOT NULL — free-form text

Notes
- UUIDs are generated in-database using a standard v4 pattern composed from randomblob() to avoid app-side UUID generation.
- Timestamps are stored in UTC as ISO-8601 strings; display should be localized in the UI.
- events are global timeline items and are not tied to a specific headache.

Indexes
- headaches(timestamp)
- headaches(severity)
- events(timestamp)
- events(event_type)

Seed/data migration
- Initial SQL to create tables and indexes in `worker/schema.sql`; sample inserts for local dev in `worker/seed.sql`.

## 6) API design (Worker)
Base: `/api`
- GET `/entries?limit=50` — list recent entries (default 30)
- POST `/entries` — create entry
  - body: { created_at?: string, pain_level: number, duration_minutes?: number, triggers?: string[], notes?: string }
  - server normalizes: created_at (if absent) to now; triggers[] -> comma-separated string
- PATCH `/entries/:id` — update any subset of fields
- DELETE `/entries/:id` — delete entry

HTTP details
- JSON only; return 201 on create with { id, ...body }
- Basic validation: range check pain_level 0–10; duration_minutes >= 0
- CORS not necessary for same-origin SPA; keep endpoints behind the same domain

## 7) Frontend pages/components
- Home ("Log entry")
  - Form fields: pain level slider/input, date-time (defaults to now), duration (minutes), triggers (token input comma-separated), notes (textarea)
  - Submit posts to `/api/entries`
- History
  - List of recent entries with edit/delete actions
- Chart
  - Simple line chart of pain_level by date for last 30 days using Recharts

Shared components
- EntryForm, EntryList, ChartCard

State
- Lightweight local React state; fetch-on-navigate for lists

Styling
- Tailwind utility classes; minimal config

## 8) Implementation plan
Phase 0 — Repo hygiene
- Add PLAN.md (this file)
- Confirm Node and Wrangler versions in README

Phase 1 — D1 setup
- Add D1 binding in `wrangler.jsonc` (e.g., "d1_databases": [{ binding: "DB", database_name: "headacher", database_id: "..." }])
- Add `worker/schema.sql` and `worker/seed.sql`
- Local dev: use Miniflare D1; provide npm scripts:
  - `wrangler d1 execute headacher --file worker/schema.sql --local`
  - `wrangler d1 execute headacher --file worker/seed.sql --local`

Phase 2 — Worker API
- Expand `worker/index.ts` routing for `/api/entries`
- Implement CRUD using `env.DB.prepare(...).bind(...).run()` patterns
- Input validation and error handling

Phase 3 — Frontend wiring
- Install Tailwind; configure `postcss.config.js`, `tailwind.config.js`, and index.css directives
- Build EntryForm, History list, and Chart page
- Install Recharts and draw basic line chart

Phase 4 — Deploy
- `npm run deploy` to Cloudflare
- Create a D1 database in production and apply schema

## 9) Dependencies to add
- Tailwind CSS: tailwindcss, postcss, autoprefixer
- Recharts: recharts
- Types (none needed for recharts; uses TS types bundled)

## 10) Environment and config
- `wrangler.jsonc`
  - add D1 binding: `{ "d1_databases": [{ "binding": "DB", "database_name": "headacher" }] }`
  - ensure `assets` SPA handling remains enabled
- `tsconfig.worker.json`
  - already includes Worker types via `worker-configuration.d.ts`

## 11) Validation and testing
- Manual tests via the UI and curl for API endpoints
- Basic input validation in Worker
- Optional: add a few vitest tests for utility functions (future)

## 12) Open questions / assumptions
- Single-user assumption for MVP; no auth
- Timezone handling: store UTC; display in local browser timezone
- Trigger taxonomy: free-text for MVP; can evolve to normalized table later

## 13) Success criteria for MVP
- A user can: create, list, edit, delete entries from the SPA
- Data persists across page refreshes (D1)
- A simple last-30-days chart renders without errors
- App is deployed and accessible via Cloudflare with SPA routing working

