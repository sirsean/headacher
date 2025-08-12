# Headacher API (Cloudflare Worker + D1)

This repository contains a Cloudflare Worker that exposes a simple JSON API backed by a local D1 (SQLite) database. It supports two resources:

- Headaches: timestamp, severity (0–10), aura (0 or 1)
- Events: timestamp, event_type, value

Endpoints live under /api and support CORS for browser clients.

## Prerequisites
- Node 20+
- Wrangler (installed via devDependencies): npx wrangler

## Environment Setup

### JWT Secret Key

The application requires a JWT secret key for authentication. You need to generate and configure this secret both locally and in the Cloudflare environment.

#### Generating the Secret

Generate a secure random key using OpenSSL:

```bash
openssl rand -base64 32
```

This will output a base64-encoded string like: `WFdkKCFqJgMS32q5k336mlfSWr4ABvSbl3DyJP9QlBg=`

#### Setting the Secret in Cloudflare (Production)

To set the secret in your Cloudflare Worker environment:

```bash
echo "YOUR_GENERATED_SECRET_HERE" | wrangler secret put JWT_SECRET_KEY
```

Replace `YOUR_GENERATED_SECRET_HERE` with the actual secret generated from the OpenSSL command.

#### Setting the Secret Locally (Development)

For local development, you can set the secret as an environment variable in your `.dev.vars` file (create this file in your project root if it doesn't exist):

```
JWT_SECRET_KEY=YOUR_GENERATED_SECRET_HERE
```

Alternatively, you can set it as a system environment variable:

```bash
export JWT_SECRET_KEY="YOUR_GENERATED_SECRET_HERE"
```

**Important:** Never commit your `.dev.vars` file or actual secret values to version control. Add `.dev.vars` to your `.gitignore` file.

## Local development with D1

1) Apply migrations to local D1 (uses preview_database_id from wrangler.toml):

- npx wrangler d1 migrations apply headacher --local

2) Run the Worker locally against the local D1 database:

- npx wrangler dev --local

By default the API will be available at http://127.0.0.1:8787.

## API Overview
- GET /api/health
- Headaches
  - GET /api/headaches
  - POST /api/headaches
  - GET /api/headaches/:id
  - PATCH /api/headaches/:id
  - DELETE /api/headaches/:id
- Events
  - GET /api/events
  - POST /api/events
  - GET /api/events/:id
  - PATCH /api/events/:id
  - DELETE /api/events/:id

Notes
- All timestamps must be ISO-8601 (e.g., 2025-08-10T03:00:00Z)
- Content-Type: application/json for request bodies

## Example cURL calls
Replace BASE with http://127.0.0.1:8787.

Headaches

- Create
  - curl -sS \
    -H "content-type: application/json" \
    -d '{"timestamp":"2025-08-10T03:00:00Z","severity":6,"aura":1}' \
    "${BASE}/api/headaches"

- List with filters (since, until, severity range, limit/offset)
  - curl -sS "${BASE}/api/headaches?since=2025-08-09T00:00:00Z&until=2025-08-11T00:00:00Z&severity_min=5&severity_max=10&limit=20&offset=0"

- Update (PATCH)
  - curl -sS -X PATCH \
    -H "content-type: application/json" \
    -d '{"severity":8}' \
    "${BASE}/api/headaches/1"

- Delete
  - curl -sS -X DELETE "${BASE}/api/headaches/1" -i

Events

- Create
  - curl -sS \
    -H "content-type: application/json" \
    -d '{"timestamp":"2025-08-10T01:30:00Z","event_type":"note","value":"slept well"}' \
    "${BASE}/api/events"

- List with filters (since, until, type)
  - curl -sS "${BASE}/api/events?since=2025-08-09T00:00:00Z&until=2025-08-11T00:00:00Z&type=note"

- Update (PATCH)
  - curl -sS -X PATCH \
    -H "content-type: application/json" \
    -d '{"value":"updated note text"}' \
    "${BASE}/api/events/1"

- Delete
  - curl -sS -X DELETE "${BASE}/api/events/1" -i

## Quick CORS check (in browser console)
Paste into the browser devtools console. You should see JSON output and no CORS errors.

- const BASE = 'http://127.0.0.1:8787';
- fetch(`${BASE}/api/headaches`, { headers: { 'content-type': 'application/json' } })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

Preflight requests to /api/* are also handled (OPTIONS) and responses include Access-Control-Allow-Origin: *.

## Seeding sample data (optional)
You can manually run the SQL in worker/seed.sql using wrangler d1 execute if you want sample rows:

- npx wrangler d1 execute headacher --local --file=worker/seed.sql

Then list data:

- curl -sS "${BASE}/api/headaches"
- curl -sS "${BASE}/api/events"
