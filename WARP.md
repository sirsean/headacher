# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## 1) Common terminal commands for this repo
- Install dependencies: npm ci
- Dev (unified SPA + API via Cloudflare Vite plugin): npm run dev (serves http://localhost:5173)
- Build (type-check + bundle): npm run build
- Preview static build locally: npm run preview
- Lint: npm run lint
- Tests:
  - Run all: npm run test
  - Watch: npm run test:watch
  - Coverage: npm run test:coverage
  - UI: npm run test:ui
  - Single test file: npx vitest tests/path/to/file.test.ts
  - Single test by name: npm run test -- -t "substring"
- Cloudflare Worker types (Env typing): npm run cf-typegen
- Database (local D1):
  - Apply migration: npm run db:migrate
  - Apply schema: npm run db:schema
  - Seed sample data: npm run db:seed
- Deploy to Cloudflare: npm run deploy
- Secrets:
  - Production: wrangler secret put JWT_SECRET_KEY
  - Local: add JWT_SECRET_KEY=... to .dev.vars (do not commit)

## 2) High-level architecture and structure (big picture)
- Cloudflare Worker (Hono) API
  - Entry: worker/index.ts exports app.fetch from worker/hono-app.ts.
  - App and middleware (worker/hono-app.ts):
    - Global CORS for /api/* using permissive corsHeaders.
    - Authentication middleware requireAuthentication reads/validates JWT and sets c.set('addr') for user scoping.
    - Centralized error handling via HttpError -> consistent JSON shape { error: { status, message, details } }.
  - Routes (JWT-protected unless noted):
    - Public: GET /api/health
    - Auth: GET /api/auth/nonce (SIWE), POST /api/auth/verify (issues JWT), POST /api/auth/logout
    - Headaches: /api/headaches (GET, POST), /api/headaches/:id (GET, PATCH, DELETE)
    - Events: /api/events (GET, POST), /api/events/:id (GET, PATCH, DELETE)
    - Event types: GET /api/events/types (distinct event_type values)
    - Dashboard: GET /api/dashboard?days=N (summarizes headaches + events over a range)
  - Static assets + SPA fallback:
    - Non-/api requests are served via ASSETS binding; HTML requests fall back to index.html; immutable cache headers applied to common asset types.
  - Utilities (worker/utils.ts):
    - CORS headers and JSON/error helpers
    - D1 helpers (dbAll, dbFirst, dbRun) and row mappers (mapHeadache, mapEvent)
    - Validation (timestamps, ints) and ISO normalization
    - JWT helpers: getJwtSecretKey() and requireAuth()/requireAuthentication

- Data model (Cloudflare D1 / SQLite)
  - Canonical migration: migrations/0001_initial_with_users.sql (users, nonces, headaches, events, settings). headaches/events are user-scoped via user_id -> users(address); indexes on timestamp/type/user_id.
  - Note: worker/schema.sql enforces NOT NULL user_id; worker/seed.sql inserts do not include user_id. Prefer using the migration file for local schema. If using worker/schema.sql directly, adjust seed to set user_id.
  - wrangler.toml: D1 binding name DB; preview_database_id=headacher.

- Frontend SPA (React + Vite + TypeScript)
  - Vite config (vite.config.ts): @vitejs/plugin-react, @cloudflare/vite-plugin, @tailwindcss/vite; build outDir=dist.
  - Client entry (src/main.tsx) with pages/components in src/*; types in src/types.ts.
  - API client (src/api.ts): same-origin; typed helpers for headaches/events + dashboard; error normalization.
  - Authentication (src/context/AuthContext.tsx): Reown AppKit + Wagmi for wallet connect; SIWE (siwe) message signing; server issues JWT (jose). JWT stored in localStorage and attached via fetchWithAuth; 401 clears token and redirects to '/'.
  - Data/mutations: src/context/MutationsContext.tsx orchestrates create/delete; src/hooks/useHeadacheEntries.ts fetches lists in parallel; UI components include TypeaheadInput and a dashboard chart.
  - Styling: Tailwind v4 via plugin; global styles in src/index.css, App.css.

- Cloudflare configuration
  - wrangler.toml: main=worker/index.ts, compatibility_flags=["nodejs_compat"], ASSETS bound to ./dist/client, D1 DB binding, logs enabled, custom_domain route.
  - Env types: npm run cf-typegen generates worker-configuration.d.ts; referenced in tsconfig.

## 3) Environment and operational notes
- Requires Node 20+.
- Local development:
  - Use npm run dev. The Cloudflare Vite plugin runs both the SPA and the Worker API together on http://localhost:5173. API endpoints are available at the same origin under /api/* during development.
  - During development, assume the dev server is already running in another tab on port 5173. Do not attempt to start it from this agent.
- Secrets: JWT_SECRET_KEY must be set (wrangler secret in production; .dev.vars locally). Do not commit .dev.vars.
- Testing: Vitest v3 configured (vitest.config.ts) with globals, node env, coverage reporters, and aliases @ -> ./src and @worker -> ./worker.
- TypeScript: project references for app/node/worker; tsconfig.json brings in worker-configuration.d.ts types for Worker Env.
- Gotchas:
  - If wrangler.toml bindings/vars change, rerun npm run cf-typegen and restart TS tooling.
  - wrangler.toml assets directory is ./dist/client; ensure the final build outputs what the Worker expects before deploy.

## 4) Pointers to in-repo docs (skim these when needed)
- README.md: local D1 setup, JWT secret generation, endpoint overview, example curl calls, quick CORS check.
- docs/API_USAGE.md: how to pass fetchWithAuth to API helpers; automatic 401 handling; available client functions.
- docs/PLAN.md: MVP scope and architecture context.
- docs/SIWE_JWT_LIBRARIES.md: chosen SIWE/JWT libraries and Workers-compatibility rationale.
- src/components/README-TypeaheadInput.md: Typeahead component usage/behavior.
