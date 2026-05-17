# Google Health daily HRV tracking

## Goals

- Ingest **daily heart rate variability** from the [Google Health API v4](https://developers.google.com/health/reference/rest/v4/) (not the deprecated [Google Fit REST API](https://developers.google.com/fit/rest/v1/reference)).
- Store **one row per user per civil date** in D1 for dashboard graphing.
- Use a **server-side OAuth 2.0 authorization code flow** with a **refresh token** stored encrypted in D1; refresh tokens are never sent to the browser.
- Run an **hourly** Cloudflare Worker cron to reconcile recent days from Google into D1.
- Expose HRV alongside headaches/events via **`GET /api/dashboard`** so the SPA keeps a single chart fetch.

## Non-goals

- Google Fit (`fitness.googleapis.com`) or Android Fit SDK.
- Writing health data back to Google (read-only scope).
- Webhooks for `dailyHeartRateVariability` (optional later phase to reduce polling).

## Official references

- [Google Health API overview](https://developers.google.com/health)
- [Data types (incl. daily-heart-rate-variability)](https://developers.google.com/health/data-types)
- [Setup and OAuth](https://developers.google.com/health/setup)
- [List data points](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list)
- [DailyHeartRateVariability payload](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints#DailyHeartRateVariability)

## Data semantics

- **Primary graph metric**: `daily_rmssd_ms` — whole-night RMSSD in **milliseconds** when present. We also persist `deep_rmssd_ms` when the API exposes a deep-sleep-specific RMSSD, for future UI or analysis.
- **Civil date**: Taken from the API’s daily summary `date` field (`YYYY-MM-DD`). The dashboard chart merges HRV by **local calendar date** (same as headache aggregation); small timezone skew between Google’s civil date and the user’s local day is an accepted limitation unless we later add explicit timezone handling.
- **Availability**: Google documents that health data can lag device sync (often on the order of minutes). Some devices only emit HRV when sleep exceeds a minimum duration; missing days are normal.

## OAuth and Firebase

- **Firebase Google sign-in** issues a Firebase ID token; it does **not** provide a Google OAuth **refresh token** for Google Health scopes.
- **Connect Google Health** uses a Worker-hosted OAuth flow: `access_type=offline`, `prompt=consent` (so Google returns a refresh token on first grant / scope change), **PKCE** (`S256`), and scopes:
  - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
  - `openid` and `email` (to bind the authorized Google account to the Headacher user’s linked **GOOGLE** identity email).
- **Account policy**: Only users with a **GOOGLE** row in `identities` may connect. On callback we require the OAuth `id_token` **email** (verified) to match that identity’s email (case-insensitive). SIWE-only accounts see copy in Settings instead of the connect button.

### Endpoints (Worker)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/integrations/google-health/status` | Bearer JWT | `{ connected, lastSyncAt?, lastError? }` |
| GET | `/api/integrations/google-health/authorize` | Bearer JWT | `{ authorizeUrl }` — SPA navigates here |
| GET | `/api/integrations/google-health/callback` | Public | OAuth redirect; exchanges code; redirects to `/settings?google_health=…` |

### Environment

| Name | Kind | Purpose |
|------|------|---------|
| `GOOGLE_HEALTH_PROJECT_ID` | var | GCP project where **Google Health API** is enabled and the OAuth client was created. **Separate from** `FIREBASE_PROJECT_ID` (Firebase Auth can stay on the original project). Sent as `x-goog-user-project` on Health API calls for quota/billing. |
| `GOOGLE_OAUTH_CLIENT_ID` | var / secret | OAuth client ID (from the Health GCP project) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | secret | Code exchange + refresh |
| `GOOGLE_OAUTH_REDIRECT_URI` | var | Must exactly match GCP console redirect URI (e.g. `https://headacher.example.com/api/integrations/google-health/callback`) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | optional secret | AES-256-GCM key material; if omitted, dev may fall back to deriving from `JWT_SECRET_KEY` (production should set a dedicated secret) |

## D1 schema (summary)

- **`google_health_oauth`**: `user_id` PK, encrypted refresh token, `google_email`, `scope`, `last_sync_at`, `last_error`, timestamps.
- **`hrv_daily`**: `user_id` + `civil_date` unique, `daily_rmssd_ms`, `deep_rmssd_ms`, `source_updated_at`.

## Cron

- Wrangler `[triggers] crons = ["0 * * * *"]` (every hour UTC).
- Handler loads connected users (batched), refreshes access tokens, calls  
  `GET https://health.googleapis.com/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints`  
  with a `filter` on `daily_heart_rate_variability.date` (snake_case in filters; kebab-case in the URL path) for a rolling window (implementation uses recent civil days and/or catch-up from last stored date).
- Updates `last_sync_at` / `last_error` per user; caps work per invocation to stay within CPU limits.

## Dashboard API

- `GET /api/dashboard` includes `hrv: [{ civil_date, daily_rmssd_ms, deep_rmssd_ms? }, …]` for the same window as headaches/events (or all-time when `days=0`, aligned to stored civil dates).

## Token encryption

- Refresh tokens are stored as **AES-256-GCM** ciphertext (IV + tag + ciphertext), base64-encoded string in D1.
- **Rotation**: Changing `GOOGLE_TOKEN_ENCRYPTION_KEY` invalidates stored ciphertext; users must reconnect. Document operational runbook if rotating keys (decrypt with old / encrypt with new requires dual-key window — not implemented in v1).

## Milestones (implementation order)

1. D1 migration + types + docs (this file).
2. OAuth authorize/callback/status + encryption + email binding.
3. Scheduled sync + Health API client + upsert `hrv_daily`.
4. Extend `/api/dashboard` + `src/api.ts` types.
5. Settings + `DashboardChart` (HRV line + RMSSD axis + tooltip).
6. Tests: token crypto round-trip; HRV parser fixtures; route auth/error cases where feasible.

## Test checklist (manual)

- [ ] GCP OAuth client (Web) with correct redirect URI; consent screen + test users if app unverified.
- [ ] `wrangler secret put` for client secret and optional token key.
- [ ] Local: `.dev.vars` with secrets; `wrangler dev`; connect flow returns to Settings with success query param.
- [ ] `wrangler dev --test-scheduled` (or dashboard trigger) runs sync without throwing.
- [ ] Dashboard shows HRV line when rows exist.
